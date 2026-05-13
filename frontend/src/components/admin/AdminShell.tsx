"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  FileOutput,
  Home,
  LogOut,
  Menu,
  Settings2,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { buildApiUrl } from "../../lib/api";
import { clearToken, getToken } from "../../lib/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type MenuGroup = {
  label?: string;
  items: AdminMenu[];
};

// ─── Menu definition ─────────────────────────────────────────────────────────

const menuGroups: MenuGroup[] = [
  {
    items: [
      { href: "/admin", label: "Overview", icon: Home, match: ["/admin"] },
    ],
  },
  {
    label: "OPERASI",
    items: [
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
    ],
  },
  {
    label: "SISTEM",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, match: ["/admin/users"] },
      { href: "/admin/guide", label: "Admin Guide", icon: BookOpen, match: ["/admin/guide"] },
    ],
  },
];

const allMenus: AdminMenu[] = menuGroups.flatMap((g) => g.items);

const ADMIN_SIDEBAR_STORAGE_KEY = "padis_admin_sidebar_state";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchesAdminPath(pathname: string, path: string) {
  if (pathname === path) return true;
  if (path === "/admin") return false;
  return pathname.startsWith(path + "/");
}

function isMenuActive(pathname: string, menu: AdminMenu) {
  if (menu.match?.some((path) => matchesAdminPath(pathname, path))) return true;
  return matchesAdminPath(pathname, menu.href);
}

function getPageTitle(pathname: string) {
  const current = allMenus.find((menu) => isMenuActive(pathname, menu));
  return current?.label || "Admin Panel";
}

function getPageDescription(pathname: string) {
  if (pathname === "/admin")
    return "Ringkasan utama aktivitas, statistik, dan status sistem administrasi.";
  if (pathname.startsWith("/admin/data-management"))
    return "Kelola data master, referensi, sinkronisasi, dan kebutuhan validasi data.";
  if (pathname.startsWith("/admin/process-control"))
    return "Pilih hazard, atur parameter, jalankan pipeline, dan pantau progress live.";
  if (pathname.startsWith("/admin/pipeline-monitor"))
    return "Riwayat semua run, aktivasi run aktif, dan manajemen data hasil.";
  if (pathname.startsWith("/admin/outputs"))
    return "Kelola hasil keluaran, export, verifikasi, dan histori output sistem.";
  if (pathname.startsWith("/admin/users"))
    return "Kelola akun pengguna, role, status akun, dan hak akses.";
  if (pathname.startsWith("/admin/guide"))
    return "Dokumentasi penggunaan panel admin dan panduan operasional sistem.";
  return "Panel administrasi sistem.";
}

function getInitials(name?: string | null) {
  const normalizedName = name?.trim();

  if (!normalizedName) return "AD";

  return normalizedName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "AD";
}

// ─── Brand mark ──────────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-tight text-white"
      style={{ background: "linear-gradient(135deg, #1e7b4c 0%, #0d4f2f 100%)" }}
    >
      PS
    </div>
  );
}

// ─── Sidebar nav item ────────────────────────────────────────────────────────

function SidebarNavItem({
  menu,
  pathname,
  collapsed,
  onNavigate,
}: {
  menu: AdminMenu;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isMenuActive(pathname, menu);
  const Icon = menu.icon;

  return (
    <Link
      href={menu.href}
      onClick={onNavigate}
      aria-label={collapsed ? menu.label : undefined}
      className={[
        "group relative flex items-center rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50",
        collapsed
          ? "h-9 w-9 justify-center"
          : "gap-2.5 px-2.5 py-2",
        active
          ? "bg-white/[0.09] text-white"
          : "text-white/45 hover:bg-white/[0.05] hover:text-white/80",
      ].join(" ")}
    >
      {/* Left accent bar — expanded only */}
      {active && !collapsed && (
        <span
          className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ background: "var(--color-primary)" }}
        />
      )}

      {/* Active ring — collapsed only */}
      <Icon
        className={[
          "h-[17px] w-[17px] shrink-0 transition-colors",
          active
            ? collapsed
              ? "text-[var(--color-primary)]"
              : "text-white"
            : "",
        ].join(" ")}
      />

      {!collapsed && (
        <span className="truncate text-[13px] font-medium leading-none">
          {menu.label}
        </span>
      )}

      {/* Tooltip in collapsed mode */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#0d1117] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {menu.label}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

function SidebarNav({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className={collapsed ? "flex flex-col items-center gap-1 px-2 py-3" : "space-y-4 px-3 py-3"}>
      {menuGroups.map((group, gi) => (
        <div key={gi}>
          {/* Group label */}
          {group.label &&
            (collapsed ? (
              <div className="my-1 h-px w-5 rounded-full bg-white/10" />
            ) : (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.18em] text-white/25">
                {group.label}
              </p>
            ))}

          <div className={collapsed ? "flex flex-col items-center gap-1" : "space-y-0.5"}>
            {group.items.map((menu) => (
              <SidebarNavItem
                key={menu.href}
                menu={menu}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY);
      setSidebarExpanded(stored === "expanded");
    } catch {
      setSidebarExpanded(false);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(buildApiUrl("/api/me"), { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json?.user) setUser(json.user); })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    const token = getToken();
    try {
      if (token) {
        await fetch(buildApiUrl("/api/logout"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
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
  const userInitials = useMemo(() => getInitials(user?.name), [user?.name]);

  const toggleSidebar = () => {
    setSidebarExpanded((curr) => {
      const next = !curr;
      try {
        window.localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, next ? "expanded" : "collapsed");
      } catch {}
      return next;
    });
  };

  const SIDEBAR_BG = "#0d1117";

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">

        {/* ─── Desktop sidebar ─────────────────────────────────────────────── */}
        <aside
          className={[
            "relative hidden shrink-0 flex-col border-r border-white/[0.06] text-white lg:flex",
            "transition-[width] duration-300 ease-in-out",
            sidebarExpanded ? "w-56" : "w-[52px]",
          ].join(" ")}
          style={{ background: SIDEBAR_BG }}
        >
          {/* Brand + toggle */}
          <div
            className={[
              "flex shrink-0 items-center border-b border-white/[0.06]",
              sidebarExpanded
                ? "justify-between gap-2.5 px-4 py-[14px]"
                : "flex-col gap-2 px-[10px] py-3",
            ].join(" ")}
          >
            <div className={["flex items-center", sidebarExpanded ? "gap-2.5" : "justify-center"].join(" ")}>
              <BrandMark />
              {sidebarExpanded && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                    PADIS
                  </p>
                  <p className="text-[13px] font-bold leading-tight text-white">
                    Control Center
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              className="rounded-md p-1 text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
            >
              {sidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto">
            <SidebarNav pathname={pathname} collapsed={!sidebarExpanded} />
          </div>

          {/* Footer: env indicator */}
          <div className="flex shrink-0 items-center justify-center border-t border-white/[0.06] py-3">
            {sidebarExpanded ? (
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-medium text-white/35">Production</span>
              </div>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Production" />
            )}
          </div>
        </aside>

        {/* ─── Mobile drawer ───────────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            <aside
              className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-white/[0.06] shadow-2xl"
              style={{ background: SIDEBAR_BG }}
            >
              {/* Mobile brand header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-[14px]">
                <div className="flex items-center gap-2.5">
                  <BrandMark />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                      PADIS
                    </p>
                    <p className="text-[13px] font-bold leading-tight text-white">
                      Control Center
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nav */}
              <div className="flex-1 overflow-y-auto">
                <SidebarNav
                  pathname={pathname}
                  collapsed={false}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>

              {/* Mobile footer */}
              <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-medium text-white/35">Production Admin</span>
              </div>
            </aside>
          </div>
        )}

        {/* ─── Main area ───────────────────────────────────────────────────── */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Top header */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm sm:px-5">
            <div className="flex items-center justify-between gap-4">

              {/* Left: hamburger + page context */}
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Buka menu"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 lg:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>

                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
                    ADMIN PANEL
                  </p>
                  <h2 className="truncate text-base font-bold leading-tight text-slate-900">
                    {pageTitle}
                  </h2>
                  <p className="mt-0.5 hidden truncate text-xs leading-relaxed text-slate-500 sm:block">
                    {pageDescription}
                  </p>
                </div>
              </div>

              {/* Right: actions cluster */}
              <div className="flex shrink-0 items-center gap-2">
                {/* Dashboard shortcut */}
                <Link
                  href="/dashboard"
                  className="hidden items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
                >
                  Dashboard User
                </Link>

                {/* User badge */}
                {user && (
                  <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-3 md:flex">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #1e7b4c 0%, #0d4f2f 100%)" }}
                    >
                      {userInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-[140px] truncate text-[12px] font-semibold leading-tight text-slate-800">
                        {user.name}
                      </p>
                      {user.role && (
                        <p className="text-[10px] leading-none text-slate-400">{user.role}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Logout */}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Logout"
                  aria-label="Logout"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 xl:px-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
