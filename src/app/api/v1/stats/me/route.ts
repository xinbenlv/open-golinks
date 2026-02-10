import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics.service';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { getCurrentUser } from '@/lib/auth/server';
import { ErrorCode } from '@/lib/constants/errors';

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
    const filter = url.searchParams.get('filter') || undefined;
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'));
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const stats = await analyticsService.getUserStats(
      user.id,
      filter,
      limit,
      offset
    );

    return NextResponse.json(successResponse(stats));
  } catch (error: any) {
    if (error.message.includes('Invalid regex')) {
      return NextResponse.json(
        errorResponse(ErrorCode.INVALID_INPUT, 'Invalid regex filter'),
        { status: 400 }
      );
    }

    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message),
      { status: 500 }
    );
  }
}
