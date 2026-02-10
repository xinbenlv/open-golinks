import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auditService } from '@/lib/services/audit.service';
import { db } from '@/db/db';
import { auditLogsTable, linksTable } from '@/db/schema';
import { hashIP, hashSHA256 } from '@/lib/utils/hash';

/**
 * Note: These are unit tests that test the audit service logic
 * For full integration tests with database, use integration tests
 */

vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    query: {
      linksTable: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logCreate', () => {
    it('should create an audit log for link creation', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            actorId: 'user-123',
            action: 'CREATE',
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logCreate(
        'test-slug',
        'https://example.com',
        'user-123',
        '192.168.1.1'
      );

      expect(result).toBeDefined();
      expect(result.action).toBe('CREATE');
      expect(result.linkSlug).toBe('test-slug');
    });

    it('should create fingerprint for anonymous users', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            actorId: null,
            actorFingerprint: 'fingerprint-hash',
            action: 'CREATE',
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logCreate(
        'test-slug',
        'https://example.com',
        null,  // Anonymous user
        '192.168.1.1'
      );

      expect(result).toBeDefined();
      expect(result.actorId).toBeNull();
      expect(result.actorFingerprint).toBeDefined();
    });
  });

  describe('logUpdate', () => {
    it('should log URL changes', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            action: 'UPDATE',
            diff: {
              before: { url: 'https://old.com', metadata: {} },
              after: { url: 'https://new.com', metadata: {} },
              changes: [{ field: 'url', before: 'https://old.com', after: 'https://new.com' }],
            },
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logUpdate(
        'test-slug',
        { url: 'https://old.com', metadata: {} },
        { url: 'https://new.com', metadata: {} },
        'user-123',
        '192.168.1.1'
      );

      expect(result.action).toBe('UPDATE');
      expect(result.diff?.changes).toBeDefined();
      expect(result.diff?.changes?.length).toBe(1);
    });

    it('should detect metadata changes', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            action: 'UPDATE',
            diff: {
              changes: [
                { field: 'metadata', before: { title: 'Old' }, after: { title: 'New' } },
              ],
            },
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logUpdate(
        'test-slug',
        { url: 'https://example.com', metadata: { title: 'Old' } },
        { url: 'https://example.com', metadata: { title: 'New' } },
        'user-123',
        '192.168.1.1'
      );

      expect(result.diff?.changes?.length).toBe(1);
      expect(result.diff?.changes?.[0].field).toBe('metadata');
    });
  });

  describe('logDelete', () => {
    it('should log link deletion', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            action: 'DELETE',
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logDelete(
        'test-slug',
        'user-123',
        '192.168.1.1'
      );

      expect(result.action).toBe('DELETE');
      expect(result.linkSlug).toBe('test-slug');
    });
  });

  describe('logClaim', () => {
    it('should log link claim with ownership change', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            action: 'CLAIM',
            diff: {
              before: { ownerId: null },
              after: { ownerId: 'user-123' },
              changes: [{ field: 'ownerId', before: null, after: 'user-123' }],
            },
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logClaim(
        'test-slug',
        'user-123',
        '192.168.1.1'
      );

      expect(result.action).toBe('CLAIM');
      expect(result.diff?.before?.ownerId).toBeNull();
      expect(result.diff?.after?.ownerId).toBe('user-123');
    });
  });

  describe('logTransfer', () => {
    it('should log link transfer between users', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            action: 'TRANSFER',
            diff: {
              before: { ownerId: 'user-old' },
              after: { ownerId: 'user-new' },
              changes: [{ field: 'ownerId', before: 'user-old', after: 'user-new' }],
            },
            metadata: {
              fromOwnerId: 'user-old',
              toOwnerId: 'user-new',
            },
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logTransfer(
        'test-slug',
        'user-old',
        'user-new',
        'admin-user',
        '192.168.1.1'
      );

      expect(result.action).toBe('TRANSFER');
      expect(result.metadata?.fromOwnerId).toBe('user-old');
      expect(result.metadata?.toOwnerId).toBe('user-new');
    });
  });

  describe('logVisit', () => {
    it('should log visit action', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'test-id',
            linkSlug: 'test-slug',
            action: 'VISIT',
            actorId: null,
            timestamp: new Date(),
          }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await auditService.logVisit(
        'test-slug',
        '192.168.1.1'
      );

      expect(result.action).toBe('VISIT');
      expect(result.actorId).toBeNull();
    });
  });

  describe('getAuditLog', () => {
    it('should retrieve audit logs for a link', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          linkSlug: 'test-slug',
          action: 'CREATE',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: 'log-2',
          linkSlug: 'test-slug',
          action: 'UPDATE',
          timestamp: new Date('2024-01-02'),
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockLogs),
            }),
          }),
        }),
      });

      (db.select as any).mockReturnValue(mockSelect());

      // Mock the count query
      const mockCountSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

      (db.select as any).mockReturnValueOnce(mockCountSelect());

      const result = await auditService.getAuditLog('test-slug');

      expect(result.slug).toBe('test-slug');
      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by action type', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          linkSlug: 'test-slug',
          action: 'UPDATE',
          timestamp: new Date('2024-01-01'),
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockLogs),
              }),
            }),
          }),
        }),
      });

      (db.select as any).mockReturnValue(mockSelect());

      const mockCountSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      (db.select as any).mockReturnValueOnce(mockCountSelect());

      const result = await auditService.getAuditLog('test-slug', 'UPDATE');

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].action).toBe('UPDATE');
    });
  });

  describe('getHistory', () => {
    it('should throw error for non-existent link', async () => {
      const mockFindFirst = vi.fn().mockResolvedValue(null);

      (db.query.linksTable.findFirst as any).mockImplementation(mockFindFirst);

      await expect(
        auditService.getHistory('nonexistent', 50, 0)
      ).rejects.toThrow('Link not found');
    });

    it('should format history for public view', async () => {
      const mockLink = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        isPublic: true,
        visits: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const mockFindFirst = vi.fn().mockResolvedValue(mockLink);

      (db.query.linksTable.findFirst as any).mockImplementation(mockFindFirst);

      const mockLogs = [
        {
          id: 'log-1',
          linkSlug: 'test-slug',
          action: 'CREATE',
          actorId: 'user-123',
          actorIpHash: '1234567890abcdef',
          diff: { after: { url: 'https://example.com' } },
          timestamp: new Date('2024-01-01'),
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockLogs),
            }),
          }),
        }),
      });

      (db.select as any).mockReturnValue(mockSelect());

      const mockCountSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      (db.select as any).mockReturnValueOnce(mockCountSelect());

      const result = await auditService.getHistory('test-slug', 50, 0, 'user-123');

      expect(result.slug).toBe('test-slug');
      expect(result.isPublic).toBe(true);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].action).toBe('CREATE');
    });
  });
});
