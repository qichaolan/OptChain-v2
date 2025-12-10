/**
 * Micro-Action Prompt Loader
 *
 * Loads prompt templates for micro-actions from the prompts directory.
 * Provides fallback inline prompts if files are not available.
 */

import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

type MicroActionCategory = 'leaps' | 'credit-spread' | 'iron-condor' | 'metric' | 'scenario' | 'generic';

interface MicroActionPromptConfig {
  category: MicroActionCategory;
  filename: string;
  fallback: string;
}

// ============================================================================
// Prompt Mapping
// ============================================================================

const MICRO_ACTION_PROMPTS: Record<string, MicroActionPromptConfig> = {
  // LEAPS
  'leaps.explain_breakeven': {
    category: 'leaps',
    filename: 'explain_breakeven.md',
    fallback: 'Explain what the breakeven price means for this LEAPS option and how likely it is to be reached.',
  },
  'leaps.explain_leverage': {
    category: 'leaps',
    filename: 'explain_leverage.md',
    fallback: 'Explain the leverage ratio and capital efficiency of this LEAPS position.',
  },
  'leaps.highlight_risks': {
    category: 'leaps',
    filename: 'highlight_risks.md',
    fallback: 'Highlight the key risk zones for this options position.',
  },
  'leaps.compare_contracts': {
    category: 'leaps',
    filename: 'compare_contracts.md',
    fallback: 'Compare this contract to similar alternatives with different strikes or expirations.',
  },

  // Credit Spreads
  'credit_spread.analyze_probability_of_touch': {
    category: 'credit-spread',
    filename: 'analyze_probability_of_touch.md',
    fallback: 'Evaluate the probability of the underlying price touching the short strike before expiration.',
  },
  'credit_spread.analyze_roi_risk_tradeoff': {
    category: 'credit-spread',
    filename: 'analyze_roi_risk_tradeoff.md',
    fallback: 'Summarize the ROI vs risk tradeoff for this credit spread in simple terms.',
  },
  'credit_spread.explain_delta': {
    category: 'credit-spread',
    filename: 'explain_delta.md',
    fallback: 'Explain what the delta value implies for the risk and probability of profit.',
  },
  'credit_spread.explain_theta': {
    category: 'credit-spread',
    filename: 'explain_theta.md',
    fallback: 'Explain how time decay (theta) affects this spread as days pass.',
  },

  // Iron Condor
  'iron_condor.explain_regions': {
    category: 'iron-condor',
    filename: 'explain_regions.md',
    fallback: 'Explain the profit/loss regions (A-E) of this Iron Condor payoff chart in plain English.',
  },
  'iron_condor.explain_profit_zone': {
    category: 'iron-condor',
    filename: 'explain_profit_zone.md',
    fallback: 'Explain the profit zone width and probability of staying within it.',
  },
  'iron_condor.analyze_skew': {
    category: 'iron-condor',
    filename: 'analyze_skew.md',
    fallback: 'Analyze the volatility skew and balance between the put and call spreads.',
  },
  'iron_condor.analyze_wing_balance': {
    category: 'iron-condor',
    filename: 'analyze_wing_balance.md',
    fallback: 'Analyze whether the wings are balanced and suggest any adjustments.',
  },

  // Metrics
  'metric.explain_iv': {
    category: 'metric',
    filename: 'explain_iv.md',
    fallback: 'Explain what the current implied volatility means for this strategy.',
  },
  'metric.explain_score': {
    category: 'metric',
    filename: 'explain_score.md',
    fallback: 'Explain why this contract received its AI score and what factors contributed.',
  },
  'metric.explain_dte': {
    category: 'metric',
    filename: 'explain_dte.md',
    fallback: 'Explain how the days to expiration affects this strategy.',
  },

  // Scenarios
  'scenario.what_if_price_change': {
    category: 'scenario',
    filename: 'what_if_price_change.md',
    fallback: 'What would happen to this position if the underlying price moves up or down 10%?',
  },
  'scenario.what_if_iv_change': {
    category: 'scenario',
    filename: 'what_if_iv_change.md',
    fallback: 'What would happen to this position if implied volatility increases or decreases by 20%?',
  },
  'scenario.what_if_time_passes': {
    category: 'scenario',
    filename: 'what_if_time_passes.md',
    fallback: 'What would happen to this position after 7 days, 14 days, and 30 days pass?',
  },

  // Generic
  'generic.summarize_selection': {
    category: 'generic',
    filename: 'summarize_selection.md',
    fallback: 'Provide a brief summary of this selection and its key characteristics.',
  },
  'generic.explain_section': {
    category: 'generic',
    filename: 'explain_section.md',
    fallback: 'Explain what this section shows and how to interpret the data.',
  },
};

// ============================================================================
// Prompt Cache
// ============================================================================

const promptCache = new Map<string, string>();

// ============================================================================
// Loader Functions
// ============================================================================

/**
 * Get the prompts directory path
 */
function getPromptsDir(): string {
  return path.join(process.cwd(), 'prompts', 'micro-actions');
}

/**
 * Load a micro-action prompt from file or return fallback
 */
export async function loadMicroPrompt(actionType: string): Promise<string> {
  // Check cache first
  if (promptCache.has(actionType)) {
    return promptCache.get(actionType)!;
  }

  const config = MICRO_ACTION_PROMPTS[actionType];
  if (!config) {
    console.warn(`Unknown micro-action type: ${actionType}`);
    return 'Analyze and explain this data concisely.';
  }

  try {
    const filePath = path.join(getPromptsDir(), config.category, config.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    promptCache.set(actionType, content);
    return content;
  } catch (error) {
    // File not found or read error - use fallback
    console.warn(`Could not load prompt for ${actionType}, using fallback`);
    return config.fallback;
  }
}

/**
 * Preload all prompts into cache
 */
export async function preloadMicroPrompts(): Promise<void> {
  const loadPromises = Object.keys(MICRO_ACTION_PROMPTS).map(async (actionType) => {
    try {
      await loadMicroPrompt(actionType);
    } catch {
      // Ignore errors during preload
    }
  });

  await Promise.all(loadPromises);
}

/**
 * Clear the prompt cache (useful for development)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Get all available micro-action types
 */
export function getMicroActionTypes(): string[] {
  return Object.keys(MICRO_ACTION_PROMPTS);
}
