import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    strict: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001'],
    },
  },
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ],
  rewrites: async () => ({
    beforeFiles: [
      {
        source: '/:slug((?!api|admin|dashboard|login|logout|register|profile|settings|edit|warn|history|stats|share|export|import|claim|transfer|delete|health|_next|favicon|robots|sitemap|\\.[^/]+)[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]{3})',
        destination: '/api/v1/resolve?slug=:slug',
      },
    ],
  }),
};

export default nextConfig;
