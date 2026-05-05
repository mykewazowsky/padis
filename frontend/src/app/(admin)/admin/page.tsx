"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BookOpen,
  Clock3,
  Database,
  FileOutput,
  FolderTree,
  PlayCircle,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

import { fetchJsonWithAuth } from "../../../lib/fetcher-auth";

type AdminSummary = {
  raw_count?: number;
  processed_count?: number;
  registry_count?: number;
  active_count?: number;
  latest_update?: string | null;
};

type AdminDataResponse = {
  summary?: AdminSummary;
};

type AdminOutputItem = {
  filename: string;
  category?: string;
  status?: string;
  modified_at?: string | null;
};

type AdminProcessStatus = {
  status?: string;
  message?: string;
  hazard?: string;
  current_script?: string | null;
  progress_percent?: number;
  started_at?: string | null;
};

type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive";
};

const DEFAULT_SUMMARY: AdminSummary = {
  raw_count: 0,
  processed_count: 0,
  registry_count: 0,
  active_count: 0,
  latest_update: null,
};

const POLL_INTERVAL_MS = 8000;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function capitalize(text?: string | null) {
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

type ToneName = "green" | "amber" | "red" | "blue" | "slate";

function toneCls(tone: ToneName, part: "border" | "bg" | "text" | "badge") {
  const map: Record<ToneName, Record<typeof part, string>> = {
    green: {
      border: "border-green-200",
      bg:     "bg-green-50",
      text:   "text-green-700",
      badge:  "border-green-200 bg-green-50 text-green-700",
    },
    amber: {
      border: "border-amber-200",
      bg:     "bg-amber-50",
      text:   "text-amber-700",
      badge:  "border-amber-200 bg-amber-50 text-amber-700",
    },
    red: {
      border: "border-red-200",
      bg:     "bg-red-50",
      text:   "text-red-700",
      badge:  "border-red-200 bg-red-50 text-red-700",
    },
    blue: {
      border: "border-blue-200",
      bg:     "bg-blue-50",
      text:   "text-blue-700",
      badge:  "border-blue-200 bg-blue-50 text-blue-700",
    },
    slate: {
      border: "border-slate-200",
      bg:     "bg-slate-50",
      text:   "text-slate-600",
      badge:  "border-slate-200 bg-slate-50 text-slate-600",
    },
  };
  return map[tone][part];
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dataSummary, setDataSummary] = useState<AdminSummary>(DEFAULT_SUMMARY);
  const [outputs, setOutputs] = useState<AdminOutputItem[]>([]);
  const [processStatus, setProcessStatus] = useState<AdminProcessStatus | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const pollingRef  = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const loadOverview = useCallback(async (showRefresh = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (showRefresh) setRefreshing(true);
    setLoadError("");

    try {
      const [dataRes, outputsRes, processRes, usersRes] = await Promise.allSettled([
        fetchJsonWithAuth<AdminDataResponse>("/api/admin/data",          { redirectToLogin: true }),
        fetchJsonWithAuth<AdminOutputItem[]>("/api/admin/outputs",       { redirectToLogin: true }),
        fetchJsonWithAuth<AdminProcessStatus>("/api/admin/process-status", { redirectToLogin: true }),
        fetchJsonWithAuth<AdminUserItem[]>("/api/admin/users",           { redirectToLogin: true }),
      ]);

      const errors: string[] = [];

      if (dataRes.status    === "fulfilled") setDataSummary(dataRes.value?.summary ?? DEFAULT_SUMMARY);
      else { setDataSummary(DEFAULT_SUMMARY); errors.push("data"); }

      if (outputsRes.status === "fulfilled") setOutputs(Array.isArray(outputsRes.value) ? outputsRes.value : []);
      else { setOutputs([]); errors.push("output"); }

      if (processRes.status === "fulfilled") setProcessStatus(processRes.value ?? null);
      else { setProcessStatus(null); errors.push("proses"); }

      if (usersRes.status   === "fulfilled") setUsers(Array.isArray(usersRes.value) ? usersRes.value : []);
      else { setUsers([]); errors.push("user"); }

      if (errors.length > 0) setLoadError(`Sebagian data gagal dimuat: ${errors.join(", ")}.`);
      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      setLoadError(err?.message || "Gagal memuat data admin.");
      setDataSummary(DEFAULT_SUMMARY); setOutputs([]); setProcessStatus(null); setUsers([]);
    } finally {
      setLoading(false); setRefreshing(false); inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadOverview();
    pollingRef.current = window.setInterval(() => loadOverview(false), POLL_INTERVAL_MS);
    return () => { if (pollingRef.current) window.clearInterval(pollingRef.current); };
  }, [loadOverview]);

  const totalAdmins       = useMemo(() => users.filter((u) => u.role === "admin").length,    [users]);
  const totalActiveUsers  = useMemo(() => users.filter((u) => u.status === "active").length, [users]);
  const totalInactive     = useMemo(() => Math.max(0, users.length - totalActiveUsers),       [users.length, totalActiveUsers]);
  const outputReadyCount  = useMemo(() => outputs.length,                                     [outputs]);
  const latestUpdate      = useMemo(() => formatDateTime(dataSummary.latest_update),           [dataSummary.latest_update]);
  const lastSyncedLabel   = useMemo(() => formatDateTime(lastSyncedAt),                        [lastSyncedAt]);

  // ── Summary cards ──────────────────────────────────────────────────────────

  const processDisplay = useMemo(() => {
    if (!processStatus) return { label: "–", desc: "Status belum tersedia.", tone: "slate" as ToneName };
    if (processStatus.status === "running")
      return { label: `Running ${processStatus.progress_percent ?? 0}%`, desc: processStatus.message || "Proses berjalan.", tone: "amber" as ToneName };
    if (processStatus.status === "success")
      return { label: "Idle (OK)", desc: processStatus.message || "Proses terakhir berhasil.", tone: "green" as ToneName };
    if (processStatus.status === "failed")
      return { label: "Gagal", desc: processStatus.message || "Proses terakhir gagal.", tone: "red" as ToneName };
    return { label: capitalize(processStatus.status || "idle"), desc: processStatus.message || "", tone: "slate" as ToneName };
  }, [processStatus]);

  const summaryCards = useMemo(() => [
    {
      key:   "system",
      label: "Sistem",
      value: loadError ? "Degraded" : "Online",
      desc:  loadError ? "Ada data yang gagal dimuat." : "Backend aktif dan dapat diakses.",
      tone:  (loadError ? "red" : "green") as ToneName,
      icon:  Activity,
    },
    {
      key:   "process",
      label: "Proses",
      value: processDisplay.label,
      desc:  processDisplay.desc,
      tone:  processDisplay.tone,
      icon:  PlayCircle,
    },
    {
      key:   "output",
      label: "Output",
      value: outputReadyCount > 0 ? `${outputReadyCount} file` : "–",
      desc:  outputReadyCount > 0 ? "Hasil analisis tersedia." : "Belum ada output.",
      tone:  (outputReadyCount > 0 ? "blue" : "slate") as ToneName,
      icon:  FileOutput,
    },
    {
      key:   "users",
      label: "Pengguna",
      value: `${users.length}`,
      desc:  `${totalAdmins} admin · ${totalActiveUsers} aktif`,
      tone:  "slate" as ToneName,
      icon:  Users,
    },
  ], [loadError, processDisplay, outputReadyCount, users.length, totalAdmins, totalActiveUsers]);

  // ── Alerts ─────────────────────────────────────────────────────────────────

  const alerts = useMemo(() => {
    const list: { title: string; desc: string; tone: ToneName }[] = [];
    if (loadError)
      list.push({ title: "Sebagian data tidak berhasil dimuat", desc: loadError, tone: "red" });
    if (processStatus?.status === "failed")
      list.push({ title: "Proses terakhir gagal", desc: processStatus.message || "Periksa Process Control.", tone: "red" });
    if (processStatus?.status === "running")
      list.push({ title: `Proses berjalan (${processStatus.progress_percent ?? 0}%)`, desc: processStatus.message || "", tone: "amber" });
    if (outputReadyCount === 0)
      list.push({ title: "Belum ada output", desc: "Jalankan pipeline untuk menghasilkan file analisis.", tone: "amber" });
    if (totalInactive > 0)
      list.push({ title: `${totalInactive} akun tidak aktif`, desc: "Perlu ditinjau di halaman Users.", tone: "amber" });
    return list.slice(0, 4);
  }, [loadError, processStatus, outputReadyCount, totalInactive]);

  // ── Contextual CTA ─────────────────────────────────────────────────────────

  const cta = useMemo(() => {
    if (processStatus?.status === "running")
      return { label: "Pipeline sedang berjalan", desc: `Progress ${processStatus.progress_percent ?? 0}%`, href: "/admin/process-control", cta: "Pantau Pipeline", tone: "amber" as ToneName };
    if (processStatus?.status === "failed")
      return { label: "Pipeline terakhir gagal", desc: processStatus.message || "", href: "/admin/process-control", cta: "Tinjau & Jalankan Ulang", tone: "red" as ToneName };
    if (!processStatus || processStatus.status === "idle")
      return { label: "Belum ada proses aktif", desc: "Mulai pipeline baru.", href: "/admin/process-control", cta: "Mulai Pipeline", tone: "blue" as ToneName };
    return null;
  }, [processStatus]);

  // ── Nav shortcuts ───────────────────────────────────────────────────────────

  const navItems = [
    { href: "/admin/data-management",  icon: Database,   label: "Data",          desc: "Kelola data input pipeline" },
    { href: "/admin/process-control",  icon: PlayCircle,  label: "Process Control", desc: "Jalankan & pantau pipeline" },
    { href: "/admin/pipeline-monitor", icon: FolderTree,  label: "Pipeline Monitor", desc: "Riwayat run & aktivasi" },
    { href: "/admin/outputs",          icon: FileOutput,  label: "Outputs",       desc: "Unduh hasil analisis" },
    { href: "/admin/users",            icon: Users,       label: "Users",         desc: "Kelola akun & akses" },
    { href: "/admin/guide",            icon: BookOpen,    label: "Panduan",       desc: "Dokumentasi operasional" },
  ];

  return (
    <main className="space-y-5">

      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">OVERVIEW</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Dashboard Admin</h1>
          <p className="mt-1 text-xs text-slate-500">
            Auto-refresh setiap {POLL_INTERVAL_MS / 1000}s ·{" "}
            sinkron: <span className="font-semibold text-slate-700">{lastSyncedLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadOverview(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing || loading ? "animate-spin" : ""}`} />
          {refreshing ? "Memuat…" : "Refresh"}
        </button>
      </section>

      {/* Contextual CTA */}
      {!loading && cta && (
        <section className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${toneCls(cta.tone, "border")} ${toneCls(cta.tone, "bg")}`}>
          <div>
            <p className={`text-sm font-semibold ${toneCls(cta.tone, "text")}`}>{cta.label}</p>
            {cta.desc && <p className={`mt-0.5 text-xs ${toneCls(cta.tone, "text")} opacity-80`}>{cta.desc}</p>}
          </div>
          <Link
            href={cta.href}
            className={`shrink-0 self-start rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition ${
              cta.tone === "amber" ? "bg-amber-600 hover:bg-amber-700" :
              cta.tone === "red"   ? "bg-red-600   hover:bg-red-700"   :
                                     "bg-blue-600  hover:bg-blue-700"
            }`}
          >
            {cta.cta}
          </Link>
        </section>
      )}

      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="mt-3 h-7 w-24 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-full rounded bg-slate-200" />
              </div>
            ))
          : summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-500">{card.label}</p>
                    <div className={`rounded-lg p-1.5 ${toneCls(card.tone, "bg")}`}>
                      <Icon className={`h-3.5 w-3.5 ${toneCls(card.tone, "text")}`} />
                    </div>
                  </div>
                  <p className={`mt-2 text-xl font-bold ${toneCls(card.tone, "text")}`}>{card.value}</p>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
      </section>

      {/* Alerts + Process snapshot */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Alerts */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">PERHATIAN</p>
              <h2 className="mt-0.5 text-base font-bold text-slate-900">Butuh Tindakan</h2>
            </div>
            {alerts.length > 0
              ? <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{alerts.length}</span>
              : <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">OK</span>
            }
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-700">
              Tidak ada alert aktif. Sistem terlihat stabil.
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((item, i) => (
                <div
                  key={`${item.title}-${i}`}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${toneCls(item.tone, "border")} ${toneCls(item.tone, "bg")}`}
                >
                  <AlertCircle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${toneCls(item.tone, "text")}`} />
                  <div>
                    <p className={`text-xs font-semibold ${toneCls(item.tone, "text")}`}>{item.title}</p>
                    {item.desc && <p className={`mt-0.5 text-xs ${toneCls(item.tone, "text")} opacity-80`}>{item.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Process snapshot */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">PROSES</p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">Status Pipeline</h2>
          </div>

          <div className="space-y-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
              <p className={`mt-0.5 text-sm font-bold ${
                processStatus?.status === "running" ? "text-amber-600" :
                processStatus?.status === "success" ? "text-green-600" :
                processStatus?.status === "failed"  ? "text-red-600"   : "text-slate-700"
              }`}>
                {capitalize(processStatus?.status || "–")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Progress</p>
                <p className="text-xs font-bold text-slate-700">{processStatus?.progress_percent ?? 0}%</p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    processStatus?.status === "failed"  ? "bg-red-400" :
                    processStatus?.status === "success" ? "bg-green-500" : "bg-[var(--color-primary)]"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, processStatus?.progress_percent ?? 0))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hazard</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-700">{capitalize(processStatus?.hazard || "–")}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tahap</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-700">{capitalize(processStatus?.current_script || "–")}</p>
              </div>
            </div>

            {processStatus?.message && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Keterangan</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{processStatus.message}</p>
              </div>
            )}
          </div>

          <Link
            href="/admin/process-control"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Buka Process Control
          </Link>
        </div>
      </section>

      {/* Data stats + quick nav */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Data stats — compact */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">DATA</p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">Ringkasan Data</h2>
          </div>
          <dl className="space-y-2">
            {[
              { label: "Raw",       value: dataSummary.raw_count ?? 0 },
              { label: "Processed", value: dataSummary.processed_count ?? 0 },
              { label: "Active",    value: dataSummary.active_count ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-sm font-bold text-slate-900">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <dt className="text-xs text-slate-500">Update terakhir</dt>
              <dd className="text-xs font-semibold text-slate-600">{latestUpdate}</dd>
            </div>
          </dl>
          <Link
            href="/admin/data-management"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Database className="h-3.5 w-3.5" />
            Kelola Data
          </Link>
        </div>

        {/* Quick nav */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">NAVIGASI</p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">Halaman Admin</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col gap-2 rounded-xl border border-slate-200 p-3 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                >
                  <Icon className="h-4 w-4 text-slate-500 transition group-hover:text-[var(--color-primary)]" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent outputs — compact */}
      {outputs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">OUTPUT</p>
              <h2 className="mt-0.5 text-base font-bold text-slate-900">Hasil Terbaru</h2>
            </div>
            <Link href="/admin/outputs" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
              Lihat semua →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {[...outputs]
              .sort((a, b) => (new Date(b.modified_at ?? 0).getTime()) - (new Date(a.modified_at ?? 0).getTime()))
              .slice(0, 4)
              .map((item, i) => (
                <div key={`${item.filename}-${i}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900" title={item.filename}>{item.filename}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {item.category ?? "–"} · {item.status ?? "–"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[10px] text-slate-400">{formatDateTime(item.modified_at)}</p>
                </div>
              ))}
          </div>
        </section>
      )}

    </main>
  );
}
