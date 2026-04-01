"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CloudRain,
  Layers3,
  LogOut,
  Menu,
  ShieldCheck,
  User2,
  X,
  Home,
  Workflow,
  Info,
  LayoutDashboard,
} from "lucide-react";

import { buildApiUrl } from "../lib/api";
import { clearToken, getToken } from "../lib/auth";

type UserInfo = {
  id?: string;
  email: string;
  name: string;
  role?: string;
  status?: string;
};

type MeResponse = {
  user?: UserInfo | null;
};

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Beranda" },
  { href: "/cara-kerja", label: "Cara Kerja" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "Tentang Kami" },
];

const ADMIN_NAV_ITEMS: NavItem[] = [{ href: "/admin", label: "Admin" }];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getVisibleNavItems(user: UserInfo | null, isAuthenticated: boolean) {
  if (!isAuthenticated) return NAV_ITEMS;
  if (user?.role === "admin") return [...NAV_ITEMS, ...ADMIN_NAV_ITEMS];
  return NAV_ITEMS;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/10">
      <Image
        src="/logo/padis.svg"
        alt="PADIS"
        width={44}
        height={44}
        className="h-9 w-9 object-contain"
        priority
      />
    </div>

      <div className="min-w-0">
        <p className="text-xl font-bold tracking-tight text-gray-900">PADIS</p>
        <p className="hidden text-xs text-gray-500 sm:block">
          Paddy Disaster Information System
        </p>
      </div>
    </Link>
  );
}

function CenterNav({
  pathname,
  isAuthenticated,
  user,
}: {
  pathname: string;
  isAuthenticated: boolean;
  user: UserInfo | null;
}) {
  const items = getVisibleNavItems(user, isAuthenticated);

  return (
    <nav className="hidden xl:flex items-center justify-center gap-8">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative pb-1 text-sm font-medium transition ${
              active
                ? "text-[var(--color-primary)]"
                : "text-gray-600 hover:text-[var(--color-primary)]"
            }`}
          >
            {item.label}
            <span
              className={`absolute left-0 -bottom-[8px] h-[2px] w-full bg-[var(--color-primary)] transition-opacity duration-200 ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

function UserBadge({
  user,
  onLogout,
}: {
  user: UserInfo;
  onLogout: () => void;
}) {
  const isAdmin = user.role === "admin";

  return (
    <div className="hidden xl:flex items-center gap-3">
      <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-2">
        <div className="rounded-xl bg-white/80 p-2">
          {isAdmin ? (
            <ShieldCheck
              className="h-4 w-4 text-[var(--color-secondary-dark)]"
              aria-hidden="true"
            />
          ) : (
            <User2
              className="h-4 w-4 text-[var(--color-secondary-dark)]"
              aria-hidden="true"
            />
          )}
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-secondary-dark)]">
            Masuk sebagai
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {user?.name || "Pengguna"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-red-500"
        aria-label="Keluar dari akun"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span>Keluar</span>
      </button>
    </div>
  );
}

function MobileMenu({
  pathname,
  isAuthenticated,
  authChecked,
  user,
  onLogout,
  onClose,
  isOpen,
}: {
  pathname: string;
  isAuthenticated: boolean;
  authChecked: boolean;
  user: UserInfo | null;
  onLogout: () => void;
  onClose: () => void;
  isOpen: boolean;
}) {
  const items = getVisibleNavItems(user, isAuthenticated);

  return (
    <>
      <div
        className={`fixed inset-0 z-[1250] bg-slate-950/45 transition-opacity duration-300 xl:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed left-0 right-0 top-[73px] z-[1260] border-t border-gray-200 bg-white shadow-xl transition-all duration-300 xl:hidden ${
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="section-container py-5">
          <div className="space-y-1">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between border-b border-gray-100 py-4 text-sm font-medium transition ${
                    active
                      ? "text-[var(--color-primary)]"
                      : "text-gray-700 hover:text-[var(--color-primary)]"
                  }`}
                >
                  <span>{item.label}</span>
                  {active ? (
                    <span className="h-[2px] w-6 bg-[var(--color-primary)]" />
                  ) : (
                    <span className="text-xs text-gray-400">›</span>
                  )}
                </Link>
              );
            })}
          </div>
                       
          <div className="mt-5 border-t border-gray-200 pt-5">
            {authChecked ? (
              isAuthenticated && user ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white/80 p-2">
                        {user?.role === "admin" ? (
                          <ShieldCheck
                            className="h-4 w-4 text-[var(--color-secondary-dark)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <User2
                            className="h-4 w-4 text-[var(--color-secondary-dark)]"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-secondary-dark)]">
                          Masuk sebagai
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {user?.name || "Pengguna"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {user?.email || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    aria-label="Keluar dari akun"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-red-500"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Keluar</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/login"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Masuk
                  </Link>

                  <Link
                    href="/register"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
                  >
                    Daftar
                  </Link>
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function FooterNav({
  pathname,
  isAuthenticated,
  user,
}: {
  pathname: string;
  isAuthenticated: boolean;
  user: UserInfo | null;
}) {
  const items = getVisibleNavItems(user, isAuthenticated);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={
                active
                  ? "font-semibold text-white"
                  : "text-blue-100 transition hover:text-[var(--color-secondary)]"
              }
            >
              {item.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export default function SiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMounted, setMobileMounted] = useState(false);

  const meUrl = useMemo(() => buildApiUrl("/api/me"), []);
  const logoutUrl = useMemo(() => buildApiUrl("/api/logout"), []);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const token = getToken();

      if (!token) {
        if (!isMounted) return;
        setIsAuthenticated(false);
        setUser(null);
        setAuthChecked(true);
        return;
      }

      try {
        const res = await fetch(meUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Sesi tidak valid");
        }

        const json: MeResponse = await res.json();
        const currentUser = json.user ?? null;

        if (!currentUser) {
          throw new Error("User tidak ditemukan");
        }

        if (!isMounted) return;
        setIsAuthenticated(true);
        setUser(currentUser);
      } catch {
        clearToken();
        if (!isMounted) return;
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [pathname, meUrl]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      setMobileMounted(true);
      document.body.style.overflow = "hidden";
      return;
    }

    document.body.style.overflow = "";
    const t = setTimeout(() => setMobileMounted(false), 300);
    return () => clearTimeout(t);
  }, [mobileOpen]);

  async function handleLogout() {
    const token = getToken();

    try {
      if (token) {
        await fetch(logoutUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // no-op
    } finally {
      clearToken();
      setIsAuthenticated(false);
      setUser(null);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-[1200] border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="section-container py-4">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 xl:grid-cols-3">
            <div className="flex items-center">
              <Brand />
            </div>

            <CenterNav
              pathname={pathname}
              isAuthenticated={isAuthenticated}
              user={user}
            />

            <div className="flex items-center justify-end gap-4">
              {authChecked && isAuthenticated && user ? (
                <UserBadge user={user} onLogout={handleLogout} />
              ) : authChecked ? (
                <>
                  <Link
                    href="/login"
                    className="hidden xl:inline-flex text-sm font-medium text-gray-500 transition hover:text-[var(--color-primary)]"
                  >
                    Masuk
                  </Link>

                  <Link
                    href="/register"
                    className="hidden xl:inline-flex rounded-full bg-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
                  >
                    Daftar
                  </Link>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 xl:hidden"
                aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {mobileMounted ? (
            <MobileMenu
              pathname={pathname}
              isAuthenticated={isAuthenticated}
              authChecked={authChecked}
              user={user}
              onLogout={handleLogout}
              onClose={() => setMobileOpen(false)}
              isOpen={mobileOpen}
            />
          ) : null}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-[var(--color-dark-bg)] text-white">
        <div className="section-container py-12">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white">
                  <Image
                    src="/logo/padis.svg"
                    alt="PADIS"
                    width={40}
                    height={40}
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">PADIS</h3>
                  <p className="text-sm text-blue-100">
                    Paddy Disaster Information System
                  </p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-blue-100">
                Platform WebGIS untuk analisis kerugian padi berbasis bencana banjir,
                kekeringan, multi-hazard, kondisi iklim dan non-iklim, serta analisis
                spasial risiko wilayah.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary)]">
                Navigasi
              </p>
              <div className="mt-4">
                <FooterNav
                  pathname={pathname}
                  isAuthenticated={isAuthenticated}
                  user={user}
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary)]">
                Cakupan Sistem
              </p>
              <div className="mt-4 space-y-3 text-sm text-blue-100">
                <div className="flex items-start gap-3">
                  <Layers3 className="mt-0.5 h-4 w-4 text-[var(--color-secondary)]" />
                  <p>Banjir, Kekeringan, dan Multi-hazard</p>
                </div>
                <div className="flex items-start gap-3">
                  <CloudRain className="mt-0.5 h-4 w-4 text-[var(--color-secondary)]" />
                  <p>Iklim & Non-Iklim, Periode Ulang 25, 50, 100, dan 250</p>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="mt-0.5 h-4 w-4 text-[var(--color-secondary)]" />
                  <p>Luaran utama: Kerugian Langsung, AAL, dan visualisasi WebGIS</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary)]">
                Konteks Proyek
              </p>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-blue-100">
                <p>
                  Capstone Project
                  <br />
                  Program Studi Teknik Geodesi dan Geomatika
                  <br />
                  Fakultas Ilmu dan Teknologi Kebumian
                  <br />
                  Institut Teknologi Bandung
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-5">
            <div className="flex flex-col gap-3 text-xs text-blue-100/80 md:flex-row md:items-center md:justify-between">
              <p>© 2026 PADIS. Hak cipta dilindungi.</p>
              <p>
                WebGIS untuk eksplorasi risiko kerugian padi berbasis analisis spasial.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}