"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  Gauge,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { fetchWithAuth } from "../../../../lib/fetcher-auth";

type HazardKey = "flood" | "drought" | "multi";
type ModeKey = "full" | "preprocess" | "analysis" | "web";
type StepStatus = "pending" | "running" | "success" | "failed";

type ProcessStatus = {
  status: "running" | "success" | "failed" | "idle";
  message: string;
  progress_percent: number;
  started_at?: string | null;
  current_script?: string | null;
  hazard?: string | null;
};

const HAZARD_OPTIONS: { key: HazardKey; label: string; desc: string }[] = [
  {
    key: "flood",
    label: "Flood",
    desc: "Jalankan proses untuk analisis banjir.",
  },
  {
    key: "drought",
    label: "Drought",
    desc: "Jalankan proses untuk analisis kekeringan.",
  },
  {
    key: "multi",
    label: "Multi-hazard",
    desc: "Jalankan proses gabungan multi-hazard (perlu flood & drought).",
  },
];

const MODE_OPTIONS: { key: ModeKey; label: string; desc: string }[] = [
  {
    key: "full",
    label: "Full Pipeline",
    desc: "Preprocess → Zonal → Analisis → ETL ke database.",
  },
  {
    key: "preprocess",
    label: "Preprocess Only",
    desc: "Hanya jalankan preprocessing data raster.",
  },
  {
    key: "analysis",
    label: "Analysis Only",
    desc: "Zonal stats + analisis hazard (skip preprocess).",
  },
  {
    key: "web",
    label: "Load DB Only",
    desc: "Muat hasil analisis ke database saja.",
  },
];

// Maps step name to visual stage index (0-based)
// Stages: 0=PREPROCESS, 1=ZONAL, 2=ANALYSIS, 3=ETL
function inferStageFromScript(script?: string | null): number {
  if (!script) return -1;
  const s = script.toLowerCase();
  if (s === "preprocess" || s === "run_preprocess.py") return 0;
  if (s === "zonal"      || s === "run_zonal.py")      return 1;
  if (s === "analysis"   || s.startsWith("run_analysis_")) return 2;
  if (s === "etl"        || s === "run_etl.py")         return 3;
  return -1;
}

const STEP_DEFS = [
  { name: "preprocess", label: "PREPROCESS" },
  { name: "zonal",      label: "ZONAL"      },
  { name: "analysis",   label: "ANALYSIS"   },
  { name: "etl",        label: "ETL"        },
];

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

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

function calculateETA(startedAt?: string | null, progress?: number) {
  if (!startedAt || !progress || progress <= 0) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  const now = Date.now();
  const elapsed = (now - start) / 1000;
  if (elapsed <= 0) return null;
  const totalEstimated = elapsed / (progress / 100);
  const remaining = Math.max(0, totalEstimated - elapsed);
  return { elapsed, remaining };
}

function getStepDotClass(status: StepStatus) {
  switch (status) {
    case "success": return "bg-green-500";
    case "running": return "bg-blue-500 animate-pulse";
    case "failed": return "bg-red-500";
    default: return "bg-slate-300";
  }
}

function getStepColor(status: StepStatus) {
  switch (status) {
    case "success": return "text-green-600";
    case "running": return "text-blue-600";
    case "failed": return "text-red-600";
    default: return "text-slate-400";
  }
}

function getStatusTone(status?: string | null) {
  if (status === "running") return { label: "Running", className: "text-amber-600" };
  if (status === "success") return { label: "Selesai", className: "text-green-600" };
  if (status === "failed")  return { label: "Gagal",   className: "text-red-600"   };
  return { label: "Idle",    className: "text-slate-900" };
}

function PipelineSteps({
  steps,
}: {
  steps: { name: string; label: string; status: StepStatus }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {steps.map((step) => (
        <div
          key={step.name}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${getStepDotClass(step.status)}`} />
            <p className={`text-sm font-semibold ${getStepColor(step.status)}`}>
              {step.label}
            </p>
          </div>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
            {step.status}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AdminProcessPage() {
  const [selectedHazard, setSelectedHazard] = useState<HazardKey>("flood");
  const [operatorName, setOperatorName] = useState("operator");
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [runningAction, setRunningAction] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadStatus = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      setErrorMessage("");
      const res = await fetchWithAuth("/api/admin/process-status");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).error || "Gagal memuat status proses. Coba refresh atau periksa koneksi server.");
      }
      const json = await res.json();
      setStatus(json);
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal memuat status proses.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (status?.status !== "running") return;
    const id = setInterval(() => loadStatus(false), 2000);
    return () => clearInterval(id);
  }, [status?.status, loadStatus]);

  async function handleRun(mode: ModeKey) {
    try {
      setRunningAction(true);
      setErrorMessage("");
      setSuccessMessage("");
      const res = await fetchWithAuth("/api/admin/start-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, hazard: selectedHazard, operator: operatorName || "operator" }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 202) {
        const pid = (json as any).pid;
        setSuccessMessage(
          `Pipeline berhasil dimulai${pid ? ` (PID ${pid})` : ""}. Pantau progress di bawah.`
        );
        await loadStatus(false);
      } else if (res.status === 409) {
        const active = (json as any).active_run;
        const who = active?.operator_name ? ` oleh ${active.operator_name}` : "";
        const step = active?.step ? ` — step: ${active.step}` : "";
        setErrorMessage(
          `Pipeline sedang berjalan${who}${step}. Tunggu hingga selesai sebelum memulai yang baru.`
        );
      } else {
        throw new Error(
          (json as any)?.error ||
          `Gagal memulai pipeline (${res.status}). Periksa koneksi server.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal menjalankan proses. Periksa koneksi server.");
    } finally {
      setRunningAction(false);
    }
  }

  const steps = useMemo(() => {
    const activeStage = inferStageFromScript(status?.current_script);
    const pipelineStatus = status?.status;
    const isRunning = pipelineStatus === "running";

    return STEP_DEFS.map((def, index) => {
      let stepStatus: StepStatus = "pending";

      if (pipelineStatus === "success") {
        stepStatus = "success";
      } else if (isRunning) {
        if (activeStage >= 0) {
          if (index < activeStage) stepStatus = "success";
          else if (index === activeStage) stepStatus = "running";
        }
      } else if (pipelineStatus === "failed") {
        if (activeStage >= 0) {
          if (index < activeStage) stepStatus = "success";
          else if (index === activeStage) stepStatus = "failed";
        }
      }

      return { ...def, status: stepStatus };
    });
  }, [status]);

  const currentScriptDisplay = useMemo(() => {
    if (status?.current_script) {
      return status.current_script.replace(".py", "").replace("run_", "").toUpperCase();
    }
    if (status?.status === "success") return "SELESAI";
    if (status?.status === "failed") return "GAGAL";
    return "IDLE";
  }, [status?.current_script, status?.status]);

  const etaData = useMemo(
    () => calculateETA(status?.started_at, status?.progress_percent),
    [status?.started_at, status?.progress_percent]
  );

  const statusTone = useMemo(
    () => getStatusTone(status?.status),
    [status?.status]
  );

  const selectedHazardInfo = HAZARD_OPTIONS.find((o) => o.key === selectedHazard);
  const canRun = !runningAction && status?.status !== "running";

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              PROCESS CONTROL
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Jalankan Proses
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
              Jalankan dan pantau proses analisis data dari satu halaman.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadStatus(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Memuat..." : "Refresh"}
          </button>
        </div>
      </section>

      {successMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}{" "}
          <Link
            href="/admin/pipeline-monitor"
            className="font-medium underline hover:text-green-900"
          >
            Pantau Pipeline →
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Parameter */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              PARAMETER
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Pilih Jenis Analisis
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pilih hazard dan mode, lalu mulai proses.
            </p>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hazard
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {HAZARD_OPTIONS.map((item) => {
              const active = selectedHazard === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedHazard(item.key)}
                  disabled={status?.status === "running"}
                  className={
                    active
                      ? "rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-4 text-left shadow-sm"
                      : "rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--color-primary)]"
                  }
                >
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Operator */}
          <div className="mt-5">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nama Operator
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="contoh: mitra_bandung"
              disabled={status?.status === "running"}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Primary actions */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => handleRun("full")}
              disabled={!canRun}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlayCircle className="h-4 w-4 shrink-0" />
              <span>
                {runningAction ? "Menjalankan..." : "Jalankan Pipeline Penuh"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleRun("web")}
              disabled={!canRun}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Activity className="h-4 w-4 shrink-0" />
              <span>Muat ke Database Saja</span>
            </button>
          </div>

          {/* Advanced (collapsed by default) */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              {showAdvanced ? "▲ Sembunyikan opsi lanjutan" : "▼ Opsi lanjutan"}
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleRun("preprocess")}
                  disabled={!canRun}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-sm font-semibold text-slate-900">Preprocess Saja</p>
                  <p className="mt-1 text-xs text-slate-500">Hanya jalankan preprocessing data raster.</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleRun("analysis")}
                  disabled={!canRun}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-sm font-semibold text-slate-900">Analisis Saja</p>
                  <p className="mt-1 text-xs text-slate-500">Zonal stats + analisis hazard (skip preprocess).</p>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Hazard dipilih:</span>{" "}
            {selectedHazardInfo?.label || "-"}
          </div>
        </div>

        {/* Status Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              STATUS
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Ringkasan Proses
            </h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current Status
              </p>
              <p className={`mt-1 text-lg font-bold ${statusTone.className}`}>
                {statusTone.label}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tahap Aktif
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {currentScriptDisplay}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hazard
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {capitalize(status?.hazard || "-")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Metric cards */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Progress</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {status?.progress_percent ?? 0}%
              </h2>
            </div>
            <div className="rounded-2xl bg-[var(--color-primary-soft)] p-3">
              <Gauge className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Progress keseluruhan pipeline.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Hazard Aktif</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {capitalize(status?.hazard || selectedHazard)}
              </h2>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Hazard yang dipilih atau berjalan.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Elapsed</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {etaData ? formatDuration(etaData.elapsed) : "-"}
              </h2>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <Clock3 className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Lama waktu proses berjalan.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">ETA</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {etaData ? formatDuration(etaData.remaining) : "-"}
              </h2>
            </div>
            <div className="rounded-2xl bg-green-50 p-3">
              <PlayCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Estimasi sisa waktu proses.</p>
        </div>
      </section>

      {/* Progress bar + steps */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            PROGRESS
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Status Proses Saat Ini
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pantau progress dan tahap yang sedang berjalan.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-semibold text-slate-900">
              {status?.message || "Belum ada proses aktif."}
            </p>
            <p className="text-xs text-slate-500">
              Mulai: {formatDateTime(status?.started_at)}
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, status?.progress_percent ?? 0))}%` }}
            />
          </div>
        </div>

        <div className="mt-5">
          <PipelineSteps steps={steps} />
        </div>
      </section>

    </main>
  );
}
