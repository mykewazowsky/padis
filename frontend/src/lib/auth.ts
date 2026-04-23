export const TOKEN_KEY = "padis_token";

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export type TokenPayload = {
  sub?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  exp?: number;
};

/**
 * Parse JWT payload client-side (no signature verification).
 * Returns null if token is missing, malformed, or expired.
 */
export function decodeToken(): TokenPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // base64url → base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload: TokenPayload = JSON.parse(atob(base64));

    // Reject expired tokens
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}