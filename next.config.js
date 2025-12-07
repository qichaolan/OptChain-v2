/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // Proxy API requests to the existing FastAPI backend
  async rewrites() {
    const backendUrl = process.env.OPTCHAIN_BACKEND_URL || 'http://localhost:8080';

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
