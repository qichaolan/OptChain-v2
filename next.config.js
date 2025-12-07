/** @type {import('next').NextConfig} */

// ============================================================================
// SSRF Protection: Whitelist allowed backend URLs
// ============================================================================
const ALLOWED_BACKENDS = [
  'http://localhost:8081',  // Internal backend (same container)
  'http://127.0.0.1:8081',
  'http://localhost:8080',  // Dev fallback
  'http://127.0.0.1:8080',
  // Add production backend URLs here
  process.env.OPTCHAIN_BACKEND_URL,
].filter(Boolean);

function getValidatedBackendUrl() {
  // Default to port 8081 for the internal FastAPI backend
  const backendUrl = process.env.OPTCHAIN_BACKEND_URL || 'http://localhost:8081';

  // In production, warn if backend URL is not in the whitelist
  // Don't throw - let the app start and fail gracefully on actual requests
  if (process.env.NODE_ENV === 'production') {
    if (!ALLOWED_BACKENDS.includes(backendUrl)) {
      console.warn(`[SECURITY WARNING] OPTCHAIN_BACKEND_URL not in whitelist: ${backendUrl}`);
      console.warn('Allowed backends:', ALLOWED_BACKENDS);
      // Return the URL anyway - rewrites may fail but app will start
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
  // Build frame-src based on configured backend
  const backendUrl = process.env.OPTCHAIN_BACKEND_URL || '';
  const frameSources = ["'self'", backendUrl].filter(Boolean).join(' ');

  securityHeaders.push({
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires these
      "style-src 'self' 'unsafe-inline'", // Tailwind requires inline styles
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://generativelanguage.googleapis.com",
      `frame-src ${frameSources}`, // Allow iframes to load backend pages
      "frame-ancestors 'self'", // Allow being embedded in same origin only
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

  // Proxy API requests and embedded pages to the existing FastAPI backend
  async rewrites() {
    const backendUrl = getValidatedBackendUrl();

    return [
      // Proxy embedded pages (for iframe loading)
      // Note: The backend serves "/" as the LEAPS page
      {
        source: '/embed/leaps',
        destination: `${backendUrl}/`,
      },
      {
        source: '/embed/credit-spreads',
        destination: `${backendUrl}/credit-spreads`,
      },
      {
        source: '/embed/iron-condors',
        destination: `${backendUrl}/iron-condors`,
      },
      // Proxy static assets from backend
      {
        source: '/embed/static/:path*',
        destination: `${backendUrl}/static/:path*`,
      },
      // Also proxy direct static requests (for CSS/JS loaded by embedded pages)
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`,
      },
      // Proxy LEAPS API routes
      {
        source: '/api/tickers',
        destination: `${backendUrl}/api/tickers`,
      },
      {
        source: '/api/leaps',
        destination: `${backendUrl}/api/leaps`,
      },
      {
        source: '/api/roi-simulator',
        destination: `${backendUrl}/api/roi-simulator`,
      },
      // Proxy Credit Spreads API routes
      {
        source: '/api/credit-spreads/tickers',
        destination: `${backendUrl}/api/credit-spreads/tickers`,
      },
      {
        source: '/api/credit-spreads',
        destination: `${backendUrl}/api/credit-spreads`,
      },
      {
        source: '/api/credit-spreads/simulate',
        destination: `${backendUrl}/api/credit-spreads/simulate`,
      },
      // Proxy Iron Condors API routes
      {
        source: '/api/iron-condors',
        destination: `${backendUrl}/api/iron-condors`,
      },
      {
        source: '/api/iron-condors/:condor_id/payoff',
        destination: `${backendUrl}/api/iron-condors/:condor_id/payoff`,
      },
      // Proxy AI routes
      {
        source: '/api/ai-explainer',
        destination: `${backendUrl}/api/ai-explainer`,
      },
      {
        source: '/api/ai-score/:path*',
        destination: `${backendUrl}/api/ai-score/:path*`,
      },
      // Backend health check
      {
        source: '/api/backend-health',
        destination: `${backendUrl}/health`,
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
