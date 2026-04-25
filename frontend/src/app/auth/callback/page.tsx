"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? "/login?error=oauth_failed" : "/dashboard");
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        router.replace(session ? "/dashboard" : "/login?error=oauth_failed");
      });
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--color-primary-soft)] via-white to-[var(--color-secondary-soft)]">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card card-elevated w-full max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)]">
            <div
              className="h-7 w-7 animate-spin rounded-full border-[3px] border-gray-200 border-t-[var(--color-primary)]"
              aria-hidden="true"
            />
          </div>
          <h2 className="mt-5 text-xl font-bold text-gray-900">
            Menyelesaikan login Google
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            PADIS sedang memverifikasi akun Google Anda. Mohon tunggu sebentar.
          </p>
        </div>
      </div>
    </main>
  );
}
