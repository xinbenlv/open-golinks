import { db } from '@/db/db';
import { auditLogsTable, linksTable } from '@/db/schema';
import type { AuditLog, NewAuditLog } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { hashIP, hashSHA256 } from '@/lib/utils/hash';

export class AuditService {
  /**
   * Log link creation
   */
  async logCreate(
    slug: string,
    url: string,
    userId: string | null,
    clientIP: string,
    metadata?: any
  ): Promise<AuditLog> {
    const ipHash = hashIP(clientIP, process.env.IP_HASH_SALT || 'default-salt');
    const fingerprint = userId ? undefined : hashSHA256(`${clientIP}::${Date.now()}`);

    const entry: NewAuditLog = {
      linkSlug: slug,
      actorId: userId,
      actorFingerprint: fingerprint,
      actorIpHash: ipHash,
      action: 'CREATE',
      diff: {
        after: { url, metadata },
      },
      metadata: {
        userAgent: '',  // Will be set from request headers
        turnstileValidated: false,
        ...metadata,
      },
      timestamp: new Date(),
    };

    const result = await db
      .insert(auditLogsTable)
      .values(entry)
      .returning();

    return result[0];
  }

  /**
   * Log link update
   */
  async logUpdate(
    slug: string,
    beforeData: any,
    afterData: any,
    userId: string | null,
    clientIP: string
  ): Promise<AuditLog> {
    const ipHash = hashIP(clientIP, process.env.IP_HASH_SALT || 'default-salt');

    const changes = [];
    if (beforeData.url !== afterData.url) {
      changes.push({
        field: 'url',
        before: beforeData.url,
        after: afterData.url,
      });
    }
    if (JSON.stringify(beforeData.metadata) !== JSON.stringify(afterData.metadata)) {
      changes.push({
        field: 'metadata',
        before: beforeData.metadata,
        after: afterData.metadata,
      });
    }

    const entry: NewAuditLog = {
      linkSlug: slug,
      actorId: userId,
      actorFingerprint: undefined,
      actorIpHash: ipHash,
      action: 'UPDATE',
      diff: {
        before: {
          url: beforeData.url,
          metadata: beforeData.metadata,
        },
        after: {
          url: afterData.url,
          metadata: afterData.metadata,
        },
        changes,
      },
      timestamp: new Date(),
    };

    const result = await db
      .insert(auditLogsTable)
      .values(entry)
      .returning();

    return result[0];
  }

  /**
   * Log link deletion
   */
  async logDelete(
    slug: string,
    userId: string | null,
    clientIP: string
  ): Promise<AuditLog> {
    const ipHash = hashIP(clientIP, process.env.IP_HASH_SALT || 'default-salt');

    const entry: NewAuditLog = {
      linkSlug: slug,
      actorId: userId,
      actorFingerprint: undefined,
      actorIpHash: ipHash,
      action: 'DELETE',
      timestamp: new Date(),
    };

    const result = await db
      .insert(auditLogsTable)
      .values(entry)
      .returning();

    return result[0];
  }

  /**
   * Log link claim
   */
  async logClaim(
    slug: string,
    userId: string,
    clientIP: string
  ): Promise<AuditLog> {
    const ipHash = hashIP(clientIP, process.env.IP_HASH_SALT || 'default-salt');

    const entry: NewAuditLog = {
      linkSlug: slug,
      actorId: userId,
      actorFingerprint: undefined,
      actorIpHash: ipHash,
      action: 'CLAIM',
      diff: {
        before: { ownerId: null },
        after: { ownerId: userId },
        changes: [
          {
            field: 'ownerId',
            before: null,
            after: userId,
          },
        ],
      },
      timestamp: new Date(),
    };

    const result = await db
      .insert(auditLogsTable)
      .values(entry)
      .returning();

    return result[0];
  }

  /**
   * Log link transfer
   */
  async logTransfer(
    slug: string,
    fromId: string | null,
    toId: string,
    userId: string,
    clientIP: string
  ): Promise<AuditLog> {
    const ipHash = hashIP(clientIP, process.env.IP_HASH_SALT || 'default-salt');

    const entry: NewAuditLog = {
      linkSlug: slug,
      actorId: userId,
      actorFingerprint: undefined,
      actorIpHash: ipHash,
      action: 'TRANSFER',
      diff: {
        before: { ownerId: fromId },
        after: { ownerId: toId },
        changes: [
          {
            field: 'ownerId',
            before: fromId,
            after: toId,
          },
        ],
      },
      metadata: {
        fromOwnerId: fromId,
        toOwnerId: toId,
      },
      timestamp: new Date(),
    };

    const result = await db
      .insert(auditLogsTable)
      .values(entry)
      .returning();

    return result[0];
  }

  /**
   * Log link visit (for analytics)
   */
  async logVisit(
    slug: string,
    clientIP: string
  ): Promise<AuditLog> {
    const ipHash = hashIP(clientIP, process.env.IP_HASH_SALT || 'default-salt');

    const entry: NewAuditLog = {
      linkSlug: slug,
      actorId: null,
      actorFingerprint: undefined,
      actorIpHash: ipHash,
      action: 'VISIT',
      timestamp: new Date(),
    };

    const result = await db
      .insert(auditLogsTable)
      .values(entry)
      .returning();

    return result[0];
  }

  /**
   * Get audit log (admin only)
   */
  async getAuditLog(
    slug: string,
    action?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    slug: string;
    logs: AuditLog[];
    total: number;
  }> {
    let query = db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.linkSlug, slug));

    if (action) {
      query = query.where(eq(auditLogsTable.action, action));
    }

    const logs = await query
      .limit(limit)
      .offset(offset)
      .orderBy(desc(auditLogsTable.timestamp));

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.linkSlug, slug));

    const total = countResult[0]?.count || 0;

    return { slug, logs, total };
  }

  /**
   * Get link history (formatted for public view)
   */
  async getHistory(
    slug: string,
    limit: number = 50,
    offset: number = 0,
    requestingUserId?: string,
    isAdmin: boolean = false
  ): Promise<{
    slug: string;
    isPublic: boolean;
    history: any[];
    total: number;
  }> {
    // Get link to check public status
    const link = await db.query.linksTable.findFirst({
      where: eq(linksTable.slug, slug),
    });

    if (!link) {
      throw new Error('Link not found');
    }

    // Determine if user can see unmasked IPs
    const canRevealIPs =
      isAdmin ||
      (requestingUserId && link.ownerId === requestingUserId);

    // Get audit logs
    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.linkSlug, slug))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(auditLogsTable.timestamp));

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.linkSlug, slug));

    const total = countResult[0]?.count || 0;

    // Format for display
    const history = logs.map(log => ({
      action: log.action,
      timestamp: log.timestamp.toISOString(),
      url: log.diff?.after?.url,
      actorDisplay: log.actorId
        ? 'Registered User'
        : canRevealIPs
        ? log.actorIpHash.substring(0, 8) + '...'  // Partial hash reveal
        : 'Anonymous',
      changes: log.diff?.changes,
    }));

    return {
      slug,
      isPublic: link.isPublic,
      history,
      total,
    };
  }
}

export const auditService = new AuditService();
