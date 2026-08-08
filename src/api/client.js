/**
 * The only place that knows how to talk to a backend.
 *
 * If REACT_APP_XANO_BASE is set, every call goes to Xano over HTTPS.
 * If it is not set, every call is served by the in-browser mock backend, which
 * implements the exact same routes. That means you can build and play the whole
 * game before Xano exists, then point at Xano by adding one environment variable
 * to .env — no component changes.
 *
 *   REACT_APP_XANO_BASE=https://x8ki-abcd-1234.n7.xano.io/api:cos_core
 */

import { mockRequest } from './mock/adapter';

export const XANO_BASE = process.env.REACT_APP_XANO_BASE || '';
export const USING_MOCK = !XANO_BASE;

const TOKEN_KEY = 'cos.authToken';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing — session only */
  }
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function request(method, path, body) {
  if (USING_MOCK) return mockRequest(method, path, body, getToken());

  const res = await fetch(`${XANO_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(payload?.message || `Request failed (${res.status})`, res.status, payload);
  }
  return payload;
}

export const get = (p) => request('GET', p);
export const post = (p, b) => request('POST', p, b);
export const patch = (p, b) => request('PATCH', p, b);
export const del = (p, b) => request('DELETE', p, b);
