import { NextRequest, NextResponse } from 'next/server';

function getBackendUrl(): string {
  return process.env.OPTCHAIN_BACKEND_URL || 'http://127.0.0.1:8081';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/chain/expirations/${ticker}`, {
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
    console.error('Error fetching expirations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expirations from backend' },
      { status: 503 }
    );
  }
}
