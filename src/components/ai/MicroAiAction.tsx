'use client';

/**
 * Micro AI Action Component
 *
 * Small, targeted AI action buttons that feel embedded in the workflow.
 * These are tiny buttons (icons) that trigger specific AI analyses.
 *
 * Features:
 * - Auto-positioning popovers that stay within viewport
 * - Responsive on mobile devices
 * - Reusable positioning system for all AI actions
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useOptionChain } from '@/contexts';

// ============================================================================
// Types
// ============================================================================

export type MicroActionType =
  // LEAPS actions
  | 'leaps.explain_breakeven'
  | 'leaps.explain_leverage'
  | 'leaps.highlight_risks'
  | 'leaps.compare_contracts'
  // Credit Spread actions
  | 'credit_spread.analyze_probability_of_touch'
  | 'credit_spread.analyze_roi_risk_tradeoff'
  | 'credit_spread.explain_delta'
  | 'credit_spread.explain_theta'
  // Iron Condor actions
  | 'iron_condor.explain_regions'
  | 'iron_condor.explain_profit_zone'
  | 'iron_condor.analyze_skew'
  | 'iron_condor.analyze_wing_balance'
  // Metric explanations
  | 'metric.explain_iv'
  | 'metric.explain_score'
  | 'metric.explain_dte'
  // ROI analysis
  | 'roi.analyze_value'
  // Scenario simulations
  | 'scenario.what_if_price_change'
  | 'scenario.what_if_iv_change'
  | 'scenario.what_if_time_passes'
  // Generic contextual help
  | 'generic.summarize_selection'
  | 'generic.explain_section';

interface MicroAiActionProps {
  /** The type of AI action to trigger */
  actionType: MicroActionType;
  /** Custom label (optional - defaults to action-specific text) */
  label?: string;
  /** Icon to display (emoji or icon component) */
  icon?: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Custom className */
  className?: string;
  /** Callback when result is received */
  onResult?: (result: string) => void;
}

// ============================================================================
// Popover Position Types
// ============================================================================

interface PopoverPosition {
  styles: React.CSSProperties;
  maxWidth: number;
}

// ============================================================================
// Action Configurations
// ============================================================================

const ACTION_CONFIG: Record<MicroActionType, { label: string; icon: string; prompt: string }> = {
  // LEAPS actions
  'leaps.explain_breakeven': {
    label: 'Explain Breakeven',
    icon: '📍',
    prompt: 'Explain what the breakeven price means for this LEAPS option and how likely it is to be reached.',
  },
  'leaps.explain_leverage': {
    label: 'Explain Leverage',
    icon: '📈',
    prompt: 'Explain the leverage ratio and capital efficiency of this LEAPS position.',
  },
  'leaps.highlight_risks': {
    label: 'Show Risks',
    icon: '⚠️',
    prompt: 'Highlight the key risk zones for this options position.',
  },
  'leaps.compare_contracts': {
    label: 'Compare Contracts',
    icon: '⚖️',
    prompt: 'Compare this contract to similar alternatives with different strikes or expirations.',
  },

  // Credit Spread actions
  'credit_spread.analyze_probability_of_touch': {
    label: 'Calc Prob Touch',
    icon: '🎯',
    prompt: 'Evaluate the probability of the underlying price touching the short strike before expiration.',
  },
  'credit_spread.analyze_roi_risk_tradeoff': {
    label: 'Analyze ROI/Risk',
    icon: '⚡',
    prompt: 'Summarize the ROI vs risk tradeoff for this credit spread in simple terms.',
  },
  'credit_spread.explain_delta': {
    label: 'Explain Delta',
    icon: '∆',
    prompt: 'Explain what the delta value implies for the risk and probability of profit.',
  },
  'credit_spread.explain_theta': {
    label: 'Explain Theta',
    icon: '⏰',
    prompt: 'Explain how time decay (theta) affects this spread as days pass.',
  },

  // Iron Condor actions
  'iron_condor.explain_regions': {
    label: 'Explain Regions',
    icon: '🗺️',
    prompt: 'Explain the profit/loss regions (A-E) of this Iron Condor payoff chart in plain English.',
  },
  'iron_condor.explain_profit_zone': {
    label: 'Explain Profit Zone',
    icon: '💰',
    prompt: 'Explain the profit zone width and probability of staying within it.',
  },
  'iron_condor.analyze_skew': {
    label: 'Analyze Skew',
    icon: '📊',
    prompt: 'Analyze the volatility skew and balance between the put and call spreads.',
  },
  'iron_condor.analyze_wing_balance': {
    label: 'Check Balance',
    icon: '⚖️',
    prompt: 'Analyze whether the wings are balanced and suggest any adjustments.',
  },

  // Metric explanations
  'metric.explain_iv': {
    label: 'Explain IV',
    icon: '📈',
    prompt: 'Explain what the current implied volatility means for this strategy.',
  },
  'metric.explain_score': {
    label: 'Explain Score',
    icon: '🎯',
    prompt: 'Explain why this contract received its AI score and what factors contributed.',
  },
  'metric.explain_dte': {
    label: 'Explain DTE',
    icon: '📅',
    prompt: 'Explain how the days to expiration affects this strategy.',
  },

  // ROI analysis
  'roi.analyze_value': {
    label: 'Analyze ROI',
    icon: '💰',
    prompt: 'Analyze the return on investment value and what it means for this position.',
  },

  // Scenario simulations
  'scenario.what_if_price_change': {
    label: 'Sim Price Move',
    icon: '📉',
    prompt: 'What would happen to this position if the underlying price moves up or down 10%?',
  },
  'scenario.what_if_iv_change': {
    label: 'Sim IV Shift',
    icon: '🌊',
    prompt: 'What would happen to this position if implied volatility increases or decreases by 20%?',
  },
  'scenario.what_if_time_passes': {
    label: 'Sim Time Decay',
    icon: '⏳',
    prompt: 'What would happen to this position after 7 days, 14 days, and 30 days pass?',
  },

  // Generic contextual help
  'generic.summarize_selection': {
    label: 'Summarize',
    icon: '📝',
    prompt: 'Provide a brief summary of this selection and its key characteristics.',
  },
  'generic.explain_section': {
    label: 'Explain This',
    icon: '💡',
    prompt: 'Explain what this section shows and how to interpret the data.',
  },
};

// ============================================================================
// Positioning Constants
// ============================================================================

const VIEWPORT_PADDING = 12;
const POPOVER_OFFSET = 6;
const DEFAULT_POPOVER_WIDTH = 300;
const MOBILE_BREAKPOINT = 640;

// ============================================================================
// useAutoPosition Hook - Reusable Positioning Logic
// ============================================================================

function useAutoPosition(isOpen: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition>({
    styles: {},
    maxWidth: DEFAULT_POPOVER_WIDTH,
  });

  const calculatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < MOBILE_BREAKPOINT;

    // Find the scrollable parent (panel container)
    let scrollParent = trigger.parentElement;
    let containerBounds = { left: 0, right: viewportWidth, top: 0, bottom: viewportHeight };

    while (scrollParent) {
      const style = window.getComputedStyle(scrollParent);
      if (style.overflow === 'auto' || style.overflow === 'scroll' ||
          style.overflowY === 'auto' || style.overflowY === 'scroll') {
        const rect = scrollParent.getBoundingClientRect();
        containerBounds = {
          left: Math.max(containerBounds.left, rect.left),
          right: Math.min(containerBounds.right, rect.right),
          top: Math.max(containerBounds.top, rect.top),
          bottom: Math.min(containerBounds.bottom, rect.bottom),
        };
        break;
      }
      scrollParent = scrollParent.parentElement;
    }

    // Calculate available space in each direction
    const spaceRight = containerBounds.right - triggerRect.left - VIEWPORT_PADDING;
    const spaceLeft = triggerRect.right - containerBounds.left - VIEWPORT_PADDING;
    const spaceBelow = containerBounds.bottom - triggerRect.bottom - VIEWPORT_PADDING - POPOVER_OFFSET;
    const spaceAbove = triggerRect.top - containerBounds.top - VIEWPORT_PADDING - POPOVER_OFFSET;

    // Calculate effective popover width
    const containerWidth = containerBounds.right - containerBounds.left;
    let effectiveWidth: number;

    if (isMobile) {
      effectiveWidth = containerWidth - (VIEWPORT_PADDING * 2);
    } else {
      effectiveWidth = Math.min(DEFAULT_POPOVER_WIDTH, Math.max(spaceRight, spaceLeft));
    }

    // Determine horizontal placement
    let horizontalAlign: 'left' | 'right' | 'center';
    if (spaceRight >= effectiveWidth) {
      horizontalAlign = 'left'; // Align to left edge of trigger
    } else if (spaceLeft >= effectiveWidth) {
      horizontalAlign = 'right'; // Align to right edge of trigger
    } else {
      // Not enough space on either side - center relative to container
      horizontalAlign = 'center';
      effectiveWidth = Math.min(effectiveWidth, containerWidth - (VIEWPORT_PADDING * 2));
    }

    // Determine vertical placement
    const popoverHeight = popover?.offsetHeight || 150;
    let verticalAlign: 'top' | 'bottom';
    if (spaceBelow >= popoverHeight) {
      verticalAlign = 'bottom';
    } else if (spaceAbove >= popoverHeight) {
      verticalAlign = 'top';
    } else {
      // Use whichever has more space
      verticalAlign = spaceBelow >= spaceAbove ? 'bottom' : 'top';
    }

    // Calculate CSS styles
    const styles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 50,
      maxWidth: effectiveWidth,
      width: isMobile ? effectiveWidth : 'auto',
      minWidth: Math.min(280, effectiveWidth),
    };

    // Horizontal positioning
    if (isMobile) {
      // On mobile, center in the container
      const triggerLeftInContainer = triggerRect.left - containerBounds.left;
      const leftOffset = -triggerLeftInContainer + VIEWPORT_PADDING;
      styles.left = leftOffset;
      styles.right = 'auto';
    } else if (horizontalAlign === 'left') {
      // Check if it would overflow right
      const wouldOverflowRight = triggerRect.left + effectiveWidth > containerBounds.right - VIEWPORT_PADDING;
      if (wouldOverflowRight) {
        // Shift left to fit
        const overflow = (triggerRect.left + effectiveWidth) - (containerBounds.right - VIEWPORT_PADDING);
        styles.left = -overflow;
      } else {
        styles.left = 0;
      }
      styles.right = 'auto';
    } else if (horizontalAlign === 'right') {
      // Check if it would overflow left
      const wouldOverflowLeft = triggerRect.right - effectiveWidth < containerBounds.left + VIEWPORT_PADDING;
      if (wouldOverflowLeft) {
        // Shift right to fit
        const overflow = (containerBounds.left + VIEWPORT_PADDING) - (triggerRect.right - effectiveWidth);
        styles.right = -overflow;
      } else {
        styles.right = 0;
      }
      styles.left = 'auto';
    } else {
      // Center - calculate offset from trigger position to center
      const triggerCenterX = triggerRect.left + (triggerRect.width / 2);
      const popoverLeft = triggerCenterX - (effectiveWidth / 2);
      const clampedLeft = Math.max(
        containerBounds.left + VIEWPORT_PADDING,
        Math.min(popoverLeft, containerBounds.right - effectiveWidth - VIEWPORT_PADDING)
      );
      styles.left = clampedLeft - triggerRect.left;
      styles.right = 'auto';
    }

    // Vertical positioning
    if (verticalAlign === 'bottom') {
      styles.top = '100%';
      styles.bottom = 'auto';
      styles.marginTop = POPOVER_OFFSET;
    } else {
      styles.bottom = '100%';
      styles.top = 'auto';
      styles.marginBottom = POPOVER_OFFSET;
    }

    setPosition({
      styles,
      maxWidth: effectiveWidth,
    });
  }, []);

  // Recalculate on open, resize, scroll
  useEffect(() => {
    if (!isOpen) return;

    // Calculate immediately
    calculatePosition();

    // Recalculate after a frame to get accurate popover dimensions
    const rafId = requestAnimationFrame(calculatePosition);

    const handleResize = () => calculatePosition();
    const handleScroll = () => calculatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, calculatePosition]);

  return { triggerRef, popoverRef, position };
}

// ============================================================================
// Component
// ============================================================================

export function MicroAiAction({
  actionType,
  label,
  icon,
  size = 'sm',
  className = '',
  onResult,
}: MicroAiActionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { currentMetadata, currentPage, currentContextType } = useOptionChain();

  const { triggerRef, popoverRef, position } = useAutoPosition(showPopover);

  const config = ACTION_CONFIG[actionType];
  const displayLabel = label || config.label;
  const displayIcon = icon || config.icon;

  // Smart Tile button styles - compact, inviting appearance
  const sizeClasses = {
    xs: 'text-xs px-1.5 py-1 gap-1',
    sm: 'text-xs px-2 py-1.5 gap-1.5',
    md: 'text-sm px-2.5 py-2 gap-2',
  };

  const handleClick = useCallback(async () => {
    if (!currentMetadata) {
      setResult('No data available for analysis.');
      setShowPopover(true);
      return;
    }

    setIsLoading(true);
    setShowPopover(true);
    setResult(null);

    try {
      const response = await fetch('/api/copilotkit/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: currentPage,
          contextType: currentContextType,
          metadata: currentMetadata,
          microAction: {
            type: actionType,
            prompt: config.prompt,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const resultText = data.response || data.summary || 'Analysis complete.';
      setResult(resultText);
      onResult?.(resultText);
    } catch (error) {
      console.error('Micro AI action error:', error);
      setResult('Unable to analyze. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentMetadata, currentPage, currentContextType, actionType, config.prompt, onResult]);

  const handleClose = useCallback(() => {
    setShowPopover(false);
  }, []);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        onClick={handleClick}
        disabled={isLoading}
        className={`
          inline-flex items-center rounded-lg font-medium
          bg-white border border-gray-200 shadow-sm
          text-gray-700
          hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md
          active:scale-[0.98]
          transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm
          ${sizeClasses[size]}
          ${className}
        `}
        title={`AI: ${displayLabel}`}
      >
        {isLoading ? (
          <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin flex-shrink-0" />
        ) : (
          <span className="flex-shrink-0">{displayIcon}</span>
        )}
        <span className="truncate">{displayLabel}</span>
      </button>

      {/* Popover Result */}
      {showPopover && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
          />
          {/* Popover with auto-positioning */}
          <div
            ref={popoverRef}
            style={position.styles}
            className="z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-1.5 text-primary-700 font-medium text-sm">
                <span>{displayIcon}</span>
                <span>{displayLabel}</span>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-2 flex-shrink-0"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-gray-700">
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </div>
              ) : (
                <p className="leading-relaxed break-words">{result}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Grouped Actions Component
// ============================================================================

interface MicroActionsGroupProps {
  /** Array of action types to display */
  actions: MicroActionType[];
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Layout direction */
  direction?: 'row' | 'column' | 'grid';
  /** Custom className */
  className?: string;
  /** Show header label */
  showHeader?: boolean;
  /** Custom header label */
  headerLabel?: string;
}

export function MicroActionsGroup({
  actions,
  size = 'xs',
  direction = 'grid',
  className = '',
  showHeader = false,
  headerLabel = 'Recommended Actions',
}: MicroActionsGroupProps) {
  const directionClasses = {
    row: 'flex flex-wrap gap-1.5',
    column: 'flex flex-col gap-1.5',
    grid: 'grid grid-cols-2 gap-1.5',
  };

  return (
    <div className={className}>
      {showHeader && (
        <div className="text-[10px] font-bold text-gray-400 tracking-wider mb-2 uppercase">
          {headerLabel}
        </div>
      )}
      <div className={directionClasses[direction]}>
        {actions.map((action) => (
          <MicroAiAction key={action} actionType={action} size={size} />
        ))}
      </div>
    </div>
  );
}

export default MicroAiAction;
