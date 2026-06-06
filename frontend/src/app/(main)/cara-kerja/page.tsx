"use client";
import Link from "next/link";
import {
  Layers3,
  Search,
  PanelTop,
  FileDown,
  LineChart,
  MapPinned,
  PlayCircle,
  ArrowRight,
  ShieldAlert,
  Target,
} from "lucide-react";
import AnimatedPipelineSteps from "@/components/cara-kerja/AnimatedPipelineSteps";
import { useLanguage } from "@/contexts/LanguageContext";

function SectionHeader({
  title,
  desc,
  label,
  centered = true,
}: {
  title: string;
  desc?: string;
  label?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {label && <p className="section-eyebrow mb-3">{label}</p>}
      <h2 className="text-heading text-balance text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {desc ? (
        <p className="text-muted mt-4 leading-relaxed md:text-lg">{desc}</p>
      ) : null}
    </div>
  );
}

export default function CaraKerjaPage() {
  const { t } = useLanguage();

  const analyticalPipeline = [
    {
      step: "01",
      title: t("caraKerja.step1Title"),
      desc: t("caraKerja.step1Desc"),
    },
    {
      step: "02",
      title: t("caraKerja.step2Title"),
      desc: t("caraKerja.step2Desc"),
    },
    {
      step: "03",
      title: t("caraKerja.step3Title"),
      desc: t("caraKerja.step3Desc"),
    },
    {
      step: "04",
      title: t("caraKerja.step4Title"),
      desc: t("caraKerja.step4Desc"),
    },
    {
      step: "05",
      title: t("caraKerja.step5Title"),
      desc: t("caraKerja.step5Desc"),
    },
  ];

  const previewFeatures = [
    {
      title: t("caraKerja.compLayerTitle"),
      icon: Layers3,
      desc: t("caraKerja.compLayerDesc"),
    },
    {
      title: t("caraKerja.compSearchTitle"),
      icon: Search,
      desc: t("caraKerja.compSearchDesc"),
    },
    {
      title: t("caraKerja.compSummaryTitle"),
      icon: PanelTop,
      desc: t("caraKerja.compSummaryDesc"),
    },
    {
      title: t("caraKerja.compChartTitle"),
      icon: LineChart,
      desc: t("caraKerja.compChartDesc"),
    },
    {
      title: t("caraKerja.compExportTitle"),
      icon: FileDown,
      desc: t("caraKerja.compExportDesc"),
    },
  ];

  const useCases = [
    {
      title: t("caraKerja.useCase1Title"),
      icon: MapPinned,
      desc: t("caraKerja.useCase1Desc"),
    },
    {
      title: t("caraKerja.useCase2Title"),
      icon: ShieldAlert,
      desc: t("caraKerja.useCase2Desc"),
    },
    {
      title: t("caraKerja.useCase3Title"),
      icon: Target,
      desc: t("caraKerja.useCase3Desc"),
    },
  ];

  return (
    <div className="content-theme">
      {/* HERO */}
      <section className="content-hero-gradient relative overflow-hidden text-white">
        <div className="content-hero-overlay" />
        <div className="hero-grid-overlay" />
        <div className="hero-orb hero-orb-primary -left-10 top-10 h-44 w-44" />
        <div className="hero-orb hero-orb-secondary right-0 top-0 h-56 w-56" />
        <div className="hero-orb hero-orb-soft bottom-0 left-1/3 h-36 w-36" />

        <div className="section-container relative py-16 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <span className="badge badge-secondary">{t("caraKerja.badge")}</span>

            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              {t("caraKerja.title")}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
              {t("caraKerja.description")}
            </p>

            {/* Mini step preview — sequential fade-in reinforces pipeline order */}
            <div className="mx-auto mt-8 max-w-3xl overflow-x-auto">
              <div className="flex min-w-max items-center justify-center gap-x-2 px-2">
                {analyticalPipeline.map((item, i) => (
                  <div
                    key={item.step}
                    className="flex items-center gap-2 animate-fade-in"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="flex items-center gap-1.5 rounded-full border border-[var(--content-hero-glass-border)] bg-[var(--content-hero-glass-bg)] px-3 py-1 text-xs font-medium text-[var(--content-hero-muted)]">
                      <span className="font-mono text-[10px] text-[var(--content-hero-soft)]">{item.step}</span>
                      {item.title}
                    </span>
                    {i < analyticalPipeline.length - 1 && (
                      <span className="text-sm text-[var(--content-hero-soft)]/60">›</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                aria-label={t("caraKerja.openDashboardAria")}
                className="btn-secondary px-5 py-3 text-base font-semibold"
              >
                {t("caraKerja.openDashboard")}
              </Link>

              <Link
                href="/"
                aria-label={t("caraKerja.backToHomeAria")}
                className="rounded-2xl border border-[var(--content-hero-glass-border)] bg-[var(--content-hero-glass-bg)] px-5 py-3 font-medium text-white transition hover:bg-[var(--content-hero-glass-bg-strong)]"
              >
                {t("caraKerja.backToHome")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Video Panduan */}
      <section className="section-shell-tight section-soft -mt-8 rounded-t-[2rem]">
        <div className="section-container">
          <div className="mx-auto max-w-4xl">

            {/* Header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--content-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] shadow-[var(--shadow-soft)]">
                <PlayCircle className="h-3.5 w-3.5" />
                {t("caraKerja.videoLabel")}
              </div>
              <h2 className="text-heading mt-4 text-balance text-3xl font-bold tracking-tight md:text-4xl">
                {t("caraKerja.videoTitle")}
              </h2>
              <p className="text-muted mx-auto mt-3 max-w-xl text-sm leading-relaxed md:text-base">
                {t("caraKerja.videoDesc")}
              </p>
            </div>

            {/* Video card */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface)] shadow-[var(--shadow-lg)]">
              {/* Browser chrome bar */}
              <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--content-surface-muted)] px-4 py-3">
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-400/80" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <span className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex max-w-xs items-center gap-1.5 truncate rounded-md border border-[var(--color-border)] bg-[var(--content-surface)] px-3 py-1 text-xs text-muted">
                    <PlayCircle className="h-3 w-3 shrink-0 text-[var(--color-primary)]" />
                    <span className="truncate">{t("caraKerja.youtubeUrlText")}</span>
                  </div>
                </div>
              </div>

              {/* Iframe — full width, aspect-video */}
              <div className="aspect-video w-full bg-black">
                <iframe
                  className="h-full w-full"
                  src="https://www.youtube.com/embed/sXUgzCNxeGc"
                  title={t("caraKerja.videoTitleAttr")}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>

            {/* What you'll learn chips */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {[
                t("caraKerja.videoLearn1"),
                t("caraKerja.videoLearn2"),
                t("caraKerja.videoLearn3"),
                t("caraKerja.videoLearn4"),
                t("caraKerja.videoLearn5"),
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--content-surface)] px-3 py-1.5 text-xs font-medium text-muted"
                >
                  {item}
                </span>
              ))}
            </div>

            {/* Fallback link */}
            <p className="mt-4 text-center text-xs text-muted">
              {t("caraKerja.videoNotAppearing")}{" "}
              <a
                href="https://www.youtube.com/watch?v=sXUgzCNxeGc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("caraKerja.openYoutubeAria")}
                className="text-[var(--color-primary)] hover:underline"
              >
                {t("caraKerja.openYoutube")}
              </a>
            </p>

            {/* Manual book download */}
            <div className="mt-6 flex justify-center">
              <a
                href="/manual-book/PADIS_User-Guide.pdf"
                download="PADIS_User-Guide.pdf"
                aria-label={t("caraKerja.downloadManualAria")}
                className="btn-outline inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
              >
                <FileDown className="h-4 w-4" />
                {t("caraKerja.downloadManual")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Alur Analisis */}
      <section className="section-shell content-section">
        <div className="section-container">
          <SectionHeader
            title={t("caraKerja.flowTitle")}
            label={t("caraKerja.flowLabel")}
            desc={t("caraKerja.flowDesc")}
          />

          <AnimatedPipelineSteps items={analyticalPipeline} />

          <div className="mx-auto mt-10 max-w-4xl">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 px-6 py-5 text-center text-sm leading-relaxed text-muted">
              {t("caraKerja.summaryText")}
            </div>
          </div>
        </div>
      </section>

      {/* Komponen Dashboard */}
      <section className="section-shell section-soft">
        <div className="section-container">
          <SectionHeader
            title={t("caraKerja.dashComponentsTitle")}
            desc={t("caraKerja.dashComponentsDesc")}
          />

          <div className="mx-auto mt-12 max-w-5xl">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {previewFeatures.map((item, index) => {
                  const Icon = item.icon;
                  const isPrimary = index === 0;

                  return (
                    <div
                      key={item.title}
                      className={`flex flex-col items-center gap-3 rounded-2xl border px-4 py-5 text-center transition-all duration-300 hover:-translate-y-2 hover:shadow-lg
                      ${
                        isPrimary
                          ? "border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)]/20"
                          : "border-[var(--color-border)] bg-[var(--content-surface)]"
                      }`}
                    >
                      <div
                        className={`rounded-2xl p-3
                        ${
                          isPrimary
                            ? "bg-[var(--color-primary)]/10"
                            : "bg-[var(--color-secondary-soft)]"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4
                          ${
                            isPrimary
                              ? "text-[var(--color-primary)]"
                              : "text-[var(--color-secondary-dark)]"
                          }`}
                        />
                      </div>

                      <p className="text-sm font-semibold text-heading">
                        {item.title}
                      </p>

                      <p className="text-xs leading-relaxed text-muted">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

            <div className="mx-auto mt-8 max-w-3xl">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 px-6 py-5 text-center text-sm leading-relaxed text-muted">
                {t("caraKerja.dashboardIntegrationText")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kasus Penggunaan */}
      <section className="section-shell content-section">
        <div className="section-container">
          <SectionHeader
            title={t("caraKerja.useCaseTitle")}
            desc={t("caraKerja.useCaseDesc")}
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="group flex flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--content-surface)] p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-lg"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] transition-all duration-300 group-hover:bg-[var(--color-primary)]/10">
                    <Icon className="h-5 w-5 text-[var(--color-primary)] transition-all duration-300 group-hover:scale-110" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-heading">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-shell content-section">
        <div className="section-container">
          <div className="content-cta-panel relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] p-6 text-center shadow-[var(--shadow-lg)] sm:p-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
              <div className="absolute right-10 bottom-10 h-40 w-40 rounded-full bg-[var(--color-secondary)]/10 blur-3xl" />
            </div>

            <div className="relative z-10">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                {t("caraKerja.ctaBadge")}
              </p>

              <h3 className="mt-2 text-2xl font-bold text-[var(--color-text)] md:text-3xl lg:text-4xl">
                {t("caraKerja.ctaTitle")}
              </h3>

              <p className="mx-auto mt-4 max-w-2xl text-[var(--color-gray)] md:text-lg">
                {t("caraKerja.ctaDesc")}
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/dashboard"
                  aria-label={t("caraKerja.openDashboardAria")}
                  className="btn-primary px-6 py-3 text-base font-semibold transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
                >
                  {t("caraKerja.openDashboard")}
                </Link>

                <Link
                  href="/"
                  aria-label={t("caraKerja.backToHomeAria")}
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-gray)] transition-all duration-300 hover:gap-3 hover:text-[var(--color-text)]"
                >
                  {t("caraKerja.backToHome")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
