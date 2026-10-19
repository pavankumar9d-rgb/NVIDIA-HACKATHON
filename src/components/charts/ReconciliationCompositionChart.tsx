import React, { useState } from 'react';
import type { CompositionSegment } from '../../lib/reconciliation/analytics';
import { formatPaise } from '../../lib/money';
import { useCountUp } from '../../lib/animation/useCountUp';

interface ReconciliationCompositionChartProps {
  segments: CompositionSegment[];
  onSelectFilter?: (filterType: string) => void;
  activeFilter?: string;
}

export const ReconciliationCompositionChart: React.FC<ReconciliationCompositionChartProps> = ({
  segments,
  onSelectFilter,
  activeFilter,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const animProgressRaw = useCountUp(100, { duration: 700 });
  const animProgress = animProgressRaw / 100;

  const totalCount = segments.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="bg-white border border-[#DDE3DA] rounded-xl p-4 md:p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
            <span>Reconciliation Composition</span>
            <span className="text-[11px] font-normal text-[#6B7280] font-mono">
              ({totalCount} items evaluated)
            </span>
          </h3>
          <p className="text-[11px] text-[#6B7280]">
            Proportion of confirmed matches versus pending exception categories (distinct from row match rate)
          </p>
        </div>

        {activeFilter && (
          <button
            type="button"
            onClick={() => onSelectFilter?.('ALL')}
            className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] font-medium underline self-start sm:self-auto cursor-pointer"
          >
            Clear Filter ({activeFilter})
          </button>
        )}
      </div>

      {/* Multi-segment horizontal bar */}
      <div 
        className="w-full h-7 rounded-lg overflow-hidden flex bg-[#EEF1EB] p-0.5 gap-0.5 border border-[#DDE3DA]"
        role="progressbar"
        aria-label="Reconciliation match and exception breakdown"
      >
        {segments.map((seg) => {
          const finalWidthPct = Math.max(seg.percentage, seg.count > 0 ? 3 : 0);
          const widthPct = finalWidthPct * animProgress;
          const isHovered = hoveredKey === seg.key;
          const isSelected = activeFilter === seg.filterType;

          return (
            <button
              key={seg.key}
              type="button"
              onClick={() => seg.filterType && onSelectFilter?.(seg.filterType)}
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`h-full transition-all duration-150 relative cursor-pointer first:rounded-l-md last:rounded-r-md ${
                isSelected ? 'ring-2 ring-offset-1 ring-[#111827] z-10' : ''
              }`}
              style={{
                width: `${widthPct}%`,
                backgroundColor: isHovered ? seg.hoverColor : seg.color,
                opacity: hoveredKey === null || isHovered || isSelected ? 1 : 0.6,
              }}
              title={`${seg.label}: ${seg.count} (${seg.percentage}%)`}
              aria-label={`${seg.label}: ${seg.count} (${seg.percentage}%)`}
            />
          );
        })}
      </div>

      {/* Detailed Segment Legend Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {segments.map((seg) => {
          const isHovered = hoveredKey === seg.key;
          const isSelected = activeFilter === seg.filterType;

          return (
            <button
              key={seg.key}
              type="button"
              onClick={() => seg.filterType && onSelectFilter?.(seg.filterType)}
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#111827] bg-[#F9FAF8] shadow-2xs'
                  : isHovered
                  ? 'border-[#BDC8B7] bg-[#F9FAF8]'
                  : 'border-[#EEF1EB] bg-white hover:border-[#DDE3DA]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-medium mb-1">
                <span className="flex items-center gap-1.5 text-[#111827] truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="truncate text-[11px] font-semibold">{seg.label}</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-[#4B5563]">
                  {seg.percentage}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                <span>{seg.count} {seg.key === 'CONFIRMED' ? 'pairs' : 'cases'}</span>
                {seg.volumePaise > 0 && (
                  <span className="font-mono text-[10px] text-[#9CA3AF]">
                    {formatPaise(seg.volumePaise)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

