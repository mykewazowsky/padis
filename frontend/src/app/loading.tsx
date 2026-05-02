export default function Loading() {
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--theme-body-bg)] px-4 py-6 text-[var(--theme-body-text)] md:px-6">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--theme-shell-border)] border-t-[var(--color-primary)]" />

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
          PADIS SYSTEM
        </p>

        <h2 className="mt-3 text-2xl font-semibold text-[var(--theme-shell-text)]">
          Memuat data...
        </h2>

        <p className="mt-2 max-w-xs text-sm text-[var(--theme-shell-text-muted)]">
          Sistem sedang mengambil dan memproses data analisis.
        </p>
      </div>
    </main>
  );
}
