"use client";

import { FormEvent, useMemo, useState } from "react";
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

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function validateForm() {
    if (!token) {
      return "Token reset password tidak ditemukan atau tidak valid.";
    }

    if (!password) {
      return "Password baru wajib diisi.";
    }

    if (password.length < 8) {
      return "Password baru minimal 8 karakter.";
    }

    if (!confirmPassword) {
      return "Konfirmasi password wajib diisi.";
    }

    if (password !== confirmPassword) {
      return "Password dan konfirmasi password tidak sama.";
    }

    return "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(buildApiUrl("/api/reset-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || "Reset password gagal.");
      }

      setSuccess(
        json.message ||
          "Password berhasil diperbarui. Anda akan diarahkan ke halaman login."
      );

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 1600);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat reset password.");
    } finally {
      setLoading(false);
    }
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
              <span className="badge badge-secondary">RESET PASSWORD</span>

              <h1 className="mt-5 text-4xl font-bold tracking-tight leading-tight xl:text-5xl">
                Tetapkan password
                <br />
                baru untuk akun
                <br />
                PADIS
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-blue-100 xl:text-base">
                Gunakan halaman ini untuk menyelesaikan proses pemulihan akun.
                Setelah password diperbarui, Anda dapat kembali login ke PADIS
                menggunakan kredensial baru.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white/15 p-2">
                      <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Token Sekali Pakai
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-100">
                        Tautan reset hanya berlaku terbatas dan akan ditandai
                        selesai setelah password diperbarui.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-glass rounded-3xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white/15 p-2">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Akses Kembali ke Sistem
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-100">
                        Setelah berhasil, pengguna dapat kembali mengakses fitur
                        dashboard dan analisis PADIS.
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
                <span className="badge badge-primary">NEW PASSWORD</span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
                  Reset password
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Masukkan password baru untuk akun PADIS Anda. Pastikan password
                  cukup kuat dan mudah Anda simpan dengan aman.
                </p>
              </div>

              {!token ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Token reset password tidak ditemukan. Silakan ulangi proses
                    lupa password.
                  </div>

                  <div className="surface-soft p-4">
                    <p className="text-sm text-gray-700">
                      Pastikan Anda membuka halaman reset dari tautan yang
                      dibuat sistem.
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
                      className="text-gray-600 transition hover:text-gray-900"
                    >
                      Kembali ke Login
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="input-label">Password Baru</label>
                      <div className="input-shell flex items-center gap-3 px-4 py-3">
                        <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          className="w-full border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-0"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimal 8 karakter"
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

                    <div>
                      <label className="input-label">
                        Konfirmasi Password Baru
                      </label>
                      <div className="input-shell flex items-center gap-3 px-4 py-3">
                        <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className="w-full border-0 bg-transparent p-0 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-0"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Ulangi password baru"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                          className="text-gray-400 transition hover:text-gray-700"
                          aria-label={
                            showConfirmPassword
                              ? "Sembunyikan konfirmasi password"
                              : "Tampilkan konfirmasi password"
                          }
                        >
                          {showConfirmPassword ? (
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

                    {success ? (
                      <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{success}</span>
                        </div>
                      </div>
                    ) : null}

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
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                      Tips keamanan
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      Gunakan kombinasi huruf, angka, dan karakter khusus agar
                      password lebih aman dan tidak mudah ditebak.
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 text-gray-600 transition hover:text-gray-900"
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