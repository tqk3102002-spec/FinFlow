import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coins,
  Edit2,
  History,
  Landmark,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { GlidingTabs } from './AnimateUI';
import {
  getWalletCashGroup,
  type AccountingSummary,
  type AssetSubTabId,
  type AssetType,
  type CapitalTransfer,
  type EnrichedPosition,
  type InvestmentAuditKind,
  type InvestmentTrade,
  type TradeSide,
  type Wallet,
} from '../types/finance';
import {
  formatDateVN,
  formatPercent,
  formatQty,
  formatSignedVND,
  formatUSD,
  formatVND,
  getWalletTypeMeta,
} from '../lib/accounting';

export function AssetsTab({
  accounting,
  wallets,
  assetSubTab,
  onChangeSubTab,
  walletGroupTab: externalWalletGroupTab,
  onChangeWalletGroupTab,
  binanceWsStatus,
  usdtVndRate,
  onUpdateUsdtRate,
  onOpenWalletModal,
  onDeleteWallet,
  onOpenInvestModal,
  onDeleteInvestment,
  onOpenTransferModal,
  onDeleteTransfer,
  onManualPriceOverride,
  tabDirection,
}: {
  accounting: AccountingSummary;
  wallets: Wallet[];
  assetSubTab: AssetSubTabId;
  onChangeSubTab: (sub: AssetSubTabId) => void;
  walletGroupTab?: 'LIVING' | 'INVESTMENT';
  onChangeWalletGroupTab?: (g: 'LIVING' | 'INVESTMENT') => void;
  binanceWsStatus: string;
  usdtVndRate: number;
  onUpdateUsdtRate: (rate: number) => void;
  onOpenWalletModal: (wallet?: Wallet) => void;
  onDeleteWallet: (wallet: Wallet) => void;
  onOpenInvestModal: (
    assetType: AssetType,
    symbol?: string,
    side?: TradeSide,
    record?: InvestmentTrade
  ) => void;
  onDeleteInvestment: (tx: InvestmentTrade) => void;
  onOpenTransferModal: () => void;
  onDeleteTransfer: (transfer: CapitalTransfer) => void;
  onManualPriceOverride: (pos: EnrichedPosition, rawInput: string) => void;
  tabDirection: number;
}) {
  const [internalWalletGroupTab, setInternalWalletGroupTab] = useState<'LIVING' | 'INVESTMENT'>(
    'LIVING'
  );
  const walletGroupTab = externalWalletGroupTab ?? internalWalletGroupTab;
  const setWalletGroupTab = (next: 'LIVING' | 'INVESTMENT') => {
    setInternalWalletGroupTab(next);
    onChangeWalletGroupTab?.(next);
  };
  const [showClosedPositions, setShowClosedPositions] = useState(false);
  const [expandLedgerInLiving, setExpandLedgerInLiving] = useState(false);
  const [expandedSymbols, setExpandedSymbols] = useState<Record<string, boolean>>({});
  const [inlinePriceKey, setInlinePriceKey] = useState<string | null>(null);
  const [inlinePriceVal, setInlinePriceVal] = useState('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'SELL' | 'BUY' | 'TRANSFER'>('ALL');
  const [auditSearch, setAuditSearch] = useState('');

  const isTotalProfitDown = accounting.totalInvestmentPnLVnd < 0;
  const isRealizedDown = accounting.totalRealizedPnLVnd < 0;
  const isInvCashNegative = accounting.investmentCashVnd < 0;
  const totalCapitalBaseVnd = accounting.netDepositVnd + accounting.ledgerOpeningAdjustmentVnd;
  const totalInvestmentAccountVnd = accounting.investmentCashVnd + accounting.totalInvestedMarketVnd;
  const isLivingWalletsView = assetSubTab === 'WALLETS' && walletGroupTab === 'LIVING';
  const showFullLedgerStrip = !isLivingWalletsView || expandLedgerInLiving;

  const livingWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'LIVING'),
    [wallets]
  );
  const investmentWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'INVESTMENT'),
    [wallets]
  );

  const visibleWallets = walletGroupTab === 'LIVING' ? livingWallets : investmentWallets;

  const totalClosedRealizedVnd = useMemo(
    () =>
      accounting.closedPositions.reduce(
        (sum, pos) => sum + (pos.isCrypto ? pos.realizedPnL * usdtVndRate : pos.realizedPnL),
        0
      ),
    [accounting.closedPositions, usdtVndRate]
  );

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return accounting.auditLogs.filter((entry) => {
      if (auditFilter === 'SELL' && entry.kind !== 'SELL') return false;
      if (auditFilter === 'BUY' && entry.kind !== 'BUY') return false;
      if (auditFilter === 'TRANSFER' && entry.kind !== 'DEPOSIT' && entry.kind !== 'WITHDRAW') {
        return false;
      }
      if (!q) return true;
      return (
        (entry.symbol || '').toLowerCase().includes(q) ||
        entry.autoSummary.toLowerCase().includes(q) ||
        entry.note.toLowerCase().includes(q) ||
        (entry.sourceWalletName || '').toLowerCase().includes(q) ||
        (entry.targetWalletName || '').toLowerCase().includes(q)
      );
    });
  }, [accounting.auditLogs, auditFilter, auditSearch]);

  const commitInlinePrice = (pos: EnrichedPosition) => {
    onManualPriceOverride(pos, inlinePriceVal);
    setInlinePriceKey(null);
  };

  return (
    <div
      key="panel-assets"
      style={{ '--aui-panel-x': `${tabDirection * 10}px` } as React.CSSProperties}
      className="aui-panel-in space-y-5"
    >
      {/* THANH TỔNG HỢP ĐẦU TRANG + DẢI LUỒNG TIỀN ĐẦU TƯ 4 BƯỚC */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-num">
            <span className="text-[#63625C] dark:text-[#8E98A8]">
              NAV{' '}
              <strong className="text-sm text-[#141413] dark:text-[#ECEBE6]">
                {formatVND(accounting.totalMarketNavVnd)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
              ·
            </span>
            <span className="text-[#63625C] dark:text-[#8E98A8]">
              Sinh hoạt{' '}
              <strong className="text-[#B47B2B] dark:text-[#E2B05E]">
                {formatVND(accounting.livingCashVnd, true)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
              ·
            </span>
            <span className="text-[#63625C] dark:text-[#8E98A8]">
              Kênh đầu tư{' '}
              <strong className="text-[#0F766E] dark:text-[#2DD4BF]">
                {formatVND(totalInvestmentAccountVnd, true)}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenTransferModal}
              className="aui-btn px-3 py-1.5 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
              <span>Nạp / Rút vốn</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenWalletModal()}
              className="aui-btn px-3 py-1.5 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#B47B2B] dark:text-[#E2B05E]" />
              <span>Thêm ví</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenInvestModal('VN_STOCK')}
              className="aui-btn px-3.5 py-1.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>GD Đầu tư</span>
            </button>
          </div>
        </div>

        {/* Dải Sổ cái kép Đầu tư: tự thu gọn 1 dòng khi xem Ví tiền → Sinh hoạt, hiện đủ khi xem Đầu tư */}
        {!showFullLedgerStrip ? (
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-num text-[#63625C] dark:text-[#8E98A8]">
              <span className="font-sans font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Sổ cái đầu tư
              </span>
              <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                ·
              </span>
              <span>
                Vốn nạp{' '}
                <strong className="text-[#141413] dark:text-[#ECEBE6]">
                  {formatVND(totalCapitalBaseVnd, true)}
                </strong>
              </span>
              <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                ·
              </span>
              <span>
                Chờ ĐT{' '}
                <strong
                  className={
                    isInvCashNegative
                      ? 'text-[#BE123C] dark:text-[#FB7185]'
                      : 'text-[#0F766E] dark:text-[#2DD4BF]'
                  }
                >
                  {formatVND(accounting.investmentCashVnd, true)}
                </strong>
              </span>
              <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                ·
              </span>
              <span>
                {isTotalProfitDown ? 'Lỗ' : 'Lãi'}{' '}
                <strong
                  className={
                    isTotalProfitDown
                      ? 'text-[#BE123C] dark:text-[#FB7185]'
                      : 'text-[#137A4B] dark:text-[#34D399]'
                  }
                >
                  {formatSignedVND(accounting.totalInvestmentPnLVnd, true)}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setExpandLedgerInLiving(true)}
              className="aui-btn inline-flex items-center gap-1 text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline whitespace-nowrap shrink-0"
            >
              <span>Mở rộng sổ cái</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E4E2DB] dark:divide-[#262F3D] font-num">
              <div className="px-4 py-3">
                <div className="text-[11px] font-sans text-[#63625C] dark:text-[#8E98A8]">
                  1. Vốn nạp ròng (Vào − Ra)
                </div>
                <div className="text-sm sm:text-base font-bold text-[#141413] dark:text-[#ECEBE6] mt-0.5">
                  {formatVND(totalCapitalBaseVnd)}
                </div>
                <div className="text-[10px] font-sans text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                  Nạp {formatVND(accounting.totalDepositedVnd, true)} · Rút{' '}
                  {formatVND(accounting.totalWithdrawnVnd, true)}
                  {accounting.ledgerOpeningAdjustmentVnd > 0 && (
                    <> · Khởi tạo {formatVND(accounting.ledgerOpeningAdjustmentVnd, true)}</>
                  )}
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="text-[11px] font-sans text-[#63625C] dark:text-[#8E98A8]">
                  2. Tiền chờ ĐT còn lại
                </div>
                <div
                  className={`text-sm sm:text-base font-bold mt-0.5 ${
                    isInvCashNegative
                      ? 'text-[#BE123C] dark:text-[#FB7185]'
                      : 'text-[#0F766E] dark:text-[#2DD4BF]'
                  }`}
                >
                  {formatVND(accounting.investmentCashVnd)}
                </div>
                <div className="text-[10px] font-sans text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                  {isInvCashNegative ? (
                    <span className="text-[#BE123C] dark:text-[#FB7185] font-medium">
                      Thiếu vốn · Cần nạp thêm
                    </span>
                  ) : (
                    'Nạp − Rút − Mua + Bán'
                  )}
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="text-[11px] font-sans text-[#63625C] dark:text-[#8E98A8]">
                  3. Đang đầu tư (Thị trường)
                </div>
                <div className="text-sm sm:text-base font-bold text-[#0E5A4F] dark:text-[#38B29A] mt-0.5">
                  {formatVND(accounting.totalInvestedMarketVnd)}
                </div>
                <div className="text-[10px] font-sans text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                  Vốn đang mở {formatVND(accounting.totalInvestedCostVnd, true)} ·{' '}
                  {accounting.allPositions.length} mã
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="text-[11px] font-sans text-[#63625C] dark:text-[#8E98A8]">
                  4. Tổng Lỗ / Lãi đầu tư
                </div>
                <div
                  className={`text-sm sm:text-base font-bold mt-0.5 ${
                    isTotalProfitDown
                      ? 'text-[#BE123C] dark:text-[#FB7185]'
                      : 'text-[#137A4B] dark:text-[#34D399]'
                  }`}
                >
                  {formatSignedVND(accounting.totalInvestmentPnLVnd)}
                </div>
                <div className="text-[10px] font-sans text-[#63625C] dark:text-[#8E98A8] mt-0.5">
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
            </div>

            {isLivingWalletsView && (
              <div className="px-4 py-2 border-t border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/40 dark:bg-[#0D1117]/35 flex justify-end">
                <button
                  type="button"
                  onClick={() => setExpandLedgerInLiving(false)}
                  className="aui-btn inline-flex items-center gap-1 text-[11px] font-semibold text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] whitespace-nowrap"
                >
                  <span>Thu gọn sổ cái</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bộ chọn nhóm tài sản */}
      <GlidingTabs
        variant="subtab"
        value={assetSubTab}
        onChange={(v) => onChangeSubTab(v as AssetSubTabId)}
        items={[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'WALLETS', label: `Ví tiền (${wallets.length})` },
          { id: 'VN_STOCK', label: `Cổ phiếu VN (${accounting.vnStocks.length})` },
          { id: 'CRYPTO', label: `Crypto (${accounting.cryptos.length})` },
          { id: 'HISTORY', label: `Nhật ký (${accounting.auditLogs.length})` },
        ]}
      />

      {/* MỤC 1: VÍ & TIỀN MẶT — THANH TAB NGANG SINH HOẠT / CHỜ ĐẦU TƯ + DANH SÁCH 1 DÒNG TINH GỌN */}
      {(assetSubTab === 'ALL' || assetSubTab === 'WALLETS') && (
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Landmark className="w-4 h-4 text-[#B47B2B] dark:text-[#E2B05E] shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-semibold text-[#141413] dark:text-[#ECEBE6] whitespace-nowrap">
                Ví &amp; Tiền mặt
              </h2>
              <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                ·
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#141413] dark:text-[#ECEBE6] font-num whitespace-nowrap">
                {formatVND(accounting.totalCashVnd)}
              </span>
            </div>

            {walletGroupTab === 'LIVING' ? (
              <button
                type="button"
                onClick={() => onOpenWalletModal()}
                className="aui-btn text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline whitespace-nowrap shrink-0"
              >
                + Thêm ví
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenTransferModal}
                className="aui-btn text-xs font-semibold text-[#0F766E] dark:text-[#2DD4BF] hover:underline whitespace-nowrap shrink-0"
              >
                Nạp / Rút vốn
              </button>
            )}
          </div>

          {/* Thanh tab ngang điều hướng giữa Sinh hoạt và Chờ đầu tư */}
          <div
            role="tablist"
            aria-label="Phân loại ví tiền"
            className="px-5 border-b border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/45 dark:bg-[#0D1117]/35 flex items-center gap-6 overflow-x-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={walletGroupTab === 'LIVING'}
              onClick={() => setWalletGroupTab('LIVING')}
              className={`relative py-2.5 -mb-px border-b-2 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none ${
                walletGroupTab === 'LIVING'
                  ? 'border-[#0E5A4F] dark:border-[#38B29A] text-[#141413] dark:text-[#ECEBE6] font-semibold'
                  : 'border-transparent text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
              }`}
            >
              <span>Sinh hoạt</span>
              <span className="font-num text-[#63625C] dark:text-[#8E98A8]">
                ({livingWallets.length})
              </span>
              <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                ·
              </span>
              <span className="font-num font-semibold text-[#B47B2B] dark:text-[#E2B05E]">
                {formatVND(accounting.livingCashVnd, true)}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={walletGroupTab === 'INVESTMENT'}
              onClick={() => setWalletGroupTab('INVESTMENT')}
              className={`relative py-2.5 -mb-px border-b-2 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none ${
                walletGroupTab === 'INVESTMENT'
                  ? 'border-[#0E5A4F] dark:border-[#38B29A] text-[#141413] dark:text-[#ECEBE6] font-semibold'
                  : 'border-transparent text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
              }`}
            >
              <span>Chờ đầu tư</span>
              <span className="font-num text-[#63625C] dark:text-[#8E98A8]">
                ({investmentWallets.length})
              </span>
              <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                ·
              </span>
              <span
                className={`font-num font-semibold ${
                  isInvCashNegative
                    ? 'text-[#BE123C] dark:text-[#FB7185]'
                    : 'text-[#0F766E] dark:text-[#2DD4BF]'
                }`}
              >
                {formatVND(accounting.investmentCashVnd, true)}
              </span>
              {isInvCashNegative && (
                <span className="text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]">
                  Thiếu vốn
                </span>
              )}
            </button>
          </div>

          {visibleWallets.length === 0 ? (
            <div className="px-5 py-7 flex flex-wrap items-center justify-between gap-3 text-xs text-[#63625C] dark:text-[#8E98A8]">
              <span>
                {walletGroupTab === 'LIVING'
                  ? 'Chưa có ví tiền mặt sinh hoạt hoặc sổ tiết kiệm nào.'
                  : 'Chưa có ví Tiền chờ đầu tư (sức mua trên sàn).'}
              </span>
              {walletGroupTab === 'LIVING' ? (
                <button
                  type="button"
                  onClick={() => onOpenWalletModal()}
                  className="aui-btn text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline whitespace-nowrap"
                >
                  + Thêm ví sinh hoạt
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenTransferModal}
                  className="aui-btn text-xs font-semibold text-[#0F766E] dark:text-[#2DD4BF] hover:underline whitespace-nowrap"
                >
                  Nạp vốn đầu tư ngay
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D]">
              {visibleWallets.map((w) => {
                const meta = getWalletTypeMeta(w.type);
                const isInvGroup = walletGroupTab === 'INVESTMENT';
                const displayBalance = isInvGroup
                  ? (accounting.investmentWalletBalances[w.id] ?? w.balance)
                  : w.balance;
                const isNegativeInv = isInvGroup && displayBalance < 0;
                return (
                  <div
                    key={w.id}
                    title={w.note || undefined}
                    className="group px-5 min-h-[44px] py-2.5 flex items-center justify-between gap-4 hover:bg-[#F6F5F1]/65 dark:hover:bg-[#1C2430]/45 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
                        {w.name}
                      </span>
                      <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848] shrink-0">
                        ·
                      </span>
                      <span className="text-xs text-[#63625C] dark:text-[#8E98A8] whitespace-nowrap shrink-0">
                        {isInvGroup && w.type === 'INVESTMENT' ? 'Sức mua' : meta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2 font-num">
                        {isNegativeInv && (
                          <span className="text-[11px] font-sans font-medium text-[#BE123C] dark:text-[#FB7185] whitespace-nowrap">
                            Thiếu vốn
                          </span>
                        )}
                        <span
                          className={`text-sm font-semibold whitespace-nowrap ${
                            isNegativeInv
                              ? 'text-[#BE123C] dark:text-[#FB7185]'
                              : isInvGroup
                              ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                              : 'text-[#141413] dark:text-[#ECEBE6]'
                          }`}
                        >
                          {formatVND(displayBalance)}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-150">
                        <button
                          type="button"
                          onClick={() => onOpenWalletModal(w)}
                          aria-label={`Sửa ví ${w.name}`}
                          className="aui-btn p-1.5 rounded-md text-[#8E8D86] dark:text-[#6E7887] hover:text-[#0E5A4F] dark:hover:text-[#38B29A] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E5A4F] dark:focus-visible:ring-[#38B29A]"
                          title="Sửa ví"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWallet(w)}
                          aria-label={`Xóa ví ${w.name}`}
                          className="aui-btn p-1.5 rounded-md text-[#8E8D86] dark:text-[#6E7887] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F3] dark:hover:bg-[#2A141A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE123C] dark:focus-visible:ring-[#FB7185]"
                          title="Xóa ví"
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

          {walletGroupTab === 'INVESTMENT' && (
            <div className="px-5 py-2.5 bg-[#F6F5F1]/45 dark:bg-[#0D1117]/40 border-t border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
              <span className="font-num">
                Sổ cái kép: Nạp − Rút − Mua + Bán · {isRealizedDown ? 'Lỗ đã chốt' : 'Lãi đã chốt'}:{' '}
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
              </span>
              <button
                type="button"
                onClick={onOpenTransferModal}
                className="aui-btn font-semibold text-[#0F766E] dark:text-[#2DD4BF] hover:underline whitespace-nowrap"
              >
                Nạp / Rút vốn →
              </button>
            </div>
          )}
        </section>
      )}

      {/* MỤC 2: CHỨNG KHOÁN VIỆT NAM — GỌN 5 CỘT, TÓM TẮT NGAY TRÊN TIÊU ĐỀ */}
      {(assetSubTab === 'ALL' || assetSubTab === 'VN_STOCK') && (
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <TrendingUp className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Chứng khoán VN
              </h2>
              {accounting.vnStocks.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                    ·
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#141413] dark:text-[#ECEBE6] font-num">
                    {formatVND(accounting.vnMarketVnd)}
                  </span>
                  <span
                    className={`text-xs font-semibold font-num ${
                      accounting.vnPnLVnd < 0
                        ? 'text-[#BE123C] dark:text-[#FB7185]'
                        : 'text-[#137A4B] dark:text-[#34D399]'
                    }`}
                  >
                    {formatSignedVND(accounting.vnPnLVnd, true)} (
                    {formatPercent(accounting.vnPnLPct, true)})
                  </span>
                </>
              )}
            </div>
            {accounting.vnStocks.length > 0 && (
              <span className="text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
                Vốn {formatVND(accounting.vnCostVnd, true)}
              </span>
            )}
          </div>

          {accounting.vnStocks.length === 0 ? (
            <div className="px-5 py-7 flex flex-wrap items-center justify-between gap-3 text-xs text-[#63625C] dark:text-[#8E98A8]">
              <span>Chưa có mã cổ phiếu Việt Nam nào đang nắm giữ.</span>
              <button
                type="button"
                onClick={() => onOpenInvestModal('VN_STOCK')}
                className="aui-btn font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline whitespace-nowrap"
              >
                + Thêm GD cổ phiếu
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F5F1]/60 dark:bg-[#0D1117]/50 text-[11px] text-[#63625C] dark:text-[#8E98A8] border-b border-[#E4E2DB] dark:border-[#262F3D]">
                    <th className="py-2.5 px-4 font-semibold">Mã / KL</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Giá TT / TB</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Giá trị / Vốn</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Lãi / Lỗ</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Lệnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D]">
                  {accounting.vnStocks.map((pos) => {
                    const expanded = Boolean(expandedSymbols[pos.key]);
                    const isProfit = pos.pnlVnd >= 0;
                    return (
                      <React.Fragment key={pos.key}>
                        <tr className="hover:bg-[#F6F5F1]/60 dark:hover:bg-[#1C2430]/45 transition-colors">
                          <td className="py-2.5 px-4">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() =>
                                setExpandedSymbols((p) => ({ ...p, [pos.key]: !p[pos.key] }))
                              }
                              className="flex items-center gap-2 text-left group"
                              title="Bấm xem chi tiết lô giao dịch"
                            >
                              {expanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[#8E8D86] dark:text-[#6E7887] group-hover:text-[#141413] dark:group-hover:text-[#ECEBE6] shrink-0" />
                              )}
                              <div>
                                <div className="font-bold text-[#141413] dark:text-[#ECEBE6]">
                                  {pos.symbol}
                                </div>
                                <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
                                  {formatQty(pos.currentQty, false)} CP
                                </div>
                              </div>
                            </button>
                          </td>

                          <td
                            onClick={() => {
                              setInlinePriceKey(pos.key);
                              setInlinePriceVal(String(pos.currentPrice));
                            }}
                            className="py-2.5 px-3 text-right font-num cursor-pointer hover:bg-[#0E5A4F]/[0.05] dark:hover:bg-[#38B29A]/[0.08]"
                            title="Bấm để sửa tay giá thị trường"
                          >
                            {inlinePriceKey === pos.key ? (
                              <input
                                type="text"
                                autoFocus
                                value={inlinePriceVal}
                                onChange={(e) => setInlinePriceVal(e.target.value)}
                                onBlur={() => commitInlinePrice(pos)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitInlinePrice(pos);
                                  if (e.key === 'Escape') setInlinePriceKey(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-24 px-2 py-0.5 text-right rounded border border-[#0E5A4F] dark:border-[#38B29A] bg-white dark:bg-[#0D1117] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold focus:outline-none"
                              />
                            ) : (
                              <div>
                                <div className="font-semibold text-[#141413] dark:text-[#ECEBE6] underline decoration-dashed decoration-[#C8C5BC] dark:decoration-[#3A4658] underline-offset-4">
                                  {formatVND(pos.currentPrice)}
                                </div>
                                <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                                  TB {formatVND(pos.avgCost)}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-num">
                            <div className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
                              {formatVND(pos.currentVnd)}
                            </div>
                            <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                              Vốn {formatVND(pos.investedVnd, true)}
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-right font-num">
                            <div
                              className={`font-semibold ${
                                isProfit
                                  ? 'text-[#137A4B] dark:text-[#34D399]'
                                  : 'text-[#BE123C] dark:text-[#FB7185]'
                              }`}
                            >
                              {formatSignedVND(pos.pnlVnd)}
                            </div>
                            <div
                              className={`text-[11px] font-medium ${
                                isProfit
                                  ? 'text-[#137A4B] dark:text-[#34D399]'
                                  : 'text-[#BE123C] dark:text-[#FB7185]'
                              }`}
                            >
                              {formatPercent(pos.pnlPercent, true)}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenInvestModal('VN_STOCK', pos.symbol, 'BUY')}
                                className="aui-btn px-2 py-1 rounded-md bg-[#137A4B]/[0.09] dark:bg-[#34D399]/[0.14] hover:bg-[#137A4B]/[0.16] dark:hover:bg-[#34D399]/[0.22] text-[#137A4B] dark:text-[#34D399] text-[11px] font-semibold"
                              >
                                Mua
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenInvestModal('VN_STOCK', pos.symbol, 'SELL')}
                                className="aui-btn px-2 py-1 rounded-md bg-[#BE123C]/[0.09] dark:bg-[#FB7185]/[0.14] hover:bg-[#BE123C]/[0.16] dark:hover:bg-[#FB7185]/[0.22] text-[#BE123C] dark:text-[#FB7185] text-[11px] font-semibold"
                              >
                                Bán
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expanded && (
                          <tr className="bg-[#F6F5F1]/65 dark:bg-[#0D1117]/50">
                            <td colSpan={5} className="px-5 py-3 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                                <span>
                                  {pos.exchange} · Nguồn giá: {pos.source} · {pos.lots.length} lô
                                  giao dịch
                                </span>
                                <span className="font-num">
                                  Giá vốn đầy đủ: {formatVND(pos.investedVnd)}
                                </span>
                              </div>
                              <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D] border-t border-b border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#151B23]">
                                {pos.lots.map((lot) => (
                                  <div
                                    key={lot.id}
                                    className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`font-bold ${
                                          lot.type === 'BUY'
                                            ? 'text-[#137A4B] dark:text-[#34D399]'
                                            : 'text-[#BE123C] dark:text-[#FB7185]'
                                        }`}
                                      >
                                        {lot.type === 'BUY' ? 'MUA' : 'BÁN'}
                                      </span>
                                      <span className="text-[#D4D1C7] dark:text-[#2E3848]">·</span>
                                      <span className="text-[#63625C] dark:text-[#8E98A8] font-num">
                                        {formatDateVN(lot.date)}
                                      </span>
                                      <span className="text-[#D4D1C7] dark:text-[#2E3848]">·</span>
                                      <span className="font-semibold text-[#141413] dark:text-[#ECEBE6] font-num">
                                        {formatQty(lot.quantity, false)} CP @ {formatVND(lot.price)}
                                      </span>
                                      {lot.feeValue > 0 && (
                                        <span className="text-[#63625C] dark:text-[#8E98A8] font-num">
                                          (Phí {formatVND(lot.feeValue)})
                                        </span>
                                      )}
                                      {lot.note && (
                                        <span className="text-[#63625C] dark:text-[#8E98A8]">
                                          · {lot.note}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 font-num">
                                      <span className="text-[#63625C] dark:text-[#8E98A8]">
                                        TB sau lệnh:{' '}
                                        <strong className="text-[#0E5A4F] dark:text-[#38B29A]">
                                          {formatVND(lot.avgCostAfter)}
                                        </strong>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onOpenInvestModal('VN_STOCK', '', 'BUY', lot)
                                        }
                                        className="text-[#63625C] dark:text-[#8E98A8] hover:text-[#0E5A4F] dark:hover:text-[#38B29A]"
                                        title="Sửa lệnh"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDeleteInvestment(lot)}
                                        className="text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185]"
                                        title="Xóa lệnh"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* MỤC 3: CRYPTO QUỐC TẾ — GỌN 5 CỘT, TÓM TẮT & TỶ GIÁ NGAY TRÊN TIÊU ĐỀ */}
      {(assetSubTab === 'ALL' || assetSubTab === 'CRYPTO') && (
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Coins className="w-4 h-4 text-[#2D5B78] dark:text-[#7EB2D4] shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Crypto
              </h2>
              {accounting.cryptos.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                    ·
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#141413] dark:text-[#ECEBE6] font-num">
                    {formatVND(accounting.cryptoMarketVnd)}
                  </span>
                  <span
                    className={`text-xs font-semibold font-num ${
                      accounting.cryptoPnLUsd < 0
                        ? 'text-[#BE123C] dark:text-[#FB7185]'
                        : 'text-[#137A4B] dark:text-[#34D399]'
                    }`}
                  >
                    {formatSignedVND(accounting.cryptoPnLVnd, true)} (
                    {formatPercent(accounting.cryptoPnLPct, true)})
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap text-[11px] text-[#63625C] dark:text-[#8E98A8]">
              <span className="inline-flex items-center gap-1 font-medium">
                {binanceWsStatus === 'CONNECTED' ? (
                  <>
                    <Wifi className="w-3 h-3 text-[#137A4B] dark:text-[#34D399]" />
                    <span className="text-[#137A4B] dark:text-[#34D399]">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-[#8E8D86] dark:text-[#6E7887]" />
                    <span>REST</span>
                  </>
                )}
              </span>
              <label className="flex items-center gap-1">
                <span>USDT</span>
                <input
                  type="number"
                  min="1000"
                  step="50"
                  value={usdtVndRate}
                  onChange={(e) => {
                    const v = Math.max(1000, Math.round(Number(e.target.value) || 25450));
                    onUpdateUsdtRate(v);
                  }}
                  className="w-20 px-1.5 py-0.5 rounded border border-[#E4E2DB] dark:border-[#262F3D] text-right font-semibold font-num text-[#141413] dark:text-[#ECEBE6] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
                />
                <span>đ</span>
              </label>
            </div>
          </div>

          {accounting.cryptos.length === 0 ? (
            <div className="px-5 py-7 flex flex-wrap items-center justify-between gap-3 text-xs text-[#63625C] dark:text-[#8E98A8]">
              <span>Chưa có đồng Crypto nào đang nắm giữ.</span>
              <button
                type="button"
                onClick={() => onOpenInvestModal('CRYPTO')}
                className="aui-btn font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline whitespace-nowrap"
              >
                + Thêm GD Crypto
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F5F1]/60 dark:bg-[#0D1117]/50 text-[11px] text-[#63625C] dark:text-[#8E98A8] border-b border-[#E4E2DB] dark:border-[#262F3D]">
                    <th className="py-2.5 px-4 font-semibold">Coin / SL</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Giá TT / TB</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Giá trị / Vốn</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Lãi / Lỗ</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Lệnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D]">
                  {accounting.cryptos.map((pos) => {
                    const expanded = Boolean(expandedSymbols[pos.key]);
                    const isProfit = pos.pnlUsd >= 0;
                    return (
                      <React.Fragment key={pos.key}>
                        <tr className="hover:bg-[#F6F5F1]/60 dark:hover:bg-[#1C2430]/45 transition-colors">
                          <td className="py-2.5 px-4">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() =>
                                setExpandedSymbols((p) => ({ ...p, [pos.key]: !p[pos.key] }))
                              }
                              className="flex items-center gap-2 text-left group"
                              title="Bấm xem chi tiết USD và từng lô giao dịch"
                            >
                              {expanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[#8E8D86] dark:text-[#6E7887] group-hover:text-[#141413] dark:group-hover:text-[#ECEBE6] shrink-0" />
                              )}
                              <div>
                                <div className="font-bold text-[#141413] dark:text-[#ECEBE6]">
                                  {pos.symbol}
                                </div>
                                <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
                                  {formatQty(pos.currentQty, true)}
                                </div>
                              </div>
                            </button>
                          </td>

                          <td
                            onClick={() => {
                              setInlinePriceKey(pos.key);
                              setInlinePriceVal(String(pos.currentPrice));
                            }}
                            className="py-2.5 px-3 text-right font-num cursor-pointer hover:bg-[#0E5A4F]/[0.05] dark:hover:bg-[#38B29A]/[0.08]"
                            title="Bấm để sửa tay giá USDT"
                          >
                            {inlinePriceKey === pos.key ? (
                              <input
                                type="text"
                                autoFocus
                                value={inlinePriceVal}
                                onChange={(e) => setInlinePriceVal(e.target.value)}
                                onBlur={() => commitInlinePrice(pos)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitInlinePrice(pos);
                                  if (e.key === 'Escape') setInlinePriceKey(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-24 px-2 py-0.5 text-right rounded border border-[#0E5A4F] dark:border-[#38B29A] bg-white dark:bg-[#0D1117] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold focus:outline-none"
                              />
                            ) : (
                              <div>
                                <div className="font-semibold text-[#141413] dark:text-[#ECEBE6] underline decoration-dashed decoration-[#C8C5BC] dark:decoration-[#3A4658] underline-offset-4">
                                  {formatUSD(pos.currentPrice)}
                                </div>
                                <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                                  TB {formatUSD(pos.avgCost)}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-num">
                            <div className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
                              {formatVND(pos.currentVnd)}
                            </div>
                            <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                              Vốn {formatVND(pos.investedVnd, true)}
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-right font-num">
                            <div
                              className={`font-semibold ${
                                isProfit
                                  ? 'text-[#137A4B] dark:text-[#34D399]'
                                  : 'text-[#BE123C] dark:text-[#FB7185]'
                              }`}
                            >
                              {formatSignedVND(pos.pnlVnd)}
                            </div>
                            <div
                              className={`text-[11px] font-medium ${
                                isProfit
                                  ? 'text-[#137A4B] dark:text-[#34D399]'
                                  : 'text-[#BE123C] dark:text-[#FB7185]'
                              }`}
                            >
                              {formatPercent(pos.pnlPercent, true)}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenInvestModal('CRYPTO', pos.symbol, 'BUY')}
                                className="aui-btn px-2 py-1 rounded-md bg-[#137A4B]/[0.09] dark:bg-[#34D399]/[0.14] hover:bg-[#137A4B]/[0.16] dark:hover:bg-[#34D399]/[0.22] text-[#137A4B] dark:text-[#34D399] text-[11px] font-semibold"
                              >
                                Mua
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenInvestModal('CRYPTO', pos.symbol, 'SELL')}
                                className="aui-btn px-2 py-1 rounded-md bg-[#BE123C]/[0.09] dark:bg-[#FB7185]/[0.14] hover:bg-[#BE123C]/[0.16] dark:hover:bg-[#FB7185]/[0.22] text-[#BE123C] dark:text-[#FB7185] text-[11px] font-semibold"
                              >
                                Bán
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expanded && (
                          <tr className="bg-[#F6F5F1]/65 dark:bg-[#0D1117]/50">
                            <td colSpan={5} className="px-5 py-3 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
                                <span className="font-sans">
                                  Nguồn giá: {pos.source} · {pos.lots.length} lô giao dịch
                                </span>
                                <span>
                                  GT {formatUSD(pos.currentUsd)} · Vốn {formatUSD(pos.investedUsd)}{' '}
                                  · Lãi/Lỗ{' '}
                                  <strong
                                    className={
                                      isProfit
                                        ? 'text-[#137A4B] dark:text-[#34D399]'
                                        : 'text-[#BE123C] dark:text-[#FB7185]'
                                    }
                                  >
                                    {pos.pnlUsd >= 0 ? '+' : ''}
                                    {formatUSD(pos.pnlUsd)}
                                  </strong>
                                </span>
                              </div>
                              <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D] border-t border-b border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#151B23]">
                                {pos.lots.map((lot) => (
                                  <div
                                    key={lot.id}
                                    className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`font-bold ${
                                          lot.type === 'BUY'
                                            ? 'text-[#137A4B] dark:text-[#34D399]'
                                            : 'text-[#BE123C] dark:text-[#FB7185]'
                                        }`}
                                      >
                                        {lot.type === 'BUY' ? 'MUA' : 'BÁN'}
                                      </span>
                                      <span className="text-[#D4D1C7] dark:text-[#2E3848]">·</span>
                                      <span className="text-[#63625C] dark:text-[#8E98A8] font-num">
                                        {formatDateVN(lot.date)}
                                      </span>
                                      <span className="text-[#D4D1C7] dark:text-[#2E3848]">·</span>
                                      <span className="font-semibold text-[#141413] dark:text-[#ECEBE6] font-num">
                                        {formatQty(lot.quantity, true)} {pos.symbol} @{' '}
                                        {formatUSD(lot.price)}
                                      </span>
                                      {lot.note && (
                                        <span className="text-[#63625C] dark:text-[#8E98A8]">
                                          · {lot.note}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 font-num">
                                      <span className="text-[#63625C] dark:text-[#8E98A8]">
                                        TB sau lệnh:{' '}
                                        <strong className="text-[#2D5B78] dark:text-[#7EB2D4]">
                                          {formatUSD(lot.avgCostAfter)}
                                        </strong>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => onOpenInvestModal('CRYPTO', '', 'BUY', lot)}
                                        className="text-[#63625C] dark:text-[#8E98A8] hover:text-[#0E5A4F] dark:hover:text-[#38B29A]"
                                        title="Sửa lệnh"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDeleteInvestment(lot)}
                                        className="text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185]"
                                        title="Xóa lệnh"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Ở TAB TẤT CẢ: DÒNG DẪN GỌN TỚI NHẬT KÝ BIẾN ĐỘNG (TRÁNH ĐỔ BẢNG DÀI RA NGOÀI) */}
      {assetSubTab === 'ALL' && (
        <button
          type="button"
          onClick={() => onChangeSubTab('HISTORY')}
          className="w-full bg-white dark:bg-[#151B23] hover:bg-[#F6F5F1]/70 dark:hover:bg-[#1C2430]/60 rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] px-5 py-3.5 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-2.5 text-xs min-w-0">
            <History className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
            <span className="font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
              Nhật ký biến động &amp; Chốt lời/lỗ
            </span>
            <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
              ·
            </span>
            <span className="text-[#63625C] dark:text-[#8E98A8] font-num whitespace-nowrap">
              {accounting.auditLogs.length} bút toán
            </span>
            {accounting.totalRealizedPnLVnd !== 0 && (
              <>
                <span aria-hidden="true" className="hidden sm:inline text-[#D4D1C7] dark:text-[#2E3848]">
                  ·
                </span>
                <span
                  className={`hidden sm:inline font-num font-semibold whitespace-nowrap ${
                    accounting.totalRealizedPnLVnd > 0
                      ? 'text-[#137A4B] dark:text-[#34D399]'
                      : 'text-[#BE123C] dark:text-[#FB7185]'
                  }`}
                >
                  {accounting.totalRealizedPnLVnd < 0 ? 'Lỗ chốt' : 'Lãi chốt'}{' '}
                  {formatSignedVND(accounting.totalRealizedPnLVnd, true)}
                </span>
              </>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E5A4F] dark:text-[#38B29A] whitespace-nowrap shrink-0">
            <span>Xem chi tiết</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {/* MỤC 4: TAB NHẬT KÝ BIẾN ĐỘNG — TỐI GIẢN, TẬP TRUNG BÚT TOÁN KIỂM TOÁN */}
      {assetSubTab === 'HISTORY' && (
        <section className="bg-white dark:bg-[#151B23] rounded-xl border border-[#E4E2DB] dark:border-[#262F3D] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <History className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
              <h2 className="font-display text-sm sm:text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Nhật ký biến động đầu tư
              </h2>
              <span aria-hidden="true" className="text-[#D4D1C7] dark:text-[#2E3848]">
                ·
              </span>
              <span className="text-xs text-[#63625C] dark:text-[#8E98A8] font-num">
                {accounting.auditLogs.length} bút toán
              </span>
            </div>
            <span className="text-xs font-num text-[#63625C] dark:text-[#8E98A8]">
              Đã chốt:{' '}
              <strong
                className={
                  accounting.totalRealizedPnLVnd > 0
                    ? 'text-[#137A4B] dark:text-[#34D399]'
                    : accounting.totalRealizedPnLVnd < 0
                    ? 'text-[#BE123C] dark:text-[#FB7185]'
                    : 'text-[#141413] dark:text-[#ECEBE6]'
                }
              >
                {formatSignedVND(accounting.totalRealizedPnLVnd)}
              </strong>
            </span>
          </div>

          {/* Vị thế đã bán hết 100% — thu gọn mặc định, bấm để mở rộng */}
          {accounting.closedPositions.length > 0 && (
            <div className="border-b border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/40 dark:bg-[#0D1117]/35">
              <button
                type="button"
                aria-expanded={showClosedPositions}
                onClick={() => setShowClosedPositions((v) => !v)}
                className="w-full px-5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#F6F5F1]/70 dark:hover:bg-[#1C2430]/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-[#141413] dark:text-[#ECEBE6] font-semibold">
                  {showClosedPositions ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[#8E8D86] dark:text-[#6E7887]" />
                  )}
                  <span>Vị thế đã đóng hết 100% ({accounting.closedPositions.length} mã)</span>
                </div>
                <span
                  className={`font-num font-semibold ${
                    totalClosedRealizedVnd >= 0
                      ? 'text-[#137A4B] dark:text-[#34D399]'
                      : 'text-[#BE123C] dark:text-[#FB7185]'
                  }`}
                >
                  {formatSignedVND(totalClosedRealizedVnd)}
                </span>
              </button>

              {showClosedPositions && (
                <div className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D] border-t border-[#E4E2DB] dark:border-[#262F3D] bg-white dark:bg-[#151B23]">
                  {accounting.closedPositions.map((pos) => {
                    const realizedVnd = pos.isCrypto
                      ? pos.realizedPnL * usdtVndRate
                      : pos.realizedPnL;
                    const isWin = realizedVnd >= 0;
                    return (
                      <div
                        key={pos.key}
                        className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#141413] dark:text-[#ECEBE6]">
                            {pos.symbol}
                          </span>
                          <span className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                            {pos.isCrypto ? 'Crypto' : 'CK VN'} · {pos.lots.length} lệnh
                          </span>
                        </div>
                        <div className="font-num text-right">
                          <strong
                            className={
                              isWin
                                ? 'text-[#137A4B] dark:text-[#34D399]'
                                : 'text-[#BE123C] dark:text-[#FB7185]'
                            }
                          >
                            {formatSignedVND(realizedVnd)}
                          </strong>
                          {pos.isCrypto && (
                            <span className="ml-1.5 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
                              ({pos.realizedPnL >= 0 ? '+' : ''}
                              {formatUSD(pos.realizedPnL)})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bộ lọc & tìm kiếm */}
          <div className="px-5 py-3 border-b border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'SELL', label: 'Bán / Đã chốt' },
                  { id: 'BUY', label: 'Mua' },
                  { id: 'TRANSFER', label: 'Nạp / Rút vốn' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAuditFilter(f.id)}
                  className={`aui-btn px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    auditFilter === f.id
                      ? 'bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117]'
                      : 'text-[#63625C] dark:text-[#8E98A8] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-[#8E8D86] dark:text-[#6E7887] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Tìm mã, ví, ghi chú..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-xs text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]"
              />
            </div>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div className="py-10 px-5 text-center text-xs text-[#63625C] dark:text-[#8E98A8]">
              Chưa có bút toán nào phù hợp bộ lọc.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F5F1]/60 dark:bg-[#0D1117]/50 text-[11px] text-[#63625C] dark:text-[#8E98A8] border-b border-[#E4E2DB] dark:border-[#262F3D]">
                    <th className="py-2.5 px-4 font-semibold">Ngày / Nghiệp vụ</th>
                    <th className="py-2.5 px-3 font-semibold">Diễn giải</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Dòng tiền / Lỗ–Lãi chốt</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2DB] dark:divide-[#262F3D]">
                  {filteredAuditLogs.map((entry) => {
                    const kindMeta: Record<
                      InvestmentAuditKind,
                      { label: string; colorClass: string }
                    > = {
                      BUY: {
                        label: 'MUA',
                        colorClass: 'text-[#0E5A4F] dark:text-[#38B29A]',
                      },
                      SELL: {
                        label: 'BÁN',
                        colorClass: 'text-[#BE123C] dark:text-[#FB7185]',
                      },
                      DEPOSIT: {
                        label: 'NẠP',
                        colorClass: 'text-[#0F766E] dark:text-[#2DD4BF]',
                      },
                      WITHDRAW: {
                        label: 'RÚT',
                        colorClass: 'text-[#D97706] dark:text-[#FBBF24]',
                      },
                    };
                    const meta = kindMeta[entry.kind];
                    const hasRealized = entry.kind === 'SELL' && entry.realizedPnLVnd !== undefined;
                    const realizedVal = entry.realizedPnLVnd || 0;

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-[#F6F5F1]/60 dark:hover:bg-[#1C2430]/45 transition-colors align-top"
                      >
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${meta.colorClass}`}>{meta.label}</span>
                            {entry.symbol && (
                              <span className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
                                {entry.symbol}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-num text-[#63625C] dark:text-[#8E98A8] mt-0.5">
                            {formatDateVN(entry.date)}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 max-w-md">
                          <div className="text-[#141413] dark:text-[#ECEBE6] leading-snug">
                            {entry.autoSummary}
                          </div>
                          {entry.note && (
                            <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] mt-0.5 truncate">
                              {entry.note}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right font-num whitespace-nowrap">
                          <div
                            className={`font-semibold ${
                              entry.netCashflowVnd >= 0
                                ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                                : 'text-[#63625C] dark:text-[#8E98A8]'
                            }`}
                          >
                            {formatSignedVND(entry.netCashflowVnd)}
                          </div>
                          {hasRealized && (
                            <div
                              className={`text-[11px] font-medium mt-0.5 ${
                                realizedVal >= 0
                                  ? 'text-[#137A4B] dark:text-[#34D399]'
                                  : 'text-[#BE123C] dark:text-[#FB7185]'
                              }`}
                            >
                              {realizedVal < 0 ? 'Lỗ chốt' : realizedVal > 0 ? 'Lãi chốt' : 'Hòa vốn'}{' '}
                              {formatSignedVND(realizedVal, true)}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {entry.sourceTrade ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenInvestModal(
                                    entry.sourceTrade!.assetType,
                                    entry.sourceTrade!.symbol,
                                    entry.sourceTrade!.type,
                                    entry.sourceTrade
                                  )
                                }
                                className="p-1 text-[#8E8D86] dark:text-[#6E7887] hover:text-[#0E5A4F] dark:hover:text-[#38B29A]"
                                title="Sửa lệnh"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteInvestment(entry.sourceTrade!)}
                                className="p-1 text-[#8E8D86] dark:text-[#6E7887] hover:text-[#BE123C] dark:hover:text-[#FB7185]"
                                title="Xóa lệnh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : entry.sourceTransfer ? (
                            <button
                              type="button"
                              onClick={() => onDeleteTransfer(entry.sourceTransfer!)}
                              className="p-1 text-[#8E8D86] dark:text-[#6E7887] hover:text-[#BE123C] dark:hover:text-[#FB7185]"
                              title="Xóa giao dịch nạp/rút vốn"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
