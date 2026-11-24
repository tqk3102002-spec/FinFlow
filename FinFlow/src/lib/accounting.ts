import {
  ASSET_GROUP_COLORS,
  DEFAULT_CRYPTO_PRICES,
  DEFAULT_VN_PRICES,
  DETAIL_PALETTE,
  EXPENSE_CATEGORIES,
  getWalletCashGroup,
  INCOME_CATEGORIES,
  WALLET_TYPES,
  type AccountingSummary,
  type BudgetEvaluation,
  type BudgetRule,
  type CapitalTransfer,
  type CashflowEntry,
  type CashflowType,
  type CategoryForecastStatus,
  type CategorySpendingForecast,
  type ComputedLot,
  type EnrichedPosition,
  type FinancialStatePayload,
  type ForecastMonthMode,
  type InvestmentAuditEntry,
  type InvestmentTrade,
  type MarketQuote,
  type MonthlyCashflowSummary,
  type MonthlyTrendPoint,
  type SpendingForecast,
  type Wallet,
  type WalletType,
} from '../types/finance';

export function parseSmartNumber(input: unknown, isVNMoney = false): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input === null || input === undefined) return 0;

  let str = String(input)
    .trim()
    .replace(/\s+/g, '')
    .replace(/(USDT|USD|VND|VNĐ|\$|₫)/gi, '');
  if (!str) return 0;

  const isNegative = str.startsWith('-');
  if (isNegative) str = str.slice(1);

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasDot && !hasComma) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = str.replace(/\./g, '');
    } else if (isVNMoney && parts[1].length === 3 && parts[0] !== '0' && parts[0].length > 0) {
      str = str.replace(/\./g, '');
    }
  } else if (hasComma && !hasDot) {
    const parts = str.split(',');
    if (parts.length > 2) {
      str = str.replace(/,/g, '');
    } else if (parts[1].length === 3 && parts[0] !== '0' && parts[0].length <= 3) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const parsed = parseFloat(str);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

export function normalizeVnPriceToFullVND(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num < 1000 ? num * 1000 : num);
}

export function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function getCurrentMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthISO(baseYm: string, deltaMonths: number): string {
  const [yStr, mStr] = baseYm.split('-');
  const d = new Date(Number(yStr), Number(mStr) - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getRecentMonths(endYm: string, count: number): string[] {
  const list: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    list.push(shiftMonthISO(endYm, -i));
  }
  return list;
}

export function formatDateVN(iso: string): string {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

export function formatMonthLabel(ym: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '';
  const [y, m] = ym.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

export function formatShortMonth(ym: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '';
  const [y, m] = ym.split('-');
  return `T${Number(m)}/${y.slice(2)}`;
}

export function formatVND(val: number, compact = false): string {
  if (!Number.isFinite(val)) return '0 đ';
  if (compact) {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} tr`;
    if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}k`;
  }
  return `${Math.round(val).toLocaleString('vi-VN')} đ`;
}

export function formatSignedVND(val: number, compact = false): string {
  if (!Number.isFinite(val) || Math.abs(val) < 1) return '0 đ';
  const absFormatted = formatVND(Math.abs(val), compact);
  return `${val > 0 ? '+' : '-'}${absFormatted}`;
}

export function formatUSD(val: number): string {
  if (!Number.isFinite(val)) return '$0.00';
  const abs = Math.abs(val);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 3 : 5;
  return `${val < 0 ? '-$' : '$'}${abs.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatQty(val: number, isCrypto = false): string {
  if (!Number.isFinite(val)) return '0';
  if (!isCrypto) return Math.round(val).toLocaleString('vi-VN');
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function formatPercent(val: number, signed = false): string {
  if (!Number.isFinite(val) || Math.abs(val) < 0.005) return '0.00%';
  const prefix = signed ? (val > 0 ? '+' : '-') : val < 0 ? '-' : '';
  return `${prefix}${Math.abs(val).toFixed(2)}%`;
}

export function getCategoryColor(type: CashflowType, categoryName: string): string {
  const list = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.id === categoryName)?.color || '#64748B';
}

export function getWalletTypeMeta(type: WalletType) {
  return WALLET_TYPES.find((w) => w.id === type) || WALLET_TYPES[0];
}

export function getTimeNowStr(): string {
  return new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export interface RawPosition {
  key: string;
  symbol: string;
  assetType: 'VN_STOCK' | 'CRYPTO';
  exchange: string;
  currentQty: number;
  avgCost: number;
  realizedPnL: number;
  lots: ComputedLot[];
}

export function resolveTradeFxRate(
  tx: Pick<InvestmentTrade, 'assetType' | 'fxRateAtExecution'>,
  fallbackUsdtRate = 25450
): number {
  if (tx.assetType !== 'CRYPTO') return 1;
  const fallback = Number(fallbackUsdtRate) >= 1000 ? Number(fallbackUsdtRate) : 25450;
  const fx = Number(tx.fxRateAtExecution);
  if (Number.isFinite(fx) && fx >= 1000 && fx <= 1000000) {
    return Math.round(fx);
  }
  return fallback;
}

export function computeAllPositionsFromTrades(
  trades: InvestmentTrade[],
  usdtVndRate = 25450
): RawPosition[] {
  const safeRate = Number(usdtVndRate) >= 1000 ? Number(usdtVndRate) : 25450;
  const sorted = [...(trades || [])].sort((a, b) => {
    const cmpDate = String(a.date || '').localeCompare(String(b.date || ''));
    if (cmpDate !== 0) return cmpDate;
    return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
  });

  const map: Record<string, RawPosition> = {};

  for (const tx of sorted) {
    const sym = String(tx.symbol || '').toUpperCase().trim();
    if (!sym) continue;
    const assetType = tx.assetType === 'CRYPTO' ? 'CRYPTO' : 'VN_STOCK';
    const isCrypto = assetType === 'CRYPTO';
    const key = `${assetType}:${sym}`;

    if (!map[key]) {
      map[key] = {
        key,
        symbol: sym,
        assetType,
        exchange: tx.exchange || (isCrypto ? 'BINANCE' : 'HSX'),
        currentQty: 0,
        avgCost: 0,
        realizedPnL: 0,
        lots: [],
      };
    }

    const pos = map[key];
    if (tx.exchange) pos.exchange = tx.exchange;

    const qty = Number(tx.quantity) || 0;
    const price = Number(tx.price) || 0;
    const explicitFee = Number(tx.feeAmount);
    const legacyFeePct = Number(tx.feePercent) || 0;
    const feeValue =
      Number.isFinite(explicitFee) && explicitFee > 0
        ? explicitFee
        : qty * price * (legacyFeePct / 100);

    const prevQty = pos.currentQty;
    const prevAvg = pos.avgCost;
    let costBasisReleased = 0;
    let netProceeds = 0;
    let stepRealized = 0;
    let stepRealizedVnd = 0;
    let autoSummary = '';

    const fmtUnit = (v: number) => (isCrypto ? formatUSD(v) : formatVND(v));

    if (tx.type === 'BUY') {
      const effectiveCost = qty * price + feeValue;
      const newQty = prevQty + qty;
      const newAvg = newQty > 0 ? (prevQty * prevAvg + effectiveCost) / newQty : 0;
      pos.currentQty = newQty;
      pos.avgCost = newAvg;
      netProceeds = -effectiveCost;
      autoSummary = `Mua ${formatQty(qty, isCrypto)} ${sym} @ ${fmtUnit(price)} · Giá vốn TB mới ${fmtUnit(newAvg)}`;
    } else if (tx.type === 'SELL') {
      const sellQty = Math.min(qty, prevQty);
      const lotFxRate = resolveTradeFxRate(tx, safeRate);
      costBasisReleased = sellQty * prevAvg;
      netProceeds = sellQty * price - feeValue;
      stepRealized = netProceeds - costBasisReleased;
      stepRealizedVnd = isCrypto ? stepRealized * lotFxRate : stepRealized;
      pos.realizedPnL += stepRealized;
      pos.currentQty = Math.max(0, prevQty - sellQty);
      const closedOut = pos.currentQty <= 1e-10;
      if (closedOut) {
        pos.currentQty = 0;
        pos.avgCost = 0;
      }
      const realizedStr = isCrypto
        ? `${stepRealized >= 0 ? '+' : ''}${formatUSD(stepRealized)}`
        : formatSignedVND(stepRealized);
      const actionLabel = stepRealized > 0 ? 'Chốt lãi' : stepRealized < 0 ? 'Chốt lỗ' : 'Hòa vốn';
      autoSummary = `Bán ${formatQty(sellQty, isCrypto)} ${sym} @ ${fmtUnit(price)} (giá vốn TB ${fmtUnit(
        prevAvg
      )}) → ${actionLabel} ${realizedStr}${closedOut ? ' · Đóng hết vị thế' : ''}`;
    }

    pos.lots.push({
      ...tx,
      feeValue,
      qtyBefore: prevQty,
      avgCostBefore: prevAvg,
      costBasisReleased,
      netProceeds,
      qtyAfter: pos.currentQty,
      avgCostAfter: pos.avgCost,
      stepRealized,
      stepRealizedVnd,
      autoSummary,
    });
  }

  return Object.values(map).filter((p) => p.lots.length > 0);
}

export function computePositionsFromTrades(
  trades: InvestmentTrade[],
  usdtVndRate = 25450
): RawPosition[] {
  return computeAllPositionsFromTrades(trades, usdtVndRate).filter((p) => p.currentQty > 1e-10);
}

/**
 * Compute exact held quantity & weighted-average cost of a symbol on or before `targetDate`
 * (optionally excluding a trade being edited) so SELL validation obeys chronological ledger order.
 */
export function computeHeldPositionAtDate(
  trades: InvestmentTrade[],
  assetType: 'VN_STOCK' | 'CRYPTO',
  symbol: string,
  targetDate: string,
  usdtVndRate = 25450,
  excludeTradeId?: string
): { currentQty: number; avgCost: number; exchange: string; earliestBuyDate: string } {
  const normSym = String(symbol || '').toUpperCase().trim();
  if (!normSym) {
    return {
      currentQty: 0,
      avgCost: 0,
      exchange: assetType === 'CRYPTO' ? 'BINANCE' : 'HSX',
      earliestBuyDate: '',
    };
  }

  const relevant = (trades || []).filter(
    (t) =>
      t.id !== excludeTradeId &&
      t.assetType === assetType &&
      String(t.symbol || '').toUpperCase().trim() === normSym
  );

  let earliestBuyDate = '';
  for (const t of relevant) {
    if (t.type === 'BUY' && t.date && (!earliestBuyDate || t.date < earliestBuyDate)) {
      earliestBuyDate = t.date;
    }
  }

  const upToDate = targetDate
    ? relevant.filter((t) => String(t.date || '') <= targetDate)
    : relevant;
  const pos = computeAllPositionsFromTrades(upToDate, usdtVndRate).find(
    (p) => p.symbol === normSym && p.assetType === assetType
  );

  return {
    currentQty: pos?.currentQty || 0,
    avgCost: pos?.avgCost || 0,
    exchange: pos?.exchange || (assetType === 'CRYPTO' ? 'BINANCE' : 'HSX'),
    earliestBuyDate,
  };
}

/**
 * Validate that a full set of trades never has a SELL exceeding available held quantity
 * at its chronological point in time.
 */
export function validateTradeLedgerOrder(
  trades: InvestmentTrade[],
  usdtVndRate = 25450
): { valid: boolean; error?: string } {
  const allPos = computeAllPositionsFromTrades(trades, usdtVndRate);
  for (const pos of allPos) {
    for (const lot of pos.lots) {
      if (lot.type === 'SELL' && lot.quantity > lot.qtyBefore + 1e-9) {
        const isCr = pos.assetType === 'CRYPTO';
        return {
          valid: false,
          error: `Lệnh bán ${pos.symbol} ngày ${formatDateVN(lot.date)} (${formatQty(
            lot.quantity,
            isCr
          )}) vượt quá khối lượng đang nắm giữ tính đến ngày đó (${formatQty(lot.qtyBefore, isCr)}).`,
        };
      }
    }
  }
  return { valid: true };
}

/**
 * Strict Double-Entry Ledger computation for Investment Purchasing Power (Tiền chờ đầu tư):
 *   InvestmentCash = OpeningAdjustment + Tổng Nạp − Tổng Rút − Tổng chi Mua + Tổng thu Bán
 *                  ≡ OpeningAdjustment + NetDeposit − OpenCostBasis + RealizedPnL
 *
 * Guarantees that selling a losing position credits ONLY actual net proceeds (CostBasis - Loss - Fee),
 * never returning to original principal and never silently clamping overdrafts to 0.
 */
export function computeLedgerInvestmentWalletBalances(
  wallets: Wallet[],
  investments: InvestmentTrade[],
  transfers: CapitalTransfer[],
  usdtVndRate = 25450,
  precomputedPositions?: RawPosition[]
): {
  investmentWalletBalances: Record<string, number>;
  investmentCashVnd: number;
  totalBuyOutflowVnd: number;
  totalSellInflowVnd: number;
  ledgerOpeningAdjustmentVnd: number;
} {
  const safeRate = Number(usdtVndRate) >= 1000 ? Number(usdtVndRate) : 25450;
  const invWallets = (wallets || []).filter((w) => getWalletCashGroup(w) === 'INVESTMENT');
  const invWalletSet = new Set(invWallets.map((w) => w.id));
  const primaryInvWalletId = invWallets[0]?.id || '';

  const balances: Record<string, number> = {};
  for (const w of invWallets) {
    balances[w.id] = 0;
  }

  const hasLedgerActivity = (transfers || []).length > 0 || (investments || []).length > 0;
  let ledgerOpeningAdjustmentVnd = 0;

  // Safeguard for legacy accounts that created an INVESTMENT wallet with starting balance before any ledger entry
  if (!hasLedgerActivity) {
    for (const w of invWallets) {
      const bal = Math.max(0, Number(w.balance) || 0);
      balances[w.id] = bal;
      ledgerOpeningAdjustmentVnd += bal;
    }
    return {
      investmentWalletBalances: balances,
      investmentCashVnd: ledgerOpeningAdjustmentVnd,
      totalBuyOutflowVnd: 0,
      totalSellInflowVnd: 0,
      ledgerOpeningAdjustmentVnd,
    };
  }

  const creditWallet = (preferredId: string | undefined, deltaVnd: number) => {
    if (!deltaVnd) return;
    const targetId =
      preferredId && invWalletSet.has(preferredId) ? preferredId : primaryInvWalletId;
    if (targetId) {
      balances[targetId] = (balances[targetId] || 0) + deltaVnd;
    }
  };

  let netDepositVnd = 0;
  for (const tr of transfers || []) {
    const amt = Math.max(0, Number(tr.amount) || 0);
    if (tr.direction === 'DEPOSIT') {
      netDepositVnd += amt;
      creditWallet(tr.targetWalletId, amt);
    } else {
      netDepositVnd -= amt;
      creditWallet(tr.sourceWalletId, -amt);
    }
  }

  const rawPositions =
    precomputedPositions || computeAllPositionsFromTrades(investments || [], safeRate);
  let totalBuyOutflowVnd = 0;
  let totalSellInflowVnd = 0;

  for (const pos of rawPositions) {
    for (const lot of pos.lots) {
      const rateMul = resolveTradeFxRate(lot, safeRate);
      if (lot.type === 'BUY') {
        const buyOutflowVnd = Math.abs(lot.netProceeds) * rateMul;
        totalBuyOutflowVnd += buyOutflowVnd;
        creditWallet(lot.walletId, -buyOutflowVnd);
      } else if (lot.type === 'SELL') {
        const sellInflowVnd = lot.netProceeds * rateMul;
        totalSellInflowVnd += sellInflowVnd;
        creditWallet(lot.walletId, sellInflowVnd);
      }
    }
  }

  // Round each wallet's ledger balance to integer VND
  for (const wId of Object.keys(balances)) {
    balances[wId] = Math.round(balances[wId]);
  }

  const investmentCashVnd = Math.round(netDepositVnd - totalBuyOutflowVnd + totalSellInflowVnd);

  return {
    investmentWalletBalances: balances,
    investmentCashVnd,
    totalBuyOutflowVnd,
    totalSellInflowVnd,
    ledgerOpeningAdjustmentVnd,
  };
}

export function computeAccountingSummary(
  wallets: Wallet[],
  investments: InvestmentTrade[],
  marketQuotes: Record<string, MarketQuote>,
  usdtVndRate: number,
  transfers: CapitalTransfer[] = []
): AccountingSummary {
  const safeRate = Number(usdtVndRate) >= 1000 ? Number(usdtVndRate) : 25450;
  const allRawPositions = computeAllPositionsFromTrades(investments, safeRate);

  const enrichedAll: EnrichedPosition[] = allRawPositions.map((pos) => {
    const isCrypto = pos.assetType === 'CRYPTO';
    const quote = marketQuotes[pos.key];
    const defVn = DEFAULT_VN_PRICES[pos.symbol];
    const defCr = DEFAULT_CRYPTO_PRICES[pos.symbol];

    const currentPrice =
      quote && quote.price > 0
        ? quote.price
        : isCrypto
        ? defCr?.price || pos.avgCost
        : defVn?.price || pos.avgCost;

    const refPrice =
      quote && quote.refPrice > 0
        ? quote.refPrice
        : isCrypto
        ? defCr?.refPrice || currentPrice
        : defVn?.refPrice || currentPrice;

    if (isCrypto) {
      const investedUsd = pos.currentQty * pos.avgCost;
      const currentUsd = pos.currentQty * currentPrice;
      const pnlUsd = currentUsd - investedUsd;
      const pnlPercent = pos.avgCost > 0 ? ((currentPrice - pos.avgCost) / pos.avgCost) * 100 : 0;
      const investedVnd = investedUsd * safeRate;
      const currentVnd = currentUsd * safeRate;
      const pnlVnd = currentVnd - investedVnd;

      return {
        ...pos,
        isCrypto: true,
        currentPrice,
        refPrice,
        source: quote?.source || 'THAM CHIẾU',
        updatedAt: quote?.updatedAt || '--:--',
        investedUsd,
        currentUsd,
        pnlUsd,
        investedVnd,
        currentVnd,
        pnlVnd,
        pnlPercent,
      };
    } else {
      const investedVnd = pos.currentQty * pos.avgCost;
      const currentVnd = pos.currentQty * currentPrice;
      const pnlVnd = currentVnd - investedVnd;
      const pnlPercent = investedVnd > 0 ? (pnlVnd / investedVnd) * 100 : 0;

      return {
        ...pos,
        isCrypto: false,
        currentPrice,
        refPrice,
        source: quote?.source || 'THAM CHIẾU',
        updatedAt: quote?.updatedAt || '--:--',
        investedUsd: 0,
        currentUsd: 0,
        pnlUsd: 0,
        investedVnd,
        currentVnd,
        pnlVnd,
        pnlPercent,
      };
    }
  });

  // Open positions carry balance-sheet Cost Basis & Unrealized P&L
  const openPositions = enrichedAll.filter((p) => p.currentQty > 1e-10);
  // Closed positions are retained strictly for Realized P&L and Audit Log integrity
  const closedPositions = enrichedAll.filter((p) => p.currentQty <= 1e-10 && p.lots.length > 0);

  const vnStocks = openPositions.filter((p) => !p.isCrypto);
  const cryptos = openPositions.filter((p) => p.isCrypto);

  const livingWallets = wallets.filter((w) => getWalletCashGroup(w) === 'LIVING');
  const investmentWallets = wallets.filter((w) => getWalletCashGroup(w) === 'INVESTMENT');

  const cashHandVnd = livingWallets
    .filter((w) => w.type === 'CASH')
    .reduce((s, w) => s + (Number(w.balance) || 0), 0);
  const bankVnd = livingWallets
    .filter((w) => w.type === 'BANK')
    .reduce((s, w) => s + (Number(w.balance) || 0), 0);
  const savingsVnd = livingWallets
    .filter((w) => w.type === 'SAVINGS')
    .reduce((s, w) => s + (Number(w.balance) || 0), 0);
  const livingCashVnd = livingWallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

  // Strict Double-Entry Ledger for Tiền chờ đầu tư (Nạp - Rút - Mua + Bán)
  const ledgerCash = computeLedgerInvestmentWalletBalances(
    wallets,
    investments,
    transfers,
    safeRate,
    allRawPositions
  );
  const investmentCashVnd = ledgerCash.investmentCashVnd;
  const totalCashVnd = livingCashVnd + investmentCashVnd;

  const vnCostVnd = vnStocks.reduce((s, p) => s + p.investedVnd, 0);
  const vnMarketVnd = vnStocks.reduce((s, p) => s + p.currentVnd, 0);
  const vnPnLVnd = vnMarketVnd - vnCostVnd;
  const vnPnLPct = vnCostVnd > 0 ? (vnPnLVnd / vnCostVnd) * 100 : 0;

  const cryptoCostUsd = cryptos.reduce((s, p) => s + p.investedUsd, 0);
  const cryptoMarketUsd = cryptos.reduce((s, p) => s + p.currentUsd, 0);
  const cryptoPnLUsd = cryptoMarketUsd - cryptoCostUsd;
  const cryptoPnLPct = cryptoCostUsd > 0 ? (cryptoPnLUsd / cryptoCostUsd) * 100 : 0;
  const cryptoCostVnd = cryptos.reduce((s, p) => s + p.investedVnd, 0);
  const cryptoMarketVnd = cryptos.reduce((s, p) => s + p.currentVnd, 0);
  const cryptoPnLVnd = cryptoMarketVnd - cryptoCostVnd;

  // Realized P&L spans ALL positions (both open and 100%-closed), using each SELL lot's locked historical FX rate
  const vnRealizedPnLVnd = enrichedAll
    .filter((p) => !p.isCrypto)
    .reduce((s, p) => s + p.realizedPnL, 0);
  const cryptoRealizedPnLUsd = enrichedAll
    .filter((p) => p.isCrypto)
    .reduce((s, p) => s + p.realizedPnL, 0);
  const cryptoRealizedPnLVnd = enrichedAll
    .filter((p) => p.isCrypto)
    .reduce(
      (sum, p) =>
        sum + p.lots.reduce((ls, lot) => (lot.type === 'SELL' ? ls + lot.stepRealizedVnd : ls), 0),
      0
    );

  let totalRealizedProfitVnd = 0;
  let totalRealizedLossVnd = 0;
  for (const pos of enrichedAll) {
    for (const lot of pos.lots) {
      if (lot.type === 'SELL') {
        if (lot.stepRealizedVnd > 0) totalRealizedProfitVnd += lot.stepRealizedVnd;
        else if (lot.stepRealizedVnd < 0) totalRealizedLossVnd += lot.stepRealizedVnd;
      }
    }
  }
  const totalRealizedPnLVnd = vnRealizedPnLVnd + cryptoRealizedPnLVnd;

  const totalInvestedCostVnd = vnCostVnd + cryptoCostVnd;
  const totalInvestedMarketVnd = vnMarketVnd + cryptoMarketVnd;
  const totalUnrealizedPnLVnd = totalInvestedMarketVnd - totalInvestedCostVnd;
  const totalUnrealizedPnLPct =
    totalInvestedCostVnd > 0 ? (totalUnrealizedPnLVnd / totalInvestedCostVnd) * 100 : 0;
  const totalInvestmentPnLVnd = totalRealizedPnLVnd + totalUnrealizedPnLVnd;

  // Capital transfers between living wallets and investment purchasing power (Net Deposit)
  const totalDepositedVnd = transfers
    .filter((t) => t.direction === 'DEPOSIT')
    .reduce((s, t) => s + Math.max(0, Number(t.amount) || 0), 0);
  const totalWithdrawnVnd = transfers
    .filter((t) => t.direction === 'WITHDRAW')
    .reduce((s, t) => s + Math.max(0, Number(t.amount) || 0), 0);
  const netDepositVnd = totalDepositedVnd - totalWithdrawnVnd;

  // Strict Double-Entry Balance Sheet Invariant:
  //   NAV = Living Cash + Investment Cash + Open Market Value
  //   Investment Account (Investment Cash + Open Market Value) = OpeningAdjustment + NetDeposit + RealizedPnL + UnrealizedPnL
  const totalBookValueVnd = totalCashVnd + totalInvestedCostVnd;
  const totalMarketNavVnd = totalCashVnd + totalInvestedMarketVnd;
  const cashShareInNavPct =
    totalMarketNavVnd > 0 ? (totalCashVnd / totalMarketNavVnd) * 100 : 0;

  // Unified chronological Investment Audit Log (BUY, SELL, DEPOSIT, WITHDRAW)
  const walletNameMap = new Map(wallets.map((w) => [w.id, w.name]));
  const auditLogs: InvestmentAuditEntry[] = [];

  for (const pos of enrichedAll) {
    for (const lot of pos.lots) {
      const rateMul = resolveTradeFxRate(lot, safeRate);
      const netCashflowVnd = lot.netProceeds * rateMul;
      auditLogs.push({
        id: `trade_${lot.id}`,
        kind: lot.type,
        date: lot.date,
        createdAt: Number(lot.createdAt) || 0,
        symbol: pos.symbol,
        assetType: pos.assetType,
        exchange: lot.exchange || pos.exchange,
        quantity: lot.quantity,
        price: lot.price,
        avgCostBefore: lot.avgCostBefore,
        feeValue: lot.feeValue,
        costBasisReleasedVnd: lot.costBasisReleased * rateMul,
        netCashflowVnd,
        realizedPnLVnd: lot.type === 'SELL' ? lot.stepRealizedVnd : undefined,
        realizedPnLNative: lot.type === 'SELL' ? lot.stepRealized : undefined,
        autoSummary: lot.autoSummary,
        note: lot.note || '',
        sourceTrade: lot,
      });
    }
  }

  for (const tr of transfers) {
    const srcName = tr.sourceWalletId
      ? walletNameMap.get(tr.sourceWalletId) || 'Ví nguồn'
      : 'Nguồn ngoài hệ thống';
    const dstName = tr.targetWalletId
      ? walletNameMap.get(tr.targetWalletId) || 'Ví đích'
      : 'Rút ra ngoài hệ thống';
    const isDeposit = tr.direction === 'DEPOSIT';
    auditLogs.push({
      id: `transfer_${tr.id}`,
      kind: tr.direction,
      date: tr.date,
      createdAt: Number(tr.createdAt) || 0,
      netCashflowVnd: isDeposit ? tr.amount : -tr.amount,
      sourceWalletName: srcName,
      targetWalletName: dstName,
      autoSummary: isDeposit
        ? `Nạp ${formatVND(tr.amount)} từ ${srcName} → ${dstName}`
        : `Rút ${formatVND(tr.amount)} từ ${srcName} → ${dstName}`,
      note: tr.note || '',
      sourceTransfer: tr,
    });
  }

  auditLogs.sort((a, b) => {
    const cmpDate = String(b.date || '').localeCompare(String(a.date || ''));
    if (cmpDate !== 0) return cmpDate;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const livingWalletCount = livingWallets.length;
  const invWalletCount = investmentWallets.length;

  const slicesByCost = [
    {
      name: 'Tiền mặt sinh hoạt',
      value: livingCashVnd,
      color: ASSET_GROUP_COLORS['Tiền mặt sinh hoạt'],
      metaLine: `${livingWalletCount} ví sinh hoạt / tiết kiệm`,
    },
    {
      name: 'Tiền chờ đầu tư',
      value: investmentCashVnd,
      color: ASSET_GROUP_COLORS['Tiền chờ đầu tư'],
      metaLine: `${invWalletCount} ví sức mua trên sàn`,
    },
    {
      name: 'Chứng khoán VN (Vốn gốc)',
      value: vnCostVnd,
      color: ASSET_GROUP_COLORS['Chứng khoán VN'],
      metaLine: `GT hiện tại: ${formatVND(vnMarketVnd, true)}`,
      pnlValue: vnPnLVnd,
    },
    {
      name: 'Crypto (Vốn gốc)',
      value: cryptoCostVnd,
      color: ASSET_GROUP_COLORS.Crypto,
      metaLine: `GT hiện tại: ${formatVND(cryptoMarketVnd, true)}`,
      pnlValue: cryptoPnLVnd,
    },
  ].filter((s) => s.value > 0);

  const slicesByMarket = [
    {
      name: 'Tiền mặt sinh hoạt',
      value: livingCashVnd,
      color: ASSET_GROUP_COLORS['Tiền mặt sinh hoạt'],
      metaLine: `${livingWalletCount} ví sinh hoạt / tiết kiệm`,
    },
    {
      name: 'Tiền chờ đầu tư',
      value: investmentCashVnd,
      color: ASSET_GROUP_COLORS['Tiền chờ đầu tư'],
      metaLine: `${invWalletCount} ví sức mua trên sàn`,
    },
    {
      name: 'Chứng khoán VN (NAV)',
      value: vnMarketVnd,
      color: ASSET_GROUP_COLORS['Chứng khoán VN'],
      metaLine: `Vốn gốc: ${formatVND(vnCostVnd, true)}`,
      pnlValue: vnPnLVnd,
    },
    {
      name: 'Crypto (NAV)',
      value: cryptoMarketVnd,
      color: ASSET_GROUP_COLORS.Crypto,
      metaLine: `Vốn gốc: ${formatVND(cryptoCostVnd, true)}`,
      pnlValue: cryptoPnLVnd,
    },
  ].filter((s) => s.value > 0);

  const slicesDetail = [
    ...wallets
      .map((w) => {
        const bal =
          getWalletCashGroup(w) === 'INVESTMENT'
            ? ledgerCash.investmentWalletBalances[w.id] ?? 0
            : Number(w.balance) || 0;
        return {
          name: w.name,
          value: bal,
          metaLine: getWalletTypeMeta(w.type).label,
        };
      })
      .filter((w) => w.value > 0),
    ...vnStocks.map((s) => ({
      name: `${s.symbol} (CK VN)`,
      value: s.currentVnd,
      metaLine: `Vốn: ${formatVND(s.investedVnd, true)} → Hiện: ${formatVND(s.currentVnd, true)}`,
      pnlValue: s.pnlVnd,
    })),
    ...cryptos.map((c) => ({
      name: `${c.symbol} (Crypto)`,
      value: c.currentVnd,
      metaLine: `Vốn: ${formatVND(c.investedVnd, true)} → Hiện: ${formatVND(c.currentVnd, true)}`,
      pnlValue: c.pnlVnd,
    })),
  ]
    .sort((a, b) => b.value - a.value)
    .map((item, idx) => ({
      ...item,
      color: DETAIL_PALETTE[idx % DETAIL_PALETTE.length],
    }));

  return {
    vnStocks,
    cryptos,
    allPositions: openPositions,
    closedPositions,
    cashHandVnd,
    bankVnd,
    savingsVnd,
    livingCashVnd,
    investmentCashVnd,
    totalCashVnd,
    cashShareInNavPct,
    vnCostVnd,
    vnMarketVnd,
    vnPnLVnd,
    vnPnLPct,
    vnRealizedPnLVnd,
    cryptoCostUsd,
    cryptoMarketUsd,
    cryptoPnLUsd,
    cryptoPnLPct,
    cryptoCostVnd,
    cryptoMarketVnd,
    cryptoPnLVnd,
    cryptoRealizedPnLUsd,
    cryptoRealizedPnLVnd,
    totalInvestedCostVnd,
    totalInvestedMarketVnd,
    totalUnrealizedPnLVnd,
    totalUnrealizedPnLPct,
    totalRealizedProfitVnd,
    totalRealizedLossVnd,
    totalRealizedPnLVnd,
    totalInvestmentPnLVnd,
    totalBuyOutflowVnd: ledgerCash.totalBuyOutflowVnd,
    totalSellInflowVnd: ledgerCash.totalSellInflowVnd,
    ledgerOpeningAdjustmentVnd: ledgerCash.ledgerOpeningAdjustmentVnd,
    investmentWalletBalances: ledgerCash.investmentWalletBalances,
    totalDepositedVnd,
    totalWithdrawnVnd,
    netDepositVnd,
    totalBookValueVnd,
    totalMarketNavVnd,
    auditLogs,
    slicesByCost,
    slicesByMarket,
    slicesDetail,
  };
}

export function computeMonthlyCashflow(
  cashflows: CashflowEntry[],
  selectedMonth: string
): MonthlyCashflowSummary {
  const inMonth = cashflows.filter((c) => String(c.date || '').startsWith(selectedMonth));

  let totalIncome = 0;
  let totalExpense = 0;
  const expByCat: Record<string, number> = {};
  const incByCat: Record<string, number> = {};

  inMonth.forEach((c) => {
    const amt = Number(c.amount) || 0;
    if (c.type === 'INCOME') {
      totalIncome += amt;
      incByCat[c.category] = (incByCat[c.category] || 0) + amt;
    } else {
      totalExpense += amt;
      expByCat[c.category] = (expByCat[c.category] || 0) + amt;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

  const expenseSlices = Object.entries(expByCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      color: getCategoryColor('EXPENSE', name),
    }));

  const incomeSlices = Object.entries(incByCat)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      color: getCategoryColor('INCOME', name),
    }));

  const ratioSlices = [
    { name: 'Tổng Thu', value: totalIncome, color: '#16A34A' },
    { name: 'Tổng Chi', value: totalExpense, color: '#DC2626' },
  ].filter((s) => s.value > 0);

  return {
    inMonth,
    totalIncome,
    totalExpense,
    netBalance,
    savingsRate,
    expenseSlices,
    incomeSlices,
    ratioSlices,
  };
}

/**
 * Multi-month trend computation grounded strictly in real cashflow history
 * + backward-reconstructed estimated NAV anchored at today's actual NAV.
 */
export function computeMultiMonthTrends(
  cashflows: CashflowEntry[],
  currentNavVnd: number,
  endMonth: string,
  monthCount: number
): MonthlyTrendPoint[] {
  const months = getRecentMonths(endMonth, monthCount);
  const byMonth: Record<string, { income: number; expense: number }> = {};
  months.forEach((m) => {
    byMonth[m] = { income: 0, expense: 0 };
  });

  cashflows.forEach((c) => {
    const ym = String(c.date || '').slice(0, 7);
    if (!byMonth[ym]) return;
    if (c.type === 'INCOME') byMonth[ym].income += Number(c.amount) || 0;
    else byMonth[ym].expense += Number(c.amount) || 0;
  });

  const rawPoints = months.map((m) => {
    const inc = byMonth[m].income;
    const exp = byMonth[m].expense;
    return {
      month: m,
      shortLabel: formatShortMonth(m),
      income: inc,
      expense: exp,
      netCashflow: inc - exp,
      estimatedNav: 0,
    };
  });

  // Walk backward from current actual NAV at the final month
  let runningNav = Math.max(0, currentNavVnd);
  for (let i = rawPoints.length - 1; i >= 0; i--) {
    rawPoints[i].estimatedNav = Math.max(0, runningNav);
    runningNav = Math.max(0, runningNav - rawPoints[i].netCashflow);
  }

  return rawPoints;
}

/**
 * Evaluate monthly expense budgets: specific YYYY-MM override wins over DEFAULT rule.
 */
export function evaluateMonthlyBudgets(
  budgets: BudgetRule[],
  cashflows: CashflowEntry[],
  selectedMonth: string
): BudgetEvaluation[] {
  const spentByCat: Record<string, number> = {};
  cashflows.forEach((c) => {
    if (c.type === 'EXPENSE' && String(c.date || '').startsWith(selectedMonth)) {
      spentByCat[c.category] = (spentByCat[c.category] || 0) + (Number(c.amount) || 0);
    }
  });

  const resolvedMap = new Map<string, { rule: BudgetRule; isMonthOverride: boolean }>();

  // First apply DEFAULT rules
  budgets
    .filter((b) => b.month === 'DEFAULT')
    .forEach((rule) => {
      resolvedMap.set(rule.category, { rule, isMonthOverride: false });
    });

  // Then apply month-specific overrides
  budgets
    .filter((b) => b.month === selectedMonth)
    .forEach((rule) => {
      resolvedMap.set(rule.category, { rule, isMonthOverride: true });
    });

  const evaluations: BudgetEvaluation[] = [];
  resolvedMap.forEach(({ rule, isMonthOverride }, category) => {
    const spent = spentByCat[category] || 0;
    const limitAmount = Number(rule.limitAmount) || 0;
    const ratioPct = limitAmount > 0 ? (spent / limitAmount) * 100 : 0;
    const remaining = limitAmount - spent;
    const status = ratioPct >= 100 ? 'EXCEEDED' : ratioPct >= 80 ? 'WARNING' : 'OK';

    evaluations.push({
      rule,
      category,
      limitAmount,
      spent,
      remaining,
      ratioPct,
      status,
      isMonthOverride,
    });
  });

  // Sort: EXCEEDED first, then WARNING, then highest utilization %
  const rank = { EXCEEDED: 0, WARNING: 1, OK: 2 };
  return evaluations.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return b.ratioPct - a.ratioPct;
  });
}

/**
 * Compute monthly spending velocity & end-of-month expense forecast
 * based on current pace in `selectedMonth`, comparing against active monthly budgets.
 */
export function computeSpendingForecast(
  monthlyCashflow: MonthlyCashflowSummary,
  budgetEvaluations: BudgetEvaluation[],
  selectedMonth: string
): SpendingForecast {
  const [yStr, mStr] = String(selectedMonth || getCurrentMonthISO()).split('-');
  const year = parseInt(yStr, 10) || new Date().getFullYear();
  const monthNum = parseInt(mStr, 10) || new Date().getMonth() + 1;
  const totalDays = new Date(year, monthNum, 0).getDate();

  const currentMonth = getCurrentMonthISO();
  const today = new Date();
  let mode: ForecastMonthMode = 'CURRENT';
  let elapsedDays = Math.max(1, Math.min(totalDays, today.getDate()));
  let remainingDays = Math.max(0, totalDays - elapsedDays);

  if (selectedMonth < currentMonth) {
    mode = 'PAST';
    elapsedDays = totalDays;
    remainingDays = 0;
  } else if (selectedMonth > currentMonth) {
    mode = 'FUTURE';
    elapsedDays = 0;
    remainingDays = totalDays;
  }

  const elapsedPct = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;
  const actualTotalSpent = Math.max(0, Number(monthlyCashflow.totalExpense) || 0);
  const totalIncome = Math.max(0, Number(monthlyCashflow.totalIncome) || 0);

  const dailyBurnRate = elapsedDays > 0 ? actualTotalSpent / elapsedDays : 0;
  const projectedTotalSpend =
    mode === 'CURRENT' ? Math.round(dailyBurnRate * totalDays) : actualTotalSpent;

  const totalBudgetLimit = budgetEvaluations.reduce(
    (sum, b) => sum + Math.max(0, Number(b.limitAmount) || 0),
    0
  );
  const budgetedActualSpent = budgetEvaluations.reduce(
    (sum, b) => sum + Math.max(0, Number(b.spent) || 0),
    0
  );
  const projectedBudgetedSpend =
    mode === 'CURRENT' && elapsedDays > 0
      ? Math.round((budgetedActualSpent / elapsedDays) * totalDays)
      : budgetedActualSpent;

  const hasBudgets = totalBudgetLimit > 0;
  // Compare total projected spending against total configured monthly budget
  const overallBudgetOverrun = hasBudgets ? projectedTotalSpend - totalBudgetLimit : 0;
  const overallProjectedRatioPct = hasBudgets
    ? (projectedTotalSpend / totalBudgetLimit) * 100
    : 0;
  const overallActualRatioPct = hasBudgets ? (actualTotalSpent / totalBudgetLimit) * 100 : 0;
  const overallSafeDailyCap =
    hasBudgets && remainingDays > 0
      ? Math.max(0, Math.floor((totalBudgetLimit - actualTotalSpent) / remainingDays))
      : 0;

  const categoryForecasts: CategorySpendingForecast[] = budgetEvaluations
    .map((b) => {
      const limitAmount = Math.max(0, Number(b.limitAmount) || 0);
      const actualSpent = Math.max(0, Number(b.spent) || 0);
      const dailyRate = elapsedDays > 0 ? actualSpent / elapsedDays : 0;
      const projectedSpend =
        mode === 'CURRENT' ? Math.round(dailyRate * totalDays) : actualSpent;
      const projectedOverrun = projectedSpend - limitAmount;
      const projectedRatioPct = limitAmount > 0 ? (projectedSpend / limitAmount) * 100 : 0;
      const safeDailyCap =
        remainingDays > 0 ? Math.max(0, Math.floor((limitAmount - actualSpent) / remainingDays)) : 0;

      let status: CategoryForecastStatus = 'ON_TRACK';
      if (actualSpent > limitAmount) {
        status = 'EXCEEDED';
      } else if (projectedSpend > limitAmount) {
        status = 'PROJECTED_EXCEED';
      } else if (projectedRatioPct >= 85) {
        status = 'WATCH';
      }

      return {
        category: b.category,
        limitAmount,
        actualSpent,
        dailyRate,
        projectedSpend,
        projectedOverrun,
        projectedRatioPct,
        safeDailyCap,
        status,
      };
    })
    .sort((a, b) => {
      const order: Record<CategoryForecastStatus, number> = {
        EXCEEDED: 0,
        PROJECTED_EXCEED: 1,
        WATCH: 2,
        ON_TRACK: 3,
      };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.projectedRatioPct - a.projectedRatioPct;
    });

  const atRiskCategories = categoryForecasts.filter(
    (c) => c.status === 'EXCEEDED' || c.status === 'PROJECTED_EXCEED'
  );

  return {
    month: selectedMonth,
    mode,
    totalDays,
    elapsedDays,
    remainingDays,
    elapsedPct,
    actualTotalSpent,
    totalIncome,
    dailyBurnRate,
    projectedTotalSpend,
    totalBudgetLimit,
    budgetedActualSpent,
    projectedBudgetedSpend,
    overallBudgetOverrun,
    overallProjectedRatioPct,
    overallActualRatioPct,
    overallSafeDailyCap,
    hasBudgets,
    willExceedTotalBudget: hasBudgets && projectedTotalSpend > totalBudgetLimit,
    alreadyExceededTotalBudget: hasBudgets && actualTotalSpent > totalBudgetLimit,
    willExceedIncome: totalIncome > 0 && projectedTotalSpend > totalIncome,
    categoryForecasts,
    atRiskCategories,
  };
}

// ============================================================================
// CSV EXPORT (RFC-4180 + UTF-8 BOM + 1NF Accounting Ledger Standard)
// ============================================================================

function escapeCsvCell(val: string | number): string {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '';
  }
  let s = String(val ?? '');
  // Guard against spreadsheet formula injection (=, +, -, @, tab, CR — even after leading whitespace)
  if (/^[\s]*[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsvFile(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatIsoDateTime(dateIso: string, createdAt?: number): string {
  const baseDate = String(dateIso || '').trim().slice(0, 10) || getTodayISO();
  const ts = Number(createdAt);
  if (Number.isFinite(ts) && ts > 0) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${baseDate} ${hh}:${mm}:${ss}`;
    }
  }
  return `${baseDate} 00:00:00`;
}

function combineSummaryAndNote(userNote: string | undefined, autoSummary: string): string {
  const n = String(userNote || '').trim();
  const s = String(autoSummary || '').trim();
  if (n && s && n !== s) return `${n} | ${s}`;
  return n || s;
}

function compareLedgerChronoAsc(
  a: { date?: string; createdAt?: number; id?: string },
  b: { date?: string; createdAt?: number; id?: string }
): number {
  const cmp = String(a.date || '').localeCompare(String(b.date || ''));
  if (cmp !== 0) return cmp;
  const tsDiff = (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
  if (tsDiff !== 0) return tsDiff;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

export function exportCashflowsToCsv(
  cashflows: CashflowEntry[],
  wallets: Wallet[],
  scopeSuffix: string
) {
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const sorted = [...cashflows].sort(compareLedgerChronoAsc);
  const headers = [
    'Mã GD',
    'Thời gian (ISO)',
    'Loại giao dịch',
    'Danh mục',
    'Ví nguồn',
    'Ví đích',
    'Số tiền (VNĐ)',
    'Tác động tài sản ròng (VNĐ)',
    'Tóm tắt & Ghi chú',
  ];
  const rows = sorted.map((c) => {
    const amt = Math.max(0, Number(c.amount) || 0);
    const isIncome = c.type === 'INCOME';
    const signedAmt = Math.round(isIncome ? amt : -amt);
    const walletName = c.walletId ? walletMap.get(c.walletId) || c.walletId : '';
    const autoSummary = isIncome
      ? `Thu ${c.category || 'Khác'} ${formatVND(amt)}${walletName ? ` vào ${walletName}` : ''}`
      : `Chi ${c.category || 'Khác'} ${formatVND(amt)}${walletName ? ` từ ${walletName}` : ''}`;
    return [
      c.id || '',
      formatIsoDateTime(c.date, c.createdAt),
      isIncome ? 'THU' : 'CHI',
      c.category || 'Khác',
      isIncome ? '' : walletName,
      isIncome ? walletName : '',
      signedAmt,
      signedAmt,
      combineSummaryAndNote(c.note, autoSummary),
    ];
  });
  downloadCsvFile(`FinFlow_ThuChi_${scopeSuffix}.csv`, headers, rows);
}

export function exportInvestmentsToCsv(
  investments: InvestmentTrade[],
  wallets: Wallet[] = [],
  usdtVndRate = 25450
) {
  const safeRate = Number(usdtVndRate) >= 1000 ? Number(usdtVndRate) : 25450;
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const primaryInvWalletName =
    wallets.find((w) => getWalletCashGroup(w) === 'INVESTMENT')?.name ||
    'Tiền chờ đầu tư (Sức mua)';

  const positions = computeAllPositionsFromTrades(investments, safeRate);
  const computedLots = positions.flatMap((pos) =>
    pos.lots.map((lot) => ({
      pos,
      lot,
    }))
  );
  computedLots.sort((a, b) => compareLedgerChronoAsc(a.lot, b.lot));

  const headers = [
    'Mã GD',
    'Thời gian (ISO)',
    'Loại giao dịch',
    'Nhóm tài sản',
    'Mã tài sản',
    'Sàn',
    'Ví nguồn',
    'Ví đích',
    'Khối lượng',
    'Đơn giá',
    'Phí & Thuế',
    'Giá vốn TB sau lệnh',
    'Tồn kho sau lệnh',
    'Giá trị dòng tiền (Nguyên tệ)',
    'Đơn vị',
    'Tỷ giá VNĐ',
    'Giá trị quy đổi (VNĐ)',
    'Lãi/Lỗ đã chốt (VNĐ)',
    'Tóm tắt & Ghi chú',
  ];

  const rows = computedLots.map(({ pos, lot }) => {
    const isCr = pos.assetType === 'CRYPTO';
    const rateMul = resolveTradeFxRate(lot, safeRate);
    const invWalletName = lot.walletId
      ? walletMap.get(lot.walletId) || lot.walletId
      : primaryInvWalletName;
    const nativeCashflow = Number(lot.netProceeds.toFixed(isCr ? 4 : 0));
    const vndCashflow = Math.round(lot.netProceeds * rateMul);
    const feeRounded = Number(lot.feeValue.toFixed(isCr ? 4 : 0));
    const avgAfter = Number(lot.avgCostAfter.toFixed(isCr ? 4 : 2));
    const qtyAfter = Number(lot.qtyAfter.toFixed(isCr ? 6 : 2));
    const realizedCell: number | string =
      lot.type === 'SELL' ? Math.round(lot.stepRealizedVnd) : '';

    return [
      lot.id || '',
      formatIsoDateTime(lot.date, lot.createdAt),
      lot.type === 'BUY' ? 'MUA' : 'BÁN',
      isCr ? 'Crypto' : 'Chứng khoán VN',
      pos.symbol,
      lot.exchange || pos.exchange || '',
      lot.type === 'BUY' ? invWalletName : '',
      lot.type === 'SELL' ? invWalletName : '',
      lot.quantity,
      lot.price,
      feeRounded,
      avgAfter,
      qtyAfter,
      nativeCashflow,
      isCr ? 'USDT' : 'VNĐ',
      rateMul,
      vndCashflow,
      realizedCell,
      combineSummaryAndNote(lot.note, lot.autoSummary),
    ];
  });

  downloadCsvFile(`FinFlow_SoCaiDauTu_${getTodayISO()}.csv`, headers, rows);
}

export function exportAllFinanceDataToCsv(
  cashflows: CashflowEntry[],
  investments: InvestmentTrade[],
  wallets: Wallet[],
  usdtVndRate = 25450,
  transfers: CapitalTransfer[] = []
) {
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const primaryInvWalletName =
    wallets.find((w) => getWalletCashGroup(w) === 'INVESTMENT')?.name ||
    'Tiền chờ đầu tư (Sức mua)';
  const safeRate = Number(usdtVndRate) >= 1000 ? Number(usdtVndRate) : 25450;

  interface UnifiedRow {
    sortDate: string;
    sortCreatedAt: number;
    sortId: string;
    cells: (string | number)[];
  }

  const unified: UnifiedRow[] = [];

  for (const c of cashflows) {
    const amt = Math.max(0, Number(c.amount) || 0);
    const isIncome = c.type === 'INCOME';
    const signedAmt = Math.round(isIncome ? amt : -amt);
    const walletName = c.walletId ? walletMap.get(c.walletId) || c.walletId : '';
    const autoSummary = isIncome
      ? `Thu ${c.category || 'Khác'} ${formatVND(amt)}${walletName ? ` vào ${walletName}` : ''}`
      : `Chi ${c.category || 'Khác'} ${formatVND(amt)}${walletName ? ` từ ${walletName}` : ''}`;

    unified.push({
      sortDate: String(c.date || ''),
      sortCreatedAt: Number(c.createdAt) || 0,
      sortId: String(c.id || ''),
      cells: [
        c.id || '',
        formatIsoDateTime(c.date, c.createdAt),
        'Thu chi',
        isIncome ? 'THU' : 'CHI',
        c.category || 'Khác',
        '',
        '',
        isIncome ? '' : walletName,
        isIncome ? walletName : '',
        '',
        '',
        0,
        signedAmt,
        'VNĐ',
        1,
        signedAmt,
        '',
        signedAmt,
        combineSummaryAndNote(c.note, autoSummary),
      ],
    });
  }

  // Compute investment trades through the moving-average ledger so Realized P&L & autoSummary match 100%
  const positions = computeAllPositionsFromTrades(investments, safeRate);
  for (const pos of positions) {
    const isCr = pos.assetType === 'CRYPTO';
    for (const lot of pos.lots) {
      const rateMul = resolveTradeFxRate(lot, safeRate);
      const invWalletName = lot.walletId
        ? walletMap.get(lot.walletId) || lot.walletId
        : primaryInvWalletName;
      const nativeVal = Number(lot.netProceeds.toFixed(isCr ? 4 : 0));
      const vndVal = Math.round(lot.netProceeds * rateMul);
      const feeRounded = Number(lot.feeValue.toFixed(isCr ? 4 : 0));
      const realizedCell: number | string =
        lot.type === 'SELL' ? Math.round(lot.stepRealizedVnd) : '';
      // BUY capitalizes purchase fee into avgCost; SELL records full net Realized P&L (avoids double-counting buy fees)
      const netWorthImpact = lot.type === 'SELL' ? Math.round(lot.stepRealizedVnd) : 0;

      unified.push({
        sortDate: String(lot.date || ''),
        sortCreatedAt: Number(lot.createdAt) || 0,
        sortId: String(lot.id || ''),
        cells: [
          lot.id || '',
          formatIsoDateTime(lot.date, lot.createdAt),
          'Đầu tư',
          lot.type === 'BUY' ? 'MUA' : 'BÁN',
          isCr ? 'Crypto' : 'Chứng khoán VN',
          pos.symbol,
          lot.exchange || pos.exchange || '',
          lot.type === 'BUY' ? invWalletName : '',
          lot.type === 'SELL' ? invWalletName : '',
          lot.quantity,
          lot.price,
          feeRounded,
          nativeVal,
          isCr ? 'USDT' : 'VNĐ',
          rateMul,
          vndVal,
          realizedCell,
          netWorthImpact,
          combineSummaryAndNote(lot.note, lot.autoSummary),
        ],
      });
    }
  }

  for (const tr of transfers) {
    const amt = Math.round(Math.max(0, Number(tr.amount) || 0));
    const isDeposit = tr.direction === 'DEPOSIT';
    const src = tr.sourceWalletId
      ? walletMap.get(tr.sourceWalletId) || tr.sourceWalletId
      : 'Nguồn ngoài';
    const dst = tr.targetWalletId
      ? walletMap.get(tr.targetWalletId) || tr.targetWalletId
      : 'Đích ngoài';
    const autoSummary = isDeposit
      ? `Nạp vốn đầu tư ${formatVND(amt)} (${src} → ${dst})`
      : `Rút vốn về sinh hoạt ${formatVND(amt)} (${src} → ${dst})`;

    unified.push({
      sortDate: String(tr.date || ''),
      sortCreatedAt: Number(tr.createdAt) || 0,
      sortId: String(tr.id || ''),
      cells: [
        tr.id || '',
        formatIsoDateTime(tr.date, tr.createdAt),
        'Chuyển vốn',
        isDeposit ? 'NẠP_VỐN' : 'RÚT_VỐN',
        'Điều chuyển nội bộ',
        '',
        '',
        src,
        dst,
        '',
        '',
        0,
        amt,
        'VNĐ',
        1,
        amt,
        '',
        0,
        combineSummaryAndNote(tr.note, autoSummary),
      ],
    });
  }

  // Chronological oldest -> newest so running inventory & balance formulas in Excel stay valid
  unified.sort((a, b) =>
    compareLedgerChronoAsc(
      { date: a.sortDate, createdAt: a.sortCreatedAt, id: a.sortId },
      { date: b.sortDate, createdAt: b.sortCreatedAt, id: b.sortId }
    )
  );

  const headers = [
    'Mã GD',
    'Thời gian (ISO)',
    'Phân nhóm',
    'Loại giao dịch',
    'Nhóm tài sản / Danh mục',
    'Mã tài sản',
    'Sàn',
    'Ví nguồn',
    'Ví đích',
    'Khối lượng',
    'Đơn giá',
    'Phí & Thuế',
    'Giá trị dòng tiền (Nguyên tệ)',
    'Đơn vị',
    'Tỷ giá VNĐ',
    'Giá trị quy đổi (VNĐ)',
    'Lãi/Lỗ đã chốt (VNĐ)',
    'Tác động tài sản ròng (VNĐ)',
    'Tóm tắt & Ghi chú',
  ];

  downloadCsvFile(
    `FinFlow_SoCaiGiaoDich_${getTodayISO()}.csv`,
    headers,
    unified.map((u) => u.cells)
  );
}

// ============================================================================
// CLEAN ZERO-STATE FOR NEW PERSONAL ACCOUNTS
// ============================================================================

export function buildEmptyState(): FinancialStatePayload {
  return {
    version: 3,
    usdtVndRate: 25450,
    isSampleData: false,
    gasSyncUrl: '',
    updatedAt: Date.now(),
    wallets: [],
    investments: [],
    cashflows: [],
    budgets: [],
    transfers: [],
  };
}

// ============================================================================
// RICH MULTI-MONTH SAMPLE DATA (SHOWCASING MARKET DIP + TRENDS + BUDGET ALERTS)
// ============================================================================

export function buildSampleState(): FinancialStatePayload {
  const curMonth = getCurrentMonthISO();
  const m1 = shiftMonthISO(curMonth, -1);
  const m2 = shiftMonthISO(curMonth, -2);
  const m3 = shiftMonthISO(curMonth, -3);
  const m4 = shiftMonthISO(curMonth, -4);
  const m5 = shiftMonthISO(curMonth, -5);
  const baseTs = Date.now() - 200000;

  return {
    version: 3,
    usdtVndRate: 25450,
    isSampleData: true,
    gasSyncUrl: '',
    updatedAt: Date.now(),
    wallets: [
      {
        id: 'sample_w_cash',
        name: 'Ví tiền mặt',
        type: 'CASH',
        cashGroup: 'LIVING',
        balance: 8500000,
        note: 'Chi tiêu hằng ngày',
        createdAt: baseTs + 1,
      },
      {
        id: 'sample_w_vcb',
        name: 'Vietcombank',
        type: 'BANK',
        cashGroup: 'LIVING',
        balance: 72000000,
        note: 'Tài khoản nhận lương & thanh toán',
        createdAt: baseTs + 2,
      },
      {
        id: 'sample_w_sav',
        name: 'Tiết kiệm kỳ hạn 6T',
        type: 'SAVINGS',
        cashGroup: 'LIVING',
        balance: 120000000,
        note: 'Quỹ dự phòng khẩn cấp',
        createdAt: baseTs + 3,
      },
      {
        id: 'sample_w_inv',
        name: 'Tiền chờ đầu tư (VPS)',
        type: 'INVESTMENT',
        cashGroup: 'INVESTMENT',
        balance: 26964014,
        note: 'Sức mua chứng khoán & tiền thu về sau khi chốt lời HPG',
        createdAt: baseTs + 4,
      },
    ],
    investments: [
      {
        id: 'sample_inv_hpg_buy',
        assetType: 'VN_STOCK',
        symbol: 'HPG',
        exchange: 'HSX',
        type: 'BUY',
        quantity: 1000,
        price: 24200,
        feeAmount: 36300,
        date: `${m1}-10`,
        note: 'Mua tích lũy HPG vùng hỗ trợ',
        walletId: 'sample_w_inv',
        walletDeltaVnd: -24236300,
        createdAt: baseTs + 8,
      },
      {
        id: 'sample_inv_hpg_sell',
        assetType: 'VN_STOCK',
        symbol: 'HPG',
        exchange: 'HSX',
        type: 'SELL',
        quantity: 1000,
        price: 26800,
        feeAmount: 50000,
        date: `${curMonth}-01`,
        note: 'Chốt lời 100% HPG khi chạm mục tiêu ngắn hạn, giữ tiền mặt chờ cơ hội mới',
        walletId: 'sample_w_inv',
        walletDeltaVnd: 26750000,
        createdAt: baseTs + 9,
      },
      {
        id: 'sample_inv_gex',
        assetType: 'VN_STOCK',
        symbol: 'GEX',
        exchange: 'HSX',
        type: 'BUY',
        quantity: 2000,
        price: 31400,
        feeAmount: 0,
        date: `${curMonth}-02`,
        note: 'Mua GEX giá gốc 31.400 đ',
        walletId: 'sample_w_inv',
        walletDeltaVnd: -62800000,
        createdAt: baseTs + 10,
      },
      {
        id: 'sample_inv_fpt1',
        assetType: 'VN_STOCK',
        symbol: 'FPT',
        exchange: 'HSX',
        type: 'BUY',
        quantity: 300,
        price: 58000,
        feeAmount: 0,
        date: `${curMonth}-04`,
        note: 'Mua FPT lô 1',
        walletId: 'sample_w_inv',
        walletDeltaVnd: -17400000,
        createdAt: baseTs + 11,
      },
      {
        id: 'sample_inv_fpt2',
        assetType: 'VN_STOCK',
        symbol: 'FPT',
        exchange: 'HSX',
        type: 'BUY',
        quantity: 300,
        price: 52200,
        feeAmount: 0,
        date: `${curMonth}-09`,
        note: 'Mua FPT lô 2 (Giá TB = 55.100 đ)',
        walletId: 'sample_w_inv',
        walletDeltaVnd: -15660000,
        createdAt: baseTs + 12,
      },
      {
        id: 'sample_inv_btc',
        assetType: 'CRYPTO',
        symbol: 'BTC',
        exchange: 'BINANCE',
        type: 'BUY',
        quantity: 0.05,
        price: 78341.6,
        feeAmount: 0,
        date: `${curMonth}-03`,
        note: 'Mua BTC trên App Binance (78.341,6$)',
        walletId: 'sample_w_inv',
        walletDeltaVnd: -99689686,
        fxRateAtExecution: 25450,
        createdAt: baseTs + 13,
      },
    ],
    cashflows: [
      // Current month
      {
        id: 'sample_cf_1',
        type: 'INCOME',
        amount: 32000000,
        category: 'Lương',
        date: `${curMonth}-01`,
        note: 'Lương tháng chính thức',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 20,
      },
      {
        id: 'sample_cf_2',
        type: 'INCOME',
        amount: 4500000,
        category: 'Phụ thu',
        date: `${curMonth}-08`,
        note: 'Dự án tư vấn ngoài giờ',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 21,
      },
      {
        id: 'sample_cf_3',
        type: 'INCOME',
        amount: 1850000,
        category: 'Cổ tức',
        date: `${curMonth}-14`,
        note: 'Cổ tức tiền mặt nhận về',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 22,
      },
      {
        id: 'sample_cf_4',
        type: 'EXPENSE',
        amount: 6500000,
        category: 'Nhà cửa',
        date: `${curMonth}-02`,
        note: 'Tiền thuê nhà & phí quản lý',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 23,
      },
      {
        id: 'sample_cf_5',
        type: 'EXPENSE',
        amount: 1450000,
        category: 'Hóa đơn',
        date: `${curMonth}-05`,
        note: 'Điện, nước & internet',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 24,
      },
      {
        id: 'sample_cf_6',
        type: 'EXPENSE',
        amount: 4600000,
        category: 'Ăn uống',
        date: `${curMonth}-09`,
        note: 'Đi chợ, siêu thị & ăn trưa',
        walletId: 'sample_w_cash',
        createdAt: baseTs + 25,
      },
      {
        id: 'sample_cf_7',
        type: 'EXPENSE',
        amount: 1650000,
        category: 'Di chuyển',
        date: `${curMonth}-11`,
        note: 'Xăng xe, gửi xe & đi lại',
        walletId: 'sample_w_cash',
        createdAt: baseTs + 26,
      },
      {
        id: 'sample_cf_8',
        type: 'EXPENSE',
        amount: 2400000,
        category: 'Gia đình',
        date: `${curMonth}-15`,
        note: 'Biếu gia đình cuối tuần',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 27,
      },
      {
        id: 'sample_cf_9',
        type: 'EXPENSE',
        amount: 2350000,
        category: 'Mua sắm',
        date: `${curMonth}-16`,
        note: 'Đồ gia dụng & cá nhân',
        walletId: 'sample_w_cash',
        createdAt: baseTs + 28,
      },
      // Previous 5 months for authentic multi-month trend chart
      {
        id: 'sample_cf_m1_inc',
        type: 'INCOME',
        amount: 35200000,
        category: 'Lương',
        date: `${m1}-01`,
        note: 'Lương & thưởng hiệu suất',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 30,
      },
      {
        id: 'sample_cf_m1_exp1',
        type: 'EXPENSE',
        amount: 17400000,
        category: 'Nhà cửa',
        date: `${m1}-05`,
        note: 'Sinh hoạt cố định tháng trước',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 31,
      },
      {
        id: 'sample_cf_m1_exp2',
        type: 'EXPENSE',
        amount: 4200000,
        category: 'Ăn uống',
        date: `${m1}-18`,
        note: 'Ăn uống tháng trước',
        walletId: 'sample_w_cash',
        createdAt: baseTs + 32,
      },
      {
        id: 'sample_cf_m2_inc',
        type: 'INCOME',
        amount: 32800000,
        category: 'Lương',
        date: `${m2}-01`,
        note: 'Thu nhập chính',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 33,
      },
      {
        id: 'sample_cf_m2_exp',
        type: 'EXPENSE',
        amount: 19600000,
        category: 'Ăn uống',
        date: `${m2}-12`,
        note: 'Tổng chi sinh hoạt tháng',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 34,
      },
      {
        id: 'sample_cf_m3_inc',
        type: 'INCOME',
        amount: 39500000,
        category: 'Thưởng',
        date: `${m3}-02`,
        note: 'Lương + thưởng quý',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 35,
      },
      {
        id: 'sample_cf_m3_exp',
        type: 'EXPENSE',
        amount: 21800000,
        category: 'Gia đình',
        date: `${m3}-15`,
        note: 'Chi tiêu & du lịch gia đình',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 36,
      },
      {
        id: 'sample_cf_m4_inc',
        type: 'INCOME',
        amount: 31500000,
        category: 'Lương',
        date: `${m4}-01`,
        note: 'Lương tháng',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 37,
      },
      {
        id: 'sample_cf_m4_exp',
        type: 'EXPENSE',
        amount: 16900000,
        category: 'Nhà cửa',
        date: `${m4}-10`,
        note: 'Chi tiêu cố định',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 38,
      },
      {
        id: 'sample_cf_m5_inc',
        type: 'INCOME',
        amount: 33000000,
        category: 'Lương',
        date: `${m5}-01`,
        note: 'Lương tháng',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 39,
      },
      {
        id: 'sample_cf_m5_exp',
        type: 'EXPENSE',
        amount: 18100000,
        category: 'Ăn uống',
        date: `${m5}-14`,
        note: 'Chi tiêu sinh hoạt',
        walletId: 'sample_w_vcb',
        createdAt: baseTs + 40,
      },
    ],
    budgets: [
      {
        id: 'sample_b_food',
        category: 'Ăn uống',
        month: 'DEFAULT',
        limitAmount: 5200000, // 4.6tr / 5.2tr = 88.5% -> Cảnh báo 80%
        createdAt: baseTs + 50,
      },
      {
        id: 'sample_b_shop',
        category: 'Mua sắm',
        month: 'DEFAULT',
        limitAmount: 2000000, // 2.35tr / 2.0tr = 117.5% -> Vượt mức!
        createdAt: baseTs + 51,
      },
      {
        id: 'sample_b_home',
        category: 'Nhà cửa',
        month: 'DEFAULT',
        limitAmount: 7500000, // 6.5tr / 7.5tr = 86.7% -> Cảnh báo
        createdAt: baseTs + 52,
      },
      {
        id: 'sample_b_move',
        category: 'Di chuyển',
        month: 'DEFAULT',
        limitAmount: 2500000, // 1.65tr / 2.5tr = 66% -> An toàn
        createdAt: baseTs + 53,
      },
    ],
    transfers: [
      {
        id: 'sample_tr_1',
        direction: 'DEPOSIT',
        amount: 85000000,
        sourceWalletId: 'sample_w_vcb',
        targetWalletId: 'sample_w_inv',
        date: `${m5}-06`,
        note: 'Nạp vốn đợt đầu vào ví Tiền chờ đầu tư',
        createdAt: baseTs + 1,
      },
      {
        id: 'sample_tr_2',
        direction: 'DEPOSIT',
        amount: 45000000,
        sourceWalletId: 'sample_w_vcb',
        targetWalletId: 'sample_w_inv',
        date: `${m4}-07`,
        note: 'Nạp vốn định kỳ DCA hàng tháng',
        createdAt: baseTs + 2,
      },
      {
        id: 'sample_tr_3',
        direction: 'DEPOSIT',
        amount: 55000000,
        sourceWalletId: 'sample_w_vcb',
        targetWalletId: 'sample_w_inv',
        date: `${m3}-05`,
        note: 'Bổ sung vốn đầu tư từ khoản thưởng quý',
        createdAt: baseTs + 3,
      },
      {
        id: 'sample_tr_4',
        direction: 'WITHDRAW',
        amount: 15000000,
        sourceWalletId: 'sample_w_inv',
        targetWalletId: 'sample_w_vcb',
        date: `${m3}-22`,
        note: 'Rút nhẹ tiền chờ về chi tiêu gia đình',
        createdAt: baseTs + 4,
      },
      {
        id: 'sample_tr_5',
        direction: 'WITHDRAW',
        amount: 25000000,
        sourceWalletId: 'sample_w_inv',
        targetWalletId: 'sample_w_vcb',
        date: `${m2}-19`,
        note: 'Rút phần lợi nhuận chốt lời về ngân hàng sinh hoạt',
        createdAt: baseTs + 5,
      },
      {
        id: 'sample_tr_6',
        direction: 'DEPOSIT',
        amount: 50000000,
        sourceWalletId: 'sample_w_vcb',
        targetWalletId: 'sample_w_inv',
        date: `${m1}-08`,
        note: 'Nạp tăng sức mua cổ phiếu VN & Crypto',
        createdAt: baseTs + 6,
      },
      {
        id: 'sample_tr_7',
        direction: 'DEPOSIT',
        amount: 35000000,
        sourceWalletId: 'sample_w_vcb',
        targetWalletId: 'sample_w_inv',
        date: `${curMonth}-06`,
        note: 'Nạp vốn định kỳ đầu tháng',
        createdAt: baseTs + 7,
      },
      {
        id: 'sample_tr_8',
        direction: 'WITHDRAW',
        amount: 10000000,
        sourceWalletId: 'sample_w_inv',
        targetWalletId: 'sample_w_vcb',
        date: `${curMonth}-14`,
        note: 'Rút tạm một phần sức mua về ngân hàng sinh hoạt',
        createdAt: baseTs + 8,
      },
    ],
  };
}
