"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPinned,
  ShieldCheck,
} from "lucide-react";

import { buildApiUrl } from "../../../lib/api";
import { getToken, saveToken, clearToken } from "../../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = useMemo(() => {
    const redirect = searchParams.get("redirect");
    return redirect && redirect.startsWith("/") ? redirect : "/dashboard";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setCheckingAuth(false);
      return;
    }

    fetch(buildApiUrl("/api/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Token tidak valid");
        }
        return res.json();
      })
      .then(() => {
        router.replace(redirectTo);
      })
      .catch(() => {
        clearToken();
        setCheckingAuth(false);
      });
  }, [router, redirectTo]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(buildApiUrl("/api/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || "Login gagal");
      }

      saveToken(json.token);
      router.replace(redirectTo);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[var(--color-primary-soft)] via-white to-[var(--color-secondary-soft)]">
        <div className="section-container flex min-h-screen items-center justify-center py-10">
          <div
            className="card card-elevated w-full max-w-md p-8 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)]">
              <div
                className="h-7 w-7 animate-spin rounded-full border-[3px] border-gray-200 border-t-[var(--color-primary)]"
                aria-hidden="true"
              />
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              Memeriksa sesi login
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              PADIS sedang memastikan status autentikasi Anda.
            </p>

            <span className="sr-only">Sedang memeriksa sesi login</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--color-primary-soft)] via-white to-[var(--color-secondary-soft)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="section-gradient-primary relative hidden overflow-hidden lg:flex">
          <div className="hero-grid-overlay" />
          <div className="hero-orb hero-orb-secondary right-[-80px] top-[80px] h-56 w-56" />
          <div className="hero-orb hero-orb-primary bottom-[-60px] left-[-40px] h-48 w-48" />

          <div className="relative flex w-full flex-col justify-between px-10 py-12 text-white xl:px-14">
            <div>
              <span className="badge badge-secondary">PADIS ACCESS</span>

              <h1 className="mt-5 text-4xl font-bold tracking-tight leading-tight xl:text-5xl">
                Akses dashboard
                <br />
                risiko kerugian padi
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-blue-100 xl:text-base">
                Login untuk mengeksplorasi hasil analisis risiko, melihat peta
                interaktif, membandingkan climate dan non-climate, serta
                mengunduh output PADIS secara lebih lengkap.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white/15 p-2">
                      <MapPinned className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        WebGIS Interaktif
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-100">
                        Visualisasi spasial loss dan AAL per kabupaten/kota.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white/15 p-2">
                      <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Akses Terkelola
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-100">
                        Sistem login untuk kontrol fitur data, report, dan admin.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-blue-100/80">
                © 2026 PADIS. All rights reserved.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="card card-elevated p-8 md:p-9">
              <div className="mb-8">
                <span className="badge badge-primary">LOGIN</span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
                  Masuk ke PADIS
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Gunakan akun Anda untuk mengakses dashboard, mengunduh CSV,
                  dan menggunakan fitur report PADIS.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="input-label">Email</label>
                  <div className="input-shell flex items-center gap-3 px-4 py-3">
                    <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                    <input
                      type="email"
                      className="w-full border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-0"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Masukkan email"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="input-label mb-0">Password</label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-[var(--color-primary)] transition hover:underline"
                    >
                      Lupa password?
                    </Link>
                  </div>

                  <div className="input-shell flex items-center gap-3 px-4 py-3">
                    <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-0"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-gray-400 transition hover:text-gray-700"
                      aria-label={
                        showPassword
                          ? "Sembunyikan password"
                          : "Tampilkan password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Memproses..." : "Login"}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke Beranda
                </Link>

                <Link
                  href="/register"
                  className="font-medium text-[var(--color-primary)] transition hover:underline"
                >
                  Daftar akun
                </Link>
              </div>

              <div className="mt-4 text-center text-sm text-gray-500">
                Ingin tahu lebih lanjut tentang PADIS?{" "}
                <Link
                  href="/cara-kerja"
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  Lihat Cara Kerja PADIS
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}