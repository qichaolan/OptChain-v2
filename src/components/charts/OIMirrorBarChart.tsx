'use client';

/**
 * OI Mirror Bar Chart (Tornado Chart)
 *
 * Displays Open Interest data as a horizontal bar chart with:
 * - Calls extending to the left (shown as green)
 * - Puts extending to the right (shown as red)
 * - Strike prices on the Y-axis
 * - Open Interest on the X-axis
 * - Condensed view by default (filtered to meaningful strikes)
 */

import React, { useMemo, useState, useCallback, memo } from 'react';
import {
  OiMirrorDataPoint,
  getMaxAbsoluteOi,
  filterOiChartData,
} from '@/lib/options-utils';

// =============================================================================
// Types
// =============================================================================

export type OiChartViewMode = 'condensed' | 'all';

export interface OIMirrorBarChartProps {
  /** Chart data with callOI (negative) and putOI (positive) */
  data: OiMirrorDataPoint[];
  /** Current underlying price for ATM indicator */
  underlyingPrice?: number;
  /** Whether to show in compact mode (mobile) */
  isMobile?: boolean;
  /** Initial view mode (default: condensed) */
  defaultViewMode?: OiChartViewMode;
  /** Hide the view mode toggle */
  hideViewToggle?: boolean;
}

interface TooltipState {
  show: boolean;
  x: number;
  y: number;
  strike: number;
  callOI: number;
  putOI: number;
}

// =============================================================================
// Constants
// =============================================================================

const CHART_PADDING = {
  top: 30,
  bottom: 40,
  left: 70,
  right: 70,
};

const COLORS = {
  call: '#16a34a', // green-600
  callHover: '#15803d', // green-700
  put: '#dc2626', // red-600
  putHover: '#b91c1c', // red-700
  grid: '#e5e7eb', // gray-200
  axis: '#6b7280', // gray-500
  text: '#374151', // gray-700
  atm: '#2563eb', // blue-600
  background: '#ffffff',
};

// Responsive height constraints
const HEIGHT_CONFIG = {
  minHeight: 260,
  maxHeight: 520,
  rowHeight: 12, // Compact row height
  mobileRowHeight: 10,
};

// =============================================================================
// Helper Functions
// =============================================================================

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

const formatCurrency = (val: number): string =>
  `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// =============================================================================
// Component
// =============================================================================

function OIMirrorBarChartComponent({
  data,
  underlyingPrice,
  isMobile = false,
  defaultViewMode = 'condensed',
  hideViewToggle = false,
}: OIMirrorBarChartProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<OiChartViewMode>(defaultViewMode);

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState>({
    show: false,
    x: 0,
    y: 0,
    strike: 0,
    callOI: 0,
    putOI: 0,
  });

  // Filter data based on view mode
  const displayData = useMemo(() => {
    if (viewMode === 'all') {
      return data;
    }
    return filterOiChartData(data, {
      underlyingPrice,
      topCallStrikes: isMobile ? 10 : 12,
      topPutStrikes: isMobile ? 10 : 12,
      atmBandStrikes: isMobile ? 4 : 6,
      maxStrikes: isMobile ? 25 : 35,
    });
  }, [data, viewMode, underlyingPrice, isMobile]);

  // Calculate responsive chart height
  const chartHeight = useMemo(() => {
    const rowHeight = isMobile
      ? HEIGHT_CONFIG.mobileRowHeight
      : HEIGHT_CONFIG.rowHeight;
    const calculatedHeight =
      displayData.length * rowHeight +
      CHART_PADDING.top +
      CHART_PADDING.bottom +
      20; // Extra padding

    return Math.max(
      HEIGHT_CONFIG.minHeight,
      Math.min(HEIGHT_CONFIG.maxHeight, calculatedHeight)
    );
  }, [displayData.length, isMobile]);

  // Calculate chart dimensions
  const chartWidth = isMobile ? 340 : 700;
  const plotWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = chartHeight - CHART_PADDING.top - CHART_PADDING.bottom;

  // Calculate max OI for axis scaling (symmetric)
  const maxOi = useMemo(() => getMaxAbsoluteOi(displayData), [displayData]);

  // Calculate bar height based on data count
  const barHeight = useMemo(() => {
    if (displayData.length === 0) return 0;
    const maxBarHeight = isMobile ? 12 : 14;
    const minBarHeight = 4;
    const calculatedHeight = (plotHeight / displayData.length) * 0.75;
    return Math.min(maxBarHeight, Math.max(minBarHeight, calculatedHeight));
  }, [displayData.length, plotHeight, isMobile]);

  // Find ATM strike index
  const atmIndex = useMemo(() => {
    if (!underlyingPrice || displayData.length === 0) return -1;
    let closestIdx = 0;
    let minDiff = Math.abs(displayData[0].strike - underlyingPrice);
    for (let i = 1; i < displayData.length; i++) {
      const diff = Math.abs(displayData[i].strike - underlyingPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [displayData, underlyingPrice]);

  // Scale functions
  const xScale = useCallback(
    (value: number): number => {
      if (maxOi === 0) return plotWidth / 2;
      return ((value + maxOi) / (2 * maxOi)) * plotWidth;
    },
    [maxOi, plotWidth]
  );

  const yScale = useCallback(
    (index: number): number => {
      if (displayData.length === 0) return 0;
      const spacing = plotHeight / displayData.length;
      return index * spacing + spacing / 2;
    },
    [displayData.length, plotHeight]
  );

  // Generate X-axis ticks
  const xTicks = useMemo(() => {
    if (maxOi === 0) return [0];
    const tickCount = isMobile ? 3 : 5;
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const value = -maxOi + (i * 2 * maxOi) / tickCount;
      ticks.push(value);
    }
    return ticks;
  }, [maxOi, isMobile]);

  // Generate Y-axis labels (show every Nth strike to avoid overlap)
  const yLabels = useMemo(() => {
    if (displayData.length === 0) return [];
    const maxLabels = isMobile ? 10 : 18;
    if (displayData.length <= maxLabels) {
      return displayData.map((d, i) => ({ strike: d.strike, index: i }));
    }
    const step = Math.ceil(displayData.length / maxLabels);
    const labels: { strike: number; index: number }[] = [];
    for (let i = 0; i < displayData.length; i += step) {
      labels.push({ strike: displayData[i].strike, index: i });
    }
    // Always include ATM if visible
    if (atmIndex >= 0 && !labels.find((l) => l.index === atmIndex)) {
      labels.push({ strike: displayData[atmIndex].strike, index: atmIndex });
      labels.sort((a, b) => a.index - b.index);
    }
    return labels;
  }, [displayData, isMobile, atmIndex]);

  // Tooltip handlers
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, point: OiMirrorDataPoint) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top,
        strike: point.strike,
        callOI: Math.abs(point.callOI),
        putOI: point.putOI,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, show: false }));
  }, []);

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No open interest data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Header with Legend and View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: COLORS.call }}
            />
            <span className="text-gray-600">Call OI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: COLORS.put }}
            />
            <span className="text-gray-600">Put OI</span>
          </div>
          {underlyingPrice && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: COLORS.atm }}
              />
              <span className="text-gray-600">
                ATM ${underlyingPrice.toFixed(0)}
              </span>
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        {!hideViewToggle && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('condensed')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'condensed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Condensed
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All ({data.length})
            </button>
          </div>
        )}
      </div>

      {/* Strike count indicator */}
      <div className="text-xs text-gray-400 mb-2">
        Showing {displayData.length} of {data.length} strikes
      </div>

      {/* Chart Container - scrollable when in "all" mode */}
      <div
        className={
          viewMode === 'all' && displayData.length > 40
            ? 'overflow-y-auto max-h-[60vh]'
            : ''
        }
      >
        {/* Chart SVG */}
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="mx-auto block"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width={chartWidth} height={chartHeight} fill={COLORS.background} />

          {/* Chart area group with padding */}
          <g transform={`translate(${CHART_PADDING.left}, ${CHART_PADDING.top})`}>
            {/* Grid lines */}
            {xTicks.map((tick) => (
              <line
                key={`grid-${tick}`}
                x1={xScale(tick)}
                y1={0}
                x2={xScale(tick)}
                y2={plotHeight}
                stroke={COLORS.grid}
                strokeWidth={1}
                strokeDasharray={tick === 0 ? 'none' : '4,4'}
              />
            ))}

            {/* Center line (0 reference) */}
            <line
              x1={xScale(0)}
              y1={0}
              x2={xScale(0)}
              y2={plotHeight}
              stroke={COLORS.axis}
              strokeWidth={1.5}
            />

            {/* ATM strike indicator */}
            {atmIndex >= 0 && (
              <line
                x1={0}
                y1={yScale(atmIndex)}
                x2={plotWidth}
                y2={yScale(atmIndex)}
                stroke={COLORS.atm}
                strokeWidth={1.5}
                strokeDasharray="4,2"
                opacity={0.7}
              />
            )}

            {/* Bars */}
            {displayData.map((point, index) => {
              const y = yScale(index) - barHeight / 2;
              const centerX = xScale(0);
              const isAtm = index === atmIndex;

              // Call bar (extends left from center)
              const callWidth = Math.abs(xScale(point.callOI) - centerX);
              const callX = centerX - callWidth;

              // Put bar (extends right from center)
              const putWidth = xScale(point.putOI) - centerX;

              return (
                <g key={point.strike}>
                  {/* ATM highlight background */}
                  {isAtm && (
                    <rect
                      x={-5}
                      y={y - 1}
                      width={plotWidth + 10}
                      height={barHeight + 2}
                      fill={COLORS.atm}
                      opacity={0.08}
                      rx={1}
                    />
                  )}

                  {/* Call bar */}
                  {callWidth > 0 && (
                    <rect
                      x={callX}
                      y={y}
                      width={callWidth}
                      height={barHeight}
                      fill={COLORS.call}
                      rx={1}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      onMouseEnter={(e) => handleMouseEnter(e, point)}
                      onMouseLeave={handleMouseLeave}
                    />
                  )}

                  {/* Put bar */}
                  {putWidth > 0 && (
                    <rect
                      x={centerX}
                      y={y}
                      width={putWidth}
                      height={barHeight}
                      fill={COLORS.put}
                      rx={1}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      onMouseEnter={(e) => handleMouseEnter(e, point)}
                      onMouseLeave={handleMouseLeave}
                    />
                  )}

                  {/* Invisible hitbox for tooltip on empty bars */}
                  {callWidth === 0 && putWidth === 0 && (
                    <rect
                      x={centerX - 15}
                      y={y}
                      width={30}
                      height={barHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(e, point)}
                      onMouseLeave={handleMouseLeave}
                    />
                  )}
                </g>
              );
            })}

            {/* X-axis labels */}
            {xTicks.map((tick) => (
              <text
                key={`xlabel-${tick}`}
                x={xScale(tick)}
                y={plotHeight + 16}
                textAnchor="middle"
                fill={COLORS.text}
                fontSize={isMobile ? 9 : 10}
              >
                {formatNumber(Math.abs(tick))}
              </text>
            ))}

            {/* X-axis title */}
            <text
              x={plotWidth / 2}
              y={plotHeight + 32}
              textAnchor="middle"
              fill={COLORS.axis}
              fontSize={isMobile ? 9 : 10}
            >
              Open Interest
            </text>

            {/* Y-axis labels (strike prices) */}
            {yLabels.map(({ strike, index }) => (
              <text
                key={`ylabel-${strike}`}
                x={-6}
                y={yScale(index) + 3}
                textAnchor="end"
                fill={index === atmIndex ? COLORS.atm : COLORS.text}
                fontSize={isMobile ? 8 : 9}
                fontWeight={index === atmIndex ? 600 : 400}
              >
                {formatCurrency(strike)}
              </text>
            ))}

            {/* Call/Put labels at top */}
            <text
              x={plotWidth * 0.25}
              y={-8}
              textAnchor="middle"
              fill={COLORS.call}
              fontSize={isMobile ? 10 : 11}
              fontWeight={600}
            >
              CALLS
            </text>
            <text
              x={plotWidth * 0.75}
              y={-8}
              textAnchor="middle"
              fill={COLORS.put}
              fontSize={isMobile ? 10 : 11}
              fontWeight={600}
            >
              PUTS
            </text>
          </g>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold text-gray-900 mb-1">
            Strike: ${tooltip.strike.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-green-600">
            <span
              className="w-2 h-2 rounded"
              style={{ backgroundColor: COLORS.call }}
            />
            Call OI: {formatNumber(tooltip.callOI)}
          </div>
          <div className="flex items-center gap-1.5 text-red-600">
            <span
              className="w-2 h-2 rounded"
              style={{ backgroundColor: COLORS.put }}
            />
            Put OI: {formatNumber(tooltip.putOI)}
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const OIMirrorBarChart = memo(OIMirrorBarChartComponent);

export default OIMirrorBarChart;
