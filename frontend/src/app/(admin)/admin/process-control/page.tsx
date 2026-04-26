"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Clock3,
  Gauge,
  PlayCircle,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";
import { fetchWithAuth } from "../../../../lib/fetcher-auth";

type HazardKey = "flood" | "drought" | "multi";
type ModeKey = "full" | "preprocess" | "analysis" | "web";
type StepStatus = "pending" | "running" | "success" | "failed";

type ProcessLogItem = {
  script?: string;
  returncode?: number;
  message?: string;
  timestamp?: string;
  stdout?: string;
  stderr?: string;
};

type ProcessStatus = {
  status: "idle" | "running";
  message: string;
  progress_percent: number;
  current_step: number;
  total_steps: number;
  last_result: string | null;
  logs: ProcessLogItem[];
  started_at?: string | null;
  current_script?: string | null;
  hazard?: string | null;
  mode?: string | null;
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

// Maps step name or legacy script filename to visual stage index (0-based)
// Stages: 0=PREPROCESS, 1=ZONAL, 2=ANALISIS, 3=DATABASE
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
  { name: "zonal", label: "ZONAL" },
  { name: "analisis", label: "ANALISIS" },
  { name: "database", label: "DATABASE" },
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

function getStatusTone(status?: string | null, lastResult?: string | null) {
  if (status === "running") return { label: "Running", className: "text-amber-600" };
  if (lastResult === "success") return { label: "Idle (OK)", className: "text-green-600" };
  if (lastResult === "failed") return { label: "Idle (Failed)", className: "text-red-600" };
  return { label: capitalize(status || "idle"), className: "text-slate-900" };
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
  const [selectedMode, setSelectedMode] = useState<ModeKey>("full");
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [runningAction, setRunningAction] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const logRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      setErrorMessage("");
      const res = await fetchWithAuth("/api/admin/process-status");
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

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.logs]);

  async function handleRun() {
    try {
      setRunningAction(true);
      setErrorMessage("");
      const res = await fetchWithAuth("/api/admin/run-analysis", {
        method: "POST",
        body: JSON.stringify({ hazard: selectedHazard, mode: selectedMode }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any)?.error || `Gagal memulai proses (${res.status})`);
      }
      await loadStatus(false);
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal menjalankan proses.");
    } finally {
      setRunningAction(false);
    }
  }

  const steps = useMemo(() => {
    const activeStage = inferStageFromScript(status?.current_script);
    const isRunning = status?.status === "running";
    const lastResult = status?.last_result;

    return STEP_DEFS.map((def, index) => {
      let stepStatus: StepStatus = "pending";

      if (lastResult === "success") {
        stepStatus = "success";
      } else if (isRunning) {
        if (activeStage >= 0) {
          if (index < activeStage) stepStatus = "success";
          else if (index === activeStage) stepStatus = "running";
        }
      } else if (lastResult === "failed") {
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
    if (status?.last_result === "success") return "SELESAI";
    if (status?.last_result === "failed") return "GAGAL";
    return "IDLE";
  }, [status?.current_script, status?.last_result]);

  const currentStepNum = status?.current_step ?? 0;
  const totalSteps = status?.total_steps ?? 0;

  const etaData = useMemo(
    () => calculateETA(status?.started_at, status?.progress_percent),
    [status?.started_at, status?.progress_percent]
  );

  const statusTone = useMemo(
    () => getStatusTone(status?.status, status?.last_result),
    [status?.status, status?.last_result]
  );

  const selectedHazardInfo = HAZARD_OPTIONS.find((o) => o.key === selectedHazard);
  const selectedModeInfo = MODE_OPTIONS.find((o) => o.key === selectedMode);
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

          <div className="flex flex-wrap items-start gap-3">
            <button
              type="button"
              onClick={() => loadStatus(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Memuat..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleRun}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlayCircle className="h-4 w-4" />
              {runningAction ? "Menjalankan..." : "Run Process"}
            </button>
          </div>
        </div>
      </section>

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

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Mode
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {MODE_OPTIONS.map((item) => {
              const active = selectedMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedMode(item.key)}
                  disabled={status?.status === "running"}
                  className={
                    active
                      ? "rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-3 text-left shadow-sm"
                      : "rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--color-primary)]"
                  }
                >
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Akan dijalankan:</span>{" "}
            {selectedHazardInfo?.label || "-"} — {selectedModeInfo?.label || "-"}
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
                Current Script
              </p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {currentScriptDisplay}
              </p>
              {totalSteps > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Skrip {currentStepNum} / {totalSteps}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Last Result
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {capitalize(status?.last_result || "-")}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hazard / Mode
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {capitalize(status?.hazard || "-")} / {capitalize(status?.mode || "-")}
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

      {/* Live logs */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              LIVE LOGS
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Log Proses
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Output skrip yang berjalan di backend.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-3">
            <TerminalSquare className="h-5 w-5 text-slate-600" />
          </div>
        </div>

        <div
          ref={logRef}
          className="h-[480px] overflow-auto rounded-2xl bg-[#0d1117] p-4 font-mono text-xs"
        >
          {status?.logs?.length ? (
            <div className="space-y-3">
              {status.logs.map((log, index) => {
                const isError = log.returncode != null && log.returncode !== 0;
                return (
                  <div key={index} className="break-words">
                    <div className="flex items-start gap-2">
                      <span className={isError ? "text-red-400" : "text-green-400"}>
                        {isError ? "✗" : "✓"}
                      </span>
                      <span className={isError ? "text-red-300" : "text-green-300"}>
                        {log.script || log.message || "Log entry"}
                      </span>
                      {log.returncode != null && (
                        <span className={`ml-auto shrink-0 ${isError ? "text-red-500" : "text-slate-600"}`}>
                          [rc: {log.returncode}]
                        </span>
                      )}
                    </div>

                    {log.stdout && !isError && (
                      <div className="mt-1 border-l-2 border-slate-700 pl-3 text-slate-400">
                        {log.stdout.slice(-400)}
                      </div>
                    )}

                    {isError && log.stderr && (
                      <div className="mt-1 border-l-2 border-red-700 pl-3 text-red-400">
                        {log.stderr.slice(-600)}
                      </div>
                    )}

                    {log.timestamp && (
                      <p className="mt-0.5 pl-5 text-[10px] text-slate-600">
                        {formatDateTime(log.timestamp)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-slate-600">Belum ada log proses...</span>
          )}
        </div>
      </section>
    </main>
  );
}
