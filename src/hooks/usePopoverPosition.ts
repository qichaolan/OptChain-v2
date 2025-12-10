/**
 * usePopoverPosition Hook
 *
 * A reusable hook for calculating optimal popover position.
 * Automatically adjusts placement to avoid viewport overflow.
 *
 * Features:
 * - Horizontal flip (left/right) when overflowing
 * - Vertical flip (top/bottom) when overflowing
 * - Responsive max-width based on available space
 * - Works with scrollable containers
 */

import { useState, useCallback, useRef, useEffect, RefObject } from 'react';

// ============================================================================
// Types
// ============================================================================

export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface PopoverPosition {
  /** Horizontal placement: 'left' or 'right' */
  horizontal: 'left' | 'right';
  /** Vertical placement: 'top' or 'bottom' */
  vertical: 'top' | 'bottom';
  /** CSS styles to apply to the popover */
  styles: React.CSSProperties;
  /** Maximum width available for the popover */
  maxWidth: number;
}

export interface UsePopoverPositionOptions {
  /** Preferred initial placement */
  preferredPlacement?: PopoverPlacement;
  /** Padding from viewport edges in pixels */
  viewportPadding?: number;
  /** Gap between trigger and popover in pixels */
  offset?: number;
  /** Fixed popover width (if not provided, will be responsive) */
  popoverWidth?: number;
  /** Container element ref to constrain within (defaults to viewport) */
  containerRef?: RefObject<HTMLElement>;
}

export interface UsePopoverPositionReturn {
  /** Ref to attach to the trigger element */
  triggerRef: RefObject<HTMLButtonElement>;
  /** Ref to attach to the popover element */
  popoverRef: RefObject<HTMLDivElement>;
  /** Current position state */
  position: PopoverPosition;
  /** Recalculate position (call when popover opens) */
  updatePosition: () => void;
  /** Whether the popover is currently visible */
  isOpen: boolean;
  /** Open the popover */
  open: () => void;
  /** Close the popover */
  close: () => void;
  /** Toggle the popover */
  toggle: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_VIEWPORT_PADDING = 8;
const DEFAULT_OFFSET = 4;
const DEFAULT_POPOVER_WIDTH = 280;
const MOBILE_BREAKPOINT = 640;

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePopoverPosition(
  options: UsePopoverPositionOptions = {}
): UsePopoverPositionReturn {
  const {
    preferredPlacement = 'bottom-start',
    viewportPadding = DEFAULT_VIEWPORT_PADDING,
    offset = DEFAULT_OFFSET,
    popoverWidth = DEFAULT_POPOVER_WIDTH,
    containerRef,
  } = options;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({
    horizontal: preferredPlacement.includes('start') ? 'left' : 'right',
    vertical: preferredPlacement.includes('top') ? 'top' : 'bottom',
    styles: {},
    maxWidth: popoverWidth,
  });

  const calculatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();

    // Get container bounds (viewport or custom container)
    let containerBounds: DOMRect;
    if (containerRef?.current) {
      containerBounds = containerRef.current.getBoundingClientRect();
    } else {
      containerBounds = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    }

    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;

    // Calculate available space in each direction
    const spaceRight = containerBounds.right - triggerRect.left - viewportPadding;
    const spaceLeft = triggerRect.right - containerBounds.left - viewportPadding;
    const spaceBelow = containerBounds.bottom - triggerRect.bottom - viewportPadding - offset;
    const spaceAbove = triggerRect.top - containerBounds.top - viewportPadding - offset;

    // Determine effective popover width
    const availableWidth = Math.max(spaceRight, spaceLeft);
    let effectiveWidth: number;

    if (isMobile) {
      // On mobile, use full container width minus padding
      effectiveWidth = containerBounds.width - (viewportPadding * 2);
    } else {
      effectiveWidth = Math.min(popoverWidth, availableWidth);
    }

    // Determine horizontal placement
    let horizontal: 'left' | 'right';
    const preferRight = preferredPlacement.includes('start');

    if (preferRight) {
      // Prefer aligning to left edge of trigger
      horizontal = spaceRight >= effectiveWidth ? 'left' : 'right';
    } else {
      // Prefer aligning to right edge of trigger
      horizontal = spaceLeft >= effectiveWidth ? 'right' : 'left';
    }

    // Determine vertical placement
    let vertical: 'top' | 'bottom';
    const preferBelow = preferredPlacement.includes('bottom');

    if (preferBelow) {
      vertical = spaceBelow >= 100 ? 'bottom' : 'top';
    } else {
      vertical = spaceAbove >= 100 ? 'top' : 'bottom';
    }

    // Calculate CSS styles
    const styles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 50,
    };

    // Horizontal positioning
    if (isMobile) {
      // Center on mobile or align to container
      const leftOffset = containerBounds.left - triggerRect.left + viewportPadding;
      styles.left = leftOffset;
      styles.right = 'auto';
      styles.width = effectiveWidth;
    } else if (horizontal === 'left') {
      styles.left = 0;
      styles.right = 'auto';
    } else {
      styles.right = 0;
      styles.left = 'auto';
    }

    // Vertical positioning
    if (vertical === 'bottom') {
      styles.top = '100%';
      styles.bottom = 'auto';
      styles.marginTop = offset;
    } else {
      styles.bottom = '100%';
      styles.top = 'auto';
      styles.marginBottom = offset;
    }

    setPosition({
      horizontal,
      vertical,
      styles,
      maxWidth: effectiveWidth,
    });
  }, [preferredPlacement, viewportPadding, offset, popoverWidth, containerRef]);

  const updatePosition = useCallback(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  const open = useCallback(() => {
    setIsOpen(true);
    // Calculate position on next frame after popover is visible
    requestAnimationFrame(calculatePosition);
  }, [calculatePosition]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Recalculate on resize or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => calculatePosition();
    const handleScroll = () => calculatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    // Initial calculation
    calculatePosition();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, calculatePosition]);

  return {
    triggerRef,
    popoverRef,
    position,
    updatePosition,
    isOpen,
    open,
    close,
    toggle,
  };
}

export default usePopoverPosition;
