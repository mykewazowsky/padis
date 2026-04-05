export default function Loading() {
  return (
    <main className="bg-slate-50 px-4 py-6 md:px-6">
      <section className="min-h-[70vh] rounded-[2rem] border border-slate-200 bg-white px-6 py-12 shadow-sm">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center text-center">
          
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--color-primary)]" />

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
            PADIS SYSTEM
          </p>

          <h2 className="mt-3 text-xl font-semibold text-slate-800">
            Memuat data...
          </h2>

          <p className="mt-3 text-sm text-slate-500">
            Sistem sedang mengambil dan memproses data analisis.
          </p>
        </div>
      </section>
    </main>
  );
}