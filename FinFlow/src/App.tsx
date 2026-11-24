import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Cloud,
  HardDrive,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Moon,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  Server,
  Settings,
  Sparkles,
  Sun,
  Wallet as WalletIcon,
} from 'lucide-react';
import {
  DEFAULT_CRYPTO_PRICES,
  DEFAULT_VN_PRICES,
  getWalletCashGroup,
  type AssetSubTabId,
  type AssetType,
  type BudgetRule,
  type BuyFundingMode,
  type CapitalTransfer,
  type CashflowEntry,
  type CashflowType,
  type ConfirmDialogConfig,
  type EnrichedPosition,
  type FinancialStatePayload,
  type InvestmentTrade,
  type MainTabId,
  type MarketQuote,
  type SyncMode,
  type ToastItem,
  type TradeSide,
  type UserAccount,
  type Wallet,
} from './types/finance';
import {
  auth,
  changeFirebasePassword,
  resendVerificationEmail,
  signOutFirebase,
  testFirestoreConnection,
  updateFirebaseDisplayName,
} from './lib/firebase';
import {
  clearInMemoryServerToken,
  serverChangePassword,
  serverFetchFinancialState,
  serverGetQuickAccounts,
  serverGetSession,
  serverLogout,
  serverRemoveQuickAccount,
  serverSaveFinancialState,
  ServerStateConflictError,
  serverUpdateDisplayName,
} from './lib/serverAuth';
import {
  buildEmptyState,
  buildSampleState,
  computeAccountingSummary,
  computeHeldPositionAtDate,
  computeLedgerInvestmentWalletBalances,
  computeMonthlyCashflow,
  computeMultiMonthTrends,
  evaluateMonthlyBudgets,
  formatMonthLabel,
  formatSignedVND,
  formatUSD,
  formatVND,
  getCurrentMonthISO,
  getTimeNowStr,
  getTodayISO,
  normalizeVnPriceToFullVND,
  parseSmartNumber,
  resolveTradeFxRate,
  validateTradeLedgerOrder,
} from './lib/accounting';
import {
  fetchCryptoQuotesRest,
  fetchVnStockQuoteWithCache,
  fetchWithTimeout,
} from './lib/market';
import {
  deleteBudgetInFirestore,
  deleteCapitalTransferInFirestore,
  deleteCashflowInFirestore,
  deleteInvestmentInFirestore,
  deleteLocalFinancialState,
  deleteWalletInFirestore,
  ensureUserProfileAndSeedIfNew,
  MAX_QUICK_LOGIN_ACCOUNTS,
  readDeviceGuestProfile,
  readGoogleQuickAccounts,
  readGuestSession,
  readLocalFinancialState,
  readMotionPrefs,
  readThemePreference,
  removeGoogleQuickAccount,
  replaceAllUserSubcollections,
  subscribeUserFinance,
  syncDeviceGuestSummary,
  updateUserDisplayNameInFirestore,
  updateUserPrefsInFirestore,
  updateWalletBalanceInFirestore,
  upsertBudgetInFirestore,
  upsertCapitalTransferInFirestore,
  upsertCashflowInFirestore,
  upsertGoogleQuickAccount,
  upsertInvestmentInFirestore,
  upsertWalletInFirestore,
  writeDeviceGuestProfile,
  writeGuestSession,
  writeLocalFinancialState,
  writeMotionPrefs,
  writeThemePreference,
} from './lib/storage';
import { StatusButton, ToastStack } from './components/AnimateUI';
import {
  AUTO_CREATE_INV_WALLET_ID,
  BudgetModal,
  CapitalTransferModal,
  CashflowModal,
  ConfirmModal,
  InvestmentModal,
  WalletModal,
} from './components/Modals';

// Code-split heavy 3D landing/auth surface and main workspace tabs for faster first load
const AuthScreen = lazy(() =>
  import('./components/AuthScreen').then((m) => ({ default: m.AuthScreen }))
);
const HeroCanvas = lazy(() =>
  import('./components/HeroCanvas').then((m) => ({ default: m.HeroCanvas }))
);
const DashboardTab = lazy(() =>
  import('./components/DashboardTab').then((m) => ({ default: m.DashboardTab }))
);
const AssetsTab = lazy(() =>
  import('./components/AssetsTab').then((m) => ({ default: m.AssetsTab }))
);
const CashflowTab = lazy(() =>
  import('./components/CashflowTab').then((m) => ({ default: m.CashflowTab }))
);
const SettingsTab = lazy(() =>
  import('./components/SettingsTab').then((m) => ({ default: m.SettingsTab }))
);

function WorkspacePanelFallback() {
  return (
    <div className="bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] rounded-xl p-8 flex items-center justify-center min-h-[260px]">
      <div className="flex items-center gap-2.5 text-xs font-medium text-[#63625C] dark:text-[#8E98A8]">
        <RefreshCw className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A] animate-spin" />
        <span>Đang tải phân khu...</span>
      </div>
    </div>
  );
}

const NAV_ITEMS: { id: MainTabId; label: string; title: string; icon: typeof LayoutDashboard }[] = [
  { id: 'DASHBOARD', label: 'Tổng quan', title: 'Tổng quan tài sản', icon: LayoutDashboard },
  { id: 'ASSETS', label: 'Tài sản', title: 'Danh mục & Tiền mặt', icon: WalletIcon },
  { id: 'CASHFLOW', label: 'Thu – Chi', title: 'Sổ Thu – Chi & Ngân sách', icon: Receipt },
  { id: 'SETTINGS', label: 'Cài đặt', title: 'Tài khoản & Đồng bộ', icon: Settings },
];

export default function App() {
  // --- Auth & Account State ---
  const [authReady, setAuthReady] = useState(false);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const accountRef = useRef<UserAccount | null>(null);
  accountRef.current = account;
  const pendingServerStateRef = useRef<{ uid: string; state: FinancialStatePayload } | null>(null);
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const lastServerDigestRef = useRef<string>('');
  const lastServerUpdatedAtRef = useRef<number | null>(null);
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [serverConflict, setServerConflict] = useState<{
    serverUpdatedAt: number;
    serverState: FinancialStatePayload;
  } | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>('LOCAL_ONLY');
  const [cloudError, setCloudError] = useState<Error | null>(null);

  // --- Financial Data State ---
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [investments, setInvestments] = useState<InvestmentTrade[]>([]);
  const [cashflows, setCashflows] = useState<CashflowEntry[]>([]);
  const [budgets, setBudgets] = useState<BudgetRule[]>([]);
  const [transfers, setTransfers] = useState<CapitalTransfer[]>([]);
  const [usdtVndRate, setUsdtVndRate] = useState(25450);
  const [isSampleData, setIsSampleData] = useState(false);
  const [gasSyncUrl, setGasSyncUrl] = useState('');

  // --- Market Quotes & Binance WS ---
  const [marketQuotes, setMarketQuotes] = useState<Record<string, MarketQuote>>(() => {
    const init: Record<string, MarketQuote> = {};
    Object.entries(DEFAULT_VN_PRICES).forEach(([sym, d]) => {
      init[`VN_STOCK:${sym}`] = {
        symbol: sym,
        price: d.price,
        refPrice: d.refPrice,
        source: 'THAM CHIẾU',
        updatedAt: '--:--',
      };
    });
    Object.entries(DEFAULT_CRYPTO_PRICES).forEach(([sym, d]) => {
      init[`CRYPTO:${sym}`] = {
        symbol: sym,
        price: d.price,
        refPrice: d.refPrice,
        source: 'THAM CHIẾU',
        updatedAt: '--:--',
      };
    });
    return init;
  });
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [priceBtnStatus, setPriceBtnStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [binanceWsStatus, setBinanceWsStatus] = useState<'OFFLINE' | 'CONNECTED' | 'POLLING'>(
    'OFFLINE'
  );
  const wsBufferRef = useRef<Record<string, MarketQuote>>({});
  const marketQuotesRef = useRef(marketQuotes);
  marketQuotesRef.current = marketQuotes;

  // --- Navigation & View State ---
  const [activeTab, setActiveTab] = useState<MainTabId>('DASHBOARD');
  const [tabDirection, setTabDirection] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthISO());
  const [trendMonths, setTrendMonths] = useState<6 | 12>(6);
  const [assetSubTab, setAssetSubTab] = useState<AssetSubTabId>('ALL');
  const [assetWalletGroup, setAssetWalletGroup] = useState<'LIVING' | 'INVESTMENT'>('LIVING');

  // --- Animate UI Motion & Theme Preferences ---
  const initialMotion = useMemo(() => readMotionPrefs(), []);
  const [motionTempo, setMotionTempo] = useState(initialMotion.tempo);
  const [reducedMotion, setReducedMotion] = useState(initialMotion.reducedMotion);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => readThemePreference());
  const isDark = theme === 'dark';

  // --- Modals & Toasts ---
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmDialogConfig | null>(null);

  const [showCashflowModal, setShowCashflowModal] = useState(false);
  const [editingCf, setEditingCf] = useState<CashflowEntry | null>(null);
  const [presetCfType, setPresetCfType] = useState<CashflowType>('EXPENSE');

  const [showInvestModal, setShowInvestModal] = useState(false);
  const [editingInv, setEditingInv] = useState<InvestmentTrade | null>(null);
  const [presetInvAsset, setPresetInvAsset] = useState<AssetType>('VN_STOCK');
  const [presetInvSymbol, setPresetInvSymbol] = useState('');
  const [presetInvSide, setPresetInvSide] = useState<TradeSide>('BUY');

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRule | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);

  // Throw fatal Firestore errors to ErrorBoundary
  if (cloudError) {
    throw cloudError;
  }

  // Sync motion tokens & dark mode class to DOM
  useEffect(() => {
    document.documentElement.style.setProperty('--aui-tempo', String(motionTempo));
    document.documentElement.setAttribute(
      'data-reduced-motion',
      reducedMotion ? 'true' : 'false'
    );
    writeMotionPrefs(motionTempo, reducedMotion);
  }, [motionTempo, reducedMotion]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    writeThemePreference(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      const waitMs = reducedMotion ? 120 : Math.round(210 * motionTempo);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, waitMs);
    },
    [motionTempo, reducedMotion]
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, type, exiting: false }]);
      setTimeout(() => {
        dismissToast(id);
      }, 3400);
    },
    [dismissToast]
  );

  const switchMainTab = useCallback(
    (nextId: MainTabId) => {
      const order: MainTabId[] = ['DASHBOARD', 'ASSETS', 'CASHFLOW', 'SETTINGS'];
      const curIdx = order.indexOf(activeTab);
      const nextIdx = order.indexOf(nextId);
      if (nextIdx !== curIdx) {
        setTabDirection(nextIdx > curIdx ? 1 : -1);
        setActiveTab(nextId);
      }
    },
    [activeTab]
  );

  const openConfirmDialog = useCallback((config: ConfirmDialogConfig) => {
    setConfirmModal(config);
    setConfirmOpen(true);
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const isCloudEligible = Boolean(
    account && !account.isGuest && account.emailVerified
  );

  // Mirror state to localStorage whenever state changes
  const mirrorLocal = useCallback(
    (uid: string, payload: FinancialStatePayload) => {
      writeLocalFinancialState(uid, payload);
    },
    []
  );

  const buildCurrentStatePayload = useCallback(
    (overrides?: Partial<FinancialStatePayload>): FinancialStatePayload => ({
      version: 3,
      usdtVndRate: overrides?.usdtVndRate ?? usdtVndRate,
      isSampleData: overrides?.isSampleData ?? isSampleData,
      gasSyncUrl: overrides?.gasSyncUrl ?? gasSyncUrl,
      updatedAt: Date.now(),
      wallets: overrides?.wallets ?? wallets,
      investments: overrides?.investments ?? investments,
      cashflows: overrides?.cashflows ?? cashflows,
      budgets: overrides?.budgets ?? budgets,
      transfers: overrides?.transfers ?? transfers,
    }),
    [usdtVndRate, isSampleData, gasSyncUrl, wallets, investments, cashflows, budgets, transfers]
  );

  const applyLocalStatePayload = useCallback((payload: FinancialStatePayload) => {
    setWallets(payload.wallets || []);
    setInvestments(payload.investments || []);
    setCashflows(payload.cashflows || []);
    setBudgets(payload.budgets || []);
    setTransfers(payload.transfers || []);
    setUsdtVndRate(Number(payload.usdtVndRate) >= 1000 ? Number(payload.usdtVndRate) : 25450);
    setIsSampleData(Boolean(payload.isSampleData));
    setGasSyncUrl(String(payload.gasSyncUrl || ''));
  }, []);

  const recordGoogleQuickAccount = useCallback(
    async (user: UserAccount, notifyOnReplace: boolean) => {
      if (user.authProvider !== 'google' || user.isGuest || !user.uid || !user.email) return;
      const { replaced: googleReplaced } = upsertGoogleQuickAccount(user);
      let evictedLabel: string | null = googleReplaced
        ? googleReplaced.displayName || googleReplaced.email
        : null;

      try {
        const serverAccounts = await serverGetQuickAccounts();
        const combinedMap = new Map<
          string,
          { uid: string; displayName: string; email: string; authProvider: 'google' | 'password'; lastUsedAt: number }
        >();
        [...serverAccounts, ...readGoogleQuickAccounts()].forEach((acc) => {
          const prev = combinedMap.get(acc.uid);
          if (!prev || acc.lastUsedAt > prev.lastUsedAt) {
            combinedMap.set(acc.uid, acc);
          }
        });
        const combined = Array.from(combinedMap.values());
        if (combined.length > MAX_QUICK_LOGIN_ACCOUNTS) {
          const candidates = combined
            .filter((acc) => acc.uid !== user.uid)
            .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
          const overflowCount = combined.length - MAX_QUICK_LOGIN_ACCOUNTS;
          for (let i = 0; i < overflowCount && i < candidates.length; i++) {
            const victim = candidates[i];
            if (victim.authProvider === 'password') {
              await serverRemoveQuickAccount(victim.uid).catch(() => undefined);
            } else {
              removeGoogleQuickAccount(victim.uid);
            }
            if (!evictedLabel) {
              evictedLabel = victim.displayName || victim.email;
            }
          }
        }
      } catch {
        // Keep local Google hint even if server quick-accounts check fails
      }

      if (notifyOnReplace && evictedLabel) {
        showToast(
          `Đã đạt giới hạn ${MAX_QUICK_LOGIN_ACCOUNTS} tài khoản đăng nhập nhanh — tự động thay thế tài khoản cũ nhất (${evictedLabel}).`,
          'warning'
        );
      }
    },
    [showToast]
  );

  // ==========================================================================
  // 1. BOOT CONNECTION TEST & DUAL AUTH LISTENER (FIREBASE GOOGLE + SERVER PWD)
  // ==========================================================================

  useEffect(() => {
    testFirestoreConnection();

    let disposed = false;
    let bootCompleted = false;
    let fbResolved = false;
    let srvResolved = false;
    let fbInitialUser: UserAccount | null = null;
    let srvInitialUser: UserAccount | null = null;
    let srvInitialState: FinancialStatePayload | null = null;

    const finalizeBoot = () => {
      if (disposed || bootCompleted || !fbResolved || !srvResolved) return;
      bootCompleted = true;

      if (fbInitialUser) {
        writeGuestSession(null);
        clearInMemoryServerToken();
        setAccount(fbInitialUser);
        if (fbInitialUser.authProvider === 'google') {
          void recordGoogleQuickAccount(fbInitialUser, false);
        }
      } else if (srvInitialUser) {
        writeGuestSession(null);
        if (srvInitialState) {
          pendingServerStateRef.current = { uid: srvInitialUser.uid, state: srvInitialState };
        }
        setAccount(srvInitialUser);
      } else {
        setAccount(readGuestSession());
      }
      setAuthReady(true);
    };

    serverGetSession()
      .then((res) => {
        if (disposed) return;
        srvInitialUser = res.user;
        srvInitialState = res.state;
        srvResolved = true;
        finalizeBoot();
      })
      .catch(() => {
        if (disposed) return;
        srvResolved = true;
        finalizeBoot();
      });

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (disposed) return;

      const mappedFb: UserAccount | null = fbUser
        ? {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Người dùng',
            // Every Firebase-authenticated user (Google or Email/Password) syncs via Cloud Firestore.
            authProvider: 'google',
            isGuest: false,
            emailVerified: Boolean(fbUser.emailVerified),
          }
        : null;

      if (!bootCompleted) {
        fbInitialUser = mappedFb;
        fbResolved = true;
        finalizeBoot();
        return;
      }

      if (mappedFb) {
        writeGuestSession(null);
        void serverLogout();
        setHydratedUid(null);
        lastServerDigestRef.current = '';
        setAccount(mappedFb);
        if (mappedFb.authProvider === 'google') {
          void recordGoogleQuickAccount(mappedFb, true);
        }
      } else if (accountRef.current?.authProvider === 'google') {
        setAccount(readGuestSession());
      }
    });

    return () => {
      disposed = true;
      unsub();
    };
  }, [recordGoogleQuickAccount]);

  // ==========================================================================
  // 2. HYDRATE LOCAL MIRROR + SUBSCRIBE CLOUD FIRESTORE OR SERVER PERSISTENCE
  // ==========================================================================

  useEffect(() => {
    if (!account) {
      setHydratedUid(null);
      lastServerDigestRef.current = '';
      lastServerUpdatedAtRef.current = null;
      setServerConflict(null);
      return;
    }

    setServerConflict(null);
    const digestOf = (p: FinancialStatePayload) =>
      JSON.stringify({
        usdtVndRate: p.usdtVndRate,
        isSampleData: p.isSampleData,
        gasSyncUrl: p.gasSyncUrl,
        wallets: p.wallets,
        investments: p.investments,
        cashflows: p.cashflows,
        budgets: p.budgets,
        transfers: p.transfers || [],
      });

    // Step 1: Hydrate immediately from pending server payload or local mirror (0ms UI)
    const pendingMatch =
      pendingServerStateRef.current && pendingServerStateRef.current.uid === account.uid
        ? pendingServerStateRef.current.state
        : null;
    if (pendingMatch) {
      pendingServerStateRef.current = null;
    }

    const localData = pendingMatch || readLocalFinancialState(account.uid);
    const seedPayload = localData || buildEmptyState();
    applyLocalStatePayload(seedPayload);
    writeLocalFinancialState(account.uid, seedPayload);

    if (account.isGuest) {
      syncDeviceGuestSummary(account.uid, seedPayload, account.displayName);
      setHydratedUid(account.uid);
      setSyncMode('LOCAL_ONLY');
      return;
    }

    // Branch A: Server-backed Email & Password account
    if (account.authProvider === 'password') {
      let active = true;

      if (pendingMatch) {
        lastServerDigestRef.current = digestOf(pendingMatch);
        lastServerUpdatedAtRef.current = Number(pendingMatch.updatedAt) || null;
        setHydratedUid(account.uid);
        setSyncMode('SERVER_SYNCED');
        return () => {
          active = false;
        };
      }

      setHydratedUid(null);
      setSyncMode('SYNCING');
      serverFetchFinancialState()
        .then(async (remoteState) => {
          if (!active) return;
          if (remoteState) {
            applyLocalStatePayload(remoteState);
            writeLocalFinancialState(account.uid, remoteState);
            lastServerDigestRef.current = digestOf(remoteState);
            lastServerUpdatedAtRef.current = Number(remoteState.updatedAt) || null;
          } else {
            const seed = readLocalFinancialState(account.uid) || buildEmptyState();
            applyLocalStatePayload(seed);
            const saved = await serverSaveFinancialState(seed);
            lastServerDigestRef.current = digestOf(seed);
            lastServerUpdatedAtRef.current = saved.updatedAt;
          }
          if (!active) return;
          setHydratedUid(account.uid);
          setSyncMode('SERVER_SYNCED');
        })
        .catch(() => {
          if (!active) return;
          setHydratedUid(account.uid);
          setSyncMode('LOCAL_ONLY');
        });

      return () => {
        active = false;
      };
    }

    // Branch B: Firebase Google Sign-In + Cloud Firestore real-time sync
    setHydratedUid(account.uid);
    if (!account.emailVerified) {
      setSyncMode('VERIFY_EMAIL');
      return;
    }

    let active = true;
    let unsubFirestore: (() => void) | null = null;
    setSyncMode('SYNCING');

    const isTransientOfflineError = (err: unknown) => {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      return (
        msg.includes('client is offline') ||
        msg.includes('could not reach cloud firestore') ||
        msg.includes('unavailable') ||
        msg.includes('network')
      );
    };

    const startSync = async () => {
      try {
        await ensureUserProfileAndSeedIfNew(account);
        if (!active) return;

        unsubFirestore = subscribeUserFinance(account.uid, {
          onProfile: (profile) => {
            if (!active) return;
            setUsdtVndRate(profile.usdtVndRate);
            setIsSampleData(profile.isSampleData);
            setGasSyncUrl(profile.gasSyncUrl);
            setAccount((prev) =>
              prev && prev.uid === profile.uid
                ? { ...prev, displayName: profile.displayName }
                : prev
            );
            setSyncMode('CLOUD_SYNCED');
          },
          onWallets: (list) => {
            if (!active) return;
            setWallets(list);
            setSyncMode('CLOUD_SYNCED');
          },
          onInvestments: (list) => {
            if (!active) return;
            setInvestments(list);
          },
          onCashflows: (list) => {
            if (!active) return;
            setCashflows(list);
          },
          onBudgets: (list) => {
            if (!active) return;
            setBudgets(list);
          },
          onTransfers: (list) => {
            if (!active) return;
            setTransfers(list);
          },
          onError: (err) => {
            if (!active) return;
            if (isTransientOfflineError(err)) {
              setSyncMode('LOCAL_ONLY');
              return;
            }
            setCloudError(err);
          },
        });
      } catch (err) {
        if (!active) return;
        if (isTransientOfflineError(err)) {
          setSyncMode('LOCAL_ONLY');
          return;
        }
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    startSync();

    return () => {
      active = false;
      if (unsubFirestore) unsubFirestore();
    };
  }, [account?.uid, account?.authProvider, account?.isGuest, account?.emailVerified, applyLocalStatePayload]);

  // Keep local mirror updated & debounce-persist to FinFlow server for Email/Password accounts
  useEffect(() => {
    if (!account || hydratedUid !== account.uid) return;
    const snapshot = buildCurrentStatePayload();
    mirrorLocal(account.uid, snapshot);

    if (account.isGuest) {
      syncDeviceGuestSummary(account.uid, snapshot, account.displayName);
    }

    if (account.authProvider === 'password') {
      // Pause automatic saves while an unresolved 409 conflict banner is awaiting user decision
      if (serverConflict) return;

      const digest = JSON.stringify({
        usdtVndRate: snapshot.usdtVndRate,
        isSampleData: snapshot.isSampleData,
        gasSyncUrl: snapshot.gasSyncUrl,
        wallets: snapshot.wallets,
        investments: snapshot.investments,
        cashflows: snapshot.cashflows,
        budgets: snapshot.budgets,
        transfers: snapshot.transfers || [],
      });
      if (digest === lastServerDigestRef.current) return;

      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
      }
      serverSaveTimerRef.current = setTimeout(() => {
        serverSaveFinancialState(snapshot, {
          expectedUpdatedAt: lastServerUpdatedAtRef.current,
        })
          .then((res) => {
            lastServerDigestRef.current = digest;
            lastServerUpdatedAtRef.current = res.updatedAt;
            if (accountRef.current?.uid === account.uid) {
              setSyncMode('SERVER_SYNCED');
            }
          })
          .catch((err) => {
            if (accountRef.current?.uid !== account.uid) return;
            if (err instanceof ServerStateConflictError) {
              setServerConflict({
                serverUpdatedAt: err.serverUpdatedAt,
                serverState: err.serverState,
              });
              setSyncMode('LOCAL_ONLY');
              showToast(
                'Phát hiện bản lưu mới hơn trên máy chủ từ tab/thiết bị khác. Vui lòng chọn Tải bản mới nhất hoặc Ghi đè ở thanh cảnh báo phía trên.',
                'warning'
              );
              return;
            }
            setSyncMode('LOCAL_ONLY');
          });
      }, 300);
    }

    return () => {
      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
      }
    };
  }, [
    account,
    hydratedUid,
    wallets,
    investments,
    cashflows,
    budgets,
    transfers,
    usdtVndRate,
    isSampleData,
    gasSyncUrl,
    serverConflict,
    mirrorLocal,
    buildCurrentStatePayload,
    showToast,
  ]);

  const handleAcceptServerState = () => {
    if (!serverConflict || !account) return;
    const remote = serverConflict.serverState;
    const digest = JSON.stringify({
      usdtVndRate: remote.usdtVndRate,
      isSampleData: remote.isSampleData,
      gasSyncUrl: remote.gasSyncUrl,
      wallets: remote.wallets,
      investments: remote.investments,
      cashflows: remote.cashflows,
      budgets: remote.budgets,
      transfers: remote.transfers || [],
    });
    lastServerDigestRef.current = digest;
    lastServerUpdatedAtRef.current = serverConflict.serverUpdatedAt || remote.updatedAt;
    applyLocalStatePayload(remote);
    writeLocalFinancialState(account.uid, remote);
    setServerConflict(null);
    setSyncMode('SERVER_SYNCED');
    showToast('Đã tải và đồng bộ dữ liệu mới nhất từ máy chủ FinFlow.');
  };

  const handleForceOverwriteServerState = async () => {
    if (!serverConflict || !account) return;
    setIsResolvingConflict(true);
    try {
      const snapshot = buildCurrentStatePayload();
      const digest = JSON.stringify({
        usdtVndRate: snapshot.usdtVndRate,
        isSampleData: snapshot.isSampleData,
        gasSyncUrl: snapshot.gasSyncUrl,
        wallets: snapshot.wallets,
        investments: snapshot.investments,
        cashflows: snapshot.cashflows,
        budgets: snapshot.budgets,
        transfers: snapshot.transfers || [],
      });
      const saved = await serverSaveFinancialState(snapshot, { forceOverwrite: true });
      lastServerDigestRef.current = digest;
      lastServerUpdatedAtRef.current = saved.updatedAt;
      setServerConflict(null);
      setSyncMode('SERVER_SYNCED');
      showToast('Đã ghi đè dữ liệu hiện tại lên máy chủ FinFlow.');
    } catch {
      showToast('Không thể ghi đè lúc này. Vui lòng thử lại.', 'error');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // ==========================================================================
  // 3. MARKET PRICE ENGINE (DNSE/VNDIRECT TTL 60S + BINANCE WS THROTTLE 1S)
  // ==========================================================================

  const trackedSymbols = useMemo(() => {
    const vn = new Set<string>();
    const crypto = new Set<string>();
    investments.forEach((tx) => {
      const s = String(tx.symbol || '').toUpperCase().trim();
      if (!s) return;
      if (tx.assetType === 'CRYPTO') crypto.add(s);
      else vn.add(s);
    });
    return {
      vn: Array.from(vn).sort(),
      crypto: Array.from(crypto).sort(),
    };
  }, [investments]);

  const vnSig = trackedSymbols.vn.join(',');
  const cryptoSig = trackedSymbols.crypto.join(',');

  const syncMarketPrices = useCallback(
    async (forceRefresh = false, notify = false) => {
      if (trackedSymbols.vn.length === 0 && trackedSymbols.crypto.length === 0) return;
      setIsSyncingPrices(true);
      if (notify) setPriceBtnStatus('loading');

      const vnPromises = trackedSymbols.vn.map(async (sym) => {
        const key = `VN_STOCK:${sym}`;
        if (!forceRefresh && marketQuotesRef.current[key]?.source === 'THỦ CÔNG') return;
        const quote = await fetchVnStockQuoteWithCache(sym, forceRefresh);
        if (quote.price > 0) {
          setMarketQuotes((prev) => ({ ...prev, [key]: quote }));
        }
      });

      const cryptoPromise = (async () => {
        if (trackedSymbols.crypto.length === 0) return;
        const updates = await fetchCryptoQuotesRest(trackedSymbols.crypto);
        const filtered: Record<string, MarketQuote> = {};
        Object.entries(updates).forEach(([key, val]) => {
          if (forceRefresh || marketQuotesRef.current[key]?.source !== 'THỦ CÔNG') {
            filtered[key] = val;
          }
        });
        if (Object.keys(filtered).length > 0) {
          setMarketQuotes((prev) => ({ ...prev, ...filtered }));
        }
      })();

      await Promise.all([...vnPromises, cryptoPromise]);
      setIsSyncingPrices(false);
      if (notify) {
        setPriceBtnStatus('done');
        showToast('Đã cập nhật giá thị trường mới nhất.');
        setTimeout(() => setPriceBtnStatus('idle'), 1400);
      }
    },
    [trackedSymbols, showToast]
  );

  useEffect(() => {
    if (!account) return;
    syncMarketPrices(false, false);
  }, [account?.uid, vnSig, cryptoSig, syncMarketPrices]);

  useEffect(() => {
    const coins = cryptoSig ? cryptoSig.split(',') : [];
    if (!account || coins.length === 0) {
      setBinanceWsStatus('OFFLINE');
      return;
    }

    let ws: WebSocket | null = null;
    let disposed = false;

    const flushTimer = setInterval(() => {
      const pending = wsBufferRef.current;
      if (Object.keys(pending).length === 0) return;
      wsBufferRef.current = {};
      setMarketQuotes((prev) => ({ ...prev, ...pending }));
    }, 1000);

    try {
      const streams = coins.map((c) => `${c.toLowerCase()}usdt@ticker`).join('/');
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      ws.onopen = () => !disposed && setBinanceWsStatus('CONNECTED');
      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const msg = JSON.parse(String(event.data));
          const d = msg?.data;
          if (!d?.s?.endsWith('USDT')) return;
          const sym = String(d.s).replace('USDT', '');
          const key = `CRYPTO:${sym}`;
          if (marketQuotesRef.current[key]?.source === 'THỦ CÔNG') return;
          const lastP = parseFloat(d.c);
          const openP = parseFloat(d.o);
          if (lastP > 0) {
            wsBufferRef.current[key] = {
              symbol: sym,
              price: lastP,
              refPrice: openP > 0 ? openP : lastP,
              source: 'BINANCE WS',
              updatedAt: getTimeNowStr(),
            };
          }
        } catch {
          // Ignore malformed WS frame
        }
      };
      ws.onerror = () => !disposed && setBinanceWsStatus('POLLING');
      ws.onclose = () => !disposed && setBinanceWsStatus('POLLING');
    } catch {
      setBinanceWsStatus('POLLING');
    }

    return () => {
      disposed = true;
      clearInterval(flushTimer);
      wsBufferRef.current = {};
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore
        }
      }
    };
  }, [account?.uid, cryptoSig]);

  // ==========================================================================
  // 4. DERIVED ACCOUNTING, TRENDS & MONTHLY BUDGET EVALUATIONS
  // ==========================================================================

  const accounting = useMemo(
    () => computeAccountingSummary(wallets, investments, marketQuotes, usdtVndRate, transfers),
    [wallets, investments, marketQuotes, usdtVndRate, transfers]
  );

  const monthlyCashflow = useMemo(
    () => computeMonthlyCashflow(cashflows, selectedMonth),
    [cashflows, selectedMonth]
  );

  const trendPoints = useMemo(
    () =>
      computeMultiMonthTrends(
        cashflows,
        accounting.totalMarketNavVnd,
        selectedMonth,
        trendMonths
      ),
    [cashflows, accounting.totalMarketNavVnd, selectedMonth, trendMonths]
  );

  const budgetEvaluations = useMemo(
    () => evaluateMonthlyBudgets(budgets, cashflows, selectedMonth),
    [budgets, cashflows, selectedMonth]
  );

  // ==========================================================================
  // 5. CRUD MUTATION HANDLERS (OPTIMISTIC + CLOUD FIRESTORE SYNC)
  // ==========================================================================

  const handleServerAuthSuccess = (
    user: UserAccount,
    initialState: FinancialStatePayload | null
  ) => {
    writeGuestSession(null);
    if (initialState) {
      pendingServerStateRef.current = { uid: user.uid, state: initialState };
      writeLocalFinancialState(user.uid, initialState);
    }
    setAccount(user);
    setActiveTab('DASHBOARD');
  };

  const handleGuestMode = (mode: 'CONTINUE' | 'CREATE_NEW' = 'CONTINUE') => {
    const existingGuest = readDeviceGuestProfile();

    if (mode === 'CONTINUE' && existingGuest) {
      const resumedProfile = {
        ...existingGuest,
        lastUsedAt: Date.now(),
      };
      writeDeviceGuestProfile(resumedProfile);

      const guestSession: UserAccount = {
        uid: resumedProfile.uid,
        email: '',
        displayName: resumedProfile.displayName || 'Tài khoản khách',
        authProvider: 'guest',
        isGuest: true,
        emailVerified: false,
      };
      writeGuestSession(guestSession);
      setAccount(guestSession);
      setActiveTab('DASHBOARD');
      showToast('Đã mở lại dữ liệu Tài khoản khách đã lưu trên thiết bị này.');
      return;
    }

    if (existingGuest) {
      deleteLocalFinancialState(existingGuest.uid);
    }

    const newUid = `guest_dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const freshState = buildEmptyState();
    writeLocalFinancialState(newUid, freshState);
    const newProfile = syncDeviceGuestSummary(newUid, freshState, 'Tài khoản khách');

    const guestSession: UserAccount = {
      uid: newProfile.uid,
      email: '',
      displayName: newProfile.displayName,
      authProvider: 'guest',
      isGuest: true,
      emailVerified: false,
    };
    writeGuestSession(guestSession);
    setAccount(guestSession);
    setActiveTab('DASHBOARD');
    showToast(
      existingGuest
        ? 'Đã tạo Tài khoản khách mới trên thiết bị này.'
        : 'Đã mở Tài khoản khách và gắn lưu trên thiết bị này.'
    );
  };

  const handleLogout = async () => {
    if (serverSaveTimerRef.current) {
      clearTimeout(serverSaveTimerRef.current);
      serverSaveTimerRef.current = null;
    }

    if (account?.isGuest) {
      const snapshot = buildCurrentStatePayload();
      writeLocalFinancialState(account.uid, snapshot);
      syncDeviceGuestSummary(account.uid, snapshot, account.displayName);
    }

    setHydratedUid(null);
    lastServerDigestRef.current = '';
    pendingServerStateRef.current = null;

    if (account?.authProvider === 'google') {
      await signOutFirebase();
    } else if (account?.authProvider === 'password') {
      await serverLogout();
    }
    clearInMemoryServerToken();
    writeGuestSession(null);
    setAccount(null);
    setWallets([]);
    setInvestments([]);
    setCashflows([]);
    setBudgets([]);
    setTransfers([]);
    showToast('Đã đăng xuất an toàn.');
  };

  // --- 2-Group Cash Wallet Separation (Tiền mặt sinh hoạt vs Tiền chờ đầu tư) ---
  const livingWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'LIVING'),
    [wallets]
  );
  const investmentWallets = useMemo(
    () => wallets.filter((w) => getWalletCashGroup(w) === 'INVESTMENT'),
    [wallets]
  );

  const materializeLegacyOpeningDeposits = useCallback(
    (
      candidateWallets: Wallet[],
      currentInvestments: InvestmentTrade[],
      currentTransfers: CapitalTransfer[]
    ): CapitalTransfer[] => {
      if (currentTransfers.length > 0 || currentInvestments.length > 0) return [];
      const now = Date.now();
      return candidateWallets
        .filter((w) => getWalletCashGroup(w) === 'INVESTMENT' && (Number(w.balance) || 0) > 0)
        .map((w, idx) => ({
          id: `tr_init_${now}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
          direction: 'DEPOSIT' as const,
          amount: Math.round(Number(w.balance) || 0),
          sourceWalletId: '',
          targetWalletId: w.id,
          date: getTodayISO(),
          note: `Số dư khởi tạo ví "${w.name}"`,
          createdAt: now - 1000 - idx,
        }));
    },
    []
  );

  const syncLedgerInvestmentWallets = useCallback(
    (
      candidateWallets: Wallet[],
      candidateInvestments: InvestmentTrade[],
      candidateTransfers: CapitalTransfer[]
    ) => {
      const ledger = computeLedgerInvestmentWalletBalances(
        candidateWallets,
        candidateInvestments,
        candidateTransfers,
        usdtVndRate
      );
      const updatedInvWallets: { id: string; balance: number }[] = [];
      const syncedWallets = candidateWallets.map((w) => {
        if (getWalletCashGroup(w) !== 'INVESTMENT') return w;
        const ledgerBal = ledger.investmentWalletBalances[w.id] ?? 0;
        // Firestore rules enforce wallet.balance >= 0; live ledger engine preserves exact signed balance
        const persistedBal = Math.max(0, Math.round(ledgerBal));
        if (persistedBal !== Math.round(Number(w.balance) || 0)) {
          updatedInvWallets.push({ id: w.id, balance: persistedBal });
          return { ...w, balance: persistedBal };
        }
        return w;
      });
      return {
        syncedWallets,
        updatedInvWallets,
        investmentWalletBalances: ledger.investmentWalletBalances,
        investmentCashVnd: ledger.investmentCashVnd,
      };
    },
    [usdtVndRate]
  );

  // --- Wallets ---
  const handleSaveWallet = async (wallet: Wallet, isEdit: boolean) => {
    const cashGroup = getWalletCashGroup(wallet);
    let normalizedWallet: Wallet = {
      ...wallet,
      cashGroup,
    };

    if (isEdit && cashGroup === 'INVESTMENT') {
      const ledgerBal = accounting.investmentWalletBalances[normalizedWallet.id];
      normalizedWallet = {
        ...normalizedWallet,
        balance: Math.max(0, Math.round(ledgerBal ?? normalizedWallet.balance)),
      };
      setWallets((prev) =>
        prev.map((w) => (w.id === normalizedWallet.id ? normalizedWallet : w))
      );
      showToast(`Đã cập nhật thông tin ví "${normalizedWallet.name}".`);
      if (isCloudEligible && account) {
        try {
          await upsertWalletInFirestore(account.uid, normalizedWallet, true);
        } catch (err) {
          setCloudError(err instanceof Error ? err : new Error(String(err)));
        }
      }
      return;
    }

    const openingTransfersToPersist: CapitalTransfer[] = [];
    let nextTransfers = transfers;

    if (!isEdit && cashGroup === 'INVESTMENT' && normalizedWallet.balance > 0) {
      const legacyOpening = materializeLegacyOpeningDeposits(wallets, investments, transfers);
      const openingTransfer: CapitalTransfer = {
        id: `tr_init_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        direction: 'DEPOSIT',
        amount: Math.round(normalizedWallet.balance),
        sourceWalletId: '',
        targetWalletId: normalizedWallet.id,
        date: getTodayISO(),
        note: `Số dư khởi tạo ví "${normalizedWallet.name}"`,
        createdAt: Date.now(),
      };
      openingTransfersToPersist.push(...legacyOpening, openingTransfer);
      nextTransfers = [openingTransfer, ...legacyOpening, ...transfers];
      setTransfers(nextTransfers);
    }

    const nextWallets = isEdit
      ? wallets.map((w) => (w.id === normalizedWallet.id ? normalizedWallet : w))
      : [...wallets, normalizedWallet];

    setWallets(nextWallets);
    showToast(
      isEdit
        ? `Đã cập nhật "${normalizedWallet.name}".`
        : openingTransfersToPersist.length > 0
        ? `Đã thêm ví "${normalizedWallet.name}" và ghi nhận bút toán nạp vốn khởi tạo ${formatVND(
            normalizedWallet.balance
          )}.`
        : `Đã thêm ví "${normalizedWallet.name}" (${
            cashGroup === 'INVESTMENT' ? 'Tiền chờ đầu tư' : 'Tiền mặt sinh hoạt'
          }).`
    );

    if (isCloudEligible && account) {
      try {
        await upsertWalletInFirestore(account.uid, normalizedWallet, isEdit);
        for (const tr of openingTransfersToPersist) {
          await upsertCapitalTransferInFirestore(account.uid, tr, false);
        }
      } catch (err) {
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteWallet = (wallet: Wallet) => {
    const displayBal =
      getWalletCashGroup(wallet) === 'INVESTMENT'
        ? (accounting.investmentWalletBalances[wallet.id] ?? wallet.balance)
        : wallet.balance;
    openConfirmDialog({
      title: `Xóa "${wallet.name}"`,
      message: `Bạn có chắc muốn xóa tài khoản "${wallet.name}" (${formatVND(
        displayBal
      )}) khỏi số tiền mặt hiện có không?`,
      onConfirm: async () => {
        setWallets((prev) => prev.filter((w) => w.id !== wallet.id));
        closeConfirmDialog();
        showToast(`Đã xóa "${wallet.name}".`);
        if (isCloudEligible && account) {
          try {
            await deleteWalletInFirestore(account.uid, wallet.id);
          } catch (err) {
            setCloudError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
    });
  };

  // --- Investments (Strict Double-Entry Ledger against 'Tiền chờ đầu tư') ---
  const handleSaveInvestment = async (
    trade: InvestmentTrade,
    isEdit: boolean,
    walletSync?: {
      enabled: boolean;
      walletId: string;
      fundingMode?: BuyFundingMode;
      livingWalletId?: string;
    }
  ) => {
    const prevHeldAtDate = !isEdit
      ? computeHeldPositionAtDate(
          investments,
          trade.assetType,
          trade.symbol,
          trade.date,
          usdtVndRate
        )
      : null;

    const rateMul = resolveTradeFxRate(trade, usdtVndRate);
    const baseWallets = [...wallets];
    const legacyOpening = materializeLegacyOpeningDeposits(wallets, investments, transfers);
    let nextTransfers =
      legacyOpening.length > 0 ? [...legacyOpening, ...transfers] : [...transfers];

    let createdInvWallet: Wallet | null = null;
    let syncedWalletName = '';
    let finalWalletId = '';

    // Every investment trade settles on the double-entry investment ledger
    const requestedInvWallet =
      walletSync?.walletId && walletSync.walletId !== AUTO_CREATE_INV_WALLET_ID
        ? investmentWallets.find((w) => w.id === walletSync.walletId) || null
        : null;
    const fallbackInvWallet =
      !requestedInvWallet && walletSync?.walletId !== AUTO_CREATE_INV_WALLET_ID
        ? investmentWallets[0] || null
        : null;
    const targetWallet = requestedInvWallet || fallbackInvWallet;

    if (targetWallet) {
      finalWalletId = targetWallet.id;
      syncedWalletName = targetWallet.name;
    } else {
      const newWallet: Wallet = {
        id: `w_inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: 'Tiền chờ đầu tư (Sức mua)',
        type: 'INVESTMENT',
        cashGroup: 'INVESTMENT',
        balance: 0,
        note: 'Tự động tạo cho sổ cái kép đầu tư',
        createdAt: Date.now(),
      };
      createdInvWallet = newWallet;
      baseWallets.push(newWallet);
      finalWalletId = newWallet.id;
      syncedWalletName = newWallet.name;
    }

    const fee = Math.max(0, Number(trade.feeAmount) || 0);
    const effectiveSellQty =
      trade.type === 'SELL' && prevHeldAtDate && prevHeldAtDate.currentQty > 0
        ? Math.min(trade.quantity, prevHeldAtDate.currentQty)
        : trade.quantity;
    const nativeDelta =
      trade.type === 'BUY'
        ? -(trade.quantity * trade.price + fee)
        : Math.max(0, effectiveSellQty * trade.price - fee);
    const finalWalletDeltaVnd = Math.round(nativeDelta * rateMul);

    // Optional paired CapitalTransfer when buying directly from Living Bank Wallet or declaring Existing Holdings
    const fundingMode: BuyFundingMode =
      !isEdit && trade.type === 'BUY' ? walletSync?.fundingMode || 'INVESTMENT_WALLET' : 'INVESTMENT_WALLET';
    let autoFundingTransfer: CapitalTransfer | null = null;
    let livingWalletUpdate: { id: string; balance: number; name: string } | null = null;

    if (
      !isEdit &&
      trade.type === 'BUY' &&
      (fundingMode === 'LIVING_WALLET' || fundingMode === 'EXISTING_HOLDING')
    ) {
      const buyCostVnd = Math.abs(finalWalletDeltaVnd);
      if (buyCostVnd > 0) {
        let sourceLivingId = '';
        if (fundingMode === 'LIVING_WALLET' && walletSync?.livingWalletId) {
          const idx = baseWallets.findIndex((w) => w.id === walletSync.livingWalletId);
          if (idx >= 0 && getWalletCashGroup(baseWallets[idx]) === 'LIVING') {
            sourceLivingId = baseWallets[idx].id;
            const nextLivingBal = Math.max(
              0,
              Math.round((Number(baseWallets[idx].balance) || 0) - buyCostVnd)
            );
            baseWallets[idx] = { ...baseWallets[idx], balance: nextLivingBal };
            livingWalletUpdate = {
              id: baseWallets[idx].id,
              balance: nextLivingBal,
              name: baseWallets[idx].name,
            };
          }
        }

        autoFundingTransfer = {
          id: `tr_auto_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          direction: 'DEPOSIT',
          amount: buyCostVnd,
          sourceWalletId: sourceLivingId,
          targetWalletId: finalWalletId,
          date: trade.date,
          note:
            fundingMode === 'EXISTING_HOLDING'
              ? `Khai báo danh mục có sẵn (vốn đầu kỳ): ${trade.symbol}`
              : `Nạp tự động từ ${livingWalletUpdate?.name || 'ví sinh hoạt'} cho lệnh Mua ${trade.symbol}`,
          createdAt: Math.max(1, (Number(trade.createdAt) || Date.now()) - 1),
        };
        nextTransfers = [autoFundingTransfer, ...nextTransfers];
      }
    }

    const finalTrade: InvestmentTrade = {
      ...trade,
      walletId: finalWalletId,
      walletDeltaVnd: finalWalletDeltaVnd,
      ...(trade.assetType === 'CRYPTO' ? { fxRateAtExecution: rateMul } : {}),
    };

    const nextInvestments = isEdit
      ? investments.map((t) => (t.id === finalTrade.id ? finalTrade : t))
      : [...investments, finalTrade];

    const { syncedWallets, updatedInvWallets, investmentWalletBalances } =
      syncLedgerInvestmentWallets(baseWallets, nextInvestments, nextTransfers);

    const createdWalletFinal = createdInvWallet
      ? syncedWallets.find((w) => w.id === createdInvWallet!.id) || createdInvWallet
      : null;

    if (legacyOpening.length > 0 || autoFundingTransfer) {
      setTransfers(nextTransfers);
    }
    setWallets(syncedWallets);
    setInvestments(nextInvestments);

    const postLedgerBal = investmentWalletBalances[finalWalletId] ?? 0;
    const shortfallVnd =
      finalTrade.type === 'BUY' && postLedgerBal < 0 ? Math.abs(postLedgerBal) : 0;

    if (fundingMode === 'EXISTING_HOLDING' && autoFundingTransfer) {
      showToast(
        `Đã khai báo danh mục có sẵn ${finalTrade.symbol} (${formatVND(
          autoFundingTransfer.amount
        )}) và tự động cân bằng vốn khởi tạo trên sổ cái.`
      );
    } else if (fundingMode === 'LIVING_WALLET' && autoFundingTransfer && livingWalletUpdate) {
      showToast(
        `Đã mua ${finalTrade.symbol} và trừ trực tiếp ${formatVND(
          autoFundingTransfer.amount
        )} từ ví "${livingWalletUpdate.name}" qua cặp bút toán Nạp + Mua.`
      );
    } else if (shortfallVnd > 0) {
      showToast(
        `Đã lưu lệnh Mua ${finalTrade.symbol} · Sức mua "${
          syncedWalletName || 'Tiền chờ đầu tư'
        }" đang âm ${formatVND(shortfallVnd)} (hãy nạp thêm vốn để cân đối sổ cái).`,
        'warning'
      );
    } else if (isEdit) {
      showToast(
        `Đã cập nhật lệnh ${finalTrade.symbol} và tự động đối soát lại số dư Tiền chờ đầu tư.`
      );
    } else if (finalTrade.type === 'SELL' && prevHeldAtDate && prevHeldAtDate.currentQty > 0) {
      const proceedsVnd = Math.max(
        0,
        (effectiveSellQty * finalTrade.price - fee) * rateMul
      );
      const realizedVnd = proceedsVnd - effectiveSellQty * prevHeldAtDate.avgCost * rateMul;
      if (realizedVnd < 0) {
        showToast(
          `Đã bán cắt lỗ ${finalTrade.symbol} · Thực thu ${formatVND(proceedsVnd)} vào "${
            syncedWalletName || 'Tiền chờ đầu tư'
          }" và ghi nhận lỗ đã chốt ${formatSignedVND(realizedVnd)} vào mục Lỗ / Lãi.`,
          'warning'
        );
      } else if (realizedVnd > 0) {
        showToast(
          `Đã bán chốt lãi ${finalTrade.symbol} · Thực thu ${formatVND(proceedsVnd)} vào "${
            syncedWalletName || 'Tiền chờ đầu tư'
          }" và ghi nhận lãi đã chốt ${formatSignedVND(realizedVnd)} vào mục Lỗ / Lãi.`
        );
      } else {
        showToast(
          `Đã bán hòa vốn ${finalTrade.symbol} · Thực thu ${formatVND(proceedsVnd)} vào "${
            syncedWalletName || 'Tiền chờ đầu tư'
          }".`
        );
      }
    } else {
      showToast(
        `Đã thêm lệnh ${finalTrade.type === 'BUY' ? 'Mua' : 'Bán'} ${finalTrade.symbol} và hạch toán vào "${
          syncedWalletName || 'Tiền chờ đầu tư'
        }".`
      );
    }

    if (isCloudEligible && account) {
      try {
        for (const tr of legacyOpening) {
          await upsertCapitalTransferInFirestore(account.uid, tr, false);
        }
        if (autoFundingTransfer) {
          await upsertCapitalTransferInFirestore(account.uid, autoFundingTransfer, false);
        }
        await upsertInvestmentInFirestore(account.uid, finalTrade, isEdit);
        if (createdWalletFinal) {
          await upsertWalletInFirestore(account.uid, createdWalletFinal, false);
        }
        if (livingWalletUpdate) {
          await updateWalletBalanceInFirestore(
            account.uid,
            livingWalletUpdate.id,
            livingWalletUpdate.balance
          );
        }
        for (const wu of updatedInvWallets) {
          if (createdWalletFinal && wu.id === createdWalletFinal.id) continue;
          await updateWalletBalanceInFirestore(account.uid, wu.id, wu.balance);
        }
      } catch (err) {
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteInvestment = (tx: InvestmentTrade) => {
    const simulatedNext = investments.filter((t) => t.id !== tx.id);
    const ledgerCheck = validateTradeLedgerOrder(simulatedNext, usdtVndRate);
    if (!ledgerCheck.valid) {
      showToast(
        `Không thể xóa lệnh ${tx.type === 'BUY' ? 'Mua' : 'Bán'} ${tx.symbol}: ${
          ledgerCheck.error || 'Sẽ làm lệnh bán phía sau vượt quá khối lượng nắm giữ.'
        }`,
        'error'
      );
      return;
    }

    openConfirmDialog({
      title: `Xóa giao dịch ${tx.symbol}`,
      message: `Xóa lệnh ${tx.type === 'BUY' ? 'Mua' : 'Bán'} ${tx.symbol} ngày ${
        tx.date
      }? Sổ cái Tiền chờ đầu tư, Giá mua TB và Lỗ/Lãi đã chốt sẽ tự động tính lại chính xác.`,
      onConfirm: async () => {
        const nextInvestments = investments.filter((t) => t.id !== tx.id);
        const recheck = validateTradeLedgerOrder(nextInvestments, usdtVndRate);
        if (!recheck.valid) {
          closeConfirmDialog();
          showToast(
            `Đã hủy xóa lệnh ${tx.symbol}: ${recheck.error || 'Vi phạm thứ tự sổ cái.'}`,
            'error'
          );
          return;
        }
        const { syncedWallets, updatedInvWallets } = syncLedgerInvestmentWallets(
          wallets,
          nextInvestments,
          transfers
        );

        setWallets(syncedWallets);
        setInvestments(nextInvestments);
        closeConfirmDialog();
        showToast(`Đã xóa lệnh ${tx.symbol} và đối soát lại sổ cái Tiền chờ đầu tư.`);

        if (isCloudEligible && account) {
          try {
            await deleteInvestmentInFirestore(account.uid, tx.id);
            for (const wu of updatedInvWallets) {
              await updateWalletBalanceInFirestore(account.uid, wu.id, wu.balance);
            }
          } catch (err) {
            setCloudError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
    });
  };

  // --- Capital Transfers (Deposit / Withdraw between Living & Investment Cash) ---
  const handleSaveTransfer = async (
    transfer: CapitalTransfer,
    autoCreateInvWallet: boolean
  ) => {
    const legacyOpening = materializeLegacyOpeningDeposits(wallets, investments, transfers);
    const baseWallets = [...wallets];
    const livingUpdates: { id: string; balance: number }[] = [];
    let createdInvWallet: Wallet | null = null;
    let finalTransfer = transfer;

    if (autoCreateInvWallet && transfer.direction === 'DEPOSIT') {
      const newInvWallet: Wallet = {
        id: `w_inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: 'Tiền chờ đầu tư (Sức mua)',
        type: 'INVESTMENT',
        cashGroup: 'INVESTMENT',
        balance: 0,
        note: 'Tự động tạo từ lệnh nạp vốn đầu tư',
        createdAt: Date.now(),
      };
      createdInvWallet = newInvWallet;
      baseWallets.push(newInvWallet);
      finalTransfer = { ...transfer, targetWalletId: newInvWallet.id };
    }

    const applyLivingDelta = (wId: string, delta: number) => {
      if (!wId || !delta) return;
      const idx = baseWallets.findIndex((w) => w.id === wId);
      if (idx < 0 || getWalletCashGroup(baseWallets[idx]) !== 'LIVING') return;
      const updatedBal = Math.max(0, Math.round((Number(baseWallets[idx].balance) || 0) + delta));
      baseWallets[idx] = { ...baseWallets[idx], balance: updatedBal };
      livingUpdates.push({ id: wId, balance: updatedBal });
    };

    if (finalTransfer.sourceWalletId) {
      applyLivingDelta(finalTransfer.sourceWalletId, -finalTransfer.amount);
    }
    if (finalTransfer.targetWalletId) {
      applyLivingDelta(finalTransfer.targetWalletId, finalTransfer.amount);
    }

    const nextTransfers = [finalTransfer, ...legacyOpening, ...transfers];
    const { syncedWallets, updatedInvWallets } = syncLedgerInvestmentWallets(
      baseWallets,
      investments,
      nextTransfers
    );

    const createdWalletFinal = createdInvWallet
      ? syncedWallets.find((w) => w.id === createdInvWallet!.id) || createdInvWallet
      : null;

    setWallets(syncedWallets);
    setTransfers(nextTransfers);

    showToast(
      finalTransfer.direction === 'DEPOSIT'
        ? `Đã nạp ${formatVND(finalTransfer.amount)} vào Tiền chờ đầu tư.`
        : `Đã rút ${formatVND(finalTransfer.amount)} về ví sinh hoạt.`
    );

    if (isCloudEligible && account) {
      try {
        for (const tr of legacyOpening) {
          await upsertCapitalTransferInFirestore(account.uid, tr, false);
        }
        if (createdWalletFinal) {
          await upsertWalletInFirestore(account.uid, createdWalletFinal, false);
        }
        const mergedUpdates = new Map<string, number>();
        for (const wu of livingUpdates) mergedUpdates.set(wu.id, wu.balance);
        for (const wu of updatedInvWallets) {
          if (createdWalletFinal && wu.id === createdWalletFinal.id) continue;
          mergedUpdates.set(wu.id, wu.balance);
        }
        for (const [id, balance] of mergedUpdates.entries()) {
          await updateWalletBalanceInFirestore(account.uid, id, balance);
        }
        await upsertCapitalTransferInFirestore(account.uid, finalTransfer, false);
      } catch (err) {
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteTransfer = (tr: CapitalTransfer) => {
    openConfirmDialog({
      title: tr.direction === 'DEPOSIT' ? 'Xóa lệnh Nạp vốn đầu tư' : 'Xóa lệnh Rút vốn đầu tư',
      message: `Xóa giao dịch ${tr.direction === 'DEPOSIT' ? 'nạp' : 'rút'} ${formatVND(
        tr.amount
      )} ngày ${tr.date}? Số dư ví sinh hoạt và sổ cái Tiền chờ đầu tư sẽ tự động tính lại.`,
      onConfirm: async () => {
        const baseWallets = [...wallets];
        const livingUpdates: { id: string; balance: number }[] = [];
        const applyLivingDelta = (wId: string, delta: number) => {
          if (!wId || !delta) return;
          const idx = baseWallets.findIndex((w) => w.id === wId);
          if (idx < 0 || getWalletCashGroup(baseWallets[idx]) !== 'LIVING') return;
          const updatedBal = Math.max(
            0,
            Math.round((Number(baseWallets[idx].balance) || 0) + delta)
          );
          baseWallets[idx] = { ...baseWallets[idx], balance: updatedBal };
          livingUpdates.push({ id: wId, balance: updatedBal });
        };

        if (tr.sourceWalletId) applyLivingDelta(tr.sourceWalletId, tr.amount);
        if (tr.targetWalletId) applyLivingDelta(tr.targetWalletId, -tr.amount);

        const nextTransfers = transfers.filter((item) => item.id !== tr.id);
        const { syncedWallets, updatedInvWallets } = syncLedgerInvestmentWallets(
          baseWallets,
          investments,
          nextTransfers
        );

        setWallets(syncedWallets);
        setTransfers(nextTransfers);
        closeConfirmDialog();
        showToast('Đã xóa giao dịch nạp/rút vốn và đối soát lại số dư ví.');

        if (isCloudEligible && account) {
          try {
            await deleteCapitalTransferInFirestore(account.uid, tr.id);
            const mergedUpdates = new Map<string, number>();
            for (const wu of livingUpdates) mergedUpdates.set(wu.id, wu.balance);
            for (const wu of updatedInvWallets) mergedUpdates.set(wu.id, wu.balance);
            for (const [id, balance] of mergedUpdates.entries()) {
              await updateWalletBalanceInFirestore(account.uid, id, balance);
            }
          } catch (err) {
            setCloudError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
    });
  };

  // --- Cashflows (with Wallet Sync & Real-Time Budget Alert Check) ---
  const handleSaveCashflow = async (entry: CashflowEntry, isEdit: boolean) => {
    const prevEntry = isEdit ? cashflows.find((c) => c.id === entry.id) || null : null;
    const nextCashflows = isEdit
      ? cashflows.map((c) => (c.id === entry.id ? entry : c))
      : [entry, ...cashflows];

    // Calculate wallet balance adjustments
    const walletUpdates: { id: string; balance: number }[] = [];
    const nextWallets = [...wallets];
    const applyDelta = (wId: string, delta: number) => {
      if (!wId || !delta) return;
      const idx = nextWallets.findIndex((w) => w.id === wId);
      if (idx < 0) return;
      const updatedBal = Math.max(0, (Number(nextWallets[idx].balance) || 0) + delta);
      nextWallets[idx] = { ...nextWallets[idx], balance: updatedBal };
      walletUpdates.push({ id: wId, balance: updatedBal });
    };

    if (prevEntry) {
      const oldSigned = prevEntry.type === 'INCOME' ? prevEntry.amount : -prevEntry.amount;
      const newSigned = entry.type === 'INCOME' ? entry.amount : -entry.amount;
      if (prevEntry.walletId && prevEntry.walletId === entry.walletId) {
        applyDelta(entry.walletId, newSigned - oldSigned);
      } else {
        if (prevEntry.walletId) applyDelta(prevEntry.walletId, -oldSigned);
        if (entry.walletId) applyDelta(entry.walletId, newSigned);
      }
    } else if (entry.walletId) {
      const signed = entry.type === 'INCOME' ? entry.amount : -entry.amount;
      applyDelta(entry.walletId, signed);
    }

    setWallets(nextWallets);
    setCashflows(nextCashflows);

    // Check real-time budget threshold alert on EXPENSE
    if (entry.type === 'EXPENSE') {
      const ym = entry.date.slice(0, 7);
      const evals = evaluateMonthlyBudgets(budgets, nextCashflows, ym);
      const matched = evals.find((e) => e.category === entry.category);
      if (matched && matched.status === 'EXCEEDED') {
        showToast(
          `Vượt ngân sách "${entry.category}": đã chi ${formatVND(
            matched.spent,
            true
          )} / ${formatVND(matched.limitAmount, true)} (vượt +${formatVND(
            Math.abs(matched.remaining),
            true
          )}).`,
          'error'
        );
      } else if (matched && matched.status === 'WARNING') {
        showToast(
          `Ngân sách "${entry.category}" đã đạt ${Math.round(
            matched.ratioPct
          )}% hạn mức tháng (còn ${formatVND(matched.remaining, true)}).`,
          'warning'
        );
      } else {
        showToast(isEdit ? 'Đã cập nhật khoản Chi tiêu.' : 'Đã ghi nhận khoản Chi tiêu.');
      }
    } else {
      showToast(isEdit ? 'Đã cập nhật khoản Thu nhập.' : 'Đã ghi nhận khoản Thu nhập.');
    }

    if (isCloudEligible && account) {
      try {
        await upsertCashflowInFirestore(account.uid, entry, isEdit);
        for (const wu of walletUpdates) {
          await updateWalletBalanceInFirestore(account.uid, wu.id, wu.balance);
        }
      } catch (err) {
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteCashflow = (item: CashflowEntry) => {
    openConfirmDialog({
      title: 'Xóa khoản Thu – Chi',
      message: `Xóa khoản ${item.type === 'INCOME' ? 'Thu' : 'Chi'} "${item.category}" (${formatVND(
        item.amount
      )})?${item.walletId ? ' Số dư ví liên kết sẽ tự động hoàn lại.' : ''}`,
      onConfirm: async () => {
        let updatedWallet: { id: string; balance: number } | null = null;
        if (item.walletId) {
          const revert = item.type === 'INCOME' ? -item.amount : item.amount;
          setWallets((prev) =>
            prev.map((w) => {
              if (w.id !== item.walletId) return w;
              const bal = Math.max(0, (Number(w.balance) || 0) + revert);
              updatedWallet = { id: w.id, balance: bal };
              return { ...w, balance: bal };
            })
          );
        }
        setCashflows((prev) => prev.filter((c) => c.id !== item.id));
        closeConfirmDialog();
        showToast('Đã xóa khoản Thu – Chi.');

        if (isCloudEligible && account) {
          try {
            await deleteCashflowInFirestore(account.uid, item.id);
            if (updatedWallet) {
              await updateWalletBalanceInFirestore(
                account.uid,
                (updatedWallet as { id: string; balance: number }).id,
                (updatedWallet as { id: string; balance: number }).balance
              );
            }
          } catch (err) {
            setCloudError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
    });
  };

  // --- Budgets ---
  const handleSaveBudget = async (rule: BudgetRule, isEdit: boolean) => {
    setBudgets((prev) => {
      const exists = prev.some((b) => b.id === rule.id);
      return exists ? prev.map((b) => (b.id === rule.id ? rule : b)) : [...prev, rule];
    });
    showToast(`Đã lưu ngân sách "${rule.category}": ${formatVND(rule.limitAmount)}/tháng.`);
    if (isCloudEligible && account) {
      try {
        await upsertBudgetInFirestore(account.uid, rule, isEdit);
      } catch (err) {
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteBudget = (rule: BudgetRule) => {
    openConfirmDialog({
      title: `Xóa ngân sách "${rule.category}"`,
      message: `Xóa hạn mức ${formatVND(rule.limitAmount)} cho danh mục "${rule.category}"?`,
      onConfirm: async () => {
        setBudgets((prev) => prev.filter((b) => b.id !== rule.id));
        closeConfirmDialog();
        showToast(`Đã xóa ngân sách "${rule.category}".`);
        if (isCloudEligible && account) {
          try {
            await deleteBudgetInFirestore(account.uid, rule.id);
          } catch (err) {
            setCloudError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
    });
  };

  // --- Manual Price Override & USDT Rate ---
  const handleManualPriceOverride = (pos: EnrichedPosition, rawInput: string) => {
    const parsed = parseSmartNumber(rawInput, !pos.isCrypto);
    if (parsed > 0) {
      const finalPrice = pos.isCrypto ? parsed : normalizeVnPriceToFullVND(parsed);
      setMarketQuotes((prev) => ({
        ...prev,
        [pos.key]: {
          symbol: pos.symbol,
          price: finalPrice,
          refPrice: prev[pos.key]?.refPrice || finalPrice,
          source: 'THỦ CÔNG',
          updatedAt: getTimeNowStr(),
        },
      }));
      showToast(
        `Đã đặt giá ${pos.symbol}: ${pos.isCrypto ? formatUSD(finalPrice) : formatVND(finalPrice)}`
      );
    }
  };

  const handleUpdateUsdtRate = async (nextRate: number) => {
    setUsdtVndRate(nextRate);
    if (isCloudEligible && account) {
      try {
        await updateUserPrefsInFirestore(account.uid, { usdtVndRate: nextRate });
      } catch (err) {
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  // --- Profile, Password, Apps Script, JSON Backup, Reset ---
  const handleUpdateDisplayName = async (newName: string) => {
    if (!account) return;
    try {
      if (account.isGuest) {
        const updatedAcc = { ...account, displayName: newName };
        setAccount(updatedAcc);
        writeGuestSession(updatedAcc);
        syncDeviceGuestSummary(account.uid, buildCurrentStatePayload(), newName);
      } else if (account.authProvider === 'password') {
        const updated = await serverUpdateDisplayName(newName);
        setAccount(updated);
      } else {
        const updatedAcc = { ...account, displayName: newName };
        setAccount(updatedAcc);
        upsertGoogleQuickAccount(updatedAcc);
        await updateFirebaseDisplayName(newName);
        if (isCloudEligible) {
          await updateUserDisplayNameInFirestore(account.uid, newName);
        }
      }
      showToast('Đã cập nhật tên hiển thị.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể cập nhật tên hiển thị.', 'error');
    }
  };

  const handleChangePassword = async (oldPwd: string, newPwd: string) => {
    if (account?.authProvider === 'password') {
      await serverChangePassword(oldPwd, newPwd);
    } else {
      await changeFirebasePassword(oldPwd, newPwd);
    }
    showToast('Đã đổi mật khẩu tài khoản.');
  };

  const handleSaveGasUrl = async (url: string) => {
    const trimmed = url.trim();
    setGasSyncUrl(trimmed);
    if (isCloudEligible && account) {
      await updateUserPrefsInFirestore(account.uid, { gasSyncUrl: trimmed });
    }
    showToast(trimmed ? 'Đã lưu Google Apps Script URL.' : 'Đã xóa Google Apps Script URL.');
  };

  const handleGasPush = async (rawUrl: string) => {
    const url = rawUrl.trim() || gasSyncUrl.trim();
    if (!url || !account) {
      showToast('Vui lòng dán URL Web App của Google Apps Script trước.', 'warning');
      return;
    }
    try {
      const payload = {
        action: 'push',
        accountId: account.uid,
        email: account.email,
        data: buildCurrentStatePayload({ gasSyncUrl: url }),
      };
      const res = await fetchWithTimeout(url, 8000, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGasSyncUrl(url);
      if (isCloudEligible) {
        await updateUserPrefsInFirestore(account.uid, { gasSyncUrl: url });
      }
      showToast('Đã đẩy dữ liệu lên Google Apps Script.');
    } catch (err) {
      showToast(
        `Không thể đồng bộ lên Apps Script: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  };

  const handleGasPull = async (rawUrl: string) => {
    const url = rawUrl.trim() || gasSyncUrl.trim();
    if (!url || !account) {
      showToast('Vui lòng dán URL Web App của Google Apps Script trước.', 'warning');
      return;
    }
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetchWithTimeout(
        `${url}${sep}action=pull&accountId=${encodeURIComponent(account.uid)}`,
        8000
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const pulled = json?.data || json;
      if (!Array.isArray(pulled?.wallets) || !Array.isArray(pulled?.investments)) {
        throw new Error('Phản hồi từ Apps Script chưa có dữ liệu FinFlow hợp lệ.');
      }
      const nextPayload: FinancialStatePayload = {
        version: 3,
        wallets: pulled.wallets,
        investments: pulled.investments,
        cashflows: Array.isArray(pulled.cashflows) ? pulled.cashflows : [],
        budgets: Array.isArray(pulled.budgets) ? pulled.budgets : [],
        transfers: Array.isArray(pulled.transfers) ? pulled.transfers : [],
        usdtVndRate: Number(pulled.usdtVndRate) >= 1000 ? Number(pulled.usdtVndRate) : usdtVndRate,
        isSampleData: false,
        gasSyncUrl: url,
        updatedAt: Date.now(),
      };
      applyLocalStatePayload(nextPayload);
      if (isCloudEligible) {
        await replaceAllUserSubcollections(account.uid, nextPayload, true);
      }
      showToast('Đã tải dữ liệu từ Google Apps Script.');
    } catch (err) {
      showToast(
        `Không thể tải từ Apps Script: ${err instanceof Error ? err.message : String(err)}`,
        'error'
      );
    }
  };

  const handleExportJson = () => {
    const payload = {
      app: 'FinFlow',
      exportedAt: new Date().toISOString(),
      accountEmail: account?.email || '',
      ...buildCurrentStatePayload(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinFlow_Backup_${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file sao lưu JSON.');
  };

  const handleImportJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (
          !Array.isArray(parsed.wallets) ||
          !Array.isArray(parsed.investments) ||
          !Array.isArray(parsed.cashflows)
        ) {
          throw new Error('File JSON không đúng cấu trúc FinFlow.');
        }
        const nextPayload: FinancialStatePayload = {
          version: 3,
          wallets: parsed.wallets,
          investments: parsed.investments,
          cashflows: parsed.cashflows,
          budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
          transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
          usdtVndRate: Number(parsed.usdtVndRate) >= 1000 ? Number(parsed.usdtVndRate) : usdtVndRate,
          isSampleData: false,
          gasSyncUrl: String(parsed.gasSyncUrl || gasSyncUrl || ''),
          updatedAt: Date.now(),
        };
        applyLocalStatePayload(nextPayload);
        if (isCloudEligible && account) {
          await replaceAllUserSubcollections(account.uid, nextPayload, true);
        }
        showToast('Đã khôi phục dữ liệu từ file JSON.');
      } catch (err) {
        showToast(
          `Lỗi nhập file: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleData = async () => {
    const sample = buildSampleState();
    sample.gasSyncUrl = gasSyncUrl;
    applyLocalStatePayload(sample);
    if (isCloudEligible && account) {
      try {
        await replaceAllUserSubcollections(account.uid, sample, true);
      } catch (err) {
        setCloudError(err instanceof Error ? err : new Error(String(err)));
      }
    }
    showToast('Đã nạp bộ dữ liệu mẫu nhiều tháng và ngân sách.');
  };

  const requestClearAllData = (onlySampleText = false) => {
    openConfirmDialog({
      title: onlySampleText ? 'Xóa dữ liệu mẫu để bắt đầu trắng' : 'Xóa toàn bộ dữ liệu cá nhân',
      message:
        'Toàn bộ ví tiền mặt, giao dịch đầu tư, ngân sách và lịch sử thu chi hiện tại sẽ được xóa trống để bạn nhập dữ liệu thật của mình.',
      onConfirm: async () => {
        const empty: FinancialStatePayload = {
          version: 3,
          usdtVndRate,
          isSampleData: false,
          gasSyncUrl,
          updatedAt: Date.now(),
          wallets: [],
          investments: [],
          cashflows: [],
          budgets: [],
          transfers: [],
        };
        applyLocalStatePayload(empty);
        closeConfirmDialog();
        showToast('Đã xóa dữ liệu hiện tại. Bạn có thể bắt đầu ghi chép mới.');
        if (isCloudEligible && account) {
          try {
            await replaceAllUserSubcollections(account.uid, empty, true);
          } catch (err) {
            setCloudError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      },
    });
  };

  // ==========================================================================
  // 6. RENDER LOADING / AUTH / MAIN WORKSPACE
  // ==========================================================================

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] dark:bg-[#0D1117] flex items-center justify-center transition-colors duration-200">
        <div className="flex flex-col items-center gap-3">
          <span className="font-display text-2xl font-semibold text-[#141413] dark:text-[#ECEBE6]">
            FinFlow
          </span>
          <span className="text-xs font-medium text-[#63625C] dark:text-[#8E98A8]">
            Đang mở sổ tài sản...
          </span>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#F6F5F1] dark:bg-[#0D1117] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <span className="font-display text-2xl font-semibold text-[#141413] dark:text-[#ECEBE6]">
                  FinFlow
                </span>
                <span className="text-xs font-medium text-[#63625C] dark:text-[#8E98A8]">
                  Đang tải màn hình đăng nhập...
                </span>
              </div>
            </div>
          }
        >
          <AuthScreen
            onServerAuthSuccess={handleServerAuthSuccess}
            onGuestMode={handleGuestMode}
            showToast={showToast}
            theme={theme}
            onToggleTheme={toggleTheme}
            reducedMotion={reducedMotion}
            heroBackground={
              <Suspense fallback={null}>
                <HeroCanvas reducedMotion={reducedMotion} />
              </Suspense>
            }
          />
        </Suspense>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#F6F5F1] dark:bg-[#0D1117] text-[#141413] dark:text-[#ECEBE6] flex pb-16 lg:pb-0 transition-colors duration-200">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* DESKTOP EDITORIAL MASTHEAD SIDEBAR */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-white dark:bg-[#151B23] border-r border-[#E4E2DB] dark:border-[#262F3D] sticky top-0 h-screen transition-colors duration-200">
        <div className="h-16 px-5 border-b border-[#E4E2DB] dark:border-[#262F3D] flex items-center justify-between">
          <button
            type="button"
            onClick={() => switchMainTab('DASHBOARD')}
            className="aui-btn flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
          >
            <div className="w-7 h-7 rounded-md bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117] flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-[#141413] dark:text-[#ECEBE6]">
              FinFlow
            </span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Điều hướng chính">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#63625C] dark:text-[#8E98A8]">
            Sổ cái cá nhân
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchMainTab(item.id)}
                className={`aui-btn relative w-full px-3 py-2.5 rounded-lg text-[13px] flex items-center gap-3 whitespace-nowrap ${
                  active
                    ? 'bg-[#0E5A4F]/[0.08] dark:bg-[#38B29A]/[0.12] text-[#0E5A4F] dark:text-[#38B29A] font-semibold'
                    : 'text-[#63625C] dark:text-[#8E98A8] font-medium hover:bg-[#F6F5F1] dark:hover:bg-[#1C2430] hover:text-[#141413] dark:hover:text-[#ECEBE6]'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-[#0E5A4F] dark:bg-[#38B29A]"
                  />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active
                      ? 'text-[#0E5A4F] dark:text-[#38B29A]'
                      : 'text-[#8E8C84] dark:text-[#6E7A8D]'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Account & Sync Footer */}
        <div className="p-3.5 border-t border-[#E4E2DB] dark:border-[#262F3D] space-y-3">
          <button
            type="button"
            onClick={() => switchMainTab('SETTINGS')}
            className="aui-btn w-full px-2.5 py-2 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-left flex items-center gap-2 text-xs"
          >
            {syncMode === 'CLOUD_SYNCED' ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-[#137A4B] dark:text-[#34D399] shrink-0" />
                <span className="font-medium text-[#137A4B] dark:text-[#34D399] truncate">
                  Cloud Firestore
                </span>
              </>
            ) : syncMode === 'SERVER_SYNCED' ? (
              <>
                <Server className="w-3.5 h-3.5 text-[#137A4B] dark:text-[#34D399] shrink-0" />
                <span className="font-medium text-[#137A4B] dark:text-[#34D399] truncate">
                  Máy chủ FinFlow
                </span>
              </>
            ) : syncMode === 'SYNCING' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A] animate-spin shrink-0" />
                <span className="font-medium text-[#0E5A4F] dark:text-[#38B29A] truncate">
                  Đang đồng bộ...
                </span>
              </>
            ) : syncMode === 'VERIFY_EMAIL' ? (
              <>
                <MailCheck className="w-3.5 h-3.5 text-[#B45309] dark:text-[#FBBF24] shrink-0" />
                <span className="font-medium text-[#B45309] dark:text-[#FBBF24] truncate">
                  Chờ xác minh email
                </span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-[#63625C] dark:text-[#8E98A8] shrink-0" />
                <span className="font-medium text-[#63625C] dark:text-[#8E98A8] truncate">
                  Lưu cục bộ trình duyệt
                </span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#0E5A4F]/12 dark:bg-[#38B29A]/15 text-[#0E5A4F] dark:text-[#38B29A] border border-[#0E5A4F]/20 dark:border-[#38B29A]/25 flex items-center justify-center font-display text-sm font-semibold shrink-0">
                {(account.displayName || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
                  {account.displayName}
                </div>
                <div className="text-[11px] text-[#63625C] dark:text-[#8E98A8] truncate">
                  {account.isGuest ? 'Chế độ Khách' : account.email}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="aui-btn p-1.5 rounded-lg text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185] hover:bg-[#FFF1F3] dark:hover:bg-[#2A141A] shrink-0"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* WORKSPACE MAIN COLUMN */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TOP BAR (3-Zone Editorial Header) */}
        <header className="sticky top-0 z-30 h-16 bg-[#F6F5F1]/92 dark:bg-[#0D1117]/92 backdrop-blur-sm border-b border-[#E4E2DB] dark:border-[#262F3D] px-4 lg:px-8 flex items-center justify-between gap-4 transition-colors duration-200">
          <div className="flex items-baseline gap-3 min-w-0">
            <button
              type="button"
              onClick={() => switchMainTab('DASHBOARD')}
              className="lg:hidden flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <div className="w-7 h-7 rounded-md bg-[#0E5A4F] dark:bg-[#38B29A] text-white dark:text-[#0D1117] flex items-center justify-center">
                <PieChart className="w-4 h-4" />
              </div>
              <span className="font-display text-lg font-semibold text-[#141413] dark:text-[#ECEBE6]">
                FinFlow
              </span>
            </button>
            <h1 className="hidden lg:block font-display text-lg font-semibold text-[#141413] dark:text-[#ECEBE6] truncate">
              {activeNavMeta.title}
            </h1>
            <span className="hidden md:inline text-xs text-[#63625C] dark:text-[#8E98A8] font-num">
              · {formatMonthLabel(selectedMonth)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="aui-btn p-2 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#63625C] dark:text-[#FBBF24] shrink-0"
              title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang chế độ Tối dịu mắt'}
              aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang chế độ Tối dịu mắt'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-[#0E5A4F]" />}
            </button>

            <StatusButton
              status={priceBtnStatus}
              disabled={isSyncingPrices}
              onClick={() => syncMarketPrices(true, true)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#EFEDE7] dark:hover:bg-[#1C2430] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] text-xs font-medium whitespace-nowrap shrink-0"
              states={{
                idle: (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A]" />
                    <span className="hidden sm:inline">Cập nhật giá</span>
                  </>
                ),
                loading: (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-[#0E5A4F] dark:text-[#38B29A] animate-spin" />
                    <span className="hidden sm:inline">Đang đồng bộ...</span>
                  </>
                ),
                done: (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#137A4B] dark:text-[#34D399]" />
                    <span className="hidden sm:inline text-[#137A4B] dark:text-[#34D399]">
                      Đã cập nhật
                    </span>
                  </>
                ),
              }}
            />

            <button
              type="button"
              onClick={() => {
                if (activeTab === 'ASSETS') {
                  setEditingInv(null);
                  setPresetInvAsset('VN_STOCK');
                  setPresetInvSymbol('');
                  setPresetInvSide('BUY');
                  setShowInvestModal(true);
                } else {
                  setEditingCf(null);
                  setPresetCfType('EXPENSE');
                  setShowCashflowModal(true);
                }
              }}
              className="aui-btn px-3.5 py-1.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{activeTab === 'ASSETS' ? 'Thêm GD Đầu tư' : 'Ghi Thu / Chi'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="lg:hidden aui-btn p-1.5 rounded-lg text-[#63625C] dark:text-[#8E98A8] hover:text-[#BE123C] dark:hover:text-[#FB7185]"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* MAIN VIEWPORT CONTENT */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Email Verification Notice */}
          {syncMode === 'VERIFY_EMAIL' && (
            <div className="bg-[#FFFBEB] dark:bg-[#261E0F] border border-[#F2D59B] dark:border-[#6B4E16] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#92400E] dark:text-[#FCD34D]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24] shrink-0" />
                <span>
                  Tài khoản Email chưa xác minh nên dữ liệu đang tạm lưu cục bộ. Xác minh email để
                  bật đồng bộ Cloud Firestore đa thiết bị.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await resendVerificationEmail();
                      showToast('Đã gửi lại email xác minh. Vui lòng kiểm tra hộp thư.');
                    } catch {
                      showToast('Không thể gửi lại lúc này. Thử lại sau ít phút.', 'warning');
                    }
                  }}
                  className="aui-btn px-3 py-1.5 rounded-lg bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] font-semibold"
                >
                  Gửi lại email
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await auth.currentUser?.reload();
                    if (auth.currentUser?.emailVerified) {
                      setAccount((prev) => (prev ? { ...prev, emailVerified: true } : prev));
                      showToast('Email đã xác minh. Đang kích hoạt đồng bộ Cloud Firestore.');
                    } else {
                      showToast('Email vẫn chưa được xác minh.', 'warning');
                    }
                  }}
                  className="aui-btn px-3 py-1.5 rounded-lg bg-[#B45309] text-white font-semibold"
                >
                  Tôi đã xác minh
                </button>
              </div>
            </div>
          )}

          {/* Server Multi-Tab / Multi-Device 409 Conflict Banner */}
          {serverConflict && (
            <div
              role="alert"
              className="bg-[#FFFBEB] dark:bg-[#261E0F] border border-[#F2D59B] dark:border-[#6B4E16] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#92400E] dark:text-[#FCD34D]"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#78350F] dark:text-[#FDE68A]">
                    Phát hiện xung đột phiên bản dữ liệu trên máy chủ (409)
                  </div>
                  <div>
                    Tài khoản vừa được cập nhật từ tab hoặc thiết bị khác. Hệ thống đã tạm dừng tự lưu để bảo vệ dữ liệu không bị ghi đè mất.
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isResolvingConflict}
                  onClick={handleAcceptServerState}
                  className="aui-btn px-3 py-1.5 rounded-lg bg-[#0E5A4F] hover:bg-[#0A463D] dark:bg-[#38B29A] dark:hover:bg-[#2E9B86] text-white dark:text-[#0D1117] font-semibold"
                >
                  Tải bản mới nhất
                </button>
                <button
                  type="button"
                  disabled={isResolvingConflict}
                  onClick={handleForceOverwriteServerState}
                  className="aui-btn px-3 py-1.5 rounded-lg bg-white dark:bg-[#151B23] hover:bg-[#FFF1F3] dark:hover:bg-[#2A141A] border border-[#E4E2DB] dark:border-[#262F3D] text-[#BE123C] dark:text-[#FB7185] font-semibold"
                >
                  {isResolvingConflict ? 'Đang ghi đè...' : 'Ghi đè bằng bản hiện tại'}
                </button>
              </div>
            </div>
          )}

          {/* Sample Data Banner */}
          {isSampleData && (
            <div className="bg-white dark:bg-[#151B23] border border-[#E4E2DB] dark:border-[#262F3D] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-[#63625C] dark:text-[#8E98A8]">
                <Sparkles className="w-4 h-4 text-[#0E5A4F] dark:text-[#38B29A] shrink-0" />
                <span>
                  Đang hiển thị <strong className="text-[#141413] dark:text-[#ECEBE6]">dữ liệu mẫu</strong> (6 tháng dòng tiền, ngân sách có cảnh báo và danh mục GEX/FPT/BTC).
                </span>
              </div>
              <button
                type="button"
                onClick={() => requestClearAllData(true)}
                className="aui-btn px-3 py-1.5 rounded-lg bg-[#F6F5F1] dark:bg-[#0D1117] hover:bg-[#FFF1F3] dark:hover:bg-[#2A141A] border border-[#E4E2DB] dark:border-[#262F3D] text-[#141413] dark:text-[#ECEBE6] hover:text-[#BE123C] dark:hover:text-[#FB7185] text-xs font-semibold whitespace-nowrap shrink-0"
              >
                Xóa dữ liệu mẫu để bắt đầu trắng
              </button>
            </div>
          )}

          <Suspense fallback={<WorkspacePanelFallback />}>
            {activeTab === 'DASHBOARD' && (
              <DashboardTab
                accounting={accounting}
                cashflows={cashflows}
                transfers={transfers}
                monthlyCashflow={monthlyCashflow}
                trendPoints={trendPoints}
                trendMonths={trendMonths}
                onChangeTrendMonths={setTrendMonths}
                budgetEvaluations={budgetEvaluations}
                selectedMonth={selectedMonth}
                onChangeMonth={setSelectedMonth}
                onNavigateTab={switchMainTab}
                onSelectAssetSubTab={setAssetSubTab}
                onSelectWalletGroup={setAssetWalletGroup}
                onOpenBudgetModal={() => {
                  setEditingBudget(null);
                  setShowBudgetModal(true);
                }}
                onOpenTransferModal={() => setShowTransferModal(true)}
                isDark={isDark}
                reducedMotion={reducedMotion}
                tabDirection={tabDirection}
              />
            )}

            {activeTab === 'ASSETS' && (
              <AssetsTab
                accounting={accounting}
                wallets={wallets}
                assetSubTab={assetSubTab}
                onChangeSubTab={setAssetSubTab}
                walletGroupTab={assetWalletGroup}
                onChangeWalletGroupTab={setAssetWalletGroup}
                binanceWsStatus={binanceWsStatus}
                usdtVndRate={usdtVndRate}
                onUpdateUsdtRate={handleUpdateUsdtRate}
                onOpenWalletModal={(w) => {
                  setEditingWallet(w || null);
                  setShowWalletModal(true);
                }}
                onDeleteWallet={handleDeleteWallet}
                onOpenInvestModal={(asset, sym = '', side = 'BUY', rec) => {
                  setEditingInv(rec || null);
                  setPresetInvAsset(asset);
                  setPresetInvSymbol(sym);
                  setPresetInvSide(side);
                  setShowInvestModal(true);
                }}
                onDeleteInvestment={handleDeleteInvestment}
                onOpenTransferModal={() => setShowTransferModal(true)}
                onDeleteTransfer={handleDeleteTransfer}
                onManualPriceOverride={handleManualPriceOverride}
                tabDirection={tabDirection}
              />
            )}

            {activeTab === 'CASHFLOW' && (
              <CashflowTab
                selectedMonth={selectedMonth}
                onChangeMonth={setSelectedMonth}
                monthlyCashflow={monthlyCashflow}
                allCashflows={cashflows}
                wallets={wallets}
                budgetEvaluations={budgetEvaluations}
                onOpenCashflowModal={(type, rec) => {
                  setEditingCf(rec || null);
                  setPresetCfType(type);
                  setShowCashflowModal(true);
                }}
                onDeleteCashflow={handleDeleteCashflow}
                onOpenBudgetModal={(rule) => {
                  setEditingBudget(rule || null);
                  setShowBudgetModal(true);
                }}
                onDeleteBudget={handleDeleteBudget}
                onToast={showToast}
                tabDirection={tabDirection}
              />
            )}

            {activeTab === 'SETTINGS' && (
              <SettingsTab
                account={account}
                syncMode={syncMode}
                wallets={wallets}
                investments={investments}
                cashflows={cashflows}
                transfers={transfers}
                usdtVndRate={usdtVndRate}
                isSampleData={isSampleData}
                gasSyncUrl={gasSyncUrl}
                theme={theme}
                onToggleTheme={() => {
                  const next = theme === 'dark' ? 'light' : 'dark';
                  setTheme(next);
                  showToast(
                    next === 'dark'
                      ? 'Đã bật chế độ Tối dịu mắt (Dark Mode).'
                      : 'Đã chuyển về chế độ Sáng (Light Mode).'
                  );
                }}
                motionTempo={motionTempo}
                reducedMotion={reducedMotion}
                onChangeTempo={(val) => {
                  setMotionTempo(val);
                  showToast(`Đã chỉnh nhịp độ Animate UI: ${val}x`);
                }}
                onToggleReducedMotion={() => {
                  setReducedMotion((v) => {
                    const next = !v;
                    showToast(
                      next
                        ? 'Đã bật chế độ Giảm chuyển động.'
                        : 'Đã khôi phục đầy đủ chuyển động Animate UI.'
                    );
                    return next;
                  });
                }}
                onUpdateDisplayName={handleUpdateDisplayName}
                onChangePassword={handleChangePassword}
                onSaveGasUrl={handleSaveGasUrl}
                onGasPush={handleGasPush}
                onGasPull={handleGasPull}
                onExportJson={handleExportJson}
                onImportJsonFile={handleImportJsonFile}
                onLoadSampleData={handleLoadSampleData}
                onClearAllData={() => requestClearAllData(isSampleData)}
                onOpenInvestModal={(asset, sym = '', side = 'BUY', rec) => {
                  setEditingInv(rec || null);
                  setPresetInvAsset(asset);
                  setPresetInvSymbol(sym);
                  setPresetInvSide(side);
                  setShowInvestModal(true);
                }}
                onDeleteInvestment={handleDeleteInvestment}
                onToast={showToast}
                tabDirection={tabDirection}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav
        aria-label="Điều hướng di động"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white dark:bg-[#151B23] border-t border-[#E4E2DB] dark:border-[#262F3D] px-2 grid grid-cols-4 gap-1 items-center transition-colors duration-200"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchMainTab(item.id)}
              className={`aui-btn flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-semibold ${
                active
                  ? 'text-[#0E5A4F] dark:text-[#38B29A] bg-[#0E5A4F]/[0.08] dark:bg-[#38B29A]/[0.12]'
                  : 'text-[#63625C] dark:text-[#8E98A8]'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* MODALS */}
      <CashflowModal
        open={showCashflowModal}
        onClose={() => {
          setShowCashflowModal(false);
          setEditingCf(null);
        }}
        editing={editingCf}
        presetType={presetCfType}
        wallets={wallets}
        onSave={handleSaveCashflow}
        tempo={motionTempo}
        reducedMotion={reducedMotion}
      />

      <InvestmentModal
        open={showInvestModal}
        onClose={() => {
          setShowInvestModal(false);
          setEditingInv(null);
        }}
        editing={editingInv}
        presetAsset={presetInvAsset}
        presetSymbol={presetInvSymbol}
        presetType={presetInvSide}
        investments={investments}
        wallets={wallets}
        investmentWalletBalances={accounting.investmentWalletBalances}
        marketQuotes={marketQuotes}
        usdtVndRate={usdtVndRate}
        onSave={handleSaveInvestment}
        tempo={motionTempo}
        reducedMotion={reducedMotion}
      />

      <WalletModal
        open={showWalletModal}
        onClose={() => {
          setShowWalletModal(false);
          setEditingWallet(null);
        }}
        editing={editingWallet}
        ledgerBalance={
          editingWallet && getWalletCashGroup(editingWallet) === 'INVESTMENT'
            ? accounting.investmentWalletBalances[editingWallet.id]
            : undefined
        }
        onOpenTransferModal={() => setShowTransferModal(true)}
        onSave={handleSaveWallet}
        tempo={motionTempo}
        reducedMotion={reducedMotion}
      />

      <CapitalTransferModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        wallets={wallets}
        investmentWalletBalances={accounting.investmentWalletBalances}
        onSave={handleSaveTransfer}
        tempo={motionTempo}
        reducedMotion={reducedMotion}
      />

      <BudgetModal
        open={showBudgetModal}
        onClose={() => {
          setShowBudgetModal(false);
          setEditingBudget(null);
        }}
        editing={editingBudget}
        selectedMonth={selectedMonth}
        existingBudgets={budgets}
        onSave={handleSaveBudget}
        tempo={motionTempo}
        reducedMotion={reducedMotion}
      />

      <ConfirmModal
        open={confirmOpen}
        config={confirmModal}
        onClose={closeConfirmDialog}
        tempo={motionTempo}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
