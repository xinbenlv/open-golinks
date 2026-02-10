import { db } from '@/db/db';
import { linksTable, dailyVisitsTable } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createError } from '@/lib/api/errors';
import { ErrorCode } from '@/lib/constants/errors';

/**
 * Atomic link increment visit count
 * Uses SQL-level atomic increment to avoid race conditions
 */
export async function atomicIncrementVisits(slug: string): Promise<void> {
  await db
    .update(linksTable)
    .set({
      visits: sql`${linksTable.visits} + 1`,
    })
    .where(eq(linksTable.slug, slug));
}

/**
 * Atomic daily visit counter (UPSERT pattern)
 * Increments count if record exists, creates new record with count=1 if not
 * No race conditions due to unique constraint + onConflictDoUpdate
 */
export async function atomicIncrementDailyVisits(
  slug: string,
  date: Date
): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];

  await db
    .insert(dailyVisitsTable)
    .values({
      linkSlug: slug,
      date: new Date(dateStr),
      count: 1,
    })
    .onConflictDoUpdate({
      target: [dailyVisitsTable.linkSlug, dailyVisitsTable.date],
      set: { count: sql`${dailyVisitsTable.count} + 1` },
    });
}

/**
 * Export all atomic operations for convenient access
 */
export const atomicOps = {
  incrementVisits: atomicIncrementVisits,
  incrementDailyVisits: atomicIncrementDailyVisits,
};
