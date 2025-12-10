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
