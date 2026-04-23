import { buildApiUrl } from "./api";

// =========================
// GENERIC FETCH JSON
// =========================
export async function fetchJson<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = buildApiUrl(path);

  console.log("🌐 FETCH URL =", url);

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("❌ FETCH ERROR:", res.status, text);

    throw new Error(
      `Request failed: ${res.status} ${res.statusText}`
    );
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    console.error("❌ JSON PARSE ERROR:", err);
    throw new Error("Invalid JSON response");
  }
}

// =========================
// OPTIONAL: FETCH WITH PARAMS
// =========================
export function buildQuery(params: Record<string, any>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });

  return query.toString();
}

// =========================
// OPTIONAL: HELPER GET
// =========================
export async function fetchGet<T = any>(
  path: string,
  params?: Record<string, any>
): Promise<T> {
  const query = params ? `?${buildQuery(params)}` : "";
  return fetchJson<T>(`${path}${query}`);
}