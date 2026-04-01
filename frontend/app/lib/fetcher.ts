import { buildApiUrl } from "./api";

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path));

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}