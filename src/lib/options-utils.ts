/**
 * Options Chain Utility Functions
 *
 * Utility functions for options chain analysis, including
 * ATM strike calculation and related helpers.
 */

/**
 * Find the ATM (At-The-Money) strike price.
 * Returns the strike price closest to the underlying price.
 *
 * @param allStrikes - Array of available strike prices (sorted)
 * @param underlyingPrice - Current price of the underlying asset
 * @returns The strike price closest to underlying, or null if no strikes available
 */
export function findAtmStrike(
  allStrikes: number[],
  underlyingPrice: number | undefined | null
): number | null {
  // Return null if no strikes or no valid underlying price
  if (allStrikes.length === 0 || !underlyingPrice) {
    return null;
  }

  // Find the strike closest to the underlying price
  return allStrikes.reduce((closest, strike) =>
    Math.abs(strike - underlyingPrice) < Math.abs(closest - underlyingPrice)
      ? strike
      : closest
  );
}

/**
 * Check if a given strike is the ATM strike
 *
 * @param strike - The strike price to check
 * @param atmStrike - The calculated ATM strike
 * @returns True if the strike is the ATM strike
 */
export function isAtmStrike(strike: number, atmStrike: number | null): boolean {
  return atmStrike !== null && strike === atmStrike;
}

// =============================================================================
// OI Mirror Chart Types and Transformation
// =============================================================================

/**
 * Data point for OI Mirror Bar Chart
 * - callOI is negative (bars extend left)
 * - putOI is positive (bars extend right)
 */
export interface OiMirrorDataPoint {
  strike: number;
  callOI: number; // negative value (for left extension)
  putOI: number;  // positive value (for right extension)
}

/**
 * Simple option contract interface for OI transformation
 */
export interface SimpleOptionContract {
  strike: number;
  openInterest: number;
}

/**
 * Transform call and put options data into OI Mirror Bar Chart format.
 *
 * - Merges calls and puts by strike price
 * - Converts call OI to negative values (bars extend left)
 * - Keeps put OI as positive values (bars extend right)
 * - Sets missing side to 0
 * - Sorts by strike price ascending
 *
 * @param calls - Array of call options with strike and openInterest
 * @param puts - Array of put options with strike and openInterest
 * @returns Array of OiMirrorDataPoint sorted by strike ascending
 */
export function transformOiChartData(
  calls: SimpleOptionContract[],
  puts: SimpleOptionContract[]
): OiMirrorDataPoint[] {
  // Handle empty inputs
  if ((!calls || calls.length === 0) && (!puts || puts.length === 0)) {
    return [];
  }

  // Build a map keyed by strike
  const strikeMap = new Map<number, OiMirrorDataPoint>();

  // Process calls - store as negative values
  if (calls) {
    for (const call of calls) {
      const existing = strikeMap.get(call.strike);
      if (existing) {
        existing.callOI = -(call.openInterest || 0);
      } else {
        strikeMap.set(call.strike, {
          strike: call.strike,
          callOI: -(call.openInterest || 0),
          putOI: 0,
        });
      }
    }
  }

  // Process puts - store as positive values
  if (puts) {
    for (const put of puts) {
      const existing = strikeMap.get(put.strike);
      if (existing) {
        existing.putOI = put.openInterest || 0;
      } else {
        strikeMap.set(put.strike, {
          strike: put.strike,
          callOI: 0,
          putOI: put.openInterest || 0,
        });
      }
    }
  }

  // Convert to array and sort by strike ascending
  return Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
}

/**
 * Get the maximum absolute OI value from the chart data.
 * Used for scaling the chart axes symmetrically.
 *
 * @param data - Array of OiMirrorDataPoint
 * @returns Maximum absolute OI value
 */
export function getMaxAbsoluteOi(data: OiMirrorDataPoint[]): number {
  if (!data || data.length === 0) {
    return 0;
  }

  let maxOi = 0;
  for (const point of data) {
    maxOi = Math.max(maxOi, Math.abs(point.callOI), point.putOI);
  }
  return maxOi;
}

// =============================================================================
// OI Chart Data Filtering (for condensed view)
// =============================================================================

export interface FilterOiDataOptions {
  /** Number of top call strikes by OI to include (default: 12) */
  topCallStrikes?: number;
  /** Number of top put strikes by OI to include (default: 12) */
  topPutStrikes?: number;
  /** Number of strikes around ATM to include (default: 6, meaning ±6 strikes) */
  atmBandStrikes?: number;
  /** Minimum OI threshold as fraction of max OI (default: 0.03 = 3%) */
  oiThreshold?: number;
  /** Maximum number of strikes to display (default: 35) */
  maxStrikes?: number;
  /** Current underlying price for ATM calculation */
  underlyingPrice?: number;
}

/**
 * Filter OI chart data to show only meaningful strikes.
 * Includes:
 * - Top N strikes by call OI
 * - Top N strikes by put OI
 * - ATM band (strikes within range of underlying price)
 * - Strikes above OI threshold (percentage of max OI)
 *
 * @param data - Full OI chart data
 * @param options - Filtering options
 * @returns Filtered and sorted OI chart data
 */
export function filterOiChartData(
  data: OiMirrorDataPoint[],
  options: FilterOiDataOptions = {}
): OiMirrorDataPoint[] {
  if (!data || data.length === 0) {
    return [];
  }

  const {
    topCallStrikes = 12,
    topPutStrikes = 12,
    atmBandStrikes = 6,
    oiThreshold = 0.03,
    maxStrikes = 35,
    underlyingPrice,
  } = options;

  // Calculate max OI for threshold
  const maxOi = getMaxAbsoluteOi(data);
  const thresholdValue = maxOi * oiThreshold;

  // Find ATM index
  let atmIndex = -1;
  if (underlyingPrice) {
    let minDiff = Infinity;
    for (let i = 0; i < data.length; i++) {
      const diff = Math.abs(data[i].strike - underlyingPrice);
      if (diff < minDiff) {
        minDiff = diff;
        atmIndex = i;
      }
    }
  }

  // Collect strikes to include (use Set for deduplication)
  const includedStrikes = new Set<number>();

  // 1. Add top call strikes by OI
  const sortedByCallOi = [...data].sort(
    (a, b) => Math.abs(b.callOI) - Math.abs(a.callOI)
  );
  for (let i = 0; i < Math.min(topCallStrikes, sortedByCallOi.length); i++) {
    if (Math.abs(sortedByCallOi[i].callOI) > 0) {
      includedStrikes.add(sortedByCallOi[i].strike);
    }
  }

  // 2. Add top put strikes by OI
  const sortedByPutOi = [...data].sort((a, b) => b.putOI - a.putOI);
  for (let i = 0; i < Math.min(topPutStrikes, sortedByPutOi.length); i++) {
    if (sortedByPutOi[i].putOI > 0) {
      includedStrikes.add(sortedByPutOi[i].strike);
    }
  }

  // 3. Add ATM band strikes
  if (atmIndex >= 0) {
    const startIdx = Math.max(0, atmIndex - atmBandStrikes);
    const endIdx = Math.min(data.length - 1, atmIndex + atmBandStrikes);
    for (let i = startIdx; i <= endIdx; i++) {
      includedStrikes.add(data[i].strike);
    }
  }

  // 4. Add strikes above OI threshold
  for (const point of data) {
    const totalOi = Math.abs(point.callOI) + point.putOI;
    if (totalOi >= thresholdValue) {
      includedStrikes.add(point.strike);
    }
  }

  // Filter data to included strikes
  let filteredData = data.filter((point) => includedStrikes.has(point.strike));

  // Cap to maxStrikes if needed (prioritize strikes near ATM)
  if (filteredData.length > maxStrikes && atmIndex >= 0) {
    const atmStrike = data[atmIndex].strike;
    // Sort by distance from ATM
    filteredData.sort(
      (a, b) => Math.abs(a.strike - atmStrike) - Math.abs(b.strike - atmStrike)
    );
    filteredData = filteredData.slice(0, maxStrikes);
  }

  // Sort by strike ascending
  return filteredData.sort((a, b) => a.strike - b.strike);
}

// =============================================================================
// Premium Calculation Utilities
// =============================================================================

/**
 * Option contract with pricing data for premium calculation
 */
export interface PremiumOptionContract {
  bid: number;
  ask: number;
  lastPrice: number;
  openInterest: number;
}

/**
 * Result of total premium calculation
 */
export interface PremiumSummary {
  callPremium: number | null;  // null if no valid data
  putPremium: number | null;   // null if no valid data
  higherSide: 'calls' | 'puts' | 'equal' | null;  // null if neither calculable
}

/**
 * Get the best available premium price for a contract.
 * Priority: mid (bid+ask)/2 > lastPrice
 * Returns null if no valid price available.
 *
 * @param contract - Option contract with pricing data
 * @returns Premium price or null
 */
export function getContractPremium(contract: PremiumOptionContract): number | null {
  // Try mid price first (requires both bid and ask > 0)
  if (contract.bid > 0 && contract.ask > 0) {
    return (contract.bid + contract.ask) / 2;
  }
  // Fall back to last price
  if (contract.lastPrice > 0) {
    return contract.lastPrice;
  }
  return null;
}

/**
 * Calculate total premium for a list of option contracts.
 * Formula: sum(premium * openInterest * 100)
 *
 * @param contracts - Array of option contracts
 * @returns Total premium or null if no valid contracts
 */
export function calculateTotalPremium(contracts: PremiumOptionContract[]): number | null {
  if (!contracts || contracts.length === 0) {
    return null;
  }

  let total = 0;
  let hasValidContract = false;

  for (const contract of contracts) {
    const premium = getContractPremium(contract);
    const oi = contract.openInterest || 0;

    if (premium !== null && oi > 0) {
      total += premium * oi * 100;
      hasValidContract = true;
    }
  }

  return hasValidContract ? total : null;
}

/**
 * Calculate premium summary for calls and puts.
 *
 * @param calls - Array of call option contracts
 * @param puts - Array of put option contracts
 * @returns Premium summary with totals and which side is higher
 */
export function calculatePremiumSummary(
  calls: PremiumOptionContract[],
  puts: PremiumOptionContract[]
): PremiumSummary {
  const callPremium = calculateTotalPremium(calls);
  const putPremium = calculateTotalPremium(puts);

  let higherSide: 'calls' | 'puts' | 'equal' | null = null;

  if (callPremium !== null && putPremium !== null) {
    if (callPremium > putPremium) {
      higherSide = 'calls';
    } else if (putPremium > callPremium) {
      higherSide = 'puts';
    } else {
      higherSide = 'equal';
    }
  } else if (callPremium !== null) {
    higherSide = 'calls';
  } else if (putPremium !== null) {
    higherSide = 'puts';
  }

  return { callPremium, putPremium, higherSide };
}

/**
 * Format a number in compact notation (K/M/B).
 *
 * @param value - Number to format
 * @returns Formatted string like "$1.2M" or "$500K"
 */
export function formatCompactCurrency(value: number): string {
  const absValue = Math.abs(value);

  if (absValue >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  }
  if (absValue >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  if (absValue >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}
