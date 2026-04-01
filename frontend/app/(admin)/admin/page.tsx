"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Database,
  FileOutput,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { fetchJsonWithAuth } from "../../lib/fetcher-auth";

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

export default function AdminPage() {
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
    } else {
      setLoading((prev) => prev);
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

  const processDisplay = useMemo(() => {
    if (!processStatus) {
      return {
        label: "Unknown",
        desc: "Status proses analisis belum tersedia.",
        valueClass: "text-slate-900",
      };
    }

    if (processStatus.status === "running") {
      return {
        label: `Running ${processStatus.progress_percent ?? 0}%`,
        desc:
          processStatus.message ||
          "Pipeline analisis sedang berjalan di backend.",
        valueClass: "text-amber-600",
      };
    }

    if (processStatus.last_result === "success") {
      return {
        label: "Idle (OK)",
        desc:
          processStatus.message ||
          "Tidak ada proses aktif dan hasil terakhir sukses.",
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
      desc:
        processStatus.message || "Status proses analisis tersedia di sistem.",
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
        desc: "File output tersedia untuk preview, unduh, dan inspeksi admin.",
        valueClass: "text-[var(--color-primary)]",
      };
    }

    return {
      label: "No Output",
      desc: "Belum ada file output yang terdeteksi di registry backend.",
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
      title: "System Status",
      value: systemStatus.label,
      desc: systemStatus.desc,
      valueClass: systemStatus.valueClass,
      icon: Activity,
      iconWrapClass: "bg-green-50",
      iconClass: "text-green-600",
    },
    {
      title: "Pipeline Status",
      value: processDisplay.label,
      desc: processDisplay.desc,
      valueClass: processDisplay.valueClass,
      icon: PlayCircle,
      iconWrapClass: "bg-amber-50",
      iconClass: "text-amber-600",
    },
    {
      title: "Output State",
      value: outputState.label,
      desc: outputState.desc,
      valueClass: outputState.valueClass,
      icon: FileOutput,
      iconWrapClass: "bg-[var(--color-primary-soft)]",
      iconClass: "text-[var(--color-primary)]",
    },
    {
      title: "User Accounts",
      value: userState.label,
      desc: userState.desc,
      valueClass: userState.valueClass,
      icon: Users,
      iconWrapClass: "bg-purple-50",
      iconClass: "text-purple-600",
    },
  ];

  const quickLinks = [
    {
      title: "Data Management",
      href: "/admin/data",
      desc: "Kelola upload, validasi, dan ketersediaan input data PADIS.",
      icon: Database,
      accentClass: "border-blue-200 bg-blue-50",
      iconWrapClass: "bg-white",
      iconClass: "text-blue-600",
    },
    {
      title: "Process Control",
      href: "/admin/process",
      desc: "Jalankan pipeline, pantau progress, dan kontrol proses analisis.",
      icon: PlayCircle,
      accentClass: "border-amber-200 bg-amber-50",
      iconWrapClass: "bg-white",
      iconClass: "text-amber-600",
    },
    {
      title: "Outputs",
      href: "/admin/output",
      desc: "Lihat output terbaru, preview hasil, dan kesiapan file sistem.",
      icon: FileOutput,
      accentClass: "border-green-200 bg-green-50",
      iconWrapClass: "bg-white",
      iconClass: "text-green-600",
    },
    {
      title: "Users",
      href: "/admin/users",
      desc: "Kelola akun, role admin, dan status akses pengguna PADIS.",
      icon: Users,
      accentClass: "border-purple-200 bg-purple-50",
      iconWrapClass: "bg-white",
      iconClass: "text-purple-600",
    },
  ];

  const quickActions = [
    { label: "Kelola Data", href: "/admin/data" },
    { label: "Jalankan Proses", href: "/admin/process" },
    { label: "Lihat Output", href: "/admin/output" },
    { label: "Kelola Users", href: "/admin/users" },
  ];

  const nextSteps = [
    "Tambahkan monitoring dependency agar admin cepat mengetahui data atau proses yang belum siap.",
    "Tambahkan widget recent outputs dan recent process logs langsung di overview.",
    "Siapkan environment configuration dan Docker untuk deployment yang lebih stabil.",
  ];

  const recentOutputs = useMemo(() => {
    return [...outputs]
      .sort((a, b) => {
        const aTime = a.modified_at ? new Date(a.modified_at).getTime() : 0;
        const bTime = b.modified_at ? new Date(b.modified_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [outputs]);

  const latestUpdate = useMemo(() => {
    return formatDateTime(dataSummary.latest_update);
  }, [dataSummary.latest_update]);

  const lastSyncedLabel = useMemo(() => {
    return formatDateTime(lastSyncedAt);
  }, [lastSyncedAt]);

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              ADMIN OVERVIEW
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              PADIS System Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
              Ringkasan panel administrasi PADIS untuk mengelola data,
              mengontrol proses analisis, memantau output sistem, dan mengatur
              pengguna dari satu tempat.
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Auto refresh setiap {POLL_INTERVAL_MS / 1000} detik · terakhir sinkron:{" "}
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

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2 shadow-sm">
                <Wrench className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Operational Note
                </p>
                <p className="mt-1 text-sm leading-relaxed text-blue-800">
                  Overview ini menampilkan ringkasan operasional live sebelum
                  admin masuk ke modul data, process, output, atau user
                  management.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Security Note
                </p>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">
                  Panel admin hanya boleh diakses akun dengan role
                  administrator dan wajib tetap diproteksi di frontend dan
                  backend.
                </p>
              </div>
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2 shadow-sm">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Gagal memuat sebagian overview
                </p>
                <p className="mt-1 text-sm text-red-700">{loadError}</p>
              </div>
            </div>
          </div>
        ) : null}
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
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              SYSTEM SNAPSHOT
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Ringkasan Sistem
            </h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Raw Datasets
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {dataSummary.raw_count ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Processed Datasets
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {dataSummary.processed_count ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Registry Items
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {dataSummary.registry_count ?? 0}
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
              PROCESS MONITOR
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Status Proses
            </h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {capitalize(processStatus?.status || "unknown")}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Last Result
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {capitalize(processStatus?.last_result || "-")}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progress
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {processStatus?.progress_percent ?? 0}%
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current Script
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 break-all">
                {processStatus?.current_script || "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              USER SUMMARY
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Ringkasan Pengguna
            </h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Users
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {users.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Admin Accounts
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {totalAdmins}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active Accounts
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {totalActiveUsers}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Inactive Accounts
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {totalInactiveUsers}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            ADMIN MODULES
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Modul Administrasi
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Akses cepat ke modul utama pengelolaan PADIS.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.href}
                className={`rounded-3xl border p-5 ${item.accentClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`rounded-2xl p-3 shadow-sm ${item.iconWrapClass}`}
                  >
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
                    Buka Modul
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              QUICK ACTION
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Aksi Cepat
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Shortcut ke modul yang paling sering digunakan admin.
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

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              NEXT STEP
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Pengembangan Berikutnya
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Prioritas peningkatan overview admin setelah fondasi sistem
              berjalan stabil.
            </p>
          </div>

          <div className="space-y-3">
            {nextSteps.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            RECENT OUTPUTS
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Output Terbaru
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Lima file output terbaru yang terdeteksi dari backend.
          </p>
        </div>

        {recentOutputs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            Belum ada output terbaru yang dapat ditampilkan.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            {recentOutputs.map((item) => (
              <div
                key={item.filename}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-900 break-all">
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
      </section>
    </main>
  );
}