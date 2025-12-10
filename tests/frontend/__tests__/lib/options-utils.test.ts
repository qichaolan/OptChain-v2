/**
 * Unit tests for Options Utility Functions
 *
 * Test Scenarios for findAtmStrike:
 * 1. Strike price exactly matches underlying price
 * 2. Strike price slightly above/below the underlying price
 * 3. Strike price far above/below the underlying price
 * 4. Edge cases (empty array, null underlying, etc.)
 *
 * Coverage Target: 100% line and branch coverage
 */

import { describe, it, expect } from 'vitest';
import { findAtmStrike, isAtmStrike } from '@/lib/options-utils';

// ============================================================================
// Test findAtmStrike - Exact Match
// ============================================================================

describe('findAtmStrike - Exact Match', () => {
  it('should return exact strike when underlying price matches a strike exactly', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 450;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(450);
  });

  it('should return exact strike at the beginning of the array', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 440;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(440);
  });

  it('should return exact strike at the end of the array', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 460;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(460);
  });

  it('should work with decimal prices that match exactly', () => {
    const strikes = [449.5, 450.0, 450.5, 451.0];
    const underlyingPrice = 450.5;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(450.5);
  });
});

// ============================================================================
// Test findAtmStrike - Slightly Above/Below
// ============================================================================

describe('findAtmStrike - Slightly Above/Below Underlying', () => {
  it('should return closest strike when underlying is slightly below a strike', () => {
    // Underlying at 449.90, closest strike is 450
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 449.9;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(450);
  });

  it('should return closest strike when underlying is slightly above a strike', () => {
    // Underlying at 450.10, closest strike is 450
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 450.1;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(450);
  });

  it('should return lower strike when underlying is closer to lower', () => {
    // Underlying at 452.0, distance to 450 is 2, distance to 455 is 3
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 452.0;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(450);
  });

  it('should return upper strike when underlying is closer to upper', () => {
    // Underlying at 453.0, distance to 450 is 3, distance to 455 is 2
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 453.0;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(455);
  });

  it('should return lower strike when exactly in between (reduce behavior)', () => {
    // Underlying at 452.5, equidistant from 450 and 455
    // reduce() will keep the first closest found (450)
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 452.5;

    const result = findAtmStrike(strikes, underlyingPrice);

    // When equidistant, reduce keeps the first one it found that's closest
    expect(result).toBe(450);
  });

  it('should handle small decimal differences correctly', () => {
    // Underlying at 450.24, should pick 450.25 over 450.00
    const strikes = [450.0, 450.25, 450.50, 450.75, 451.0];
    const underlyingPrice = 450.24;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(450.25);
  });

  it('should handle stock split scenario with small strikes', () => {
    // Low-priced stock like after split
    const strikes = [10, 11, 12, 13, 14, 15];
    const underlyingPrice = 12.3;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(12);
  });
});

// ============================================================================
// Test findAtmStrike - Far Above/Below
// ============================================================================

describe('findAtmStrike - Far Above/Below Underlying', () => {
  it('should return lowest strike when underlying is far below all strikes', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 400; // Far below

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(440); // Returns closest, which is the lowest
  });

  it('should return highest strike when underlying is far above all strikes', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 500; // Far above

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(460); // Returns closest, which is the highest
  });

  it('should work with large price differences', () => {
    const strikes = [100, 110, 120, 130, 140];
    const underlyingPrice = 1000; // Much higher than any strike

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(140);
  });

  it('should work with very low underlying vs high strikes', () => {
    const strikes = [500, 510, 520, 530, 540];
    const underlyingPrice = 50; // Much lower than any strike

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(500);
  });

  it('should handle high-priced stocks correctly', () => {
    // Tesla-like scenario with wide strike spreads
    const strikes = [200, 210, 220, 230, 240, 250];
    const underlyingPrice = 175; // Far below the lowest strike

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(200);
  });

  it('should handle index options with large values', () => {
    // SPX-like scenario
    const strikes = [4400, 4425, 4450, 4475, 4500];
    const underlyingPrice = 4600; // Above all strikes

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(4500);
  });
});

// ============================================================================
// Test findAtmStrike - Edge Cases
// ============================================================================

describe('findAtmStrike - Edge Cases', () => {
  it('should return null for empty strikes array', () => {
    const strikes: number[] = [];
    const underlyingPrice = 450;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBeNull();
  });

  it('should return null when underlying price is undefined', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = undefined;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBeNull();
  });

  it('should return null when underlying price is null', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = null;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBeNull();
  });

  it('should return null when underlying price is 0', () => {
    const strikes = [440, 445, 450, 455, 460];
    const underlyingPrice = 0;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBeNull();
  });

  it('should work with single strike in array', () => {
    const strikes = [450];
    const underlyingPrice = 100;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(450);
  });

  it('should work with two strikes in array', () => {
    const strikes = [440, 460];
    const underlyingPrice = 455;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(460); // 455 is 5 away from 460, 15 away from 440
  });

  it('should handle unsorted strikes array', () => {
    // The function should still work even if strikes are not sorted
    const strikes = [455, 440, 460, 445, 450];
    const underlyingPrice = 447;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(445); // 447 is closest to 445
  });

  it('should handle negative numbers (not realistic but edge case)', () => {
    const strikes = [-10, -5, 0, 5, 10];
    const underlyingPrice = -3;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(-5);
  });

  it('should handle very small floating point differences', () => {
    const strikes = [100.001, 100.002, 100.003];
    const underlyingPrice = 100.0015;

    const result = findAtmStrike(strikes, underlyingPrice);

    // 100.0015 is 0.0005 from 100.001 and 0.0005 from 100.002
    // reduce keeps first found, which is 100.001
    expect(result).toBe(100.001);
  });
});

// ============================================================================
// Test findAtmStrike - Real World Scenarios
// ============================================================================

describe('findAtmStrike - Real World Scenarios', () => {
  it('should work with SPY-like options chain', () => {
    // SPY trading at 450.50 with $1 strike intervals
    const strikes = [445, 446, 447, 448, 449, 450, 451, 452, 453, 454, 455];
    const underlyingPrice = 450.5;

    const result = findAtmStrike(strikes, underlyingPrice);

    // 450.5 is equidistant from 450 and 451, reduce keeps 450
    expect(result).toBe(450);
  });

  it('should work with AAPL-like options chain with $2.50 intervals', () => {
    const strikes = [170, 172.5, 175, 177.5, 180, 182.5, 185];
    const underlyingPrice = 178;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(177.5); // 178 is 0.5 from 177.5, 2 from 180
  });

  it('should work with TSLA-like volatility scenario', () => {
    // Wide strike intervals for volatile stock
    const strikes = [200, 205, 210, 215, 220, 225, 230];
    const underlyingPrice = 212.5;

    const result = findAtmStrike(strikes, underlyingPrice);

    // 212.5 is equidistant from 210 and 215, reduce keeps 210
    expect(result).toBe(210);
  });

  it('should work with weekly options having tight strikes', () => {
    // Weekly options with $0.50 intervals
    const strikes = [449.5, 450.0, 450.5, 451.0, 451.5];
    const underlyingPrice = 450.25;

    const result = findAtmStrike(strikes, underlyingPrice);

    // 450.25 is equidistant from 450.0 and 450.5, reduce keeps 450.0
    expect(result).toBe(450.0);
  });

  it('should work with penny stock options', () => {
    const strikes = [1, 1.5, 2, 2.5, 3, 3.5, 4];
    const underlyingPrice = 2.75;

    const result = findAtmStrike(strikes, underlyingPrice);

    expect(result).toBe(2.5); // Closest to 2.75
  });
});

// ============================================================================
// Test isAtmStrike helper function
// ============================================================================

describe('isAtmStrike', () => {
  it('should return true when strike matches ATM strike', () => {
    expect(isAtmStrike(450, 450)).toBe(true);
  });

  it('should return false when strike does not match ATM strike', () => {
    expect(isAtmStrike(440, 450)).toBe(false);
  });

  it('should return false when ATM strike is null', () => {
    expect(isAtmStrike(450, null)).toBe(false);
  });

  it('should handle decimal strikes correctly', () => {
    expect(isAtmStrike(450.5, 450.5)).toBe(true);
    expect(isAtmStrike(450.5, 450.0)).toBe(false);
  });
});
