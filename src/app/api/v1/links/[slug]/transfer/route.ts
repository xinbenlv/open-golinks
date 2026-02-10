import { NextRequest, NextResponse } from 'next/server';
import { linkService } from '@/lib/services/link.service';
import { auditService } from '@/lib/services/audit.service';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { ErrorCode, getHttpStatusCode } from '@/lib/constants/errors';
import { getCurrentUser } from '@/lib/auth/server';
import { ipMaskingService } from '@/lib/services/ip-masking.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { newOwnerId } = body;

    if (!newOwnerId) {
      return NextResponse.json(
        errorResponse(ErrorCode.INVALID_INPUT, 'newOwnerId required'),
        { status: 400 }
      );
    }

    const { slug } = await params;
    const clientIP = ipMaskingService.extractClientIP(request.headers);

    // Get current link
    const current = await linkService.get(slug);
    if (!current) {
      return NextResponse.json(
        errorResponse(ErrorCode.LINK_NOT_FOUND, 'Link not found'),
        { status: 404 }
      );
    }

    // Transfer (ownership check inside)
    const transferred = await linkService.transfer(
      slug,
      current.ownerId,
      newOwnerId
    );

    // Audit log
    await auditService.logTransfer(
      slug,
      current.ownerId,
      newOwnerId,
      user.id!,
      clientIP
    );

    return NextResponse.json(
      successResponse({
        slug: transferred.slug,
        ownerId: transferred.ownerId,
        transferredAt: new Date().toISOString(),
        previousOwnerId: current.ownerId,
      })
    );
  } catch (error: any) {
    const statusCode = getHttpStatusCode(error.code) || 500;
    return NextResponse.json(
      errorResponse(error.code || ErrorCode.INTERNAL_ERROR, error.message || 'Internal server error'),
      { status: statusCode }
    );
  }
}
