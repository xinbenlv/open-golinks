import { NextRequest, NextResponse } from 'next/server';
import { linkService } from '@/lib/services/link.service';
import { CreateLinkSchema } from '@/lib/validations/schemas';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { ErrorCode, getHttpStatusCode } from '@/lib/constants/errors';
import { getCurrentUser } from '@/lib/auth/server';
import { AuditService } from '@/lib/services/audit.service';
import { TurnstileService } from '@/lib/services/turnstile.service';

const auditService = new AuditService();
const turnstileService = new TurnstileService();

/**
 * POST: Create link
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();

    // Validate input
    const validation = CreateLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        errorResponse(ErrorCode.INVALID_INPUT, 'Invalid request body'),
        { status: 400 }
      );
    }

    const { slug, url, metadata, turnstileToken } = validation.data;

    // Get user (null if anonymous)
    const user = await getCurrentUser();
    const userId = user?.id || null;
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';

    // Turnstile validation for anonymous users
    let turnstileValid = false;
    if (!userId) {
      // Check if Turnstile is bypassed (development)
      if (turnstileService.isBypassEnabled()) {
        console.info('✓ Turnstile bypass: accepting anonymous request without token');
        turnstileValid = true;
      } else if (!turnstileToken) {
        return NextResponse.json(
          errorResponse(
            ErrorCode.TURNSTILE_REQUIRED,
            'Turnstile token required for anonymous users'
          ),
          { status: 403 }
        );
      } else {
        try {
          const verified = await turnstileService.verify(turnstileToken, clientIP);
          if (!verified.success) {
            return NextResponse.json(
              errorResponse(
                ErrorCode.TURNSTILE_VERIFICATION_FAILED,
                'Turnstile verification failed'
              ),
              { status: 403 }
            );
          }
          turnstileValid = true;
        } catch (error: any) {
          return NextResponse.json(
            errorResponse(
              ErrorCode.TURNSTILE_VERIFICATION_FAILED,
              'Turnstile service error'
            ),
            { status: error.statusCode || 503 }
          );
        }
      }
    }

    // Check if slug already exists (including soft-deleted links)
    if (slug) {
      const existingLink = await linkService.get(slug);

      if (existingLink) {
        // If link is soft-deleted, check if user can reactivate
        if (existingLink.deletedAt) {
          // Only original owner can reuse deleted slug
          if (existingLink.ownerId !== userId) {
            return NextResponse.json(
              errorResponse(
                ErrorCode.DELETED_SLUG_FORBIDDEN,
                `The slug "${slug}" was previously used and deleted. Only the original owner can reuse it.`
              ),
              { status: 403 }
            );
          }

          // Reactivate the link
          const reactivated = await linkService.reactivate(slug, url, metadata);

          // Audit log
          await auditService.logCreate(
            reactivated.slug,
            userId,
            clientIP
          );

          return NextResponse.json(
            successResponse({
              slug: reactivated.slug,
              url: reactivated.url,
              createdAt: reactivated.createdAt.toISOString(),
              message: 'Link reactivated successfully',
            }),
            { status: 200 }
          );
        } else {
          // Slug exists and is not deleted
          return NextResponse.json(
            errorResponse(
              ErrorCode.SLUG_ALREADY_EXISTS,
              `Slug "${slug}" is already in use`
            ),
            { status: 409 }
          );
        }
      }
    }

    // Create link
    const link = await linkService.create(slug, url, userId, metadata, turnstileValid);

    // Audit log
    await auditService.logCreate(
      link.slug,
      link.url,
      userId,
      clientIP,
      metadata
    );

    return NextResponse.json(
      successResponse({
        slug: link.slug,
        url: link.url,
        shortUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${link.slug}`,
        createdAt: link.createdAt.toISOString(),
        ownerId: link.ownerId,
        isPublic: link.isPublic,
        visits: link.visits,
      }),
      { status: 201 }
    );
  } catch (error: any) {
    const statusCode = getHttpStatusCode(error.code) || 500;
    return NextResponse.json(
      errorResponse(error.code, error.message),
      { status: statusCode }
    );
  }
}

/**
 * GET: List links for authenticated user
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const isPublic = url.searchParams.get('public')
      ? url.searchParams.get('public') === 'true'
      : undefined;
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'));
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { items, total } = await linkService.listByOwner(
      user.id,
      search,
      isPublic,
      limit,
      offset
    );

    return NextResponse.json(
      successResponse({
        items: items.map(link => ({
          slug: link.slug,
          url: link.url,
          visits: link.visits,
          createdAt: link.createdAt.toISOString(),
          updatedAt: link.updatedAt.toISOString(),
          isPublic: link.isPublic,
          metadata: link.metadata,
        })),
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      })
    );
  } catch (error: any) {
    const statusCode = getHttpStatusCode(error.code) || 500;
    return NextResponse.json(
      errorResponse(error.code, error.message),
      { status: statusCode }
    );
  }
}
