import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Cara Kerja",
  description:
    "Pelajari cara PADIS mengolah data hazard banjir dan kekeringan menjadi estimasi kerugian ekonomi, Average Annual Loss (AAL), dan luaran spasial untuk analisis risiko wilayah padi.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
