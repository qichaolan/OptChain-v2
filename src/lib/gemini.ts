/**
 * Shared Gemini Client
 *
 * Centralized configuration for Google Generative AI.
 * Prevents duplicate initialization and config drift.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

export const MODEL_CONFIG = {
  temperature: 0.2,
  maxOutputTokens: 10000,
  topP: 0.8,
  topK: 40,
} as const;

// ============================================================================
// Client Singleton
// ============================================================================

let geminiClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
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
