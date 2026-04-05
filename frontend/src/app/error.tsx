"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  console.error(error);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="flex max-w-xl flex-col items-center text-center">

        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50">
          <svg
            className="h-8 w-8 text-red-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M12 9v4" strokeLinecap="round" />
            <path d="M12 17h.01" strokeLinecap="round" />
            <path
              d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Label */}
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          PADIS SYSTEM ERROR
        </p>

        {/* Title */}
        <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">
          Terjadi kesalahan pada aplikasi
        </h1>

        {/* Description */}
        <p className="mt-3 max-w-md text-sm text-slate-500 md:text-base">
          Sistem tidak dapat memproses halaman ini untuk sementara.
          Silakan coba kembali beberapa saat lagi.
        </p>

        {/* Actions */}
        <div className="mt-6 flex gap-3 flex-wrap justify-center">
          <button
            onClick={reset}
            className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Coba lagi
          </button>

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