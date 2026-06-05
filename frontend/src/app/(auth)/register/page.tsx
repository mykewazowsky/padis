"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPinned,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";

import { buildApiUrl } from "../../../lib/api";
import { getErrorMessage, getResponseError } from "../../../lib/error";
import { useLanguage } from "@/contexts/LanguageContext";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function validateForm() {
    if (!name.trim()) {
      return t("auth.register.errNameRequired");
    }

    if (!email.trim()) {
      return t("auth.register.errEmailRequired");
    }

    if (!password) {
      return t("auth.register.errPasswordRequired");
    }

    if (password.length < 8) {
      return t("auth.register.errPasswordTooShort");
    }

    if (!confirmPassword) {
      return t("auth.register.errConfirmRequired");
    }

    if (password !== confirmPassword) {
      return t("auth.register.errPasswordMismatch");
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
      const res = await fetch(buildApiUrl("/api/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(getResponseError(json, t("auth.register.errFailed")));
      }

      setSuccess(
        json.message ||
          t("auth.register.successMessage")
      );

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 1400);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Terjadi kesalahan saat registrasi."));
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
              <span className="badge badge-secondary">PADIS ACCOUNT</span>

              <h1 className="mt-5 text-4xl font-bold tracking-tight leading-tight xl:text-5xl">
                {t("auth.register.heroTitle")}
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--auth-hero-muted)] xl:text-base">
                {t("auth.register.heroDesc")}
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
                        {t("auth.register.dashboardTitle")}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        {t("auth.register.dashboardDesc")}
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
                        {t("auth.register.accessTitle")}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--auth-hero-muted)]">
                        {t("auth.register.accessDesc")}
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
                <span className="badge badge-primary">{t("auth.register.badge")}</span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-[var(--auth-text)]">
                  {t("auth.register.title")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                  {t("auth.register.description")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="input-label">{t("auth.register.fullNameLabel")}</label>
                  <div className="input-shell flex items-center gap-3 px-4 py-3">
                    <User className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                    <input
                      type="text"
                      className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("auth.register.fullNamePlaceholder")}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">{t("auth.register.emailLabel")}</label>
                  <div className="input-shell flex items-center gap-3 px-4 py-3">
                    <Mail className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                    <input
                      type="email"
                      className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.register.emailPlaceholder")}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">{t("auth.register.passwordLabel")}</label>
                  <div className="input-shell flex items-center gap-3 px-4 py-3">
                    <Lock className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("auth.register.passwordPlaceholder")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-[var(--auth-input-icon)] transition hover:text-[var(--auth-input-icon-hover)]"
                      aria-label={
                        showPassword ? "Sembunyikan password" : "Tampilkan password"
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
                  <label className="input-label">{t("auth.register.confirmPasswordLabel")}</label>
                  <div className="input-shell flex items-center gap-3 px-4 py-3">
                    <Lock className="h-4 w-4 shrink-0 text-[var(--auth-input-icon)]" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full border-0 bg-transparent p-0 text-[var(--auth-input-text)] placeholder:text-[var(--auth-input-placeholder)] outline-none focus:ring-0"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("auth.register.confirmPasswordPlaceholder")}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((prev) => !prev)
                      }
                      className="text-[var(--auth-input-icon)] transition hover:text-[var(--auth-input-icon-hover)]"
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
                  <UserPlus className="h-4 w-4" />
                  {loading ? t("auth.register.processing") : t("auth.register.submitButton")}
                </button>
              </form>

              <div className="mt-5 surface-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--auth-text)]">
                  {t("auth.register.noteLabel")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--auth-text-muted)]">
                  {t("auth.register.noteDesc")}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 text-sm">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-[var(--auth-link-muted)] transition hover:text-[var(--auth-text)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("auth.register.backToLogin")}
                </Link>

                <Link
                  href="/"
                  className="font-medium text-[var(--color-primary)] transition hover:underline"
                >
                  {t("auth.register.backToHome")}
                </Link>
              </div>

              <div className="mt-4 text-center text-sm text-[var(--auth-text-muted)]">
                {t("auth.register.hasAccount")}{" "}
                <Link
                  href="/login"
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  {t("auth.register.loginLink")}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
