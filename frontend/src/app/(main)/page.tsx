"use client";
import Link from "next/link";
import { Droplets, Leaf, Layers3, Globe, ArrowRight, BarChart3, TrendingUp, MapPin  } from "lucide-react";
import { useInView } from "@/hooks/useInView";

function SectionHeader({
  title,
  desc,
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-heading text-balance text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {desc && (
        <p className="text-muted mt-4 leading-relaxed md:text-lg">{desc}</p>
      )}
    </div>
  );
}

export default function LandingPage() {
  const { ref: cakupanRef, inView: cakupanInView } = useInView();

  return (
    <div className="content-theme">
      {/* HERO */}
      <section className="section-gradient-primary relative overflow-hidden text-white">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="/cover/pexels-dhennynapitupulu-19104382.jpg"
            alt="Lanskap sawah padi"
            className="h-full w-full object-cover object-center opacity-45"
          />

          {/* Base dark overlay */}
          <div className="absolute inset-0 bg-[var(--hero-overlay-base)]" />

          {/* Brand-toned overlay */}
          <div className="absolute inset-0 bg-[image:var(--hero-overlay-brand)]" />

          {/* Soft vignette biar fokus ke tengah */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.18)_55%,rgba(2,6,23,0.38)_100%)]" />
        </div>

        {/* Decorative layers */}
        <div className="hero-grid-overlay relative z-10 opacity-40" />
        <div className="hero-orb hero-orb-primary -left-10 top-10 h-44 w-44 z-10 opacity-80" />
        <div className="hero-orb hero-orb-secondary right-0 top-0 h-56 w-56 z-10 opacity-70" />
        <div className="hero-orb hero-orb-soft bottom-0 left-1/3 h-36 w-36 z-10 opacity-60" />

        <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-20 px-6 lg:px-10">
          <div className="section-container flex justify-end">
            <a
              href="https://www.pexels.com/photo/farmer-working-on-rice-field-19104382/"
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto inline-flex max-w-full rounded-full border border-[var(--hero-chip-border)] bg-[var(--hero-chip-bg)] px-3 py-1.5 text-[11px] text-[var(--hero-text-muted)] shadow-sm backdrop-blur-sm transition hover:bg-[var(--hero-chip-bg)] hover:text-white"
            >
              <span className="truncate">Foto oleh Dhenny Napitupulu di Pexels</span>
            </a>
          </div>
        </div>

        <div className="section-container relative z-20 grid gap-8 py-12 md:gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
          <div className="space-y-8">
            <span className="badge badge-secondary">
              WebGIS PADIS: Paddy Disaster Information System
            </span>

            <div className="space-y-6">
              <h1 className="animate-fade-up text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
                Analisis Risiko Padi Berbasis{" "}
                <span className="text-[var(--color-secondary)]">
                  Bencana Banjir, Kekeringan, dan Multi-hazard
                </span>
              </h1>

              <p className="animate-fade-up max-w-2xl text-base leading-relaxed text-[var(--hero-text-muted)] md:text-lg" style={{ animationDelay: "80ms" }}>
                PADIS membantu memahami kerugian padi secara spasial melalui
                analisis banjir, kekeringan, dan multi-hazard, serta perbandingan
                kondisi projection dan baseline untuk mendukung pengambilan keputusan
                berbasis data.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="btn-secondary px-5 py-3 text-base font-semibold"
              >
                Buka Dashboard
              </Link>

              <Link
                href="/cara-kerja"
                className="rounded-full border border-[var(--hero-glass-border)] bg-[var(--hero-glass-bg)] px-5 py-3 text-white backdrop-blur-sm transition hover:bg-[var(--hero-glass-bg-strong)]"
              >
                Cara Kerja
              </Link>

              <Link
                href="/about"
                className="rounded-full border border-[var(--hero-glass-border)] bg-[var(--hero-glass-bg)] px-5 py-3 text-white backdrop-blur-sm transition hover:bg-[var(--hero-glass-bg-strong)]"
              >
                Tentang PADIS
              </Link>
            </div>
          </div>

          {/* HERO CARD */}
          <div className="animate-fade-up rounded-3xl border border-[var(--hero-glass-border)] bg-[var(--hero-glass-bg-strong)] p-7 shadow-xl backdrop-blur-lg" style={{ animationDelay: "150ms" }}>
            <p className="text-sm text-[var(--hero-text-muted)]">Ringkasan Sistem</p>
            <h3 className="mt-2 text-2xl font-bold">
              Dashboard Analisis Risiko Berbasis Geospasial
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--hero-text-muted)]">
              PADIS mengintegrasikan data bencana, skenario projection dan baseline,
              dan produksi padi untuk menghasilkan estimasi kerugian langsung dan
              Average Annual Loss (AAL) secara spasial.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-[var(--hero-glass-border)] bg-[var(--hero-glass-bg)] px-4 py-3 text-[var(--hero-text-muted)]">
                Analisis Banjir & Kekeringan
              </div>
              <div className="rounded-2xl border border-[var(--hero-glass-border)] bg-[var(--hero-glass-bg)] px-4 py-3 text-[var(--hero-text-muted)]">
                Penilaian Multi-hazard
              </div>
              <div className="rounded-2xl border border-[var(--hero-glass-border)] bg-[var(--hero-glass-bg)] px-4 py-3 text-[var(--hero-text-muted)]">
                Skenario Projection dan Baseline
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CAKUPAN */}
      <section className="content-section-soft relative overflow-hidden py-14 md:py-24">
        {/* ambient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-4rem] top-16 h-72 w-72 rounded-full bg-[var(--color-primary-soft)] opacity-40 blur-3xl" />
          <div className="absolute right-[-3rem] top-24 h-72 w-72 rounded-full bg-[var(--color-secondary-soft)] opacity-35 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title="Cakupan Sistem"
            desc="PADIS mengintegrasikan berbagai model dan sumber data untuk menghasilkan analisis risiko yang lebih komprehensif."
          />

          <div ref={cakupanRef} className="mt-16 grid gap-y-12 md:grid-cols-2 md:gap-x-10 xl:grid-cols-4 xl:gap-x-12">
            {[
              {
                icon: Droplets,
                title: "Banjir",
                desc: "Menggunakan HEC-RAS 2D untuk simulasi genangan berdasarkan debit periode ulang 25–250 tahun.",
                iconBg: "border border-[rgba(30,99,181,0.22)] bg-[rgba(30,99,181,0.14)]",
                iconText: "text-[var(--color-primary)]",
              },
              {
                icon: Leaf,
                title: "Kekeringan",
                desc: "Menggunakan SPI berbasis curah hujan dari GPM dan MME untuk analisis kondisi kering.",
                iconBg: "border border-[rgba(22,163,74,0.22)] bg-[rgba(22,163,74,0.14)]",
                iconText: "text-[var(--color-accent)]",
              },
              {
                icon: Layers3,
                title: "Multi-hazard",
                desc: "Integrasi model banjir dan kekeringan untuk menghasilkan analisis risiko gabungan.",
                iconBg: "border border-[rgba(244,194,31,0.24)] bg-[rgba(244,194,31,0.14)]",
                iconText: "text-[var(--color-secondary)]",
              },
              {
                icon: Globe,
                title: "Projection & Baseline",
                desc: "Analisis berbasis data observasi dan proyeksi untuk berbagai periode ulang.",
                iconBg: "border border-[rgba(14,165,233,0.22)] bg-[rgba(14,165,233,0.14)]",
                iconText: "text-[var(--color-primary)]",
              },
            ].map((item, i) => {
              const Icon = item.icon;

              return (
                <div
                  key={i}
                  className={`group relative reveal ${cakupanInView ? "in-view" : ""}`}
                  style={{ transitionDelay: `${i * 75}ms` }}
                >
                  {/* subtle divider (desktop only) */}
                  {i !== 0 && (
                    <div className="pointer-events-none absolute -left-6 top-2 hidden h-[80%] w-px bg-[var(--color-border)] xl:block" />
                  )}

                  {/* content */}
                  <div className="flex flex-col gap-4">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${item.iconBg} shadow-sm transition group-hover:scale-105`}
                    >
                      <Icon className={`h-6 w-6 ${item.iconText}`} />
                    </div>

                    <p className="text-base font-semibold text-[var(--color-text)]">
                      {item.title}
                    </p>

                    <p className="text-sm leading-7 text-[var(--color-gray)]">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HASIL */}
      <section className="content-highlight-section relative overflow-hidden border-t border-[var(--color-primary)]/20 py-24">

        {/* BACKGROUND */}
        <div className="pointer-events-none absolute inset-0">
          {/* blobs */}
          <div className="absolute left-[-4rem] top-20 h-72 w-72 rounded-full bg-[var(--color-primary-soft)] opacity-50 blur-[100px]" />
          <div className="absolute right-[-3rem] top-24 h-72 w-72 rounded-full bg-[var(--color-secondary-soft)] opacity-45 blur-[100px]" />

          {/* stronger tint */}
          <div className="absolute inset-0 bg-[var(--color-primary-soft)]/30" />

          {/* top divider */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/40 to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">

          <SectionHeader
            title="Hasil Analisis"
            desc="PADIS menyajikan luaran risiko yang membantu membaca pola kerugian padi secara spasial."
          />

          <div className="mt-16 grid gap-10 xl:grid-cols-[1.08fr_0.92fr] xl:gap-12">
            
            {/* LEFT */}
            <div className="flex flex-col justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(30,99,181,0.22)] bg-[rgba(30,99,181,0.14)] shadow-sm">
                <BarChart3 className="h-7 w-7 text-[var(--color-primary)]" />
              </div>

              <h3 className="mt-6 text-2xl font-bold tracking-tight text-[var(--color-text)] md:text-3xl xl:text-[2rem]">
                Luaran risiko yang ringkas, spasial, dan siap digunakan
              </h3>

              <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-gray)] md:text-lg">
                PADIS membantu membaca{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  estimasi kerugian langsung
                </span>,{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  Average Annual Loss (AAL)
                </span>, serta{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  distribusi risiko wilayah
                </span>.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="content-surface-card rounded-2xl border border-[var(--color-border)] px-4 py-4 backdrop-blur">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-gray)]">
                    Luaran
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                    Kerugian langsung & AAL
                  </p>
                </div>

                <div className="content-surface-card rounded-2xl border border-[var(--color-border)] px-4 py-4 backdrop-blur">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-gray)]">
                    Pendekatan
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                    Analisis spasial
                  </p>
                </div>

                <div className="content-surface-card rounded-2xl border border-[var(--color-border)] px-4 py-4 backdrop-blur">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-gray)]">
                    Komparasi
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                    Antar skenario
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="content-surface-card rounded-3xl border border-[var(--color-border)] p-6 backdrop-blur sm:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(30,99,181,0.22)] bg-[rgba(30,99,181,0.14)]">
                    <TrendingUp className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--color-gray)]">Indikator Utama</p>
                    <h4 className="font-semibold text-[var(--color-text)]">
                      Kerugian Langsung & AAL
                    </h4>
                  </div>
                </div>

                <p className="mt-4 text-sm text-[var(--color-gray)]">
                  Gambaran ringkas besaran kerugian langsung dan Average Annual Loss.
                </p>
              </div>

              <div className="content-surface-card rounded-3xl border border-[var(--color-border)] p-6 backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(244,194,31,0.24)] bg-[rgba(244,194,31,0.14)]">
                  <MapPin className="h-5 w-5 text-[var(--color-secondary)]" />
                </div>
                <h4 className="mt-4 font-semibold text-[var(--color-text)]">
                  Distribusi Wilayah
                </h4>
                <p className="mt-2 text-sm text-[var(--color-gray)]">
                  Identifikasi wilayah prioritas berbasis risiko spasial.
                </p>
              </div>

              <div className="content-surface-card rounded-3xl border border-[var(--color-border)] p-6 backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(22,163,74,0.22)] bg-[rgba(22,163,74,0.14)]">
                  <Layers3 className="h-5 w-5 text-[var(--color-accent)]" />
                </div>
                <h4 className="mt-4 font-semibold text-[var(--color-text)]">
                  Perbandingan
                </h4>
                <p className="mt-2 text-sm text-[var(--color-gray)]">
                  Evaluasi perubahan antar skenario.
                </p>
              </div>

              <div className="sm:col-span-2 border-t border-[var(--color-border)] pt-6">
                <p className="text-sm text-[var(--color-gray)]">
                  Seluruh hasil disajikan dalam bentuk{" "}
                  <span className="font-semibold text-[var(--color-text)]">
                    analisis spasial
                  </span>.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-shell content-section">
        <div className="section-container">
          <div className="section-gradient-primary relative overflow-hidden rounded-[2rem] p-10 text-center text-white shadow-lg">
            
            {/* subtle background effect */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute right-10 bottom-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            </div>

            <div className="relative z-10">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-secondary)]">
                MULAI ANALISIS
              </p>

              <h3 className="mt-2 text-3xl font-bold md:text-4xl">
                Eksplorasi Risiko Padi Berbasis Data Sekarang
              </h3>

              <p className="mx-auto mt-4 max-w-2xl text-blue-100 md:text-lg">
                Analisis kerugian, bandingkan skenario, dan identifikasi wilayah prioritas
                secara lebih cepat melalui dashboard PADIS.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                {/* Primary CTA */}
                <Link
                  href="/dashboard"
                  className="btn-secondary px-6 py-3 text-base font-semibold"
                >
                  Mulai Analisis
                </Link>

                {/* Secondary CTA */}
                <Link
                  href="/cara-kerja"
                  className="inline-flex items-center gap-2 text-sm text-white/90 hover:text-white"
                >
                  Pelajari Cara Kerja <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
