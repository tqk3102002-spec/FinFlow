import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

// ============================================================================
// TYPES (Type-only so `node server.ts` native type stripping works cleanly)
// ============================================================================

interface StoredUser {
  uid: string;
  email: string;
  displayName: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
}

interface StoredSession {
  tokenHash: string;
  uid: string;
  createdAt: number;
  expiresAt: number;
}

interface StoredWallet {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'SAVINGS' | 'INVESTMENT';
  cashGroup: 'LIVING' | 'INVESTMENT';
  balance: number;
  note: string;
  createdAt: number;
}

interface StoredInvestment {
  id: string;
  assetType: 'VN_STOCK' | 'CRYPTO';
  symbol: string;
  exchange: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  feeAmount: number;
  date: string;
  note: string;
  walletId: string;
  walletDeltaVnd: number;
  fxRateAtExecution?: number;
  createdAt: number;
}

interface StoredCashflow {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  date: string;
  note: string;
  walletId: string;
  createdAt: number;
}

interface StoredBudget {
  id: string;
  category: string;
  month: string;
  limitAmount: number;
  createdAt: number;
}

interface StoredCapitalTransfer {
  id: string;
  direction: 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  sourceWalletId: string;
  targetWalletId: string;
  date: string;
  note: string;
  createdAt: number;
}

interface StoredFinancialState {
  version: number;
  usdtVndRate: number;
  isSampleData: boolean;
  gasSyncUrl: string;
  updatedAt: number;
  wallets: StoredWallet[];
  investments: StoredInvestment[];
  cashflows: StoredCashflow[];
  budgets: StoredBudget[];
  transfers: StoredCapitalTransfer[];
}

interface StoredDeviceQuickEntry {
  uid: string;
  savedAt: number;
  lastUsedAt: number;
}

interface StoredDeviceVault {
  entries: StoredDeviceQuickEntry[];
  updatedAt: number;
}

interface ServerDatabase {
  users: Record<string, StoredUser>;
  emailToUid: Record<string, string>;
  sessions: Record<string, StoredSession>;
  states: Record<string, StoredFinancialState>;
  deviceVaults: Record<string, StoredDeviceVault>;
}

interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
  authTokenHash?: string;
}

// ============================================================================
// CONSTANTS & CONFINED DATA PATH
// ============================================================================

const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE_NAME = 'finflow_session';
const DEVICE_COOKIE_NAME = 'finflow_device';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const MAX_QUICK_ACCOUNTS = 3;
const MAX_WALLETS = 200;
const MAX_INVESTMENTS = 5000;
const MAX_CASHFLOWS = 10000;
const MAX_BUDGETS = 200;
const MAX_TRANSFERS = 2000;

// DATA_DIR can point at a persistent volume in production (e.g. /data on Cloud Run / Docker).
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.resolve(process.cwd(), 'data'));
const DB_FILE = path.resolve(DATA_DIR, 'finflow-server-db.json');

if (!DB_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid database file path confinement.');
}

// ============================================================================
// CRYPTO & PASSWORD HASHING (SCRYPT + TIMING-SAFE EQUAL)
// ============================================================================

function hashPasswordScrypt(password: string, saltHex: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, saltHex, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

async function createPasswordRecord(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await hashPasswordScrypt(password, salt);
  return { salt, hash };
}

async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const candidate = await hashPasswordScrypt(password, salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ============================================================================
// LIGHTWEIGHT RATE LIMITER FOR AUTH ENDPOINTS
// ============================================================================

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_BUCKETS = 5000;

function pruneExpiredRateBuckets(now = Date.now()): void {
  for (const [k, v] of rateBuckets.entries()) {
    if (!v || v.resetAt <= now) {
      rateBuckets.delete(k);
    }
  }
  if (rateBuckets.size > MAX_RATE_BUCKETS) {
    const overflow = rateBuckets.size - MAX_RATE_BUCKETS;
    let removed = 0;
    for (const k of rateBuckets.keys()) {
      rateBuckets.delete(k);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

setInterval(() => pruneExpiredRateBuckets(), 5 * 60 * 1000).unref();

function checkRateLimit(key: string, maxAttempts = 25, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  if (rateBuckets.size >= MAX_RATE_BUCKETS) {
    pruneExpiredRateBuckets(now);
  }
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

// ============================================================================
// SERVER-SIDE VN STOCK QUOTE PROXY (DNSE -> VNDIRECT, 60S SHARED CACHE)
// ============================================================================

const VN_TICKER_REGEX = /^[A-Z0-9]{1,10}$/;
const VN_QUOTE_CACHE_TTL_MS = 60 * 1000;
const MAX_VN_QUOTE_CACHE = 500;

interface CachedVnQuote {
  symbol: string;
  price: number;
  refPrice: number;
  source: 'DNSE' | 'VNDIRECT';
  updatedAt: string;
  cachedAt: number;
}

const vnQuoteServerCache = new Map<string, CachedVnQuote>();

function formatVnTimeHHMM(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getVnDateKeyServer(unixSec: number): string {
  const d = new Date((Number(unixSec) + 7 * 3600) * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

function normalizeVnPriceServer(raw: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1000 ? Math.round(n * 1000) : Math.round(n);
}

interface ServerCandlePayload {
  c?: number[];
  o?: number[];
  t?: number[];
}

function extractVnCandlePriceServer(
  dayJson: ServerCandlePayload | null,
  minJson: ServerCandlePayload | null
): { price: number; refPrice: number } | null {
  const dayC = Array.isArray(dayJson?.c) ? dayJson.c : [];
  const dayO = Array.isArray(dayJson?.o) ? dayJson.o : [];
  const dayT = Array.isArray(dayJson?.t) ? dayJson.t : [];
  const minC = Array.isArray(minJson?.c) ? minJson.c : [];
  const minT = Array.isArray(minJson?.t) ? minJson.t : [];

  if (dayC.length === 0 && minC.length === 0) return null;

  const lastD = dayC.length - 1;
  const lastM = minC.length - 1;
  let rawCur = 0;
  let latestSec = 0;

  if (lastM >= 0 && (lastD < 0 || minT[lastM] >= dayT[lastD])) {
    rawCur = minC[lastM];
    latestSec = minT[lastM];
  } else if (lastD >= 0) {
    rawCur = dayC[lastD];
    latestSec = dayT[lastD];
  }

  let rawRef = rawCur;
  if (lastD >= 0) {
    const sameDay = getVnDateKeyServer(latestSec) === getVnDateKeyServer(dayT[lastD]);
    rawRef = sameDay ? (lastD >= 1 ? dayC[lastD - 1] : dayO[lastD] || rawCur) : dayC[lastD];
  }

  const price = normalizeVnPriceServer(rawCur);
  const refPrice = normalizeVnPriceServer(rawRef) || price;
  return price > 0 ? { price, refPrice } : null;
}

async function fetchExternalJsonWithTimeout(url: string, timeoutMs = 4500): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FinFlow-MarketProxy/1.0',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVnQuoteFromUpstream(symbol: string): Promise<CachedVnQuote | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromDay = nowSec - 86400 * 14;
  const fromMin = nowSec - 86400 * 4;
  const encodedSym = encodeURIComponent(symbol);

  // Allowlisted upstream 1: DNSE Chart API v2
  const dnseBase = 'https://services.entrade.com.vn/chart-api/v2/ohlcs/stock';
  const [dayJson, minJson] = await Promise.all([
    fetchExternalJsonWithTimeout(`${dnseBase}?symbol=${encodedSym}&resolution=1D&from=${fromDay}&to=${nowSec}`, 4500),
    fetchExternalJsonWithTimeout(`${dnseBase}?symbol=${encodedSym}&resolution=1&from=${fromMin}&to=${nowSec}`, 4500),
  ]);
  const dnseParsed = extractVnCandlePriceServer(
    (dayJson as ServerCandlePayload | null) ?? null,
    (minJson as ServerCandlePayload | null) ?? null
  );
  if (dnseParsed) {
    return {
      symbol,
      price: dnseParsed.price,
      refPrice: dnseParsed.refPrice,
      source: 'DNSE',
      updatedAt: formatVnTimeHHMM(),
      cachedAt: Date.now(),
    };
  }

  // Allowlisted upstream 2: VNDirect DChart API
  const vndJson = await fetchExternalJsonWithTimeout(
    `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${encodedSym}&from=${fromDay}&to=${nowSec}`,
    4500
  );
  const vndParsed = extractVnCandlePriceServer((vndJson as ServerCandlePayload | null) ?? null, null);
  if (vndParsed) {
    return {
      symbol,
      price: vndParsed.price,
      refPrice: vndParsed.refPrice,
      source: 'VNDIRECT',
      updatedAt: formatVnTimeHHMM(),
      cachedAt: Date.now(),
    };
  }

  return null;
}

// ============================================================================
// PERSISTENT ATOMIC FILE STORE (SERIALIZED WRITE QUEUE)
// ============================================================================

function createEmptyDb(): ServerDatabase {
  return {
    users: {},
    emailToUid: {},
    sessions: {},
    states: {},
    deviceVaults: {},
  };
}

let dbCache: ServerDatabase | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function loadDatabase(): Promise<ServerDatabase> {
  if (dbCache) return dbCache;
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerDatabase>;
    dbCache = {
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
      emailToUid:
        parsed.emailToUid && typeof parsed.emailToUid === 'object' ? parsed.emailToUid : {},
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      states: parsed.states && typeof parsed.states === 'object' ? parsed.states : {},
      deviceVaults:
        parsed.deviceVaults && typeof parsed.deviceVaults === 'object' ? parsed.deviceVaults : {},
    };
  } catch {
    dbCache = createEmptyDb();
  }
  pruneExpiredSessions(dbCache);
  return dbCache;
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function pruneExpiredSessions(db: ServerDatabase): void {
  const now = Date.now();
  for (const [tokenHash, session] of Object.entries(db.sessions)) {
    if (!session || session.expiresAt <= now || !hasOwn(db.users, session.uid)) {
      delete db.sessions[tokenHash];
    }
  }
  for (const [deviceHash, vault] of Object.entries(db.deviceVaults)) {
    if (!vault || !Array.isArray(vault.entries) || now - vault.updatedAt > DEVICE_TTL_MS) {
      delete db.deviceVaults[deviceHash];
      continue;
    }
    vault.entries = vault.entries
      .filter((e) => e && typeof e.uid === 'string' && hasOwn(db.users, e.uid))
      .slice(0, MAX_QUICK_ACCOUNTS);
    if (vault.entries.length === 0) {
      delete db.deviceVaults[deviceHash];
    }
  }
}

function persistDatabase(): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    if (!dbCache) return;
    pruneExpiredSessions(dbCache);
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpFile = path.resolve(
      DATA_DIR,
      `finflow-server-db.${process.pid}.${Date.now()}.tmp`
    );
    if (!tmpFile.startsWith(DATA_DIR + path.sep)) {
      throw new Error('Invalid temp file path.');
    }
    await fs.writeFile(tmpFile, JSON.stringify(dbCache, null, 2), 'utf8');
    await fs.rename(tmpFile, DB_FILE);
  });
  return writeQueue;
}

// ============================================================================
// INPUT SANITIZATION & PAYLOAD VALIDATION
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^(DEFAULT|\d{4}-\d{2})$/;

function getTodayISOServer(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sanitizeId(raw: unknown, prefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  if (cleaned.length >= 1) return cleaned;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

function sanitizeFinancialState(raw: unknown): StoredFinancialState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;

  const usdtRaw = Number(input.usdtVndRate);
  const usdtVndRate = Number.isFinite(usdtRaw)
    ? Math.min(1000000, Math.max(1000, Math.round(usdtRaw)))
    : 25450;

  const gasSyncUrl =
    typeof input.gasSyncUrl === 'string' ? input.gasSyncUrl.trim().slice(0, 500) : '';

  const rawWallets = Array.isArray(input.wallets) ? input.wallets.slice(0, MAX_WALLETS) : [];
  const wallets: StoredWallet[] = rawWallets
    .filter((w): w is Record<string, unknown> => Boolean(w && typeof w === 'object'))
    .map((w) => {
      const type: 'CASH' | 'BANK' | 'SAVINGS' | 'INVESTMENT' =
        w.type === 'CASH' || w.type === 'SAVINGS' || w.type === 'INVESTMENT' ? w.type : 'BANK';
      const cashGroup: 'LIVING' | 'INVESTMENT' =
        w.cashGroup === 'LIVING' || w.cashGroup === 'INVESTMENT'
          ? w.cashGroup
          : type === 'INVESTMENT'
          ? 'INVESTMENT'
          : 'LIVING';
      return {
        id: sanitizeId(w.id, 'w'),
        name: String(w.name || 'Ví tiền').trim().slice(0, 80) || 'Ví tiền',
        type,
        cashGroup,
        balance: Math.max(0, Math.round(Number(w.balance) || 0)),
        note: String(w.note || '').trim().slice(0, 240),
        createdAt: Number.isFinite(Number(w.createdAt)) ? Number(w.createdAt) : Date.now(),
      };
    });

  const rawInv = Array.isArray(input.investments)
    ? input.investments.slice(0, MAX_INVESTMENTS)
    : [];
  const investments: StoredInvestment[] = rawInv
    .filter((tx): tx is Record<string, unknown> => Boolean(tx && typeof tx === 'object'))
    .map((tx) => {
      const assetType: 'VN_STOCK' | 'CRYPTO' = tx.assetType === 'CRYPTO' ? 'CRYPTO' : 'VN_STOCK';
      const symbol =
        String(tx.symbol || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 16) || 'ASSET';
      const dateStr = String(tx.date || '').slice(0, 10);
      const rawDelta = Number(tx.walletDeltaVnd);
      const rawFx = Number(tx.fxRateAtExecution);
      const fxRateAtExecution =
        assetType === 'CRYPTO' && Number.isFinite(rawFx) && rawFx >= 1000 && rawFx <= 1000000
          ? Math.round(rawFx)
          : undefined;
      return {
        id: sanitizeId(tx.id, 'inv'),
        assetType,
        symbol,
        exchange: String(tx.exchange || (assetType === 'CRYPTO' ? 'BINANCE' : 'HSX'))
          .trim()
          .slice(0, 24),
        type: (tx.type === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
        quantity: Number(tx.quantity) || 0,
        price: Number(tx.price) || 0,
        feeAmount: Math.max(0, Number(tx.feeAmount) || 0),
        date: DATE_REGEX.test(dateStr) ? dateStr : getTodayISOServer(),
        note: String(tx.note || '').trim().slice(0, 240),
        walletId: String(tx.walletId || '').slice(0, 128),
        walletDeltaVnd: Number.isFinite(rawDelta) ? Math.round(rawDelta) : 0,
        ...(fxRateAtExecution !== undefined ? { fxRateAtExecution } : {}),
        createdAt: Number.isFinite(Number(tx.createdAt)) ? Number(tx.createdAt) : Date.now(),
      };
    })
    .filter((tx) => tx.quantity > 0 && tx.price > 0);

  const rawCf = Array.isArray(input.cashflows) ? input.cashflows.slice(0, MAX_CASHFLOWS) : [];
  const cashflows: StoredCashflow[] = rawCf
    .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
    .map((c) => {
      const dateStr = String(c.date || '').slice(0, 10);
      return {
        id: sanitizeId(c.id, 'cf'),
        type: (c.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as 'INCOME' | 'EXPENSE',
        amount: Math.max(0, Math.round(Number(c.amount) || 0)),
        category: String(c.category || 'Khác').trim().slice(0, 48) || 'Khác',
        date: DATE_REGEX.test(dateStr) ? dateStr : getTodayISOServer(),
        note: String(c.note || '').trim().slice(0, 240),
        walletId: String(c.walletId || '').slice(0, 128),
        createdAt: Number.isFinite(Number(c.createdAt)) ? Number(c.createdAt) : Date.now(),
      };
    })
    .filter((c) => c.amount > 0);

  const rawBudgets = Array.isArray(input.budgets) ? input.budgets.slice(0, MAX_BUDGETS) : [];
  const budgets: StoredBudget[] = rawBudgets
    .filter((b): b is Record<string, unknown> => Boolean(b && typeof b === 'object'))
    .map((b) => {
      const monthStr = String(b.month || 'DEFAULT').trim();
      return {
        id: sanitizeId(b.id, 'b'),
        category: String(b.category || 'Ăn uống').trim().slice(0, 48) || 'Ăn uống',
        month: MONTH_REGEX.test(monthStr) ? monthStr : 'DEFAULT',
        limitAmount: Math.max(0, Math.round(Number(b.limitAmount) || 0)),
        createdAt: Number.isFinite(Number(b.createdAt)) ? Number(b.createdAt) : Date.now(),
      };
    })
    .filter((b) => b.limitAmount > 0);

  const rawTransfers = Array.isArray(input.transfers)
    ? input.transfers.slice(0, MAX_TRANSFERS)
    : [];
  const transfers: StoredCapitalTransfer[] = rawTransfers
    .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
    .map((t) => {
      const dateStr = String(t.date || '').slice(0, 10);
      return {
        id: sanitizeId(t.id, 'tr'),
        direction: (t.direction === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT') as 'DEPOSIT' | 'WITHDRAW',
        amount: Math.max(0, Math.round(Number(t.amount) || 0)),
        sourceWalletId: String(t.sourceWalletId || '').slice(0, 128),
        targetWalletId: String(t.targetWalletId || '').slice(0, 128),
        date: DATE_REGEX.test(dateStr) ? dateStr : getTodayISOServer(),
        note: String(t.note || '').trim().slice(0, 240),
        createdAt: Number.isFinite(Number(t.createdAt)) ? Number(t.createdAt) : Date.now(),
      };
    })
    .filter((t) => t.amount > 0);

  return {
    version: 3,
    usdtVndRate,
    isSampleData: Boolean(input.isSampleData),
    gasSyncUrl,
    updatedAt: Date.now(),
    wallets,
    investments,
    cashflows,
    budgets,
    transfers,
  };
}

// ============================================================================
// COOKIE & AUTH MIDDLEWARE HELPERS
// ============================================================================

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto.includes('https');
}

function buildHttpOnlyCookie(
  req: Request,
  name: string,
  value: string,
  maxAgeSec: number
): string {
  const secure = isHttpsRequest(req);
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `Max-Age=${maxAgeSec}`];
  if (secure) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

function setSessionCookie(req: Request, res: Response, rawToken: string): void {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  res.append('Set-Cookie', buildHttpOnlyCookie(req, SESSION_COOKIE_NAME, rawToken, maxAgeSec));
}

function clearSessionCookie(req: Request, res: Response): void {
  res.append('Set-Cookie', buildHttpOnlyCookie(req, SESSION_COOKIE_NAME, '', 0));
}

function setDeviceCookie(req: Request, res: Response, rawDeviceToken: string): void {
  const maxAgeSec = Math.floor(DEVICE_TTL_MS / 1000);
  res.append('Set-Cookie', buildHttpOnlyCookie(req, DEVICE_COOKIE_NAME, rawDeviceToken, maxAgeSec));
}

function extractDeviceToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[DEVICE_COOKIE_NAME];
  return token && token.length >= 32 ? token : null;
}

function serializeVaultAccounts(db: ServerDatabase, vault: StoredDeviceVault | undefined) {
  if (!vault || !Array.isArray(vault.entries)) return [];
  return vault.entries
    .filter((entry) => entry && hasOwn(db.users, entry.uid))
    .map((entry) => {
      const u = db.users[entry.uid];
      return {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        authProvider: 'password' as const,
        savedAt: entry.savedAt,
        lastUsedAt: entry.lastUsedAt,
      };
    })
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_QUICK_ACCOUNTS);
}

function upsertDeviceQuickAccount(
  req: Request,
  res: Response,
  db: ServerDatabase,
  uid: string
): {
  replacedQuickAccount: { uid: string; displayName: string; email: string } | null;
  quickAccounts: ReturnType<typeof serializeVaultAccounts>;
} {
  const now = Date.now();
  let rawDeviceToken = extractDeviceToken(req);
  if (!rawDeviceToken) {
    rawDeviceToken = crypto.randomBytes(32).toString('hex');
  }
  const deviceHash = sha256Hex(rawDeviceToken);
  const existingVault = hasOwn(db.deviceVaults, deviceHash)
    ? db.deviceVaults[deviceHash]
    : { entries: [], updatedAt: now };

  // Keep only valid user entries
  const validEntries = existingVault.entries.filter((e) => e && hasOwn(db.users, e.uid));
  const foundIdx = validEntries.findIndex((e) => e.uid === uid);

  let replacedQuickAccount: { uid: string; displayName: string; email: string } | null = null;
  if (foundIdx >= 0) {
    validEntries[foundIdx] = {
      ...validEntries[foundIdx],
      lastUsedAt: now,
    };
  } else {
    if (validEntries.length >= MAX_QUICK_ACCOUNTS) {
      validEntries.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
      const evicted = validEntries.shift();
      if (evicted && hasOwn(db.users, evicted.uid)) {
        const evictedUser = db.users[evicted.uid];
        replacedQuickAccount = {
          uid: evictedUser.uid,
          displayName: evictedUser.displayName,
          email: evictedUser.email,
        };
      }
    }
    validEntries.push({
      uid,
      savedAt: now,
      lastUsedAt: now,
    });
  }

  const nextVault: StoredDeviceVault = {
    entries: validEntries.sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, MAX_QUICK_ACCOUNTS),
    updatedAt: now,
  };
  db.deviceVaults[deviceHash] = nextVault;
  setDeviceCookie(req, res, rawDeviceToken);

  return {
    replacedQuickAccount,
    quickAccounts: serializeVaultAccounts(db, nextVault),
  };
}

function extractRawToken(req: Request): { token: string | null; viaCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length >= 32) {
      return { token, viaCookie: false };
    }
  }
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken && cookieToken.length >= 32) {
    return { token: cookieToken, viaCookie: true };
  }
  return { token: null, viaCookie: false };
}

function hasValidCsrfGuard(req: Request): boolean {
  if (String(req.headers['x-requested-with'] || '') === 'FinFlow') {
    return true;
  }
  const origin = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (typeof origin === 'string' && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function toPublicUser(user: StoredUser) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    authProvider: 'password' as const,
    isGuest: false,
    emailVerified: true,
  };
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { token, viaCookie } = extractRawToken(req);
  if (!token) {
    res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' });
    return;
  }

  // CSRF check for state-mutating cookie-authenticated requests
  const method = req.method.toUpperCase();
  if (viaCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !hasValidCsrfGuard(req)) {
    res.status(403).json({ error: 'Yêu cầu không hợp lệ (thiếu xác thực nguồn gốc).' });
    return;
  }

  const db = await loadDatabase();
  const tokenHash = sha256Hex(token);
  const session = hasOwn(db.sessions, tokenHash) ? db.sessions[tokenHash] : undefined;
  if (!session || session.expiresAt <= Date.now()) {
    if (session) {
      delete db.sessions[tokenHash];
      await persistDatabase();
    }
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
    return;
  }

  const user = hasOwn(db.users, session.uid) ? db.users[session.uid] : undefined;
  if (!user) {
    delete db.sessions[tokenHash];
    await persistDatabase();
    res.status(401).json({ error: 'Tài khoản không còn tồn tại.' });
    return;
  }

  req.authUser = user;
  req.authTokenHash = tokenHash;
  next();
}

// ============================================================================
// EXPRESS SERVER BOOTSTRAP
// ============================================================================

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Baseline security headers (no X-Frame-Options so the app can still be previewed in an iframe)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production' && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Health check for load balancers / Cloud Run
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(express.json({ limit: '1mb' }));

  // Ensure API responses are never cached by intermediaries
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // --- POST /api/auth/register ---
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      if (!hasValidCsrfGuard(req)) {
        res.status(403).json({ error: 'Yêu cầu đăng ký không hợp lệ.' });
        return;
      }

      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`reg:${clientIp}`, 20)) {
        res.status(429).json({ error: 'Thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.' });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const rawPassword = typeof body?.password === 'string' ? body.password : '';
      const rawName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';

      if (!rawEmail || rawEmail.length > 160 || !EMAIL_REGEX.test(rawEmail)) {
        res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ.' });
        return;
      }
      if (rawPassword.length < 6 || rawPassword.length > 128) {
        res.status(400).json({ error: 'Mật khẩu cần từ 6 đến 128 ký tự.' });
        return;
      }

      const db = await loadDatabase();
      if (hasOwn(db.emailToUid, rawEmail)) {
        res
          .status(409)
          .json({ error: 'Email này đã được đăng ký. Vui lòng chuyển sang tab "Đăng nhập".' });
        return;
      }

      const uid = `srv_${crypto.randomUUID().replace(/-/g, '')}`;
      const displayName = (rawName || rawEmail.split('@')[0] || 'Người dùng').slice(0, 80);
      const { salt, hash } = await createPasswordRecord(rawPassword);
      const now = Date.now();

      const newUser: StoredUser = {
        uid,
        email: rawEmail,
        displayName,
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: now,
        updatedAt: now,
      };

      const initialState = sanitizeFinancialState(body?.initialState);
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256Hex(rawToken);

      db.users[uid] = newUser;
      db.emailToUid[rawEmail] = uid;
      if (initialState) {
        db.states[uid] = initialState;
      }
      db.sessions[tokenHash] = {
        tokenHash,
        uid,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
      };

      const { replacedQuickAccount, quickAccounts } = upsertDeviceQuickAccount(req, res, db, uid);
      await persistDatabase();
      setSessionCookie(req, res, rawToken);

      res.status(201).json({
        user: toPublicUser(newUser),
        token: rawToken,
        state: db.states[uid] || null,
        replacedQuickAccount,
        quickAccounts,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.' });
    }
  });

  // --- POST /api/auth/login ---
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      if (!hasValidCsrfGuard(req)) {
        res.status(403).json({ error: 'Yêu cầu đăng nhập không hợp lệ.' });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const rawPassword = typeof body?.password === 'string' ? body.password : '';

      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`login:${clientIp}:${rawEmail}`, 25)) {
        res.status(429).json({ error: 'Thử đăng nhập quá nhiều lần. Vui lòng đợi ít phút.' });
        return;
      }

      if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || !rawPassword) {
        res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
        return;
      }

      const db = await loadDatabase();
      const uid = hasOwn(db.emailToUid, rawEmail) ? db.emailToUid[rawEmail] : undefined;
      const user = uid && hasOwn(db.users, uid) ? db.users[uid] : undefined;

      if (!user) {
        // Constant-time dummy scrypt to reduce email enumeration timing signals
        await hashPasswordScrypt(rawPassword, '00000000000000000000000000000000');
        res.status(401).json({ error: 'Email hoặc mật khẩu chưa chính xác.' });
        return;
      }

      const valid = await verifyPassword(rawPassword, user.passwordSalt, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Email hoặc mật khẩu chưa chính xác.' });
        return;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256Hex(rawToken);
      const now = Date.now();

      db.sessions[tokenHash] = {
        tokenHash,
        uid: user.uid,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
      };
      const { replacedQuickAccount, quickAccounts } = upsertDeviceQuickAccount(
        req,
        res,
        db,
        user.uid
      );
      await persistDatabase();
      setSessionCookie(req, res, rawToken);

      res.json({
        user: toPublicUser(user),
        token: rawToken,
        state: db.states[user.uid] || null,
        replacedQuickAccount,
        quickAccounts,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Không thể đăng nhập lúc này. Vui lòng thử lại.' });
    }
  });

  // --- GET /api/auth/quick-accounts ---
  app.get('/api/auth/quick-accounts', async (req: Request, res: Response) => {
    try {
      const rawDeviceToken = extractDeviceToken(req);
      if (!rawDeviceToken) {
        res.json({ accounts: [] });
        return;
      }
      const db = await loadDatabase();
      const deviceHash = sha256Hex(rawDeviceToken);
      const vault = hasOwn(db.deviceVaults, deviceHash) ? db.deviceVaults[deviceHash] : undefined;
      res.json({ accounts: serializeVaultAccounts(db, vault) });
    } catch (err) {
      console.error('Quick accounts read error:', err);
      res.status(500).json({ error: 'Không thể tải danh sách tài khoản đăng nhập nhanh.' });
    }
  });

  // --- POST /api/auth/quick-login ---
  app.post('/api/auth/quick-login', async (req: Request, res: Response) => {
    try {
      if (!hasValidCsrfGuard(req)) {
        res.status(403).json({ error: 'Yêu cầu đăng nhập nhanh không hợp lệ.' });
        return;
      }

      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`quicklogin:${clientIp}`, 40)) {
        res.status(429).json({ error: 'Thử quá nhiều lần. Vui lòng đợi ít phút.' });
        return;
      }

      const rawDeviceToken = extractDeviceToken(req);
      if (!rawDeviceToken) {
        res.status(401).json({ error: 'Không tìm thấy phiên đăng nhập nhanh trên thiết bị này.' });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const targetUid = typeof body?.uid === 'string' ? body.uid.trim() : '';
      if (!targetUid || targetUid.length > 120) {
        res.status(400).json({ error: 'Tài khoản đăng nhập nhanh không hợp lệ.' });
        return;
      }

      const db = await loadDatabase();
      const deviceHash = sha256Hex(rawDeviceToken);
      const vault = hasOwn(db.deviceVaults, deviceHash) ? db.deviceVaults[deviceHash] : undefined;
      const entry = vault?.entries.find((e) => e.uid === targetUid);
      const user = entry && hasOwn(db.users, targetUid) ? db.users[targetUid] : undefined;
      if (!entry || !user) {
        res.status(401).json({
          error: 'Tài khoản này không còn nằm trong danh sách đăng nhập nhanh. Vui lòng đăng nhập lại bằng mật khẩu.',
        });
        return;
      }

      const now = Date.now();
      entry.lastUsedAt = now;
      vault!.updatedAt = now;

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256Hex(rawToken);
      db.sessions[tokenHash] = {
        tokenHash,
        uid: user.uid,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
      };

      await persistDatabase();
      setDeviceCookie(req, res, rawDeviceToken);
      setSessionCookie(req, res, rawToken);

      res.json({
        user: toPublicUser(user),
        token: rawToken,
        state: hasOwn(db.states, user.uid) ? db.states[user.uid] : null,
        quickAccounts: serializeVaultAccounts(db, vault),
      });
    } catch (err) {
      console.error('Quick login error:', err);
      res.status(500).json({ error: 'Không thể đăng nhập nhanh lúc này.' });
    }
  });

  // --- DELETE /api/auth/quick-accounts/:uid ---
  app.delete('/api/auth/quick-accounts/:uid', async (req: Request, res: Response) => {
    try {
      if (!hasValidCsrfGuard(req)) {
        res.status(403).json({ error: 'Yêu cầu xóa tài khoản đăng nhập nhanh không hợp lệ.' });
        return;
      }
      const rawDeviceToken = extractDeviceToken(req);
      if (!rawDeviceToken) {
        res.json({ ok: true, accounts: [] });
        return;
      }
      const targetUid = typeof req.params.uid === 'string' ? req.params.uid.trim() : '';
      const db = await loadDatabase();
      const deviceHash = sha256Hex(rawDeviceToken);
      const vault = hasOwn(db.deviceVaults, deviceHash) ? db.deviceVaults[deviceHash] : undefined;
      if (vault) {
        vault.entries = vault.entries.filter((e) => e.uid !== targetUid);
        vault.updatedAt = Date.now();
        if (vault.entries.length === 0) {
          delete db.deviceVaults[deviceHash];
        }
        await persistDatabase();
      }
      res.json({ ok: true, accounts: serializeVaultAccounts(db, db.deviceVaults[deviceHash]) });
    } catch (err) {
      console.error('Remove quick account error:', err);
      res.status(500).json({ error: 'Không thể gỡ tài khoản khỏi danh sách đăng nhập nhanh.' });
    }
  });

  // --- GET /api/auth/me ---
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const { token } = extractRawToken(req);
      if (!token) {
        res.json({ user: null });
        return;
      }

      const db = await loadDatabase();
      const tokenHash = sha256Hex(token);
      const session = hasOwn(db.sessions, tokenHash) ? db.sessions[tokenHash] : undefined;
      if (!session || session.expiresAt <= Date.now()) {
        res.json({ user: null });
        return;
      }

      const user = hasOwn(db.users, session.uid) ? db.users[session.uid] : undefined;
      if (!user) {
        res.json({ user: null });
        return;
      }

      res.json({
        user: toPublicUser(user),
        state: hasOwn(db.states, user.uid) ? db.states[user.uid] : null,
      });
    } catch (err) {
      console.error('Session check error:', err);
      res.status(500).json({ error: 'Không thể kiểm tra phiên đăng nhập.' });
    }
  });

  // --- POST /api/auth/logout ---
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      if (!hasValidCsrfGuard(req)) {
        res.status(403).json({ error: 'Yêu cầu đăng xuất không hợp lệ.' });
        return;
      }
      const { token } = extractRawToken(req);
      if (token) {
        const db = await loadDatabase();
        const tokenHash = sha256Hex(token);
        if (hasOwn(db.sessions, tokenHash)) {
          delete db.sessions[tokenHash];
          await persistDatabase();
        }
      }
      clearSessionCookie(req, res);
      res.json({ ok: true });
    } catch (err) {
      console.error('Logout error:', err);
      clearSessionCookie(req, res);
      res.json({ ok: true });
    }
  });

  // --- PATCH /api/auth/profile ---
  app.patch('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = req.body as Record<string, unknown>;
      const nextName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
      if (!nextName || nextName.length > 80) {
        res.status(400).json({ error: 'Tên hiển thị cần từ 1 đến 80 ký tự.' });
        return;
      }

      const db = await loadDatabase();
      const target = db.users[user.uid];
      if (!target) {
        res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
        return;
      }

      target.displayName = nextName;
      target.updatedAt = Date.now();
      await persistDatabase();

      res.json({ user: toPublicUser(target) });
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Không thể cập nhật tên hiển thị.' });
    }
  });

  // --- POST /api/auth/password ---
  app.post('/api/auth/password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = req.body as Record<string, unknown>;
      const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

      if (!currentPassword) {
        res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại.' });
        return;
      }
      if (newPassword.length < 6 || newPassword.length > 128) {
        res.status(400).json({ error: 'Mật khẩu mới cần từ 6 đến 128 ký tự.' });
        return;
      }

      const db = await loadDatabase();
      const target = db.users[user.uid];
      if (!target) {
        res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
        return;
      }

      const valid = await verifyPassword(currentPassword, target.passwordSalt, target.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Mật khẩu hiện tại chưa chính xác.' });
        return;
      }

      const { salt, hash } = await createPasswordRecord(newPassword);
      target.passwordSalt = salt;
      target.passwordHash = hash;
      target.updatedAt = Date.now();

      // Revoke all other sessions and remove quick-login slots on other devices
      for (const [hashKey, sess] of Object.entries(db.sessions)) {
        if (sess.uid === user.uid && hashKey !== req.authTokenHash) {
          delete db.sessions[hashKey];
        }
      }
      const callerDeviceToken = extractDeviceToken(req);
      const callerDeviceHash = callerDeviceToken ? sha256Hex(callerDeviceToken) : null;
      for (const [devHash, vault] of Object.entries(db.deviceVaults)) {
        if (devHash === callerDeviceHash) continue;
        vault.entries = vault.entries.filter((e) => e.uid !== user.uid);
        if (vault.entries.length === 0) {
          delete db.deviceVaults[devHash];
        }
      }

      await persistDatabase();
      res.json({ ok: true });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Không thể đổi mật khẩu lúc này.' });
    }
  });

  // --- GET /api/finance/state ---
  app.get('/api/finance/state', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const db = await loadDatabase();
      res.json({ state: db.states[user.uid] || null });
    } catch (err) {
      console.error('Read state error:', err);
      res.status(500).json({ error: 'Không thể tải dữ liệu tài chính.' });
    }
  });

  // --- GET /api/market/vn-quote?symbol=FPT ---
  app.get('/api/market/vn-quote', async (req: Request, res: Response) => {
    try {
      const clientIp = req.ip || 'unknown';
      if (!checkRateLimit(`vnquote:${clientIp}`, 180, 60 * 1000)) {
        res.status(429).json({ error: 'Quá nhiều yêu cầu cập nhật giá. Vui lòng thử lại sau ít giây.' });
        return;
      }

      const rawSymbol = typeof req.query.symbol === 'string' ? req.query.symbol.toUpperCase().trim() : '';
      if (!VN_TICKER_REGEX.test(rawSymbol)) {
        res.status(400).json({ error: 'Mã chứng khoán không hợp lệ.' });
        return;
      }

      const forceRefresh = req.query.force === '1' || req.query.force === 'true';
      const now = Date.now();
      const cached = vnQuoteServerCache.get(rawSymbol);
      if (!forceRefresh && cached && now - cached.cachedAt < VN_QUOTE_CACHE_TTL_MS) {
        res.json({
          symbol: cached.symbol,
          price: cached.price,
          refPrice: cached.refPrice,
          source: cached.source,
          updatedAt: cached.updatedAt,
          cached: true,
        });
        return;
      }

      const fresh = await fetchVnQuoteFromUpstream(rawSymbol);
      if (!fresh) {
        if (cached) {
          res.json({
            symbol: cached.symbol,
            price: cached.price,
            refPrice: cached.refPrice,
            source: cached.source,
            updatedAt: cached.updatedAt,
            cached: true,
          });
          return;
        }
        res.status(502).json({ error: 'Không thể lấy giá thị trường từ DNSE/VNDirect lúc này.' });
        return;
      }

      if (vnQuoteServerCache.size >= MAX_VN_QUOTE_CACHE) {
        const oldestKey = vnQuoteServerCache.keys().next().value;
        if (oldestKey) vnQuoteServerCache.delete(oldestKey);
      }
      vnQuoteServerCache.set(rawSymbol, fresh);

      res.json({
        symbol: fresh.symbol,
        price: fresh.price,
        refPrice: fresh.refPrice,
        source: fresh.source,
        updatedAt: fresh.updatedAt,
        cached: false,
      });
    } catch (err) {
      console.error('VN quote proxy error:', err);
      res.status(500).json({ error: 'Lỗi máy chủ khi truy vấn giá cổ phiếu.' });
    }
  });

  // --- PUT /api/finance/state (Optimistic Concurrency Control via expectedUpdatedAt) ---
  app.put('/api/finance/state', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = req.body as Record<string, unknown> | null;
      const sanitized = sanitizeFinancialState(body);
      if (!sanitized) {
        res.status(400).json({ error: 'Dữ liệu tài chính không hợp lệ.' });
        return;
      }

      const db = await loadDatabase();
      const existing = hasOwn(db.states, user.uid) ? db.states[user.uid] : undefined;
      const forceOverwrite = Boolean(body && body.forceOverwrite === true);
      const rawExpected = body?.expectedUpdatedAt;
      const hasExpected =
        rawExpected !== undefined &&
        rawExpected !== null &&
        Number.isFinite(Number(rawExpected)) &&
        Number(rawExpected) > 0;

      if (existing && !forceOverwrite && hasExpected && Number(rawExpected) !== Number(existing.updatedAt)) {
        res.status(409).json({
          code: 'STATE_CONFLICT',
          error: 'Dữ liệu trên máy chủ đã được cập nhật từ tab hoặc thiết bị khác.',
          serverUpdatedAt: existing.updatedAt,
          serverState: existing,
        });
        return;
      }

      sanitized.updatedAt = Math.max(Date.now(), (existing?.updatedAt || 0) + 1);
      db.states[user.uid] = sanitized;
      await persistDatabase();

      res.json({ ok: true, updatedAt: sanitized.updatedAt });
    } catch (err) {
      console.error('Save state error:', err);
      res.status(500).json({ error: 'Không thể lưu dữ liệu tài chính lên máy chủ.' });
    }
  });

  // JSON 404 for unknown /api routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Không tìm thấy API yêu cầu.' });
  });

  // ==========================================================================
  // FRONTEND SERVING (VITE MIDDLEWARE IN DEV / STATIC DIST IN PROD)
  // ==========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinFlow server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FinFlow server:', err);
  process.exit(1);
});
