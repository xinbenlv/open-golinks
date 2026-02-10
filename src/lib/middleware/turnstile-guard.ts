import { NextRequest, NextResponse } from 'next/server';
import { turnstileService } from '@/lib/services/turnstile.service';
import { errorResponse } from '@/lib/api/responses';
import { ErrorCode } from '@/lib/constants/errors';

/**
 * Middleware to require Turnstile token
 */
export function withTurnstileGuard(
  handler: (
    req: NextRequest,
    context: any,
    turnstileValid: boolean
  ) => Promise<Response>
) {
  return async (
    request: NextRequest,
    context: any
  ): Promise<Response> => {
    try {
      // Try to parse body
      let body: any = {};
      try {
        const bodyText = await request.text();
        if (bodyText) {
          body = JSON.parse(bodyText);
        }
      } catch {
        // Body is not JSON or is empty, continue
      }

      const token = body.turnstileToken;

      if (!token) {
        return NextResponse.json(
          errorResponse(
            ErrorCode.TURNSTILE_REQUIRED,
            'Turnstile token required'
          ),
          { status: 400 }
        );
      }

      const clientIP =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown';

      try {
        await turnstileService.verify(token, clientIP);
      } catch (error: any) {
        return NextResponse.json(
          errorResponse(error.code, error.message),
          { status: error.statusCode || 400 }
        );
      }

      // Create new request with cloned body for handler
      const newRequest = new NextRequest(request, {
        body: JSON.stringify(body),
      });

      // Call handler with turnstile validation passed
      return handler(newRequest, context, true);
    } catch (error: any) {
      return NextResponse.json(
        errorResponse(ErrorCode.INVALID_REQUEST, 'Invalid request'),
        { status: 400 }
      );
    }
  };
}

/**
 * Rate limit check middleware
 */
export async function checkRateLimit(
  ip: string,
  auditService: any
): Promise<{ limited: boolean; retryAfter?: number }> {
  try {
    const recentAttempts = await auditService.getRecentAttempts(ip, 3600);
    const maxAttempts = 5;

    if (recentAttempts >= maxAttempts) {
      return {
        limited: true,
        retryAfter: 3600,
      };
    }

    return { limited: false };
  } catch {
    // If check fails, allow request
    return { limited: false };
  }
}

/**
 * Middleware to optionally validate Turnstile (doesn't fail if missing)
 */
export async function validateTurnstileIfPresent(
  request: NextRequest
): Promise<{ valid: boolean; error?: string }> {
  try {
    let body: any = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      // Body is not JSON or is empty
    }

    const token = body.turnstileToken;

    // If no token, that's ok for optional validation
    if (!token) {
      return { valid: true };
    }

    const clientIP =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'unknown';

    await turnstileService.verify(token, clientIP);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Turnstile verification failed',
    };
  }
}
