/**
 * AI Explainer API Route
 *
 * Endpoint for generating AI explanations using Gemini.
 * Loads appropriate prompts based on page context and returns structured analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { loadPrompt } from '@/lib/prompts';
import { loadMicroPrompt } from '@/lib/micro-prompts';
import { safeValidateExplainRequest } from '@/lib/validation';
import {
  checkRequestRateLimit,
  validateApiKey,
  generateRequestId,
  logRequest,
} from '@/lib/security';

// ============================================================================
// Response Types
// ============================================================================

interface AiResponse {
  summary: string;
  key_insights?: Array<{ title: string; description: string; sentiment: string }>;
  risks?: Array<{ risk: string; severity: string }>;
  watch_items?: Array<{ item: string; trigger?: string }>;
  disclaimer?: string;
  // LEAPS-specific new fields
  verdict?: string;
  risks_summary?: string[];
  profit_scenario?: string;
  scenarios?: unknown;
  // Credit Spread / Iron Condor specific
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
// Micro-Action Response Generator
// ============================================================================

interface MicroAction {
  type: string;
  prompt: string;
}

interface TooltipRequest {
  metricType: string;
  metricValue: string | number;
  metricLabel?: string;
}

async function generateMicroResponse(
  microAction: MicroAction,
  metadata: Record<string, unknown>
): Promise<string> {
  const model = getGeminiModel();

  // Load the system prompt from file (with caching and fallback)
  const systemPrompt = await loadMicroPrompt(microAction.type);

  const prompt = `${systemPrompt}

## Context Data
\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`

Respond with just the explanation text, no JSON formatting. Keep it under 100 words.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text().trim();
}

// ============================================================================
// Tooltip Response Generator
// ============================================================================

const METRIC_EXPLANATIONS: Record<string, string> = {
  iv: 'Implied Volatility (IV) represents the market\'s expectation of future price movement. Higher IV means options are more expensive.',
  ivp: 'IV Percentile shows where current IV ranks compared to the past year. High IVP (>50%) suggests options are relatively expensive.',
  delta: 'Delta measures the option\'s sensitivity to a $1 move in the underlying. It also approximates the probability of expiring in-the-money.',
  score: 'The score is a composite rating based on probability of profit, risk/reward ratio, and other key metrics.',
  dte: 'Days to Expiration (DTE) affects time decay (theta). Shorter DTE means faster decay but less time for the trade to work.',
  roc: 'Return on Capital (ROC) shows the potential return relative to the capital at risk.',
  pop: 'Probability of Profit (POP) estimates the likelihood of making money on the trade at expiration.',
  breakeven: 'The breakeven point is where the trade neither makes nor loses money at expiration.',
  strike: 'The strike price is the price at which the option can be exercised.',
  premium: 'The premium is the price paid (for buying) or received (for selling) for the option contract.',
  width: 'The width is the distance between strikes in a spread, determining max risk and capital required.',
  credit: 'The credit received when selling a spread. This is your max profit if the spread expires worthless.',
  max_gain: 'Maximum gain is the most you can profit if the trade works perfectly.',
  max_loss: 'Maximum loss is the most you can lose, typically the capital at risk.',
};

async function generateTooltipResponse(
  tooltipRequest: TooltipRequest,
  metadata: Record<string, unknown>
): Promise<string> {
  const model = getGeminiModel();
  const baseExplanation = METRIC_EXPLANATIONS[tooltipRequest.metricType] || '';

  const prompt = `You are a concise options trading assistant. Explain this specific metric value in 1-2 sentences.

## Metric
- Type: ${tooltipRequest.metricType}
- Value: ${tooltipRequest.metricValue}
- Label: ${tooltipRequest.metricLabel || tooltipRequest.metricType}

## Base Knowledge
${baseExplanation}

## Context Data
\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`

Explain what this specific value of ${tooltipRequest.metricValue} means for this trade. Be specific and actionable. Keep it under 50 words.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text().trim();
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
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Security: Check rate limit first
    const rateLimitError = checkRequestRateLimit(req);
    if (rateLimitError) {
      logRequest(req, requestId, 429, startTime);
      return rateLimitError;
    }

    // Security: Validate API key / origin
    const authError = validateApiKey(req);
    if (authError) {
      logRequest(req, requestId, 401, startTime);
      return authError;
    }

    const body = await req.json();

    // Validate request with Zod
    const validation = safeValidateExplainRequest(body);
    if (!validation.success) {
      // Log only structured validation errors, not request body details
      console.error('Validation failed:', validation.error);
      logRequest(req, requestId, 400, startTime);
      return NextResponse.json(
        { success: false, error: `Validation error: ${validation.error}` },
        { status: 400 }
      );
    }

    const { pageId, contextType, metadata, microAction, tooltipRequest } = validation.data!;

    // Handle micro-action requests (quick, targeted responses)
    if (microAction) {
      const microResponse = await generateMicroResponse(
        microAction as MicroAction,
        metadata as Record<string, unknown>
      );

      logRequest(req, requestId, 200, startTime);

      return NextResponse.json({
        success: true,
        type: 'micro',
        actionType: microAction.type,
        response: microResponse,
        timestamp: new Date().toISOString(),
      });
    }

    // Handle tooltip requests (metric explanations)
    if (tooltipRequest) {
      const tooltipResponse = await generateTooltipResponse(
        tooltipRequest as TooltipRequest,
        metadata as Record<string, unknown>
      );

      logRequest(req, requestId, 200, startTime);

      return NextResponse.json({
        success: true,
        type: 'tooltip',
        metricType: tooltipRequest.metricType,
        response: tooltipResponse,
        timestamp: new Date().toISOString(),
      });
    }

    // Full analysis request - Load appropriate prompt (async with caching)
    const systemPrompt = await loadPrompt(pageId, contextType);

    // Generate explanation
    const parsedResponse = await generateExplanation(systemPrompt, metadata as Record<string, unknown>);

    // Validate response has required fields
    if (!parsedResponse.summary) {
      throw new Error("Response missing required 'summary' field");
    }

    // Helper to convert scenario snake_case keys to camelCase
    const convertScenario = (scenario: Record<string, unknown> | undefined) => {
      if (!scenario) return undefined;
      return {
        minAnnualReturn: scenario.min_annual_return,
        projectedPriceTarget: scenario.projected_price_target,
        payoffRealism: scenario.payoff_realism,
        optionPayoff: scenario.option_payoff,
      };
    };

    // Convert scenarios object with snake_case keys to camelCase
    const convertScenarios = (scenarios: Record<string, unknown> | undefined) => {
      if (!scenarios) return undefined;
      return {
        mediumIncrease: convertScenario(scenarios.medium_increase as Record<string, unknown>),
        strongIncrease: convertScenario(scenarios.strong_increase as Record<string, unknown>),
      };
    };

    // Build content object with camelCase keys to match frontend types
    const content = {
      // Common fields
      summary: parsedResponse.summary || '',
      keyInsights: parsedResponse.key_insights || [],
      risks: parsedResponse.risks || [],
      watchItems: parsedResponse.watch_items || [],
      disclaimer: parsedResponse.disclaimer ||
        'This analysis is for educational purposes only and should not be considered financial advice.',

      // LEAPS-specific new fields
      verdict: parsedResponse.verdict,
      risksSummary: parsedResponse.risks_summary,
      profitScenario: parsedResponse.profit_scenario,
      scenarios: convertScenarios(parsedResponse.scenarios as Record<string, unknown>),

      // Credit Spread / Iron Condor specific
      strategyName: parsedResponse.strategy_name,
      tradeMechanics: parsedResponse.trade_mechanics,
      keyMetrics: parsedResponse.key_metrics,
      visualization: parsedResponse.visualization,
      strategyAnalysis: parsedResponse.strategy_analysis,
      riskManagement: parsedResponse.risk_management,
    };

    logRequest(req, requestId, 200, startTime);

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

    logRequest(req, requestId, 500, startTime);

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
