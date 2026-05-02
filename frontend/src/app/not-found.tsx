export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--theme-body-bg)] px-4 text-[var(--theme-body-text)]">
      <div className="text-center flex flex-col items-center">

        <div className="text-6xl">🗺️</div>

        <h1 className="mt-4 text-5xl font-bold text-[var(--theme-shell-text)]">
          404
        </h1>

        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          PADIS SYSTEM
        </p>

        <h2 className="mt-2 text-xl font-semibold text-[var(--theme-shell-text)]">
          Data tidak ditemukan
        </h2>

        <p className="mt-2 max-w-md text-sm text-[var(--theme-shell-text-muted)]">
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
            className="rounded-xl border border-[var(--theme-shell-border)] px-5 py-2.5 text-sm font-semibold text-[var(--theme-shell-text)] transition hover:bg-[var(--theme-toggle-hover)]"
          >
            Dashboard
          </a>
        </div>

      </div>
    </main>
  );
}
