import {
  pgTable,
  varchar,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  primaryKey,
  foreignKey,
  index,
  check,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * USERS TABLE
 * 同步 Supabase Auth (auth.users.id)
 */
export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    role: varchar('role', { length: 20 }).notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
  ]
);

/**
 * LINKS TABLE
 * 核心数据模型：URL 快捷方式
 *
 * 约束条件：
 * - slug: 主键，varchar(50)
 * - slug 验证正则：^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$
 * - owner_id: nullable (null = 匿名创建)
 * - created_by_fingerprint: SHA-256 哈希（匿名用户追踪）
 * - url_history: JSONB 数组 {url, changed_at, changed_by}
 * - metadata: JSONB {title?, description?, tags[], show_warning?}
 */
export const linksTable = pgTable(
  'links',
  {
    slug: varchar('slug', { length: 50 }).primaryKey().notNull(),
    url: text('url').notNull(),
    ownerId: uuid('owner_id').references(() => usersTable.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    visits: integer('visits').notNull().default(0),
    createdByFingerprint: varchar('created_by_fingerprint', { length: 64 }),
    isPublic: boolean('is_public').notNull().default(false),
    urlHistory: jsonb('url_history').notNull().default([]),
    metadata: jsonb('metadata'),
  },
  (table) => [
    check(
      'slug_format',
      sql`slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$'`
    ),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [usersTable.id],
      name: 'fk_links_owner_id',
    }).onDelete('set null'),
    index('idx_links_owner_id').on(table.ownerId),
    index('idx_links_created_at').on(table.createdAt),
    index('idx_links_deleted_at').on(table.deletedAt),
    index('idx_links_is_public').on(table.isPublic),
  ]
);

/**
 * AUDIT_LOGS TABLE
 * 不可变的审计日志：所有链接操作的完整追踪
 *
 * 字段：
 * - link_slug: FK → links.slug (SET NULL，不是 CASCADE)
 * - actor_id: FK → users.id (nullable 用于匿名)
 * - actor_fingerprint: SHA-256 哈希
 * - actor_ip_hash: SHA-256(IP + salt)
 * - action: CREATE, UPDATE, DELETE, CLAIM, VISIT, TRANSFER
 * - diff: JSONB {before?, after?, changes[]}
 * - metadata: JSONB {user_agent?, turnstile_validated?, from_owner_id?, to_owner_id?}
 */
export const auditLogsTable = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    linkSlug: varchar('link_slug', { length: 50 }).references(
      () => linksTable.slug,
      {
        onDelete: 'set null',
      }
    ),
    actorId: uuid('actor_id').references(() => usersTable.id, {
      onDelete: 'set null',
    }),
    actorFingerprint: varchar('actor_fingerprint', { length: 64 }),
    actorIpHash: varchar('actor_ip_hash', { length: 64 }).notNull(),
    action: varchar('action', {
      length: 50,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'CLAIM', 'VISIT', 'TRANSFER'],
    }).notNull(),
    diff: jsonb('diff'),
    metadata: jsonb('metadata'),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_link_slug').on(table.linkSlug),
    index('idx_audit_logs_actor_id').on(table.actorId),
    index('idx_audit_logs_action').on(table.action),
    index('idx_audit_logs_timestamp').on(table.timestamp),
  ]
);

/**
 * DAILY_VISITS TABLE
 * 分析汇总 - 原子 UPSERT 模式
 *
 * 约束：UNIQUE (link_slug, date)
 * 用途：无竞态条件的高效日访问统计
 */
export const dailyVisitsTable = pgTable(
  'daily_visits',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    linkSlug: varchar('link_slug', { length: 50 })
      .notNull()
      .references(() => linksTable.slug, {
        onDelete: 'cascade',
      }),
    date: date('date', { mode: 'date' }).notNull(),
    count: integer('count').notNull().default(1),
  },
  (table) => [
    index('idx_daily_visits_link_slug').on(table.linkSlug),
    index('idx_daily_visits_date').on(table.date),
    uniqueIndex('unique_daily_visits').on(table.linkSlug, table.date),
  ]
);

// ============ TYPE EXPORTS ============

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Link = typeof linksTable.$inferSelect;
export type NewLink = typeof linksTable.$inferInsert;

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type NewAuditLog = typeof auditLogsTable.$inferInsert;

export type DailyVisit = typeof dailyVisitsTable.$inferSelect;
export type NewDailyVisit = typeof dailyVisitsTable.$inferInsert;
