/**
 * Prompt Loader with Caching
 *
 * Loads prompts from filesystem with in-memory caching and TTL.
 * Uses async I/O to avoid blocking the event loop.
 */

import { readFile, access } from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Cache with TTL
// ============================================================================

interface CacheEntry {
  content: string;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const promptCache = new Map<string, CacheEntry>();

/**
 * Get cached prompt if it exists and hasn't expired
 */
function getCachedPrompt(key: string): string | null {
  const entry = promptCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    promptCache.delete(key);
    return null;
  }

  return entry.content;
}

/**
 * Set cached prompt with current timestamp
 */
function setCachedPrompt(key: string, content: string): void {
  promptCache.set(key, { content, timestamp: Date.now() });
}

// ============================================================================
// Path Resolution (async to avoid blocking)
// ============================================================================

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getPromptsDir(): Promise<string> {
  // Local development
  const promptsPath = path.join(process.cwd(), 'prompts');
  if (await fileExists(promptsPath)) {
    return promptsPath;
  }

  // Docker/production
  const appPromptsPath = '/app/prompts';
  if (await fileExists(appPromptsPath)) {
    return appPromptsPath;
  }

  return promptsPath;
}

// ============================================================================
// Default Prompt
// ============================================================================

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
// Prompt Loader
// ============================================================================

export async function loadPrompt(pageId: string, contextType: string): Promise<string> {
  const cacheKey = `${pageId}:${contextType}`;

  // Check cache first (with TTL)
  const cached = getCachedPrompt(cacheKey);
  if (cached) {
    return cached;
  }

  const promptsDir = await getPromptsDir();

  // Try specific prompt: pageId/contextType.txt
  const specificPath = path.join(promptsDir, pageId.replace('_', '-'), `${contextType}.txt`);
  if (await fileExists(specificPath)) {
    try {
      const content = await readFile(specificPath, 'utf-8');
      setCachedPrompt(cacheKey, content);
      return content;
    } catch {
      // Fall through to next option
    }
  }

  // Try explainer.txt in the page directory
  const explainerPath = path.join(promptsDir, pageId.replace('_', '-'), 'explainer.txt');
  if (await fileExists(explainerPath)) {
    try {
      const content = await readFile(explainerPath, 'utf-8');
      setCachedPrompt(cacheKey, content);
      return content;
    } catch {
      // Fall through to next option
    }
  }

  // Try page-level prompt
  const pagePromptPath = path.join(promptsDir, `${pageId}.txt`);
  if (await fileExists(pagePromptPath)) {
    try {
      const content = await readFile(pagePromptPath, 'utf-8');
      setCachedPrompt(cacheKey, content);
      return content;
    } catch {
      // Fall through to default
    }
  }

  // Return default prompt
  const defaultPrompt = getDefaultPrompt(pageId, contextType);
  setCachedPrompt(cacheKey, defaultPrompt);
  return defaultPrompt;
}

// ============================================================================
// Cache Management
// ============================================================================

export function clearPromptCache(): void {
  promptCache.clear();
}

export function getPromptCacheSize(): number {
  return promptCache.size;
}
