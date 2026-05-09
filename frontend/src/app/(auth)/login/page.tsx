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
import { getErrorMessage, getResponseError } from "../../../lib/error";
import { supabase } from "../../../lib/supabase";

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "oauth_failed") {
      setError("Login dengan Google gagal atau dibatalkan. Silakan coba lagi.");
    } else if (err === "oauth_bridge_failed") {
      setError("Login Google berhasil, namun gagal membuat sesi PADIS. Silakan coba lagi.");
    }
  }, [searchParams]);

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
        throw new Error(getResponseError(json, "Login gagal"));
      }

      saveToken(json.token);
      router.replace(redirectTo);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Terjadi kesalahan"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError("Login dengan Google gagal. Silakan coba lagi.");
      setGoogleLoading(false);
    }
    // On success the browser navigates away, so no need to reset loading.
  }

  if (checkingAuth) {
    return (
      <main className="auth-page-gradient min-h-screen">
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

            <h2 className="mt-5 text-xl font-bold text-[var(--auth-text)]">
              Memeriksa sesi login
            </h2>

            <p className="mt-2 text-sm text-[var(--auth-text-muted)]">
              PADIS sedang memastikan status autentikasi Anda.
            </p>

            <span className="sr-only">Sedang memeriksa sesi login</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page-gradient min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="auth-hero-gradient relative hidden overflow-hidden lg:flex">
          <div className="auth-hero-overlay" />
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

              <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--auth-hero-muted)] xl:text-base">
                Login untuk mengeksplorasi hasil analisis risiko, melihat peta
                interaktif, membandingkan iklim dan non-iklim, serta
                mengunduh output PADIS secara lebih lengkap.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[var(--auth-hero-icon-bg)] p-2">
                      <MapPinned className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        WebGIS Interaktif
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        Visualisasi spasial loss dan AAL per kabupaten/kota.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[var(--auth-hero-icon-bg)] p-2">
                      <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Akses Terkelola
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        Sistem login untuk kontrol fitur data, report, dan admin.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[var(--auth-hero-soft)]">
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
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--auth-text)]">
                  Masuk ke PADIS
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                  Gunakan akun Anda untuk mengakses dashboard, mengunduh CSV,
                  dan menggunakan fitur report PADIS.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="input-label">Email</label>
                  <div className="input-shell flex items-center gap-3 px-4 py-3">
                    <Mail className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                    <input
                      type="email"
                      className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
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
                    <Lock className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-[var(--auth-input-icon)] transition hover:text-[var(--auth-input-icon-hover)]"
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
                  <div className="rounded-2xl border px-4 py-3 text-sm text-[var(--auth-alert-danger-text)] [background:var(--auth-alert-danger-bg)] [border-color:var(--auth-alert-danger-border)]">
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

              <div className="mt-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--auth-divider)]" />
                <span className="text-xs font-medium text-[var(--auth-text-soft)]">
                  atau lanjutkan dengan
                </span>
                <span className="h-px flex-1 bg-[var(--auth-divider)]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 [background:var(--auth-google-bg)] [border-color:var(--auth-google-border)] [color:var(--auth-google-text)] hover:[background:var(--auth-google-hover-bg)] hover:[border-color:var(--auth-google-hover-border)]"
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"
                    fill="#EA4335"
                  />
                </svg>
                {googleLoading ? "Mengarahkan ke Google..." : "Login dengan Google"}
              </button>

              <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-[var(--auth-link-muted)] transition hover:text-[var(--auth-text)]"
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

              <div className="mt-4 text-center text-sm text-[var(--auth-text-muted)]">
                Ingin tahu lebih lanjut tentang PADIS?{" "}
                <Link
                  href="/cara-kerja"
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  Lihat Cara Kerja PADIS
                </Link>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-2xl border border-[var(--auth-surface-border)] bg-[var(--auth-surface-muted)] px-4 py-3">
                <ShieldCheck
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--auth-text-soft)]"
                  aria-hidden="true"
                />
                <p className="text-[11px] leading-relaxed text-[var(--auth-text-soft)]">
                  PADIS hanya menyimpan token autentikasi di browser Anda -
                  tidak ada pelacakan atau analitik.{" "}
                  <Link
                    href="/kebijakan-privasi"
                    className="text-[var(--auth-text-muted)] hover:underline"
                  >
                    Kebijakan Privasi
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
