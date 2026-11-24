export type WalletType = 'CASH' | 'BANK' | 'SAVINGS' | 'INVESTMENT';
export type WalletCashGroup = 'LIVING' | 'INVESTMENT';
export type AssetType = 'VN_STOCK' | 'CRYPTO';
export type TradeSide = 'BUY' | 'SELL';
export type BuyFundingMode = 'INVESTMENT_WALLET' | 'LIVING_WALLET' | 'EXISTING_HOLDING';
export type CashflowType = 'INCOME' | 'EXPENSE';
export type CapitalTransferDirection = 'DEPOSIT' | 'WITHDRAW';
export type AuthProviderType = 'google' | 'password' | 'guest';
export type SyncMode = 'CLOUD_SYNCED' | 'SERVER_SYNCED' | 'SYNCING' | 'LOCAL_ONLY' | 'VERIFY_EMAIL';
export type MainTabId = 'DASHBOARD' | 'ASSETS' | 'CASHFLOW' | 'SETTINGS';
export type AssetSubTabId = 'ALL' | 'WALLETS' | 'VN_STOCK' | 'CRYPTO' | 'HISTORY';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  authProvider: AuthProviderType;
  isGuest: boolean;
  emailVerified: boolean;
}

export interface SavedQuickAccount {
  uid: string;
  email: string;
  displayName: string;
  authProvider: 'password' | 'google';
  savedAt: number;
  lastUsedAt: number;
}

export interface DeviceGuestProfile {
  uid: string;
  displayName: string;
  createdAt: number;
  lastUsedAt: number;
  walletCount: number;
  investmentCount: number;
  cashflowCount: number;
  budgetCount: number;
  hasData: boolean;
}

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  cashGroup?: WalletCashGroup;
  balance: number;
  note: string;
  createdAt: number;
}

export interface InvestmentTrade {
  id: string;
  assetType: AssetType;
  symbol: string;
  exchange: string;
  type: TradeSide;
  quantity: number;
  price: number;
  feeAmount: number;
  feePercent?: number;
  date: string; // YYYY-MM-DD
  note: string;
  walletId?: string;
  walletDeltaVnd?: number;
  fxRateAtExecution?: number;
  createdAt: number;
}

export interface CashflowEntry {
  id: string;
  type: CashflowType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  note: string;
  walletId: string;
  createdAt: number;
}

export interface CapitalTransfer {
  id: string;
  direction: CapitalTransferDirection;
  amount: number;
  sourceWalletId: string;
  targetWalletId: string;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: number;
}

export interface BudgetRule {
  id: string;
  category: string;
  month: string; // 'DEFAULT' or 'YYYY-MM'
  limitAmount: number;
  createdAt: number;
}

export interface FinancialStatePayload {
  version: number;
  usdtVndRate: number;
  isSampleData: boolean;
  gasSyncUrl: string;
  updatedAt: number;
  wallets: Wallet[];
  investments: InvestmentTrade[];
  cashflows: CashflowEntry[];
  budgets: BudgetRule[];
  transfers?: CapitalTransfer[];
}

export interface MarketQuote {
  symbol: string;
  price: number;
  refPrice: number;
  source: string;
  updatedAt: string;
}

export interface ComputedLot extends InvestmentTrade {
  feeValue: number;
  qtyBefore: number;
  avgCostBefore: number;
  costBasisReleased: number;
  netProceeds: number;
  qtyAfter: number;
  avgCostAfter: number;
  stepRealized: number;
  stepRealizedVnd: number;
  autoSummary: string;
}

export interface EnrichedPosition {
  key: string;
  symbol: string;
  assetType: AssetType;
  exchange: string;
  currentQty: number;
  avgCost: number;
  realizedPnL: number;
  lots: ComputedLot[];
  isCrypto: boolean;
  currentPrice: number;
  refPrice: number;
  source: string;
  updatedAt: string;
  investedUsd: number;
  currentUsd: number;
  pnlUsd: number;
  investedVnd: number;
  currentVnd: number;
  pnlVnd: number;
  pnlPercent: number;
}

export type InvestmentAuditKind = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';

export interface InvestmentAuditEntry {
  id: string;
  kind: InvestmentAuditKind;
  date: string;
  createdAt: number;
  symbol?: string;
  assetType?: AssetType;
  exchange?: string;
  quantity?: number;
  price?: number;
  avgCostBefore?: number;
  feeValue?: number;
  costBasisReleasedVnd?: number;
  netCashflowVnd: number;
  realizedPnLVnd?: number;
  realizedPnLNative?: number;
  sourceWalletName?: string;
  targetWalletName?: string;
  autoSummary: string;
  note: string;
  sourceTrade?: InvestmentTrade;
  sourceTransfer?: CapitalTransfer;
}

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
  metaLine?: string;
  pnlValue?: number;
}

export interface AccountingSummary {
  vnStocks: EnrichedPosition[];
  cryptos: EnrichedPosition[];
  allPositions: EnrichedPosition[];
  closedPositions: EnrichedPosition[];
  cashHandVnd: number;
  bankVnd: number;
  savingsVnd: number;
  livingCashVnd: number;
  investmentCashVnd: number;
  totalCashVnd: number;
  cashShareInNavPct: number;
  vnCostVnd: number;
  vnMarketVnd: number;
  vnPnLVnd: number;
  vnPnLPct: number;
  vnRealizedPnLVnd: number;
  cryptoCostUsd: number;
  cryptoMarketUsd: number;
  cryptoPnLUsd: number;
  cryptoPnLPct: number;
  cryptoCostVnd: number;
  cryptoMarketVnd: number;
  cryptoPnLVnd: number;
  cryptoRealizedPnLUsd: number;
  cryptoRealizedPnLVnd: number;
  totalInvestedCostVnd: number;
  totalInvestedMarketVnd: number;
  totalUnrealizedPnLVnd: number;
  totalUnrealizedPnLPct: number;
  totalRealizedProfitVnd: number;
  totalRealizedLossVnd: number;
  totalRealizedPnLVnd: number;
  totalInvestmentPnLVnd: number;
  totalBuyOutflowVnd: number;
  totalSellInflowVnd: number;
  ledgerOpeningAdjustmentVnd: number;
  investmentWalletBalances: Record<string, number>;
  totalDepositedVnd: number;
  totalWithdrawnVnd: number;
  netDepositVnd: number;
  totalBookValueVnd: number;
  totalMarketNavVnd: number;
  auditLogs: InvestmentAuditEntry[];
  slicesByCost: DonutSlice[];
  slicesByMarket: DonutSlice[];
  slicesDetail: DonutSlice[];
}

export interface MonthlyCashflowSummary {
  inMonth: CashflowEntry[];
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  savingsRate: number;
  expenseSlices: DonutSlice[];
  incomeSlices: DonutSlice[];
  ratioSlices: DonutSlice[];
}

export interface MonthlyTrendPoint {
  month: string; // YYYY-MM
  shortLabel: string; // T11/26
  income: number;
  expense: number;
  netCashflow: number;
  estimatedNav: number;
}

export type BudgetStatus = 'OK' | 'WARNING' | 'EXCEEDED';

export interface BudgetEvaluation {
  rule: BudgetRule;
  category: string;
  limitAmount: number;
  spent: number;
  remaining: number;
  ratioPct: number;
  status: BudgetStatus;
  isMonthOverride: boolean;
}

export type ForecastMonthMode = 'CURRENT' | 'PAST' | 'FUTURE';
export type CategoryForecastStatus = 'EXCEEDED' | 'PROJECTED_EXCEED' | 'WATCH' | 'ON_TRACK';

export interface CategorySpendingForecast {
  category: string;
  limitAmount: number;
  actualSpent: number;
  dailyRate: number;
  projectedSpend: number;
  projectedOverrun: number;
  projectedRatioPct: number;
  safeDailyCap: number;
  status: CategoryForecastStatus;
}

export interface SpendingForecast {
  month: string;
  mode: ForecastMonthMode;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  elapsedPct: number;
  actualTotalSpent: number;
  totalIncome: number;
  dailyBurnRate: number;
  projectedTotalSpend: number;
  totalBudgetLimit: number;
  budgetedActualSpent: number;
  projectedBudgetedSpend: number;
  overallBudgetOverrun: number;
  overallProjectedRatioPct: number;
  overallActualRatioPct: number;
  overallSafeDailyCap: number;
  hasBudgets: boolean;
  willExceedTotalBudget: boolean;
  alreadyExceededTotalBudget: boolean;
  willExceedIncome: boolean;
  categoryForecasts: CategorySpendingForecast[];
  atRiskCategories: CategorySpendingForecast[];
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error';
  exiting: boolean;
}

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  onConfirm: () => void;
}

// Validation bounds synchronized verbatim with firebase-blueprint.json
export const SCHEMA_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  EMAIL_MAX: 160,
  GAS_URL_MAX: 500,
  WALLET_NAME_MAX: 80,
  NOTE_MAX: 240,
  SYMBOL_MAX: 16,
  EXCHANGE_MAX: 24,
  CATEGORY_MAX: 48,
  USDT_RATE_MIN: 1000,
  USDT_RATE_MAX: 1000000,
} as const;

export const EXPENSE_CATEGORIES = [
  { id: 'Ăn uống', color: '#C26A2E' },
  { id: 'Nhà cửa', color: '#0E5A4F' },
  { id: 'Hóa đơn', color: '#2D5B78' },
  { id: 'Di chuyển', color: '#3F7D8C' },
  { id: 'Mua sắm', color: '#BE123C' },
  { id: 'Gia đình', color: '#A3485A' },
  { id: 'Sức khỏe', color: '#137A4B' },
  { id: 'Học tập', color: '#7D6846' },
  { id: 'Khác', color: '#6E6D66' },
] as const;

export const INCOME_CATEGORIES = [
  { id: 'Lương', color: '#0E5A4F' },
  { id: 'Thưởng', color: '#137A4B' },
  { id: 'Cổ tức', color: '#2D5B78' },
  { id: 'Phụ thu', color: '#B47B2B' },
  { id: 'Khác', color: '#6E6D66' },
] as const;

export const WALLET_TYPES: { id: WalletType; label: string; color: string }[] = [
  { id: 'CASH', label: 'Tiền mặt', color: '#B47B2B' },
  { id: 'BANK', label: 'Ngân hàng thanh toán', color: '#2D5B78' },
  { id: 'SAVINGS', label: 'Tiết kiệm', color: '#137A4B' },
  { id: 'INVESTMENT', label: 'Tiền chờ đầu tư (Sức mua)', color: '#1F6F5F' },
];

export const WALLET_CASH_GROUPS: {
  id: WalletCashGroup;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}[] = [
  {
    id: 'LIVING',
    label: 'Tiền mặt sinh hoạt',
    shortLabel: 'Sinh hoạt',
    description: 'Dùng cho Thu – Chi hằng ngày, thanh toán và quỹ dự phòng sinh hoạt.',
    color: '#B47B2B',
  },
  {
    id: 'INVESTMENT',
    label: 'Tiền chờ đầu tư',
    shortLabel: 'Chờ đầu tư',
    description: 'Sức mua trên sàn; tự động trừ khi Mua và nhận tiền về khi Bán đầu tư.',
    color: '#1F6F5F',
  },
];

export function getWalletCashGroup(
  wallet: Pick<Wallet, 'type' | 'cashGroup'>
): WalletCashGroup {
  if (wallet.cashGroup === 'LIVING' || wallet.cashGroup === 'INVESTMENT') {
    return wallet.cashGroup;
  }
  return wallet.type === 'INVESTMENT' ? 'INVESTMENT' : 'LIVING';
}

export const ASSET_GROUP_COLORS = {
  'Tiền mặt hiện có': '#B47B2B',
  'Tiền mặt sinh hoạt': '#B47B2B',
  'Tiền chờ đầu tư': '#1F6F5F',
  'Chứng khoán VN': '#0E5A4F',
  Crypto: '#2D5B78',
} as const;

export const DETAIL_PALETTE = [
  '#0E5A4F',
  '#B47B2B',
  '#2D5B78',
  '#137A4B',
  '#C26A2E',
  '#A3485A',
  '#3F7D8C',
  '#7D6846',
  '#BE123C',
  '#6E6D66',
];

export const DEFAULT_VN_PRICES: Record<string, { price: number; refPrice: number; exchange: string }> = {
  FPT: { price: 50100, refPrice: 50100, exchange: 'HSX' },
  GEX: { price: 21500, refPrice: 21950, exchange: 'HSX' },
  VND: { price: 14500, refPrice: 14500, exchange: 'HSX' },
  HPG: { price: 26800, refPrice: 26500, exchange: 'HSX' },
  VCB: { price: 92500, refPrice: 92000, exchange: 'HSX' },
  MWG: { price: 61200, refPrice: 60500, exchange: 'HSX' },
  TCB: { price: 24500, refPrice: 24300, exchange: 'HSX' },
  SSI: { price: 25400, refPrice: 25600, exchange: 'HSX' },
};

export const DEFAULT_CRYPTO_PRICES: Record<string, { price: number; refPrice: number }> = {
  BTC: { price: 63433.54, refPrice: 64200.0 },
  ETH: { price: 2640.0, refPrice: 2685.0 },
  SOL: { price: 174.5, refPrice: 171.2 },
  BNB: { price: 585.0, refPrice: 580.0 },
};

export const TEMPO_OPTIONS = [
  { id: '0.7', value: 0.7, label: '0.7x Nhanh' },
  { id: '0.85', value: 0.85, label: '0.85x Gọn' },
  { id: '1', value: 1, label: '1.0x Chuẩn' },
  { id: '1.15', value: 1.15, label: '1.15x Êm' },
  { id: '1.3', value: 1.3, label: '1.3x Chậm' },
];
