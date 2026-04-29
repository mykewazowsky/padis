import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | PADIS",
  description:
    "Informasi tentang data yang dikumpulkan dan disimpan oleh PADIS — Paddy Disaster Information System.",
};

export default function KebijakanPrivasiPage() {
  return (
    <section className="section-shell bg-white">
      <div className="section-container">
        <div className="mx-auto max-w-2xl">
          <p className="section-eyebrow mb-3">Privasi</p>
          <h1 className="text-heading text-3xl font-bold tracking-tight md:text-4xl">
            Kebijakan Privasi
          </h1>
          <p className="text-muted mt-3 text-sm">
            Terakhir diperbarui: April 2026
          </p>

          <div className="decor-line mt-8" />

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted">

            <div>
              <h2 className="text-heading mb-3 text-base font-semibold">
                Tentang PADIS
              </h2>
              <p>
                PADIS (Paddy Disaster Information System) adalah platform WebGIS
                akademik yang dikembangkan sebagai Capstone Project Program Studi
                Teknik Geodesi dan Geomatika, Institut Teknologi Bandung. Sistem
                ini menyediakan analisis risiko kerugian padi berbasis data
                spasial banjir, kekeringan, dan multi-hazard untuk wilayah
                Indonesia.
              </p>
            </div>

            <div>
              <h2 className="text-heading mb-3 text-base font-semibold">
                Data yang Kami Kumpulkan
              </h2>
              <p>
                Saat Anda mendaftar dan masuk ke PADIS, kami menyimpan informasi
                berikut:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <span className="font-medium text-heading">Nama dan alamat email</span> —
                  yang Anda masukkan saat pendaftaran, atau yang diberikan oleh
                  Google saat login dengan OAuth.
                </li>
                <li>
                  <span className="font-medium text-heading">Peran akun</span> —
                  pengguna biasa atau administrator, untuk menentukan hak akses
                  fitur.
                </li>
                <li>
                  <span className="font-medium text-heading">Token autentikasi (JWT)</span> —
                  disimpan di <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">localStorage</code> browser
                  Anda agar sesi login tetap aktif tanpa perlu masuk ulang setiap
                  saat.
                </li>
              </ul>
              <p className="mt-3">
                Kami tidak mengumpulkan data aktivitas, riwayat pencarian,
                perilaku navigasi, atau informasi perangkat Anda di luar yang
                diperlukan untuk autentikasi.
              </p>
            </div>

            <div>
              <h2 className="text-heading mb-3 text-base font-semibold">
                Mengapa Data Ini Diperlukan
              </h2>
              <p>
                Token autentikasi adalah satu-satunya cara sistem mengenali bahwa
                Anda sudah masuk. Tanpanya, Anda harus memasukkan ulang email dan
                password setiap kali membuka halaman baru. Token ini hanya
                digunakan untuk keperluan autentikasi — tidak untuk pelacakan,
                analitik, atau tujuan lain.
              </p>
            </div>

            <div>
              <h2 className="text-heading mb-3 text-base font-semibold">
                Yang Tidak Kami Lakukan
              </h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>Tidak menggunakan Google Analytics, Hotjar, atau layanan analitik serupa.</li>
                <li>Tidak memasang iklan atau tracker pihak ketiga.</li>
                <li>Tidak menjual, menyewakan, atau membagikan data Anda kepada pihak lain.</li>
                <li>Tidak menyimpan data aktivitas peta atau query yang Anda lakukan di dashboard.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading mb-3 text-base font-semibold">
                Layanan Pihak Ketiga
              </h2>
              <p>
                PADIS menggunakan layanan berikut untuk menjalankan fungsi
                intinya:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <span className="font-medium text-heading">Supabase</span> —
                  untuk autentikasi OAuth (Login dengan Google). Saat Anda
                  memilih Login dengan Google, Anda diarahkan ke layanan Google
                  dan Supabase sesuai kebijakan privasi masing-masing.
                </li>
                <li>
                  <span className="font-medium text-heading">Tile basemap</span> —
                  peta latar (Esri World Imagery, CartoDB) dimuat dari server
                  penyedia masing-masing. Request tile standar tidak mengandung
                  data pribadi Anda.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-heading mb-3 text-base font-semibold">
                Menghapus Data Anda
              </h2>
              <p>
                Untuk menghapus sesi lokal, klik{" "}
                <span className="font-medium text-heading">Keluar</span> di
                navigasi — token autentikasi akan dihapus dari browser Anda.
                Untuk penghapusan akun secara permanen, hubungi tim pengembang
                PADIS melalui jalur yang tersedia di halaman{" "}
                <Link
                  href="/about"
                  className="text-[var(--color-primary)] hover:underline"
                >
                  Tentang Kami
                </Link>
                .
              </p>
            </div>

            <div>
              <h2 className="text-heading mb-3 text-base font-semibold">
                Konteks Akademik
              </h2>
              <p>
                PADIS adalah proyek akademik, bukan produk komersial. Sistem ini
                tidak dioperasikan untuk tujuan bisnis dan tidak memiliki model
                monetisasi yang bergantung pada data pengguna. Data yang
                dikumpulkan semata-mata untuk menjalankan fungsi autentikasi dan
                akses fitur dashboard.
              </p>
            </div>

          </div>

          <div className="decor-line mt-10" />

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn-outline px-4 py-2 text-sm">
              Kembali ke Beranda
            </Link>
            <Link href="/about" className="btn-outline px-4 py-2 text-sm">
              Tentang PADIS
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
