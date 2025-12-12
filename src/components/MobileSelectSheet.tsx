'use client';

/**
 * MobileSelectSheet Component
 *
 * A mobile-friendly bottom sheet picker for dropdown selections.
 * On desktop (>=768px), renders as a regular dropdown.
 * On mobile, opens a full-screen bottom sheet with:
 * - Title at the top (13px, medium weight)
 * - Scrollable list of options
 * - Tap outside to dismiss
 * - Swipe down to dismiss
 * - ESC/back button to close
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string; // Optional secondary text (e.g., "45d" for DTE)
}

interface MobileSelectSheetProps {
  /** Label shown above the trigger button */
  label: string;
  /** Title shown at the top of the mobile sheet */
  sheetTitle: string;
  /** Available options */
  options: SelectOption[];
  /** Currently selected value */
  value: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Custom className for the trigger button */
  className?: string;
}

export function MobileSelectSheet({
  label,
  sheetTitle,
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select...',
  className = '',
}: MobileSelectSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle back button (popstate) for mobile
  useEffect(() => {
    if (!isMobile) return;

    const handlePopState = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Push a state so back button can close the sheet
      window.history.pushState({ mobileSheet: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, isMobile]);

  // Swipe down to dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStart;
    // Only allow downward swipe
    if (diff > 0) {
      setTranslateY(diff);
    }
  }, [touchStart]);

  const handleTouchEnd = useCallback(() => {
    // If swiped down more than 100px, close the sheet
    if (translateY > 100) {
      setIsOpen(false);
    }
    setTouchStart(null);
    setTranslateY(0);
  }, [translateY]);

  // Handle option selection
  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    // Go back in history if we pushed a state
    if (isMobile && window.history.state?.mobileSheet) {
      window.history.back();
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      setIsOpen(false);
      if (isMobile && window.history.state?.mobileSheet) {
        window.history.back();
      }
    }
  };

  // Find current selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Desktop: render native select
  if (!isMobile) {
    return (
      <div className={`flex flex-col gap-0.5 ${className}`}>
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 px-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!value && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.sublabel ? ` (${opt.sublabel})` : ''}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Mobile: custom trigger + bottom sheet
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <label className="text-[10px] font-medium text-gray-600">{label}</label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className="h-7 px-1.5 border border-gray-300 rounded-md text-xs bg-white text-left flex items-center justify-between gap-1 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px]"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
          {selectedOption ? (
            <span className="flex items-center gap-1">
              <span className="truncate max-w-[80px]">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-gray-500 text-[10px]">{selectedOption.sublabel}</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div
            ref={backdropRef}
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={handleBackdropClick}
          />

          {/* Sheet */}
          <div
            ref={sheetRef}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh] transition-transform"
            style={{ transform: `translateY(${translateY}px)` }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Title */}
            <div className="px-4 pb-3 border-b border-gray-200">
              <h3 className="text-[13px] font-medium text-gray-900">{sheetTitle}</h3>
            </div>

            {/* Options list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between border-b border-gray-100 active:bg-gray-100 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className={`text-sm ${isSelected ? 'font-semibold text-blue-600' : 'text-gray-900'}`}>
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span className="text-xs text-gray-500">{opt.sublabel}</span>
                      )}
                    </span>
                    {isSelected && (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Cancel button */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (window.history.state?.mobileSheet) {
                    window.history.back();
                  }
                }}
                className="w-full py-3 text-center text-sm font-medium text-gray-600 bg-white rounded-lg border border-gray-300 active:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
