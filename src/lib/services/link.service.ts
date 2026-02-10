import { db } from '@/db/db';
import { linksTable, auditLogsTable } from '@/db/schema';
import type { Link, NewLink } from '@/db/schema';
import { validateSlug, validateURL } from '@/lib/validations';
import { createError } from '@/lib/api/errors';
import { ErrorCode } from '@/lib/constants/errors';
import { eq, and, isNull, like } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Generate random slug using nanoid
 */
function generateRandomSlug(): string {
  return nanoid(8);
}

/**
 * Check if error is a duplicate key constraint violation
 */
function isDuplicateKeyError(error: any): boolean {
  return (
    error.code === 'UNIQUE_VIOLATION' ||
    error.code === '23505' ||
    error.message?.includes('unique constraint') ||
    error.message?.includes('Unique constraint failed')
  );
}

export class LinkService {
  /**
   * CREATE: Create new link with Turnstile validation
   */
  async create(
    slug: string | undefined,
    url: string,
    userId: string | null,
    metadata?: any,
    turnstileValid?: boolean
  ): Promise<Link> {
    // 1. Validate URL
    const urlValidation = validateURL(url);
    if (!urlValidation.valid) {
      throw createError(urlValidation.error!);
    }

    // 2. Normalize slug or generate random
    let finalSlug: string;
    if (slug) {
      const slugValidation = validateSlug(slug);
      if (!slugValidation.valid) {
        throw createError(slugValidation.error!);
      }
      finalSlug = slugValidation.normalized!;
    } else {
      // Auto-generate random slug
      finalSlug = generateRandomSlug();
    }

    // 3. Atomic insert (catches duplicate slug)
    try {
      const created = await db
        .insert(linksTable)
        .values({
          slug: finalSlug,
          url,
          ownerId: userId,
          metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return created[0];
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw createError(ErrorCode.SLUG_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * READ: Get single link by slug
   */
  async get(slug: string): Promise<Link | null> {
    const link = await db.query.linksTable.findFirst({
      where: eq(linksTable.slug, slug),
    });
    return link || null;
  }

  /**
   * READ: List links for user
   */
  async listByOwner(
    userId: string,
    search?: string,
    isPublic?: boolean,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ items: Link[]; total: number }> {
    // Build where conditions
    let whereConditions: any[] = [
      eq(linksTable.ownerId, userId),
      isNull(linksTable.deletedAt),
    ];

    if (search) {
      whereConditions.push(like(linksTable.slug, `%${search}%`));
    }

    if (isPublic !== undefined) {
      whereConditions.push(eq(linksTable.isPublic, isPublic));
    }

    // Get total count
    const totalResults = await db.query.linksTable.findMany({
      where: and(...whereConditions),
    });

    const total = totalResults.length;

    // Get paginated items
    const items = await db.query.linksTable.findMany({
      where: and(...whereConditions),
      limit,
      offset,
    });

    return { items, total };
  }

  /**
   * UPDATE: Update link (with history tracking)
   */
  async update(
    slug: string,
    userId: string | null,
    updates: Partial<Link>,
    admin: boolean = false
  ): Promise<Link> {
    // 1. Fetch current
    const current = await this.get(slug);
    if (!current) {
      throw createError(ErrorCode.LINK_NOT_FOUND);
    }

    // 2. Check ownership (strict - no anonymous modifications)
    // Anonymous links must be claimed first
    if (!current.ownerId) {
      throw createError(ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN);
    }

    // Only owner or admin can modify
    if (current.ownerId !== userId && !admin) {
      throw createError(ErrorCode.FORBIDDEN);
    }

    // 3. Validate new URL if provided
    if (updates.url) {
      const urlValidation = validateURL(updates.url);
      if (!urlValidation.valid) {
        throw createError(urlValidation.error!);
      }
    }

    // 4. Track URL in history if changed
    let urlHistory = (current.urlHistory as any[]) || [];
    if (updates.url && updates.url !== current.url) {
      urlHistory.push({
        url: current.url,
        changedAt: new Date().toISOString(),
        changedBy: userId,
      });
    }

    // 5. Atomic update
    const result = await db
      .update(linksTable)
      .set({
        ...updates,
        urlHistory,
        updatedAt: new Date(),
      })
      .where(eq(linksTable.slug, slug))
      .returning();

    return result[0];
  }

  /**
   * DELETE: Soft delete
   */
  async delete(slug: string, userId: string | null, admin: boolean = false): Promise<Link> {
    const current = await this.get(slug);
    if (!current) {
      throw createError(ErrorCode.LINK_NOT_FOUND);
    }

    // Check ownership (strict - no anonymous deletions)
    // Anonymous links must be claimed first
    if (!current.ownerId) {
      throw createError(ErrorCode.ANONYMOUS_LINK_MODIFICATION_FORBIDDEN);
    }

    // Only owner or admin can delete
    if (current.ownerId !== userId && !admin) {
      throw createError(ErrorCode.FORBIDDEN);
    }

    const result = await db
      .update(linksTable)
      .set({ deletedAt: new Date() })
      .where(eq(linksTable.slug, slug))
      .returning();

    return result[0];
  }

  /**
   * CLAIM: Claim anonymous link
   */
  async claim(slug: string, userId: string): Promise<Link> {
    const result = await db
      .update(linksTable)
      .set({
        ownerId: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(linksTable.slug, slug),
          isNull(linksTable.ownerId)
        )
      )
      .returning();

    if (result.length === 0) {
      // Either doesn't exist or already owned
      const current = await this.get(slug);
      if (!current) {
        throw createError(ErrorCode.LINK_NOT_FOUND);
      }
      throw createError(ErrorCode.LINK_ALREADY_CLAIMED);
    }

    return result[0];
  }

  /**
   * REACTIVATE: Reactivate a soft-deleted link
   */
  async reactivate(
    slug: string,
    newUrl: string,
    newMetadata?: any
  ): Promise<Link> {
    const current = await this.get(slug);

    if (!current) {
      throw createError(ErrorCode.LINK_NOT_FOUND);
    }

    if (!current.deletedAt) {
      throw createError(ErrorCode.INVALID_INPUT, 400, {
        message: 'Link is not deleted',
      });
    }

    // Validate new URL
    const urlValidation = validateURL(newUrl);
    if (!urlValidation.valid) {
      throw createError(urlValidation.error!);
    }

    // Reactivate and update URL
    const result = await db
      .update(linksTable)
      .set({
        url: newUrl,
        metadata: newMetadata,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(linksTable.slug, slug))
      .returning();

    return result[0];
  }

  /**
   * TRANSFER: Transfer ownership
   */
  async transfer(slug: string, fromUserId: string | null, toUserId: string): Promise<Link> {
    const current = await this.get(slug);
    if (!current) {
      throw createError(ErrorCode.LINK_NOT_FOUND);
    }

    // Anonymous links can't be transferred directly
    if (!fromUserId || current.ownerId !== fromUserId) {
      throw createError(ErrorCode.FORBIDDEN);
    }

    const result = await db
      .update(linksTable)
      .set({
        ownerId: toUserId,
        updatedAt: new Date(),
      })
      .where(eq(linksTable.slug, slug))
      .returning();

    return result[0];
  }

  /**
   * BATCH: Create multiple links
   */
  async createBatch(
    links: Array<{
      slug?: string;
      url: string;
      metadata?: any;
    }>,
    userId: string | null,
    turnstileValid?: boolean
  ): Promise<{
    created: number;
    failed: number;
    items: Array<{ slug: string; status: 'success' | 'failed'; error?: any }>;
  }> {
    const maxBatch = 100;
    if (links.length > maxBatch) {
      throw createError(ErrorCode.INVALID_INPUT, 400, {
        message: `Batch size exceeds ${maxBatch}`,
      });
    }

    const results = [];
    let created = 0;
    let failed = 0;

    for (const link of links) {
      try {
        const result = await this.create(
          link.slug,
          link.url,
          userId,
          link.metadata,
          turnstileValid
        );
        created++;
        results.push({
          slug: result.slug,
          status: 'success' as const,
        });
      } catch (error: any) {
        failed++;
        results.push({
          slug: link.slug || 'auto-generated',
          status: 'failed' as const,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
    }

    return { created, failed, items: results };
  }

  /**
   * BATCH: Delete multiple links
   */
  async deleteBatch(
    slugs: string[],
    userId: string | null,
    admin: boolean = false
  ): Promise<{
    deleted: number;
    failed: number;
    items: Array<{ slug: string; status: 'success' | 'failed'; error?: any }>;
  }> {
    const maxBatch = 100;
    if (slugs.length > maxBatch) {
      throw createError(ErrorCode.INVALID_INPUT, 400, {
        message: `Batch size exceeds ${maxBatch}`,
      });
    }

    const results = [];
    let deleted = 0;
    let failed = 0;

    for (const slug of slugs) {
      try {
        await this.delete(slug, userId, admin);
        deleted++;
        results.push({
          slug,
          status: 'success' as const,
        });
      } catch (error: any) {
        failed++;
        results.push({
          slug,
          status: 'failed' as const,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
    }

    return { deleted, failed, items: results };
  }

  /**
   * Helper: Resolve redirect
   */
  async resolve(slug: string): Promise<{ url: string; link: Link }> {
    const link = await this.get(slug);
    if (!link) {
      throw createError(ErrorCode.LINK_NOT_FOUND, 404);
    }
    if (link.deletedAt) {
      throw createError(ErrorCode.LINK_DELETED, 410);
    }
    return { url: link.url, link };
  }
}

export const linkService = new LinkService();
