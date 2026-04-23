const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000";

export function buildApiUrl(path: string): string {
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  return `${BASE_URL}${path}`;
}