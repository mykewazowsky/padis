import "leaflet/dist/leaflet.css";
import "driver.js/dist/driver.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Preconnect to Railway backend — opens TCP+TLS before JS fires
          the first API call (fetchLatestRunId), cutting the API waterfall. */}
      <link rel="preconnect" href="https://padis-production-06a2.up.railway.app" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://padis-production-06a2.up.railway.app" />
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
