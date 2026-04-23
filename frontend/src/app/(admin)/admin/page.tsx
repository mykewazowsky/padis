"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Clock3,
  Database,
  FileOutput,
  FolderTree,
  Gauge,
  PlayCircle,
  RefreshCw,
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
  last_result?: string;
  message?: string;
  hazard?: string;
  mode?: string;
  current_script?: string | null;
  current_step?: number;
  total_steps?: number;
  progress_percent?: number;
  updated_outputs?: string[] | AdminOutputItem[];
  started_at?: string | null;
};

type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive";
};

type SummaryCard = {
  title: string;
  value: string;
  desc: string;
  valueClass: string;
  icon: React.ComponentType<{ className?: string }>;
  iconWrapClass: string;
  iconClass: string;
};

type NavItem = {
  title: string;
  href: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  iconWrapClass: string;
  iconClass: string;
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

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function capitalize(text?: string | null) {
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function getStatusTone(status?: string | null) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("degraded")
  ) {
    return "text-red-600";
  }

  if (
    normalized.includes("run") ||
    normalized.includes("progress") ||
    normalized.includes("warning")
  ) {
    return "text-amber-600";
  }

  if (
    normalized.includes("success") ||
    normalized.includes("online") ||
    normalized.includes("ok") ||
    normalized.includes("idle")
  ) {
    return "text-green-600";
  }

  return "text-slate-900";
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dataSummary, setDataSummary] = useState<AdminSummary>(DEFAULT_SUMMARY);
  const [outputs, setOutputs] = useState<AdminOutputItem[]>([]);
  const [processStatus, setProcessStatus] = useState<AdminProcessStatus | null>(
    null
  );
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const pollingRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const loadOverview = useCallback(async (showRefresh = false) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;

    if (showRefresh) {
      setRefreshing(true);
    }

    setLoadError("");

    try {
      const [dataRes, outputsRes, processRes, usersRes] =
        await Promise.allSettled([
          fetchJsonWithAuth<AdminDataResponse>("/api/admin/data", {
            redirectToLogin: true,
          }),
          fetchJsonWithAuth<AdminOutputItem[]>("/api/admin/outputs", {
            redirectToLogin: true,
          }),
          fetchJsonWithAuth<AdminProcessStatus>("/api/admin/process-status", {
            redirectToLogin: true,
          }),
          fetchJsonWithAuth<AdminUserItem[]>("/api/admin/users", {
            redirectToLogin: true,
          }),
        ]);

      const errors: string[] = [];

      if (dataRes.status === "fulfilled") {
        setDataSummary(dataRes.value?.summary ?? DEFAULT_SUMMARY);
      } else {
        setDataSummary(DEFAULT_SUMMARY);
        errors.push("ringkasan data");
      }

      if (outputsRes.status === "fulfilled") {
        setOutputs(Array.isArray(outputsRes.value) ? outputsRes.value : []);
      } else {
        setOutputs([]);
        errors.push("output");
      }

      if (processRes.status === "fulfilled") {
        setProcessStatus(processRes.value ?? null);
      } else {
        setProcessStatus(null);
        errors.push("status proses");
      }

      if (usersRes.status === "fulfilled") {
        setUsers(Array.isArray(usersRes.value) ? usersRes.value : []);
      } else {
        setUsers([]);
        errors.push("user");
      }

      if (errors.length > 0) {
        setLoadError(
          `Sebagian data overview gagal dimuat: ${errors.join(", ")}.`
        );
      }

      setLastSyncedAt(new Date().toISOString());
    } catch (err: any) {
      console.error("Failed to load admin overview:", err);
      setLoadError(err?.message || "Gagal memuat ringkasan overview admin.");
      setDataSummary(DEFAULT_SUMMARY);
      setOutputs([]);
      setProcessStatus(null);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadOverview();

    pollingRef.current = window.setInterval(() => {
      loadOverview(false);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
  }, [loadOverview]);

  const totalAdmins = useMemo(
    () => users.filter((user) => user.role === "admin").length,
    [users]
  );

  const totalActiveUsers = useMemo(
    () => users.filter((user) => user.status === "active").length,
    [users]
  );

  const totalInactiveUsers = useMemo(
    () => Math.max(0, users.length - totalActiveUsers),
    [users.length, totalActiveUsers]
  );

  const outputReadyCount = useMemo(() => outputs.length, [outputs]);

  const latestUpdate = useMemo(() => {
    return formatDateTime(dataSummary.latest_update);
  }, [dataSummary.latest_update]);

  const lastSyncedLabel = useMemo(() => {
    return formatDateTime(lastSyncedAt);
  }, [lastSyncedAt]);

  const processDisplay = useMemo(() => {
    if (!processStatus) {
      return {
        label: "Unknown",
        desc: "Status proses belum tersedia.",
        valueClass: "text-slate-900",
      };
    }

    if (processStatus.status === "running") {
      return {
        label: `Running ${processStatus.progress_percent ?? 0}%`,
        desc:
          processStatus.message ||
          "Proses sedang berjalan dan dipantau secara langsung.",
        valueClass: "text-amber-600",
      };
    }

    if (processStatus.last_result === "success") {
      return {
        label: "Idle (OK)",
        desc:
          processStatus.message ||
          "Tidak ada proses aktif dan hasil terakhir berhasil.",
        valueClass: "text-green-600",
      };
    }

    if (processStatus.last_result === "failed") {
      return {
        label: "Idle (Failed)",
        desc:
          processStatus.message ||
          "Tidak ada proses aktif, tetapi eksekusi terakhir gagal.",
        valueClass: "text-red-600",
      };
    }

    return {
      label: capitalize(processStatus.status || "idle"),
      desc: processStatus.message || "Status proses tersedia di sistem.",
      valueClass: "text-slate-900",
    };
  }, [processStatus]);

  const systemStatus = useMemo(() => {
    if (loadError) {
      return {
        label: "Degraded",
        desc: "Sebagian data overview gagal dimuat dari backend admin.",
        valueClass: "text-red-600",
      };
    }

    return {
      label: "Online",
      desc: "Frontend dan backend admin aktif dan dapat diakses.",
      valueClass: "text-green-600",
    };
  }, [loadError]);

  const outputState = useMemo(() => {
    if (outputReadyCount > 0) {
      return {
        label: `${outputReadyCount} Files`,
        desc: "Hasil analisis tersedia untuk dilihat atau diunduh.",
        valueClass: "text-[var(--color-primary)]",
      };
    }

    return {
      label: "No Output",
      desc: "Belum ada hasil analisis yang terdeteksi.",
      valueClass: "text-slate-900",
    };
  }, [outputReadyCount]);

  const userState = useMemo(() => {
    return {
      label: `${users.length} Users`,
      desc: `${totalAdmins} admin, ${totalActiveUsers} akun aktif di sistem.`,
      valueClass: "text-slate-900",
    };
  }, [users.length, totalAdmins, totalActiveUsers]);

  const summaryCards: SummaryCard[] = [
    {
      title: "Status Sistem",
      value: systemStatus.label,
      desc: systemStatus.desc,
      valueClass: systemStatus.valueClass,
      icon: Activity,
      iconWrapClass: "bg-green-50",
      iconClass: "text-green-600",
    },
    {
      title: "Status Proses",
      value: processDisplay.label,
      desc: processDisplay.desc,
      valueClass: processDisplay.valueClass,
      icon: PlayCircle,
      iconWrapClass: "bg-amber-50",
      iconClass: "text-amber-600",
    },
    {
      title: "Hasil Tersedia",
      value: outputState.label,
      desc: outputState.desc,
      valueClass: outputState.valueClass,
      icon: FileOutput,
      iconWrapClass: "bg-[var(--color-primary-soft)]",
      iconClass: "text-[var(--color-primary)]",
    },
    {
      title: "Pengguna",
      value: userState.label,
      desc: userState.desc,
      valueClass: userState.valueClass,
      icon: Users,
      iconWrapClass: "bg-purple-50",
      iconClass: "text-purple-600",
    },
  ];

  const alerts = useMemo(() => {
    const list: { title: string; desc: string; tone: string }[] = [];

    if (loadError) {
      list.push({
        title: "Sebagian data tidak berhasil dimuat",
        desc: loadError,
        tone: "red",
      });
    }

    if (processStatus?.last_result === "failed") {
      list.push({
        title: "Proses terakhir gagal",
        desc:
          processStatus.message ||
          "Periksa halaman Process Control untuk melihat detail masalah.",
        tone: "red",
      });
    }

    if (processStatus?.status === "running") {
      list.push({
        title: "Proses sedang berjalan",
        desc: `Progress ${processStatus.progress_percent ?? 0}%${
          processStatus.current_script
            ? ` · langkah aktif ${processStatus.current_script}`
            : ""
        }.`,
        tone: "amber",
      });
    }

    if (outputReadyCount === 0) {
      list.push({
        title: "Belum ada hasil analisis",
        desc: "Periksa proses dan data untuk memastikan semuanya siap.",
        tone: "amber",
      });
    }

    if ((dataSummary.raw_count ?? 0) > (dataSummary.processed_count ?? 0)) {
      list.push({
        title: "Sebagian data belum diproses",
        desc: `Raw data: ${dataSummary.raw_count ?? 0}, processed data: ${
          dataSummary.processed_count ?? 0
        }.`,
        tone: "amber",
      });
    }

    if (totalInactiveUsers > 0) {
      list.push({
        title: "Ada akun yang tidak aktif",
        desc: `${totalInactiveUsers} akun berstatus inactive dan perlu ditinjau.`,
        tone: "amber",
      });
    }

    return list.slice(0, 5);
  }, [
    loadError,
    processStatus,
    outputReadyCount,
    dataSummary.raw_count,
    dataSummary.processed_count,
    totalInactiveUsers,
  ]);

  const recentOutputs = useMemo(() => {
    return [...outputs]
      .sort((a, b) => {
        const aTime = a.modified_at ? new Date(a.modified_at).getTime() : 0;
        const bTime = b.modified_at ? new Date(b.modified_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [outputs]);

  const recentActivities = useMemo(() => {
    const items: {
      title: string;
      desc: string;
      time: string;
      tone: string;
    }[] = [];

    if (processStatus?.status === "running") {
      items.push({
        title: "Proses sedang berjalan",
        desc:
          processStatus.message ||
          `Langkah ${processStatus.current_step ?? 0} dari ${
            processStatus.total_steps ?? 0
          }.`,
        time: formatDateTime(processStatus.started_at),
        tone: "amber",
      });
    }

    if (processStatus?.last_result === "success") {
      items.push({
        title: "Proses terakhir berhasil",
        desc:
          processStatus.message || "Hasil terakhir berhasil diselesaikan sistem.",
        time: lastSyncedLabel,
        tone: "green",
      });
    }

    if (processStatus?.last_result === "failed") {
      items.push({
        title: "Proses terakhir gagal",
        desc:
          processStatus.message ||
          "Buka Process Control untuk meninjau proses terakhir.",
        time: lastSyncedLabel,
        tone: "red",
      });
    }

    if (recentOutputs[0]) {
      items.push({
        title: "Output terbaru tersedia",
        desc: recentOutputs[0].filename,
        time: formatDateTime(recentOutputs[0].modified_at),
        tone: "blue",
      });
    }

    if (latestUpdate !== "-") {
      items.push({
        title: "Data diperbarui",
        desc: "Ringkasan data terbaru tersedia di sistem.",
        time: latestUpdate,
        tone: "slate",
      });
    }

    return items.slice(0, 5);
  }, [processStatus, recentOutputs, latestUpdate, lastSyncedLabel]);

  const adminPages: NavItem[] = [
    {
      title: "Data Management",
      href: "/admin/data-management",
      desc: "Kelola data yang digunakan dalam sistem.",
      icon: Database,
      accentClass: "border-blue-200 bg-blue-50",
      iconWrapClass: "bg-white",
      iconClass: "text-blue-600",
    },
    {
      title: "Process Control",
      href: "/admin/process-control",
      desc: "Jalankan dan pantau proses analisis data.",
      icon: PlayCircle,
      accentClass: "border-amber-200 bg-amber-50",
      iconWrapClass: "bg-white",
      iconClass: "text-amber-600",
    },
    {
      title: "Pipeline Monitor",
      href: "/admin/pipeline-monitor",
      desc: "Lihat alur proses dan status setiap tahap.",
      icon: FolderTree,
      accentClass: "border-indigo-200 bg-indigo-50",
      iconWrapClass: "bg-white",
      iconClass: "text-indigo-600",
    },
    {
      title: "Outputs",
      href: "/admin/outputs",
      desc: "Lihat dan unduh hasil analisis.",
      icon: FileOutput,
      accentClass: "border-green-200 bg-green-50",
      iconWrapClass: "bg-white",
      iconClass: "text-green-600",
    },
    {
      title: "Users",
      href: "/admin/users",
      desc: "Kelola akun pengguna dan akses.",
      icon: Users,
      accentClass: "border-purple-200 bg-purple-50",
      iconWrapClass: "bg-white",
      iconClass: "text-purple-600",
    },
    {
      title: "Admin Guide",
      href: "/admin/guide",
      desc: "Panduan penggunaan sistem.",
      icon: BookOpen,
      accentClass: "border-emerald-200 bg-emerald-50",
      iconWrapClass: "bg-white",
      iconClass: "text-emerald-600",
    },
  ];

  const quickActions = [
    { label: "Data", href: "/admin/data-management" },
    { label: "Run Process", href: "/admin/process-control" },
    { label: "Pipeline", href: "/admin/pipeline-monitor" },
    { label: "Outputs", href: "/admin/outputs" },
  ];

  const renderNavGrid = (items: NavItem[]) => {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.href}
              className={`rounded-3xl border p-5 ${item.accentClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-2xl p-3 shadow-sm ${item.iconWrapClass}`}>
                  <Icon className={`h-5 w-5 ${item.iconClass}`} />
                </div>

                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 transition hover:text-slate-900"
                >
                  Buka
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.desc}
              </p>

              <div className="mt-5">
                <Link
                  href={item.href}
                  className="btn-outline text-sm font-medium"
                >
                  Buka Halaman
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              OVERVIEW
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Dashboard Admin
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
              Lihat kondisi sistem, status proses, dan hasil terbaru dalam satu
              tampilan.
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Auto refresh setiap {POLL_INTERVAL_MS / 1000} detik · terakhir
              sinkron:{" "}
              <span className="font-semibold text-slate-700">
                {lastSyncedLabel}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <div className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary-dark)]">
                Environment
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Development Mode
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadOverview(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing || loading ? "animate-spin" : ""
                }`}
              />
              {refreshing ? "Memuat..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="animate-pulse">
                  <div className="h-4 w-28 rounded bg-slate-200" />
                  <div className="mt-3 h-8 w-32 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-full rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-4/5 rounded bg-slate-200" />
                </div>
              </div>
            ))
          : summaryCards.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{item.title}</p>
                      <h2 className={`mt-2 text-2xl font-bold ${item.valueClass}`}>
                        {item.value}
                      </h2>
                    </div>

                    <div className={`rounded-2xl p-3 ${item.iconWrapClass}`}>
                      <Icon className={`h-5 w-5 ${item.iconClass}`} />
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {item.desc}
                  </p>
                </div>
              );
            })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                PERLU DILIHAT
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                Butuh Perhatian
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Informasi penting yang perlu dilihat sebelum membuka halaman
                lain.
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {alerts.length} Alert
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-8 text-sm text-green-700">
              Tidak ada alert aktif. Sistem terlihat stabil saat ini.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((item, index) => {
                const colorClass =
                  item.tone === "red"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-amber-200 bg-amber-50 text-amber-800";

                return (
                  <div
                    key={`${item.title}-${index}`}
                    className={`rounded-2xl border px-4 py-4 ${colorClass}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white p-2 shadow-sm">
                        <AlertCircle className="h-4 w-4 text-current" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed opacity-90">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              AKSES CEPAT
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Menu Utama
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Shortcut ke halaman yang paling sering dipakai.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="btn-outline text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              RINGKASAN DATA
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Kondisi Data
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Raw Data
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {dataSummary.raw_count ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Processed Data
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {dataSummary.processed_count ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active Sources
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {dataSummary.active_count ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Latest Update
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {latestUpdate}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              STATUS PROSES
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Proses Analisis
            </h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Current Status
                  </p>
                  <p
                    className={`mt-1 text-lg font-bold ${getStatusTone(
                      processStatus?.status || processStatus?.last_result
                    )}`}
                  >
                    {capitalize(
                      processStatus?.status === "running"
                        ? processStatus?.status
                        : processStatus?.last_result ||
                            processStatus?.status ||
                            "unknown"
                    )}
                  </p>
                </div>

                <Gauge className="h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progress
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {processStatus?.progress_percent ?? 0}%
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, processStatus?.progress_percent ?? 0)
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Langkah Aktif
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                  {processStatus?.current_script || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hazard / Mode
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {capitalize(processStatus?.hazard || "-")} ·{" "}
                  {capitalize(processStatus?.mode || "-")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Keterangan
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">
                    {processStatus?.message || "Belum ada proses aktif."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            MENU ADMIN
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Halaman Utama
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Akses ke semua fitur utama dalam sistem admin.
          </p>
        </div>

        {renderNavGrid(adminPages)}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              AKTIVITAS TERBARU
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Aktivitas Sistem
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ringkasan perubahan terbaru dari proses, data, dan hasil.
            </p>
          </div>

          {recentActivities.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Belum ada aktivitas terbaru yang dapat ditampilkan.
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((item, index) => {
                const toneClass =
                  item.tone === "red"
                    ? "border-red-200 bg-red-50"
                    : item.tone === "amber"
                    ? "border-amber-200 bg-amber-50"
                    : item.tone === "green"
                    ? "border-green-200 bg-green-50"
                    : item.tone === "blue"
                    ? "border-blue-200 bg-blue-50"
                    : "border-slate-200 bg-slate-50";

                return (
                  <div
                    key={`${item.title}-${index}`}
                    className={`rounded-2xl border px-4 py-4 ${toneClass}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {item.desc}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{item.time}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              HASIL TERBARU
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Output Terbaru
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Lima file hasil terbaru yang terdeteksi dari backend.
            </p>
          </div>

          {recentOutputs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Belum ada output terbaru yang dapat ditampilkan.
            </div>
          ) : (
            <div className="space-y-3">
              {recentOutputs.map((item, index) => (
                <div
                  key={`${item.filename}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <p className="break-all text-sm font-semibold text-slate-900">
                    {item.filename}
                  </p>

                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                    {item.category || "unknown"} · {item.status || "unknown"}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {formatDateTime(item.modified_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}