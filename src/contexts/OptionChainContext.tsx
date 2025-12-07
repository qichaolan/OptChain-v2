'use client';

/**
 * OptionChain Context
 *
 * Provides shared state and context for the OptionChain application.
 * Manages current page, metadata, and AI interaction state.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  PageId,
  ContextType,
  PageMetadata,
  UserSettings,
  ContextEnvelope,
  createContextEnvelope,
} from '@/types';

// ============================================================================
// Context State
// ============================================================================

interface OptionChainState {
  // Current page context
  currentPage: PageId | null;
  currentContextType: ContextType | null;
  currentMetadata: PageMetadata | null;

  // User settings
  settings: UserSettings;

  // AI state
  isAiPanelOpen: boolean;
  isAiLoading: boolean;
  lastAiResponse: any | null;
  lastError: string | null;
}

interface OptionChainActions {
  // Set current context
  setCurrentContext: (
    page: PageId,
    contextType: ContextType,
    metadata: PageMetadata
  ) => void;

  // Clear current context
  clearContext: () => void;

  // Update settings
  updateSettings: (settings: Partial<UserSettings>) => void;

  // AI panel controls
  openAiPanel: () => void;
  closeAiPanel: () => void;
  toggleAiPanel: () => void;

  // Set AI loading state
  setAiLoading: (loading: boolean) => void;

  // Set AI response
  setAiResponse: (response: any) => void;

  // Set error
  setError: (error: string | null) => void;

  // Get current context envelope
  getContextEnvelope: () => ContextEnvelope | null;
}

type OptionChainContextValue = OptionChainState & OptionChainActions;

// ============================================================================
// Context Creation
// ============================================================================

const OptionChainContext = createContext<OptionChainContextValue | undefined>(
  undefined
);

// ============================================================================
// Provider Component
// ============================================================================

interface OptionChainProviderProps {
  children: ReactNode;
}

export function OptionChainProvider({ children }: OptionChainProviderProps) {
  // State
  const [currentPage, setCurrentPage] = useState<PageId | null>(null);
  const [currentContextType, setCurrentContextType] = useState<ContextType | null>(null);
  const [currentMetadata, setCurrentMetadata] = useState<PageMetadata | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isAiLoading, setIsAiLoadingState] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState<any | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Settings with defaults
  const [settings, setSettings] = useState<UserSettings>(() => ({
    theme: typeof window !== 'undefined'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : 'light',
    device: typeof window !== 'undefined'
      ? (window.innerWidth < 768 ? 'mobile' : 'desktop')
      : 'desktop',
    locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
  }));

  // Actions
  const setCurrentContext = useCallback(
    (page: PageId, contextType: ContextType, metadata: PageMetadata) => {
      setCurrentPage(page);
      setCurrentContextType(contextType);
      setCurrentMetadata(metadata);
      setLastError(null);
    },
    []
  );

  const clearContext = useCallback(() => {
    setCurrentPage(null);
    setCurrentContextType(null);
    setCurrentMetadata(null);
    setLastAiResponse(null);
    setLastError(null);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const openAiPanel = useCallback(() => setIsAiPanelOpen(true), []);
  const closeAiPanel = useCallback(() => setIsAiPanelOpen(false), []);
  const toggleAiPanel = useCallback(() => setIsAiPanelOpen((prev) => !prev), []);

  const setAiLoading = useCallback((loading: boolean) => {
    setIsAiLoadingState(loading);
  }, []);

  const setAiResponse = useCallback((response: any) => {
    setLastAiResponse(response);
    setLastError(null);
  }, []);

  const setError = useCallback((error: string | null) => {
    setLastError(error);
  }, []);

  const getContextEnvelope = useCallback((): ContextEnvelope | null => {
    if (!currentPage || !currentContextType || !currentMetadata) {
      return null;
    }

    return createContextEnvelope(
      currentPage,
      currentContextType,
      currentMetadata,
      settings
    );
  }, [currentPage, currentContextType, currentMetadata, settings]);

  // Context value
  const value: OptionChainContextValue = {
    // State
    currentPage,
    currentContextType,
    currentMetadata,
    settings,
    isAiPanelOpen,
    isAiLoading,
    lastAiResponse,
    lastError,

    // Actions
    setCurrentContext,
    clearContext,
    updateSettings,
    openAiPanel,
    closeAiPanel,
    toggleAiPanel,
    setAiLoading,
    setAiResponse,
    setError,
    getContextEnvelope,
  };

  return (
    <OptionChainContext.Provider value={value}>
      {children}
    </OptionChainContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useOptionChain(): OptionChainContextValue {
  const context = useContext(OptionChainContext);

  if (context === undefined) {
    throw new Error('useOptionChain must be used within an OptionChainProvider');
  }

  return context;
}

export default OptionChainProvider;
