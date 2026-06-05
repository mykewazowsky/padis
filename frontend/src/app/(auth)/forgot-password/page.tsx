"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { buildApiUrl } from "../../../lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateForm() {
    if (!email.trim()) return t("auth.forgotPassword.errEmailRequired");
    if (!/\S+@\S+\.\S+/.test(email.trim())) return t("auth.forgotPassword.errEmailInvalid");
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
      const res = await fetch(buildApiUrl("/api/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || t("auth.forgotPassword.errFailed"));
      }

      setSentTo(email.trim());
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

  function handleTryAgain() {
    setSentTo("");
    setEmail("");
    setError("");
  }

  return (
    <main className="auth-page-gradient min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* Hero section */}
        <section className="auth-hero-gradient relative hidden overflow-hidden lg:flex">
          <div className="auth-hero-overlay" />
          <div className="hero-grid-overlay" />
          <div className="hero-orb hero-orb-secondary right-[-80px] top-[80px] h-56 w-56" />
          <div className="hero-orb hero-orb-primary bottom-[-60px] left-[-40px] h-48 w-48" />

          <div className="relative flex w-full flex-col justify-between px-10 py-12 text-white xl:px-14">
            <div>
              <span className="badge badge-secondary">PASSWORD RECOVERY</span>

              <h1 className="mt-5 text-4xl font-bold tracking-tight leading-tight xl:text-5xl">
                {t("auth.forgotPassword.heroTitle")}
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--auth-hero-muted)] xl:text-base">
                {t("auth.forgotPassword.heroDesc")}
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
                      <p className="text-sm font-semibold text-white">{t("auth.forgotPassword.securityTitle")}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        {t("auth.forgotPassword.securityDesc")}
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
                      <p className="text-sm font-semibold text-white">{t("auth.forgotPassword.emailSentTitle")}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        {t("auth.forgotPassword.emailSentDesc")}
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

        {/* Form / success section */}
        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            {sentTo ? (
              /* ── Success state ── */
              <div className="card card-elevated p-8 md:p-9">
                {/* Animated check icon */}
                <div className="mb-6 flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-4 ring-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <span className="badge badge-primary mb-3">{t("auth.forgotPassword.sentBadge")}</span>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--auth-text)]">
                    {t("auth.forgotPassword.sentTitle")}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                    {t("auth.forgotPassword.sentDesc")}
                  </p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--auth-input-bg)] px-4 py-2.5 ring-1 ring-[var(--auth-input-border)]">
                    <Mail className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    <span className="text-sm font-semibold text-[var(--auth-text)]">
                      {sentTo}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                <div className="mb-6 space-y-3">
                  {[
                    { n: "1", text: t("auth.forgotPassword.sentStep1") },
                    { n: "2", text: t("auth.forgotPassword.sentStep2") },
                    { n: "3", text: t("auth.forgotPassword.sentStep3") },
                    { n: "4", text: t("auth.forgotPassword.sentStep4") },
                  ].map((step) => (
                    <div key={step.n} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-white">
                        {step.n}
                      </span>
                      <p className="text-sm leading-relaxed text-[var(--auth-text-muted)]">
                        {step.text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Expiry notice */}
                <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Tautan berlaku selama{" "}
                    <span className="font-semibold">30 menit</span>. Periksa
                    juga folder{" "}
                    <span className="font-semibold">Spam / Junk</span> jika
                    email tidak muncul.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleTryAgain}
                    className="btn-outline inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("auth.forgotPassword.sendAgain")}
                  </button>
                  <Link
                    href="/login"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm text-[var(--auth-link-muted)] transition hover:text-[var(--auth-text)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t("auth.forgotPassword.backToLogin")}
                  </Link>
                </div>
              </div>
            ) : (
              /* ── Form state ── */
              <div className="card card-elevated p-8 md:p-9">
                <div className="mb-8">
                  <span className="badge badge-primary">{t("auth.forgotPassword.badge")}</span>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--auth-text)]">
                    {t("auth.forgotPassword.title")}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                    {t("auth.forgotPassword.description")}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="input-label">{t("auth.forgotPassword.emailLabel")}</label>
                    <div className="input-shell flex items-center gap-3 px-4 py-3">
                      <Mail className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                      <input
                        type="email"
                        className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("auth.forgotPassword.emailPlaceholder")}
                        autoFocus
                      />
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
                    <KeyRound className="h-4 w-4" />
                    {loading ? t("auth.forgotPassword.processing") : t("auth.forgotPassword.submitButton")}
                  </button>
                </form>

                <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-[var(--auth-link-muted)] transition hover:text-[var(--auth-text)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t("auth.forgotPassword.backToLogin")}
                  </Link>

                  <Link
                    href="/register"
                    className="font-medium text-[var(--color-primary)] transition hover:underline"
                  >
                    {t("auth.forgotPassword.registerLink")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
