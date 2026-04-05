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
  const [resetLink, setResetLink] = useState("");
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
    setResetLink("");

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
          "Jika email terdaftar, tautan reset password telah dibuat."
      );
      setResetLink(json.reset_link || "");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memproses permintaan.");
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
              <span className="badge badge-secondary">PASSWORD RECOVERY</span>

              <h1 className="mt-5 text-4xl font-bold tracking-tight leading-tight xl:text-5xl">
                Pulihkan akses
                <br />
                akun PADIS
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-blue-100 xl:text-base">
                Masukkan email akun Anda untuk membuat tautan reset password.
                Setelah itu Anda dapat menetapkan password baru dan kembali
                mengakses dashboard PADIS.
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
                        Pemulihan Aman
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-100">
                        Token reset dibuat dengan masa berlaku terbatas untuk
                        menjaga keamanan akun.
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
                        Siap Integrasi Email
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-100">
                        Pada tahap sekarang, tautan reset ditampilkan langsung
                        untuk testing end-to-end.
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
                <span className="badge badge-primary">FORGOT PASSWORD</span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
                  Lupa password?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Masukkan email akun PADIS Anda. Jika email terdaftar, sistem
                  akan membuat tautan reset password.
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
                      placeholder="Masukkan email akun"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {success}
                  </div>
                ) : null}

                {resetLink ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 break-all">
                    <p className="font-medium">Reset link untuk testing:</p>
                    <a
                      href={resetLink}
                      className="mt-1 inline-block text-[var(--color-primary)] underline"
                    >
                      {resetLink}
                    </a>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  {loading ? "Memproses..." : "Buat Tautan Reset"}
                </button>
              </form>

              <div className="mt-5 surface-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Catatan
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  Untuk tahap pengembangan saat ini, tautan reset password
                  ditampilkan langsung agar mudah diuji end-to-end.
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