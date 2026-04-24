"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Database,
  FileOutput,
  Home,
  LogOut,
  Menu,
  Settings2,
  User2,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { buildApiUrl } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";

type UserInfo = {
  name: string;
  email: string;
  role?: string;
  status?: string;
};

type AdminMenu = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: string[];
};

const adminMenus: AdminMenu[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: Home,
    match: ["/admin"],
  },
  {
    href: "/admin/data-management",
    label: "Data Management",
    icon: Database,
    match: ["/admin/data-management"],
  },
  {
    href: "/admin/process-control",
    label: "Process Control",
    icon: Settings2,
    match: ["/admin/process-control"],
  },
  {
    href: "/admin/pipeline-monitor",
    label: "Pipeline Monitor",
    icon: Workflow,
    match: ["/admin/pipeline-monitor"],
  },
  {
    href: "/admin/outputs",
    label: "Outputs",
    icon: FileOutput,
    match: ["/admin/outputs"],
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    match: ["/admin/users"],
  },
  {
    href: "/admin/guide",
    label: "Admin Guide",
    icon: BookOpen,
    match: ["/admin/guide"],
  },
];

function isMenuActive(pathname: string, menu: AdminMenu) {
  if (menu.match?.some((path) => pathname === path || pathname.startsWith(path + "/"))) {
    return true;
  }

  return pathname === menu.href || pathname.startsWith(menu.href + "/");
}

function getPageTitle(pathname: string) {
  const currentMenu = adminMenus.find((menu) => isMenuActive(pathname, menu));
  return currentMenu?.label || "Admin Panel";
}

function getPageDescription(pathname: string) {
  if (pathname === "/admin") {
    return "Ringkasan utama aktivitas, statistik, dan status sistem administrasi.";
  }

  if (pathname.startsWith("/admin/data-management")) {
    return "Kelola data master, referensi, sinkronisasi, dan kebutuhan validasi data.";
  }

  if (pathname.startsWith("/admin/process-control")) {
    return "Atur workflow operasional, parameter proses, dan kontrol eksekusi.";
  }

  if (pathname.startsWith("/admin/pipeline-monitor")) {
    return "Pantau status pipeline, progress job, histori proses, dan potensi error.";
  }

  if (pathname.startsWith("/admin/outputs")) {
    return "Kelola hasil keluaran, export, verifikasi, dan histori output sistem.";
  }

  if (pathname.startsWith("/admin/users")) {
    return "Kelola akun pengguna, role, status akun, dan hak akses.";
  }

  if (pathname.startsWith("/admin/guide")) {
    return "Dokumentasi penggunaan panel admin dan panduan operasional sistem.";
  }

  return "Panel administrasi sistem.";
}

function SidebarMenu({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-2 px-4 py-4">
      {adminMenus.map((menu) => {
        const active = isMenuActive(pathname, menu);
        const Icon = menu.icon;

        return (
          <Link
            key={menu.href}
            href={menu.href}
            onClick={onNavigate}
            className={
              active
                ? "flex items-center gap-3 rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
                : "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{menu.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);
  const pageDescription = useMemo(() => getPageDescription(pathname), [pathname]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-900 text-white lg:block">
          <div className="border-b border-slate-800 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              PADIS ADMIN
            </p>
            <h1 className="mt-2 text-2xl font-bold">Control Center</h1>
            <p className="mt-1 text-sm text-slate-400">
              System administration panel
            </p>
          </div>

          <SidebarMenu pathname={pathname} />

          <div className="mt-auto border-t border-slate-800 px-6 py-4">
            <div className="rounded-2xl bg-slate-800 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Environment
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                Production Admin
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-950/50"
              onClick={() => setMobileOpen(false)}
            />

            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-slate-800 bg-slate-900 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    PADIS ADMIN
                  </p>
                  <h1 className="mt-2 text-xl font-bold">Control Center</h1>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <SidebarMenu
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>

              <div className="border-t border-slate-800 px-6 py-4">
                <div className="rounded-2xl bg-slate-800 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Environment
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    Production Admin
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main */}
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                    ADMIN PANEL
                  </p>
                  <h2 className="truncate text-xl font-bold text-slate-900">
                    {pageTitle}
                  </h2>
                  <p className="mt-1 hidden text-sm text-slate-500 sm:block">
                    {pageDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
                >
                  Dashboard User
                </Link>

                {user && (
                  <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:flex">
                    <User2 className="h-4 w-4" />
                    <span className="max-w-[180px] truncate">{user.name}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}