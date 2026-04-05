"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, User2 } from "lucide-react";

import { buildApiUrl } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";

const adminMenus = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/data", label: "Data Management" },
  { href: "/admin/process", label: "Process Control" },
  { href: "/admin/output", label: "Outputs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/guide", label: "Admin Guide" },
];

type UserInfo = {
  name: string;
  email: string;
  role?: string;
};

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(buildApiUrl("/api/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.user) {
          setUser(json.user);
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    const token = getToken();

    try {
      if (token) {
        await fetch(buildApiUrl("/api/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      clearToken();
      router.push("/");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="w-72 border-r border-slate-800 bg-slate-900 text-white">
          <div className="border-b border-slate-800 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              PADIS ADMIN
            </p>
            <h1 className="mt-2 text-2xl font-bold">Control Center</h1>
            <p className="mt-1 text-sm text-slate-400">
              System administration panel
            </p>
          </div>

          <nav className="space-y-2 px-4 py-4">
            {adminMenus.map((menu) => {
              const active =
                menu.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(menu.href);

              return (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className={
                    active
                      ? "block rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
                      : "block rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  }
                >
                  {menu.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* MAIN */}
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                  ADMIN PANEL
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  PADIS Administration
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Dashboard User
                </Link>

                {user && (
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <User2 className="h-4 w-4" />
                    {user.name}
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}