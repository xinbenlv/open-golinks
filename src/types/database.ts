import type { User, Link, AuditLog, DailyVisit } from '@/db/schema';

// 从 schema.ts 导出的数据库类型
export type UserRecord = User;
export type LinkRecord = Link;
export type AuditLogRecord = AuditLog;
export type DailyVisitRecord = DailyVisit;

// URL 历史记录条目
export interface UrlHistoryEntry {
  url: string;
  changedAt: string;
  changedBy?: string; // user_id 或 fingerprint
}

// 链接元数据
export interface LinkMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  showWarning?: boolean;
}

// 审计日志差异
export interface AuditLogDiff {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: string[];
}

// 审计日志元数据
export interface AuditLogMetadata {
  userAgent?: string;
  turnstileValidated?: boolean;
  fromOwnerId?: string;
  toOwnerId?: string;
  claimToken?: string;
}
