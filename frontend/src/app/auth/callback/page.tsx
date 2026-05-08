"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildApiUrl } from "@/lib/api";
import { saveToken } from "@/lib/auth";

async function exchangeForPadisToken(accessToken: string): Promise<string> {
  const res = await fetch(buildApiUrl("/api/auth/oauth/callback"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });

  if (!res.ok) {
    throw new Error(`Bridge responded ${res.status}`);
  }

  const json = await res.json();
  if (!json.token) {
    throw new Error("No token in bridge response");
  }

  return json.token as string;
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
        if (error || !data.session) {
          console.error("[PADIS OAuth] exchangeCodeForSession failed:", error);
          router.replace("/login?error=oauth_failed");
          return;
        }

        const { access_token } = data.session;
        console.info("[PADIS OAuth] Session obtained.");

        try {
          const token = await exchangeForPadisToken(access_token);
          saveToken(token);
          router.replace("/dashboard");
        } catch (e) {
          console.error("[PADIS OAuth] Bridge call failed:", e);
          router.replace("/login?error=oauth_bridge_failed");
        }
      });
    } else {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) {
          console.error("[PADIS OAuth] No session found in fallback path.");
          router.replace("/login?error=oauth_failed");
          return;
        }

        const { access_token } = session;
        console.info("[PADIS OAuth] Session obtained via fallback.");

        try {
          const token = await exchangeForPadisToken(access_token);
          saveToken(token);
          router.replace("/dashboard");
        } catch (e) {
          console.error("[PADIS OAuth] Bridge call failed (fallback):", e);
          router.replace("/login?error=oauth_bridge_failed");
        }
      });
    }
  }, [router]);

  return (
    <main className="auth-theme min-h-screen">
      <div className="auth-page-gradient flex min-h-screen items-center justify-center px-6">
        <div className="card card-elevated w-full max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)]">
            <div
              className="h-7 w-7 animate-spin rounded-full border-[3px] border-[var(--auth-surface-border)] border-t-[var(--color-primary)]"
              aria-hidden="true"
            />
          </div>
          <h2 className="mt-5 text-xl font-bold text-[var(--auth-text)]">
            Menyelesaikan login Google
          </h2>
          <p className="mt-2 text-sm text-[var(--auth-text-muted)]">
            PADIS sedang memverifikasi akun Google Anda. Mohon tunggu sebentar.
          </p>
        </div>
      </div>
    </main>
  );
}
