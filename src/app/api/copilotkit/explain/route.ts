/**
 * AI Explainer API Route
 *
 * Endpoint for generating AI explanations using Gemini.
 * Loads appropriate prompts based on page context and returns structured analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

// Model configuration matching the existing FastAPI service
const MODEL_CONFIG = {
  temperature: 0.2,
  maxOutputTokens: 10000,
  topP: 0.8,
  topK: 40,
};

// ============================================================================
// Prompt Loading
// ============================================================================

function getPromptsDir(): string {
  // Prompts are in the project's prompts directory
  const promptsPath = path.join(process.cwd(), 'prompts');
  if (fs.existsSync(promptsPath)) {
    return promptsPath;
  }

  // Fallback for Docker/production
  const appPromptsPath = '/app/prompts';
  if (fs.existsSync(appPromptsPath)) {
    return appPromptsPath;
  }

  return promptsPath;
}

function loadPrompt(pageId: string, contextType: string): string {
  const promptsDir = getPromptsDir();

  // Try specific prompt first: pageId/contextType.txt
  const specificPath = path.join(promptsDir, pageId.replace('_', '-'), `${contextType}.txt`);
  if (fs.existsSync(specificPath)) {
    return fs.readFileSync(specificPath, 'utf-8');
  }

  // Try page-level prompt
  const pagePromptPath = path.join(promptsDir, `${pageId}.txt`);
  if (fs.existsSync(pagePromptPath)) {
    return fs.readFileSync(pagePromptPath, 'utf-8');
  }

  // Return default prompt
  return getDefaultPrompt(pageId, contextType);
}

function getDefaultPrompt(pageId: string, contextType: string): string {
  return `You are an expert options analyst AI assistant.
Your role is to help users understand their options trading simulation results.

## Context
- Page: ${pageId}
- Context Type: ${contextType}

## Guidelines
1. Provide educational, fact-based analysis
2. Never give specific trading advice like "you should buy" or "you should sell"
3. Reference actual numbers from the provided metadata
4. Include risk factors and watch items
5. Keep explanations clear and accessible

## Output Format
You MUST respond with valid JSON matching this structure:
{
  "summary": "A 2-3 sentence overview of the analysis",
  "key_insights": [
    {
      "title": "Insight title",
      "description": "Detailed explanation",
      "sentiment": "positive|neutral|negative"
    }
  ],
  "risks": [
    {
      "risk": "Risk description",
      "severity": "low|medium|high"
    }
  ],
  "watch_items": [
    {
      "item": "What to watch",
      "trigger": "Trigger condition"
    }
  ],
  "disclaimer": "This analysis is for educational purposes only and should not be considered financial advice."
}

Always return valid JSON - no markdown code blocks.`;
}

// ============================================================================
// Gemini Client
// ============================================================================

async function generateExplanation(
  systemPrompt: string,
  metadata: Record<string, any>
): Promise<Record<string, any>> {
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: MODEL_CONFIG,
  });

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

  // Parse JSON from response
  return parseGeminiResponse(text);
}

function parseGeminiResponse(responseText: string): Record<string, any> {
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
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
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
    const { pageId, contextType, metadata, timestamp } = body;

    // Validate required fields
    if (!pageId || !contextType || !metadata) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: pageId, contextType, metadata' },
        { status: 400 }
      );
    }

    // Validate page ID
    const validPageIds = ['leaps_ranker', 'credit_spread_screener', 'iron_condor_screener'];
    if (!validPageIds.includes(pageId)) {
      return NextResponse.json(
        { success: false, error: `Invalid pageId. Must be one of: ${validPageIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Load appropriate prompt
    const systemPrompt = loadPrompt(pageId, contextType);

    // Generate explanation
    const parsedResponse = await generateExplanation(systemPrompt, metadata);

    // Validate response has required fields
    if (!parsedResponse.summary) {
      throw new Error("Response missing required 'summary' field");
    }

    // Build content object matching existing structure
    const content = {
      // Common fields
      summary: parsedResponse.summary || '',
      key_insights: parsedResponse.key_insights || [],
      risks: parsedResponse.risks || [],
      watch_items: parsedResponse.watch_items || [],
      disclaimer: parsedResponse.disclaimer ||
        'This analysis is for educational purposes only and should not be considered financial advice.',

      // LEAPS-specific
      scenarios: parsedResponse.scenarios,

      // Credit Spread / Iron Condor specific
      strategy_name: parsedResponse.strategy_name,
      trade_mechanics: parsedResponse.trade_mechanics,
      key_metrics: parsedResponse.key_metrics,
      visualization: parsedResponse.visualization,
      strategy_analysis: parsedResponse.strategy_analysis,
      risk_management: parsedResponse.risk_management,
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
    console.error('AI Explainer API Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

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
