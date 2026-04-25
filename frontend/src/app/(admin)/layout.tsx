import { notFound } from "next/navigation";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminShell from "../../components/admin/AdminShell";

// Admin panel dinonaktifkan saat NEXT_PUBLIC_ENABLE_ADMIN !== "true".
// Set di .env.local untuk penggunaan lokal:
//   NEXT_PUBLIC_ENABLE_ADMIN=true
// Jangan set variabel ini di Vercel agar /admin routes mengembalikan 404.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NEXT_PUBLIC_ENABLE_ADMIN !== "true") {
    notFound();
  }

  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
