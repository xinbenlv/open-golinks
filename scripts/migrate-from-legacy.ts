#!/usr/bin/env node

/**
 * 从 Heroku MongoDB 迁移数据到 PostgreSQL
 *
 * 使用方法：
 *   npm run migrate:legacy                # 非破坏性 upsert（保留 Postgres-only 链接）
 *   npm run migrate:legacy -- --dry-run   # 测试运行（仅显示将迁移的数据，不修改数据库）
 *   npm run migrate:legacy -- --replace-all # 破坏性全量替换（会清空 links/audit_logs/daily_visits）
 *
 * 环境变量：
 *   LEGACY_MONGO_DB_READONLY_URL - 旧 MongoDB 只读连接字符串
 *   DATABASE_URL        - 新 PostgreSQL 连接字符串
 *   SUPABASE_URL        - Supabase project URL
 *   SUPABASE_SECRET_KEY - Supabase service-role/Admin key
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';
import postgres from 'postgres';
import {
  createSupabaseAdminClientFromEnv,
  ensurePublicUserMirror,
  loadAuthIdentityMap,
  loadOwnershipSummary,
  loadPublicUserEmailSummary,
  loadPublicUsers,
  resolveOwnerByEmail,
  type PublicUserRow,
  type ResolveOwnerResult,
} from './lib/identity-acl.ts';
import { normalizeEmail } from '../src/lib/identity.ts';

// 加载 .env 文件
const envPath = resolve(process.cwd(), '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env 文件不存在，使用已有的环境变量
}

// ============ TYPES ============

/**
 * Legacy MongoDB schema (collection: shortlinks):
 *   { _id, linkname, dest, author }
 */
interface LegacyLink {
  _id?: any;
  linkname?: string;  // -> slug
  dest?: string;      // -> url
  author?: string;    // -> owner (email or "anonymous")
  [key: string]: any;
}

// ============ CONFIG ============

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const VERBOSE = args.has('--verbose');
const REPLACE_ALL = args.has('--replace-all');
const MODE = REPLACE_ALL ? 'replace-all' : 'upsert-only';

const LEGACY_MONGO_URL = process.env.LEGACY_MONGO_DB_READONLY_URL;
if (!LEGACY_MONGO_URL) {
  console.error('❌ 错误: LEGACY_MONGO_DB_READONLY_URL 环境变量未设置');
  process.exit(1);
}

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ 错误: DATABASE_URL 环境变量未设置');
  process.exit(1);
}

// ============ UTILITIES ============

function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const prefix = {
    info: '📋',
    warn: '⚠️',
    error: '❌',
    success: '✅',
  }[level];
  console.log(`${prefix} ${message}`);
}

function vlog(message: string) {
  if (VERBOSE) log(message);
}

function normalizeSlug(slug: any): string {
  if (typeof slug !== 'string') return '';
  return slug.toLowerCase().trim();
}

function normalizeUrl(url: any): string {
  if (typeof url !== 'string') return '';
  try {
    new URL(url);
    return url;
  } catch {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }
}

// ============ SCHEMA MAPPING ============

interface MappedLink {
  slug: string;
  url: string;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  visits: number;
  createdByFingerprint: string | null;
  isPublic: boolean;
  metadata: any;
}

function isAnonymousAuthor(author: unknown): boolean {
  return (
    typeof author !== 'string' ||
    !author.trim() ||
    author.trim().toLowerCase() === 'anonymous'
  );
}

function legacyAuthorMetadata(author: unknown): Record<string, unknown> | null {
  const email = normalizeEmail(author);
  return email ? { legacy_author_email: email } : null;
}

function mapLegacyLink(
  mongoLink: LegacyLink,
  emailToOwnerMap: Map<string, ResolveOwnerResult>,
): MappedLink | null {
  const slug = normalizeSlug(mongoLink.linkname);
  if (!slug) {
    vlog(`  ⚠️ 跳过无效 slug 的链接`);
    return null;
  }

  const url = normalizeUrl(mongoLink.dest);
  if (!url) {
    vlog(`  ⚠️ 跳过无效 URL 的链接: ${slug}`);
    return null;
  }

  // author 是 email 或 "anonymous"
  let ownerId: string | null = null;
  const author = mongoLink.author;
  if (!isAnonymousAuthor(author)) {
    const email = normalizeEmail(author);
    if (email) {
      const resolved = emailToOwnerMap.get(email);
      ownerId = resolved?.status === 'mapped' ? resolved.ownerId : null;
    }
  }
  const metadata = legacyAuthorMetadata(author);

  const now = new Date();
  return {
    slug,
    url,
    ownerId,
    createdAt: now,
    updatedAt: now,
    visits: 0,
    createdByFingerprint: null,
    isPublic: false,
    metadata,
  };
}

// ============ MIGRATION LOGIC ============

async function migrateData() {
  const mongoClient = new MongoClient(LEGACY_MONGO_URL!);
  const sql = postgres(DB_URL!);

  let stats = {
    usersRead: 0,
    usersMigrated: 0,
    linksRead: 0,
    linksMigrated: 0,
    linksCreated: 0,
    linksUpdated: 0,
    errors: 0,
  };

  try {
    // 连接到 MongoDB
    log('连接到 MongoDB...');
    await mongoClient.connect();
    const mongoDb = mongoClient.db();
    log('✅ MongoDB 连接成功');

    // ============ STEP 1: 读取 MongoDB 链接 ============
    log('\n🔗 读取 MongoDB 链接...');

    const legacyLinks = (await mongoDb.collection('shortlinks').find({}).toArray()) as LegacyLink[];
    stats.linksRead = legacyLinks.length;
    log(`读取 ${stats.linksRead} 个链接`);

    // ============ STEP 2: 从 author 字段提取唯一用户 ============
    log('\n📚 提取用户...');

    const uniqueAuthors = new Set<string>();
    let anonymousAuthors = 0;
    let invalidAuthors = 0;
    for (const link of legacyLinks) {
      if (isAnonymousAuthor(link.author)) {
        anonymousAuthors++;
        continue;
      }
      const email = normalizeEmail(link.author);
      if (email) {
        uniqueAuthors.add(email);
      } else {
        invalidAuthors++;
      }
    }
    stats.usersRead = uniqueAuthors.size;
    log(`发现 ${stats.usersRead} 个唯一有效作者 email（anonymous=${anonymousAuthors}, invalid=${invalidAuthors}）`);

    const supabase = createSupabaseAdminClientFromEnv();
    log('读取 Supabase Auth users...');
    const authMap = await loadAuthIdentityMap(supabase);
    let publicUsers: PublicUserRow[] = await loadPublicUsers(sql);
    log(`Auth users=${authMap.total}, public.users=${publicUsers.length}`);

    const emailToOwnerMap = new Map<string, ResolveOwnerResult>();
    const ownerStats = {
      mappedExisting: 0,
      mappedCreated: 0,
      wouldCreate: 0,
      conflicts: 0,
      syntheticMirrors: 0,
    };

    for (const email of uniqueAuthors) {
      try {
        const resolved = await resolveOwnerByEmail(
          email,
          publicUsers,
          authMap,
          supabase,
          { apply: !DRY_RUN },
        );
        emailToOwnerMap.set(email, resolved);
        if (resolved.status === 'mapped') {
          if (!DRY_RUN) {
            await ensurePublicUserMirror(
              sql,
              resolved.ownerId,
              resolved.email,
              resolved.syntheticPublicUserIds,
            );
            publicUsers = await loadPublicUsers(sql);
          }
          resolved.createdAuthUser ? ownerStats.mappedCreated++ : ownerStats.mappedExisting++;
          ownerStats.syntheticMirrors += resolved.syntheticPublicUserIds.length;
          vlog(`  ✓ ${email} -> ${resolved.ownerId}${resolved.createdAuthUser ? ' (created Auth user)' : ''}`);
        } else if (resolved.status === 'would_create') {
          ownerStats.wouldCreate++;
          ownerStats.syntheticMirrors += resolved.syntheticPublicUserIds.length;
          vlog(`  [DRY-RUN] would create Supabase Auth user for ${email}`);
        } else {
          ownerStats.conflicts++;
          stats.errors++;
          log(`  owner unresolved ${email}: ${resolved.reason}`, 'warn');
        }
        stats.usersMigrated++;
      } catch (err) {
        stats.errors++;
        log(`  错误处理用户 ${email}: ${(err as Error).message}`, 'error');
      }
    }

    log(`✅ 处理了 ${stats.usersMigrated}/${stats.usersRead} 个用户`);
    log(`   已映射 Auth user: ${ownerStats.mappedExisting}, 新建: ${ownerStats.mappedCreated}, dry-run 将新建: ${ownerStats.wouldCreate}, conflicts: ${ownerStats.conflicts}, synthetic mirror hits: ${ownerStats.syntheticMirrors}`);

    // ============ STEP 3: 迁移链接 ============
    log('\n🔗 迁移链接...');

    if (REPLACE_ALL) {
      if (!DRY_RUN) {
        log(`清空现有链接...`, 'warn');
        await sql`DELETE FROM daily_visits`;
        await sql`DELETE FROM audit_logs`;
        await sql`DELETE FROM links`;
      } else {
        log(`使用 ${MODE} dry-run 模式: 实际执行时会先清空 links/audit_logs/daily_visits`, 'warn');
      }
    } else {
      log(`使用 ${MODE} 模式: 添加/覆盖 MongoDB 中存在的 slug, 保留 Postgres-only 链接`);
    }

    for (const mongoLink of legacyLinks) {
      try {
        const link = mapLegacyLink(mongoLink, emailToOwnerMap);
        if (!link) continue;

        if (!DRY_RUN) {
          const result = await sql`
            INSERT INTO links (
              slug, url, owner_id, created_at, updated_at,
              visits, created_by_fingerprint, is_public, metadata, url_history
            )
            VALUES (
              ${link.slug}, ${link.url}, ${link.ownerId},
              ${link.createdAt}, ${link.updatedAt},
              ${link.visits}, ${link.createdByFingerprint},
              ${link.isPublic}, ${link.metadata ? sql.json(link.metadata) : null},
              '[]'::jsonb
            )
            ON CONFLICT (slug) DO UPDATE SET
              url = EXCLUDED.url,
              owner_id = CASE
                WHEN links.owner_id IS NULL THEN EXCLUDED.owner_id
                ELSE links.owner_id
              END,
              updated_at = EXCLUDED.updated_at,
              metadata = CASE
                WHEN EXCLUDED.metadata IS NULL THEN links.metadata
                ELSE COALESCE(links.metadata, '{}'::jsonb) || EXCLUDED.metadata
              END
            RETURNING (xmax = 0) AS inserted
          `;
          const inserted = Boolean((result[0] as { inserted?: boolean } | undefined)?.inserted);
          if (inserted) {
            stats.linksCreated++;
          } else {
            stats.linksUpdated++;
          }
        }
        stats.linksMigrated++;
        vlog(`  ${DRY_RUN ? '[DRY-RUN]' : '✓'} ${link.slug} -> ${link.url}`);
      } catch (err) {
        stats.errors++;
        log(`  错误迁移链接 ${mongoLink.linkname}: ${(err as Error).message}`, 'error');
      }
    }

    log(`✅ 迁移了 ${stats.linksMigrated}/${stats.linksRead} 个链接`);

    // ============ SUMMARY ============
    log('\n' + '='.repeat(50));
    if (DRY_RUN) {
      log('📋 DRY-RUN 模式 - 未修改任何数据', 'info');
    }
    log('迁移统计:', 'success');
    log(`  模式: ${MODE}${DRY_RUN ? ' dry-run' : ''}`);
    log(`  👥 用户:  ${stats.usersMigrated}/${stats.usersRead} 已迁移`);
    log(`  🔗 链接:  ${stats.linksMigrated}/${stats.linksRead} 已迁移`);
    if (!DRY_RUN) {
      const deleteSummary = REPLACE_ALL ? '已先清空 links/audit_logs/daily_visits' : '0';
      log(`     新增: ${stats.linksCreated}, 覆盖: ${stats.linksUpdated}, 删除: ${deleteSummary}`);
    }
    if (stats.errors > 0) {
      log(`  ⚠️  错误:  ${stats.errors}`, 'warn');
    }
    const ownership = await loadOwnershipSummary(sql);
    const publicUserEmails = await loadPublicUserEmailSummary(sql);
    log('Owner coverage:');
    log(`  total=${ownership.total}, owned=${ownership.owned}, unowned=${ownership.unowned}, unowned_with_legacy_email=${ownership.unowned_with_legacy_email}, unowned_with_fingerprint=${ownership.unowned_with_fingerprint}`);
    log('Identity consistency:');
    log(`  public_users_total=${publicUserEmails.public_users_total}, non_canonical_public_user_emails=${publicUserEmails.non_canonical_public_user_emails}`);
    log(`  auth map source=${authMap.source}, auth_users_total=${authMap.total}`);
    log('='.repeat(50));

    if (!DRY_RUN) {
      log('✅ 迁移完成！', 'success');
    } else {
      log('✅ DRY-RUN 完成！使用 npm run migrate:legacy 执行非破坏性 upsert', 'success');
    }

    await sql.end();
  } catch (err) {
    log(`致命错误: ${(err as Error).message}`, 'error');
    process.exit(1);
  } finally {
    await mongoClient.close();
    vlog('MongoDB 连接已关闭');
  }
}

// ============ MAIN ============

log(`\n${'='.repeat(50)}`);
log('MongoDB 到 PostgreSQL 数据迁移');
log(`${'='.repeat(50)}`);
log(`模式: ${MODE}`);
if (DRY_RUN) {
  log('🧪 DRY-RUN 模式: 仅显示将迁移的数据', 'warn');
}
if (VERBOSE) {
  log('🔍 详细日志已启用');
}
log('');

migrateData().catch((err) => {
  log(`未捕获的错误: ${err.message}`, 'error');
  process.exit(1);
});
