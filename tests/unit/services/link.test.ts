import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LinkService } from '@/lib/services/link.service';
import { ErrorCode } from '@/lib/constants/errors';
import { db } from '@/db/db';
import { linksTable } from '@/db/schema';

// Mock database
vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    query: {
      linksTable: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

// Mock validations
vi.mock('@/lib/validations', () => ({
  validateSlug: vi.fn((slug) => {
    if (!slug || slug.length < 3) {
      return { valid: false, error: ErrorCode.SLUG_TOO_SHORT };
    }
    if (slug.length > 50) {
      return { valid: false, error: ErrorCode.SLUG_TOO_LONG };
    }
    return { valid: true, normalized: slug.toLowerCase() };
  }),
  validateURL: vi.fn((url) => {
    if (!url || !url.startsWith('http')) {
      return { valid: false, error: ErrorCode.URL_INVALID };
    }
    return { valid: true };
  }),
}));

describe('LinkService', () => {
  let linkService: LinkService;

  beforeEach(() => {
    linkService = new LinkService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new link with provided slug', async () => {
      const mockLink = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockLink]),
        }),
      } as any);

      const result = await linkService.create(
        'test-slug',
        'https://example.com',
        'user-123'
      );

      expect(result.slug).toBe('test-slug');
      expect(result.url).toBe('https://example.com');
      expect(result.ownerId).toBe('user-123');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should generate random slug if not provided', async () => {
      const mockLink = {
        slug: 'abc12345', // nanoid format
        url: 'https://example.com',
        ownerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockLink]),
        }),
      } as any);

      const result = await linkService.create(
        undefined,
        'https://example.com',
        null
      );

      expect(result.slug).toBeTruthy();
      expect(result.slug.length).toBe(8);
      expect(result.url).toBe('https://example.com');
    });

    it('should throw error on invalid URL', async () => {
      await expect(
        linkService.create('test', 'invalid-url', 'user-123')
      ).rejects.toThrow();
    });

    it('should throw error on slug too short', async () => {
      await expect(
        linkService.create('ab', 'https://example.com', 'user-123')
      ).rejects.toThrow();
    });

    it('should throw error on duplicate slug', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error('Unique constraint failed')
          ),
        }),
      } as any);

      await expect(
        linkService.create('test-slug', 'https://example.com', 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve a link by slug', async () => {
      const mockLink = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 42,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(mockLink);

      const result = await linkService.get('test-slug');

      expect(result).toEqual(mockLink);
      expect(result?.slug).toBe('test-slug');
      expect(result?.visits).toBe(42);
    });

    it('should return null if link not found', async () => {
      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(undefined);

      const result = await linkService.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listByOwner', () => {
    it('should list links owned by user', async () => {
      const mockLinks = [
        {
          slug: 'link-1',
          url: 'https://example1.com',
          ownerId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          visits: 10,
          isPublic: true,
          urlHistory: [],
          metadata: null,
          deletedAt: null,
          createdByFingerprint: null,
        },
        {
          slug: 'link-2',
          url: 'https://example2.com',
          ownerId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          visits: 20,
          isPublic: true,
          urlHistory: [],
          metadata: null,
          deletedAt: null,
          createdByFingerprint: null,
        },
      ];

      vi.mocked(db.query.linksTable.findMany)
        .mockResolvedValueOnce(mockLinks) // For count
        .mockResolvedValueOnce(mockLinks); // For paginated items

      const result = await linkService.listByOwner('user-123', undefined, undefined, 20, 0);

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.items[0].slug).toBe('link-1');
      expect(result.items[1].slug).toBe('link-2');
    });

    it('should filter by search term', async () => {
      const mockLinks = [
        {
          slug: 'search-term',
          url: 'https://example.com',
          ownerId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          visits: 5,
          isPublic: true,
          urlHistory: [],
          metadata: null,
          deletedAt: null,
          createdByFingerprint: null,
        },
      ];

      vi.mocked(db.query.linksTable.findMany)
        .mockResolvedValueOnce(mockLinks) // For count
        .mockResolvedValueOnce(mockLinks); // For paginated items

      const result = await linkService.listByOwner('user-123', 'search', undefined, 20, 0);

      expect(result.items.length).toBe(1);
      expect(result.items[0].slug).toContain('search');
    });

    it('should handle pagination', async () => {
      const mockLinks = [
        {
          slug: 'link-3',
          url: 'https://example3.com',
          ownerId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          visits: 30,
          isPublic: true,
          urlHistory: [],
          metadata: null,
          deletedAt: null,
          createdByFingerprint: null,
        },
      ];

      vi.mocked(db.query.linksTable.findMany)
        .mockResolvedValueOnce(mockLinks.concat(mockLinks))
        .mockResolvedValueOnce(mockLinks); // Page 2

      const result = await linkService.listByOwner('user-123', undefined, undefined, 1, 1);

      expect(result.total).toBe(2);
      expect(result.items.length).toBe(1);
    });
  });

  describe('update', () => {
    it('should update link URL', async () => {
      const oldLink = {
        slug: 'test-slug',
        url: 'https://old-example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 5,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      const updatedLink = {
        ...oldLink,
        url: 'https://new-example.com',
        urlHistory: [
          {
            url: 'https://old-example.com',
            changedAt: new Date().toISOString(),
            changedBy: 'user-123',
          },
        ],
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(oldLink);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedLink]),
          }),
        }),
      } as any);

      const result = await linkService.update(
        'test-slug',
        'user-123',
        { url: 'https://new-example.com' }
      );

      expect(result.url).toBe('https://new-example.com');
      expect((result.urlHistory as any[]).length).toBe(1);
    });

    it('should throw error if link not found', async () => {
      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(undefined);

      await expect(
        linkService.update('nonexistent', 'user-123', { url: 'https://new.com' })
      ).rejects.toThrow();
    });

    it('should throw error if not owner', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);

      await expect(
        linkService.update('test-slug', 'user-123', { url: 'https://new.com' }, false)
      ).rejects.toThrow();
    });

    it('should allow admin to update any link', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      const updatedLink = {
        ...link,
        url: 'https://new.com',
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedLink]),
          }),
        }),
      } as any);

      const result = await linkService.update(
        'test-slug',
        'admin-user',
        { url: 'https://new.com' },
        true
      );

      expect(result.url).toBe('https://new.com');
    });
  });

  describe('delete', () => {
    it('should soft delete a link', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      const deletedLink = {
        ...link,
        deletedAt: new Date(),
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([deletedLink]),
          }),
        }),
      } as any);

      const result = await linkService.delete('test-slug', 'user-123');

      expect(result.deletedAt).toBeDefined();
    });

    it('should throw error if link not found', async () => {
      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(undefined);

      await expect(linkService.delete('nonexistent', 'user-123')).rejects.toThrow();
    });

    it('should throw error if not owner', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);

      await expect(
        linkService.delete('test-slug', 'user-123', false)
      ).rejects.toThrow();
    });
  });

  describe('claim', () => {
    it('should claim an anonymous link', async () => {
      const claimedLink = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([claimedLink]),
          }),
        }),
      } as any);

      const result = await linkService.claim('test-slug', 'user-123');

      expect(result.ownerId).toBe('user-123');
    });

    it('should throw error if link not found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(undefined);

      await expect(linkService.claim('nonexistent', 'user-123')).rejects.toThrow();
    });

    it('should throw error if link already claimed', async () => {
      const claimedLink = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(claimedLink);

      await expect(linkService.claim('test-slug', 'user-123')).rejects.toThrow();
    });
  });

  describe('resolve', () => {
    it('should resolve a valid link', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);

      const result = await linkService.resolve('test-slug');

      expect(result.url).toBe('https://example.com');
      expect(result.link.slug).toBe('test-slug');
    });

    it('should throw 404 error if link not found', async () => {
      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(undefined);

      await expect(linkService.resolve('nonexistent')).rejects.toThrow();
    });

    it('should throw 410 error if link is deleted', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: new Date(),
        createdByFingerprint: null,
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);

      await expect(linkService.resolve('test-slug')).rejects.toThrow();
    });
  });

  describe('createBatch', () => {
    it('should create multiple links', async () => {
      const mockLinks = [
        {
          slug: 'link-1',
          url: 'https://example1.com',
          ownerId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          visits: 0,
          isPublic: true,
          urlHistory: [],
          metadata: null,
          deletedAt: null,
          createdByFingerprint: null,
        },
        {
          slug: 'link-2',
          url: 'https://example2.com',
          ownerId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          visits: 0,
          isPublic: true,
          urlHistory: [],
          metadata: null,
          deletedAt: null,
          createdByFingerprint: null,
        },
      ];

      vi.mocked(db.insert)
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockLinks[0]]),
          }),
        } as any)
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockLinks[1]]),
          }),
        } as any);

      const result = await linkService.createBatch(
        [
          { slug: 'link-1', url: 'https://example1.com' },
          { slug: 'link-2', url: 'https://example2.com' },
        ],
        'user-123'
      );

      expect(result.created).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.items.length).toBe(2);
    });

    it('should handle batch size limit', async () => {
      const links = Array.from({ length: 101 }, (_, i) => ({
        slug: `link-${i}`,
        url: 'https://example.com',
      }));

      await expect(linkService.createBatch(links, 'user-123')).rejects.toThrow();
    });
  });

  describe('deleteBatch', () => {
    it('should delete multiple links', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      const deletedLink = {
        ...link,
        deletedAt: new Date(),
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([deletedLink]),
          }),
        }),
      } as any);

      const result = await linkService.deleteBatch(
        ['link-1', 'link-2'],
        'user-123'
      );

      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle batch size limit', async () => {
      const slugs = Array.from({ length: 101 }, (_, i) => `slug-${i}`);

      await expect(linkService.deleteBatch(slugs, 'user-123')).rejects.toThrow();
    });
  });

  describe('transfer', () => {
    it('should transfer link ownership', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      const transferredLink = {
        ...link,
        ownerId: 'user-456',
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([transferredLink]),
          }),
        }),
      } as any);

      const result = await linkService.transfer('test-slug', 'user-123', 'user-456');

      expect(result.ownerId).toBe('user-456');
    });

    it('should throw error if not owner', async () => {
      const link = {
        slug: 'test-slug',
        url: 'https://example.com',
        ownerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        visits: 0,
        isPublic: true,
        urlHistory: [],
        metadata: null,
        deletedAt: null,
        createdByFingerprint: null,
      };

      vi.mocked(db.query.linksTable.findFirst).mockResolvedValue(link);

      await expect(
        linkService.transfer('test-slug', 'user-123', 'user-456')
      ).rejects.toThrow();
    });
  });
});
