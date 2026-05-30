import type { Metadata } from "next";
import Link from "next/link";
import { Globe2, Mail, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | PADIS",
  description:
    "Kebijakan privasi PADIS terkait akun, autentikasi, reset password, layanan pihak ketiga, dan hak pengguna.",
};

const dataItems = [
  {
    term: "Identitas akun",
    desc: "Nama, alamat email, peran akun, status akun, serta waktu login terakhir untuk menjalankan akses pengguna dan administrator.",
  },
  {
    term: "Kredensial dan token",
    desc: "Password disimpan sebagai hash, bukan teks asli. Token autentikasi JWT disimpan di localStorage browser agar sesi tetap aktif.",
  },
  {
    term: "Reset password",
    desc: "Jika pengguna meminta reset password, sistem menyimpan hash token reset, waktu kedaluwarsa, dan status penggunaan token.",
  },
  {
    term: "Audit admin",
    desc: "Aksi administratif tertentu dicatat untuk akuntabilitas, termasuk perubahan pengguna dan penyelesaian reset password.",
  },
];

const thirdParties = [
  {
    term: "Supabase dan Google OAuth",
    desc: "Digunakan untuk login dengan Google dan verifikasi identitas OAuth. Data yang diterima PADIS terutama nama dan email.",
  },
  {
    term: "Vercel, Railway, dan PostgreSQL/PostGIS",
    desc: "Digunakan untuk hosting frontend, backend API, dan penyimpanan database aplikasi serta data analisis.",
  },
  {
    term: "SMTP email",
    desc: "Digunakan untuk mengirim tautan reset password ke alamat email pengguna yang terdaftar.",
  },
  {
    term: "Esri World Imagery dan CartoDB",
    desc: "Digunakan sebagai peta latar. PADIS tidak mengirim nama, email, atau token ke penyedia basemap, tetapi request tile dapat memuat data teknis seperti alamat IP dan user-agent.",
  },
];

const purposes = [
  "Mengenali pengguna yang sudah login dan menjaga sesi tetap aktif.",
  "Menentukan hak akses antara pengguna biasa dan administrator.",
  "Mengelola reset password secara aman melalui token sekali pakai.",
  "Menyediakan jejak audit untuk aksi admin yang sensitif.",
];

const notDone = [
  "Tidak menjual, menyewakan, atau memperdagangkan data pengguna.",
  "Tidak memasang iklan, pixel marketing, Hotjar, atau tracker serupa.",
  "Tidak menyimpan password asli dalam bentuk teks terbaca.",
  "Tidak memakai data aktivitas peta untuk profiling komersial.",
];

const rights = [
  "Meminta akses atas data akun yang tersimpan.",
  "Meminta koreksi nama, email, status, atau informasi akun lain yang tidak akurat.",
  "Meminta penghapusan akun dan data autentikasi yang terkait.",
  "Keluar dari sesi aktif dengan menghapus token lokal melalui tombol Keluar.",
];

function Divider() {
  return <hr className="border-[var(--content-border)]" />;
}

function Dot() {
  return (
    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
  );
}

export default function KebijakanPrivasiPage() {
  return (
    <main className="content-theme">
      {/* Hero */}
      <section className="content-hero-gradient relative overflow-hidden text-white">
        <div className="content-hero-overlay" />
        <div className="hero-grid-overlay" />
        <div className="section-container relative py-14 md:py-16">
          <span className="badge badge-secondary">Privasi dan Kepercayaan</span>
          <h1 className="mt-5 max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Kebijakan Privasi PADIS
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
            Data yang diproses PADIS, alasan pemrosesan, layanan pihak ketiga,
            serta cara pengguna mengelola data akun mereka.
          </p>
          <p className="mt-4 text-xs text-[var(--content-hero-soft)]">
            Terakhir diperbarui: Mei 2026 · Proyek akademik ITB
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
                <strong>Ringkasan:</strong> PADIS tidak menjual data pengguna, tidak
                memasang iklan, dan tidak menggunakan tracker analitik pihak ketiga.
                Data akun dipakai hanya untuk autentikasi, akses fitur, dan keamanan sistem.
              </p>
            </div>

            {/* Data yang Diproses */}
            <div>
              <p className="section-eyebrow mb-3">Data yang Diproses</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                Data dikumpulkan seperlunya untuk menjalankan akun dan fitur PADIS.
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                PADIS memproses data akun, token autentikasi, dan catatan keamanan yang
                diperlukan agar dashboard, admin panel, dan reset password berjalan dengan benar.
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
                <h3 className="text-heading font-semibold">Tujuan Pemrosesan</h3>
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
                <h3 className="text-heading font-semibold">Yang Tidak Dilakukan PADIS</h3>
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
              <p className="section-eyebrow mb-3">Layanan Pihak Ketiga</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                Infrastruktur eksternal untuk hosting, autentikasi, email, dan peta latar.
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
              <p className="section-eyebrow mb-3">Hak Pengguna</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                Pengguna dapat meminta akses, koreksi, atau penghapusan data akun.
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Permintaan dapat dikirimkan melalui kontak pengembang PADIS. Beberapa data
                teknis mungkin tetap disimpan sementara jika diperlukan untuk keamanan,
                audit, atau integritas sistem.
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
                <h3 className="text-heading text-sm font-semibold">Retensi Data</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  Data akun disimpan selama akun masih diperlukan. Token reset password
                  memiliki masa berlaku terbatas, sedangkan log audit disimpan untuk
                  kebutuhan akuntabilitas sistem.
                </p>
              </div>
              <div>
                <h3 className="text-heading text-sm font-semibold">Keamanan</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  PADIS memakai password hashing, token autentikasi, pembatasan akses
                  berbasis role, rate limiting untuk endpoint sensitif, dan koneksi HTTPS
                  pada deployment publik.
                </p>
              </div>
              <div>
                <h3 className="text-heading text-sm font-semibold">Konteks Akademik</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  PADIS adalah proyek akademik Capstone, bukan produk komersial. Data
                  akun diproses untuk menjalankan fungsi sistem, bukan untuk monetisasi.
                </p>
              </div>
            </div>

            <Divider />

            {/* Kontak */}
            <div>
              <p className="section-eyebrow mb-3">Rujukan dan Kontak</p>
              <h2 className="text-heading text-xl font-bold md:text-2xl">
                Pertanyaan privasi dapat diarahkan ke tim pengembang PADIS.
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Halaman ini disusun untuk transparansi proyek akademik PADIS dan
                memperhatikan prinsip umum pelindungan data pribadi di Indonesia,
                termasuk UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
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
                  Kembali ke Beranda
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
