import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  FileKey2,
  Globe2,
  History,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | PADIS",
  description:
    "Kebijakan privasi PADIS terkait akun, autentikasi, reset password, layanan pihak ketiga, dan hak pengguna.",
};

const dataItems = [
  {
    title: "Identitas akun",
    desc: "Nama, alamat email, peran akun, status akun, serta waktu login terakhir untuk menjalankan akses pengguna dan administrator.",
    icon: UserCheck,
  },
  {
    title: "Kredensial dan token",
    desc: "Password disimpan sebagai hash, bukan teks asli. Token autentikasi JWT disimpan di localStorage browser agar sesi tetap aktif.",
    icon: LockKeyhole,
  },
  {
    title: "Reset password",
    desc: "Jika pengguna meminta reset password, sistem menyimpan hash token reset, waktu kedaluwarsa, dan status penggunaan token.",
    icon: FileKey2,
  },
  {
    title: "Audit admin",
    desc: "Aksi administratif tertentu dicatat untuk akuntabilitas, termasuk perubahan pengguna dan penyelesaian reset password.",
    icon: History,
  },
];

const thirdParties = [
  {
    name: "Supabase dan Google OAuth",
    desc: "Digunakan untuk login dengan Google dan verifikasi identitas OAuth. Data yang diterima PADIS terutama nama dan email.",
  },
  {
    name: "Vercel, Railway, dan PostgreSQL/PostGIS",
    desc: "Digunakan untuk hosting frontend, backend API, dan penyimpanan database aplikasi serta data analisis.",
  },
  {
    name: "SMTP email",
    desc: "Digunakan untuk mengirim tautan reset password ke alamat email pengguna yang terdaftar.",
  },
  {
    name: "Esri World Imagery dan CartoDB",
    desc: "Digunakan sebagai peta latar. PADIS tidak mengirim nama, email, atau token ke penyedia basemap, tetapi request tile dapat memuat data teknis seperti alamat IP dan user-agent.",
  },
];

const rights = [
  "Meminta akses atas data akun yang tersimpan.",
  "Meminta koreksi nama, email, status, atau informasi akun lain yang tidak akurat.",
  "Meminta penghapusan akun dan data autentikasi yang terkait.",
  "Keluar dari sesi aktif dengan menghapus token lokal melalui tombol Keluar.",
];

function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="section-eyebrow mb-3">{eyebrow}</p>
      <h2 className="text-heading text-balance text-2xl font-bold md:text-3xl">
        {title}
      </h2>
      {desc ? (
        <p className="text-muted mt-3 text-sm leading-relaxed md:text-base">
          {desc}
        </p>
      ) : null}
    </div>
  );
}

function InfoPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="content-surface-card rounded-2xl border p-6 md:p-7">
      <h3 className="text-heading text-lg font-bold">{title}</h3>
      <div className="text-muted mt-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function KebijakanPrivasiPage() {
  return (
    <main className="content-theme">
      <section className="content-hero-gradient relative overflow-hidden text-white">
        <div className="content-hero-overlay" />
        <div className="hero-grid-overlay" />

        <div className="section-container relative py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <span className="badge badge-secondary">Privasi dan Kepercayaan</span>
              <h1 className="mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-5xl">
                Kebijakan Privasi PADIS
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
                Halaman ini menjelaskan data yang diproses PADIS, alasan
                pemrosesan, layanan pihak ketiga yang digunakan, serta cara
                pengguna mengelola data akun mereka.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs font-semibold text-[var(--content-hero-soft)]">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  Terakhir diperbarui: Mei 2026
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  Proyek akademik ITB
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-secondary)] text-[#7c5200]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">Ringkasan singkat</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--content-hero-muted)]">
                    PADIS tidak menjual data pengguna, tidak memasang iklan,
                    dan tidak menggunakan tracker analitik pihak ketiga. Data
                    akun dipakai untuk autentikasi, akses fitur, dan keamanan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section-soft">
        <div className="section-container py-14 md:py-18">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                label: "Tidak dijual",
                value: "Data akun tidak menjadi komoditas",
              },
              {
                label: "Tanpa tracker",
                value: "Tidak ada Google Analytics atau iklan",
              },
              {
                label: "Akses terbatas",
                value: "Fitur admin dikendalikan oleh role akun",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="content-surface-card rounded-2xl border p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                  {item.label}
                </p>
                <p className="text-heading mt-2 text-lg font-bold leading-snug">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-container py-14 md:py-18">
          <SectionTitle
            eyebrow="Data yang Diproses"
            title="Data dikumpulkan seperlunya untuk menjalankan akun dan fitur PADIS."
            desc="PADIS memproses data akun pengguna, token autentikasi, dan catatan keamanan yang diperlukan agar dashboard, admin panel, dan reset password berjalan dengan benar."
          />

          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {dataItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="content-surface-card rounded-2xl border p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-heading font-bold">{item.title}</h3>
                      <p className="text-muted mt-2 text-sm leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="content-highlight-section">
        <div className="section-container py-14 md:py-18">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <InfoPanel title="Tujuan Pemrosesan">
              <ul className="space-y-3">
                <li>Mengenali pengguna yang sudah login dan menjaga sesi tetap aktif.</li>
                <li>Menentukan hak akses antara pengguna biasa dan administrator.</li>
                <li>Mengelola reset password secara aman melalui token sekali pakai.</li>
                <li>Menyediakan jejak audit untuk aksi admin yang sensitif.</li>
              </ul>
            </InfoPanel>

            <InfoPanel title="Yang Tidak Dilakukan PADIS">
              <ul className="space-y-3">
                <li>Tidak menjual, menyewakan, atau memperdagangkan data pengguna.</li>
                <li>Tidak memasang iklan, pixel marketing, Hotjar, atau tracker serupa.</li>
                <li>Tidak menyimpan password asli dalam bentuk teks terbaca.</li>
                <li>Tidak memakai data aktivitas peta untuk profiling komersial.</li>
              </ul>
            </InfoPanel>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-container py-14 md:py-18">
          <SectionTitle
            eyebrow="Layanan Pihak Ketiga"
            title="PADIS menggunakan infrastruktur eksternal untuk hosting, autentikasi, email, dan peta latar."
          />

          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            {thirdParties.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-[var(--content-border)] bg-[var(--content-surface)] p-5"
              >
                <h3 className="text-heading font-bold">{item.name}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section-soft">
        <div className="section-container py-14 md:py-18">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <SectionTitle
                eyebrow="Hak Pengguna"
                title="Pengguna dapat meminta akses, koreksi, atau penghapusan data akun."
                desc="Permintaan dapat dikirimkan melalui kontak pengembang PADIS. Beberapa data teknis mungkin tetap disimpan sementara jika diperlukan untuk keamanan, audit, atau integritas sistem."
              />
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/about" className="btn-primary px-4 py-2 text-sm">
                  Kontak Pengembang
                </Link>
                <Link href="/login" className="btn-outline px-4 py-2 text-sm">
                  Kelola Sesi Login
                </Link>
              </div>
            </div>

            <div className="content-surface-card rounded-2xl border p-6">
              <ul className="space-y-4">
                {rights.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-muted text-sm leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-container py-14 md:py-18">
          <div className="grid gap-6 md:grid-cols-3">
            <InfoPanel title="Retensi Data">
              <p>
                Data akun disimpan selama akun masih diperlukan. Token reset
                password memiliki masa berlaku terbatas, sedangkan log audit
                disimpan untuk kebutuhan akuntabilitas sistem.
              </p>
            </InfoPanel>
            <InfoPanel title="Keamanan">
              <p>
                PADIS memakai password hashing, token autentikasi, pembatasan
                akses berbasis role, rate limiting untuk endpoint sensitif, dan
                koneksi HTTPS pada deployment publik.
              </p>
            </InfoPanel>
            <InfoPanel title="Konteks Akademik">
              <p>
                PADIS adalah proyek akademik Capstone, bukan produk komersial.
                Data akun diproses untuk menjalankan fungsi sistem dan akses
                dashboard, bukan untuk monetisasi.
              </p>
            </InfoPanel>
          </div>
        </div>
      </section>

      <section className="content-highlight-section">
        <div className="section-container py-14">
          <div className="content-cta-panel rounded-2xl border p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="section-eyebrow mb-3">Rujukan dan Kontak</p>
                <h2 className="text-heading text-2xl font-bold">
                  Pertanyaan privasi dapat diarahkan ke tim pengembang PADIS.
                </h2>
                <p className="text-muted mt-3 text-sm leading-relaxed">
                  Halaman ini disusun untuk transparansi proyek akademik PADIS
                  dan memperhatikan prinsip umum pelindungan data pribadi di
                  Indonesia, termasuk UU No. 27 Tahun 2022 tentang Pelindungan
                  Data Pribadi.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
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
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-outline px-4 py-2 text-sm">
              Kembali ke Beranda
            </Link>
            <Link href="/dashboard" className="btn-outline px-4 py-2 text-sm">
              Buka Dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
