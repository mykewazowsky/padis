import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Only bundle the exports actually imported from these packages,
    // instead of pulling in the entire library on every page.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@supabase/supabase-js",
    ],
  },
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
