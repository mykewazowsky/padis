import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Metadata } from "next";
import { Figtree } from "next/font/google";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "PADIS - Paddy Disaster Information System",
  description: "Paddy Disaster Information System",
  icons: {
    icon: "/logo/padis.svg",
    apple: "/logo/padis.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/logo/padis.svg" type="image/svg+xml" />
      </head>
      <body className={`${figtree.className} min-h-screen bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}