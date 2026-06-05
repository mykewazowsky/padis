"use client";
import Link from "next/link";
import { Globe2, Mail, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

function Divider() {
  return <hr className="border-[var(--content-border)]" />;
}

function Dot() {
  return (
    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
  );
}

export default function KebijakanPrivasiPage() {
  const { t } = useLanguage();

  const dataItems = [
    {
      term: t("kebijakanPrivasi.accountTitle"),
      desc: t("kebijakanPrivasi.accountDesc"),
    },
    {
      term: t("kebijakanPrivasi.credentialsTitle"),
      desc: t("kebijakanPrivasi.credentialsDesc"),
    },
    {
      term: t("kebijakanPrivasi.resetTitle"),
      desc: t("kebijakanPrivasi.resetDesc"),
    },
    {
      term: t("kebijakanPrivasi.auditTitle"),
      desc: t("kebijakanPrivasi.auditDesc"),
    },
  ];

  const thirdParties = [
    {
      term: t("kebijakanPrivasi.supabaseTitle"),
      desc: t("kebijakanPrivasi.supabaseDesc"),
    },
    {
      term: t("kebijakanPrivasi.hostingTitle"),
      desc: t("kebijakanPrivasi.hostingDesc"),
    },
    {
      term: t("kebijakanPrivasi.smtpTitle"),
      desc: t("kebijakanPrivasi.smtpDesc"),
    },
    {
      term: t("kebijakanPrivasi.basemapTitle"),
      desc: t("kebijakanPrivasi.basemapDesc"),
    },
  ];

  const purposes = [
    t("kebijakanPrivasi.purpose1"),
    t("kebijakanPrivasi.purpose2"),
    t("kebijakanPrivasi.purpose3"),
    t("kebijakanPrivasi.purpose4"),
  ];

  const notDone = [
    t("kebijakanPrivasi.notDone1"),
    t("kebijakanPrivasi.notDone2"),
    t("kebijakanPrivasi.notDone3"),
    t("kebijakanPrivasi.notDone4"),
  ];

  const rights = [
    t("kebijakanPrivasi.right1"),
    t("kebijakanPrivasi.right2"),
    t("kebijakanPrivasi.right3"),
    t("kebijakanPrivasi.right4"),
  ];

  return (
    <main className="content-theme">
      {/* Hero */}
      <section className="content-hero-gradient relative overflow-hidden text-white">
        <div className="content-hero-overlay" />
        <div className="hero-grid-overlay" />
        <div className="section-container relative py-14 md:py-16">
          <span className="badge badge-secondary">Privasi dan Kepercayaan</span>
          <h1 className="mt-5 max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-4xl">
            {t("kebijakanPrivasi.title")}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
            {t("kebijakanPrivasi.description")}
          </p>
          <p className="mt-4 text-xs text-[var(--content-hero-soft)]">
            {t("kebijakanPrivasi.lastUpdated")}
          </p>
        </div>
      </section>

      {/* Document body */}
      <section className="content-section">
        <div className="section-container py-14 md:py-18">
          <div className="mx-auto max-w-3xl space-y-12">

            {/* Summary */}
            <div className="flex gap-3 rounded-xl border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)] p-5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
              <p className="text-sm leading-relaxed text-heading">
                <strong>{t("kebijakanPrivasi.summaryLabel")}</strong> {t("kebijakanPrivasi.summaryText")}
              </p>
            </div>

            {/* Data yang Diproses */}
            <div>
              <p className="section-eyebrow mb-3">{t("kebijakanPrivasi.dataProcessedTitle")}</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                {t("kebijakanPrivasi.dataProcessedSubtitle")}
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                {t("kebijakanPrivasi.dataProcessedDesc")}
              </p>
              <dl className="mt-6 divide-y divide-[var(--content-border)]">
                {dataItems.map((item) => (
                  <div key={item.term} className="py-4">
                    <dt className="text-heading text-sm font-semibold">{item.term}</dt>
                    <dd className="text-muted mt-1 text-sm leading-relaxed">{item.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Divider />

            {/* Tujuan & Batasan */}
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="text-heading font-semibold">{t("kebijakanPrivasi.purposesTitle")}</h3>
                <ul className="mt-4 space-y-2.5">
                  {purposes.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted">
                      <Dot />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-heading font-semibold">{t("kebijakanPrivasi.notDoneTitle")}</h3>
                <ul className="mt-4 space-y-2.5">
                  {notDone.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted">
                      <Dot />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Divider />

            {/* Layanan Pihak Ketiga */}
            <div>
              <p className="section-eyebrow mb-3">{t("kebijakanPrivasi.thirdPartyTitle")}</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                {t("kebijakanPrivasi.thirdPartySubtitle")}
              </h2>
              <dl className="mt-6 divide-y divide-[var(--content-border)]">
                {thirdParties.map((item) => (
                  <div key={item.term} className="py-4">
                    <dt className="text-heading text-sm font-semibold">{item.term}</dt>
                    <dd className="text-muted mt-1 text-sm leading-relaxed">{item.desc}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Divider />

            {/* Hak Pengguna */}
            <div>
              <p className="section-eyebrow mb-3">{t("kebijakanPrivasi.rightsTitle")}</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                {t("kebijakanPrivasi.rightsSubtitle")}
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                {t("kebijakanPrivasi.rightsDesc")}
              </p>
              <ul className="mt-5 space-y-2.5">
                {rights.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted">
                    <Dot />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Divider />

            {/* Retensi, Keamanan, Konteks */}
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="text-heading text-sm font-semibold">{t("kebijakanPrivasi.retentionTitle")}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {t("kebijakanPrivasi.retentionDesc")}
                </p>
              </div>
              <div>
                <h3 className="text-heading text-sm font-semibold">{t("kebijakanPrivasi.securityTitle")}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {t("kebijakanPrivasi.securityDesc")}
                </p>
              </div>
              <div>
                <h3 className="text-heading text-sm font-semibold">{t("kebijakanPrivasi.academicTitle")}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {t("kebijakanPrivasi.academicDesc")}
                </p>
              </div>
            </div>

            <Divider />

            {/* Kontak */}
            <div>
              <p className="section-eyebrow mb-3">{t("kebijakanPrivasi.contactTitle")}</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                {t("kebijakanPrivasi.contactSubtitle")}
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                {t("kebijakanPrivasi.contactDesc")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/about" className="btn-primary px-4 py-2 text-sm">
                  <Mail className="h-4 w-4" />
                  Tentang Kami
                </Link>
                <a
                  href="https://peraturan.bpk.go.id/Home/Details/229798/uu-no-27-tahun-2022"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline px-4 py-2 text-sm"
                >
                  <Globe2 className="h-4 w-4" />
                  UU PDP
                </a>
                <Link href="/" className="btn-outline px-4 py-2 text-sm">
                  {t("kebijakanPrivasi.backToHome")}
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
