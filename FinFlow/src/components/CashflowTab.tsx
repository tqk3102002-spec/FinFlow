import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit2,
  Plus,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import { GlidingTabs } from './AnimateUI';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type BudgetEvaluation,
  type BudgetRule,
  type CashflowEntry,
  type CashflowType,
  type MonthlyCashflowSummary,
  type Wallet,
} from '../types/finance';
import {
  exportCashflowsToCsv,
  formatDateVN,
  formatMonthLabel,
  formatSignedVND,
  formatVND,
  getCategoryColor,
} from '../lib/accounting';

export function CashflowTab({
  selectedMonth,
  onChangeMonth,
  monthlyCashflow,
  allCashflows,
  wallets,
  budgetEvaluations,
  onOpenCashflowModal,
  onDeleteCashflow,
  onOpenBudgetModal,
  onDeleteBudget,
  onToast,
  tabDirection,
}: {
  selectedMonth: string;
  onChangeMonth: (ym: string) => void;
  monthlyCashflow: MonthlyCashflowSummary;
  allCashflows: CashflowEntry[];
  wallets: Wallet[];
  budgetEvaluations: BudgetEvaluation[];
  onOpenCashflowModal: (type: CashflowType, record?: CashflowEntry) => void;
  onDeleteCashflow: (item: CashflowEntry) => void;
  onOpenBudgetModal: (rule?: BudgetRule) => void;
  onDeleteBudget: (rule: BudgetRule) => void;
  onToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  tabDirection: number;
}) {
  const [cfFilterType, setCfFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [cfFilterCat, setCfFilterCat] = useState('ALL');
  const [cfSearch, setCfSearch] = useState('');

  const filteredCashflows = useMemo(() => {
    const q = cfSearch.trim().toLowerCase();
    return monthlyCashflow.inMonth
      .filter((c) => (cfFilterType === 'ALL' ? true : c.type === cfFilterType))
      .filter((c) => (cfFilterCat === 'ALL' ? true : c.category === cfFilterCat))
      .filter(
        (c) =>
          !q ||
          (c.note || '').toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const cmp = String(b.date || '').localeCompare(String(a.date || ''));
        return cmp !== 0 ? cmp : (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [monthlyCashflow.inMonth, cfFilterType, cfFilterCat, cfSearch]);

  const totalBudgetLimit = budgetEvaluations.reduce((s, b) => s + b.limitAmount, 0);
  const totalBudgetSpent = budgetEvaluations.reduce((s, b) => s + b.spent, 0);
  const overallBudgetPct = totalBudgetLimit > 0 ? (totalBudgetSpent / totalBudgetLimit) * 100 : 0;

  const handleExportMonthCsv = () => {
    if (filteredCashflows.length === 0) {
      onToast('Không có giao dịch nào trong tháng đang chọn để xuất CSV.', 'warning');
      return;
    }
    exportCashflowsToCsv(filteredCashflows, wallets, selectedMonth);
    onToast(`Đã xuất ${filteredCashflows.length} giao dịch ${formatMonthLabel(selectedMonth)} ra CSV.`);
  };

  const handleExportAllCsv = () => {
    if (allCashflows.length === 0) {
      onToast('Chưa có giao dịch Thu – Chi nào để xuất CSV.', 'warning');
      return;
    }
    exportCashflowsToCsv(allCashflows, wallets, 'TatCa');
    onToast(`Đã xuất toàn bộ ${allCashflows.length} giao dịch Thu – Chi ra CSV.`);
  };

  return (
    <div
      key="panel-cashflow"
      style={{ '--aui-panel-x': `${tabDirection * 10}px` } as React.CSSProperties}
      className="aui-panel-in space-y-6"
    >
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] bg-white dark:bg-[#151B23] font-num focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
          />
          <span className="text-xs text-[#63625C] dark:text-[#8E98A8]">
            {monthlyCashflow.inMonth.length} giao dịch trong tháng
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportMonthCsv}
            className="aui-btn px-3 py-2 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Xuất danh sách đang lọc ra file CSV chuẩn Excel tiếng Việt"
          >
            <Download className="w-3.5 h-3.5 text-[#63625C] dark:text-[#8E98A8]" />
            <span>Xuất CSV tháng</span>
          </button>
          <button
            type="button"
            onClick={handleExportAllCsv}
            className="aui-btn px-3 py-2 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
            <span>CSV toàn bộ</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCashflowModal('INCOME')}
            className="aui-btn px-3.5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ghi khoản Thu</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenCashflowModal('EXPENSE')}
            className="aui-btn px-3.5 py-2 rounded-lg bg-[#BE123C] hover:bg-[#9F1239] dark:bg-[#FB7185] dark:hover:bg-[#F43F5E] text-white dark:text-[#0D1117] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ghi khoản Chi</span>
          </button>
        </div>
      </div>

      {/* Unified Editorial Monthly KPI Strip */}
      <div className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E2DB] dark:divide-[#262F3D] font-num">
        <div className="p-5">
          <div className="text-[11px] font-sans uppercase tracking-[0.05em] font-semibold text-[#63625C] dark:text-[#8E98A8]">
            Tổng Thu {formatMonthLabel(selectedMonth)}
          </div>
          <div className="mt-1.5 text-xl font-semibold text-[#137A4B] dark:text-[#34D399]">
            {formatVND(monthlyCashflow.totalIncome)}
          </div>
        </div>
        <div className="p-5">
          <div className="text-[11px] font-sans uppercase tracking-[0.05em] font-semibold text-[#63625C] dark:text-[#8E98A8]">
            Tổng Chi {formatMonthLabel(selectedMonth)}
          </div>
          <div className="mt-1.5 text-xl font-semibold text-[#BE123C] dark:text-[#FB7185]">
            {formatVND(monthlyCashflow.totalExpense)}
          </div>
        </div>
        <div className="p-5">
          <div className="text-[11px] font-sans uppercase tracking-[0.05em] font-semibold text-[#63625C] dark:text-[#8E98A8]">
            Số dư ròng tháng
          </div>
          <div
            className={`mt-1.5 text-xl font-semibold ${
              monthlyCashflow.netBalance >= 0
                ? 'text-[#141413] dark:text-[#ECEBE6]'
                : 'text-[#BE123C] dark:text-[#FB7185]'
            }`}
          >
            {formatSignedVND(monthlyCashflow.netBalance)}
          </div>
        </div>
      </div>

      {/* NGÂN SÁCH CHI TIÊU THÁNG & CẢNH BÁO VƯỢT MỨC */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A]" />
              <span>Ngân sách chi tiêu ({formatMonthLabel(selectedMonth)})</span>
            </h2>
            <p className="text-xs text-[#63625C] dark:text-[#8E98A8] mt-0.5">
              {totalBudgetLimit > 0 ? (
                <>
                  Đã dùng{' '}
                  <strong className="font-num text-[#141413] dark:text-[#ECEBE6]">
                    {formatVND(totalBudgetSpent)}
                  </strong>{' '}
                  / <span className="font-num">{formatVND(totalBudgetLimit)}</span> (
                  <span className="font-num font-semibold">{Math.round(overallBudgetPct)}%</span>)
                  · Cảnh báo tự động từ 80% và khi vượt 100%
                </>
              ) : (
                'Đặt giới hạn chi tiêu cho từng danh mục để kiểm soát dòng tiền chủ động'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenBudgetModal()}
            className="aui-btn px-3 py-1.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm hạn mức</span>
          </button>
        </div>

        {budgetEvaluations.length === 0 ? (
          <div className="py-8 px-5 text-center text-xs text-[#63625C] dark:text-[#8E98A8]">
            Chưa có hạn mức ngân sách nào. Nhấn <strong>“Thêm hạn mức”</strong> để thiết lập mức chi tối đa cho Ăn uống, Mua sắm, Nhà cửa...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 -mb-px -mr-px">
            {budgetEvaluations.map((item) => {
              const isExceeded = item.status === 'EXCEEDED';
              const isWarn = item.status === 'WARNING';
              const barPct = Math.min(100, item.ratioPct);
              return (
                <div
                  key={item.rule.id}
                  className={`p-4 border-b border-r border-[#E4E2DB] dark:border-[#262F3D] space-y-2.5 ${
                    isExceeded
                      ? 'bg-[#FFF1F3]/60 dark:bg-[#2A141A]/45'
                      : isWarn
                      ? 'bg-[#FFFBEB]/60 dark:bg-[#261E0F]/45'
                      : 'bg-white dark:bg-[#151B23]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6]">
                          {item.category}
                        </span>
                        <span className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                          · {item.isMonthOverride ? formatMonthLabel(selectedMonth) : 'Mặc định hàng tháng'}
                        </span>
                      </div>
                      <div className="text-xs font-num mt-0.5 text-[#63625C] dark:text-[#8E98A8]">
                        <strong
                          className={
                            isExceeded
                              ? 'text-[#BE123C] dark:text-[#FB7185]'
                              : isWarn
                              ? 'text-[#B45309] dark:text-[#FBBF24]'
                              : 'text-[#141413] dark:text-[#ECEBE6]'
                          }
                        >
                          {formatVND(item.spent)}
                        </strong>{' '}
                        / {formatVND(item.limitAmount)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenBudgetModal(item.rule)}
                        className="aui-btn p-1.5 rounded-md text-[#63625C] dark:text-[#8E98A8] hover:text-[#0E5A4F] dark:hover:text-[#38B29A] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430]"
                        title="Sửa hạn mức"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBudget(item.rule)}
                        className="aui-btn p-1.5 rounded-md text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F3] dark:hover:bg-[#2A141A]"
                        title="Xóa hạn mức"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-[#EFEDE7] dark:bg-[#1C2430] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isExceeded
                          ? 'bg-[#BE123C] dark:bg-[#FB7185]'
                          : isWarn
                          ? 'bg-[#B45309] dark:bg-[#FBBF24]'
                          : 'bg-[#0E5A4F] dark:bg-[#38B29A]'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isExceeded
                          ? 'text-[#BE123C] dark:text-[#FB7185]'
                          : isWarn
                          ? 'text-[#B45309] dark:text-[#FBBF24]'
                          : 'text-[#137A4B] dark:text-[#34D399]'
                      }`}
                    >
                      {isExceeded ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Vượt mức +{formatVND(Math.abs(item.remaining))}</span>
                        </>
                      ) : isWarn ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Sắp chạm ngưỡng · Còn {formatVND(item.remaining)}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Trong hạn mức · Còn {formatVND(item.remaining)}</span>
                        </>
                      )}
                    </span>
                    <span className="font-num font-semibold text-[#63625C] dark:text-[#8E98A8]">
                      {Math.round(item.ratioPct)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] p-3.5 flex flex-wrap items-center gap-2.5">
        <GlidingTabs
          variant="segmented"
          value={cfFilterType}
          onChange={(id) => {
            setCfFilterType(id as 'ALL' | 'INCOME' | 'EXPENSE');
            setCfFilterCat('ALL');
          }}
          items={[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'INCOME', label: 'Thu' },
            { id: 'EXPENSE', label: 'Chi' },
          ]}
        />
        <select
          value={cfFilterCat}
          onChange={(e) => setCfFilterCat(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] text-xs text-[#141413] dark:text-[#ECEBE6] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
        >
          <option value="ALL">Tất cả danh mục</option>
          {(cfFilterType === 'INCOME'
            ? INCOME_CATEGORIES
            : cfFilterType === 'EXPENSE'
            ? EXPENSE_CATEGORIES
            : [
                ...EXPENSE_CATEGORIES,
                ...INCOME_CATEGORIES.filter(
                  (i) => !EXPENSE_CATEGORIES.some((e) => e.id === i.id)
                ),
              ]
          ).map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-[#8E8D86] dark:text-[#6E7887] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={cfSearch}
            onChange={(e) => setCfSearch(e.target.value)}
            placeholder="Tìm ghi chú, danh mục..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-xs text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
          />
        </div>
      </div>

      {/* Ledger list */}
      <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
        {filteredCashflows.length === 0 ? (
          <div className="p-10 text-center space-y-2.5">
            <p className="text-xs text-[#63625C] dark:text-[#8E98A8]">
              Không có khoản thu chi nào trong {formatMonthLabel(selectedMonth)} khớp bộ lọc.
            </p>
            <button
              type="button"
              onClick={() => onOpenCashflowModal('EXPENSE')}
              className="aui-btn px-3.5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold"
            >
              Ghi khoản giao dịch mới
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D]">
            {filteredCashflows.map((item) => {
              const linkedWallet = wallets.find((w) => w.id === item.walletId);
              const color = getCategoryColor(item.type, item.category);
              return (
                <div
                  key={item.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F6F5F1]/70 dark:hover:bg-[#1C2430]/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-1.5 flex-wrap">
                        <span>{item.category}</span>
                        {linkedWallet && (
                          <span className="font-normal text-[#63625C] dark:text-[#8E98A8]">
                            · {linkedWallet.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] truncate mt-0.5 font-num">
                        {formatDateVN(item.date)}
                        {item.note && (
                          <span className="font-sans"> · {item.note}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-sm font-semibold font-num ${
                        item.type === 'INCOME'
                          ? 'text-[#137A4B] dark:text-[#34D399]'
                          : 'text-[#BE123C] dark:text-[#FB7185]'
                      }`}
                    >
                      {item.type === 'INCOME' ? '+' : '-'}
                      {formatVND(item.amount)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenCashflowModal(item.type, item)}
                        className="aui-btn p-1.5 rounded-md text-[#63625C] dark:text-[#8E98A8] hover:text-[#0E5A4F] dark:hover:text-[#38B29A] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430]"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCashflow(item)}
                        className="aui-btn p-1.5 rounded-md text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F3] dark:hover:bg-[#2A141A]"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
