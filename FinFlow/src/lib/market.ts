import { DEFAULT_VN_PRICES, type MarketQuote } from '../types/finance';
import { getTimeNowStr, normalizeVnPriceToFullVND } from './accounting';

const VN_PRICE_CACHE_TTL_MS = 60 * 1000;
const vnPriceMemoryCache = new Map<string, { cachedAt: number; data: MarketQuote }>();

export async function fetchWithTimeout(
  url: string,
  timeoutMs = 5000,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getVnDateKey(unixSec: number): string {
  const d = new Date((Number(unixSec) + 7 * 3600) * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

interface CandlePayload {
  c?: number[];
  o?: number[];
  t?: number[];
}

function extractVnCandlePrice(
  dayJson: CandlePayload | null,
  minJson: CandlePayload | null
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
    const sameDay = getVnDateKey(latestSec) === getVnDateKey(dayT[lastD]);
    rawRef = sameDay ? (lastD >= 1 ? dayC[lastD - 1] : dayO[lastD] || rawCur) : dayC[lastD];
  }

  const price = normalizeVnPriceToFullVND(rawCur);
  const refPrice = normalizeVnPriceToFullVND(rawRef) || price;
  return price > 0 ? { price, refPrice } : null;
}

export async function fetchVnStockQuoteWithCache(
  symbol: string,
  forceRefresh = false
): Promise<MarketQuote> {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  if (!sym) {
    return { symbol: '', price: 0, refPrice: 0, source: 'THAM CHIẾU', updatedAt: getTimeNowStr() };
  }
  const cached = vnPriceMemoryCache.get(sym);
  if (!forceRefresh && cached && Date.now() - cached.cachedAt < VN_PRICE_CACHE_TTL_MS) {
    return cached.data;
  }

  // Primary: Same-origin FinFlow server proxy (eliminates browser CORS issues + 60s shared cache)
  try {
    const proxyUrl = `/api/market/vn-quote?symbol=${encodeURIComponent(sym)}${
      forceRefresh ? '&force=1' : ''
    }`;
    const proxyRes = await fetchWithTimeout(proxyUrl, 6000);
    if (proxyRes.ok) {
      const json = (await proxyRes.json()) as Partial<MarketQuote>;
      const price = Number(json?.price) || 0;
      const refPrice = Number(json?.refPrice) || price;
      if (price > 0) {
        const result: MarketQuote = {
          symbol: sym,
          price,
          refPrice,
          source: String(json?.source || 'DNSE'),
          updatedAt: String(json?.updatedAt || getTimeNowStr()),
        };
        vnPriceMemoryCache.set(sym, { cachedAt: Date.now(), data: result });
        return result;
      }
    }
  } catch {
    // Fallback to direct client fetch if running without Express backend
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const fromDay = nowSec - 86400 * 14;
  const fromMin = nowSec - 86400 * 4;

  // Fallback 1: DNSE Chart API v2
  try {
    const base = 'https://services.entrade.com.vn/chart-api/v2/ohlcs/stock';
    const [dayRes, minRes] = await Promise.all([
      fetchWithTimeout(`${base}?symbol=${sym}&resolution=1D&from=${fromDay}&to=${nowSec}`, 5000),
      fetchWithTimeout(`${base}?symbol=${sym}&resolution=1&from=${fromMin}&to=${nowSec}`, 5000).catch(
        () => null
      ),
    ]);
    const dayJson = dayRes?.ok ? ((await dayRes.json()) as CandlePayload) : null;
    const minJson = minRes?.ok ? ((await minRes.json()) as CandlePayload) : null;
    const parsed = extractVnCandlePrice(dayJson, minJson);
    if (parsed) {
      const result: MarketQuote = {
        symbol: sym,
        price: parsed.price,
        refPrice: parsed.refPrice,
        source: 'DNSE',
        updatedAt: getTimeNowStr(),
      };
      vnPriceMemoryCache.set(sym, { cachedAt: Date.now(), data: result });
      return result;
    }
  } catch {
    // Fallback to VNDirect
  }

  // Source 2: VNDirect DChart API
  try {
    const res = await fetchWithTimeout(
      `https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=${sym}&from=${fromDay}&to=${nowSec}`,
      5000
    );
    if (res.ok) {
      const json = (await res.json()) as CandlePayload;
      const parsed = extractVnCandlePrice(json, null);
      if (parsed) {
        const result: MarketQuote = {
          symbol: sym,
          price: parsed.price,
          refPrice: parsed.refPrice,
          source: 'VNDIRECT',
          updatedAt: getTimeNowStr(),
        };
        vnPriceMemoryCache.set(sym, { cachedAt: Date.now(), data: result });
        return result;
      }
    }
  } catch {
    // Fallback to offline reference
  }

  const fallback = DEFAULT_VN_PRICES[sym];
  return {
    symbol: sym,
    price: fallback?.price || 0,
    refPrice: fallback?.refPrice || fallback?.price || 0,
    source: 'THAM CHIẾU',
    updatedAt: getTimeNowStr(),
  };
}

export async function fetchCryptoQuotesRest(
  symbols: string[]
): Promise<Record<string, MarketQuote>> {
  const updates: Record<string, MarketQuote> = {};
  if (symbols.length === 0) return updates;
  try {
    const pairs = symbols.map((s) => `${s}USDT`);
    const res = await fetchWithTimeout(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`,
      5000
    );
    if (!res.ok) return updates;
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : [raw];
    arr.forEach((item: { symbol?: string; lastPrice?: string; openPrice?: string }) => {
      if (!item?.symbol?.endsWith('USDT')) return;
      const sym = item.symbol.replace('USDT', '');
      const p = parseFloat(item.lastPrice || '0');
      const o = parseFloat(item.openPrice || '0');
      if (p > 0) {
        updates[`CRYPTO:${sym}`] = {
          symbol: sym,
          price: p,
          refPrice: o > 0 ? o : p,
          source: 'BINANCE',
          updatedAt: getTimeNowStr(),
        };
      }
    });
  } catch {
    // Keep reference or WS
  }
  return updates;
}
