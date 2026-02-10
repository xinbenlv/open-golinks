import { NextRequest, NextResponse } from 'next/server';
import { toBuffer, toString } from 'qrcode';
import { linkService } from '@/lib/services/link.service';
import { errorResponse } from '@/lib/api/responses';
import { ErrorCode, getHttpStatusCode } from '@/lib/constants/errors';

type QRFormat = 'svg' | 'png' | 'jpg' | 'webp';

/**
 * GET: Generate QR code for a short link in various formats
 *
 * Query Parameters:
 * - format: 'png' (default), 'svg', 'jpg', 'webp'
 * - download: 'true' to add download header (forces browser download)
 *
 * Default behavior:
 * - PNG format for maximum compatibility and broad support
 * - SVG available for OG images when explicitly requested (lightweight, scalable)
 * - Cached for 24 hours
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const { slug } = await params;

    // Get format from query parameter, default to 'png' for maximum compatibility
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'png') as QRFormat;
    const download = searchParams.get('download') === 'true';

    // Validate format
    const validFormats: QRFormat[] = ['svg', 'png', 'jpg', 'webp'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        errorResponse('INVALID_FORMAT', `Format must be one of: ${validFormats.join(', ')}`),
        { status: 400 }
      );
    }

    // Verify link exists
    const link = await linkService.get(slug);
    if (!link) {
      return NextResponse.json(
        errorResponse(ErrorCode.LINK_NOT_FOUND, 'Link not found'),
        { status: 404 }
      );
    }

    if (link.deletedAt) {
      return NextResponse.json(
        errorResponse(ErrorCode.LINK_DELETED, 'Link has been deleted'),
        { status: 410 }
      );
    }

    // Get the origin from request headers or use default
    const origin =
      request.headers.get('x-forwarded-proto') && request.headers.get('x-forwarded-host')
        ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('x-forwarded-host')}`
        : 'https://golinks.app';

    // Build the full short URL
    const shortUrl = `${origin}/${slug}`;

    // Generate QR code based on format
    let contentType: string;
    let blob: Blob;
    let filename: string;

    if (format === 'svg') {
      // SVG format - lightweight, scalable, perfect for OG images
      const svgString = (await toString(shortUrl, {
        type: 'image/svg+xml',
        width: 300,
        margin: 1,
      } as any)) as unknown as string;
      contentType = 'image/svg+xml';
      filename = `qrcode-${slug}.svg`;
      blob = new Blob([svgString], { type: contentType });
    } else if (format === 'png') {
      // PNG format - standard, good for downloads
      const buffer = (await toBuffer(shortUrl, {
        width: 300,
        margin: 1,
      } as any)) as unknown as Buffer;
      contentType = 'image/png';
      filename = `qrcode-${slug}.png`;
      blob = new Blob([new Uint8Array(buffer)], { type: contentType });
    } else if (format === 'jpg') {
      // JPEG format
      const buffer = (await toBuffer(shortUrl, {
        type: 'image/jpeg',
        width: 300,
        margin: 1,
      } as any)) as unknown as Buffer;
      contentType = 'image/jpeg';
      filename = `qrcode-${slug}.jpg`;
      blob = new Blob([new Uint8Array(buffer)], { type: contentType });
    } else if (format === 'webp') {
      // WebP format - modern, efficient
      const buffer = (await toBuffer(shortUrl, {
        type: 'image/webp',
        width: 300,
        margin: 1,
      } as any)) as unknown as Buffer;
      contentType = 'image/webp';
      filename = `qrcode-${slug}.webp`;
      blob = new Blob([new Uint8Array(buffer)], { type: contentType });
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Content-Disposition': download
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[API] Error generating QR code:', error);
    const statusCode = getHttpStatusCode(error.code) || 500;
    return NextResponse.json(
      errorResponse(error.code || 'INTERNAL_ERROR', error.message),
      { status: statusCode }
    );
  }
}
