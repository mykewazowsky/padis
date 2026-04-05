"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { buildApiUrl } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";

type MeResponse = {
  user?: {
    id: string;
    name: string;
    email: string;
    role?: string;
    status?: string;
  } | null;
};

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function verifyAccess() {
      const token = getToken();

      if (!token) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const res = await fetch(buildApiUrl("/api/me"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          clearToken();
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!res.ok) {
          throw new Error("Gagal memverifikasi sesi");
        }

        const json: MeResponse = await res.json();
        const user = json?.user;

        if (!user) {
          clearToken();
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }

        if (user.status !== "active") {
          clearToken();
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }

        if (user.role !== "admin") {
          if (!mounted) return;
          setForbidden(true);
          setChecking(false);
          return;
        }

        if (!mounted) return;
        setForbidden(false);
        setErrorMessage("");
        setChecking(false);
      } catch (err: any) {
        if (!mounted) return;
        setErrorMessage(err?.message || "Terjadi kesalahan saat memverifikasi akses admin.");
        setChecking(false);
      }
    }

    verifyAccess();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
        <div className="card card-elevated w-full max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)]">
            <ShieldCheck className="h-7 w-7 text-[var(--color-primary)]" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Memverifikasi akses admin
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            PADIS sedang memeriksa role dan status akun Anda.
          </p>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
        <div className="card card-elevated w-full max-w-lg p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Akses admin ditolak
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Akun Anda berhasil login, tetapi tidak memiliki hak akses untuk
            membuka panel administrasi PADIS.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="btn-primary text-sm font-medium"
            >
              Kembali ke Dashboard
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn-outline text-sm font-medium"
            >
              Ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
        <div className="card card-elevated w-full max-w-lg p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Gagal memverifikasi akses admin
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {errorMessage}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary text-sm font-medium"
            >
              Coba Lagi
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn-outline text-sm font-medium"
            >
              Ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}