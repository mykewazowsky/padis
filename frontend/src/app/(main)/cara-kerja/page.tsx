import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Cara Kerja PADIS | Analisis Risiko Padi",
  description:
    "Pelajari cara PADIS mengolah data hazard banjir dan kekeringan menjadi estimasi kerugian ekonomi, Average Annual Loss (AAL), dan output spasial untuk analisis risiko wilayah padi.",
};

const analyticalPipeline = [
  {
    step: "01",
    title: "Raster Hazard",
    desc: "Data raster banjir dan kekeringan digunakan sebagai basis bahaya untuk berbagai periode ulang dan kondisi iklim.",
  },
  {
    step: "02",
    title: "Overlay Spasial",
    desc: "Nilai bahaya diekstraksi pada layer sawah dan diagregasi ke tingkat kabupaten/kota menggunakan analisis spasial.",
  },
  {
    step: "03",
    title: "Transformasi",
    desc: "Nilai bahaya ditransformasikan menjadi Damage Index (DI) dan Loss of Production (LOP) — indikator potensi dampak terhadap padi.",
  },
  {
    step: "04",
    title: "Estimasi Loss",
    desc: "Loss of Production (LOP) dikombinasikan dengan data produksi dan nilai ekonomi padi untuk menghasilkan estimasi kerugian dalam rupiah.",
  },
  {
    step: "05",
    title: "AAL & Output",
    desc: "Estimasi kerugian diringkas menjadi Average Annual Loss (AAL) — rata-rata kerugian tahunan — dan disajikan sebagai layer interaktif di dashboard.",
  },
];

const previewFeatures = [
  {
    title: "Ganti Layer",
    icon: Layers3,
    desc: "Pilih hazard, skenario, dan periode ulang untuk memperbarui tampilan peta.",
  },
  {
    title: "Cari Wilayah",
    icon: Search,
    desc: "Temukan kabupaten/kota tertentu dan navigasi langsung ke lokasinya di peta.",
  },
  {
    title: "Ringkasan",
    icon: PanelTop,
    desc: "Lihat nilai kerugian dan AAL wilayah terpilih dalam panel ringkasan yang ringkas.",
  },
  {
    title: "Insight Grafik",
    icon: LineChart,
    desc: "Eksplorasi distribusi dan perbandingan risiko antarskenario melalui grafik.",
  },
  {
    title: "Ekspor CSV",
    icon: FileDown,
    desc: "Unduh data kerugian dan AAL dalam format CSV untuk analisis lebih lanjut.",
  },
];

const useCases = [
  {
    title: "Risiko Wilayah",
    icon: MapPinned,
    desc: "Membaca pola kerugian padi per kabupaten/kota untuk banjir, kekeringan, dan multi-hazard.",
  },
  {
    title: "Perbandingan",
    icon: ShieldAlert,
    desc: "Membandingkan kondisi iklim dan non-iklim untuk melihat perubahan risiko secara lebih sistematis.",
  },
  {
    title: "Prioritas",
    icon: Target,
    desc: "Menentukan wilayah prioritas berbasis loss dan Average Annual Loss (AAL).",
  },
];

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
            <span className="badge badge-secondary">Cara Kerja PADIS</span>

            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Dari data hazard ke estimasi kerugian
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
              Lima tahap analisis spasial yang mengubah raster banjir dan kekeringan
              menjadi Average Annual Loss tingkat kabupaten/kota.
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
                aria-label="Buka dashboard PADIS"
                className="btn-secondary px-5 py-3 text-base font-semibold"
              >
                Buka Dashboard
              </Link>

              <Link
                href="/"
                aria-label="Kembali ke halaman beranda"
                className="rounded-2xl border border-[var(--content-hero-glass-border)] bg-[var(--content-hero-glass-bg)] px-5 py-3 font-medium text-white transition hover:bg-[var(--content-hero-glass-bg-strong)]"
              >
                Kembali ke Beranda
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
                Video Panduan
              </div>
              <h2 className="text-heading mt-4 text-balance text-3xl font-bold tracking-tight md:text-4xl">
                Panduan Penggunaan PADIS
              </h2>
              <p className="text-muted mx-auto mt-3 max-w-xl text-sm leading-relaxed md:text-base">
                Tonton panduan singkat untuk memahami alur analisis, jenis output,
                dan cara membaca hasil di dashboard.
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
                    <span className="truncate">youtube.com · Video Petunjuk Penggunaan PADIS</span>
                  </div>
                </div>
              </div>

              {/* Iframe — full width, aspect-video */}
              <div className="aspect-video w-full bg-black">
                <iframe
                  className="h-full w-full"
                  src="https://www.youtube.com/embed/sXUgzCNxeGc"
                  title="Video Petunjuk Penggunaan PADIS"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>

            {/* What you'll learn chips */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {[
                "Alur analisis PADIS",
                "Membaca peta risiko",
                "Filter skenario & iklim",
                "Ekspor data CSV",
                "Interpretasi AAL",
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
              Video tidak tampil?{" "}
              <a
                href="https://www.youtube.com/watch?v=sXUgzCNxeGc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buka video panduan PADIS di YouTube"
                className="text-[var(--color-primary)] hover:underline"
              >
                Buka di YouTube →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Alur Analisis */}
      <section className="section-shell content-section">
        <div className="section-container">
          <SectionHeader
            title="Alur Analisis PADIS"
            label="Tahapan Sistem"
            desc="PADIS mengolah data hazard menjadi estimasi kerugian dan output dashboard melalui tahapan analisis yang terstruktur."
          />

          <AnimatedPipelineSteps items={analyticalPipeline} />

          <div className="mx-auto mt-10 max-w-4xl">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 px-6 py-5 text-center text-sm leading-relaxed text-muted">
              Secara ringkas, PADIS mengubah{" "}
              <span className="font-semibold">data hazard</span> menjadi{" "}
              <span className="font-semibold">indikator risiko</span>,{" "}
              <span className="font-semibold">estimasi kerugian ekonomi</span>, dan{" "}
              <span className="font-semibold">Average Annual Loss (AAL)</span>, lalu
              menyajikannya melalui{" "}
              <span className="font-semibold">dashboard interaktif</span>.
            </div>
          </div>
        </div>
      </section>

      {/* Komponen Dashboard */}
      <section className="section-shell section-soft">
        <div className="section-container">
          <SectionHeader
            title="Komponen Dashboard PADIS"
            desc="Dashboard dirancang untuk membantu pengguna memahami risiko padi secara cepat melalui peta, filter, dan ringkasan analisis yang saling terhubung."
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
                Dashboard PADIS mengintegrasikan{" "}
                <span className="font-semibold">peta interaktif</span>,{" "}
                <span className="font-semibold">panel informasi</span>, dan{" "}
                <span className="font-semibold">grafik analisis</span> dalam satu
                tampilan, sehingga pengguna dapat membaca pola risiko dan
                membandingkan skenario tanpa kehilangan konteks.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kasus Penggunaan */}
      <section className="section-shell content-section">
        <div className="section-container">
          <SectionHeader
            title="Kasus Penggunaan"
            desc="Bagaimana PADIS dapat mendukung analisis dan pengambilan keputusan berbasis risiko padi."
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
          <div className="content-cta-panel relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] p-10 text-center shadow-[var(--shadow-lg)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
              <div className="absolute right-10 bottom-10 h-40 w-40 rounded-full bg-[var(--color-secondary)]/10 blur-3xl" />
            </div>

            <div className="relative z-10">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                LANGKAH BERIKUTNYA
              </p>

              <h3 className="mt-2 text-3xl font-bold text-[var(--color-text)] md:text-4xl">
                Mulai Identifikasi Wilayah Risiko Padi
              </h3>

              <p className="mx-auto mt-4 max-w-2xl text-[var(--color-gray)] md:text-lg">
                Gunakan dashboard PADIS untuk melihat estimasi kerugian,
                membandingkan skenario, dan mengidentifikasi wilayah prioritas
                secara spasial.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/dashboard"
                  aria-label="Buka dashboard PADIS"
                  className="btn-primary px-6 py-3 text-base font-semibold transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
                >
                  Buka Dashboard
                </Link>

                <Link
                  href="/"
                  aria-label="Kembali ke halaman beranda"
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-gray)] transition-all duration-300 hover:gap-3 hover:text-[var(--color-text)]"
                >
                  Kembali ke Beranda <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
