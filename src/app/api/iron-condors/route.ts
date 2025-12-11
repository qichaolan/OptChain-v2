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
      ? `${backendUrl}/api/iron-condors?${queryString}`
      : `${backendUrl}/api/iron-condors`;

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
    console.error('Error in Iron Condors API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch iron condors data from backend' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = getBackendUrl();

    const response = await fetch(`${backendUrl}/api/iron-condors`, {
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
    console.error('Error in Iron Condors POST API:', error);
    return NextResponse.json(
      { error: 'Failed to create iron condor' },
      { status: 503 }
    );
  }
}
