import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi PADIS terkait akun, autentikasi, reset password, layanan pihak ketiga, dan hak pengguna.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
