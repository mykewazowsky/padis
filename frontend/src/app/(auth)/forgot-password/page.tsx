"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { buildApiUrl } from "../../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function validateForm() {
    if (!email.trim()) {
      return "Email wajib diisi.";
    }

    const emailPattern = /\S+@\S+\.\S+/;
    if (!emailPattern.test(email.trim())) {
      return "Format email tidak valid.";
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
      const res = await fetch(buildApiUrl("/api/forgot-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || "Permintaan reset password gagal.");
      }

      setSuccess(
        json.message ||
          "Jika email terdaftar, tautan reset password telah dikirim ke email."
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memproses permintaan."
      );
    } finally {
      setLoading(false);
    }
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
              <span className="badge badge-secondary">PASSWORD RECOVERY</span>

              <h1 className="mt-5 text-4xl font-bold tracking-tight leading-tight xl:text-5xl">
                Pulihkan akses
                <br />
                akun PADIS
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--auth-hero-muted)] xl:text-base">
                Masukkan email akun Anda untuk membuat tautan reset password.
                Setelah itu Anda dapat menetapkan password baru dan kembali
                mengakses dashboard PADIS.
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
                      <p className="text-sm font-semibold text-white">
                        Pemulihan Aman
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        Token reset dibuat dengan masa berlaku terbatas untuk
                        menjaga keamanan akun.
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
                      <p className="text-sm font-semibold text-white">
                        Dikirim Lewat Email
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        Tautan reset dikirim ke alamat email akun tanpa
                        ditampilkan langsung di browser.
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
                <span className="badge badge-primary">FORGOT PASSWORD</span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--auth-text)]">
                  Lupa password?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                  Masukkan email akun PADIS Anda. Jika email terdaftar, sistem
                  akan mengirim tautan reset password.
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
                      placeholder="Masukkan email akun"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border px-4 py-3 text-sm text-[var(--auth-alert-danger-text)] [background:var(--auth-alert-danger-bg)] [border-color:var(--auth-alert-danger-border)]">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="rounded-2xl border px-4 py-3 text-sm text-[var(--auth-alert-success-text)] [background:var(--auth-alert-success-bg)] [border-color:var(--auth-alert-success-border)]">
                    {success}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  {loading ? "Memproses..." : "Kirim Tautan Reset"}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-[var(--auth-link-muted)] transition hover:text-[var(--auth-text)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke Login
                </Link>

                <Link
                  href="/register"
                  className="font-medium text-[var(--color-primary)] transition hover:underline"
                >
                  Daftar akun
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
