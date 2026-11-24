import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Equal,
  Gauge,
  Plus,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GlidingTabs } from './AnimateUI';
import { MultiMonthTrendChart, PureSvgDonutChart } from './Charts';
import type {
  AccountingSummary,
  AssetSubTabId,
  BudgetEvaluation,
  CapitalTransfer,
  CashflowEntry,
  MainTabId,
  MonthlyCashflowSummary,
  MonthlyTrendPoint,
} from '../types/finance';
import {
  computeSpendingForecast,
  formatMonthLabel,
  formatPercent,
  formatSignedVND,
  formatVND,
  getCurrentMonthISO,
  getRecentMonths,
  shiftMonthISO,
} from '../lib/accounting';

interface MonthlyComparisonDatum {
  month: string;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
}

interface MonthlyCapitalFlowDatum {
  month: string;
  label: string;
  fullLabel: string;
  deposit: number;
  withdraw: number;
  netFlow: number;
  cumulativeNet: number;
  transferCount: number;
}

function CapitalFlowTooltip({
  active,
  payload,
  selectedMonth,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyCapitalFlowDatum }>;
  selectedMonth: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const isSelected = item.month === selectedMonth;

  return (
    <div className="bg-white dark:bg-[#151B23] rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[248px]">
      <div className="flex items-center justify-between gap-2 font-semibold text-[#141413] dark:text-[#ECEBE6] border-b border-[#E4E2DB] dark:border-[#262F3D] pb-1">
        <span>{item.fullLabel}</span>
        {isSelected && (
          <span className="text-[11px] font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
            · Đang chọn
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[#63625C] dark:text-[#8E98A8]">
          <span className="w-2 h-2 rounded-[2px] bg-[#0F766E] dark:bg-[#2DD4BF] shrink-0" />
          Tiền nạp vào đầu tư
        </span>
        <strong className="font-num text-[#0F766E] dark:text-[#2DD4BF]">
          {formatVND(item.deposit)}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[#63625C] dark:text-[#8E98A8]">
          <span className="w-2 h-2 rounded-[2px] bg-[#D97706] dark:bg-[#FBBF24] shrink-0" />
          Tiền rút về sinh hoạt
        </span>
        <strong className="font-num text-[#D97706] dark:text-[#FBBF24]">
          {formatVND(item.withdraw)}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#E4E2DB] dark:border-[#262F3D]">
        <span className="text-[#63625C] dark:text-[#8E98A8]">Nạp ròng trong tháng</span>
        <strong
          className={`font-num ${
            item.netFlow > 0
              ? 'text-[#0F766E] dark:text-[#2DD4BF]'
              : item.netFlow < 0
              ? 'text-[#D97706] dark:text-[#FBBF24]'
              : 'text-[#63625C] dark:text-[#8E98A8]'
          }`}
        >
          {item.netFlow === 0 ? '0 đ' : formatSignedVND(item.netFlow)}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[#63625C] dark:text-[#8E98A8]">
          <span className="w-2.5 h-0.5 rounded-full bg-[#2D5B78] dark:bg-[#7EB2D4] shrink-0" />
          Vốn nạp ròng lũy kế
        </span>
        <strong className="font-num text-[#2D5B78] dark:text-[#7EB2D4]">
          {formatVND(item.cumulativeNet)}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-4 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
        <span>Số lệnh nạp / rút</span>
        <span className="font-num font-medium text-[#141413] dark:text-[#ECEBE6]">
          {item.transferCount > 0 ? `${item.transferCount} lệnh` : 'Không phát sinh'}
        </span>
      </div>
    </div>
  );
}

function MonthlyCashflowTooltip({
  active,
  payload,
  selectedMonth,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyComparisonDatum }>;
  selectedMonth: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const isSelected = item.month === selectedMonth;

  return (
    <div className="bg-white dark:bg-[#151B23] rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[232px]">
      <div className="flex items-center justify-between gap-2 font-semibold text-[#141413] dark:text-[#ECEBE6] border-b border-[#E4E2DB] dark:border-[#262F3D] pb-1">
        <span>{item.fullLabel}</span>
        {isSelected && (
          <span className="text-[11px] font-semibold text-[#0E5A4F] dark:text-[#38B29A]">
            · Đang chọn
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[#63625C] dark:text-[#8E98A8]">
          <span className="w-2 h-2 rounded-[2px] bg-[#0E5A4F] dark:bg-[#38B29A] shrink-0" />
          Tổng Thu nhập
        </span>
        <strong className="font-num text-[#137A4B] dark:text-[#34D399]">
          {formatVND(item.income)}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-[#63625C] dark:text-[#8E98A8]">
          <span className="w-2 h-2 rounded-[2px] bg-[#BE123C] dark:bg-[#FB7185] shrink-0" />
          Tổng Chi tiêu
        </span>
        <strong className="font-num text-[#BE123C] dark:text-[#FB7185]">
          {formatVND(item.expense)}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#E4E2DB] dark:border-[#262F3D]">
        <span className="flex items-center gap-1.5 text-[#63625C] dark:text-[#8E98A8]">
          <span className="w-2.5 h-0.5 rounded-full bg-[#B47B2B] dark:bg-[#E2B05E] shrink-0" />
          Chênh lệch ròng
        </span>
        <strong
          className={`font-num ${
            item.net >= 0
              ? 'text-[#141413] dark:text-[#ECEBE6]'
              : 'text-[#BE123C] dark:text-[#FB7185]'
          }`}
        >
          {formatSignedVND(item.net)}
        </strong>
      </div>
      {item.savingsRate !== null && (
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="text-[#63625C] dark:text-[#8E98A8]">Tỷ lệ tiết kiệm</span>
          <strong
            className={`font-num ${
              item.savingsRate >= 20
                ? 'text-[#137A4B] dark:text-[#34D399]'
                : item.savingsRate >= 0
                ? 'text-[#B45309] dark:text-[#FBBF24]'
                : 'text-[#BE123C] dark:text-[#FB7185]'
            }`}
          >
            {formatPercent(item.savingsRate)}
          </strong>
        </div>
      )}
    </div>
  );
}

function MonthlyXAxisTick({
  x = 0,
  y = 0,
  payload,
  selectedLabel,
  isDark,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  selectedLabel: string | null;
  isDark: boolean;
}) {
  const val = String(payload?.value ?? '');
  const isSelected = Boolean(selectedLabel && val === selectedLabel);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="middle"
        fill={
          isSelected
            ? isDark
              ? '#38B29A'
              : '#0E5A4F'
            : isDark
            ? '#8E98A8'
            : '#63625C'
        }
        fontSize={11}
        fontWeight={isSelected ? 700 : 400}
        fontFamily="JetBrains Mono, monospace"
      >
        {val}
      </text>
      {isSelected && (
        <rect
          x={-14}
          y={19}
          width={28}
          height={2}
          rx={1}
          fill={isDark ? '#38B29A' : '#0E5A4F'}
        />
      )}
    </g>
  );
}

export function DashboardTab({
  accounting,
  cashflows,
  transfers = [],
  monthlyCashflow,
  trendPoints,
  trendMonths,
  onChangeTrendMonths,
  budgetEvaluations,
  selectedMonth,
  onChangeMonth,
  onNavigateTab,
  onSelectAssetSubTab,
  onSelectWalletGroup,
  onOpenBudgetModal,
  onOpenTransferModal,
  isDark = false,
  reducedMotion = false,
  tabDirection,
}: {
  accounting: AccountingSummary;
  cashflows: CashflowEntry[];
  transfers?: CapitalTransfer[];
  monthlyCashflow: MonthlyCashflowSummary;
  trendPoints: MonthlyTrendPoint[];
  trendMonths: 6 | 12;
  onChangeTrendMonths: (m: 6 | 12) => void;
  budgetEvaluations: BudgetEvaluation[];
  selectedMonth: string;
  onChangeMonth: (ym: string) => void;
  onNavigateTab: (tab: MainTabId) => void;
  onSelectAssetSubTab: (sub: AssetSubTabId) => void;
  onSelectWalletGroup?: (group: 'LIVING' | 'INVESTMENT') => void;
  onOpenBudgetModal: () => void;
  onOpenTransferModal?: () => void;
  isDark?: boolean;
  reducedMotion?: boolean;
  tabDirection: number;
}) {
  const [assetChartMode, setAssetChartMode] = useState<'COST' | 'MARKET' | 'DETAIL'>('COST');
  const [assetChartDir, setAssetChartDir] = useState(1);
  const [cashflowChartMode, setCashflowChartMode] = useState<'EXPENSE' | 'INCOME' | 'RATIO'>(
    'EXPENSE'
  );
  const [cashflowChartDir, setCashflowChartDir] = useState(1);
  const [trendMode, setTrendMode] = useState<'CASHFLOW' | 'NET_WORTH'>('CASHFLOW');
  const [barRange, setBarRange] = useState<'6' | '12' | 'ALL'>('6');
  const [showNetLine, setShowNetLine] = useState(true);
  const [capitalFlowRange, setCapitalFlowRange] = useState<'6' | '12' | 'ALL'>('6');
  const [showCumulativeNet, setShowCumulativeNet] = useState(true);

  const monthlyCapitalFlowData = useMemo<MonthlyCapitalFlowDatum[]>(() => {
    if (!transfers || transfers.length === 0) return [];

    const grouped = new Map<string, { deposit: number; withdraw: number; count: number }>();
    for (const tr of transfers) {
      if (!tr.date || tr.date.length < 7) continue;
      const ym = tr.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const bucket = grouped.get(ym) || { deposit: 0, withdraw: 0, count: 0 };
      const amt = Math.max(0, Number(tr.amount) || 0);
      if (tr.direction === 'DEPOSIT') bucket.deposit += amt;
      else bucket.withdraw += amt;
      bucket.count += 1;
      grouped.set(ym, bucket);
    }

    const sortedTransferMonths = Array.from(grouped.keys()).sort();
    if (sortedTransferMonths.length === 0) return [];

    const earliestTransferMonth = sortedTransferMonths[0];
    const latestTransferMonth = sortedTransferMonths[sortedTransferMonths.length - 1];
    const currentYm = getCurrentMonthISO();
    const anchorCandidates = [latestTransferMonth, currentYm, selectedMonth].filter((m) =>
      /^\d{4}-\d{2}$/.test(m)
    );
    const anchorEnd = anchorCandidates.sort()[anchorCandidates.length - 1] || currentYm;

    let displayMonths: string[];
    if (capitalFlowRange === 'ALL') {
      displayMonths = [];
      let cursor = earliestTransferMonth;
      let guard = 0;
      while (cursor <= anchorEnd && guard < 600) {
        displayMonths.push(cursor);
        cursor = shiftMonthISO(cursor, 1);
        guard += 1;
      }
      if (displayMonths.length === 0) displayMonths = [anchorEnd];
    } else {
      displayMonths = getRecentMonths(anchorEnd, Number(capitalFlowRange));
    }

    const firstVisibleMonth = displayMonths[0];
    let runningCumulative = 0;
    for (const ym of sortedTransferMonths) {
      if (ym < firstVisibleMonth) {
        const b = grouped.get(ym);
        if (b) runningCumulative += b.deposit - b.withdraw;
      }
    }

    return displayMonths.map((ym) => {
      const [yearStr, monthStr] = ym.split('-');
      const monthNum = parseInt(monthStr, 10);
      const shortYear = yearStr.slice(2);
      const bucket = grouped.get(ym) || { deposit: 0, withdraw: 0, count: 0 };
      const netFlow = bucket.deposit - bucket.withdraw;
      runningCumulative += netFlow;
      return {
        month: ym,
        label: `T${monthNum}/${shortYear}`,
        fullLabel: formatMonthLabel(ym),
        deposit: bucket.deposit,
        withdraw: bucket.withdraw,
        netFlow,
        cumulativeNet: runningCumulative,
        transferCount: bucket.count,
      };
    });
  }, [transfers, capitalFlowRange, selectedMonth]);

  const capitalFlowTotals = useMemo(() => {
    let deposit = 0;
    let withdraw = 0;
    let transferCount = 0;
    for (const d of monthlyCapitalFlowData) {
      deposit += d.deposit;
      withdraw += d.withdraw;
      transferCount += d.transferCount;
    }
    return {
      deposit,
      withdraw,
      netFlow: deposit - withdraw,
      transferCount,
      hasNegativeCumulative: monthlyCapitalFlowData.some((d) => d.cumulativeNet < 0),
    };
  }, [monthlyCapitalFlowData]);

  const selectedCapitalEntry = useMemo(
    () => monthlyCapitalFlowData.find((d) => d.month === selectedMonth) || null,
    [monthlyCapitalFlowData, selectedMonth]
  );
  const hasSelectedInCapitalData = Boolean(selectedCapitalEntry);

  const monthlyBarData = useMemo<MonthlyComparisonDatum[]>(() => {
    const grouped = new Map<string, { income: number; expense: number }>();

    for (const item of cashflows) {
      if (!item.date || item.date.length < 7) continue;
      const ym = item.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) continue;
      const bucket = grouped.get(ym) || { income: 0, expense: 0 };
      const amt = Math.max(0, Number(item.amount) || 0);
      if (item.type === 'INCOME') bucket.income += amt;
      else bucket.expense += amt;
      grouped.set(ym, bucket);
    }

    const sortedMonths = Array.from(grouped.keys()).sort();
    const slicedMonths =
      barRange === 'ALL' ? sortedMonths : sortedMonths.slice(-Number(barRange));

    return slicedMonths.map((ym) => {
      const [yearStr, monthStr] = ym.split('-');
      const monthNum = parseInt(monthStr, 10);
      const shortYear = yearStr.slice(2);
      const bucket = grouped.get(ym) || { income: 0, expense: 0 };
      const net = bucket.income - bucket.expense;
      return {
        month: ym,
        label: `T${monthNum}/${shortYear}`,
        fullLabel: formatMonthLabel(ym),
        income: bucket.income,
        expense: bucket.expense,
        net,
        savingsRate: bucket.income > 0 ? (net / bucket.income) * 100 : null,
      };
    });
  }, [cashflows, barRange]);

  const monthlyBarTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const d of monthlyBarData) {
      income += d.income;
      expense += d.expense;
    }
    const net = income - expense;
    return {
      income,
      expense,
      net,
      savingsRate: income > 0 ? (net / income) * 100 : null,
    };
  }, [monthlyBarData]);

  const selectedBarEntry = useMemo(
    () => monthlyBarData.find((d) => d.month === selectedMonth) || null,
    [monthlyBarData, selectedMonth]
  );
  const hasSelectedInBarData = Boolean(selectedBarEntry);
  const hasNegativeNet = useMemo(
    () => monthlyBarData.some((d) => d.net < 0),
    [monthlyBarData]
  );

  const spendingForecast = useMemo(
    () => computeSpendingForecast(monthlyCashflow, budgetEvaluations, selectedMonth),
    [monthlyCashflow, budgetEvaluations, selectedMonth]
  );

  const forecastByCategory = useMemo(
    () => new Map(spendingForecast.categoryForecasts.map((c) => [c.category, c])),
    [spendingForecast.categoryForecasts]
  );

  const isTotalProfitDown = accounting.totalInvestmentPnLVnd < 0;
  const isRealizedDown = accounting.totalRealizedPnLVnd < 0;
  const isInvCashNegative = accounting.investmentCashVnd < 0;
  const totalCapitalBaseVnd = accounting.netDepositVnd + accounting.ledgerOpeningAdjustmentVnd;
  const totalInvestmentAccountVnd = accounting.investmentCashVnd + accounting.totalInvestedMarketVnd;
  const navBarMaxScale = Math.max(
    Math.max(0, accounting.livingCashVnd) +
      Math.max(0, accounting.investmentCashVnd) +
      Math.max(0, accounting.totalInvestedMarketVnd),
    1
  );
  const exceededCount = budgetEvaluations.filter((b) => b.status === 'EXCEEDED').length;
  const warningCount = budgetEvaluations.filter((b) => b.status === 'WARNING').length;

  const switchAssetChartMode = (nextMode: string) => {
    const typed = nextMode as 'COST' | 'MARKET' | 'DETAIL';
    const order = ['COST', 'MARKET', 'DETAIL'];
    setAssetChartDir(order.indexOf(typed) >= order.indexOf(assetChartMode) ? 1 : -1);
    setAssetChartMode(typed);
  };

  const switchCashflowChartMode = (nextMode: string) => {
    const typed = nextMode as 'EXPENSE' | 'INCOME' | 'RATIO';
    const order = ['EXPENSE', 'INCOME', 'RATIO'];
    setCashflowChartDir(order.indexOf(typed) >= order.indexOf(cashflowChartMode) ? 1 : -1);
    setCashflowChartMode(typed);
  };

  return (
    <div
      key="panel-dashboard"
      style={{ '--aui-panel-x': `${tabDirection * 8}px` } as React.CSSProperties}
      className="aui-panel-in space-y-6"
    >
      {/* HERO WEALTH FOLIO: SINGLE DOMINANT FOCAL ANCHOR + HAIRLINE LEDGER STRIP */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
        <div className="p-6 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2.5 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63625C] dark:text-[#8E98A8]">
              Tổng tài sản ròng thực tế · NAV
            </div>
            <div className="font-display text-4xl sm:text-[46px] font-semibold leading-[1.08] tracking-tight text-[#141413] dark:text-[#ECEBE6] tabular-nums">
              {formatVND(accounting.totalMarketNavVnd)}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#63625C] dark:text-[#8E98A8] font-num">
              <span>
                Kênh đầu tư còn lại:{' '}
                <strong className="text-[#141413] dark:text-[#ECEBE6]">
                  {formatVND(totalInvestmentAccountVnd)}
                </strong>
              </span>
              <span aria-hidden="true" className="text-[#C7C4B8] dark:text-[#3A475B]">
                ·
              </span>
              <span
                className={
                  isTotalProfitDown
                    ? 'text-[#BE123C] dark:text-[#FB7185] font-semibold'
                    : 'text-[#137A4B] dark:text-[#34D399] font-semibold'
                }
              >
                {isTotalProfitDown ? 'Lỗ đầu tư' : 'Lãi đầu tư'}{' '}
                {formatSignedVND(accounting.totalInvestmentPnLVnd)}
              </span>
              <span className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                ({isRealizedDown ? 'Lỗ chốt' : 'Lãi chốt'}{' '}
                {formatSignedVND(accounting.totalRealizedPnLVnd, true)} · Tạm tính{' '}
                {formatSignedVND(accounting.totalUnrealizedPnLVnd, true)})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs text-[#63625C] dark:text-[#8E98A8]">
              <span className="font-medium">Kỳ báo cáo</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] bg-[#F6F5F1] dark:bg-[#0D1117] font-num focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                onSelectAssetSubTab('ALL');
                onNavigateTab('ASSETS');
              }}
              className="aui-btn px-3 py-1.5 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1] dark:bg-[#0D1117] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Chi tiết danh mục</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
            </button>
          </div>
        </div>

        {/* 4 Trụ cột tách rõ Tiền sinh hoạt & Luồng Đầu tư (Chờ ĐT còn lại · Đang ĐT · Lỗ/Lãi riêng) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DB] dark:divide-[#262F3D] border-t border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/45 dark:bg-[#0D1117]/40">
          {/* Strip 1: Tiền mặt sinh hoạt (tách hẳn khỏi tiền chờ đầu tư) */}
          <button
            type="button"
            onClick={() => {
              onSelectWalletGroup?.('LIVING');
              onSelectAssetSubTab('WALLETS');
              onNavigateTab('ASSETS');
            }}
            className="text-left px-5 py-4 hover:bg-[#EFEDE7]/70 dark:hover:bg-[#1C2430]/70 transition-colors"
          >
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              Tiền mặt sinh hoạt
            </div>
            <div className="mt-1.5 text-lg font-bold text-[#B47B2B] dark:text-[#E2B05E] font-num">
              {formatVND(accounting.livingCashVnd)}
            </div>
            <div className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num truncate">
              Thu–Chi {formatMonthLabel(selectedMonth).replace('Tháng ', 'T')}:{' '}
              <strong
                className={
                  monthlyCashflow.netBalance >= 0
                    ? 'text-[#141413] dark:text-[#ECEBE6]'
                    : 'text-[#BE123C] dark:text-[#FB7185]'
                }
              >
                {formatSignedVND(monthlyCashflow.netBalance, true)}
              </strong>
            </div>
          </button>

          {/* Strip 2: Tiền chờ đầu tư còn lại (Sổ cái kép: Nạp − Rút − Mua + Bán) */}
          <button
            type="button"
            onClick={() => {
              onSelectWalletGroup?.('INVESTMENT');
              onSelectAssetSubTab('WALLETS');
              onNavigateTab('ASSETS');
            }}
            className="text-left px-5 py-4 hover:bg-[#EFEDE7]/70 dark:hover:bg-[#1C2430]/70 transition-colors"
          >
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              {isInvCashNegative ? 'Tiền chờ đầu tư (Thiếu vốn)' : 'Tiền chờ đầu tư còn lại'}
            </div>
            <div
              className={`mt-1.5 text-lg font-bold font-num ${
                isInvCashNegative
                  ? 'text-[#BE123C] dark:text-[#FB7185]'
                  : 'text-[#0F766E] dark:text-[#2DD4BF]'
              }`}
            >
              {formatVND(accounting.investmentCashVnd)}
            </div>
            <div className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num truncate">
              Vốn nạp ròng: {formatVND(totalCapitalBaseVnd, true)}
            </div>
          </button>

          {/* Strip 3: Đang đầu tư (Giá trị thị trường hiện tại) */}
          <button
            type="button"
            onClick={() => {
              onSelectAssetSubTab('VN_STOCK');
              onNavigateTab('ASSETS');
            }}
            className="text-left px-5 py-4 hover:bg-[#EFEDE7]/70 dark:hover:bg-[#1C2430]/70 transition-colors"
          >
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              Đang đầu tư (Thị trường)
            </div>
            <div className="mt-1.5 text-lg font-bold text-[#0E5A4F] dark:text-[#38B29A] font-num">
              {formatVND(accounting.totalInvestedMarketVnd)}
            </div>
            <div className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num truncate">
              Vốn đang mở: {formatVND(accounting.totalInvestedCostVnd, true)} ·{' '}
              {accounting.allPositions.length} mã
            </div>
          </button>

          {/* Strip 4: Mục Lời / Lãi đầu tư riêng biệt (Đã chốt + Tạm tính) */}
          <button
            type="button"
            onClick={() => {
              onSelectAssetSubTab('HISTORY');
              onNavigateTab('ASSETS');
            }}
            className="text-left px-5 py-4 hover:bg-[#EFEDE7]/70 dark:hover:bg-[#1C2430]/70 transition-colors"
          >
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              Tổng Lỗ / Lãi đầu tư
            </div>
            <div
              className={`mt-1.5 text-lg font-bold font-num ${
                isTotalProfitDown
                  ? 'text-[#BE123C] dark:text-[#FB7185]'
                  : 'text-[#137A4B] dark:text-[#34D399]'
              }`}
            >
              {formatSignedVND(accounting.totalInvestmentPnLVnd)}
            </div>
            <div className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num truncate">
              {isRealizedDown ? 'Lỗ chốt' : 'Lãi chốt'}{' '}
              <strong
                className={
                  accounting.totalRealizedPnLVnd > 0
                    ? 'text-[#137A4B] dark:text-[#34D399]'
                    : accounting.totalRealizedPnLVnd < 0
                    ? 'text-[#BE123C] dark:text-[#FB7185]'
                    : 'text-[#141413] dark:text-[#ECEBE6]'
                }
              >
                {formatSignedVND(accounting.totalRealizedPnLVnd, true)}
              </strong>{' '}
              · Tạm tính {formatSignedVND(accounting.totalUnrealizedPnLVnd, true)}
            </div>
          </button>
        </div>
      </section>

      {/* ĐỐI CHIẾU 2 CHIỀU: TÀI SẢN HIỆN CÓ (NAV) & SỔ CÁI KÊNH ĐẦU TƯ (3 SỐ ĐỘC LẬP) */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
            Đối chiếu sổ cái &amp; cấu thành tài sản
          </h2>
          <div className="flex items-center gap-3 text-xs">
            {onOpenTransferModal && (
              <button
                type="button"
                onClick={onOpenTransferModal}
                className="aui-btn font-semibold text-[#0F766E] dark:text-[#2DD4BF] hover:underline whitespace-nowrap"
              >
                Nạp / Rút vốn
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSelectAssetSubTab('HISTORY');
                onNavigateTab('ASSETS');
              }}
              className="aui-btn font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              <span>Nhật ký</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* HÀNG 1: TÀI SẢN HIỆN CÓ (CẤU THÀNH NAV 100%) */}
        <div className="space-y-2.5 py-3 border-y border-[#E4E2DB] dark:border-[#262F3D]">
          <div className="text-[11px] font-semibold text-[#63625C] dark:text-[#8E98A8]">
            1. Tài sản hiện hữu (Cấu thành NAV)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start md:items-center gap-3">
            <div>
              <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">Tiền sinh hoạt</div>
              <div className="text-sm font-bold text-[#B47B2B] dark:text-[#E2B05E] font-num mt-0.5">
                {formatVND(accounting.livingCashVnd)}
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#8E8C84] dark:text-[#667182]">
              <Plus className="w-3.5 h-3.5" />
            </div>

            <div>
              <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                Tiền chờ ĐT còn lại
              </div>
              <div
                className={`text-sm font-bold font-num mt-0.5 ${
                  isInvCashNegative
                    ? 'text-[#BE123C] dark:text-[#FB7185]'
                    : 'text-[#0F766E] dark:text-[#2DD4BF]'
                }`}
              >
                {formatVND(accounting.investmentCashVnd)}
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#8E8C84] dark:text-[#667182]">
              <Plus className="w-3.5 h-3.5" />
            </div>

            <div>
              <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">Đang đầu tư</div>
              <div className="text-sm font-bold text-[#0E5A4F] dark:text-[#38B29A] font-num mt-0.5">
                {formatVND(accounting.totalInvestedMarketVnd)}
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#141413] dark:text-[#ECEBE6]">
              <Equal className="w-3.5 h-3.5" />
            </div>

            <div className="md:text-right">
              <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">NAV thực tế</div>
              <div className="text-base font-bold text-[#141413] dark:text-[#ECEBE6] font-num mt-0.5">
                {formatVND(accounting.totalMarketNavVnd)}
              </div>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-[#EFEDE7] dark:bg-[#1C2430] overflow-hidden flex">
            <div
              className="bg-[#B47B2B] dark:bg-[#D9A24E] h-full"
              style={{
                width: `${(Math.max(0, accounting.livingCashVnd) / navBarMaxScale) * 100}%`,
              }}
              title={`Tiền mặt sinh hoạt: ${formatVND(accounting.livingCashVnd)}`}
            />
            <div
              className="bg-[#0F766E] dark:bg-[#2DD4BF] h-full"
              style={{
                width: `${(Math.max(0, accounting.investmentCashVnd) / navBarMaxScale) * 100}%`,
              }}
              title={`Tiền chờ đầu tư còn lại: ${formatVND(accounting.investmentCashVnd)}`}
            />
            <div
              className="bg-[#0E5A4F] dark:bg-[#38B29A] h-full"
              style={{
                width: `${(Math.max(0, accounting.totalInvestedMarketVnd) / navBarMaxScale) * 100}%`,
              }}
              title={`Đang đầu tư (Thị trường): ${formatVND(accounting.totalInvestedMarketVnd)}`}
            />
          </div>
        </div>

        {/* HÀNG 2: SỔ CÁI KÊNH ĐẦU TƯ — TÁCH RÕ 3 SỐ: VỐN NẠP · TỔNG LỖ/LÃI ĐÃ CHỐT · TIỀN CÒN LẠI */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
            <span className="font-semibold">
              2. Sổ cái Kênh Đầu tư (Vốn nạp · Lỗ/Lãi đã chốt · Tiền còn lại)
            </span>
            <span>Sổ cái kép: Tiền chờ ĐT = Nạp − Rút − Mua + Bán</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.25fr_auto_1.15fr] items-start md:items-center gap-3">
            <div>
              <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                Vốn nạp ròng (Vào − Ra)
              </div>
              <div className="text-sm font-bold text-[#141413] dark:text-[#ECEBE6] font-num mt-0.5">
                {formatVND(totalCapitalBaseVnd)}
              </div>
              <div className="text-[10px] text-[#63625C] dark:text-[#8E98A8] font-num">
                Nạp {formatVND(accounting.totalDepositedVnd, true)} · Rút{' '}
                {formatVND(accounting.totalWithdrawnVnd, true)}
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#8E8C84] dark:text-[#667182]">
              <Plus className="w-3.5 h-3.5" />
            </div>

            <div>
              <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                Tổng Lỗ / Lãi đầu tư (Đã chốt + Tạm tính)
              </div>
              <div
                className={`text-sm font-bold font-num mt-0.5 ${
                  isTotalProfitDown
                    ? 'text-[#BE123C] dark:text-[#FB7185]'
                    : 'text-[#137A4B] dark:text-[#34D399]'
                }`}
              >
                {formatSignedVND(accounting.totalInvestmentPnLVnd)}
              </div>
              <div className="text-[10px] text-[#63625C] dark:text-[#8E98A8] font-num">
                {isRealizedDown ? 'Lỗ chốt' : 'Lãi chốt'}{' '}
                <strong
                  className={
                    accounting.totalRealizedPnLVnd > 0
                      ? 'text-[#137A4B] dark:text-[#34D399]'
                      : accounting.totalRealizedPnLVnd < 0
                      ? 'text-[#BE123C] dark:text-[#FB7185]'
                      : 'text-[#141413] dark:text-[#ECEBE6]'
                  }
                >
                  {formatSignedVND(accounting.totalRealizedPnLVnd, true)}
                </strong>
                {accounting.totalRealizedProfitVnd > 0 && accounting.totalRealizedLossVnd < 0 && (
                  <span>
                    {' '}
                    (Lãi {formatSignedVND(accounting.totalRealizedProfitVnd, true)} · Lỗ{' '}
                    {formatSignedVND(accounting.totalRealizedLossVnd, true)})
                  </span>
                )}{' '}
                · Tạm tính {formatSignedVND(accounting.totalUnrealizedPnLVnd, true)}
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center text-[#141413] dark:text-[#ECEBE6]">
              <Equal className="w-3.5 h-3.5" />
            </div>

            <div className="md:text-right">
              <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                Tiền &amp; Tài sản đầu tư còn lại
              </div>
              <div className="text-sm font-bold text-[#0F766E] dark:text-[#2DD4BF] font-num mt-0.5">
                {formatVND(totalInvestmentAccountVnd)}
              </div>
              <div className="text-[10px] text-[#63625C] dark:text-[#8E98A8] font-num">
                Chờ ĐT còn {formatVND(accounting.investmentCashVnd, true)} + Đang ĐT{' '}
                {formatVND(accounting.totalInvestedMarketVnd, true)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BIỂU ĐỒ DÒNG TIỀN CHỜ ĐẦU TƯ — SO SÁNH NẠP / RÚT VỐN THEO THÁNG (RECHARTS) */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
              <span>Dòng tiền chờ đầu tư · Nạp / Rút theo tháng</span>
            </h2>
            <p className="text-[11px] text-[#63625C] dark:text-[#8E98A8] mt-0.5">
              Nạp vào ví sức mua · Rút về sinh hoạt
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {monthlyCapitalFlowData.length > 0 && (
              <>
                <button
                  type="button"
                  aria-pressed={showCumulativeNet}
                  onClick={() => setShowCumulativeNet((v) => !v)}
                  className={`aui-btn px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    showCumulativeNet
                      ? 'bg-[#F0F6FA] dark:bg-[#142330] border-[#B6D0E2] dark:border-[#2B4B64] text-[#2D5B78] dark:text-[#7EB2D4]'
                      : 'bg-[#F6F5F1] dark:bg-[#0D1117] border-[#E4E2DB] dark:border-[#262F3D] text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
                  }`}
                  title="Bật hoặc ẩn đường Vốn nạp ròng lũy kế"
                >
                  <span
                    className={`w-3 h-0.5 rounded-full ${
                      showCumulativeNet
                        ? 'bg-[#2D5B78] dark:bg-[#7EB2D4]'
                        : 'bg-[#8E8D86] dark:bg-[#5B6576]'
                    }`}
                  />
                  <span>Lũy kế</span>
                </button>
                <GlidingTabs
                  variant="segmented"
                  value={capitalFlowRange}
                  onChange={(v) => setCapitalFlowRange(v as '6' | '12' | 'ALL')}
                  items={[
                    { id: '6', label: '6T' },
                    { id: '12', label: '12T' },
                    { id: 'ALL', label: 'Tất cả' },
                  ]}
                />
              </>
            )}
            {onOpenTransferModal && (
              <button
                type="button"
                onClick={onOpenTransferModal}
                className="aui-btn px-3 py-1.5 rounded-lg bg-[#0F766E]/[0.09] dark:bg-[#2DD4BF]/[0.14] hover:bg-[#0F766E]/[0.16] dark:hover:bg-[#2DD4BF]/[0.22] text-[#0F766E] dark:text-[#2DD4BF] text-xs font-semibold whitespace-nowrap shrink-0"
              >
                + Nạp / Rút
              </button>
            )}
          </div>
        </div>

        {/* Dải tóm tắt gọn 1 dòng thay thế 4 ô KPI dày */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 border-y border-[#E4E2DB] dark:border-[#262F3D] text-xs font-num text-[#63625C] dark:text-[#8E98A8]">
          <span>
            Chờ đầu tư{' '}
            <strong className="text-[#2D5B78] dark:text-[#7EB2D4]">
              {formatVND(accounting.investmentCashVnd)}
            </strong>
          </span>
          <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[2px] bg-[#0F766E] dark:bg-[#2DD4BF]" />
            <span>Nạp ({capitalFlowRange === 'ALL' ? 'tất cả' : `${capitalFlowRange}T`})</span>
            <strong className="text-[#0F766E] dark:text-[#2DD4BF]">
              {formatVND(capitalFlowTotals.deposit, true)}
            </strong>
          </span>
          <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[2px] bg-[#D97706] dark:bg-[#FBBF24]" />
            <span>Rút</span>
            <strong className="text-[#D97706] dark:text-[#FBBF24]">
              {formatVND(capitalFlowTotals.withdraw, true)}
            </strong>
          </span>
          <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
            ·
          </span>
          <span>
            Nạp ròng lũy kế{' '}
            <strong className="text-[#141413] dark:text-[#ECEBE6]">
              {formatVND(accounting.netDepositVnd, true)}
            </strong>
          </span>
        </div>

        {monthlyCapitalFlowData.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2.5 border border-dashed border-[#E4E2DB] dark:border-[#262F3D] rounded-lg bg-[#F6F5F1]/60 dark:bg-[#0D1117]/50">
            <p className="text-xs text-[#63625C] dark:text-[#8E98A8] max-w-md mx-auto">
              Chưa có giao dịch Nạp hoặc Rút vốn nào giữa ví sinh hoạt và ví Tiền chờ đầu tư. Ghi
              nhận lệnh chuyển vốn để theo dõi kỷ luật nạp vốn DCA và dòng tiền rút lợi nhuận theo
              từng tháng.
            </p>
            {onOpenTransferModal && (
              <button
                type="button"
                onClick={onOpenTransferModal}
                className="aui-btn px-3.5 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0C5E58] dark:bg-[#2DD4BF] dark:hover:bg-[#14B8A6] text-white dark:text-[#0D1117] text-xs font-semibold"
              >
                Ghi nhận lệnh Nạp / Rút đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyCapitalFlowData}
                  margin={{ top: 10, right: showCumulativeNet ? 8 : 12, left: 4, bottom: 10 }}
                  barGap={6}
                  barCategoryGap="24%"
                  onClick={(state) => {
                    const activeLabel = state?.activeLabel;
                    if (!activeLabel) return;
                    const found = monthlyCapitalFlowData.find(
                      (d) => d.label === String(activeLabel)
                    );
                    if (found) onChangeMonth(found.month);
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? '#262F3D' : '#E4E2DB'}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    height={32}
                    tick={(props) => (
                      <MonthlyXAxisTick
                        x={Number(props.x)}
                        y={Number(props.y)}
                        payload={props.payload}
                        selectedLabel={selectedCapitalEntry?.label ?? null}
                        isDark={isDark}
                      />
                    )}
                  />
                  <YAxis
                    yAxisId="flow"
                    axisLine={false}
                    tickLine={false}
                    width={68}
                    tick={{
                      fill: isDark ? '#8E98A8' : '#63625C',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    tickFormatter={(val: number) => (val === 0 ? '0đ' : formatVND(val, true))}
                  />
                  {showCumulativeNet && (
                    <YAxis
                      yAxisId="cum"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      width={68}
                      tick={{
                        fill: isDark ? '#7EB2D4' : '#2D5B78',
                        fontSize: 11,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      tickFormatter={(val: number) => (val === 0 ? '0đ' : formatVND(val, true))}
                    />
                  )}
                  <ReferenceLine
                    yAxisId="flow"
                    y={0}
                    stroke={isDark ? '#425066' : '#BDB9AD'}
                    strokeWidth={1}
                  />
                  {showCumulativeNet && capitalFlowTotals.hasNegativeCumulative && (
                    <ReferenceLine
                      yAxisId="cum"
                      y={0}
                      stroke={isDark ? '#3B5C75' : '#8FB0C6'}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  )}
                  <Tooltip
                    cursor={{
                      fill: isDark ? '#1C2430' : '#EFEDE7',
                      opacity: isDark ? 0.65 : 0.75,
                    }}
                    content={<CapitalFlowTooltip selectedMonth={selectedMonth} />}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{
                      fontSize: '12px',
                      paddingBottom: '12px',
                      color: isDark ? '#ECEBE6' : '#141413',
                    }}
                  />
                  <Bar
                    yAxisId="flow"
                    dataKey="deposit"
                    name="Tiền nạp (Deposit)"
                    fill={isDark ? '#2DD4BF' : '#0F766E'}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={!reducedMotion}
                    animationDuration={220}
                    className="cursor-pointer"
                    onClick={(barData) => {
                      const month = (barData as { month?: string })?.month;
                      if (month) onChangeMonth(month);
                    }}
                  >
                    {monthlyCapitalFlowData.map((entry) => {
                      const isSelected = entry.month === selectedMonth;
                      return (
                        <Cell
                          key={`dep-${entry.month}`}
                          fill={isDark ? '#2DD4BF' : '#0F766E'}
                          fillOpacity={!hasSelectedInCapitalData ? 0.92 : isSelected ? 1 : 0.45}
                        />
                      );
                    })}
                  </Bar>
                  <Bar
                    yAxisId="flow"
                    dataKey="withdraw"
                    name="Tiền rút (Withdraw)"
                    fill={isDark ? '#FBBF24' : '#D97706'}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={!reducedMotion}
                    animationDuration={220}
                    className="cursor-pointer"
                    onClick={(barData) => {
                      const month = (barData as { month?: string })?.month;
                      if (month) onChangeMonth(month);
                    }}
                  >
                    {monthlyCapitalFlowData.map((entry) => {
                      const isSelected = entry.month === selectedMonth;
                      return (
                        <Cell
                          key={`wd-${entry.month}`}
                          fill={isDark ? '#FBBF24' : '#D97706'}
                          fillOpacity={!hasSelectedInCapitalData ? 0.92 : isSelected ? 1 : 0.45}
                        />
                      );
                    })}
                  </Bar>
                  {showCumulativeNet && (
                    <Line
                      yAxisId="cum"
                      type="monotone"
                      dataKey="cumulativeNet"
                      name="Vốn nạp ròng lũy kế"
                      stroke={isDark ? '#7EB2D4' : '#2D5B78'}
                      strokeWidth={2.25}
                      legendType="plainline"
                      isAnimationActive={!reducedMotion}
                      animationDuration={240}
                      dot={(dotProps) => {
                        const { cx, cy, payload } = dotProps as {
                          cx?: number;
                          cy?: number;
                          payload?: MonthlyCapitalFlowDatum;
                        };
                        if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) {
                          return <g key={`cap-empty-${String(dotProps.index)}`} />;
                        }
                        const isSelected = payload.month === selectedMonth;
                        const steel = isDark ? '#7EB2D4' : '#2D5B78';
                        const surface = isDark ? '#151B23' : '#FFFFFF';
                        if (isSelected) {
                          return (
                            <g key={`cap-dot-${payload.month}`}>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={8.5}
                                fill="none"
                                stroke={steel}
                                strokeOpacity={0.45}
                                strokeWidth={1.5}
                              />
                              <circle
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill={steel}
                                stroke={surface}
                                strokeWidth={2}
                              />
                            </g>
                          );
                        }
                        return (
                          <circle
                            key={`cap-dot-${payload.month}`}
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill={surface}
                            stroke={steel}
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{
                        r: 5.5,
                        fill: isDark ? '#7EB2D4' : '#2D5B78',
                        stroke: isDark ? '#151B23' : '#FFFFFF',
                        strokeWidth: 2,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
              {showCumulativeNet
                ? 'Trục trái thể hiện Nạp / Rút từng tháng · Trục phải thể hiện Vốn nạp ròng lũy kế. '
                : ''}
              Nhấn vào cột tháng để đổi kỳ báo cáo (đang nổi bật:{' '}
              <strong className="text-[#0F766E] dark:text-[#2DD4BF]">
                {formatMonthLabel(selectedMonth)}
              </strong>
              {selectedCapitalEntry && selectedCapitalEntry.transferCount === 0
                ? ' · chưa phát sinh lệnh nạp/rút'
                : ''}
              ).
            </p>
          </div>
        )}
      </section>

      {/* DỰ BÁO CHI TIÊU THEO TỐC ĐỘ HIỆN TẠI & CẢNH BÁO VƯỢT NGÂN SÁCH */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
              <span>Dự báo chi tiêu cuối tháng · {formatMonthLabel(selectedMonth)}</span>
            </h2>
            <p className="text-xs text-[#63625C] dark:text-[#8E98A8] mt-0.5">
              {spendingForecast.mode === 'CURRENT'
                ? `Ước tính từ tốc độ chi tiêu thực tế sau ${spendingForecast.elapsedDays}/${spendingForecast.totalDays} ngày (còn ${spendingForecast.remainingDays} ngày).`
                : spendingForecast.mode === 'PAST'
                ? `Tháng đã kết thúc (${spendingForecast.totalDays} ngày) · Đối chiếu tổng chi thực tế với hạn mức.`
                : 'Tháng chưa bắt đầu · Dự báo sẽ tự động cập nhật khi có giao dịch chi tiêu.'}
            </p>
          </div>
          {!spendingForecast.hasBudgets ? (
            <button
              type="button"
              onClick={onOpenBudgetModal}
              className="aui-btn px-3 py-1.5 rounded-lg bg-[#0E5A4F]/[0.08] dark:bg-[#38B29A]/[0.14] hover:bg-[#0E5A4F]/[0.14] dark:hover:bg-[#38B29A]/[0.22] text-[#0E5A4F] dark:text-[#38B29A] text-xs font-semibold whitespace-nowrap shrink-0"
            >
              + Đặt ngân sách để nhận cảnh báo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateTab('CASHFLOW')}
              className="aui-btn text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline whitespace-nowrap shrink-0"
            >
              Điều chỉnh ngân sách →
            </button>
          )}
        </div>

        {/* Cảnh báo nổi bật nếu dự kiến vượt tổng ngân sách hoặc danh mục */}
        {(spendingForecast.willExceedTotalBudget ||
          spendingForecast.atRiskCategories.length > 0 ||
          (!spendingForecast.hasBudgets && spendingForecast.willExceedIncome)) && (
          <div
            role="alert"
            className={`rounded-lg border px-4 py-3 flex items-start gap-2.5 text-xs ${
              spendingForecast.alreadyExceededTotalBudget ||
              spendingForecast.willExceedTotalBudget
                ? 'bg-[#FFF1F3] dark:bg-[#2A141A] border-[#F6C4CE] dark:border-[#6B2135] text-[#9F1239] dark:text-[#FDA4AF]'
                : 'bg-[#FFFBEB] dark:bg-[#261E0F] border-[#F2D59B] dark:border-[#6B4E16] text-[#92400E] dark:text-[#FCD34D]'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                spendingForecast.alreadyExceededTotalBudget ||
                spendingForecast.willExceedTotalBudget
                  ? 'text-[#BE123C] dark:text-[#FB7185]'
                  : 'text-[#B45309] dark:text-[#FBBF24]'
              }`}
            />
            <div className="space-y-1 leading-relaxed">
              {spendingForecast.willExceedTotalBudget ? (
                <p>
                  <strong className="font-semibold">Cảnh báo dự kiến vượt ngân sách tháng:</strong>{' '}
                  Với tốc độ{' '}
                  <strong className="font-num">
                    {formatVND(Math.round(spendingForecast.dailyBurnRate))}/ngày
                  </strong>
                  , tổng chi tiêu dự báo đạt{' '}
                  <strong className="font-num">
                    {formatVND(spendingForecast.projectedTotalSpend)}
                  </strong>
                  , vượt tổng ngân sách{' '}
                  <strong className="font-num">
                    +{formatVND(spendingForecast.overallBudgetOverrun)}
                  </strong>{' '}
                  ({Math.round(spendingForecast.overallProjectedRatioPct)}% hạn mức).
                  {spendingForecast.mode === 'CURRENT' && spendingForecast.remainingDays > 0 && (
                    <>
                      {' '}
                      Để giữ đúng kế hoạch, nên giới hạn mức chi tối đa{' '}
                      <strong className="font-num">
                        {formatVND(spendingForecast.overallSafeDailyCap)}/ngày
                      </strong>{' '}
                      trong {spendingForecast.remainingDays} ngày còn lại.
                    </>
                  )}
                </p>
              ) : spendingForecast.atRiskCategories.length > 0 ? (
                <p>
                  <strong className="font-semibold">
                    {spendingForecast.atRiskCategories.length} danh mục dự kiến vượt hạn mức:
                  </strong>{' '}
                  {spendingForecast.atRiskCategories
                    .slice(0, 3)
                    .map(
                      (c) =>
                        `${c.category} (dự báo ${formatVND(c.projectedSpend, true)} / ${formatVND(
                          c.limitAmount,
                          true
                        )})`
                    )
                    .join(', ')}
                  .
                </p>
              ) : (
                <p>
                  <strong className="font-semibold">Chi tiêu dự kiến vượt thu nhập tháng:</strong>{' '}
                  Dự báo chi cả tháng đạt{' '}
                  <strong className="font-num">
                    {formatVND(spendingForecast.projectedTotalSpend)}
                  </strong>
                  , cao hơn tổng thu nhập hiện có (
                  <strong className="font-num">{formatVND(spendingForecast.totalIncome)}</strong>).
                </p>
              )}
            </div>
          </div>
        )}

        {/* Trạng thái an toàn */}
        {spendingForecast.hasBudgets &&
          !spendingForecast.willExceedTotalBudget &&
          spendingForecast.atRiskCategories.length === 0 &&
          spendingForecast.actualTotalSpent > 0 && (
            <div className="rounded-lg border border-[#C6E5D5] dark:border-[#1D4E3B] bg-[#F1FAF5] dark:bg-[#10261E] px-4 py-2.5 flex items-center gap-2 text-xs text-[#137A4B] dark:text-[#34D399]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Tốc độ chi tiêu hiện tại trong tầm kiểm soát · Dự báo cuối tháng khoảng{' '}
                <strong className="font-num">
                  {Math.round(spendingForecast.overallProjectedRatioPct)}%
                </strong>{' '}
                tổng ngân sách ({formatVND(spendingForecast.projectedTotalSpend)} /{' '}
                {formatVND(spendingForecast.totalBudgetLimit)}).
              </span>
            </div>
          )}

        {/* 4 chỉ số tốc độ & dự báo (Hairline-divided strip) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E4E2DB] dark:divide-[#262F3D] border border-[#E4E2DB] dark:border-[#262F3D] rounded-lg bg-[#F6F5F1]/60 dark:bg-[#0D1117]/60">
          <div className="p-3.5">
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              Tốc độ chi trung bình
            </div>
            <div className="mt-1 text-base font-bold text-[#141413] dark:text-[#ECEBE6] font-num">
              {formatVND(Math.round(spendingForecast.dailyBurnRate))}
              <span className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
                /ngày
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
              Thực chi {formatVND(spendingForecast.actualTotalSpent, true)} · Ngày{' '}
              {spendingForecast.elapsedDays}/{spendingForecast.totalDays}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              {spendingForecast.mode === 'PAST' ? 'Tổng chi cả tháng' : 'Dự báo chi cả tháng'}
            </div>
            <div
              className={`mt-1 text-base font-bold font-num ${
                spendingForecast.willExceedTotalBudget ||
                (!spendingForecast.hasBudgets && spendingForecast.willExceedIncome)
                  ? 'text-[#BE123C] dark:text-[#FB7185]'
                  : spendingForecast.overallProjectedRatioPct >= 85
                  ? 'text-[#B45309] dark:text-[#FBBF24]'
                  : 'text-[#141413] dark:text-[#ECEBE6]'
              }`}
            >
              {formatVND(spendingForecast.projectedTotalSpend)}
            </div>
            <div className="mt-0.5 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
              {spendingForecast.hasBudgets
                ? `${Math.round(spendingForecast.overallProjectedRatioPct)}% tổng ngân sách`
                : spendingForecast.totalIncome > 0
                ? `${Math.round(
                    (spendingForecast.projectedTotalSpend / spendingForecast.totalIncome) * 100
                  )}% thu nhập tháng`
                : 'Chưa có ngân sách đối chiếu'}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              Tổng hạn mức ngân sách
            </div>
            <div className="mt-1 text-base font-bold text-[#141413] dark:text-[#ECEBE6] font-num">
              {spendingForecast.hasBudgets
                ? formatVND(spendingForecast.totalBudgetLimit)
                : 'Chưa thiết lập'}
            </div>
            <div className="mt-0.5 text-[11px] font-num">
              {spendingForecast.hasBudgets ? (
                spendingForecast.overallBudgetOverrun > 0 ? (
                  <span className="text-[#BE123C] dark:text-[#FB7185] font-semibold">
                    Dự kiến vượt +{formatVND(spendingForecast.overallBudgetOverrun, true)}
                  </span>
                ) : (
                  <span className="text-[#137A4B] dark:text-[#34D399] font-medium">
                    Dự kiến dư {formatVND(Math.abs(spendingForecast.overallBudgetOverrun), true)}
                  </span>
                )
              ) : (
                <span className="text-[#63625C] dark:text-[#8E98A8]">Đặt hạn mức theo danh mục</span>
              )}
            </div>
          </div>

          <div className="p-3.5">
            <div className="text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
              Mức chi an toàn mỗi ngày còn lại
            </div>
            <div
              className={`mt-1 text-base font-bold font-num ${
                !spendingForecast.hasBudgets
                  ? 'text-[#8E8C84] dark:text-[#667182]'
                  : spendingForecast.alreadyExceededTotalBudget
                  ? 'text-[#BE123C] dark:text-[#FB7185]'
                  : spendingForecast.overallSafeDailyCap < spendingForecast.dailyBurnRate
                  ? 'text-[#B45309] dark:text-[#FBBF24]'
                  : 'text-[#137A4B] dark:text-[#34D399]'
              }`}
            >
              {!spendingForecast.hasBudgets
                ? '—'
                : spendingForecast.remainingDays === 0
                ? 'Đã hết tháng'
                : spendingForecast.alreadyExceededTotalBudget
                ? '0 đ/ngày'
                : `${formatVND(spendingForecast.overallSafeDailyCap)}/ngày`}
            </div>
            <div className="mt-0.5 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
              {spendingForecast.remainingDays > 0
                ? `Cho ${spendingForecast.remainingDays} ngày còn lại`
                : 'Không còn ngày dự báo'}
            </div>
          </div>
        </div>

        {/* Thanh trực quan: Thực chi vs Dự báo vs Mốc thời gian */}
        {spendingForecast.hasBudgets && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
              <span>
                Thực chi:{' '}
                <strong className="text-[#141413] dark:text-[#ECEBE6]">
                  {Math.round(spendingForecast.overallActualRatioPct)}%
                </strong>
              </span>
              <span>
                Tiến độ tháng:{' '}
                <strong className="text-[#141413] dark:text-[#ECEBE6]">
                  {Math.round(spendingForecast.elapsedPct)}%
                </strong>{' '}
                (Ngày {spendingForecast.elapsedDays}/{spendingForecast.totalDays})
              </span>
              <span>
                Dự báo cuối tháng:{' '}
                <strong
                  className={
                    spendingForecast.willExceedTotalBudget
                      ? 'text-[#BE123C] dark:text-[#FB7185]'
                      : spendingForecast.overallProjectedRatioPct >= 85
                      ? 'text-[#B45309] dark:text-[#FBBF24]'
                      : 'text-[#137A4B] dark:text-[#34D399]'
                  }
                >
                  {Math.round(spendingForecast.overallProjectedRatioPct)}%
                </strong>
              </span>
            </div>

            <div className="relative w-full h-2.5 rounded-full bg-[#EFEDE7] dark:bg-[#1C2430] overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  spendingForecast.willExceedTotalBudget
                    ? 'bg-[#F6C4CE] dark:bg-[#6B2135]'
                    : spendingForecast.overallProjectedRatioPct >= 85
                    ? 'bg-[#F2D59B] dark:bg-[#6B4E16]'
                    : 'bg-[#C6E5D5] dark:bg-[#1D4E3B]'
                }`}
                style={{ width: `${Math.min(100, spendingForecast.overallProjectedRatioPct)}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${
                  spendingForecast.alreadyExceededTotalBudget
                    ? 'bg-[#BE123C] dark:bg-[#FB7185]'
                    : spendingForecast.willExceedTotalBudget
                    ? 'bg-[#B45309] dark:bg-[#FBBF24]'
                    : 'bg-[#0E5A4F] dark:bg-[#38B29A]'
                }`}
                style={{ width: `${Math.min(100, spendingForecast.overallActualRatioPct)}%` }}
              />
              {spendingForecast.mode === 'CURRENT' && (
                <div
                  className="absolute inset-y-0 w-0.5 bg-[#141413] dark:bg-[#ECEBE6]"
                  style={{ left: `${Math.min(99.5, spendingForecast.elapsedPct)}%` }}
                  title={`Tiến độ thời gian: ngày ${spendingForecast.elapsedDays}/${spendingForecast.totalDays}`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#0E5A4F] dark:bg-[#38B29A]" />
                Thực chi hiện tại
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-[2px] ${
                    spendingForecast.willExceedTotalBudget
                      ? 'bg-[#F6C4CE] dark:bg-[#6B2135]'
                      : 'bg-[#C6E5D5] dark:bg-[#1D4E3B]'
                  }`}
                />
                Dự báo đến cuối tháng
              </span>
              {spendingForecast.mode === 'CURRENT' && (
                <span className="flex items-center gap-1.5">
                  <span className="w-0.5 h-3 bg-[#141413] dark:bg-[#ECEBE6]" />
                  Mốc thời gian hiện tại
                </span>
              )}
            </div>
          </div>
        )}

        {/* Danh sách các danh mục có nguy cơ vượt ngân sách */}
        {spendingForecast.atRiskCategories.length > 0 && (
          <div className="pt-3 border-t border-[#E4E2DB] dark:border-[#262F3D] space-y-2">
            <div className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6]">
              Danh mục cần chú ý theo tốc độ hiện tại
            </div>
            <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D]">
              {spendingForecast.atRiskCategories.slice(0, 4).map((cat) => {
                const isAlreadyOver = cat.status === 'EXCEEDED';
                return (
                  <div
                    key={cat.category}
                    className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isAlreadyOver
                            ? 'text-[#BE123C] dark:text-[#FB7185]'
                            : 'text-[#B45309] dark:text-[#FBBF24]'
                        }`}
                      />
                      <span className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
                        {cat.category}
                      </span>
                      <span className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                        · {isAlreadyOver ? 'Đã vượt hạn mức' : 'Dự kiến vượt cuối tháng'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-num">
                      <span className="text-[#63625C] dark:text-[#8E98A8]">
                        Dự báo:{' '}
                        <strong
                          className={
                            isAlreadyOver
                              ? 'text-[#BE123C] dark:text-[#FB7185]'
                              : 'text-[#B45309] dark:text-[#FBBF24]'
                          }
                        >
                          {formatVND(cat.projectedSpend, true)}
                        </strong>{' '}
                        / {formatVND(cat.limitAmount, true)} (+
                        {formatVND(cat.projectedOverrun, true)})
                      </span>
                      {spendingForecast.mode === 'CURRENT' &&
                        spendingForecast.remainingDays > 0 &&
                        !isAlreadyOver && (
                          <span className="text-[#63625C] dark:text-[#8E98A8]">
                            · Mức an toàn:{' '}
                            <strong className="text-[#141413] dark:text-[#ECEBE6]">
                              ≤ {formatVND(cat.safeDailyCap, true)}/ngày
                            </strong>
                          </span>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* HAI BIỂU ĐỒ TRÒN SVG THUẦN */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Cơ cấu tài sản
              </h2>
              <p className="text-xs text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                {assetChartMode === 'COST'
                  ? 'Phân bổ theo vốn gốc thực tế đã bỏ vào'
                  : assetChartMode === 'MARKET'
                  ? 'Phân bổ theo giá thị trường hiện tại (NAV)'
                  : 'Chi tiết từng ví tiền mặt và từng mã đầu tư'}
              </p>
            </div>
            <GlidingTabs
              variant="segmented"
              value={assetChartMode}
              onChange={switchAssetChartMode}
              items={[
                { id: 'COST', label: 'Vốn gốc' },
                { id: 'MARKET', label: 'Giá TT (NAV)' },
                { id: 'DETAIL', label: 'Chi tiết' },
              ]}
            />
          </div>

          <div
            key={`asset-chart-${assetChartMode}`}
            style={{ '--aui-panel-x': `${assetChartDir * 8}px` } as React.CSSProperties}
            className="aui-panel-in"
          >
            <PureSvgDonutChart
              slices={
                assetChartMode === 'COST'
                  ? accounting.slicesByCost
                  : assetChartMode === 'MARKET'
                  ? accounting.slicesByMarket
                  : accounting.slicesDetail
              }
              centerLabel={assetChartMode === 'COST' ? 'Tổng giá vốn' : 'NAV thực tế'}
              emptyText="Chưa có tài sản nào. Hãy thêm ví tiền mặt hoặc giao dịch đầu tư."
            />
          </div>
        </section>

        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Thu – Chi · {formatMonthLabel(selectedMonth)}
              </h2>
              <p className="text-xs text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                Di chuột hoặc chạm vào từng phần để xem tỷ trọng chính xác
              </p>
            </div>
            <GlidingTabs
              variant="segmented"
              value={cashflowChartMode}
              onChange={switchCashflowChartMode}
              items={[
                { id: 'EXPENSE', label: 'Chi tiêu' },
                { id: 'INCOME', label: 'Thu nhập' },
                { id: 'RATIO', label: 'Thu vs. Chi' },
              ]}
            />
          </div>

          <div
            key={`cf-chart-${cashflowChartMode}`}
            style={{ '--aui-panel-x': `${cashflowChartDir * 8}px` } as React.CSSProperties}
            className="aui-panel-in"
          >
            <PureSvgDonutChart
              slices={
                cashflowChartMode === 'EXPENSE'
                  ? monthlyCashflow.expenseSlices
                  : cashflowChartMode === 'INCOME'
                  ? monthlyCashflow.incomeSlices
                  : monthlyCashflow.ratioSlices
              }
              centerLabel={
                cashflowChartMode === 'EXPENSE'
                  ? 'Tổng chi'
                  : cashflowChartMode === 'INCOME'
                  ? 'Tổng thu'
                  : 'Tổng dòng tiền'
              }
              emptyText={`Chưa có khoản ${
                cashflowChartMode === 'EXPENSE'
                  ? 'chi tiêu'
                  : cashflowChartMode === 'INCOME'
                  ? 'thu nhập'
                  : 'thu chi'
              } nào trong ${formatMonthLabel(selectedMonth)}.`}
            />
          </div>
        </section>
      </div>

      {/* BIỂU ĐỒ CỘT KẾT HỢP RECHARTS: SO SÁNH THU NHẬP, CHI TIÊU & CHÊNH LỆCH RÒNG THEO THÁNG */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
              <span>So sánh Thu nhập &amp; Chi tiêu theo từng tháng</span>
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#63625C] dark:text-[#8E98A8] font-num">
              <span>{monthlyBarData.length} tháng có giao dịch</span>
              <span aria-hidden="true">·</span>
              <span>
                Tổng thu:{' '}
                <strong className="text-[#137A4B] dark:text-[#34D399]">
                  {formatVND(monthlyBarTotals.income)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Tổng chi:{' '}
                <strong className="text-[#BE123C] dark:text-[#FB7185]">
                  {formatVND(monthlyBarTotals.expense)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Ròng:{' '}
                <strong
                  className={
                    monthlyBarTotals.net >= 0
                      ? 'text-[#141413] dark:text-[#ECEBE6]'
                      : 'text-[#BE123C] dark:text-[#FB7185]'
                  }
                >
                  {formatSignedVND(monthlyBarTotals.net)}
                </strong>
              </span>
              {monthlyBarTotals.savingsRate !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Tiết kiệm:{' '}
                    <strong
                      className={
                        monthlyBarTotals.savingsRate >= 20
                          ? 'text-[#137A4B] dark:text-[#34D399]'
                          : monthlyBarTotals.savingsRate >= 0
                          ? 'text-[#B45309] dark:text-[#FBBF24]'
                          : 'text-[#BE123C] dark:text-[#FB7185]'
                      }
                    >
                      {formatPercent(monthlyBarTotals.savingsRate)}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              aria-pressed={showNetLine}
              onClick={() => setShowNetLine((v) => !v)}
              className={`aui-btn px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                showNetLine
                  ? 'bg-[#FFFBEB] dark:bg-[#261E0F] border-[#E8C98A] dark:border-[#6B4E16] text-[#8A5A17] dark:text-[#E2B05E]'
                  : 'bg-[#F6F5F1] dark:bg-[#0D1117] border-[#E4E2DB] dark:border-[#262F3D] text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
              }`}
              title="Bật hoặc ẩn đường Chênh lệch ròng (Thu − Chi)"
            >
              <span
                className={`w-3 h-0.5 rounded-full ${
                  showNetLine
                    ? 'bg-[#B47B2B] dark:bg-[#E2B05E]'
                    : 'bg-[#8E8D86] dark:bg-[#5B6576]'
                }`}
              />
              <span>Đường ròng</span>
            </button>
            <GlidingTabs
              variant="segmented"
              value={barRange}
              onChange={(v) => setBarRange(v as '6' | '12' | 'ALL')}
              items={[
                { id: '6', label: '6 tháng' },
                { id: '12', label: '12 tháng' },
                { id: 'ALL', label: 'Tất cả' },
              ]}
            />
          </div>
        </div>

        {monthlyBarData.length === 0 ? (
          <div className="py-10 text-center space-y-2.5 border border-dashed border-[#E4E2DB] dark:border-[#262F3D] rounded-lg bg-[#F6F5F1]/60 dark:bg-[#0D1117]/50">
            <p className="text-xs text-[#63625C] dark:text-[#8E98A8]">
              Chưa có dữ liệu Thu nhập hoặc Chi tiêu để vẽ biểu đồ so sánh theo tháng.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab('CASHFLOW')}
              className="aui-btn px-3.5 py-1.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold"
            >
              Ghi khoản Thu – Chi đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-full h-[304px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyBarData}
                  margin={{ top: 10, right: 12, left: 4, bottom: 10 }}
                  barGap={6}
                  barCategoryGap="24%"
                  onClick={(state) => {
                    const activeLabel = state?.activeLabel;
                    if (!activeLabel) return;
                    const found = monthlyBarData.find((d) => d.label === String(activeLabel));
                    if (found) onChangeMonth(found.month);
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? '#262F3D' : '#E4E2DB'}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    height={32}
                    tick={(props) => (
                      <MonthlyXAxisTick
                        x={Number(props.x)}
                        y={Number(props.y)}
                        payload={props.payload}
                        selectedLabel={selectedBarEntry?.label ?? null}
                        isDark={isDark}
                      />
                    )}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={68}
                    tick={{
                      fill: isDark ? '#8E98A8' : '#63625C',
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    tickFormatter={(val: number) => (val === 0 ? '0đ' : formatVND(val, true))}
                  />
                  {(showNetLine || hasNegativeNet) && (
                    <ReferenceLine
                      y={0}
                      stroke={isDark ? '#425066' : '#BDB9AD'}
                      strokeDasharray={hasNegativeNet ? '4 3' : undefined}
                      strokeWidth={1}
                    />
                  )}
                  <Tooltip
                    cursor={{
                      fill: isDark ? '#1C2430' : '#EFEDE7',
                      opacity: isDark ? 0.65 : 0.75,
                    }}
                    content={<MonthlyCashflowTooltip selectedMonth={selectedMonth} />}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{
                      fontSize: '12px',
                      paddingBottom: '12px',
                      color: isDark ? '#ECEBE6' : '#141413',
                    }}
                  />
                  <Bar
                    dataKey="income"
                    name="Thu nhập"
                    fill={isDark ? '#38B29A' : '#0E5A4F'}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={30}
                    isAnimationActive={!reducedMotion}
                    animationDuration={220}
                    className="cursor-pointer"
                    onClick={(barData) => {
                      const month = (barData as { month?: string })?.month;
                      if (month) onChangeMonth(month);
                    }}
                  >
                    {monthlyBarData.map((entry) => {
                      const isSelected = entry.month === selectedMonth;
                      return (
                        <Cell
                          key={`inc-${entry.month}`}
                          fill={isDark ? '#38B29A' : '#0E5A4F'}
                          fillOpacity={!hasSelectedInBarData ? 0.92 : isSelected ? 1 : 0.4}
                        />
                      );
                    })}
                  </Bar>
                  <Bar
                    dataKey="expense"
                    name="Chi tiêu"
                    fill={isDark ? '#FB7185' : '#BE123C'}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={30}
                    isAnimationActive={!reducedMotion}
                    animationDuration={220}
                    className="cursor-pointer"
                    onClick={(barData) => {
                      const month = (barData as { month?: string })?.month;
                      if (month) onChangeMonth(month);
                    }}
                  >
                    {monthlyBarData.map((entry) => {
                      const isSelected = entry.month === selectedMonth;
                      return (
                        <Cell
                          key={`exp-${entry.month}`}
                          fill={isDark ? '#FB7185' : '#BE123C'}
                          fillOpacity={!hasSelectedInBarData ? 0.92 : isSelected ? 1 : 0.4}
                        />
                      );
                    })}
                  </Bar>
                  {showNetLine && (
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Chênh lệch ròng"
                      stroke={isDark ? '#E2B05E' : '#B47B2B'}
                      strokeWidth={2.25}
                      legendType="plainline"
                      isAnimationActive={!reducedMotion}
                      animationDuration={240}
                      dot={(dotProps) => {
                        const { cx, cy, payload } = dotProps as {
                          cx?: number;
                          cy?: number;
                          payload?: MonthlyComparisonDatum;
                        };
                        if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) {
                          return <g key={`empty-${String(dotProps.index)}`} />;
                        }
                        const isSelected = payload.month === selectedMonth;
                        const ochre = isDark ? '#E2B05E' : '#B47B2B';
                        const surface = isDark ? '#151B23' : '#FFFFFF';
                        if (isSelected) {
                          return (
                            <g key={`dot-${payload.month}`}>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={8.5}
                                fill="none"
                                stroke={ochre}
                                strokeOpacity={0.45}
                                strokeWidth={1.5}
                              />
                              <circle
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill={ochre}
                                stroke={surface}
                                strokeWidth={2}
                              />
                            </g>
                          );
                        }
                        return (
                          <circle
                            key={`dot-${payload.month}`}
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill={surface}
                            stroke={ochre}
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{
                        r: 5.5,
                        fill: isDark ? '#E2B05E' : '#B47B2B',
                        stroke: isDark ? '#151B23' : '#FFFFFF',
                        strokeWidth: 2,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
              Nhấn vào cột của bất kỳ tháng nào để đổi kỳ báo cáo toàn trang (đang nổi bật:{' '}
              <strong className="text-[#0E5A4F] dark:text-[#38B29A]">
                {formatMonthLabel(selectedMonth)}
              </strong>
              {!hasSelectedInBarData ? ' · chưa có giao dịch trong kỳ này' : ''}).
            </p>
          </div>
        )}
      </section>

      {/* XU HƯỚNG NHIỀU THÁNG + TÓM TẮT NGÂN SÁCH THÁNG */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Xu hướng tài sản &amp; dòng tiền ({trendMonths} tháng gần nhất)
              </h2>
              <p className="text-xs text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                {trendMode === 'NET_WORTH'
                  ? 'NAV ước tính theo dòng tiền thuần (Thu − Chi) quy hồi từ tài sản hiện tại — không phản ánh biến động giá thị trường lịch sử'
                  : 'Tổng hợp trực tiếp từ lịch sử Thu – Chi thực tế theo từng tháng'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GlidingTabs
                variant="segmented"
                value={trendMode}
                onChange={(v) => setTrendMode(v as 'CASHFLOW' | 'NET_WORTH')}
                items={[
                  { id: 'CASHFLOW', label: 'Thu – Chi' },
                  { id: 'NET_WORTH', label: 'NAV ước tính' },
                ]}
              />
              <GlidingTabs
                variant="segmented"
                value={String(trendMonths)}
                onChange={(v) => onChangeTrendMonths(Number(v) === 12 ? 12 : 6)}
                items={[
                  { id: '6', label: '6 tháng' },
                  { id: '12', label: '12 tháng' },
                ]}
              />
            </div>
          </div>

          <MultiMonthTrendChart
            data={trendPoints}
            mode={trendMode}
            selectedMonth={selectedMonth}
            onSelectMonth={onChangeMonth}
            isDark={isDark}
          />
        </section>

        {/* Monthly Budgets Widget */}
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
                  Ngân sách {formatMonthLabel(selectedMonth)}
                </h2>
                <p className="text-xs text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                  {exceededCount > 0
                    ? `${exceededCount} danh mục vượt mức${
                        warningCount > 0 ? ` · ${warningCount} sắp chạm ngưỡng` : ''
                      }`
                    : warningCount > 0
                    ? `${warningCount} danh mục sắp chạm ngưỡng 80%`
                    : budgetEvaluations.length > 0
                    ? 'Tất cả danh mục đang trong tầm kiểm soát'
                    : 'Đặt hạn mức để nhận cảnh báo chi tiêu sớm'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenBudgetModal}
                className="aui-btn text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline whitespace-nowrap shrink-0"
              >
                + Đặt mức
              </button>
            </div>

            {budgetEvaluations.length === 0 ? (
              <div className="py-8 text-center space-y-2.5 border-t border-[#E4E2DB] dark:border-[#262F3D]">
                <p className="text-xs text-[#63625C] dark:text-[#8E98A8]">
                  Chưa thiết lập ngân sách cho danh mục chi tiêu nào.
                </p>
                <button
                  type="button"
                  onClick={onOpenBudgetModal}
                  className="aui-btn px-3.5 py-1.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold"
                >
                  Tạo ngân sách đầu tiên
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D] border-t border-[#E4E2DB] dark:border-[#262F3D]">
                {budgetEvaluations.slice(0, 5).map((item) => {
                  const barPct = Math.min(100, item.ratioPct);
                  const isExceeded = item.status === 'EXCEEDED';
                  const isWarn = item.status === 'WARNING';
                  const catForecast = forecastByCategory.get(item.category);
                  const isProjectedExceed =
                    !isExceeded && catForecast?.status === 'PROJECTED_EXCEED';
                  return (
                    <div key={item.rule.id} className="py-3 first:pt-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
                          {item.category}
                        </span>
                        <span className="font-num text-[#63625C] dark:text-[#8E98A8] shrink-0">
                          <strong
                            className={
                              isExceeded
                                ? 'text-[#BE123C] dark:text-[#FB7185]'
                                : isWarn || isProjectedExceed
                                ? 'text-[#B45309] dark:text-[#FBBF24]'
                                : 'text-[#141413] dark:text-[#ECEBE6]'
                            }
                          >
                            {formatVND(item.spent, true)}
                          </strong>{' '}
                          / {formatVND(item.limitAmount, true)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#EFEDE7] dark:bg-[#1C2430] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isExceeded
                              ? 'bg-[#BE123C] dark:bg-[#FB7185]'
                              : isWarn || isProjectedExceed
                              ? 'bg-[#B45309] dark:bg-[#FBBF24]'
                              : 'bg-[#0E5A4F] dark:bg-[#38B29A]'
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            isExceeded
                              ? 'text-[#BE123C] dark:text-[#FB7185]'
                              : isWarn || isProjectedExceed
                              ? 'text-[#B45309] dark:text-[#FBBF24]'
                              : 'text-[#137A4B] dark:text-[#34D399]'
                          }`}
                        >
                          {isExceeded ? (
                            <>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Vượt {formatVND(Math.abs(item.remaining), true)}</span>
                            </>
                          ) : isProjectedExceed && catForecast ? (
                            <>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>
                                Dự báo cuối tháng {formatVND(catForecast.projectedSpend, true)}
                              </span>
                            </>
                          ) : isWarn ? (
                            <>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Sắp chạm ngưỡng ({Math.round(item.ratioPct)}%)</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Còn {formatVND(item.remaining, true)}</span>
                            </>
                          )}
                        </span>
                        <span className="font-num text-[#63625C] dark:text-[#8E98A8] shrink-0">
                          {Math.round(item.ratioPct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('CASHFLOW')}
            className="aui-btn w-full pt-3 border-t border-[#E4E2DB] dark:border-[#262F3D] text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] hover:text-[#0E5A4F] dark:hover:text-[#38B29A] flex items-center justify-between"
          >
            <span>Quản lý toàn bộ ngân sách &amp; sổ Thu – Chi</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>
      </div>
    </div>
  );
}
