import { NextRequest, NextResponse } from 'next/server';

function getBackendUrl(): string {
  return process.env.OPTCHAIN_BACKEND_URL || 'http://127.0.0.1:8081';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string; expiration: string }> }
) {
  try {
    const { ticker, expiration } = await params;
    const backendUrl = getBackendUrl();

    // Forward query parameters (e.g., include_greeks=true)
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = queryString
      ? `${backendUrl}/api/chain/options/${ticker}/${expiration}?${queryString}`
      : `${backendUrl}/api/chain/options/${ticker}/${expiration}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching options chain:', error);
    return NextResponse.json(
      { error: 'Failed to fetch options chain from backend' },
      { status: 503 }
    );
  }
}
