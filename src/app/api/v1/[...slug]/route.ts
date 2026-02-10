import { NextRequest, NextResponse } from 'next/server';
import { linkService } from '@/lib/services/link.service';
import { atomicIncrementVisits, atomicIncrementDailyVisits } from '@/lib/db/atomic-operations';
import { ErrorCode } from '@/lib/constants/errors';

/**
 * GET: Catch-all redirect endpoint
 * Handles /{slug} requests and redirects to the target URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
): Promise<Response> {
  try {
    const { slug: slugArray } = await params;
    const slug = slugArray?.[0];

    if (!slug) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Resolve link
    const { url } = await linkService.resolve(slug);

    // Atomic increment visit count
    await Promise.all([
      atomicIncrementVisits(slug),
      atomicIncrementDailyVisits(slug, new Date()),
    ]);

    // 302 redirect with caching
    const response = NextResponse.redirect(url, { status: 302 });
    response.headers.set(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate=300'
    );
    return response;
  } catch (error: any) {
    console.error('[API] Error resolving slug:', error);
    if (error.code === ErrorCode.LINK_NOT_FOUND) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 }
      );
    }
    if (error.code === ErrorCode.LINK_DELETED) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 410 }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
      { status: 500 }
    );
  }
}
