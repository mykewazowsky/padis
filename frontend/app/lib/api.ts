export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000";

export function buildApiUrl(path: string) {
  if (!path.startsWith("/")) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}