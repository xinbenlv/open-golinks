import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics.service';
import { successResponse, errorResponse } from '@/lib/api/responses';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const { slug } = await params;
    const analytics = await analyticsService.getLinkAnalytics(slug);
    return NextResponse.json(successResponse(analytics));
  } catch (error: any) {
    if (error.message.includes('Link not found')) {
      return NextResponse.json(
        errorResponse('LINK_NOT_FOUND', 'Link not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message),
      { status: 500 }
    );
  }
}
