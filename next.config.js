/** @type {import('next').NextConfig} */

// ============================================================================
// SSRF Protection: Whitelist allowed backend URLs
// ============================================================================
const ALLOWED_BACKENDS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  // Add production backend URLs here
  process.env.OPTCHAIN_BACKEND_URL,
].filter(Boolean);

function getValidatedBackendUrl() {
  const backendUrl = process.env.OPTCHAIN_BACKEND_URL || 'http://localhost:8080';

  // In production, validate the backend URL is in the whitelist
  if (process.env.NODE_ENV === 'production') {
    if (!ALLOWED_BACKENDS.includes(backendUrl)) {
      console.error(`Invalid OPTCHAIN_BACKEND_URL: ${backendUrl}`);
      console.error('Allowed backends:', ALLOWED_BACKENDS);
      throw new Error('Invalid backend URL configuration');
    }
  }

  return backendUrl;
}

// ============================================================================
// Security Headers
// ============================================================================
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

// Add CSP in production only (can break development with hot reload)
if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires these
      "style-src 'self' 'unsafe-inline'", // Tailwind requires inline styles
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
    ].join('; '),
  });
}

// ============================================================================
// Next.js Configuration
// ============================================================================
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // Security headers for all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  // Proxy API requests to the existing FastAPI backend
  async rewrites() {
    const backendUrl = getValidatedBackendUrl();

    return [
      // Proxy existing API routes to FastAPI backend
      {
        source: '/api/leaps/:path*',
        destination: `${backendUrl}/api/leaps/:path*`,
      },
      {
        source: '/api/credit-spreads/:path*',
        destination: `${backendUrl}/api/credit-spreads/:path*`,
      },
      {
        source: '/api/iron-condors/:path*',
        destination: `${backendUrl}/api/iron-condors/:path*`,
      },
      {
        source: '/api/ai-explainer',
        destination: `${backendUrl}/api/ai-explainer`,
      },
    ];
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
    NEXT_PUBLIC_COPILOTKIT_ENABLED: 'true',
  },
};

module.exports = nextConfig;
