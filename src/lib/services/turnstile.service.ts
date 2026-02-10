import { ErrorCode } from '@/lib/constants/errors';
import { createError, ApiError } from '@/lib/api/errors';

export interface TurnstileVerifyRequest {
  token: string;
  remoteIP?: string;
}

export interface TurnstileVerifyResponse {
  success: boolean;
  challengeTs?: string;
  hostname?: string;
  errorCodes?: string[];
}

export class TurnstileService {
  private siteKey: string;
  private secretKey: string;
  private endpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  private timeout = 10000; // 10 seconds

  constructor() {
    this.siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
    this.secretKey = process.env.TURNSTILE_SECRET_KEY || '';

    if (!this.secretKey) {
      console.warn('TURNSTILE_SECRET_KEY not configured');
    }
  }

  /**
   * Verify Turnstile token
   */
  async verify(
    token: string,
    remoteIP?: string
  ): Promise<TurnstileVerifyResponse> {
    // Validate token format
    if (!token || typeof token !== 'string' || token.length < 10) {
      throw createError(
        ErrorCode.TURNSTILE_VERIFICATION_FAILED,
        400,
        { reason: 'Invalid token format' }
      );
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: this.secretKey,
          response: token,
          remoteip: remoteIP,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Cloudflare returned ${response.status}`);
      }

      const data: TurnstileVerifyResponse = await response.json();

      // Check for success
      if (!data.success) {
        throw createError(
          ErrorCode.TURNSTILE_VERIFICATION_FAILED,
          400,
          { errorCodes: data.errorCodes }
        );
      }

      // Check if token is too old (> 2 minutes)
      if (data.challengeTs) {
        const challengeTime = new Date(data.challengeTs).getTime();
        const now = Date.now();
        const ageMs = now - challengeTime;
        const maxAgeMs = 2 * 60 * 1000; // 2 minutes

        if (ageMs > maxAgeMs) {
          throw createError(
            ErrorCode.TURNSTILE_VERIFICATION_FAILED,
            400,
            { reason: 'Token expired' }
          );
        }
      }

      return {
        success: true,
        challengeTs: data.challengeTs,
        hostname: data.hostname,
      };
    } catch (error: any) {
      // Handle timeout
      if (error.name === 'AbortError') {
        throw createError(
          ErrorCode.TURNSTILE_VERIFICATION_FAILED,
          503,
          { reason: 'Turnstile service timeout' }
        );
      }

      // Re-throw if already an ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other errors
      throw createError(
        ErrorCode.TURNSTILE_VERIFICATION_FAILED,
        503,
        { reason: error.message }
      );
    }
  }

  /**
   * Verify with rate limit check
   */
  async verifyWithRateCheck(
    token: string,
    fingerprint: string,
    remoteIP?: string,
    auditService?: any
  ): Promise<{ verified: boolean; error?: any }> {
    try {
      // First verify token with Cloudflare
      await this.verify(token, remoteIP);

      // Then check rate limit in audit logs
      if (auditService) {
        const recentAttempts = await auditService.getRecentAttempts(
          fingerprint,
          3600  // 1 hour
        );

        const maxAttempts = 5;
        if (recentAttempts >= maxAttempts) {
          throw createError(
            ErrorCode.RATE_LIMITED,
            429,
            { retryAfter: 3600 }
          );
        }
      }

      return { verified: true };
    } catch (error: any) {
      return {
        verified: false,
        error: {
          code: error.code || 'TURNSTILE_VERIFICATION_FAILED',
          message: error.message,
          statusCode: error.statusCode || 400,
        },
      };
    }
  }

  /**
   * Validate and refresh token (optional for frontend)
   */
  async refreshToken(token: string): Promise<string | null> {
    try {
      const verified = await this.verify(token);
      return verified.success ? token : null;
    } catch {
      return null;
    }
  }

  /**
   * Get site key for frontend
   */
  getSiteKey(): string {
    return this.siteKey;
  }

  /**
   * Check if Turnstile is configured
   */
  isConfigured(): boolean {
    return !!(this.siteKey && this.secretKey);
  }
}

export const turnstileService = new TurnstileService();
