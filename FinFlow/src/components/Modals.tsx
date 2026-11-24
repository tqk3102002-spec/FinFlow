import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, X } from 'lucide-react';
import { AnimatedModal } from './AnimateUI';
import {
  DEFAULT_CRYPTO_PRICES,
  DEFAULT_VN_PRICES,
  EXPENSE_CATEGORIES,
  getWalletCashGroup,
  INCOME_CATEGORIES,
  SCHEMA_LIMITS,
  WALLET_CASH_GROUPS,
  WALLET_TYPES,
  type AssetType,
  type BudgetRule,
  type BuyFundingMode,
  type CapitalTransfer,
  type CapitalTransferDirection,
  type CashflowEntry,
  type CashflowType,
  type ConfirmDialogConfig,
  type InvestmentTrade,
  type MarketQuote,
  type TradeSide,
  type Wallet,
  type WalletCashGroup,
  type WalletType,
} from '../types/finance';
import {
  computeHeldPositionAtDate,
  computePositionsFromTrades,
  formatDateVN,
  formatMonthLabel,
  formatQty,
  formatSignedVND,
  formatUSD,
  formatVND,
  getTodayISO,
  parseSmartNumber,
  validateTradeLedgerOrder,
} from '../lib/accounting';
import { fetchVnStockQuoteWithCache, fetchWithTimeout } from '../lib/market';

export const AUTO_CREATE_INV_WALLET_ID = '__AUTO_CREATE_INV__';

const INPUT_BASE =
  'w-full px-3 py-2 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/70 text-[#141413] dark:text-[#ECEBE6] placeholder:text-[#8E8D86] dark:placeholder:text-[#5B6576] focus:outline-none focus:border-[#0E5A4F] dark:focus:border-[#38B29A]';

const INPUT_ERROR =
  'border-[#BE123C] dark:border-[#FB7185] ring-2 ring-[#BE123C]/15 dark:ring-[#FB7185]/20 bg-[#FFF1F3] dark:bg-[#2A141A]';

// ============================================================================
// MODAL 1: CASHFLOW (INCOME / EXPENSE)
// ============================================================================

export function CashflowModal({
  open,
  onClose,
  editing,
  presetType,
  wallets,
  onSave,
  tempo,
  reducedMotion,
}: {
  open: boolean;
  onClose: () => void;
  editing: CashflowEntry | null;
  presetType: CashflowType;
  wallets: Wallet[];
  onSave: (entry: CashflowEntry, isEdit: boolean) => void;
  tempo: number;
  reducedMotion: boolean;
}) {
  const [type, setType] = useState<CashflowType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Ăn uống');
  const [date, setDate] = useState(getTodayISO());
  const [note, setNote] = useState('');
  const [walletId, setWalletId] = useState('');
  const [errorAmt, setErrorAmt] = useState('');
  const [shakeTick, setShakeTick] = useState(0);

  const livingWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'LIVING'),
    [wallets]
  );

  // Preserve legacy cashflow link if an older record was linked to an investment wallet
  const legacyLinkedInvWallet = useMemo(() => {
    if (!editing?.walletId) return null;
    const found = wallets.find((w) => w.id === editing.walletId);
    return found && getWalletCashGroup(found) === 'INVESTMENT' ? found : null;
  }, [editing, wallets]);

  useEffect(() => {
    if (!open) return;
    setErrorAmt('');
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount));
      setCategory(editing.category);
      setDate(editing.date || getTodayISO());
      setNote(editing.note || '');
      setWalletId(editing.walletId || '');
    } else {
      setType(presetType);
      setAmount('');
      setCategory(presetType === 'INCOME' ? 'Lương' : 'Ăn uống');
      setDate(getTodayISO());
      setNote('');
      setWalletId(livingWallets[0]?.id || '');
    }
  }, [open, editing, presetType, livingWallets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(parseSmartNumber(amount, true));
    if (parsed <= 0) {
      setErrorAmt('Số tiền phải lớn hơn 0.');
      setShakeTick((t) => t + 1);
      return;
    }
    const id = editing?.id || `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onSave(
      {
        id,
        type,
        amount: parsed,
        category,
        date: date || getTodayISO(),
        note: note.trim(),
        walletId: walletId || '',
        createdAt: editing?.createdAt || Date.now(),
      },
      Boolean(editing)
    );
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-md"
      tempo={tempo}
      reducedMotion={reducedMotion}
    >
      <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-between shrink-0">
        <h3 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
          {editing ? 'Chỉnh sửa khoản Thu – Chi' : 'Ghi nhận Thu – Chi'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="aui-btn text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] p-1 rounded-lg"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <form noValidate onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs overflow-y-auto">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFEDE7] dark:bg-[#0D1117] rounded-lg border border-[#E4E2DB] dark:border-[#262F3D]">
          <button
            type="button"
            onClick={() => {
              setType('EXPENSE');
              setCategory('Ăn uống');
            }}
            className={`aui-btn py-2 rounded-md font-semibold ${
              type === 'EXPENSE'
                ? 'bg-[#BE123C] dark:bg-[#FB7185] text-white dark:text-[#0D1117]'
                : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
            }`}
          >
            Chi tiêu
          </button>
          <button
            type="button"
            onClick={() => {
              setType('INCOME');
              setCategory('Lương');
            }}
            className={`aui-btn py-2 rounded-md font-semibold ${
              type === 'INCOME'
                ? 'bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117]'
                : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
            }`}
          >
            Thu nhập
          </button>
        </div>

        <div key={`cf-amt-${errorAmt ? shakeTick : 0}`} className={errorAmt ? 'aui-shake' : ''}>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Số tiền (VNĐ)
          </label>
          <input
            type="text"
            autoFocus
            aria-invalid={Boolean(errorAmt)}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errorAmt) setErrorAmt('');
            }}
            placeholder="VD: 1.500.000 hoặc 1500000"
            className={`${INPUT_BASE} py-2.5 text-sm font-bold font-num ${errorAmt ? INPUT_ERROR : ''}`}
          />
          {errorAmt ? (
            <p
              role="alert"
              className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
            >
              {errorAmt}
            </p>
          ) : amount ? (
            <p className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
              Nhận diện:{' '}
              <strong className="text-[#141413] dark:text-[#ECEBE6]">
                {formatVND(parseSmartNumber(amount, true))}
              </strong>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Danh mục
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={INPUT_BASE}
            >
              {(type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
              {category &&
                !(type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).some(
                  (c) => c.id === category
                ) && (
                  <option value={category}>{category} (danh mục cũ)</option>
                )}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Ngày
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${INPUT_BASE} font-num`}
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Liên kết ví Tiền mặt sinh hoạt (tùy chọn)
          </label>
          <select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className={INPUT_BASE}
          >
            <option value="">Không liên kết ví</option>
            {livingWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({formatVND(w.balance)})
              </option>
            ))}
            {legacyLinkedInvWallet && (
              <option value={legacyLinkedInvWallet.id}>
                {legacyLinkedInvWallet.name} — Chờ đầu tư (cũ, nên chuyển về ví sinh hoạt)
              </option>
            )}
          </select>
          <p className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
            {livingWallets.length === 0
              ? 'Chưa có ví thuộc nhóm Tiền mặt sinh hoạt. Ví Tiền chờ đầu tư được tách riêng khỏi Thu – Chi.'
              : 'Chỉ hiển thị nhóm Tiền mặt sinh hoạt để không làm nhiễu sức mua đầu tư.'}
          </p>
        </div>

        <div>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Ghi chú
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Ăn trưa, thanh toán hóa đơn điện..."
            className={INPUT_BASE}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="aui-btn px-4 py-2 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-semibold"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="aui-btn px-5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] font-semibold"
          >
            Lưu khoản {type === 'INCOME' ? 'Thu' : 'Chi'}
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}

// ============================================================================
// MODAL 2: INVESTMENT TRADE (VN STOCK / CRYPTO)
// ============================================================================

export function InvestmentModal({
  open,
  onClose,
  editing,
  presetAsset,
  presetSymbol,
  presetType,
  investments,
  wallets,
  investmentWalletBalances,
  marketQuotes,
  usdtVndRate,
  onSave,
  tempo,
  reducedMotion,
}: {
  open: boolean;
  onClose: () => void;
  editing: InvestmentTrade | null;
  presetAsset: AssetType;
  presetSymbol: string;
  presetType: TradeSide;
  investments: InvestmentTrade[];
  wallets: Wallet[];
  investmentWalletBalances?: Record<string, number>;
  marketQuotes: Record<string, MarketQuote>;
  usdtVndRate: number;
  onSave: (
    trade: InvestmentTrade,
    isEdit: boolean,
    walletSync?: {
      enabled: boolean;
      walletId: string;
      fundingMode?: BuyFundingMode;
      livingWalletId?: string;
    }
  ) => void;
  tempo: number;
  reducedMotion: boolean;
}) {
  const [assetType, setAssetType] = useState<AssetType>('VN_STOCK');
  const [side, setSide] = useState<TradeSide>('BUY');
  const [symbol, setSymbol] = useState('FPT');
  const [exchange, setExchange] = useState('HSX');
  const [quantity, setQuantity] = useState('100');
  const [price, setPrice] = useState('50.100');
  const [feeAmount, setFeeAmount] = useState('0');
  const [fxRateInput, setFxRateInput] = useState(String(usdtVndRate || 25450));
  const [date, setDate] = useState(getTodayISO());
  const [note, setNote] = useState('');
  const [syncWalletId, setSyncWalletId] = useState<string>(AUTO_CREATE_INV_WALLET_ID);
  const [fundingMode, setFundingMode] = useState<BuyFundingMode>('INVESTMENT_WALLET');
  const [livingWalletId, setLivingWalletId] = useState<string>('');
  const [errors, setErrors] = useState<{
    symbol?: string;
    quantity?: string;
    price?: string;
    ledger?: string;
  }>({});
  const [shakeTick, setShakeTick] = useState(0);
  const [liveQuote, setLiveQuote] = useState<{ loading: boolean; data: MarketQuote | null }>({
    loading: false,
    data: null,
  });

  const investmentWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'INVESTMENT'),
    [wallets]
  );

  const livingWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'LIVING'),
    [wallets]
  );

  const getInvWalletBalance = (w: Wallet) =>
    investmentWalletBalances && w.id in investmentWalletBalances
      ? investmentWalletBalances[w.id]
      : Number(w.balance) || 0;

  const formatInputPrice = (val: number, isVN: boolean) => {
    if (!Number.isFinite(val) || val <= 0) return '';
    if (isVN) return Math.round(val).toLocaleString('vi-VN');
    return String(Number(val.toFixed(6)));
  };

  const resolveCurrentMarketPrice = (targetAsset: AssetType, targetSym: string, fallbackAvg = 0) => {
    const key = `${targetAsset}:${targetSym}`;
    const q = marketQuotes[key];
    if (q && q.price > 0) return q.price;
    if (targetAsset === 'CRYPTO') {
      return DEFAULT_CRYPTO_PRICES[targetSym]?.price || fallbackAvg || 78341.6;
    }
    return DEFAULT_VN_PRICES[targetSym]?.price || fallbackAvg || 50100;
  };

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFundingMode('INVESTMENT_WALLET');
    setLivingWalletId(livingWallets[0]?.id || '');
    if (editing) {
      setAssetType(editing.assetType);
      setSide(editing.type);
      setSymbol(editing.symbol);
      setExchange(editing.exchange || (editing.assetType === 'CRYPTO' ? 'BINANCE' : 'HSX'));
      setQuantity(String(editing.quantity));
      setPrice(formatInputPrice(editing.price, editing.assetType === 'VN_STOCK'));
      setFeeAmount(String(editing.feeAmount || 0));
      setFxRateInput(
        String(
          editing.fxRateAtExecution && editing.fxRateAtExecution >= SCHEMA_LIMITS.USDT_RATE_MIN
            ? editing.fxRateAtExecution
            : usdtVndRate || 25450
        )
      );
      setDate(editing.date || getTodayISO());
      setNote(editing.note || '');
      setSyncWalletId(
        editing.walletId && investmentWallets.some((w) => w.id === editing.walletId)
          ? editing.walletId
          : investmentWallets[0]?.id || AUTO_CREATE_INV_WALLET_ID
      );
    } else {
      const isCr = presetAsset === 'CRYPTO';
      const initSym = (presetSymbol || (isCr ? 'BTC' : 'FPT')).toUpperCase().trim();
      const heldPos = computePositionsFromTrades(investments, usdtVndRate).find(
        (p) => p.symbol === initSym && p.assetType === presetAsset
      );
      const marketPrc = resolveCurrentMarketPrice(presetAsset, initSym, heldPos?.avgCost || 0);

      setAssetType(presetAsset);
      setSide(presetType);
      setSymbol(initSym);
      setExchange(heldPos?.exchange || (isCr ? 'BINANCE' : 'HSX'));
      if (presetType === 'SELL' && heldPos && heldPos.currentQty > 0) {
        setQuantity(String(heldPos.currentQty));
      } else {
        setQuantity(isCr ? '0.05' : '100');
      }
      setPrice(formatInputPrice(marketPrc, !isCr));
      setFeeAmount('0');
      setFxRateInput(String(usdtVndRate || 25450));
      setDate(getTodayISO());
      setNote('');
      setSyncWalletId(investmentWallets[0]?.id || AUTO_CREATE_INV_WALLET_ID);
    }
  }, [open, editing, presetAsset, presetSymbol, presetType, investmentWallets, livingWallets]);

  useEffect(() => {
    if (!open) return;
    const sym = symbol.toUpperCase().trim();
    if (sym.length < 2) {
      setLiveQuote({ loading: false, data: null });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLiveQuote((prev) => ({ ...prev, loading: true }));
      try {
        if (assetType === 'VN_STOCK') {
          const q = await fetchVnStockQuoteWithCache(sym, false);
          if (!cancelled) setLiveQuote({ loading: false, data: q });
        } else {
          const cached = marketQuotes[`CRYPTO:${sym}`];
          if (cached?.price > 0) {
            if (!cancelled) setLiveQuote({ loading: false, data: cached });
          } else {
            const res = await fetchWithTimeout(
              `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT`,
              4500
            );
            if (!cancelled && res.ok) {
              const d = await res.json();
              const p = parseFloat(d.lastPrice);
              if (p > 0) {
                setLiveQuote({
                  loading: false,
                  data: { symbol: sym, price: p, refPrice: p, source: 'BINANCE', updatedAt: '' },
                });
                return;
              }
            }
            if (!cancelled) setLiveQuote({ loading: false, data: null });
          }
        }
      } catch {
        if (!cancelled) setLiveQuote({ loading: false, data: null });
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, symbol, assetType, marketQuotes]);

  const preview = useMemo(() => {
    const isVN = assetType === 'VN_STOCK';
    const sym = symbol.toUpperCase().trim();
    const qty = parseSmartNumber(quantity, false);
    const prc = parseSmartNumber(price, isVN);
    const fee = Math.max(0, parseSmartNumber(feeAmount, isVN));

    const heldAtDate = computeHeldPositionAtDate(
      investments,
      assetType,
      sym,
      side === 'SELL' ? date || getTodayISO() : '',
      usdtVndRate,
      editing?.id
    );

    const prevQty = heldAtDate.currentQty;
    const prevAvg = heldAtDate.avgCost;
    let nextQty = prevQty;
    let nextAvg = prevAvg;
    let tradeValue = 0;
    let costBasisReleased = 0;
    let expectedRealized = 0;
    const sellExceedsHeld = side === 'SELL' && (prevQty <= 1e-10 || qty > prevQty + 1e-9);

    if (side === 'BUY') {
      tradeValue = qty * prc + fee;
      nextQty = prevQty + qty;
      nextAvg = nextQty > 0 ? (prevQty * prevAvg + tradeValue) / nextQty : 0;
    } else {
      const sellQty = Math.min(qty, prevQty);
      costBasisReleased = sellQty * prevAvg;
      tradeValue = Math.max(0, sellQty * prc - fee);
      expectedRealized = tradeValue - costBasisReleased;
      nextQty = Math.max(0, prevQty - sellQty);
      nextAvg = nextQty <= 1e-10 ? 0 : prevAvg;
    }

    const parsedFx = Math.round(parseSmartNumber(fxRateInput, true));
    const effectiveFxRate = isVN
      ? 1
      : Number.isFinite(parsedFx) &&
        parsedFx >= SCHEMA_LIMITS.USDT_RATE_MIN &&
        parsedFx <= SCHEMA_LIMITS.USDT_RATE_MAX
      ? parsedFx
      : usdtVndRate;
    const tradeValueVnd = Math.round(tradeValue * effectiveFxRate);

    // Purchasing power check on BUY using strict ledger wallet balance
    const activeBuyFundingMode: BuyFundingMode =
      !editing && side === 'BUY' ? fundingMode : 'INVESTMENT_WALLET';
    const selectedInvWallet =
      syncWalletId !== AUTO_CREATE_INV_WALLET_ID
        ? investmentWallets.find((w) => w.id === syncWalletId) || null
        : null;
    const selectedLivingWallet =
      activeBuyFundingMode === 'LIVING_WALLET'
        ? livingWallets.find((w) => w.id === livingWalletId) || null
        : null;
    const prevSameWalletReversal =
      editing &&
      selectedInvWallet &&
      editing.walletId === selectedInvWallet.id &&
      editing.walletDeltaVnd
        ? -editing.walletDeltaVnd
        : 0;
    const effectiveBuyingPowerVnd = selectedInvWallet
      ? getInvWalletBalance(selectedInvWallet) + prevSameWalletReversal
      : 0;
    const buyShortfallVnd =
      side === 'BUY' &&
      activeBuyFundingMode === 'INVESTMENT_WALLET' &&
      tradeValueVnd > effectiveBuyingPowerVnd
        ? tradeValueVnd - effectiveBuyingPowerVnd
        : 0;
    const livingShortfallVnd =
      side === 'BUY' &&
      activeBuyFundingMode === 'LIVING_WALLET' &&
      selectedLivingWallet &&
      tradeValueVnd > (Number(selectedLivingWallet.balance) || 0)
        ? tradeValueVnd - (Number(selectedLivingWallet.balance) || 0)
        : 0;

    return {
      isVN,
      qty,
      prc,
      fee,
      effectiveFxRate,
      prevQty,
      prevAvg,
      earliestBuyDate: heldAtDate.earliestBuyDate,
      nextQty,
      nextAvg,
      tradeValue,
      tradeValueVnd,
      costBasisReleased,
      expectedRealized,
      expectedRealizedVnd: expectedRealized * effectiveFxRate,
      sellExceedsHeld,
      activeBuyFundingMode,
      selectedInvWallet,
      selectedLivingWallet,
      effectiveBuyingPowerVnd,
      buyShortfallVnd,
      livingShortfallVnd,
      showSmallVnWarning: isVN && prc > 0 && prc < 500,
      suggestedVnd: Math.round(prc * 1000),
    };
  }, [
    assetType,
    side,
    symbol,
    date,
    quantity,
    price,
    feeAmount,
    fxRateInput,
    investments,
    editing,
    usdtVndRate,
    syncWalletId,
    fundingMode,
    livingWalletId,
    investmentWallets,
    livingWallets,
    investmentWalletBalances,
  ]);

  const handleSwitchSide = (nextSide: TradeSide) => {
    setSide(nextSide);
    setErrors((p) => ({ ...p, quantity: '', ledger: '' }));
    if (nextSide === 'SELL') {
      setFundingMode('INVESTMENT_WALLET');
    }
    if (!editing && nextSide === 'SELL') {
      const sym = symbol.toUpperCase().trim();
      const held = computeHeldPositionAtDate(investments, assetType, sym, date || getTodayISO(), usdtVndRate);
      if (held.currentQty > 0) {
        setQuantity(String(held.currentQty));
        setExchange(held.exchange);
        const curPrc = resolveCurrentMarketPrice(assetType, sym, held.avgCost);
        setPrice(formatInputPrice(curPrc, assetType === 'VN_STOCK'));
      }
    }
  };

  const applyQuickSellRatio = (ratio: number) => {
    if (preview.prevQty <= 0) return;
    const raw = ratio === 1 ? preview.prevQty : preview.prevQty * ratio;
    const formatted = preview.isVN
      ? String(Math.max(1, Math.floor(raw)))
      : String(Number(raw.toFixed(6)));
    setQuantity(formatted);
    setErrors((p) => ({ ...p, quantity: '', ledger: '' }));
  };

  const applyQuickVnFeePct = (pct: number) => {
    if (!preview.isVN) return;
    const gross = preview.qty * preview.prc;
    if (!Number.isFinite(gross) || gross <= 0) {
      setFeeAmount('0');
      return;
    }
    const computed = pct <= 0 ? 0 : Math.round(gross * (pct / 100));
    setFeeAmount(computed > 0 ? computed.toLocaleString('vi-VN') : '0');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isVN = assetType === 'VN_STOCK';
    const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const qty = parseSmartNumber(quantity, false);
    const prc = parseSmartNumber(price, isVN);
    const fee = Math.max(0, parseSmartNumber(feeAmount, isVN));
    const txDate = date || getTodayISO();

    const nextErrs: { symbol?: string; quantity?: string; price?: string; ledger?: string } = {};
    if (!sym) nextErrs.symbol = 'Nhập mã hợp lệ (A-Z, 0-9).';
    if (qty <= 0) nextErrs.quantity = 'KL > 0.';
    if (prc <= 0) nextErrs.price = 'Giá > 0.';

    if (
      !editing &&
      side === 'BUY' &&
      fundingMode === 'LIVING_WALLET' &&
      (!livingWalletId || !livingWallets.some((w) => w.id === livingWalletId))
    ) {
      nextErrs.ledger =
        'Chưa có ví Ngân hàng / Sinh hoạt nào được chọn. Hãy tạo ví sinh hoạt trước hoặc chọn chế độ khác.';
    }

    if (side === 'SELL' && sym && qty > 0) {
      if (preview.prevQty <= 1e-10) {
        nextErrs.quantity = preview.earliestBuyDate && txDate < preview.earliestBuyDate
          ? `Ngày bán sớm hơn lệnh Mua đầu tiên (${formatDateVN(preview.earliestBuyDate)}).`
          : `Không có khối lượng ${sym} đang nắm giữ tính đến ngày ${formatDateVN(txDate)}.`;
      } else if (qty > preview.prevQty + 1e-9) {
        nextErrs.quantity = `Vượt KL nắm giữ (${formatQty(preview.prevQty, !isVN)}).`;
      }
    }

    const id = editing?.id || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const candidateTrade: InvestmentTrade = {
      id,
      assetType,
      type: side,
      symbol: sym,
      exchange: exchange || (isVN ? 'HSX' : 'BINANCE'),
      quantity: qty,
      price: prc,
      feeAmount: fee,
      date: txDate,
      note: note.trim(),
      walletId: editing?.walletId || '',
      walletDeltaVnd: editing?.walletDeltaVnd || 0,
      ...(assetType === 'CRYPTO' ? { fxRateAtExecution: preview.effectiveFxRate } : {}),
      createdAt: editing?.createdAt || Date.now(),
    };

    if (Object.keys(nextErrs).length === 0) {
      const simulated = editing
        ? investments.map((t) => (t.id === candidateTrade.id ? candidateTrade : t))
        : [...investments, candidateTrade];
      const ledgerCheck = validateTradeLedgerOrder(simulated, usdtVndRate);
      if (!ledgerCheck.valid) {
        nextErrs.ledger = ledgerCheck.error || 'Thứ tự lệnh Mua/Bán không hợp lệ trên sổ cái.';
      }
    }

    if (Object.keys(nextErrs).length > 0) {
      setErrors(nextErrs);
      setShakeTick((t) => t + 1);
      return;
    }

    onSave(candidateTrade, Boolean(editing), {
      enabled: true,
      walletId: syncWalletId,
      fundingMode: !editing && side === 'BUY' ? fundingMode : 'INVESTMENT_WALLET',
      livingWalletId: !editing && side === 'BUY' && fundingMode === 'LIVING_WALLET' ? livingWalletId : '',
    });
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-lg"
      tempo={tempo}
      reducedMotion={reducedMotion}
    >
      <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-between shrink-0">
        <h3 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
          {editing ? 'Chỉnh sửa giao dịch đầu tư' : 'Thêm giao dịch đầu tư'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="aui-btn text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] p-1 rounded-lg"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form noValidate onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto text-xs">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFEDE7] dark:bg-[#0D1117] rounded-lg border border-[#E4E2DB] dark:border-[#262F3D]">
          <button
            type="button"
            onClick={() => {
              if (assetType !== 'VN_STOCK') {
                setAssetType('VN_STOCK');
                setSymbol('FPT');
                setExchange('HSX');
                setQuantity('100');
                setPrice('50.100');
                setFeeAmount('0');
              }
            }}
            className={`aui-btn py-2 rounded-md font-semibold ${
              assetType === 'VN_STOCK'
                ? 'bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117]'
                : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
            }`}
          >
            Chứng khoán VN (VNĐ)
          </button>
          <button
            type="button"
            onClick={() => {
              if (assetType !== 'CRYPTO') {
                setAssetType('CRYPTO');
                setSymbol('BTC');
                setExchange('BINANCE');
                setQuantity('0.05');
                setPrice('78.341,6');
                setFeeAmount('0');
              }
            }}
            className={`aui-btn py-2 rounded-md font-semibold ${
              assetType === 'CRYPTO'
                ? 'bg-[#2D5B78] dark:bg-[#7EB2D4] text-white dark:text-[#0D1117]'
                : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
            }`}
          >
            Crypto (USDT)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Loại lệnh
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleSwitchSide('BUY')}
                className={`aui-btn py-2 rounded-lg border font-semibold ${
                  side === 'BUY'
                    ? 'bg-[#F1FAF5] dark:bg-[#10261E] border-[#137A4B] dark:border-[#34D399] text-[#137A4B] dark:text-[#34D399]'
                    : 'border-[#E4E2DB] dark:border-[#262F3D] text-[#63625C] dark:text-[#8E98A8]'
                }`}
              >
                Mua
              </button>
              <button
                type="button"
                onClick={() => handleSwitchSide('SELL')}
                className={`aui-btn py-2 rounded-lg border font-semibold ${
                  side === 'SELL'
                    ? 'bg-[#FFF1F3] dark:bg-[#2A141A] border-[#BE123C] dark:border-[#FB7185] text-[#BE123C] dark:text-[#FB7185]'
                    : 'border-[#E4E2DB] dark:border-[#262F3D] text-[#63625C] dark:text-[#8E98A8]'
                }`}
              >
                Bán
              </button>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Ngày giao dịch
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${INPUT_BASE} font-num`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div key={`sym-${errors.symbol ? shakeTick : 0}`} className={errors.symbol ? 'aui-shake' : ''}>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              {assetType === 'VN_STOCK' ? 'Mã Cổ phiếu' : 'Mã Coin'}
            </label>
            <input
              type="text"
              aria-invalid={Boolean(errors.symbol)}
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value.toUpperCase());
                if (errors.symbol) setErrors((p) => ({ ...p, symbol: '' }));
              }}
              placeholder={assetType === 'VN_STOCK' ? 'FPT, GEX, VND...' : 'BTC, ETH...'}
              className={`${INPUT_BASE} font-bold uppercase ${errors.symbol ? INPUT_ERROR : ''}`}
            />
            {errors.symbol && (
              <p
                role="alert"
                className="mt-1 text-[10px] font-medium text-[#BE123C] dark:text-[#FB7185]"
              >
                {errors.symbol}
              </p>
            )}
          </div>
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Sàn giao dịch
            </label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              className={INPUT_BASE}
            >
              {assetType === 'VN_STOCK' ? (
                <>
                  <option value="HSX">HSX (HOSE)</option>
                  <option value="HNX">HNX</option>
                  <option value="UPCOM">UPCOM</option>
                </>
              ) : (
                <>
                  <option value="BINANCE">BINANCE</option>
                  <option value="OKX">OKX</option>
                  <option value="BYBIT">BYBIT</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div key={`qty-${errors.quantity ? shakeTick : 0}`} className={errors.quantity ? 'aui-shake' : ''}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Khối lượng
              </label>
              {side === 'SELL' && preview.prevQty > 0 && (
                <div className="flex items-center gap-1 text-[10px]">
                  {[
                    { r: 0.25, label: '25%' },
                    { r: 0.5, label: '50%' },
                    { r: 1, label: '100%' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => applyQuickSellRatio(opt.r)}
                      className="px-1 py-0.5 rounded bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-semibold font-num"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              aria-invalid={Boolean(errors.quantity)}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                if (errors.quantity || errors.ledger) {
                  setErrors((p) => ({ ...p, quantity: '', ledger: '' }));
                }
              }}
              className={`${INPUT_BASE} font-semibold font-num ${errors.quantity ? INPUT_ERROR : ''}`}
            />
            {errors.quantity && (
              <p
                role="alert"
                className="mt-1 text-[10px] font-medium text-[#BE123C] dark:text-[#FB7185]"
              >
                {errors.quantity}
              </p>
            )}
          </div>
          <div key={`prc-${errors.price ? shakeTick : 0}`} className={errors.price ? 'aui-shake' : ''}>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              {assetType === 'VN_STOCK' ? 'Giá khớp (VNĐ)' : 'Giá khớp (USDT)'}
            </label>
            <input
              type="text"
              aria-invalid={Boolean(errors.price)}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                if (errors.price) setErrors((p) => ({ ...p, price: '' }));
              }}
              placeholder={assetType === 'VN_STOCK' ? '50.100' : '78.341,6'}
              className={`${INPUT_BASE} font-bold font-num ${errors.price ? INPUT_ERROR : ''}`}
            />
            {errors.price && (
              <p
                role="alert"
                className="mt-1 text-[10px] font-medium text-[#BE123C] dark:text-[#FB7185]"
              >
                {errors.price}
              </p>
            )}
          </div>
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              {assetType === 'VN_STOCK' ? 'Phí (VNĐ)' : 'Phí (USDT)'}
            </label>
            <input
              type="text"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              placeholder="0"
              className={`${INPUT_BASE} font-num`}
            />
          </div>
        </div>

        {/* Quick VN stock fee/tax presets OR Crypto historical FX rate */}
        {assetType === 'VN_STOCK' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
            <span>{side === 'SELL' ? 'Điền nhanh phí & thuế bán VN:' : 'Điền nhanh phí mua VN:'}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyQuickVnFeePct(0)}
                className="aui-btn px-2 py-0.5 rounded bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-medium font-num"
              >
                0%
              </button>
              <button
                type="button"
                onClick={() => applyQuickVnFeePct(0.15)}
                className="aui-btn px-2 py-0.5 rounded bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-medium font-num"
              >
                0,15% phí
              </button>
              {side === 'SELL' && (
                <button
                  type="button"
                  onClick={() => applyQuickVnFeePct(0.25)}
                  className="aui-btn px-2 py-0.5 rounded bg-[#FFF1F3] dark:bg-[#2A141A] hover:bg-[#FFE4E8] dark:hover:bg-[#3A1C24] text-[#9F1239] dark:text-[#FDA4AF] font-semibold font-num"
                >
                  0,25% (0,15% phí + 0,1% thuế bán)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-[#F6F5F1]/70 dark:bg-[#0D1117]/70 border border-[#E4E2DB] dark:border-[#262F3D] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Tỷ giá USDT/VNĐ lúc khớp lệnh
              </label>
              {preview.effectiveFxRate !== usdtVndRate && (
                <button
                  type="button"
                  onClick={() => setFxRateInput(String(usdtVndRate))}
                  className="text-[10px] font-semibold text-[#0E5A4F] dark:text-[#38B29A] hover:underline font-num"
                >
                  Đặt về tỷ giá hiện tại ({usdtVndRate.toLocaleString('vi-VN')})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fxRateInput}
                onChange={(e) => setFxRateInput(e.target.value)}
                placeholder={String(usdtVndRate)}
                className={`${INPUT_BASE} font-semibold font-num`}
              />
              <span className="text-[11px] text-[#63625C] dark:text-[#8E98A8] whitespace-nowrap shrink-0">
                VNĐ / USDT
              </span>
            </div>
            <p className="text-[10px] text-[#63625C] dark:text-[#8E98A8]">
              Khóa cứng dòng tiền VNĐ và Lãi/Lỗ đã chốt của lệnh này, không bị biến dạng khi bạn đổi tỷ giá USDT về sau.
            </p>
          </div>
        )}

        {preview.showSmallVnWarning && (
          <div className="p-2.5 rounded-lg bg-[#FFFBEB] dark:bg-[#261E0F] border border-[#F2D59B] dark:border-[#6B4E16] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#92400E] dark:text-[#FCD34D]">
            <span>
              Bạn đang nhập <strong>{price}</strong> theo đơn vị nghìn đồng?
            </span>
            <button
              type="button"
              onClick={() => setPrice(preview.suggestedVnd.toLocaleString('vi-VN'))}
              className="aui-btn px-2.5 py-1 rounded-md bg-[#B45309] hover:bg-[#92400E] dark:bg-[#FBBF24] dark:text-[#0D1117] text-white font-semibold"
            >
              Đổi thành {formatVND(preview.suggestedVnd)}
            </button>
          </div>
        )}

        <div>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Ghi chú nhật ký giao dịch
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              side === 'SELL'
                ? 'VD: Chốt lời đạt mục tiêu 15%, cơ cấu sang tiền mặt chờ cơ hội...'
                : fundingMode === 'EXISTING_HOLDING'
                ? 'VD: Khai báo lô cổ phiếu đã nắm giữ từ trước khi dùng FinFlow...'
                : 'VD: Mua tích lũy đợt 2 vùng hỗ trợ...'
            }
            className={INPUT_BASE}
          />
        </div>

        {/* Ví Tiền chờ đầu tư & Nguồn vốn thanh toán theo Sổ cái kép chuẩn */}
        <div className="p-3 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#F6F5F1]/60 dark:bg-[#0D1117]/60 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-[#141413] dark:text-[#ECEBE6] flex items-center gap-1.5">
              <WalletIcon className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" />
              <span>
                {!editing && side === 'BUY'
                  ? 'Nguồn vốn & Sổ cái thanh toán'
                  : 'Ví Tiền chờ đầu tư đối ứng (Sổ cái kép)'}
              </span>
            </div>
            <span className="text-[10px] font-medium text-[#0F766E] dark:text-[#2DD4BF]">
              Tự động cân bằng
            </span>
          </div>

          {!editing && side === 'BUY' && (
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#EFEDE7] dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D]">
              {[
                { id: 'INVESTMENT_WALLET' as const, label: 'Tiền chờ ĐT' },
                { id: 'LIVING_WALLET' as const, label: 'Ví Ngân hàng' },
                { id: 'EXISTING_HOLDING' as const, label: 'Khai báo có sẵn' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setFundingMode(opt.id);
                    if (errors.ledger) setErrors((p) => ({ ...p, ledger: '' }));
                  }}
                  className={`aui-btn py-1.5 px-1.5 rounded-md text-[11px] font-semibold truncate ${
                    fundingMode === opt.id
                      ? 'bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117]'
                      : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-[#63625C] dark:text-[#8E98A8]">
            {side === 'SELL'
              ? 'Chỉ tiền bán thực nhận sau phí (đã trừ khoản lỗ nếu bán lỗ) được cộng vào sức mua.'
              : preview.activeBuyFundingMode === 'LIVING_WALLET'
              ? 'Hệ thống tự tạo cặp bút toán: Nạp vốn từ ví Ngân hàng/Sinh hoạt đã chọn → Mua tài sản, giữ sổ cái đầu tư cân bằng tuyệt đối.'
              : preview.activeBuyFundingMode === 'EXISTING_HOLDING'
              ? 'Ghi nhận danh mục đã mua từ trước: tự động cân bằng phần vốn nạp khởi tạo tương ứng giá vốn + phí nên không làm âm sức mua và không trừ ví sinh hoạt.'
              : 'Số dư ví tự động tính theo công thức Nạp − Rút − Mua + Bán; lệnh Mua trừ trực tiếp vào sức mua.'}
          </p>

          {!editing && side === 'BUY' && fundingMode === 'LIVING_WALLET' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#141413] dark:text-[#ECEBE6]">
                Trừ tiền từ ví Ngân hàng / Sinh hoạt
              </label>
              <select
                value={livingWalletId}
                onChange={(e) => {
                  setLivingWalletId(e.target.value);
                  if (errors.ledger) setErrors((p) => ({ ...p, ledger: '' }));
                }}
                className={INPUT_BASE}
              >
                {livingWallets.length === 0 ? (
                  <option value="">Chưa có ví Sinh hoạt nào</option>
                ) : (
                  livingWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — Số dư: {formatVND(w.balance)}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="space-y-1">
            {!editing && side === 'BUY' && fundingMode !== 'INVESTMENT_WALLET' && (
              <label className="block text-[11px] font-medium text-[#63625C] dark:text-[#8E98A8]">
                Ghi nhận trên sổ cái ví đầu tư
              </label>
            )}
            <select
              value={syncWalletId}
              onChange={(e) => setSyncWalletId(e.target.value)}
              className={INPUT_BASE}
            >
              {investmentWallets.length === 0 && (
                <option value={AUTO_CREATE_INV_WALLET_ID}>
                  + Tự động tạo ví "Tiền chờ đầu tư (Sức mua)"
                </option>
              )}
              {investmentWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — Sức mua sổ cái: {formatVND(getInvWalletBalance(w))}
                </option>
              ))}
              {investmentWallets.length > 0 && (
                <option value={AUTO_CREATE_INV_WALLET_ID}>
                  + Tạo mới ví Tiền chờ đầu tư (Sức mua)
                </option>
              )}
            </select>
          </div>

          {preview.livingShortfallVnd > 0 && preview.selectedLivingWallet && (
            <div className="p-2.5 rounded-lg bg-[#FFFBEB] dark:bg-[#261E0F] border border-[#F2D59B] dark:border-[#6B4E16] flex items-start gap-2 text-[11px] text-[#92400E] dark:text-[#FCD34D]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B45309] dark:text-[#FBBF24]" />
              <div className="leading-relaxed">
                <strong>Số dư ví sinh hoạt nhỏ hơn lệnh Mua:</strong> Ví{' '}
                <strong>{preview.selectedLivingWallet.name}</strong> hiện có{' '}
                <span className="font-num font-semibold">
                  {formatVND(preview.selectedLivingWallet.balance)}
                </span>
                , thiếu khoảng{' '}
                <span className="font-num font-semibold">
                  {formatVND(preview.livingShortfallVnd)}
                </span>
                . Nếu tiếp tục, số dư ví này sẽ về <strong className="font-num">0 đ</strong>.
              </div>
            </div>
          )}

          {preview.buyShortfallVnd > 0 && (
            <div className="p-2.5 rounded-lg bg-[#FFFBEB] dark:bg-[#261E0F] border border-[#F2D59B] dark:border-[#6B4E16] flex items-start gap-2 text-[11px] text-[#92400E] dark:text-[#FCD34D]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B45309] dark:text-[#FBBF24]" />
              <div className="leading-relaxed">
                <strong>Thiếu sức mua trên sổ cái:</strong> Lệnh Mua{' '}
                <span className="font-num font-semibold">{formatVND(preview.tradeValueVnd)}</span>{' '}
                vượt sức mua hiện có (
                <span className="font-num font-semibold">
                  {formatVND(preview.effectiveBuyingPowerVnd)}
                </span>
                ) khoảng{' '}
                <span className="font-num font-semibold">
                  {formatVND(preview.buyShortfallVnd)}
                </span>
                . Bạn có thể chuyển sang tab <strong>Ví Ngân hàng</strong> hoặc{' '}
                <strong>Khai báo có sẵn</strong> ở trên để không bị âm sức mua.
              </div>
            </div>
          )}
        </div>

        {(preview.sellExceedsHeld || errors.ledger) && (
          <div
            role="alert"
            className="p-2.5 rounded-lg bg-[#FFF1F3] dark:bg-[#2A141A] border border-[#F6C4CE] dark:border-[#6B2135] text-[11px] text-[#9F1239] dark:text-[#FDA4AF]"
          >
            {errors.ledger
              ? errors.ledger
              : preview.prevQty <= 1e-10
              ? preview.earliestBuyDate && date < preview.earliestBuyDate
                ? `Ngày bán (${formatDateVN(date)}) đang sớm hơn lệnh Mua đầu tiên (${formatDateVN(
                    preview.earliestBuyDate
                  )}). Hãy chọn ngày bán sau hoặc bằng ngày mua.`
                : `Chưa có khối lượng ${symbol.toUpperCase()} đang nắm giữ tính đến ngày ${formatDateVN(
                    date
                  )}. Sổ cái chặn bán khống để bảo toàn tiền thực.`
              : `Khối lượng bán (${formatQty(
                  preview.qty,
                  !preview.isVN
                )}) vượt quá số lượng đang nắm giữ tính đến ngày ${formatDateVN(date)} (${formatQty(
                  preview.prevQty,
                  !preview.isVN
                )}). Hãy điều chỉnh nhỏ hơn hoặc bằng ${formatQty(preview.prevQty, !preview.isVN)}.`}
          </div>
        )}

        <div className="p-3.5 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] border border-[#E4E2DB] dark:border-[#262F3D] space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between border-b border-[#E4E2DB] dark:border-[#262F3D] pb-1.5">
            <span className="font-semibold text-[#141413] dark:text-[#ECEBE6]">
              Xem trước bút toán sổ cái kép
            </span>
            <span className="text-[#63625C] dark:text-[#8E98A8] font-num">
              Giá TT API:{' '}
              {liveQuote.loading ? (
                'Đang tải...'
              ) : liveQuote.data && liveQuote.data.price > 0 ? (
                <strong className="text-[#0E5A4F] dark:text-[#38B29A]">
                  {preview.isVN
                    ? formatVND(liveQuote.data.price)
                    : formatUSD(liveQuote.data.price)}{' '}
                  ({liveQuote.data.source})
                </strong>
              ) : (
                '—'
              )}
            </span>
          </div>

          {side === 'BUY' ? (
            <>
              <div className="flex justify-between">
                <span className="text-[#63625C] dark:text-[#8E98A8]">
                  {preview.activeBuyFundingMode === 'LIVING_WALLET'
                    ? `Trừ ví "${preview.selectedLivingWallet?.name || 'Ngân hàng'}" (Nạp + Mua):`
                    : preview.activeBuyFundingMode === 'EXISTING_HOLDING'
                    ? 'Khai báo vốn đầu kỳ (Cân bằng sổ cái, sức mua 0 đổi):'
                    : 'Trừ ví Tiền chờ đầu tư (Vốn + Phí):'}
                </span>
                <strong className="text-[#141413] dark:text-[#ECEBE6] font-num">
                  {preview.activeBuyFundingMode === 'EXISTING_HOLDING' ? '' : '-'}
                  {preview.isVN
                    ? formatVND(preview.tradeValue)
                    : `${formatUSD(preview.tradeValue)} (≈ ${formatVND(preview.tradeValueVnd)})`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#63625C] dark:text-[#8E98A8]">Khối lượng sau lệnh:</span>
                <span className="font-semibold text-[#141413] dark:text-[#ECEBE6] font-num">
                  {formatQty(preview.prevQty, !preview.isVN)} →{' '}
                  <strong className="text-[#0E5A4F] dark:text-[#38B29A]">
                    {formatQty(preview.nextQty, !preview.isVN)}
                  </strong>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#63625C] dark:text-[#8E98A8]">
                  Giá mua TB tự động tính sau lệnh:
                </span>
                <strong className="text-[#137A4B] dark:text-[#34D399] font-num">
                  {preview.isVN ? formatVND(preview.nextAvg) : formatUSD(preview.nextAvg)}
                </strong>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-[#63625C] dark:text-[#8E98A8]">
                  1. Vốn gốc giải phóng khỏi danh mục:
                </span>
                <strong className="text-[#141413] dark:text-[#ECEBE6] font-num">
                  {preview.isVN
                    ? formatVND(preview.costBasisReleased)
                    : formatUSD(preview.costBasisReleased)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span
                  className={
                    preview.expectedRealized < 0
                      ? 'text-[#BE123C] dark:text-[#FB7185] font-medium'
                      : 'text-[#63625C] dark:text-[#8E98A8]'
                  }
                >
                  {preview.expectedRealized < 0
                    ? '2. Khoản lỗ chốt mất đi (→ Mục Lời / Lãi):'
                    : '2. Khoản lãi chốt được (→ Mục Lời / Lãi):'}
                </span>
                <strong
                  className={`font-num ${
                    preview.expectedRealized >= 0
                      ? 'text-[#137A4B] dark:text-[#34D399]'
                      : 'text-[#BE123C] dark:text-[#FB7185]'
                  }`}
                >
                  {preview.isVN
                    ? formatSignedVND(preview.expectedRealized)
                    : `${preview.expectedRealized >= 0 ? '+' : ''}${formatUSD(
                        preview.expectedRealized
                      )} (${formatSignedVND(preview.expectedRealizedVnd)})`}
                </strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-dashed border-[#E4E2DB] dark:border-[#262F3D]">
                <span className="font-medium text-[#141413] dark:text-[#ECEBE6]">
                  {preview.expectedRealized < 0
                    ? '3. Tiền thực thu về Tiền chờ ĐT (Gốc − Lỗ − Phí):'
                    : '3. Tiền thực thu về Tiền chờ ĐT (Gốc + Lãi − Phí):'}
                </span>
                <strong className="text-[#0F766E] dark:text-[#2DD4BF] font-num">
                  +
                  {preview.isVN
                    ? formatVND(preview.tradeValue)
                    : `${formatUSD(preview.tradeValue)} (≈ ${formatVND(preview.tradeValueVnd)})`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#63625C] dark:text-[#8E98A8]">Khối lượng còn nắm giữ:</span>
                <span className="font-semibold text-[#141413] dark:text-[#ECEBE6] font-num">
                  {formatQty(preview.prevQty, !preview.isVN)} →{' '}
                  <strong className="text-[#141413] dark:text-[#ECEBE6]">
                    {formatQty(preview.nextQty, !preview.isVN)}
                  </strong>
                  {preview.nextQty <= 1e-10 && preview.prevQty > 0 ? ' (Đóng hết vị thế)' : ''}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="aui-btn px-4 py-2 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-semibold"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="aui-btn px-5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] font-semibold"
          >
            {editing ? 'Cập nhật lệnh' : 'Ghi sổ giao dịch'}
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}

// ============================================================================
// MODAL 3: WALLET (CASH / BANK / SAVINGS)
// ============================================================================

export function WalletModal({
  open,
  onClose,
  editing,
  ledgerBalance,
  onOpenTransferModal,
  onSave,
  tempo,
  reducedMotion,
}: {
  open: boolean;
  onClose: () => void;
  editing: Wallet | null;
  ledgerBalance?: number;
  onOpenTransferModal?: () => void;
  onSave: (wallet: Wallet, isEdit: boolean) => void;
  tempo: number;
  reducedMotion: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('BANK');
  const [cashGroup, setCashGroup] = useState<WalletCashGroup>('LIVING');
  const [balance, setBalance] = useState('');
  const [note, setNote] = useState('');
  const [errorName, setErrorName] = useState('');
  const [shakeTick, setShakeTick] = useState(0);

  const isEditingInvLedger = Boolean(editing && cashGroup === 'INVESTMENT');
  const effectiveInvBal = ledgerBalance ?? editing?.balance ?? 0;

  useEffect(() => {
    if (!open) return;
    setErrorName('');
    if (editing) {
      setName(editing.name);
      setType(editing.type || 'BANK');
      setCashGroup(getWalletCashGroup(editing));
      setBalance(String(editing.balance));
      setNote(editing.note || '');
    } else {
      setName('');
      setType('BANK');
      setCashGroup('LIVING');
      setBalance('');
      setNote('');
    }
  }, [open, editing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorName('Vui lòng nhập tên ví hoặc tài khoản.');
      setShakeTick((t) => t + 1);
      return;
    }
    const id = editing?.id || `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nextBalance = isEditingInvLedger
      ? Math.max(0, Math.round(effectiveInvBal))
      : Math.max(0, Math.round(parseSmartNumber(balance, true)));
    onSave(
      {
        id,
        name: trimmed,
        type,
        cashGroup,
        balance: nextBalance,
        note: note.trim(),
        createdAt: editing?.createdAt || Date.now(),
      },
      Boolean(editing)
    );
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-md"
      tempo={tempo}
      reducedMotion={reducedMotion}
    >
      <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-between shrink-0">
        <h3 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
          {editing ? 'Chỉnh sửa ví tiền mặt / sức mua' : 'Thêm Ví tiền mặt / Sức mua'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="aui-btn text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] p-1 rounded-lg"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <form noValidate onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs overflow-y-auto">
        <div>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Nhóm tài sản tiền mặt
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFEDE7] dark:bg-[#0D1117] rounded-lg border border-[#E4E2DB] dark:border-[#262F3D]">
            {WALLET_CASH_GROUPS.map((grp) => {
              const active = cashGroup === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => {
                    setCashGroup(grp.id);
                    if (grp.id === 'INVESTMENT' && type !== 'INVESTMENT' && type !== 'BANK') {
                      setType('INVESTMENT');
                    } else if (grp.id === 'LIVING' && type === 'INVESTMENT') {
                      setType('BANK');
                    }
                  }}
                  className={`aui-btn py-2 px-2.5 rounded-md font-semibold whitespace-nowrap ${
                    active
                      ? grp.id === 'INVESTMENT'
                        ? 'bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117]'
                        : 'bg-[#B47B2B] dark:bg-[#E2B05E] text-white dark:text-[#0D1117]'
                      : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
                  }`}
                >
                  {grp.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
            {cashGroup === 'INVESTMENT'
              ? 'Ví Tiền chờ đầu tư vận hành theo Sổ cái kép (Nạp − Rút − Mua + Bán), tách khỏi Thu – Chi hằng ngày.'
              : 'Ví Tiền mặt sinh hoạt hiển thị trong sổ Thu – Chi hằng ngày và làm nguồn Nạp/Rút vốn sang kênh đầu tư.'}
          </p>
        </div>

        <div key={`w-name-${errorName ? shakeTick : 0}`} className={errorName ? 'aui-shake' : ''}>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Tên ví / tài khoản
          </label>
          <input
            type="text"
            autoFocus
            aria-invalid={Boolean(errorName)}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errorName) setErrorName('');
            }}
            placeholder={
              cashGroup === 'INVESTMENT'
                ? 'VD: Tiền chờ đầu tư VPS, Sức mua SSI, Techcombank Chứng khoán...'
                : 'VD: Ví tiền mặt, Vietcombank, Tiết kiệm 6T...'
            }
            className={`${INPUT_BASE} ${errorName ? INPUT_ERROR : ''}`}
          />
          {errorName && (
            <p
              role="alert"
              className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
            >
              {errorName}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Loại tài khoản
            </label>
            <select
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as WalletType;
                setType(nextType);
                if (nextType === 'INVESTMENT') {
                  setCashGroup('INVESTMENT');
                } else if (type === 'INVESTMENT') {
                  setCashGroup('LIVING');
                }
              }}
              className={INPUT_BASE}
            >
              {WALLET_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              {isEditingInvLedger
                ? 'Sức mua sổ cái (Chỉ đọc)'
                : cashGroup === 'INVESTMENT'
                ? 'Vốn nạp khởi tạo (VNĐ)'
                : 'Số dư hiện có (VNĐ)'}
            </label>
            {isEditingInvLedger ? (
              <div
                className={`px-3 py-2 rounded-lg border border-[#E4E2DB] dark:border-[#262F3D] bg-[#EFEDE7]/70 dark:bg-[#0D1117]/90 font-bold font-num ${
                  effectiveInvBal < 0
                    ? 'text-[#BE123C] dark:text-[#FB7185]'
                    : 'text-[#0F766E] dark:text-[#2DD4BF]'
                }`}
              >
                {formatVND(effectiveInvBal)}
              </div>
            ) : (
              <input
                type="text"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="VD: 50.000.000"
                className={`${INPUT_BASE} font-bold font-num`}
              />
            )}
          </div>
        </div>

        {isEditingInvLedger ? (
          <div className="p-2.5 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] border border-[#E4E2DB] dark:border-[#262F3D] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#63625C] dark:text-[#8E98A8]">
            <span>Số dư tự tính từ Nạp − Rút − Mua + Bán để tránh lệch sổ cái.</span>
            {onOpenTransferModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTransferModal();
                }}
                className="font-semibold text-[#0F766E] dark:text-[#2DD4BF] hover:underline whitespace-nowrap"
              >
                Mở Nạp / Rút vốn →
              </button>
            )}
          </div>
        ) : cashGroup === 'INVESTMENT' ? (
          <p className="text-[11px] text-[#0F766E] dark:text-[#2DD4BF]">
            Nếu nhập số dư ban đầu &gt; 0, hệ thống sẽ tự tạo bút toán Nạp vốn khởi tạo để khớp Vốn
            nạp ròng.
          </p>
        ) : null}

        <div>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Ghi chú
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tùy chọn..."
            className={INPUT_BASE}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="aui-btn px-4 py-2 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-semibold"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="aui-btn px-5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] font-semibold"
          >
            Lưu ví tiền
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}

// ============================================================================
// MODAL 4: MONTHLY CATEGORY BUDGET
// ============================================================================

export function BudgetModal({
  open,
  onClose,
  editing,
  selectedMonth,
  existingBudgets,
  onSave,
  tempo,
  reducedMotion,
}: {
  open: boolean;
  onClose: () => void;
  editing: BudgetRule | null;
  selectedMonth: string;
  existingBudgets: BudgetRule[];
  onSave: (rule: BudgetRule, isEdit: boolean) => void;
  tempo: number;
  reducedMotion: boolean;
}) {
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].id);
  const [scope, setScope] = useState<'DEFAULT' | 'MONTH'>('DEFAULT');
  const [limitAmount, setLimitAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [shakeTick, setShakeTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    if (editing) {
      setCategory(editing.category);
      setScope(editing.month === 'DEFAULT' ? 'DEFAULT' : 'MONTH');
      setLimitAmount(String(editing.limitAmount));
    } else {
      const configuredCats = new Set(existingBudgets.map((b) => b.category));
      const firstUnset =
        EXPENSE_CATEGORIES.find((c) => !configuredCats.has(c.id))?.id || EXPENSE_CATEGORIES[0].id;
      setCategory(firstUnset);
      setScope('DEFAULT');
      setLimitAmount('');
    }
  }, [open, editing, existingBudgets]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.round(parseSmartNumber(limitAmount, true));
    if (parsed <= 0) {
      setErrorMsg('Hạn mức ngân sách phải lớn hơn 0.');
      setShakeTick((t) => t + 1);
      return;
    }

    const targetMonth = scope === 'DEFAULT' ? 'DEFAULT' : selectedMonth;
    const matchedExisting = existingBudgets.find(
      (b) => b.category === category && b.month === targetMonth
    );
    const id =
      editing?.id ||
      matchedExisting?.id ||
      `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    onSave(
      {
        id,
        category,
        month: targetMonth,
        limitAmount: parsed,
        createdAt: editing?.createdAt || matchedExisting?.createdAt || Date.now(),
      },
      Boolean(editing || matchedExisting)
    );
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-md"
      tempo={tempo}
      reducedMotion={reducedMotion}
    >
      <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-between shrink-0">
        <h3 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
          {editing ? 'Chỉnh sửa hạn mức ngân sách' : 'Đặt ngân sách chi tiêu'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="aui-btn text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] p-1 rounded-lg"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <form noValidate onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
        <div>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Danh mục chi tiêu
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={INPUT_BASE}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Phạm vi áp dụng
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFEDE7] dark:bg-[#0D1117] rounded-lg border border-[#E4E2DB] dark:border-[#262F3D]">
            <button
              type="button"
              onClick={() => setScope('DEFAULT')}
              className={`aui-btn py-1.5 rounded-md font-semibold ${
                scope === 'DEFAULT'
                  ? 'bg-white dark:bg-[#1C2430] text-[#141413] dark:text-[#ECEBE6] shadow-xs'
                  : 'text-[#63625C] dark:text-[#8E98A8]'
              }`}
            >
              Mọi tháng (Mặc định)
            </button>
            <button
              type="button"
              onClick={() => setScope('MONTH')}
              className={`aui-btn py-1.5 rounded-md font-semibold ${
                scope === 'MONTH'
                  ? 'bg-white dark:bg-[#1C2430] text-[#141413] dark:text-[#ECEBE6] shadow-xs'
                  : 'text-[#63625C] dark:text-[#8E98A8]'
              }`}
            >
              Riêng {formatMonthLabel(selectedMonth)}
            </button>
          </div>
        </div>

        <div key={`b-lim-${errorMsg ? shakeTick : 0}`} className={errorMsg ? 'aui-shake' : ''}>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Hạn mức tối đa mỗi tháng (VNĐ)
          </label>
          <input
            type="text"
            autoFocus
            aria-invalid={Boolean(errorMsg)}
            value={limitAmount}
            onChange={(e) => {
              setLimitAmount(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="VD: 5.000.000"
            className={`${INPUT_BASE} py-2.5 text-sm font-bold font-num ${errorMsg ? INPUT_ERROR : ''}`}
          />
          {errorMsg ? (
            <p
              role="alert"
              className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
            >
              {errorMsg}
            </p>
          ) : limitAmount ? (
            <p className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
              Cảnh báo sớm ở 80%:{' '}
              <strong className="text-[#B45309] dark:text-[#FBBF24]">
                {formatVND(parseSmartNumber(limitAmount, true) * 0.8)}
              </strong>
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="aui-btn px-4 py-2 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-semibold"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="aui-btn px-5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] font-semibold"
          >
            Lưu ngân sách
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}

// ============================================================================
// MODAL 5: CONFIRMATION DIALOG
// ============================================================================

export function ConfirmModal({
  open,
  config,
  onClose,
  tempo,
  reducedMotion,
}: {
  open: boolean;
  config: ConfirmDialogConfig | null;
  onClose: () => void;
  tempo: number;
  reducedMotion: boolean;
}) {
  return (
    <AnimatedModal
      open={open && Boolean(config)}
      onClose={onClose}
      maxWidthClass="max-w-sm"
      tempo={tempo}
      reducedMotion={reducedMotion}
    >
      {config && (
        <>
          <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-[#BE123C] dark:text-[#FB7185] shrink-0" />
            <h3 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
              {config.title}
            </h3>
          </div>
          <div className="p-5 text-xs text-[#63625C] dark:text-[#8E98A8] leading-relaxed">
            {config.message}
          </div>
          <div className="px-5 py-3 bg-[#F6F5F1] dark:bg-[#0D1117] border-t border-[#E4E2DB] dark:border-[#262F3D] flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="aui-btn px-4 py-2 rounded-lg bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-semibold hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={config.onConfirm}
              className="aui-btn px-4 py-2 rounded-lg bg-[#BE123C] hover:bg-[#9F1239] dark:bg-[#FB7185] dark:hover:bg-[#F43F5E] text-white dark:text-[#0D1117] text-xs font-semibold"
            >
              Xác nhận
            </button>
          </div>
        </>
      )}
    </AnimatedModal>
  );
}

// ============================================================================
// MODAL 6: CAPITAL TRANSFER (DEPOSIT / WITHDRAW BETWEEN LIVING & INVESTMENT)
// ============================================================================

export function CapitalTransferModal({
  open,
  onClose,
  wallets,
  investmentWalletBalances,
  onSave,
  tempo,
  reducedMotion,
}: {
  open: boolean;
  onClose: () => void;
  wallets: Wallet[];
  investmentWalletBalances?: Record<string, number>;
  onSave: (transfer: CapitalTransfer, autoCreateInvWallet: boolean) => void;
  tempo: number;
  reducedMotion: boolean;
}) {
  const livingWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'LIVING'),
    [wallets]
  );
  const investmentWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'INVESTMENT'),
    [wallets]
  );

  const getWalletDisplayBal = (w: Wallet) =>
    getWalletCashGroup(w) === 'INVESTMENT' &&
    investmentWalletBalances &&
    w.id in investmentWalletBalances
      ? investmentWalletBalances[w.id]
      : Number(w.balance) || 0;

  const [direction, setDirection] = useState<CapitalTransferDirection>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [targetWalletId, setTargetWalletId] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [note, setNote] = useState('');
  const [errorAmt, setErrorAmt] = useState('');
  const [shakeTick, setShakeTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setErrorAmt('');
    setDirection('DEPOSIT');
    setAmount('');
    setSourceWalletId(livingWallets[0]?.id || '');
    setTargetWalletId(investmentWallets[0]?.id || AUTO_CREATE_INV_WALLET_ID);
    setDate(getTodayISO());
    setNote('');
  }, [open, livingWallets, investmentWallets]);

  const handleDirectionChange = (nextDir: CapitalTransferDirection) => {
    setDirection(nextDir);
    if (nextDir === 'DEPOSIT') {
      setSourceWalletId(livingWallets[0]?.id || '');
      setTargetWalletId(investmentWallets[0]?.id || AUTO_CREATE_INV_WALLET_ID);
    } else {
      setSourceWalletId(investmentWallets[0]?.id || '');
      setTargetWalletId(livingWallets[0]?.id || '');
    }
  };

  const parsedAmount = Math.round(parseSmartNumber(amount, true));
  const sourceWallet = wallets.find((w) => w.id === sourceWalletId) || null;
  const sourceWalletBal = sourceWallet ? getWalletDisplayBal(sourceWallet) : 0;
  const insufficientSource =
    Boolean(sourceWallet) && parsedAmount > 0 && parsedAmount > sourceWalletBal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setErrorAmt('Số tiền nạp / rút phải lớn hơn 0.');
      setShakeTick((t) => t + 1);
      return;
    }

    const autoCreateInv =
      direction === 'DEPOSIT' && targetWalletId === AUTO_CREATE_INV_WALLET_ID;
    const id = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    onSave(
      {
        id,
        direction,
        amount: parsedAmount,
        sourceWalletId: sourceWalletId === AUTO_CREATE_INV_WALLET_ID ? '' : sourceWalletId,
        targetWalletId: autoCreateInv ? '' : targetWalletId,
        date: date || getTodayISO(),
        note: note.trim(),
        createdAt: Date.now(),
      },
      autoCreateInv
    );
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-md"
      tempo={tempo}
      reducedMotion={reducedMotion}
    >
      <div className="px-5 py-4 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-between shrink-0">
        <h3 className="font-display text-base font-semibold text-[#141413] dark:text-[#ECEBE6]">
          Nạp / Rút vốn đầu tư
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="aui-btn text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6] p-1 rounded-lg"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form noValidate onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs overflow-y-auto">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFEDE7] dark:bg-[#0D1117] rounded-lg border border-[#E4E2DB] dark:border-[#262F3D]">
          <button
            type="button"
            onClick={() => handleDirectionChange('DEPOSIT')}
            className={`aui-btn py-2 rounded-md font-semibold flex items-center justify-center gap-1.5 ${
              direction === 'DEPOSIT'
                ? 'bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117]'
                : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Nạp vào đầu tư</span>
          </button>
          <button
            type="button"
            onClick={() => handleDirectionChange('WITHDRAW')}
            className={`aui-btn py-2 rounded-md font-semibold flex items-center justify-center gap-1.5 ${
              direction === 'WITHDRAW'
                ? 'bg-[#B47B2B] dark:bg-[#E2B05E] text-white dark:text-[#0D1117]'
                : 'text-[#63625C] dark:text-[#8E98A8] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Rút về sinh hoạt</span>
          </button>
        </div>

        <div key={`tr-amt-${errorAmt ? shakeTick : 0}`} className={errorAmt ? 'aui-shake' : ''}>
          <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
            Số tiền chuyển vốn (VNĐ)
          </label>
          <input
            type="text"
            autoFocus
            aria-invalid={Boolean(errorAmt)}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errorAmt) setErrorAmt('');
            }}
            placeholder="VD: 50.000.000"
            className={`${INPUT_BASE} py-2.5 text-sm font-bold font-num ${
              errorAmt ? INPUT_ERROR : ''
            }`}
          />
          {errorAmt ? (
            <p
              role="alert"
              className="mt-1 text-[11px] font-medium text-[#BE123C] dark:text-[#FB7185]"
            >
              {errorAmt}
            </p>
          ) : parsedAmount > 0 ? (
            <p className="mt-1 text-[11px] text-[#63625C] dark:text-[#8E98A8] font-num">
              Nhận diện:{' '}
              <strong className="text-[#141413] dark:text-[#ECEBE6]">
                {formatVND(parsedAmount)}
              </strong>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              {direction === 'DEPOSIT' ? 'Từ ví Sinh hoạt / NH' : 'Từ ví Tiền chờ đầu tư'}
            </label>
            <select
              value={sourceWalletId}
              onChange={(e) => setSourceWalletId(e.target.value)}
              className={INPUT_BASE}
            >
              <option value="">
                {direction === 'DEPOSIT' ? 'Nguồn ngoài hệ thống' : 'Rút từ sàn ngoài'}
              </option>
              {(direction === 'DEPOSIT' ? livingWallets : investmentWallets).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({formatVND(getWalletDisplayBal(w), true)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              {direction === 'DEPOSIT' ? 'Vào ví Tiền chờ đầu tư' : 'Về ví Sinh hoạt / NH'}
            </label>
            <select
              value={targetWalletId}
              onChange={(e) => setTargetWalletId(e.target.value)}
              className={INPUT_BASE}
            >
              {direction === 'DEPOSIT' ? (
                <>
                  {investmentWallets.length === 0 && (
                    <option value={AUTO_CREATE_INV_WALLET_ID}>
                      + Tự động tạo ví Tiền chờ đầu tư
                    </option>
                  )}
                  {investmentWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatVND(getWalletDisplayBal(w), true)})
                    </option>
                  ))}
                  {investmentWallets.length > 0 && (
                    <option value={AUTO_CREATE_INV_WALLET_ID}>
                      + Tạo ví Tiền chờ đầu tư mới
                    </option>
                  )}
                </>
              ) : (
                <>
                  <option value="">Rút ra ngoài hệ thống</option>
                  {livingWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatVND(getWalletDisplayBal(w), true)})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        {insufficientSource && (
          <div className="p-2.5 rounded-lg bg-[#FFFBEB] dark:bg-[#261E0F] border border-[#F2D59B] dark:border-[#6B4E16] text-[11px] text-[#92400E] dark:text-[#FCD34D]">
            Số dư ví nguồn ({formatVND(sourceWalletBal)}) nhỏ hơn số tiền chuyển — hãy kiểm tra
            lại số tiền rút/nạp trước khi xác nhận.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Ngày thực hiện
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${INPUT_BASE} font-num`}
            />
          </div>
          <div>
            <label className="block font-semibold text-[#141413] dark:text-[#ECEBE6] mb-1">
              Ghi chú nhật ký
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                direction === 'DEPOSIT'
                  ? 'VD: Nạp thêm vốn mua cổ phiếu...'
                  : 'VD: Rút tiền lãi về chi tiêu...'
              }
              className={INPUT_BASE}
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] border border-[#E4E2DB] dark:border-[#262F3D] text-[11px] text-[#63625C] dark:text-[#8E98A8] space-y-1">
          <div className="flex justify-between">
            <span>Tác động Vốn nạp ròng (Net Deposit):</span>
            <strong
              className={`font-num ${
                direction === 'DEPOSIT'
                  ? 'text-[#0E5A4F] dark:text-[#38B29A]'
                  : 'text-[#B47B2B] dark:text-[#E2B05E]'
              }`}
            >
              {parsedAmount > 0
                ? formatSignedVND(direction === 'DEPOSIT' ? parsedAmount : -parsedAmount)
                : '0 đ'}
            </strong>
          </div>
          <p className="leading-relaxed">
            Điều chuyển vốn nội bộ giữa các ví không tính vào sổ Thu – Chi sinh hoạt tháng và giữ
            nguyên tổng NAV thực tế.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="aui-btn px-4 py-2 rounded-lg bg-[#EFEDE7] dark:bg-[#1C2430] hover:bg-[#E4E2DB] dark:hover:bg-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-semibold"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="aui-btn px-5 py-2 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] font-semibold"
          >
            {direction === 'DEPOSIT' ? 'Xác nhận nạp vốn' : 'Xác nhận rút vốn'}
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}
