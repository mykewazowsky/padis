"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LogOut,
  Mail,
  Menu,
  ShieldCheck,
  User2,
  X,
} from "lucide-react";

import { buildApiUrl } from "@/lib/api";
import { clearToken, decodeToken, getToken } from "@/lib/auth";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";

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
  labelKey: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/",           labelKey: "nav.home" },
  { href: "/cara-kerja", labelKey: "nav.caraKerja" },
  { href: "/metodologi", labelKey: "nav.metodologi" },
  { href: "/dashboard",  labelKey: "nav.dashboard" },
  { href: "/about",      labelKey: "nav.about" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getVisibleNavItems() {
  return NAV_ITEMS;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[var(--theme-brand-chip-bg)] shadow-sm">
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
        <p className="text-xl font-bold tracking-tight text-[var(--theme-shell-text)]">PADIS</p>
        <p className="hidden text-xs text-[var(--theme-shell-text-muted)] sm:block">
          Paddy Disaster Information System
        </p>
      </div>
    </Link>
  );
}

function CenterNav({ pathname }: { pathname: string }) {
  const { t } = useLanguage();
  const items = getVisibleNavItems();

  return (
    <nav className="hidden xl:flex items-center justify-center gap-8 flex-nowrap whitespace-nowrap min-w-0">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative pb-1 text-sm font-medium transition ${
              active
                ? "text-[var(--color-primary)]"
                : "text-[var(--theme-shell-text-muted)] hover:text-[var(--color-primary)]"
            }`}
          >
            {t(item.labelKey)}
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

function UserBadge({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const { t } = useLanguage();
  const isAdmin = user.role === "admin";

  return (
    <div className="hidden xl:flex items-center gap-3">
      <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--theme-shell-border)] bg-[var(--theme-shell-surface-muted)] px-4 py-2">
        <div className="rounded-xl border border-[var(--theme-shell-border-subtle)] bg-[var(--theme-shell-surface)] p-2">
          {isAdmin ? (
            <ShieldCheck className="h-4 w-4 text-[var(--color-secondary-dark)]" aria-hidden="true" />
          ) : (
            <User2 className="h-4 w-4 text-[var(--color-secondary-dark)]" aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--theme-shell-text-muted)]">
            {t("common.signedInAs")}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--theme-shell-text)]">
            {user?.name || t("nav.home")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--theme-shell-text-muted)] transition hover:text-red-500"
        aria-label={t("nav.logoutAria")}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span>{t("nav.logout")}</span>
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
  const { t } = useLanguage();
  const items = getVisibleNavItems();

  return (
    <>
      <div
        className={`fixed inset-0 z-[1250] bg-slate-950/45 transition-opacity duration-300 xl:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed left-0 right-0 top-[73px] z-[1260] border-t border-[var(--theme-shell-border)] bg-[var(--theme-shell-bg-solid)] shadow-[var(--theme-shell-shadow)] transition-all duration-300 xl:hidden ${
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
                  className={`flex items-center justify-between border-b border-[var(--theme-shell-border-subtle)] py-4 text-sm font-medium transition ${
                    active
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--theme-shell-text)] hover:text-[var(--color-primary)]"
                  }`}
                >
                  <span>{t(item.labelKey)}</span>
                  {active ? (
                    <span className="h-[2px] w-6 bg-[var(--color-primary)]" />
                  ) : (
                    <span className="text-xs text-[var(--theme-shell-text-soft)]">›</span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-5 space-y-4 border-t border-[var(--theme-shell-border)] pt-5">
            <div className="flex items-center gap-3">
              <ThemeToggle mobile />
              <LanguageToggle />
            </div>

            {authChecked ? (
              isAuthenticated && user ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--theme-shell-border)] bg-[var(--theme-shell-surface-muted)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-[var(--theme-shell-border-subtle)] bg-[var(--theme-shell-surface)] p-2">
                        {user?.role === "admin" ? (
                          <ShieldCheck className="h-4 w-4 text-[var(--color-secondary-dark)]" aria-hidden="true" />
                        ) : (
                          <User2 className="h-4 w-4 text-[var(--color-secondary-dark)]" aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--theme-shell-text-muted)]">
                          {t("common.signedInAs")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--theme-shell-text)]">
                          {user?.name}
                        </p>
                        <p className="text-xs text-[var(--theme-shell-text-muted)]">
                          {user?.email || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { onLogout(); onClose(); }}
                    aria-label={t("nav.logoutAria")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--theme-shell-border)] px-4 py-3 text-sm font-medium text-[var(--theme-shell-text)] transition hover:bg-[var(--theme-toggle-hover)] hover:text-red-500"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>{t("nav.logout")}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/login"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full border border-[var(--theme-shell-border)] px-4 py-3 text-sm font-medium text-[var(--theme-shell-text)] transition hover:bg-[var(--theme-toggle-hover)]"
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    href="/register"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary-dark)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
                  >
                    {t("nav.register")}
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

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Tracks timestamp of last server-side auth check to throttle per-navigation calls.
  const lastAuthCheckRef = useRef(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMounted, setMobileMounted] = useState(false);

  const meUrl = useMemo(() => buildApiUrl("/api/me"), []);
  const logoutUrl = useMemo(() => buildApiUrl("/api/logout"), []);

  useEffect(() => {
    const payload = decodeToken();
    if (payload) {
      setIsAuthenticated(true);
      setUser({ email: payload.email ?? "", name: payload.name ?? "", role: payload.role, status: payload.status });
      setAuthChecked(true);
    } else if (!getToken()) {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    // Throttle: skip server round-trip if checked within the last 5 minutes.
    // The synchronous JWT decode above keeps UI state accurate between checks.
    if (lastAuthCheckRef.current > 0 && now - lastAuthCheckRef.current < 5 * 60_000) return;
    lastAuthCheckRef.current = now;

    let isMounted = true;
    async function checkAuth() {
      const token = getToken();
      if (!token) {
        if (!isMounted) return;
        setIsAuthenticated(false); setUser(null); setAuthChecked(true);
        return;
      }
      try {
        const res = await fetch(meUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) {
          clearToken();
          if (!isMounted) return;
          setIsAuthenticated(false); setUser(null); setAuthChecked(true);
          return;
        }
        if (!res.ok) { if (!isMounted) return; setAuthChecked(true); return; }
        const json: MeResponse = await res.json();
        const currentUser = json.user ?? null;
        if (!currentUser) {
          clearToken();
          if (!isMounted) return;
          setIsAuthenticated(false); setUser(null); setAuthChecked(true);
          return;
        }
        if (!isMounted) return;
        setIsAuthenticated(true); setUser(currentUser); setAuthChecked(true);
      } catch {
        if (!isMounted) return;
        setAuthChecked(true);
      }
    }
    checkAuth();
    return () => { isMounted = false; };
  }, [pathname, meUrl]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      setMobileMounted(true);
      document.body.style.overflow = "hidden";
      return;
    }
    document.body.style.overflow = "";
    const timer = setTimeout(() => setMobileMounted(false), 300);
    return () => clearTimeout(timer);
  }, [mobileOpen]);

  async function handleLogout() {
    const token = getToken();
    try {
      if (token) await fetch(logoutUrl, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch { /* no-op */ } finally {
      clearToken();
      setIsAuthenticated(false); setUser(null);
      router.push("/"); router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--theme-body-bg)] text-[var(--theme-body-text)] transition-colors duration-200">
      <header className="sticky top-0 z-[1200] border-b border-[var(--theme-shell-border)] bg-[var(--theme-shell-bg)] shadow-[var(--theme-shell-shadow)] backdrop-blur supports-[backdrop-filter]:bg-[var(--theme-shell-bg)]">
        <div className="section-container py-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 xl:grid-cols-3">
            <div className="flex items-center">
              <Brand />
            </div>

            <CenterNav pathname={pathname} />

            <div className="flex items-center justify-end gap-3">
              <LanguageToggle className="hidden xl:inline-flex" />
              <ThemeToggle />

              {authChecked && isAuthenticated && user ? (
                <UserBadge user={user} onLogout={handleLogout} />
              ) : authChecked ? (
                <>
                  <Link
                    href="/login"
                    className="hidden xl:inline-flex text-sm font-medium text-[var(--theme-shell-text-muted)] transition hover:text-[var(--color-primary)]"
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    href="/register"
                    className="hidden xl:inline-flex rounded-full bg-[var(--color-primary-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary)]"
                  >
                    {t("nav.register")}
                  </Link>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--theme-shell-border)] bg-[var(--theme-shell-surface)] text-[var(--theme-shell-text)] transition hover:bg-[var(--theme-toggle-hover)] xl:hidden"
                aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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

      <footer className="bg-[var(--color-dark-bg)] text-white">
        <div className="h-[2px] bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-secondary)] to-transparent" />

        <div className="section-container py-14">
          <div className="grid gap-12 md:grid-cols-[1.8fr_1fr_1fr]">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/10">
                  <Image src="/logo/padis.svg" alt="PADIS" width={44} height={44} className="h-9 w-9 object-contain" />
                </div>
                <div>
                  <p className="text-xl font-bold tracking-tight">PADIS</p>
                  <p className="text-xs text-white/45">Paddy Disaster Information System</p>
                </div>
              </div>

              <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">
                {t("footer.platformDesc")}
              </p>

              <a
                href="mailto:padiswebgis@gmail.com"
                className="mt-5 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
              >
                <Mail className="h-3.5 w-3.5" />
                {t("footer.contactEmail")}
              </a>
            </div>

            {/* Navigasi */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-secondary)]">
                {t("footer.navigationLabel")}
              </p>
              <nav className="mt-5 space-y-3">
                {getVisibleNavItems().map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block text-sm transition ${
                        active ? "font-semibold text-white" : "text-white/55 hover:text-white"
                      }`}
                    >
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Konteks Proyek */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-secondary)]">
                {t("footer.projectContext")}
              </p>
              <div className="mt-5">
                <div className="flex items-center gap-3">
                  <img src="/itb/itb.png" alt="ITB" className="h-8 w-auto opacity-75" />
                  <p className="text-sm font-medium text-white/75">Institut Teknologi Bandung</p>
                </div>
                <div className="mt-4 space-y-1 text-sm text-white/55">
                  <p>{t("footer.capstoneProject")}</p>
                  <p>{t("footer.program")}</p>
                  <p>{t("footer.faculty")}</p>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-white/35">{t("footer.allRightsReserved")}</p>
            <Link href="/kebijakan-privasi" className="text-xs text-white/35 transition hover:text-white/70">
              {t("nav.kebijakanPrivasi")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
