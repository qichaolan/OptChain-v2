/**
 * Unit tests for Chain Analysis page
 *
 * Test Scenarios:
 * - Page rendering
 * - TickerInput: validation, input handling, keyboard submit
 * - ExpirationDropdown: selection, lazy loading
 * - FilterButtons: filter selection
 * - OptionsTable: strike display
 * - State management and error handling
 *
 * Coverage Target: >= 90% line and branch coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock useOptionChain context
const mockSetCurrentContext = vi.fn();
const mockClearContext = vi.fn();
vi.mock('@/contexts', () => ({
  useOptionChain: () => ({
    setCurrentContext: mockSetCurrentContext,
    clearContext: mockClearContext,
    currentMetadata: null,
  }),
}));

// Mock InlineAiInsights
vi.mock('@/components/ai', () => ({
  InlineAiInsights: () => <div data-testid="ai-insights">AI Insights Panel</div>,
}));

// Import page after mocks
import ChainAnalysisPage from '@/app/chain-analysis/page';

// ============================================================================
// Mock Data
// ============================================================================

const mockExpirationResponse = {
  symbol: 'SPY',
  underlying_price: 450.5,
  expirations: ['2024-01-19', '2024-01-26', '2024-02-16', '2024-03-15'],
  timestamp: '2024-01-10T10:00:00Z',
};

const mockOptionsChainResponse = {
  symbol: 'SPY',
  underlying_price: 450.5,
  expiration: '2024-01-19',
  dte: 9,
  calls: [
    {
      contract_symbol: 'SPY240119C00440000',
      option_type: 'call',
      strike: 440,
      expiration: '2024-01-19',
      last_price: 12.5,
      bid: 12.3,
      ask: 12.7,
      volume: 1500,
      open_interest: 5000,
      implied_volatility: 0.18,
      delta: 0.75,
      gamma: 0.02,
      theta: -0.15,
      vega: 0.12,
    },
    {
      contract_symbol: 'SPY240119C00450000',
      option_type: 'call',
      strike: 450,
      expiration: '2024-01-19',
      last_price: 5.2,
      bid: 5.0,
      ask: 5.4,
      volume: 2500,
      open_interest: 8000,
      implied_volatility: 0.16,
      delta: 0.52,
      gamma: 0.04,
      theta: -0.18,
      vega: 0.14,
    },
  ],
  puts: [
    {
      contract_symbol: 'SPY240119P00440000',
      option_type: 'put',
      strike: 440,
      expiration: '2024-01-19',
      last_price: 1.5,
      bid: 1.4,
      ask: 1.6,
      volume: 1000,
      open_interest: 4000,
      implied_volatility: 0.17,
      delta: -0.22,
      gamma: 0.02,
      theta: -0.10,
      vega: 0.09,
    },
  ],
  total_calls: 2,
  total_puts: 1,
  timestamp: '2024-01-10T10:00:00Z',
};

// ============================================================================
// Helper Functions
// ============================================================================

function setupFetchMocks() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/api/chain/expirations/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockExpirationResponse),
      });
    }
    if (url.includes('/api/chain/options/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockOptionsChainResponse),
      });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
}

/**
 * Helper to trigger expiration fetch by pressing Enter on the ticker input
 * This replaces the removed Search button functionality
 */
function triggerExpirationFetch(input: HTMLElement) {
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
}

// ============================================================================
// Test Page Rendering
// ============================================================================

describe('ChainAnalysisPage - Initial Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should render page header', () => {
    render(<ChainAnalysisPage />);
    expect(screen.getByText('Options Chain Analysis')).toBeInTheDocument();
  });

  it('should render ticker input', () => {
    render(<ChainAnalysisPage />);
    expect(screen.getByPlaceholderText('SPY')).toBeInTheDocument();
  });

  it('should render ticker input with helper text', () => {
    render(<ChainAnalysisPage />);
    expect(screen.getByText(/enter a ticker symbol to load expiration dates/i)).toBeInTheDocument();
  });

  it('should render expiration dropdown', () => {
    render(<ChainAnalysisPage />);
    expect(screen.getByText('Expiration Date')).toBeInTheDocument();
  });

  it('should render fetch chain button', () => {
    render(<ChainAnalysisPage />);
    expect(screen.getByRole('button', { name: /fetch chain/i })).toBeInTheDocument();
  });

  it('should render empty state initially', () => {
    render(<ChainAnalysisPage />);
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });
});

// ============================================================================
// Test Ticker Input
// ============================================================================

describe('ChainAnalysisPage - Ticker Input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should convert input to uppercase', async () => {
    render(<ChainAnalysisPage />);
    const input = screen.getByPlaceholderText('SPY');

    fireEvent.change(input, { target: { value: 'aapl' } });
    expect(input).toHaveValue('AAPL');
  });

  it('should filter non-alphabetic characters', async () => {
    render(<ChainAnalysisPage />);
    const input = screen.getByPlaceholderText('SPY');

    fireEvent.change(input, { target: { value: 'spy123' } });
    expect(input).toHaveValue('SPY');
  });

  it('should not trigger fetch on Enter for empty input', async () => {
    render(<ChainAnalysisPage />);
    const input = screen.getByPlaceholderText('SPY');

    fireEvent.keyDown(input, { key: 'Enter' });

    // Fetch should not be called for empty input
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should trigger fetch on Enter for valid ticker', async () => {
    render(<ChainAnalysisPage />);
    const input = screen.getByPlaceholderText('SPY');

    fireEvent.change(input, { target: { value: 'SPY' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/chain/expirations/SPY'));
    });
  });

  it('should trigger fetch on blur for valid ticker', async () => {
    render(<ChainAnalysisPage />);
    const input = screen.getByPlaceholderText('SPY');

    fireEvent.change(input, { target: { value: 'SPY' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/chain/expirations/SPY'));
    });
  });
});

// ============================================================================
// Test Expiration Fetching
// ============================================================================

describe('ChainAnalysisPage - Expiration Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should fetch expirations on Enter', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });
    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/chain/expirations/SPY'));
    });
  });

  it('should display underlying price after fetch', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });
    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('$450.50')).toBeInTheDocument();
    });
  });

  it('should clear context when fetching new ticker', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });
    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(mockClearContext).toHaveBeenCalled();
    });
  });

  it('should handle API error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Not found' }),
    });

    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'BAD' } });
    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getAllByText('Not found').length).toBeGreaterThan(0);
    });
  });

  it('should handle network error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });
    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getAllByText('Network error').length).toBeGreaterThan(0);
    });
  });

  it('should handle empty expirations', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockExpirationResponse,
        expirations: [],
      }),
    });

    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });
    triggerExpirationFetch(input);

    await waitFor(() => {
      // Error appears in both the input section and the main content area
      const errorMessages = screen.getAllByText('No expiry dates available for this stock.');
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============================================================================
// Test Expiration Dropdown
// ============================================================================

describe('ChainAnalysisPage - Expiration Dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should be disabled initially', () => {
    render(<ChainAnalysisPage />);
    const dropdown = screen.getByText('Select expiration...');
    expect(dropdown.closest('button')).toBeDisabled();
  });

  it('should show expiration dates when clicked', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('$450.50')).toBeInTheDocument();
    });

    const dropdown = screen.getByText('Select expiration...');
    fireEvent.click(dropdown);

    await waitFor(() => {
      expect(screen.getByText('Jan 19, 2024')).toBeInTheDocument();
    });
  });

  it('should select expiration date', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      expect(screen.getByText('Jan 19, 2024')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jan 19, 2024'));

    await waitFor(() => {
      expect(screen.queryByText('Select expiration...')).not.toBeInTheDocument();
    });
  });

  it('should close dropdown when clicking outside', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      expect(screen.getByText('Jan 19, 2024')).toBeInTheDocument();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Jan 19, 2024')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Test Options Chain Fetching
// ============================================================================

describe('ChainAnalysisPage - Options Chain Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should fetch chain when clicking Fetch Chain button', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      expect(screen.getByText('Jan 19, 2024')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Jan 19, 2024'));

    fireEvent.click(screen.getByRole('button', { name: /fetch chain/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chain/options/SPY/2024-01-19')
      );
    });
  });

  it('should display options table after fetching chain', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Jan 19, 2024'));
    });

    fireEvent.click(screen.getByRole('button', { name: /fetch chain/i }));

    await waitFor(() => {
      expect(screen.getByText('Options Chain')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Test Filter Buttons
// ============================================================================

describe('ChainAnalysisPage - Filter Buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  async function loadOptionsChain() {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Jan 19, 2024'));
    });

    fireEvent.click(screen.getByRole('button', { name: /fetch chain/i }));

    await waitFor(() => {
      expect(screen.getByText('Options Chain')).toBeInTheDocument();
    });
  }

  it('should show Both filter selected by default', async () => {
    await loadOptionsChain();
    const bothBtn = screen.getByRole('button', { name: 'Both' });
    expect(bothBtn).toHaveClass('bg-blue-600');
  });

  it('should filter to Calls only', async () => {
    await loadOptionsChain();
    const callsBtn = screen.getByRole('button', { name: 'Calls' });
    fireEvent.click(callsBtn);

    expect(callsBtn).toHaveClass('bg-green-600');
  });

  it('should filter to Puts only', async () => {
    await loadOptionsChain();
    const putsBtn = screen.getByRole('button', { name: 'Puts' });
    fireEvent.click(putsBtn);

    expect(putsBtn).toHaveClass('bg-red-600');
  });
});

// ============================================================================
// Test Options Table Display
// ============================================================================

describe('ChainAnalysisPage - Options Table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  async function loadOptionsChain() {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Jan 19, 2024'));
    });

    fireEvent.click(screen.getByRole('button', { name: /fetch chain/i }));

    await waitFor(() => {
      expect(screen.getByText('Options Chain')).toBeInTheDocument();
    });
  }

  it('should display strike prices', async () => {
    await loadOptionsChain();
    expect(screen.getByText('$440.00')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
  });

  it('should display option prices', async () => {
    await loadOptionsChain();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  it('should select option on click', async () => {
    await loadOptionsChain();

    const priceCell = screen.getByText('$12.50');
    fireEvent.click(priceCell);

    await waitFor(() => {
      expect(mockSetCurrentContext).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Test Mobile Responsiveness
// ============================================================================

describe('ChainAnalysisPage - Mobile Responsiveness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should detect mobile viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 375,
    });

    window.dispatchEvent(new Event('resize'));

    render(<ChainAnalysisPage />);
    expect(screen.getByText('Options Chain Analysis')).toBeInTheDocument();
  });

  it('should detect desktop viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1200,
    });

    window.dispatchEvent(new Event('resize'));

    render(<ChainAnalysisPage />);
    expect(screen.getByText('Options Chain Analysis')).toBeInTheDocument();
  });
});

// ============================================================================
// Test Lazy Loading
// ============================================================================

describe('ChainAnalysisPage - Lazy Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const manyExpirations = Array.from({ length: 50 }, (_, i) => {
      const date = new Date('2024-01-19');
      date.setDate(date.getDate() + i * 7);
      return date.toISOString().split('T')[0];
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockExpirationResponse,
        expirations: manyExpirations,
      }),
    });
  });

  it('should show Load More button when many expirations', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      expect(screen.getByText(/Load More/i)).toBeInTheDocument();
    });
  });

  it('should load more expirations on click', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      expect(screen.getByText(/Load More/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Load More/i));

    await waitFor(() => {
      expect(screen.getByText(/remaining/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Test Context Updates
// ============================================================================

describe('ChainAnalysisPage - Context Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should update context when option is selected', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Jan 19, 2024'));
    });

    fireEvent.click(screen.getByRole('button', { name: /fetch chain/i }));

    await waitFor(() => {
      expect(screen.getByText('Options Chain')).toBeInTheDocument();
    });

    const priceCell = screen.getByText('$12.50');
    fireEvent.click(priceCell);

    await waitFor(() => {
      expect(mockSetCurrentContext).toHaveBeenCalledWith(
        'chain_analysis',
        'chain_analysis',
        expect.objectContaining({
          symbol: 'SPY',
          underlyingPrice: 450.5,
        })
      );
    });
  });
});

// ============================================================================
// Test Formatting Functions
// ============================================================================

describe('ChainAnalysisPage - Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMocks();
  });

  it('should format currency correctly', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('$450.50')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Test Chain Fetch Error
// ============================================================================

describe('ChainAnalysisPage - Chain Fetch Error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/chain/expirations/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExpirationResponse),
        });
      }
      if (url.includes('/api/chain/options/')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ detail: 'Failed to fetch chain' }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('should handle chain fetch error', async () => {
    render(<ChainAnalysisPage />);

    const input = screen.getByPlaceholderText('SPY');
    fireEvent.change(input, { target: { value: 'SPY' } });

    triggerExpirationFetch(input);

    await waitFor(() => {
      expect(screen.getByText('Select expiration...')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Select expiration...'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Jan 19, 2024'));
    });

    fireEvent.click(screen.getByRole('button', { name: /fetch chain/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch chain')).toBeInTheDocument();
    });
  });
});
