import "leaflet/dist/leaflet.css";
import "driver.js/dist/driver.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

function getBackendOrigin(): string | null {
  try {
    const url = process.env.NEXT_PUBLIC_API_BASE_URL;
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const backendOrigin = getBackendOrigin();

  return (
    <>
      {/* Preconnect to backend API so TCP+TLS is established before JS fires
          the first API call (fetchLatestRunId). Reduces the initial waterfall. */}
      {backendOrigin && (
        <>
          <link rel="preconnect" href={backendOrigin} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={backendOrigin} />
        </>
      )}
      {/* Preconnect to basemap tile servers — reduces LCP on the map. */}
      <link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://server.arcgisonline.com" />
      <link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://b.basemaps.cartocdn.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://c.basemaps.cartocdn.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://basemaps.cartocdn.com" />
      {children}
    </>
  );
}
