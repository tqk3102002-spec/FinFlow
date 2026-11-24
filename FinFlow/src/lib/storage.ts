import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  getWalletCashGroup,
  SCHEMA_LIMITS,
  type BudgetRule,
  type CapitalTransfer,
  type CashflowEntry,
  type DeviceGuestProfile,
  type FinancialStatePayload,
  type InvestmentTrade,
  type SavedQuickAccount,
  type UserAccount,
  type Wallet,
  type WalletCashGroup,
  type WalletType,
} from '../types/finance';
import { getTodayISO } from './accounting';

// ============================================================================
// SAFE LOCAL STORAGE (OFFLINE-FIRST MIRROR, DEVICE GUEST & QUICK HINTS)
// ============================================================================

const LS_GUEST_KEY = 'finflow_v3_guest_session';
const LS_DEVICE_GUEST_KEY = 'finflow_v3_device_guest_profile';
const LS_GOOGLE_QUICK_HINTS_KEY = 'finflow_v3_google_quick_accounts';
const LS_STATE_PREFIX = 'finflow_v3_state_';
const LS_MOTION_KEY = 'finflow_v3_motion_prefs';
const LS_THEME_KEY = 'finflow_v3_theme';

export const MAX_QUICK_LOGIN_ACCOUNTS = 3;

const memoryFallbackStore = new Map<string, string>();

export function safeStorageGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Restricted iframe fallback
  }
  return memoryFallbackStore.get(key) ?? null;
}

export function safeStorageSet(key: string, value: string): void {
  memoryFallbackStore.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function safeStorageRemove(key: string): void {
  memoryFallbackStore.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

export function readGuestSession(): UserAccount | null {
  try {
    const raw = safeStorageGet(LS_GUEST_KEY);
    return raw ? (JSON.parse(raw) as UserAccount) : null;
  } catch {
    return null;
  }
}

export function writeGuestSession(session: UserAccount | null): void {
  if (!session) {
    safeStorageRemove(LS_GUEST_KEY);
    return;
  }
  safeStorageSet(LS_GUEST_KEY, JSON.stringify(session));
}

export function readLocalFinancialState(uid: string): FinancialStatePayload | null {
  try {
    const raw = safeStorageGet(`${LS_STATE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinancialStatePayload>;
    return {
      version: parsed.version || 3,
      usdtVndRate: Number(parsed.usdtVndRate) >= 1000 ? Number(parsed.usdtVndRate) : 25450,
      isSampleData: Boolean(parsed.isSampleData),
      gasSyncUrl: String(parsed.gasSyncUrl || ''),
      updatedAt: Number(parsed.updatedAt) || Date.now(),
      wallets: Array.isArray(parsed.wallets)
        ? parsed.wallets.map((w) => {
            const type = normalizeWalletType(w?.type);
            return {
              ...w,
              type,
              cashGroup: normalizeWalletCashGroup(w?.cashGroup, type),
            };
          })
        : [],
      investments: Array.isArray(parsed.investments) ? parsed.investments : [],
      cashflows: Array.isArray(parsed.cashflows) ? parsed.cashflows : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
    };
  } catch {
    return null;
  }
}

export function writeLocalFinancialState(uid: string, state: FinancialStatePayload): void {
  try {
    safeStorageSet(`${LS_STATE_PREFIX}${uid}`, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

export function deleteLocalFinancialState(uid: string): void {
  if (!uid) return;
  safeStorageRemove(`${LS_STATE_PREFIX}${uid}`);
}

export function computeGuestStateStats(payload: FinancialStatePayload | null): {
  walletCount: number;
  investmentCount: number;
  cashflowCount: number;
  budgetCount: number;
  hasData: boolean;
} {
  const walletCount = payload?.wallets?.length || 0;
  const investmentCount = payload?.investments?.length || 0;
  const cashflowCount = payload?.cashflows?.length || 0;
  const budgetCount = payload?.budgets?.length || 0;
  const transferCount = payload?.transfers?.length || 0;
  const hasData =
    walletCount > 0 || investmentCount > 0 || cashflowCount > 0 || budgetCount > 0 || transferCount > 0;
  return { walletCount, investmentCount, cashflowCount, budgetCount, hasData };
}

export function readDeviceGuestProfile(): DeviceGuestProfile | null {
  try {
    const raw = safeStorageGet(LS_DEVICE_GUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceGuestProfile>;
      if (parsed && typeof parsed.uid === 'string' && parsed.uid.length > 0) {
        const storedState = readLocalFinancialState(parsed.uid);
        const stats = computeGuestStateStats(storedState);
        return {
          uid: parsed.uid,
          displayName: parsed.displayName || 'Tài khoản khách',
          createdAt: Number(parsed.createdAt) || Date.now(),
          lastUsedAt: Number(parsed.lastUsedAt) || Date.now(),
          ...stats,
        };
      }
    }

    // Legacy migration: detect existing local guest data saved under guest_sandbox_local
    const legacyState = readLocalFinancialState('guest_sandbox_local');
    if (legacyState) {
      const stats = computeGuestStateStats(legacyState);
      const migrated: DeviceGuestProfile = {
        uid: 'guest_sandbox_local',
        displayName: 'Tài khoản khách',
        createdAt: legacyState.updatedAt || Date.now(),
        lastUsedAt: legacyState.updatedAt || Date.now(),
        ...stats,
      };
      writeDeviceGuestProfile(migrated);
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeDeviceGuestProfile(profile: DeviceGuestProfile | null): void {
  if (!profile) {
    safeStorageRemove(LS_DEVICE_GUEST_KEY);
    return;
  }
  safeStorageSet(LS_DEVICE_GUEST_KEY, JSON.stringify(profile));
}

export function syncDeviceGuestSummary(
  uid: string,
  payload: FinancialStatePayload,
  displayName?: string
): DeviceGuestProfile {
  const existing = readDeviceGuestProfile();
  const now = Date.now();
  const stats = computeGuestStateStats(payload);
  const next: DeviceGuestProfile = {
    uid,
    displayName: displayName || (existing?.uid === uid ? existing.displayName : 'Tài khoản khách'),
    createdAt: existing?.uid === uid ? existing.createdAt : now,
    lastUsedAt: now,
    ...stats,
  };
  writeDeviceGuestProfile(next);
  return next;
}

// Non-sensitive Google profile hints only (zero tokens or credentials ever stored in browser storage)
export function readGoogleQuickAccounts(): SavedQuickAccount[] {
  try {
    const raw = safeStorageGet(LS_GOOGLE_QUICK_HINTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedQuickAccount =>
          Boolean(item) &&
          typeof item.uid === 'string' &&
          typeof item.email === 'string' &&
          item.authProvider === 'google'
      )
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_QUICK_LOGIN_ACCOUNTS);
  } catch {
    return [];
  }
}

export function writeGoogleQuickAccounts(accounts: SavedQuickAccount[]): void {
  const trimmed = [...accounts]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_QUICK_LOGIN_ACCOUNTS);
  safeStorageSet(LS_GOOGLE_QUICK_HINTS_KEY, JSON.stringify(trimmed));
}

export function upsertGoogleQuickAccount(user: UserAccount): {
  accounts: SavedQuickAccount[];
  replaced: SavedQuickAccount | null;
} {
  if (user.authProvider !== 'google' || user.isGuest || !user.uid || !user.email) {
    return { accounts: readGoogleQuickAccounts(), replaced: null };
  }
  const now = Date.now();
  const current = readGoogleQuickAccounts();
  const existingIdx = current.findIndex((a) => a.uid === user.uid);
  if (existingIdx >= 0) {
    const updated = [...current];
    updated[existingIdx] = {
      ...updated[existingIdx],
      displayName: user.displayName || updated[existingIdx].displayName,
      email: user.email,
      lastUsedAt: now,
    };
    writeGoogleQuickAccounts(updated);
    return { accounts: readGoogleQuickAccounts(), replaced: null };
  }

  let replaced: SavedQuickAccount | null = null;
  const next = [...current];
  if (next.length >= MAX_QUICK_LOGIN_ACCOUNTS) {
    const sortedAsc = [...next].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    replaced = sortedAsc[0];
    const removeIdx = next.findIndex((a) => a.uid === replaced!.uid);
    if (removeIdx >= 0) next.splice(removeIdx, 1);
  }
  next.push({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0] || 'Người dùng',
    authProvider: 'google',
    savedAt: now,
    lastUsedAt: now,
  });
  writeGoogleQuickAccounts(next);
  return { accounts: readGoogleQuickAccounts(), replaced };
}

export function removeGoogleQuickAccount(uid: string): SavedQuickAccount[] {
  const next = readGoogleQuickAccounts().filter((a) => a.uid !== uid);
  writeGoogleQuickAccounts(next);
  return next;
}

export function mergeQuickAccounts(
  serverAccounts: SavedQuickAccount[],
  googleAccounts: SavedQuickAccount[]
): SavedQuickAccount[] {
  const map = new Map<string, SavedQuickAccount>();
  [...serverAccounts, ...googleAccounts].forEach((acc) => {
    const prev = map.get(acc.uid);
    if (!prev || acc.lastUsedAt > prev.lastUsedAt) {
      map.set(acc.uid, acc);
    }
  });
  return Array.from(map.values())
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_QUICK_LOGIN_ACCOUNTS);
}

export function readMotionPrefs(): { tempo: number; reducedMotion: boolean } {
  try {
    const saved = JSON.parse(safeStorageGet(LS_MOTION_KEY) || '{}');
    const tempo = Number(saved.tempo);
    return {
      tempo: [0.7, 0.85, 1, 1.15, 1.3].includes(tempo) ? tempo : 1,
      reducedMotion: Boolean(saved.reducedMotion),
    };
  } catch {
    return { tempo: 1, reducedMotion: false };
  }
}

export function writeMotionPrefs(tempo: number, reducedMotion: boolean): void {
  safeStorageSet(LS_MOTION_KEY, JSON.stringify({ tempo, reducedMotion }));
}

export function readThemePreference(): 'light' | 'dark' {
  return safeStorageGet(LS_THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function writeThemePreference(theme: 'light' | 'dark'): void {
  safeStorageSet(LS_THEME_KEY, theme);
}

// ============================================================================
// DEFENSIVE PAYLOAD SANITIZERS (SYNCHRONIZED WITH firebase-blueprint.json)
// ============================================================================

export function sanitizeDocId(rawId: string, prefix: string): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  if (cleaned.length >= 1) return cleaned;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeDate(raw: string): string {
  const s = String(raw || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : getTodayISO();
}

function sanitizeMonth(raw: string): string {
  const s = String(raw || '').trim();
  if (s === 'DEFAULT' || /^\d{4}-\d{2}$/.test(s)) return s;
  return 'DEFAULT';
}

function sanitizeSymbol(raw: string): string {
  const cleaned = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, SCHEMA_LIMITS.SYMBOL_MAX);
  return cleaned || 'ASSET';
}

function clampUsdtRate(val: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 25450;
  return Math.min(SCHEMA_LIMITS.USDT_RATE_MAX, Math.max(SCHEMA_LIMITS.USDT_RATE_MIN, Math.round(num)));
}

function sanitizeOptionalFxRate(raw: unknown): number | undefined {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < SCHEMA_LIMITS.USDT_RATE_MIN) return undefined;
  return Math.min(SCHEMA_LIMITS.USDT_RATE_MAX, Math.max(SCHEMA_LIMITS.USDT_RATE_MIN, Math.round(num)));
}

function normalizeWalletType(raw: unknown): WalletType {
  if (raw === 'CASH' || raw === 'SAVINGS' || raw === 'INVESTMENT') return raw;
  return 'BANK';
}

function normalizeWalletCashGroup(raw: unknown, type: WalletType): WalletCashGroup {
  if (raw === 'LIVING' || raw === 'INVESTMENT') return raw;
  return getWalletCashGroup({ type });
}

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return Date.now();
}

// ============================================================================
// FIRESTORE REPOSITORY (NATIVE SUBCOLLECTIONS + STRICT SECURITY RULES)
// ============================================================================

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  email: string;
  authProvider: 'google' | 'password';
  usdtVndRate: number;
  isSampleData: boolean;
  gasSyncUrl: string;
}

export async function ensureUserProfileAndSeedIfNew(
  account: UserAccount
): Promise<{ profile: UserProfileDoc; isNew: boolean }> {
  const userPath = `users/${account.uid}`;
  const userRef = doc(db, 'users', account.uid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        isNew: false,
        profile: {
          uid: account.uid,
          displayName: String(data.displayName || account.displayName || 'Người dùng'),
          email: String(data.email || account.email || ''),
          authProvider: data.authProvider === 'password' ? 'password' : 'google',
          usdtVndRate: clampUsdtRate(Number(data.usdtVndRate) || 25450),
          isSampleData: Boolean(data.isSampleData),
          gasSyncUrl: String(data.gasSyncUrl || ''),
        },
      };
    }

    const profilePayload = {
      uid: account.uid,
      displayName: (account.displayName || account.email.split('@')[0] || 'Người dùng').slice(
        0,
        SCHEMA_LIMITS.DISPLAY_NAME_MAX
      ),
      email: (account.email || '').slice(0, SCHEMA_LIMITS.EMAIL_MAX),
      authProvider: account.authProvider === 'password' ? ('password' as const) : ('google' as const),
      usdtVndRate: clampUsdtRate(25450),
      isSampleData: false,
      gasSyncUrl: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Create parent profile doc with clean 0-state (no pre-seeded sample assets)
    await setDoc(userRef, profilePayload);

    return {
      isNew: true,
      profile: {
        uid: profilePayload.uid,
        displayName: profilePayload.displayName,
        email: profilePayload.email,
        authProvider: profilePayload.authProvider,
        usdtVndRate: profilePayload.usdtVndRate,
        isSampleData: false,
        gasSyncUrl: '',
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function subscribeUserFinance(
  uid: string,
  callbacks: {
    onProfile: (profile: UserProfileDoc) => void;
    onWallets: (wallets: Wallet[]) => void;
    onInvestments: (investments: InvestmentTrade[]) => void;
    onCashflows: (cashflows: CashflowEntry[]) => void;
    onBudgets: (budgets: BudgetRule[]) => void;
    onTransfers?: (transfers: CapitalTransfer[]) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const wrapErr = (op: OperationType, path: string) => (error: unknown) => {
    try {
      handleFirestoreError(error, op, path);
    } catch (wrapped) {
      callbacks.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        callbacks.onProfile({
          uid,
          displayName: String(d.displayName || 'Người dùng'),
          email: String(d.email || ''),
          authProvider: d.authProvider === 'password' ? 'password' : 'google',
          usdtVndRate: clampUsdtRate(Number(d.usdtVndRate) || 25450),
          isSampleData: Boolean(d.isSampleData),
          gasSyncUrl: String(d.gasSyncUrl || ''),
        });
      },
      wrapErr(OperationType.GET, `users/${uid}`)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'wallets'), where('ownerId', '==', uid)),
      (snap) => {
        const list: Wallet[] = snap.docs.map((d) => {
          const data = d.data();
          const type = normalizeWalletType(data.type);
          return {
            id: d.id,
            name: String(data.name || ''),
            type,
            cashGroup: normalizeWalletCashGroup(data.cashGroup, type),
            balance: Math.max(0, Number(data.balance) || 0),
            note: String(data.note || ''),
            createdAt: timestampToMs(data.createdAt),
          };
        });
        list.sort((a, b) => a.createdAt - b.createdAt);
        callbacks.onWallets(list);
      },
      wrapErr(OperationType.LIST, `users/${uid}/wallets`)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'investments'), where('ownerId', '==', uid)),
      (snap) => {
        const list: InvestmentTrade[] = snap.docs.map((d) => {
          const data = d.data();
          const rawDelta = Number(data.walletDeltaVnd);
          const fxRate = sanitizeOptionalFxRate(data.fxRateAtExecution);
          return {
            id: d.id,
            assetType: data.assetType === 'CRYPTO' ? 'CRYPTO' : 'VN_STOCK',
            symbol: String(data.symbol || ''),
            exchange: String(data.exchange || 'HSX'),
            type: data.type === 'SELL' ? 'SELL' : 'BUY',
            quantity: Number(data.quantity) || 0,
            price: Number(data.price) || 0,
            feeAmount: Math.max(0, Number(data.feeAmount) || 0),
            date: String(data.date || getTodayISO()),
            note: String(data.note || ''),
            walletId: typeof data.walletId === 'string' ? data.walletId : '',
            walletDeltaVnd: Number.isFinite(rawDelta) ? Math.round(rawDelta) : 0,
            ...(fxRate !== undefined ? { fxRateAtExecution: fxRate } : {}),
            createdAt: timestampToMs(data.createdAt),
          };
        });
        callbacks.onInvestments(list);
      },
      wrapErr(OperationType.LIST, `users/${uid}/investments`)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'cashflows'), where('ownerId', '==', uid)),
      (snap) => {
        const list: CashflowEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
            amount: Number(data.amount) || 0,
            category: String(data.category || 'Khác'),
            date: String(data.date || getTodayISO()),
            note: String(data.note || ''),
            walletId: String(data.walletId || ''),
            createdAt: timestampToMs(data.createdAt),
          };
        });
        callbacks.onCashflows(list);
      },
      wrapErr(OperationType.LIST, `users/${uid}/cashflows`)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'budgets'), where('ownerId', '==', uid)),
      (snap) => {
        const list: BudgetRule[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            category: String(data.category || 'Ăn uống'),
            month: String(data.month || 'DEFAULT'),
            limitAmount: Number(data.limitAmount) || 0,
            createdAt: timestampToMs(data.createdAt),
          };
        });
        callbacks.onBudgets(list);
      },
      wrapErr(OperationType.LIST, `users/${uid}/budgets`)
    )
  );

  if (callbacks.onTransfers) {
    const onTransfers = callbacks.onTransfers;
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'transfers'), where('ownerId', '==', uid)),
        (snap) => {
          const list: CapitalTransfer[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              direction: data.direction === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT',
              amount: Math.max(0, Number(data.amount) || 0),
              sourceWalletId: String(data.sourceWalletId || ''),
              targetWalletId: String(data.targetWalletId || ''),
              date: String(data.date || getTodayISO()),
              note: String(data.note || ''),
              createdAt: timestampToMs(data.createdAt),
            };
          });
          onTransfers(list);
        },
        wrapErr(OperationType.LIST, `users/${uid}/transfers`)
      )
    );
  }

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

// ============================================================================
// INDIVIDUAL FIRESTORE MUTATIONS
// ============================================================================

export async function updateUserDisplayNameInFirestore(
  uid: string,
  displayName: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: displayName.trim().slice(0, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPrefsInFirestore(
  uid: string,
  patch: Partial<{ usdtVndRate: number; isSampleData: boolean; gasSyncUrl: string }>
): Promise<void> {
  const path = `users/${uid}`;
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.usdtVndRate !== undefined) clean.usdtVndRate = clampUsdtRate(patch.usdtVndRate);
  if (patch.isSampleData !== undefined) clean.isSampleData = Boolean(patch.isSampleData);
  if (patch.gasSyncUrl !== undefined) {
    clean.gasSyncUrl = String(patch.gasSyncUrl).trim().slice(0, SCHEMA_LIMITS.GAS_URL_MAX);
  }
  try {
    await updateDoc(doc(db, 'users', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertWalletInFirestore(
  uid: string,
  wallet: Wallet,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeDocId(wallet.id, 'w');
  const path = `users/${uid}/wallets/${id}`;
  const ref = doc(db, 'users', uid, 'wallets', id);
  const name = wallet.name.trim().slice(0, SCHEMA_LIMITS.WALLET_NAME_MAX) || 'Ví tiền';
  const note = wallet.note.trim().slice(0, SCHEMA_LIMITS.NOTE_MAX);
  const balance = Math.max(0, Math.round(Number(wallet.balance) || 0));
  const type = normalizeWalletType(wallet.type);
  const cashGroup = normalizeWalletCashGroup(wallet.cashGroup, type);

  try {
    if (isEdit) {
      await updateDoc(ref, {
        name,
        type,
        cashGroup,
        balance,
        note,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id,
        ownerId: uid,
        name,
        type,
        cashGroup,
        balance,
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function updateWalletBalanceInFirestore(
  uid: string,
  walletId: string,
  newBalance: number
): Promise<void> {
  const id = sanitizeDocId(walletId, 'w');
  const path = `users/${uid}/wallets/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'wallets', id), {
      balance: Math.max(0, Math.round(Number(newBalance) || 0)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWalletInFirestore(uid: string, walletId: string): Promise<void> {
  const id = sanitizeDocId(walletId, 'w');
  const path = `users/${uid}/wallets/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'wallets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertInvestmentInFirestore(
  uid: string,
  trade: InvestmentTrade,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeDocId(trade.id, 'inv');
  const path = `users/${uid}/investments/${id}`;
  const ref = doc(db, 'users', uid, 'investments', id);
  const rawDelta = Number(trade.walletDeltaVnd);
  const fxRate =
    trade.assetType === 'CRYPTO' ? sanitizeOptionalFxRate(trade.fxRateAtExecution) : undefined;
  const payload = {
    assetType: trade.assetType,
    symbol: sanitizeSymbol(trade.symbol),
    exchange: (trade.exchange || (trade.assetType === 'CRYPTO' ? 'BINANCE' : 'HSX')).slice(
      0,
      SCHEMA_LIMITS.EXCHANGE_MAX
    ),
    type: trade.type,
    quantity: Number(trade.quantity),
    price: Number(trade.price),
    feeAmount: Math.max(0, Number(trade.feeAmount) || 0),
    date: sanitizeDate(trade.date),
    note: trade.note.trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
    walletId: String(trade.walletId || '').slice(0, 128),
    walletDeltaVnd: Number.isFinite(rawDelta) ? Math.round(rawDelta) : 0,
    ...(fxRate !== undefined ? { fxRateAtExecution: fxRate } : {}),
  };

  try {
    if (isEdit) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        id,
        ownerId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteInvestmentInFirestore(uid: string, tradeId: string): Promise<void> {
  const id = sanitizeDocId(tradeId, 'inv');
  const path = `users/${uid}/investments/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'investments', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCashflowInFirestore(
  uid: string,
  entry: CashflowEntry,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeDocId(entry.id, 'cf');
  const path = `users/${uid}/cashflows/${id}`;
  const ref = doc(db, 'users', uid, 'cashflows', id);
  const payload = {
    type: entry.type,
    amount: Math.max(1, Math.round(Number(entry.amount) || 0)),
    category: (entry.category || 'Khác').trim().slice(0, SCHEMA_LIMITS.CATEGORY_MAX),
    date: sanitizeDate(entry.date),
    note: entry.note.trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
    walletId: (entry.walletId || '').slice(0, 128),
  };

  try {
    if (isEdit) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        id,
        ownerId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCashflowInFirestore(uid: string, entryId: string): Promise<void> {
  const id = sanitizeDocId(entryId, 'cf');
  const path = `users/${uid}/cashflows/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'cashflows', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertBudgetInFirestore(
  uid: string,
  rule: BudgetRule,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeDocId(rule.id, 'b');
  const path = `users/${uid}/budgets/${id}`;
  const ref = doc(db, 'users', uid, 'budgets', id);
  const payload = {
    category: (rule.category || 'Ăn uống').trim().slice(0, SCHEMA_LIMITS.CATEGORY_MAX),
    month: sanitizeMonth(rule.month),
    limitAmount: Math.max(1, Math.round(Number(rule.limitAmount) || 0)),
  };

  try {
    if (isEdit) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        id,
        ownerId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteBudgetInFirestore(uid: string, ruleId: string): Promise<void> {
  const id = sanitizeDocId(ruleId, 'b');
  const path = `users/${uid}/budgets/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'budgets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCapitalTransferInFirestore(
  uid: string,
  transfer: CapitalTransfer,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeDocId(transfer.id, 'tr');
  const path = `users/${uid}/transfers/${id}`;
  const ref = doc(db, 'users', uid, 'transfers', id);
  const payload = {
    direction: transfer.direction === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT',
    amount: Math.max(1, Math.round(Number(transfer.amount) || 0)),
    sourceWalletId: String(transfer.sourceWalletId || '').slice(0, 128),
    targetWalletId: String(transfer.targetWalletId || '').slice(0, 128),
    date: sanitizeDate(transfer.date),
    note: (transfer.note || '').trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
  };

  try {
    if (isEdit) {
      await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        id,
        ownerId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCapitalTransferInFirestore(
  uid: string,
  transferId: string
): Promise<void> {
  const id = sanitizeDocId(transferId, 'tr');
  const path = `users/${uid}/transfers/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'transfers', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// BULK REPLACE FOR CLEAR / SAMPLE RESET / JSON IMPORT / GAS PULL
// ============================================================================

export async function replaceAllUserSubcollections(
  uid: string,
  nextState: FinancialStatePayload,
  updateParentMeta = true
): Promise<void> {
  const cols = ['wallets', 'investments', 'cashflows', 'budgets', 'transfers'] as const;

  try {
    // 1. Delete existing docs across all 5 subcollections
    const deleteRefs: ReturnType<typeof doc>[] = [];
    for (const colName of cols) {
      const snap = await getDocs(
        query(collection(db, 'users', uid, colName), where('ownerId', '==', uid))
      );
      snap.docs.forEach((d) => deleteRefs.push(d.ref));
    }

    for (let i = 0; i < deleteRefs.length; i += 400) {
      const batch = writeBatch(db);
      deleteRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // 2. Write new docs in chunked batches
    type PendingWrite = { ref: ReturnType<typeof doc>; data: Record<string, unknown> };
    const writes: PendingWrite[] = [];

    nextState.wallets.forEach((w) => {
      const id = sanitizeDocId(w.id, 'w');
      const type = normalizeWalletType(w.type);
      writes.push({
        ref: doc(db, 'users', uid, 'wallets', id),
        data: {
          id,
          ownerId: uid,
          name: (w.name || 'Ví tiền').trim().slice(0, SCHEMA_LIMITS.WALLET_NAME_MAX),
          type,
          cashGroup: normalizeWalletCashGroup(w.cashGroup, type),
          balance: Math.max(0, Math.round(Number(w.balance) || 0)),
          note: (w.note || '').trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    nextState.investments.forEach((tx) => {
      const id = sanitizeDocId(tx.id, 'inv');
      const qty = Number(tx.quantity);
      const price = Number(tx.price);
      if (qty <= 0 || price <= 0) return;
      const rawDelta = Number(tx.walletDeltaVnd);
      const isCr = tx.assetType === 'CRYPTO';
      const fxRate = isCr ? sanitizeOptionalFxRate(tx.fxRateAtExecution) : undefined;
      writes.push({
        ref: doc(db, 'users', uid, 'investments', id),
        data: {
          id,
          ownerId: uid,
          assetType: isCr ? 'CRYPTO' : 'VN_STOCK',
          symbol: sanitizeSymbol(tx.symbol),
          exchange: (tx.exchange || (isCr ? 'BINANCE' : 'HSX')).slice(
            0,
            SCHEMA_LIMITS.EXCHANGE_MAX
          ),
          type: tx.type === 'SELL' ? 'SELL' : 'BUY',
          quantity: qty,
          price,
          feeAmount: Math.max(0, Number(tx.feeAmount) || 0),
          date: sanitizeDate(tx.date),
          note: (tx.note || '').trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
          walletId: String(tx.walletId || '').slice(0, 128),
          walletDeltaVnd: Number.isFinite(rawDelta) ? Math.round(rawDelta) : 0,
          ...(fxRate !== undefined ? { fxRateAtExecution: fxRate } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    nextState.cashflows.forEach((c) => {
      const id = sanitizeDocId(c.id, 'cf');
      const amt = Math.round(Number(c.amount) || 0);
      if (amt <= 0) return;
      writes.push({
        ref: doc(db, 'users', uid, 'cashflows', id),
        data: {
          id,
          ownerId: uid,
          type: c.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          amount: amt,
          category: (c.category || 'Khác').trim().slice(0, SCHEMA_LIMITS.CATEGORY_MAX),
          date: sanitizeDate(c.date),
          note: (c.note || '').trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
          walletId: String(c.walletId || '').slice(0, 128),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    (nextState.budgets || []).forEach((b) => {
      const id = sanitizeDocId(b.id, 'b');
      const lim = Math.round(Number(b.limitAmount) || 0);
      if (lim <= 0) return;
      writes.push({
        ref: doc(db, 'users', uid, 'budgets', id),
        data: {
          id,
          ownerId: uid,
          category: (b.category || 'Ăn uống').trim().slice(0, SCHEMA_LIMITS.CATEGORY_MAX),
          month: sanitizeMonth(b.month),
          limitAmount: lim,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    (nextState.transfers || []).forEach((tr) => {
      const id = sanitizeDocId(tr.id, 'tr');
      const amt = Math.round(Number(tr.amount) || 0);
      if (amt <= 0) return;
      writes.push({
        ref: doc(db, 'users', uid, 'transfers', id),
        data: {
          id,
          ownerId: uid,
          direction: tr.direction === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT',
          amount: amt,
          sourceWalletId: String(tr.sourceWalletId || '').slice(0, 128),
          targetWalletId: String(tr.targetWalletId || '').slice(0, 128),
          date: sanitizeDate(tr.date),
          note: (tr.note || '').trim().slice(0, SCHEMA_LIMITS.NOTE_MAX),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    });

    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db);
      writes.slice(i, i + 400).forEach((w) => batch.set(w.ref, w.data));
      await batch.commit();
    }

    if (updateParentMeta) {
      await updateUserPrefsInFirestore(uid, {
        usdtVndRate: nextState.usdtVndRate,
        isSampleData: nextState.isSampleData,
        gasSyncUrl: nextState.gasSyncUrl,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}
