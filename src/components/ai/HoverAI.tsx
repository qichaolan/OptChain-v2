'use client';

/**
 * HoverAI Component
 *
 * Hover/Tap triggered AI tooltips for metric explanations.
 * Desktop: shows tooltip after ~300ms hover
 * Mobile: shows tooltip on tap
 * Uses CopilotKit micro-action system with result caching.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useOptionChain } from '@/contexts';
import type { MicroActionType } from './MicroAiAction';

// ============================================================================
// Types
// ============================================================================

interface HoverAIProps {
  /** The micro-action type to trigger */
  action: MicroActionType;
  /** Custom metadata to pass (merged with context metadata) */
  metadata?: Record<string, unknown>;
  /** Children to wrap (the metric display) */
  children: React.ReactNode;
  /** Optional cache key suffix for unique caching */
  cacheKey?: string;
  /** Hover delay in ms (default: 300) */
  hoverDelay?: number;
  /** Disable the hover trigger */
  disabled?: boolean;
  /** Custom className for the wrapper */
  className?: string;
}

interface PopoverPosition {
  styles: React.CSSProperties;
  maxWidth: number;
}

// ============================================================================
// Constants
// ============================================================================

const VIEWPORT_PADDING = 12;
const POPOVER_OFFSET = 8;
const DEFAULT_POPOVER_WIDTH = 280;
const MOBILE_BREAKPOINT = 640;
const DEFAULT_HOVER_DELAY = 300;

// ============================================================================
// Cache for AI responses (per session)
// ============================================================================

const responseCache = new Map<string, string>();

function getCacheKey(action: MicroActionType, metadata: Record<string, unknown>, suffix?: string): string {
  // Create a stable cache key from action + relevant metadata
  const metaStr = JSON.stringify({
    symbol: metadata.symbol,
    strike: metadata.strike,
    expiration: metadata.expiration,
    contractType: metadata.contractType,
    metricType: metadata.metricType,
    metricValue: metadata.metricValue,
  });
  return `${action}:${metaStr}${suffix ? `:${suffix}` : ''}`;
}

// ============================================================================
// Action Labels and Icons
// ============================================================================

const ACTION_DISPLAY: Record<string, { label: string; icon: string }> = {
  'metric.explain_iv': { label: 'IV Explained', icon: '📈' },
  'metric.explain_score': { label: 'Score Explained', icon: '🎯' },
  'metric.explain_dte': { label: 'DTE Explained', icon: '📅' },
  'credit_spread.explain_delta': { label: 'Delta Explained', icon: '∆' },
  'credit_spread.explain_theta': { label: 'Theta Explained', icon: '⏰' },
  'leaps.explain_breakeven': { label: 'Breakeven Explained', icon: '📍' },
  'leaps.explain_leverage': { label: 'Leverage Explained', icon: '📈' },
  'leaps.highlight_risks': { label: 'Risk Analysis', icon: '⚠️' },
  'iron_condor.analyze_skew': { label: 'Skew Analysis', icon: '📊' },
  'roi.analyze_value': { label: 'ROI Analysis', icon: '💰' },
  'generic.explain_section': { label: 'AI Insight', icon: '💡' },
};

function getActionDisplay(action: MicroActionType): { label: string; icon: string } {
  return ACTION_DISPLAY[action] || { label: 'AI Insight', icon: '✨' };
}

// ============================================================================
// useAutoPosition Hook (adapted from MicroAiAction)
// ============================================================================

function useAutoPosition(isOpen: boolean, triggerRef: React.RefObject<HTMLElement | null>) {
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

    // Find the scrollable parent
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

    // Calculate available space
    const spaceBelow = containerBounds.bottom - triggerRect.bottom - VIEWPORT_PADDING - POPOVER_OFFSET;
    const spaceAbove = triggerRect.top - containerBounds.top - VIEWPORT_PADDING - POPOVER_OFFSET;
    const spaceRight = containerBounds.right - triggerRect.left - VIEWPORT_PADDING;
    const spaceLeft = triggerRect.right - containerBounds.left - VIEWPORT_PADDING;

    // Calculate effective width
    const containerWidth = containerBounds.right - containerBounds.left;
    let effectiveWidth: number;

    if (isMobile) {
      effectiveWidth = containerWidth - (VIEWPORT_PADDING * 2);
    } else {
      effectiveWidth = Math.min(DEFAULT_POPOVER_WIDTH, Math.max(spaceRight, spaceLeft));
    }

    // Determine vertical placement
    const popoverHeight = popover?.offsetHeight || 100;
    let verticalAlign: 'top' | 'bottom';
    if (spaceBelow >= popoverHeight) {
      verticalAlign = 'bottom';
    } else if (spaceAbove >= popoverHeight) {
      verticalAlign = 'top';
    } else {
      verticalAlign = spaceBelow >= spaceAbove ? 'bottom' : 'top';
    }

    // Calculate styles
    const styles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 50,
      maxWidth: effectiveWidth,
      width: isMobile ? effectiveWidth : 'auto',
      minWidth: Math.min(240, effectiveWidth),
    };

    // Horizontal positioning - center on trigger
    if (isMobile) {
      const triggerLeftInContainer = triggerRect.left - containerBounds.left;
      styles.left = -triggerLeftInContainer + VIEWPORT_PADDING;
      styles.right = 'auto';
    } else {
      // Center relative to trigger
      const triggerCenterX = triggerRect.width / 2;
      const popoverHalfWidth = effectiveWidth / 2;
      let leftOffset = triggerCenterX - popoverHalfWidth;

      // Clamp to viewport
      const absoluteLeft = triggerRect.left + leftOffset;
      if (absoluteLeft < containerBounds.left + VIEWPORT_PADDING) {
        leftOffset = containerBounds.left + VIEWPORT_PADDING - triggerRect.left;
      } else if (absoluteLeft + effectiveWidth > containerBounds.right - VIEWPORT_PADDING) {
        leftOffset = containerBounds.right - VIEWPORT_PADDING - effectiveWidth - triggerRect.left;
      }

      styles.left = leftOffset;
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

    setPosition({ styles, maxWidth: effectiveWidth });
  }, [triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    calculatePosition();
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

  return { popoverRef, position };
}

// ============================================================================
// Component
// ============================================================================

export function HoverAI({
  action,
  metadata: customMetadata,
  children,
  cacheKey,
  hoverDelay = DEFAULT_HOVER_DELAY,
  disabled = false,
  className = '',
}: HoverAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTouchDevice = useRef(false);

  const { currentMetadata, currentPage, currentContextType } = useOptionChain();
  const { popoverRef, position } = useAutoPosition(isOpen, triggerRef);

  const display = getActionDisplay(action);

  // Merge metadata
  const mergedMetadata = useMemo(() => ({
    ...currentMetadata,
    ...customMetadata,
  }), [currentMetadata, customMetadata]);

  // Check cache for existing result
  const cachedResult = useMemo(() => {
    const key = getCacheKey(action, mergedMetadata, cacheKey);
    return responseCache.get(key);
  }, [action, mergedMetadata, cacheKey]);

  // Fetch AI explanation
  const fetchExplanation = useCallback(async () => {
    const key = getCacheKey(action, mergedMetadata, cacheKey);

    // Check cache first
    const cached = responseCache.get(key);
    if (cached) {
      setResult(cached);
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/copilotkit/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: currentPage,
          contextType: currentContextType,
          metadata: mergedMetadata,
          microAction: {
            type: action,
            prompt: '', // System will use the action-specific prompt
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const resultText = data.response || data.summary || 'Analysis complete.';

      // Cache the result
      responseCache.set(key, resultText);
      setResult(resultText);
    } catch (error) {
      console.error('HoverAI error:', error);
      setResult('Unable to analyze. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [action, mergedMetadata, cacheKey, currentPage, currentContextType]);

  // Handle mouse enter (desktop)
  const handleMouseEnter = useCallback(() => {
    if (disabled || isTouchDevice.current) return;

    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
      if (!cachedResult) {
        fetchExplanation();
      } else {
        setResult(cachedResult);
      }
    }, hoverDelay);
  }, [disabled, hoverDelay, cachedResult, fetchExplanation]);

  // Handle mouse leave (desktop)
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOpen(false);
  }, []);

  // Handle touch start (mobile)
  const handleTouchStart = useCallback(() => {
    isTouchDevice.current = true;
  }, []);

  // Handle tap (mobile)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;

    // Only handle as tap on touch devices
    if (!isTouchDevice.current) return;

    e.preventDefault();
    e.stopPropagation();

    if (isOpen) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
      if (!cachedResult) {
        fetchExplanation();
      } else {
        setResult(cachedResult);
      }
    }
  }, [disabled, isOpen, cachedResult, fetchExplanation]);

  // Close popover
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <span
      ref={triggerRef}
      className={`relative inline-block ${disabled ? '' : 'cursor-help'} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
    >
      {/* Wrapped children with subtle indicator */}
      <span className={disabled ? '' : 'border-b border-dotted border-gray-400'}>
        {children}
      </span>

      {/* Tooltip Popover */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          {isTouchDevice.current && (
            <div
              className="fixed inset-0 z-40"
              onClick={handleClose}
            />
          )}

          {/* Popover */}
          <div
            ref={popoverRef}
            style={position.styles}
            className="z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 animate-in fade-in zoom-in-95 duration-150"
            onMouseEnter={() => !isTouchDevice.current && setIsOpen(true)}
            onMouseLeave={() => !isTouchDevice.current && handleMouseLeave()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-primary-700 font-medium text-xs">
                <span>{display.icon}</span>
                <span>{display.label}</span>
              </div>
              {isTouchDevice.current && (
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 text-sm leading-none ml-2"
                >
                  ×
                </button>
              )}
            </div>

            {/* Content */}
            <div className="text-xs text-gray-700 leading-relaxed">
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-500 py-1">
                  <div className="w-3 h-3 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </div>
              ) : (
                <p className="break-words">{result || cachedResult}</p>
              )}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

export default HoverAI;
