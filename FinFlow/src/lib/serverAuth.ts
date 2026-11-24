import type { FinancialStatePayload, SavedQuickAccount, UserAccount } from '../types/finance';

// Session bearer token kept strictly in JS memory (never persisted to localStorage/sessionStorage).
// Cross-reload persistence is handled by the server's HttpOnly cookie.
let inMemorySessionToken: string | null = null;

export function clearInMemoryServerToken(): void {
  inMemorySessionToken = null;
}

export class ServerStateConflictError extends Error {
  serverUpdatedAt: number;
  serverState: FinancialStatePayload;

  constructor(message: string, serverUpdatedAt: number, serverState: FinancialStatePayload) {
    super(message);
    this.name = 'ServerStateConflictError';
    this.serverUpdatedAt = serverUpdatedAt;
    this.serverState = serverState;
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'FinFlow',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  if (inMemorySessionToken) {
    headers.Authorization = `Bearer ${inMemorySessionToken}`;
  }

  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const msg =
      (obj && typeof obj.error === 'string' ? obj.error : null) ||
      `Yêu cầu thất bại (HTTP ${res.status}).`;
    if (res.status === 409 && obj?.code === 'STATE_CONFLICT' && obj.serverState) {
      throw new ServerStateConflictError(
        msg,
        Number(obj.serverUpdatedAt) || 0,
        obj.serverState as FinancialStatePayload
      );
    }
    throw new Error(msg);
  }

  return data as T;
}

export interface ReplacedQuickAccountInfo {
  uid: string;
  displayName: string;
  email: string;
}

export interface ServerAuthResult {
  user: UserAccount;
  state: FinancialStatePayload | null;
  replacedQuickAccount?: ReplacedQuickAccountInfo | null;
  quickAccounts?: SavedQuickAccount[];
}

export async function serverRegister(
  email: string,
  password: string,
  displayName: string,
  initialState: FinancialStatePayload
): Promise<ServerAuthResult> {
  const res = await apiFetch<{
    user: UserAccount;
    token?: string;
    state: FinancialStatePayload | null;
    replacedQuickAccount?: ReplacedQuickAccountInfo | null;
    quickAccounts?: SavedQuickAccount[];
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName, initialState }),
  });
  if (res.token) {
    inMemorySessionToken = res.token;
  }
  return {
    user: res.user,
    state: res.state,
    replacedQuickAccount: res.replacedQuickAccount || null,
    quickAccounts: res.quickAccounts,
  };
}

export async function serverLogin(email: string, password: string): Promise<ServerAuthResult> {
  const res = await apiFetch<{
    user: UserAccount;
    token?: string;
    state: FinancialStatePayload | null;
    replacedQuickAccount?: ReplacedQuickAccountInfo | null;
    quickAccounts?: SavedQuickAccount[];
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.token) {
    inMemorySessionToken = res.token;
  }
  return {
    user: res.user,
    state: res.state,
    replacedQuickAccount: res.replacedQuickAccount || null,
    quickAccounts: res.quickAccounts,
  };
}

export async function serverGetQuickAccounts(): Promise<SavedQuickAccount[]> {
  try {
    const res = await apiFetch<{ accounts?: SavedQuickAccount[] }>('/api/auth/quick-accounts', {
      method: 'GET',
    });
    return Array.isArray(res.accounts) ? res.accounts : [];
  } catch {
    return [];
  }
}

export async function serverQuickLogin(uid: string): Promise<ServerAuthResult> {
  const res = await apiFetch<{
    user: UserAccount;
    token?: string;
    state: FinancialStatePayload | null;
    quickAccounts?: SavedQuickAccount[];
  }>('/api/auth/quick-login', {
    method: 'POST',
    body: JSON.stringify({ uid }),
  });
  if (res.token) {
    inMemorySessionToken = res.token;
  }
  return {
    user: res.user,
    state: res.state,
    quickAccounts: res.quickAccounts,
  };
}

export async function serverRemoveQuickAccount(uid: string): Promise<SavedQuickAccount[]> {
  const res = await apiFetch<{ ok: boolean; accounts?: SavedQuickAccount[] }>(
    `/api/auth/quick-accounts/${encodeURIComponent(uid)}`,
    {
      method: 'DELETE',
    }
  );
  return Array.isArray(res.accounts) ? res.accounts : [];
}

export async function serverGetSession(): Promise<{
  user: UserAccount | null;
  state: FinancialStatePayload | null;
}> {
  try {
    const res = await apiFetch<{ user: UserAccount | null; state?: FinancialStatePayload | null }>(
      '/api/auth/me',
      { method: 'GET' }
    );
    return { user: res.user || null, state: res.state || null };
  } catch {
    return { user: null, state: null };
  }
}

export async function serverLogout(): Promise<void> {
  try {
    await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort server logout
  } finally {
    inMemorySessionToken = null;
  }
}

export async function serverUpdateDisplayName(displayName: string): Promise<UserAccount> {
  const res = await apiFetch<{ user: UserAccount }>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  return res.user;
}

export async function serverChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetch<{ ok: boolean }>('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function serverFetchFinancialState(): Promise<FinancialStatePayload | null> {
  const res = await apiFetch<{ state: FinancialStatePayload | null }>('/api/finance/state', {
    method: 'GET',
  });
  return res.state || null;
}

export async function serverSaveFinancialState(
  payload: FinancialStatePayload,
  options?: { expectedUpdatedAt?: number | null; forceOverwrite?: boolean }
): Promise<{ updatedAt: number }> {
  const bodyPayload: Record<string, unknown> = { ...payload };
  if (
    options?.expectedUpdatedAt !== undefined &&
    options?.expectedUpdatedAt !== null &&
    Number.isFinite(options.expectedUpdatedAt) &&
    options.expectedUpdatedAt > 0
  ) {
    bodyPayload.expectedUpdatedAt = options.expectedUpdatedAt;
  }
  if (options?.forceOverwrite) {
    bodyPayload.forceOverwrite = true;
  }
  const res = await apiFetch<{ ok: boolean; updatedAt?: number }>('/api/finance/state', {
    method: 'PUT',
    body: JSON.stringify(bodyPayload),
  });
  return { updatedAt: Number(res.updatedAt) || Date.now() };
}
