/**
 * AI Explainer Action
 *
 * CopilotKit action for analyzing options simulations.
 * This action is registered with CopilotKit and can be invoked
 * when users request AI insights.
 */

import { ContextEnvelope, PageMetadata } from '@/types';
import { AiExplainerContent, CopilotActionResult } from '@/types/ai-response';

// ============================================================================
// Action Configuration
// ============================================================================

export const AI_EXPLAINER_ACTION = {
  name: 'analyzeOptionsStrategy',
  description: `Analyze an options trading strategy and provide educational insights.
This action takes simulation data and returns structured analysis including:
- Summary of the strategy
- Key insights and metrics
- Risk factors and watch items
- Strategy-specific analysis (LEAPS scenarios, spread zones, etc.)`,
  parameters: [
    {
      name: 'context',
      type: 'object',
      description: 'The context envelope containing page, metadata, and settings',
      required: true,
    },
  ],
};

// ============================================================================
// Constants
// ============================================================================

const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// Set to true to enable metadata logging before AI requests
const DEBUG_LOG_METADATA = true;

// ============================================================================
// Action Handler
// ============================================================================

/**
 * Handle the AI explainer action
 *
 * This function is called by CopilotKit when the action is invoked.
 * It sends the context to our backend API and returns the structured response.
 */
export async function handleAiExplainerAction(
  context: ContextEnvelope<PageMetadata>
): Promise<CopilotActionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Validate context
    if (!context.page || !context.contextType || !context.metadata) {
      return {
        success: false,
        error: 'Invalid context: missing required fields',
      };
    }

    // Log metadata before sending to AI (for debugging)
    if (DEBUG_LOG_METADATA) {
      console.group(`🤖 AI Analysis Request - ${context.page}`);
      console.log('Page:', context.page);
      console.log('Context Type:', context.contextType);
      console.log('Timestamp:', context.timestamp);
      console.log('Settings:', context.settings);
      console.log('Metadata:', JSON.stringify(context.metadata, null, 2));
      console.groupEnd();
    }

    // Call our backend API with abort controller for timeout
    const response = await fetch('/api/copilotkit/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pageId: context.page,
        contextType: context.contextType,
        timestamp: context.timestamp,
        metadata: context.metadata,
        settings: context.settings,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to get AI explanation',
      };
    }

    return {
      success: true,
      data: data.content as AiExplainerContent,
      fromCache: data.cached,
    };
  } catch (error) {
    // Handle abort specifically
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. Please try again.',
      };
    }

    console.error('AI Explainer Action Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Action Definition for CopilotKit
// ============================================================================

export function getAiExplainerActionDefinition() {
  return {
    name: AI_EXPLAINER_ACTION.name,
    description: AI_EXPLAINER_ACTION.description,
    parameters: AI_EXPLAINER_ACTION.parameters,
    handler: handleAiExplainerAction,
  };
}
