"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { buildApiUrl } from "../../../lib/api";

/* ── Password strength ─────────────────────────────────── */
type Strength = "weak" | "medium" | "strong";

function getPasswordStrength(pw: string): Strength | null {
  if (!pw) return null;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  const score = [pw.length >= 8, hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

const STRENGTH_META: Record<Strength, { label: string; color: string; bars: number }> = {
  weak:   { label: "Lemah",  color: "#ef4444", bars: 1 },
  medium: { label: "Sedang", color: "#f59e0b", bars: 2 },
  strong: { label: "Kuat",   color: "#22c55e", bars: 3 },
};

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!strength) return null;
  const meta = STRENGTH_META[strength];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= meta.bars ? meta.color : "var(--auth-input-border)",
            }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: meta.color }}>
        Kekuatan password: <span className="font-semibold">{meta.label}</span>
      </p>
    </div>
  );
}

/* ── Inner component (needs Suspense for useSearchParams) ── */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  function validateForm() {
    if (!token) return "Token reset password tidak ditemukan atau tidak valid.";
    if (!password) return "Password baru wajib diisi.";
    if (password.length < 8) return "Password baru minimal 8 karakter.";
    if (!confirmPassword) return "Konfirmasi password wajib diisi.";
    if (password !== confirmPassword)
      return "Password dan konfirmasi password tidak sama.";
    return "";
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(buildApiUrl("/api/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || "Reset password gagal.");
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2200);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page-gradient min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* Hero */}
        <section className="auth-hero-gradient relative hidden overflow-hidden lg:flex">
          <div className="auth-hero-overlay" />
          <div className="hero-grid-overlay" />
          <div className="hero-orb hero-orb-secondary right-[-80px] top-[80px] h-56 w-56" />
          <div className="hero-orb hero-orb-primary bottom-[-60px] left-[-40px] h-48 w-48" />

          <div className="relative flex w-full flex-col justify-between px-10 py-12 text-white xl:px-14">
            <div>
              <span className="badge badge-secondary">RESET PASSWORD</span>

              <h1 className="mt-5 text-4xl font-bold tracking-tight leading-tight xl:text-5xl">
                Tetapkan password
                <br />
                baru untuk akun
                <br />
                PADIS
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--auth-hero-muted)] xl:text-base">
                Gunakan halaman ini untuk menyelesaikan proses pemulihan akun.
                Setelah password diperbarui, Anda dapat kembali login ke PADIS
                menggunakan kredensial baru.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[var(--auth-hero-icon-bg)] p-2">
                      <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Token Sekali Pakai</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        Tautan reset hanya berlaku terbatas dan akan
                        dinonaktifkan setelah password diperbarui.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[var(--auth-hero-icon-bg)] p-2">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Akses Kembali ke Sistem</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        Setelah berhasil, Anda dapat kembali mengakses fitur
                        dashboard dan analisis PADIS.
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

        {/* Form section */}
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="card card-elevated p-8 md:p-9">

              {/* No token */}
              {!token && (
                <div className="space-y-5">
                  <div className="mb-2">
                    <span className="badge badge-primary">RESET PASSWORD</span>
                  </div>
                  <div className="rounded-2xl border px-4 py-3 text-sm text-[var(--auth-alert-danger-text)] [background:var(--auth-alert-danger-bg)] [border-color:var(--auth-alert-danger-border)]">
                    Token reset password tidak ditemukan. Silakan ulangi proses
                    lupa password.
                  </div>
                  <div className="surface-soft p-4">
                    <p className="text-sm text-[var(--auth-text-muted)]">
                      Pastikan Anda membuka halaman reset dari tautan yang
                      dikirim sistem ke email Anda.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href="/forgot-password"
                      className="inline-flex items-center gap-2 text-[var(--color-primary)] transition hover:underline"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Minta tautan baru
                    </Link>
                    <Link
                      href="/login"
                      className="text-[var(--auth-link-muted)] transition hover:text-[var(--auth-text)]"
                    >
                      Kembali ke Login
                    </Link>
                  </div>
                </div>
              )}

              {/* Success state */}
              {token && success && (
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-4 ring-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <span className="badge badge-primary mb-3">BERHASIL</span>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--auth-text)]">
                    Password diperbarui!
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                    Password baru Anda telah tersimpan. Anda akan diarahkan ke
                    halaman login secara otomatis.
                  </p>
                  <Link
                    href="/login"
                    className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
                  >
                    Login Sekarang
                  </Link>
                </div>
              )}

              {/* Form */}
              {token && !success && (
                <>
                  <div className="mb-8">
                    <span className="badge badge-primary">NEW PASSWORD</span>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--auth-text)]">
                      Reset password
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                      Buat password baru yang kuat untuk akun PADIS Anda.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Password field */}
                    <div>
                      <label className="input-label">Password Baru</label>
                      <div className="input-shell flex items-center gap-3 px-4 py-3">
                        <Lock className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                        <input
                          type={showPassword ? "text" : "password"}
                          className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimal 8 karakter"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="text-[var(--auth-input-icon)] transition hover:text-[var(--auth-input-icon-hover)]"
                          aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordStrengthBar password={password} />
                    </div>

                    {/* Confirm password field */}
                    <div>
                      <label className="input-label">Konfirmasi Password Baru</label>
                      <div
                        className="input-shell flex items-center gap-3 px-4 py-3"
                        style={
                          passwordsMatch
                            ? { borderColor: "#22c55e" }
                            : passwordsMismatch
                              ? { borderColor: "#ef4444" }
                              : undefined
                        }
                      >
                        <Lock className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Ulangi password baru"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((p) => !p)}
                          className="text-[var(--auth-input-icon)] transition hover:text-[var(--auth-input-icon-hover)]"
                          aria-label={showConfirmPassword ? "Sembunyikan konfirmasi" : "Tampilkan konfirmasi"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordsMatch && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Password cocok
                        </p>
                      )}
                      {passwordsMismatch && (
                        <p className="mt-1.5 text-xs text-red-500">
                          Password tidak sama
                        </p>
                      )}
                    </div>

                    {error && (
                      <div className="rounded-2xl border px-4 py-3 text-sm text-[var(--auth-alert-danger-text)] [background:var(--auth-alert-danger-bg)] [border-color:var(--auth-alert-danger-border)]">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <KeyRound className="h-4 w-4" />
                      {loading ? "Memproses..." : "Simpan Password Baru"}
                    </button>
                  </form>

                  <div className="mt-5 surface-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--auth-text)]">
                      Tips keamanan
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                      Gunakan minimal 8 karakter dengan kombinasi huruf besar,
                      huruf kecil, angka, dan karakter khusus.
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 text-[var(--auth-link-muted)] transition hover:text-[var(--auth-text)]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Kembali ke Login
                    </Link>
                    <Link
                      href="/forgot-password"
                      className="font-medium text-[var(--color-primary)] transition hover:underline"
                    >
                      Minta token baru
                    </Link>
                  </div>
                </>
              )}

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ── Page export with Suspense boundary (required for useSearchParams) ── */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page-gradient flex min-h-screen items-center justify-center">
          <div className="text-sm text-[var(--auth-text-muted)]">Memuat...</div>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
