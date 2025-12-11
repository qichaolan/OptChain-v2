import { NextResponse } from 'next/server';

function getBackendUrl(): string {
  return process.env.OPTCHAIN_BACKEND_URL || 'http://127.0.0.1:8081';
}

export async function GET() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/tickers`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching tickers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickers from backend' },
      { status: 503 }
    );
  }
}
