import { db } from '@/db/db';
import { linksTable, dailyVisitsTable } from '@/db/schema';
import { eq, sql, gte, and, isNull, desc } from 'drizzle-orm';

export class AnalyticsService {
  /**
   * Get user statistics with optional regex filter
   */
  async getUserStats(
    userId: string,
    filter?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    totalLinks: number;
    totalVisits: number;
    averageVisitsPerLink: number;
    topLinks: any[];
    filteredLinks: any[];
    total: number;
  }> {
    // All links for user (non-deleted)
    const allLinks = await db
      .select()
      .from(linksTable)
      .where(
        and(
          eq(linksTable.ownerId, userId),
          isNull(linksTable.deletedAt)
        )
      );

    // Filter by regex if provided
    let filteredLinks = allLinks;
    if (filter) {
      try {
        const regex = new RegExp(filter);
        filteredLinks = allLinks.filter(link => regex.test(link.slug));
      } catch {
        throw new Error('Invalid regex filter');
      }
    }

    const totalLinks = allLinks.length;
    const totalVisits = allLinks.reduce((sum, l) => sum + (l.visits || 0), 0);
    const avgVisits = totalLinks > 0 ? totalVisits / totalLinks : 0;

    // Top links
    const topLinks = allLinks
      .sort((a, b) => (b.visits || 0) - (a.visits || 0))
      .slice(0, 5)
      .map(l => ({
        slug: l.slug,
        visits: l.visits,
        createdAt: l.createdAt.toISOString(),
      }));

    // Filtered links paginated
    const paginatedFiltered = filteredLinks
      .sort((a, b) => (b.visits || 0) - (a.visits || 0))
      .slice(offset, offset + limit)
      .map(l => ({
        slug: l.slug,
        visits: l.visits,
        url: l.url,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      }));

    return {
      totalLinks,
      totalVisits,
      averageVisitsPerLink: Math.round(avgVisits * 100) / 100,
      topLinks,
      filteredLinks: paginatedFiltered,
      total: filteredLinks.length,
    };
  }

  /**
   * Get link-specific analytics (last 30 days)
   */
  async getLinkAnalytics(slug: string): Promise<{
    slug: string;
    totalVisits: number;
    dailyVisits: Array<{ date: string; count: number }>;
    createdAt: string;
    updatedAt: string;
  }> {
    // Get link
    const link = await db.query.linksTable.findFirst({
      where: eq(linksTable.slug, slug),
    });

    if (!link) {
      throw new Error('Link not found');
    }

    // Get daily visits (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyVisits = await db
      .select()
      .from(dailyVisitsTable)
      .where(
        and(
          eq(dailyVisitsTable.linkSlug, slug),
          gte(dailyVisitsTable.date, thirtyDaysAgo)
        )
      )
      .orderBy(dailyVisitsTable.date);

    return {
      slug,
      totalVisits: link.visits || 0,
      dailyVisits: dailyVisits.map(dv => ({
        date: dv.date.toISOString().split('T')[0],
        count: dv.count,
      })),
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
  }

  /**
   * Get global statistics (admin only)
   */
  async getGlobalStats(): Promise<{
    totalUsers: number;
    totalLinks: number;
    totalVisits: number;
    topLinks: any[];
    recentLinks: any[];
    abuseReports: number;
  }> {
    // Count total links (non-deleted)
    const totalLinksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(linksTable)
      .where(isNull(linksTable.deletedAt));

    const totalLinks = totalLinksResult[0]?.count || 0;

    // Sum total visits
    const totalVisitsResult = await db
      .select({ total: sql<number>`sum(${linksTable.visits})` })
      .from(linksTable)
      .where(isNull(linksTable.deletedAt));

    const totalVisits = totalVisitsResult[0]?.total || 0;

    // Top links globally
    const topLinks = await db
      .select()
      .from(linksTable)
      .where(isNull(linksTable.deletedAt))
      .orderBy(desc(linksTable.visits))
      .limit(5);

    // Recent links
    const recentLinks = await db
      .select()
      .from(linksTable)
      .where(isNull(linksTable.deletedAt))
      .orderBy(desc(linksTable.createdAt))
      .limit(5);

    // Placeholder for abuse reports (future feature)
    const abuseReports = 0;

    return {
      totalUsers: 0,  // Would need user count from users table
      totalLinks,
      totalVisits,
      topLinks: topLinks.map(l => ({
        slug: l.slug,
        visits: l.visits,
        owner: l.ownerId ? 'Registered User' : 'Anonymous',
      })),
      recentLinks: recentLinks.map(l => ({
        slug: l.slug,
        createdAt: l.createdAt.toISOString(),
        visits: l.visits,
      })),
      abuseReports,
    };
  }

  /**
   * Record a visit for a link
   */
  async recordVisit(slug: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // UPSERT: increment count if exists, create if not
    await db
      .insert(dailyVisitsTable)
      .values({
        linkSlug: slug,
        date: today,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [dailyVisitsTable.linkSlug, dailyVisitsTable.date],
        set: {
          count: sql`${dailyVisitsTable.count} + 1`,
        },
      });

    // Also increment link's total visits
    await db
      .update(linksTable)
      .set({
        visits: sql`${linksTable.visits} + 1`,
      })
      .where(eq(linksTable.slug, slug));
  }
}

export const analyticsService = new AnalyticsService();
