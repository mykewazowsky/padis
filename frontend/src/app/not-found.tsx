export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center flex flex-col items-center">

        <div className="text-6xl">🗺️</div>

        <h1 className="mt-4 text-5xl font-bold text-slate-900">
          404
        </h1>

        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          PADIS SYSTEM
        </p>

        <h2 className="mt-2 text-xl font-semibold text-slate-800">
          Data tidak ditemukan
        </h2>

        <p className="mt-2 text-sm text-slate-500 max-w-md">
          Halaman atau data yang kamu cari tidak tersedia dalam sistem.
        </p>

        <div className="mt-6 flex gap-3">
          <a
            href="/"
            className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Beranda
          </a>

          <a
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Dashboard
          </a>
        </div>

      </div>
    </main>
  );
}