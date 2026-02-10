import { NextRequest, NextResponse } from 'next/server';
import { linkService } from '@/lib/services/link.service';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { ErrorCode, getHttpStatusCode } from '@/lib/constants/errors';
import { getCurrentUser } from '@/lib/auth/server';
import { AuditService } from '@/lib/services/audit.service';

const auditService = new AuditService();

/**
 * PUT: Update link
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const slug = params.slug;
    const body = await request.json();

    // Get the link before updating to capture old data for audit
    const oldLink = await linkService.get(slug);
    if (!oldLink) {
      return NextResponse.json(
        errorResponse(ErrorCode.LINK_NOT_FOUND, 'Link not found'),
        { status: 404 }
      );
    }

    const updated = await linkService.update(
      slug,
      user?.id || null,
      body,
      user?.role === 'admin'
    );

    // Audit log
    await auditService.logUpdate(
      slug,
      oldLink,
      updated,
      user?.id || null,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json(
      successResponse({
        slug: updated.slug,
        url: updated.url,
        updatedAt: updated.updatedAt.toISOString(),
        urlHistory: updated.urlHistory,
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

/**
 * DELETE: Soft delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const slug = params.slug;

    const deleted = await linkService.delete(
      slug,
      user?.id || null,
      user?.role === 'admin'
    );

    // Audit log
    await auditService.logDelete(
      slug,
      user?.id || null,
      request.headers.get('x-forwarded-for') || 'unknown'
    );

    return NextResponse.json(
      successResponse({
        slug: deleted.slug,
        deletedAt: deleted.deletedAt?.toISOString(),
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
