import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Kubernetes probes
 * GET /api/health
 *
 * Returns:
 * - 200 OK when the application is healthy
 * - Includes basic health information
 */
export async function GET() {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'optchain-frontend',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };

  return NextResponse.json(healthCheck, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
