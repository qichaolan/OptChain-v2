import { NextRequest, NextResponse } from 'next/server';

function getBackendUrl(): string {
  return process.env.OPTCHAIN_BACKEND_URL || 'http://127.0.0.1:8081';
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl = getBackendUrl();
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = queryString
      ? `${backendUrl}/api/credit-spreads?${queryString}`
      : `${backendUrl}/api/credit-spreads`;

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
    console.error('Error in Credit Spreads GET API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit spreads data from backend' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/credit-spreads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    console.error('Error in Credit Spreads POST API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit spreads data from backend' },
      { status: 503 }
    );
  }
}
