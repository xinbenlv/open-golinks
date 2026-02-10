import { NextRequest, NextResponse } from 'next/server';
import { auditService } from '@/lib/services/audit.service';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { getCurrentUser } from '@/lib/auth/server';
import { db } from '@/db/db';
import { linksTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const { slug } = await params;

    // Get link to check ownership and permissions
    const link = await db.query.linksTable.findFirst({
      where: eq(linksTable.slug, slug),
    });

    if (!link) {
      return NextResponse.json(
        errorResponse('LINK_NOT_FOUND', 'Link not found'),
        { status: 404 }
      );
    }

    // Check if user is owner or admin
    const isAdmin = user?.role === 'admin';
    const isOwner = user?.id === link.ownerId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Access denied'),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || undefined;
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'));
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const result = await auditService.getAuditLog(
      slug,
      action,
      limit,
      offset
    );

    return NextResponse.json(successResponse(result));
  } catch (error: any) {
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message),
      { status: 500 }
    );
  }
}
