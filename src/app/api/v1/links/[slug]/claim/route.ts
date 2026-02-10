import { NextRequest, NextResponse } from 'next/server';
import { linkService } from '@/lib/services/link.service';
import { auditService } from '@/lib/services/audit.service';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { ErrorCode, getHttpStatusCode } from '@/lib/constants/errors';
import { getCurrentUser } from '@/lib/auth/server';
import { ipMaskingService } from '@/lib/services/ip-masking.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Authentication required'),
        { status: 401 }
      );
    }

    const slug = params.slug;
    const clientIP = ipMaskingService.extractClientIP(request.headers);

    // Claim link (atomic operation)
    const claimed = await linkService.claim(slug, user.id!);

    // Audit log
    await auditService.logClaim(slug, user.id!, clientIP);

    return NextResponse.json(
      successResponse({
        slug: claimed.slug,
        ownerId: claimed.ownerId,
        claimedAt: new Date().toISOString(),
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
