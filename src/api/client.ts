/**
 * Which person this copy of the app is logged in as. The demo shows Alex and Sam side by
 * side, each in a frame of the same app: Sam's frame is opened with `?as=sam` and keeps
 * that identity for its whole life (in-app navigation drops the query string).
 */
export type Persona = 'main' | 'partner';

function readPersona(): Persona {
  try {
    return new URLSearchParams(window.location.search).get('as') === 'sam' ? 'partner' : 'main';
  } catch {
    return 'main';
  }
}

export const persona: Persona = readPersona();

const TOKEN_KEYS: Record<Persona, string> = {
  main: 'cella.token',
  partner: 'cella.token.partner',
};
const TOKEN_KEY = TOKEN_KEYS[persona];

export const API_URL: string = import.meta.env.VITE_API_URL ?? '/cella/api';

/** Error with the HTTP status, so screens can react to 401, 404, 409... */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the session simply ends with the tab.
  }
}

/** Session of this copy of the app (Alex's, or Sam's inside the demo frames). */
export const tokenStore = {
  get: (): string | null => readKey(TOKEN_KEY),
  set: (token: string): void => writeKey(TOKEN_KEY, token),
  clear(): void {
    writeKey(TOKEN_KEY, null);
    // Leaving the demo as Alex also ends Sam's session.
    if (persona === 'main') writeKey(TOKEN_KEYS.partner, null);
  },
};

/** Token of the demo's second person (Sam), kept so the demo can show and drive his phone. */
export const partnerStore = {
  get: (): string | null => readKey(TOKEN_KEYS.partner),
  set: (token: string | null): void => writeKey(TOKEN_KEYS.partner, token),
};

let onUnauthorized: (() => void) | null = null;

/** Called once by the auth provider: a 401 anywhere logs the user out. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; token?: string } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // `token` acts as someone else (the demo drives Sam's phone); it never logs this app out.
  const token = options.token ?? (auth ? tokenStore.get() : null);
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline');
  }

  if (response.status === 401 && auth && !options.token) onUnauthorized?.();
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data: { detail?: unknown }) => (typeof data.detail === 'string' ? data.detail : ''))
      .catch(() => '');
    throw new ApiError(response.status, detail || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
