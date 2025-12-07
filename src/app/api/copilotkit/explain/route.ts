/**
 * AI Explainer API Route
 *
 * Endpoint for generating AI explanations using Gemini.
 * Loads appropriate prompts based on page context and returns structured analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { loadPrompt } from '@/lib/prompts';
import { safeValidateExplainRequest } from '@/lib/validation';

// ============================================================================
// Response Types
// ============================================================================

interface AiResponse {
  summary: string;
  key_insights?: Array<{ title: string; description: string; sentiment: string }>;
  risks?: Array<{ risk: string; severity: string }>;
  watch_items?: Array<{ item: string; trigger?: string }>;
  disclaimer?: string;
  scenarios?: unknown;
  strategy_name?: string;
  trade_mechanics?: unknown;
  key_metrics?: unknown;
  visualization?: unknown;
  strategy_analysis?: unknown;
  risk_management?: unknown;
}

// ============================================================================
// Gemini Response Generator
// ============================================================================

async function generateExplanation(
  systemPrompt: string,
  metadata: Record<string, unknown>
): Promise<AiResponse> {
  const model = getGeminiModel();

  const userContent = `
## Simulation Data

\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`

Please analyze this simulation data and provide your explanation in the required JSON format.
`;

  const fullPrompt = `${systemPrompt}\n\n---\n\n## User Request\n\n${userContent}`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  return parseGeminiResponse(text);
}

// ============================================================================
// Response Parser
// ============================================================================

/**
 * Extract JSON object from text using balanced brace matching.
 * Avoids ReDoS vulnerability from greedy regex patterns.
 */
function extractJsonObject(text: string): string | null {
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(startIdx, i + 1);
        }
      }
    }
  }

  return null;
}

function parseGeminiResponse(responseText: string): AiResponse {
  let text = responseText.trim();

  // Remove markdown code block if present
  if (text.startsWith('```json')) {
    text = text.slice(7);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }

  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }

  text = text.trim();

  try {
    return JSON.parse(text) as AiResponse;
  } catch {
    // Try to extract JSON using safe brace matching (avoids ReDoS)
    const jsonStr = extractJsonObject(text);
    if (jsonStr) {
      try {
        return JSON.parse(jsonStr) as AiResponse;
      } catch {
        // Fall through to error
      }
    }

    throw new Error('Invalid JSON response from AI');
  }
}

// ============================================================================
// Request Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request with Zod
    const validation = safeValidateExplainRequest(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Validation error: ${validation.error}` },
        { status: 400 }
      );
    }

    const { pageId, contextType, metadata } = validation.data!;

    // Load appropriate prompt (async with caching)
    const systemPrompt = await loadPrompt(pageId, contextType);

    // Generate explanation
    const parsedResponse = await generateExplanation(systemPrompt, metadata as Record<string, unknown>);

    // Validate response has required fields
    if (!parsedResponse.summary) {
      throw new Error("Response missing required 'summary' field");
    }

    // Build content object with camelCase keys to match frontend types
    const content = {
      // Common fields
      summary: parsedResponse.summary || '',
      keyInsights: parsedResponse.key_insights || [],
      risks: parsedResponse.risks || [],
      watchItems: parsedResponse.watch_items || [],
      disclaimer: parsedResponse.disclaimer ||
        'This analysis is for educational purposes only and should not be considered financial advice.',

      // LEAPS-specific
      scenarios: parsedResponse.scenarios,

      // Credit Spread / Iron Condor specific
      strategyName: parsedResponse.strategy_name,
      tradeMechanics: parsedResponse.trade_mechanics,
      keyMetrics: parsedResponse.key_metrics,
      visualization: parsedResponse.visualization,
      strategyAnalysis: parsedResponse.strategy_analysis,
      riskManagement: parsedResponse.risk_management,
    };

    return NextResponse.json({
      success: true,
      pageId,
      contextType,
      content,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Log only the error message, not the full error object (avoid leaking sensitive info)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('AI Explainer API Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
