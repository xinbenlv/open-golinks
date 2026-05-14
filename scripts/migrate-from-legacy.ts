#!/usr/bin/env node

/**
 * 从 Heroku MongoDB 迁移数据到 PostgreSQL
 *
 * 使用方法：
 *   npm run migrate:legacy                # 实际迁移（会覆盖现有数据）
 *   npm run migrate:legacy -- --dry-run   # 测试运行（仅显示将迁移的数据，不修改数据库）
 *
 * 环境变量：
 *   LEGACY_MONGO_DB_URL - 旧 MongoDB 连接字符串
 *   DATABASE_URL        - 新 PostgreSQL 连接字符串
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

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

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const LEGACY_MONGO_URL = process.env.LEGACY_MONGO_DB_URL;
if (!LEGACY_MONGO_URL) {
  console.error('❌ 错误: LEGACY_MONGO_DB_URL 环境变量未设置');
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

function mapLegacyLink(mongoLink: LegacyLink, emailToUserIdMap: Map<string, string>): MappedLink | null {
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
  if (author && author !== 'anonymous') {
    ownerId = emailToUserIdMap.get(author) || null;
  }

  const now = new Date();
  return {
    slug,
    url,
    ownerId,
    createdAt: now,
    updatedAt: now,
    visits: 0,
    createdByFingerprint: null,
    isPublic: true,
    metadata: author ? { legacyAuthor: author } : null,
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
    for (const link of legacyLinks) {
      if (link.author && link.author !== 'anonymous') {
        uniqueAuthors.add(link.author);
      }
    }
    stats.usersRead = uniqueAuthors.size;
    log(`发现 ${stats.usersRead} 个唯一作者（排除 anonymous）`);

    // email -> UUID 映射
    const emailToUserIdMap = new Map<string, string>();

    if (!DRY_RUN) {
      // 为每个 author 创建或复用已有的 users 记录
      for (const email of uniqueAuthors) {
        try {
          // 查询是否已经存在（Supabase Auth 可能已创建）
          const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
          const existingUser = existing[0] as { id: string } | undefined;
          if (existingUser) {
            emailToUserIdMap.set(email, existingUser.id);
            vlog(`  ✓ 已存在: ${email} (${existingUser.id})`);
          } else {
            const id = uuidv4();
            await sql`
              INSERT INTO users (id, email, role, created_at)
              VALUES (${id}, ${email}, 'user', NOW())
            `;
            emailToUserIdMap.set(email, id);
            vlog(`  ✓ 新建: ${email} (${id})`);
          }
          stats.usersMigrated++;
        } catch (err) {
          stats.errors++;
          log(`  错误处理用户 ${email}: ${(err as Error).message}`, 'error');
        }
      }
    } else {
      for (const email of uniqueAuthors) {
        emailToUserIdMap.set(email, uuidv4());
        vlog(`  [DRY-RUN] ${email}`);
      }
      stats.usersMigrated = uniqueAuthors.size;
    }

    log(`✅ 处理了 ${stats.usersMigrated}/${stats.usersRead} 个用户`);

    // ============ STEP 3: 迁移链接 ============
    log('\n🔗 迁移链接...');

    if (!DRY_RUN) {
      log(`清空现有链接...`);
      await sql`DELETE FROM daily_visits`;
      await sql`DELETE FROM audit_logs`;
      await sql`DELETE FROM links`;
    }

    for (const mongoLink of legacyLinks) {
      try {
        const link = mapLegacyLink(mongoLink, emailToUserIdMap);
        if (!link) continue;

        if (!DRY_RUN) {
          await sql`
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
              owner_id = EXCLUDED.owner_id,
              updated_at = EXCLUDED.updated_at,
              metadata = EXCLUDED.metadata
          `;
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
    log(`  👥 用户:  ${stats.usersMigrated}/${stats.usersRead} 已迁移`);
    log(`  🔗 链接:  ${stats.linksMigrated}/${stats.linksRead} 已迁移`);
    if (stats.errors > 0) {
      log(`  ⚠️  错误:  ${stats.errors}`, 'warn');
    }
    log('='.repeat(50));

    if (!DRY_RUN) {
      log('✅ 迁移完成！', 'success');
    } else {
      log('✅ DRY-RUN 完成！使用 npm run migrate:legacy 执行实际迁移', 'success');
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
