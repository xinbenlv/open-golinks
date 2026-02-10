import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Get warning probability from environment variable
  // Default to 50% if not set or invalid
  const warnPercent = parseInt(process.env.WARN_PERCENT || '50', 10);

  // Generate random number for this request
  const random = Math.random();

  // Add debug headers to request (so page.tsx can read them)
  request.headers.set('x-debug-warn-percent', warnPercent.toString());
  request.headers.set('x-debug-warn-random', random.toString());

  // Add debug headers to response (so client can see them)
  response.headers.set('x-debug-warn-percent', warnPercent.toString());
  response.headers.set('x-debug-warn-random', random.toString());

  // Return response with the modified request headers for the next step
  // We need to return a new response that includes the request headers override
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
    headers: response.headers,
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth (auth routes)
     * - dashboard (dashboard routes)
     * - login (login routes)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth|dashboard|login).*)',
  ],
};
