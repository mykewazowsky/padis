import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Metadata } from "next";
import { Figtree } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PADIS_THEME_STORAGE_KEY } from "@/lib/theme";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "PADIS - Paddy Disaster Information System",
  description: "Paddy Disaster Information System",
  icons: {
    icon: "/logo/padis.svg",
    apple: "/logo/padis.svg",
  },
};

const themeInitializer = `
  (function () {
    try {
      var storedTheme = window.localStorage.getItem("${PADIS_THEME_STORAGE_KEY}");
      var theme = storedTheme === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo/padis.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className={`${figtree.className} min-h-screen bg-[var(--theme-body-bg)] text-[var(--theme-body-text)]`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
