import React, { useState, useId } from 'react';
import type { DailyMovementBucket } from '../../lib/reconciliation/analytics';
import { formatPaise } from '../../lib/money';
import { useCountUp } from '../../lib/animation/useCountUp';

interface DailyMovementChartProps {
  data: DailyMovementBucket[];
}

export const DailyMovementChart: React.FC<DailyMovementChartProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartId = useId();
  const animProgressRaw = useCountUp(100, { duration: 700 });
  const animProgress = animProgressRaw / 100;

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-[#F9FAF8] border border-[#DDE3DA] rounded-xl text-xs text-[#6B7280]">
        No daily movement data available for the active period.
      </div>
    );
  }

  // Dimensions
  const svgWidth = 680;
  const svgHeight = 220;
  const padding = { top: 20, right: 20, bottom: 35, left: 55 };
  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Find max value for Y axis (either inflow or outflow)
  const maxPaise = Math.max(
    ...data.map((d) => Math.max(d.bankInflowPaise, d.bankOutflowPaise)),
    1000000 // minimum 10k baseline
  );

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1.0].map((fraction) => {
    const value = Math.round(maxPaise * fraction);
    const yPos = padding.top + innerHeight - fraction * innerHeight;
    return { value, yPos };
  });

  // Bar width and spacing
  const step = innerWidth / data.length;
  const barWidth = Math.max(2, Math.min(8, step * 0.35));

  const hoveredBucket = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="bg-white border border-[#DDE3DA] rounded-xl p-4 md:p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
            <span>Daily Cash Movements</span>
            <span className="text-[11px] font-normal text-[#6B7280] font-mono">
              ({data.length} active transaction dates)
            </span>
          </h3>
          <p className="text-[11px] text-[#6B7280]">
            Inflows (credits) vs outflows (debits) across the reconciliation window
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#17845B]" />
            <span className="text-[#4B5563] text-[11px] font-medium">Inflows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#D75E4C]" />
            <span className="text-[#4B5563] text-[11px] font-medium">Outflows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#2563EB]" />
            <span className="text-[#4B5563] text-[11px] font-medium">Net</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-56 select-none"
          role="img"
          aria-label="Daily Inflow and Outflow Cash Movements Chart"
        >
          <defs>
            <linearGradient id={`${chartId}-inflow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#17845B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#17845B" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id={`${chartId}-outflow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D75E4C" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#D75E4C" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y-axis labels */}
          {yTicks.map(({ value, yPos }) => (
            <g key={yPos}>
              <line
                x1={padding.left}
                y1={yPos}
                x2={svgWidth - padding.right}
                y2={yPos}
                stroke="#EEF1EB"
                strokeDasharray={yPos === padding.top + innerHeight ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={yPos + 3.5}
                textAnchor="end"
                className="text-[9px] fill-[#9CA3AF] font-mono"
              >
                {value >= 10000000
                  ? `₹${(value / 10000000).toFixed(1)}L`
                  : value >= 100000
                  ? `₹${(value / 100000).toFixed(0)}k`
                  : `₹${value / 100}`}
              </text>
            </g>
          ))}

          {/* Bars and hover hit areas */}
          {data.map((d, idx) => {
            const centerX = padding.left + idx * step + step / 2;
            const fullInflowHeight = (d.bankInflowPaise / maxPaise) * innerHeight;
            const fullOutflowHeight = (d.bankOutflowPaise / maxPaise) * innerHeight;
            const currentInflowHeight = fullInflowHeight * animProgress;
            const currentOutflowHeight = fullOutflowHeight * animProgress;
            const baseLine = padding.top + innerHeight;

            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={d.date}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Invisible hover trigger column */}
                <rect
                  x={padding.left + idx * step}
                  y={padding.top}
                  width={step}
                  height={innerHeight}
                  fill={isHovered ? 'rgba(37, 99, 235, 0.05)' : 'transparent'}
                />

                {/* Inflow Bar */}
                {d.bankInflowPaise > 0 && (
                  <rect
                    x={centerX - barWidth - 1}
                    y={baseLine - currentInflowHeight}
                    width={barWidth}
                    height={Math.max(1, currentInflowHeight)}
                    rx="1.5"
                    fill={`url(#${chartId}-inflow)`}
                    opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
                  />
                )}

                {/* Outflow Bar */}
                {d.bankOutflowPaise > 0 && (
                  <rect
                    x={centerX + 1}
                    y={baseLine - currentOutflowHeight}
                    width={barWidth}
                    height={Math.max(1, currentOutflowHeight)}
                    rx="1.5"
                    fill={`url(#${chartId}-outflow)`}
                    opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
                  />
                )}

                {/* X Axis Date Label (Sample every 3-4 days to avoid clutter) */}
                {(idx % Math.ceil(data.length / 8) === 0 || idx === data.length - 1) && (
                  <text
                    x={centerX}
                    y={baseLine + 16}
                    textAnchor="middle"
                    className="text-[9px] fill-[#6B7280] font-mono"
                  >
                    {d.displayDate}
                  </text>
                )}
              </g>
            );
          })}

          {/* Net position connecting path drawn progressively */}
          {data.length > 1 && (
            <polyline
              fill="none"
              stroke="#2563EB"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.75"
              points={data
                .slice(0, Math.max(2, Math.ceil(data.length * animProgress)))
                .map((d, idx) => {
                  const cx = padding.left + idx * step + step / 2;
                  // Map net to vertical position (clamped)
                  const normalized = Math.max(0, Math.min(maxPaise, Math.abs(d.netBankPaise)));
                  const cy = padding.top + innerHeight - (normalized / maxPaise) * innerHeight;
                  return `${cx},${cy}`;
                })
                .join(' ')}
            />
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredBucket && (
          <div
            className="absolute top-2 right-2 sm:right-auto sm:top-2 pointer-events-none bg-[#101A2B] text-white text-xs rounded-lg p-2.5 shadow-lg border border-slate-700 font-sans z-10 space-y-1 transition-all"
            style={{
              left: hoveredIndex !== null && hoveredIndex < data.length / 2 ? undefined : undefined,
            }}
          >
            <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
              <span>{hoveredBucket.displayDate} ({hoveredBucket.date})</span>
              <span className="font-mono text-[10px] text-slate-400">
                {hoveredBucket.bankCount + hoveredBucket.ledgerCount} items
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-[#34D399] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                Inflows:
              </span>
              <span className="font-mono font-medium">{formatPaise(hoveredBucket.bankInflowPaise)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-[#F87171] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                Outflows:
              </span>
              <span className="font-mono font-medium">{formatPaise(hoveredBucket.bankOutflowPaise)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[11px] pt-1 border-t border-slate-800">
              <span className="text-slate-400">Net Day:</span>
              <span className={`font-mono font-semibold ${hoveredBucket.netBankPaise >= 0 ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
                {formatPaise(hoveredBucket.netBankPaise, { showSign: true })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

