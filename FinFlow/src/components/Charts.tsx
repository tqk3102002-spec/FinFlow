import React, { useMemo, useState } from 'react';
import type { DonutSlice, MonthlyTrendPoint } from '../types/finance';
import { formatMonthLabel, formatPercent, formatSignedVND, formatVND } from '../lib/accounting';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export const PureSvgDonutChart = React.memo(function PureSvgDonutChart({
  slices,
  centerLabel = 'Tổng cộng',
  emptyText = 'Chưa có dữ liệu thống kê',
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  emptyText?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const normalized = useMemo(() => {
    const valid = (slices || []).filter((s) => Number(s.value) > 0);
    const total = valid.reduce((sum, s) => sum + Number(s.value), 0);
    let cursorAngle = 0;

    const computed = valid.map((s, idx) => {
      const pct = total > 0 ? (Number(s.value) / total) * 100 : 0;
      const sweep = total > 0 ? (Number(s.value) / total) * 360 : 0;
      const startAngle = cursorAngle;
      const endAngle = cursorAngle + sweep;
      cursorAngle = endAngle;
      return { ...s, idx, pct, startAngle, endAngle, sweep };
    });

    return { total, items: computed };
  }, [slices]);

  const activeSlice =
    hoveredIdx !== null && normalized.items[hoveredIdx] ? normalized.items[hoveredIdx] : null;

  if (normalized.total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-36 h-36 rounded-full border-[12px] border-[#EFEDE7] dark:border-[#1C2430] flex items-center justify-center">
          <span className="text-xs font-num font-medium text-[#63625C] dark:text-[#8E98A8]">0 đ</span>
        </div>
        <p className="mt-3 text-xs text-[#63625C] dark:text-[#8E98A8] max-w-xs">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-[192px] h-[192px] shrink-0 select-none">
        <svg viewBox="0 0 220 220" className="w-full h-full overflow-visible">
          {normalized.items.length === 1 ? (
            <circle
              cx="110"
              cy="110"
              r="76"
              fill="none"
              stroke={normalized.items[0].color}
              strokeWidth="26"
              className="aui-donut-slice cursor-pointer"
              style={{
                transform: hoveredIdx === 0 ? 'scale(1.025)' : 'scale(1)',
                transformOrigin: '110px 110px',
              }}
              onMouseEnter={() => setHoveredIdx(0)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ) : (
            normalized.items.map((item) => {
              const isHovered = hoveredIdx === item.idx;
              const isDimmed = hoveredIdx !== null && !isHovered;
              const gap = item.sweep > 3 ? 0.9 : 0;
              const pathD = describeDonutArc(
                110,
                110,
                isHovered ? 95 : 91,
                isHovered ? 61 : 63,
                item.startAngle + gap / 2,
                item.endAngle - gap / 2
              );
              return (
                <path
                  key={`${item.name}-${item.idx}`}
                  d={pathD}
                  fill={item.color}
                  opacity={isDimmed ? 0.35 : 1}
                  className="aui-donut-slice cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(item.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setHoveredIdx((prev) => (prev === item.idx ? null : item.idx))}
                />
              );
            })
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8] truncate max-w-[114px]">
            {activeSlice ? activeSlice.name : centerLabel}
          </span>
          <span className="mt-0.5 text-[15px] font-bold text-[#141413] dark:text-[#ECEBE6] font-num leading-tight">
            {formatVND(activeSlice ? activeSlice.value : normalized.total, true)}
          </span>
          <span
            className="mt-0.5 text-[11px] font-semibold font-num"
            style={{ color: activeSlice ? activeSlice.color : '#8E8C84' }}
          >
            {activeSlice ? formatPercent(activeSlice.pct) : '100%'}
          </span>
        </div>

        {activeSlice && (
          <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 whitespace-nowrap rounded-lg bg-[#141413] dark:bg-[#1C2430] border border-[#2A2A27] dark:border-[#2F3A4C] text-[#F6F5F1] dark:text-[#ECEBE6] px-3 py-1.5 text-[11px] shadow-lg">
            <div className="font-semibold flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-xs"
                style={{ backgroundColor: activeSlice.color }}
              />
              <span>{activeSlice.name}</span>
            </div>
            <div className="text-[#D6D4CC] dark:text-[#B8C0CC] font-num mt-0.5">
              {formatVND(activeSlice.value)} ({formatPercent(activeSlice.pct)})
            </div>
          </div>
        )}
      </div>

      <div className="w-full flex-1 divide-y divide-[#E4E2DB]/70 dark:divide-[#262F3D]/70 max-h-[224px] overflow-y-auto pr-1">
        {normalized.items.map((item) => {
          const isHovered = hoveredIdx === item.idx;
          return (
            <div
              key={`${item.name}-${item.idx}`}
              onMouseEnter={() => setHoveredIdx(item.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx((prev) => (prev === item.idx ? null : item.idx))}
              className={`aui-row px-2.5 py-2 cursor-pointer ${
                isHovered
                  ? 'bg-[#EFEDE7] dark:bg-[#1C2430]'
                  : 'hover:bg-[#F6F5F1] dark:hover:bg-[#1C2430]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 font-num text-xs">
                  <span className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
                    {formatVND(item.value)}
                  </span>
                  <span className="w-[48px] text-right text-[#63625C] dark:text-[#8E98A8]">
                    {formatPercent(item.pct)}
                  </span>
                </div>
              </div>
              {item.metaLine && (
                <div className="mt-0.5 pl-4 text-[11px] text-[#63625C] dark:text-[#8E98A8] flex items-center justify-between gap-2">
                  <span className="truncate">{item.metaLine}</span>
                  {item.pnlValue !== undefined && (
                    <span
                      className={`font-num font-semibold shrink-0 ${
                        item.pnlValue >= 0
                          ? 'text-[#137A4B] dark:text-[#34D399]'
                          : 'text-[#BE123C] dark:text-[#FB7185]'
                      }`}
                    >
                      {item.pnlValue >= 0 ? 'Tăng ' : 'Giảm '}
                      {formatSignedVND(item.pnlValue, true)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ============================================================================
// MULTI-MONTH TREND CHART (PURE SVG 60FPS: CASHFLOW BARS + NET WORTH LINE)
// ============================================================================

export const MultiMonthTrendChart = React.memo(function MultiMonthTrendChart({
  data,
  mode,
  selectedMonth,
  onSelectMonth,
  isDark = false,
}: {
  data: MonthlyTrendPoint[];
  mode: 'CASHFLOW' | 'NET_WORTH';
  selectedMonth: string;
  onSelectMonth?: (ym: string) => void;
  isDark?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const hasAnyValue = useMemo(
    () => data.some((d) => d.income > 0 || d.expense > 0 || d.estimatedNav > 0),
    [data]
  );

  if (!data.length || !hasAnyValue) {
    return (
      <div className="py-10 text-center text-xs text-[#63625C] dark:text-[#8E98A8]">
        Chưa có đủ dữ liệu nhiều tháng để vẽ biểu đồ xu hướng.
      </div>
    );
  }

  const width = 760;
  const height = 240;
  const padLeft = 64;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal =
    mode === 'CASHFLOW'
      ? Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1)
      : Math.max(...data.map((d) => d.estimatedNav), 1);

  const minVal =
    mode === 'NET_WORTH'
      ? Math.max(0, Math.min(...data.map((d) => d.estimatedNav)) * 0.85)
      : 0;
  const rangeVal = Math.max(maxVal - minVal, 1);

  const yPos = (val: number) => padTop + innerH - ((val - minVal) / rangeVal) * innerH;
  const stepX = innerW / data.length;
  const centerX = (idx: number) => padLeft + stepX * idx + stepX / 2;

  const yTicks = [0, 0.33, 0.66, 1].map((t) => minVal + rangeVal * t);

  const navLinePath = data
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${centerX(i).toFixed(1)} ${yPos(pt.estimatedNav).toFixed(1)}`)
    .join(' ');

  const navAreaPath =
    `${navLinePath} L ${centerX(data.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} ` +
    `L ${centerX(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const activeIdx =
    hoveredIdx !== null
      ? hoveredIdx
      : Math.max(
          0,
          data.findIndex((d) => d.month === selectedMonth)
        );
  const activePoint = data[activeIdx] || data[data.length - 1];

  const accentHex = isDark ? '#38B29A' : '#0E5A4F';
  const gridHex = isDark ? '#262F3D' : '#E4E2DB';
  const hoverFillHex = isDark ? '#1C2430' : '#EFEDE7';
  const incomeHex = isDark ? '#34D399' : '#0E5A4F';
  const expenseHex = isDark ? '#FB7185' : '#BE123C';

  return (
    <div className="space-y-3">
      {/* Live contextual inspector strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] border border-[#E4E2DB] dark:border-[#262F3D] text-xs">
        <div className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
          {formatMonthLabel(activePoint.month)}
          {activePoint.month === selectedMonth && (
            <span className="ml-2 text-[11px] font-medium text-[#0E5A4F] dark:text-[#38B29A]">
              · Đang xem
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 font-num">
          <span>
            <span className="text-[#63625C] dark:text-[#8E98A8]">Thu: </span>
            <strong className="text-[#137A4B] dark:text-[#34D399]">
              {formatVND(activePoint.income, true)}
            </strong>
          </span>
          <span>
            <span className="text-[#63625C] dark:text-[#8E98A8]">Chi: </span>
            <strong className="text-[#BE123C] dark:text-[#FB7185]">
              {formatVND(activePoint.expense, true)}
            </strong>
          </span>
          <span>
            <span className="text-[#63625C] dark:text-[#8E98A8]">Ròng: </span>
            <strong
              className={
                activePoint.netCashflow >= 0
                  ? 'text-[#141413] dark:text-[#ECEBE6]'
                  : 'text-[#BE123C] dark:text-[#FB7185]'
              }
            >
              {formatSignedVND(activePoint.netCashflow, true)}
            </strong>
          </span>
          <span>
            <span className="text-[#63625C] dark:text-[#8E98A8]">NAV ước tính: </span>
            <strong className="text-[#0E5A4F] dark:text-[#38B29A]">
              {formatVND(activePoint.estimatedNav, true)}
            </strong>
          </span>
        </div>
      </div>

      {/* Responsive SVG Canvas */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[520px] h-[230px] select-none"
          role="img"
          aria-label="Biểu đồ xu hướng tài sản và thu chi nhiều tháng"
        >
          <defs>
            <linearGradient id="finflowNavGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentHex} stopOpacity={isDark ? '0.24' : '0.16'} />
              <stop offset="100%" stopColor={accentHex} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines + Y labels */}
          {yTicks.map((tick, idx) => {
            const y = yPos(tick);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={gridHex}
                  strokeDasharray={idx === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#63625C] dark:fill-[#8E98A8] text-[10px] font-num"
                >
                  {formatVND(tick, true)}
                </text>
              </g>
            );
          })}

          {mode === 'CASHFLOW' ? (
            <>
              {data.map((pt, idx) => {
                const cx = centerX(idx);
                const barW = Math.min(18, Math.max(8, stepX * 0.28));
                const gap = 3;
                const incY = yPos(pt.income);
                const expY = yPos(pt.expense);
                const baseY = padTop + innerH;
                const isActive = idx === activeIdx;

                return (
                  <g
                    key={pt.month}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectMonth?.(pt.month)}
                  >
                    <rect
                      x={padLeft + stepX * idx + 2}
                      y={padTop}
                      width={Math.max(0, stepX - 4)}
                      height={innerH}
                      rx={4}
                      fill={isActive ? hoverFillHex : 'transparent'}
                    />
                    <rect
                      x={cx - barW - gap / 2}
                      y={incY}
                      width={barW}
                      height={Math.max(2, baseY - incY)}
                      rx={2}
                      fill={incomeHex}
                      opacity={hoveredIdx !== null && !isActive ? 0.42 : 0.94}
                    />
                    <rect
                      x={cx + gap / 2}
                      y={expY}
                      width={barW}
                      height={Math.max(2, baseY - expY)}
                      rx={2}
                      fill={expenseHex}
                      opacity={hoveredIdx !== null && !isActive ? 0.42 : 0.88}
                    />
                    <text
                      x={cx}
                      y={height - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-num ${
                        pt.month === selectedMonth
                          ? 'fill-[#0E5A4F] dark:fill-[#38B29A] font-bold'
                          : 'fill-[#63625C] dark:fill-[#8E98A8]'
                      }`}
                    >
                      {pt.shortLabel}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            <>
              <path d={navAreaPath} fill="url(#finflowNavGrad)" />
              <path
                d={navLinePath}
                fill="none"
                stroke={accentHex}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((pt, idx) => {
                const cx = centerX(idx);
                const cy = yPos(pt.estimatedNav);
                const isActive = idx === activeIdx;
                return (
                  <g
                    key={pt.month}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onSelectMonth?.(pt.month)}
                  >
                    <rect
                      x={padLeft + stepX * idx}
                      y={padTop}
                      width={stepX}
                      height={innerH}
                      fill="transparent"
                    />
                    {isActive && (
                      <line
                        x1={cx}
                        y1={padTop}
                        x2={cx}
                        y2={padTop + innerH}
                        stroke={gridHex}
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isActive ? 5 : 3.2}
                      fill={isActive ? accentHex : isDark ? '#151B23' : '#FFFFFF'}
                      stroke={accentHex}
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={height - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-num ${
                        pt.month === selectedMonth
                          ? 'fill-[#0E5A4F] dark:fill-[#38B29A] font-bold'
                          : 'fill-[#63625C] dark:fill-[#8E98A8]'
                      }`}
                    >
                      {pt.shortLabel}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
        <div className="flex items-center gap-4">
          {mode === 'CASHFLOW' ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#0E5A4F] dark:bg-[#34D399]" />
                Tổng Thu tháng
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#BE123C] dark:bg-[#FB7185]" />
                Tổng Chi tháng
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#0E5A4F] dark:bg-[#38B29A] inline-block" />
              Xu hướng NAV ước tính (neo tại NAV thực tế hiện tại)
            </span>
          )}
        </div>
        <span>Nhấn vào một tháng để xem chi tiết sổ Thu – Chi tháng đó</span>
      </div>
    </div>
  );
});
