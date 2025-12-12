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
  useEffect,
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
import { AiExplainerContent } from '@/types/ai-response';

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
  lastAiResponse: AiExplainerContent | null;
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
  setAiResponse: (response: AiExplainerContent) => void;

  // Set error
  setError: (error: string | null) => void;

  // Get current context envelope
  getContextEnvelope: () => ContextEnvelope | null;
}

type OptionChainContextValue = OptionChainState & OptionChainActions;

// ============================================================================
// Default Context Value (for SSR/SSG)
// ============================================================================

const defaultContextValue: OptionChainContextValue = {
  // State
  currentPage: null,
  currentContextType: null,
  currentMetadata: null,
  settings: {
    theme: 'light',
    device: 'desktop',
    locale: 'en-US',
  },
  isAiPanelOpen: false,
  isAiLoading: false,
  lastAiResponse: null,
  lastError: null,

  // Actions (no-ops for SSR)
  setCurrentContext: () => {},
  clearContext: () => {},
  updateSettings: () => {},
  openAiPanel: () => {},
  closeAiPanel: () => {},
  toggleAiPanel: () => {},
  setAiLoading: () => {},
  setAiResponse: () => {},
  setError: () => {},
  getContextEnvelope: () => null,
};

// ============================================================================
// Context Creation
// ============================================================================

const OptionChainContext = createContext<OptionChainContextValue>(
  defaultContextValue
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
  const [lastAiResponse, setLastAiResponse] = useState<AiExplainerContent | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Settings with SSR-safe defaults (avoids hydration mismatch)
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'light',
    device: 'desktop',
    locale: 'en-US',
  });

  // Detect client-side settings after mount to avoid hydration mismatch
  useEffect(() => {
    setSettings({
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      device: window.innerWidth < 768 ? 'mobile' : 'desktop',
      locale: navigator.language || 'en-US',
    });
  }, []);

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

  const setAiResponse = useCallback((response: AiExplainerContent) => {
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
  return useContext(OptionChainContext);
}

export default OptionChainProvider;
