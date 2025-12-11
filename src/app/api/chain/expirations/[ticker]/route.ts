import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.OPTCHAIN_BACKEND_URL || 'http://localhost:8081';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    const response = await fetch(`${BACKEND_URL}/chain/expirations/${ticker}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { detail: errorData.detail || 'Failed to fetch expirations' },
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
