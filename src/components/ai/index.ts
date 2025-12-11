/**
 * AI Components Index
 *
 * Re-export all AI-related UI components.
 * Includes chatless generative UI components for inline AI insights.
 */

export { AiInsightsButton, default as AiInsightsButtonDefault } from './AiInsightsButton';
export { AiInsightsPanel, default as AiInsightsPanelDefault } from './AiInsightsPanel';
export { InlineAiInsights, default as InlineAiInsightsDefault } from './InlineAiInsights';

// Micro AI Actions - Small, targeted AI buttons
export { MicroAiAction, MicroActionsGroup, default as MicroAiActionDefault } from './MicroAiAction';
export type { MicroActionType } from './MicroAiAction';

// AI Tooltips - Hover/Tap AI explanations
export {
  AiTooltip,
  IVTooltip,
  DeltaTooltip,
  ScoreTooltip,
  DTETooltip,
  POPTooltip,
  ROCTooltip,
  default as AiTooltipDefault,
} from './AiTooltip';
export type { MetricType } from './AiTooltip';

// Hover AI - Hover/Tap triggered AI explanations using CopilotKit micro-actions
export { HoverAI, default as HoverAIDefault } from './HoverAI';

// Battle Mode - Side-by-side contract comparison
export { BattleModeComparison, default as BattleModeComparisonDefault } from './BattleModeComparison';
export { ChainBattleModeComparison, default as ChainBattleModeComparisonDefault } from './ChainBattleModeComparison';
