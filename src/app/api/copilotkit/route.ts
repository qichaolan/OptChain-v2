/**
 * CopilotKit API Route
 *
 * Main endpoint for CopilotKit runtime integration.
 * Handles CopilotKit requests and routes them to Gemini.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

// ============================================================================
// Gemini Client Setup
// ============================================================================

function getGeminiAdapter() {
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  return new GoogleGenerativeAIAdapter({
    model: MODEL_NAME,
  });
}

// ============================================================================
// CopilotKit Runtime
// ============================================================================

const runtime = new CopilotRuntime({
  actions: [
    // Custom action for analyzing options strategies
    {
      name: 'analyzeOptionsStrategy',
      description: `Analyze an options trading strategy and provide educational insights.
This action takes simulation data for LEAPS, Credit Spreads, or Iron Condors
and returns structured analysis including summary, key insights, risks, and strategy-specific analysis.`,
      parameters: [
        {
          name: 'pageId',
          type: 'string',
          description: 'The page identifier (leaps_ranker, credit_spread_screener, iron_condor_screener)',
          required: true,
        },
        {
          name: 'contextType',
          type: 'string',
          description: 'The context type (roi_simulator, spread_simulator)',
          required: true,
        },
        {
          name: 'metadata',
          type: 'object',
          description: 'The simulation metadata containing strategy details',
          required: true,
        },
      ],
      handler: async ({ pageId, contextType, metadata }) => {
        // Forward to our explain endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/copilotkit/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId, contextType, metadata, timestamp: new Date().toISOString() }),
        });

        if (!response.ok) {
          throw new Error('Failed to analyze strategy');
        }

        return await response.json();
      },
    },
  ],
});

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const adapter = getGeminiAdapter();

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter: adapter,
      endpoint: '/api/copilotkit',
    });

    return handleRequest(req);
  } catch (error) {
    console.error('CopilotKit API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
