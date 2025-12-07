/**
 * Shared Gemini Client
 *
 * Centralized configuration for Google Generative AI.
 * Prevents duplicate initialization and config drift.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GEMINI_CONFIG } from '@/config/ai.config';

// ============================================================================
// Configuration (from centralized config)
// ============================================================================

const MODEL_NAME = GEMINI_CONFIG.modelName;

export const MODEL_CONFIG = GEMINI_CONFIG.generation;

// ============================================================================
// API Key Getter (lazy, avoids module-level exposure in stack traces)
// ============================================================================

/**
 * Get Gemini API key lazily.
 * Throws a generic error message to avoid exposing key names in stack traces.
 */
function getApiKey(): string {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    // Generic error message - don't reveal which env vars we're looking for
    throw new Error('AI service not configured');
  }
  return key;
}

// ============================================================================
// Client Singleton
// ============================================================================

let geminiClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = getApiKey();
    geminiClient = new GoogleGenerativeAI(apiKey);
  }

  return geminiClient;
}

export function getGeminiModel(): GenerativeModel {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: MODEL_CONFIG,
  });
}

// ============================================================================
// Exports
// ============================================================================

export { MODEL_NAME };
