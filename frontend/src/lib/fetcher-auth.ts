import { buildApiUrl } from "./api";
import { clearToken, getToken } from "./auth";

type FetchWithAuthOptions = RequestInit & {
  redirectToLogin?: boolean;
};

export async function fetchWithAuth(
  path: string,
  options: FetchWithAuthOptions = {}
) {
  const token = getToken();

  if (!token) {
    if (options.redirectToLogin !== false && typeof window !== "undefined") {
      window.location.assign("/login");
    }
    throw new Error("Token tidak ditemukan");
  }

  const { redirectToLogin = true, headers, ...restOptions } = options;

  const res = await fetch(buildApiUrl(path), {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    clearToken();

    if (redirectToLogin && typeof window !== "undefined") {
      window.location.assign("/login");
    }

    throw new Error("Unauthorized");
  }

  return res;
}

export async function fetchJsonWithAuth<T = any>(
  path: string,
  options: FetchWithAuthOptions = {}
): Promise<T> {
  const res = await fetchWithAuth(path, options);

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      (json as any)?.error || `Request gagal dengan status ${res.status}`
    );
  }

  return json as T;
}