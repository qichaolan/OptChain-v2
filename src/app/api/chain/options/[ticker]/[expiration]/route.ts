import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.OPTCHAIN_BACKEND_URL || 'http://localhost:8081';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string; expiration: string }> }
) {
  try {
    const { ticker, expiration } = await params;
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    const url = `${BACKEND_URL}/chain/options/${ticker}/${expiration}${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { detail: errorData.detail || 'Failed to fetch options chain' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to backend:', error);
    return NextResponse.json(
      { detail: 'Backend service unavailable' },
      { status: 503 }
    );
  }
}
