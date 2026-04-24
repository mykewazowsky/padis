"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  GitBranch,
  Layers3,
  RefreshCw,
  Workflow,
  XCircle,
} from "lucide-react";
import { fetchWithAuth } from "../../../../lib/fetcher-auth";

type HazardKey = "flood" | "drought" | "multi";
type StepState = "pending" | "running" | "success" | "failed";

type ProcessLogItem = {
  script?: string;
  returncode?: number;
  message?: string;
  timestamp?: string;
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

type PipelineNode = {
  id: string;
  label: string;
  desc: string;
  state: StepState;
};

// Script execution order (used to determine "already passed" state)
const SCRIPT_ORDER = [
  "run_preprocess.py",
  "run_zonal.py",
  "run_analysis_flood.py",
  "run_analysis_drought.py",
  "run_analysis_multi.py",
  "run_etl.py",
];

function scriptIndex(script: string | null | undefined): number {
  return SCRIPT_ORDER.indexOf(script ?? "");
}

// Maps current_script to main stage index: 0=Preprocess, 1=Zonal, 2=Analysis+ETL
function inferMainStageIndex(script?: string | null): number {
  if (!script) return -1;
  if (script === "run_preprocess.py") return 0;
  if (script === "run_zonal.py") return 1;
  if (script.startsWith("run_analysis_") || script === "run_etl.py") return 2;
  return -1;
}

function inferMainStageLabel(script?: string | null): string {
  const idx = inferMainStageIndex(script);
  if (idx === 0) return "Preprocess";
  if (idx === 1) return "Zonal";
  if (idx === 2) return "Analysis";
  return "Idle";
}

function capitalize(text?: string | null) {
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function getMainStatusTone(status?: string | null, lastResult?: string | null) {
  if (status === "running")
    return { label: "Running", className: "text-amber-600", badgeClass: "border-amber-200 bg-amber-50 text-amber-700" };
  if (lastResult === "success")
    return { label: "Idle (OK)", className: "text-green-600", badgeClass: "border-green-200 bg-green-50 text-green-700" };
  if (lastResult === "failed")
    return { label: "Idle (Failed)", className: "text-red-600", badgeClass: "border-red-200 bg-red-50 text-red-700" };
  return { label: capitalize(status || "idle"), className: "text-slate-900", badgeClass: "border-slate-200 bg-slate-50 text-slate-700" };
}

function getNodeStyles(state: StepState) {
  if (state === "success")
    return { border: "border-green-200", bg: "bg-green-50", text: "text-green-700", icon: <CheckCircle2 className="h-4 w-4 text-green-600" />, statusLabel: "SUCCESS" };
  if (state === "running")
    return { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", icon: <Clock3 className="h-4 w-4 text-blue-600 animate-spin" />, statusLabel: "RUNNING" };
  if (state === "failed")
    return { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", icon: <XCircle className="h-4 w-4 text-red-600" />, statusLabel: "FAILED" };
  return { border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-600", icon: <Activity className="h-4 w-4 text-slate-400" />, statusLabel: "PENDING" };
}

function buildMainStageNodes(status: ProcessStatus | null): PipelineNode[] {
  const activeStage = inferMainStageIndex(status?.current_script);
  const isRunning = status?.status === "running";
  const failed = status?.last_result === "failed";
  const succeeded = status?.last_result === "success";

  function stageState(stageIdx: number): StepState {
    if (succeeded) return "success";
    if (isRunning) {
      if (activeStage < 0) return "pending";
      if (stageIdx < activeStage) return "success";
      if (stageIdx === activeStage) return "running";
    } else if (failed) {
      if (activeStage < 0) return "pending";
      if (stageIdx < activeStage) return "success";
      if (stageIdx === activeStage) return "failed";
    }
    return "pending";
  }

  return [
    { id: "preprocess", label: "Preprocess", desc: "Reproyeksi raster dan interseksi vektor sawah–administrasi.", state: stageState(0) },
    { id: "zonal", label: "Zonal Stats", desc: "Menghitung statistik zonal per wilayah untuk setiap hazard.", state: stageState(1) },
    { id: "analysis", label: "Analysis + ETL", desc: "LOP → Loss → AAL → Aggregate, lalu muat hasil ke database.", state: stageState(2) },
  ];
}

function getHazardNodeState(
  nodeHazard: HazardKey,
  analysisScript: string,
  status: ProcessStatus | null,
): StepState {
  if (!status) return "pending";

  const activeHazard = status.hazard as HazardKey | null;
  if (!activeHazard) return "pending";

  // Is this hazard included in the current/last run?
  const included =
    activeHazard === nodeHazard ||
    (activeHazard === "multi" && nodeHazard !== "multi") ||
    false;
  if (!included) return "pending";

  const currScript = status.current_script;
  const isRunning = status.status === "running";
  const lastResult = status.last_result;

  if (isRunning) {
    if (currScript === analysisScript) return "running";
    const currIdx = scriptIndex(currScript);
    const thisIdx = scriptIndex(analysisScript);
    if (currIdx > thisIdx && thisIdx >= 0) return "success";
    return "pending";
  }

  if (lastResult === "success") return "success";

  if (lastResult === "failed") {
    // If the pipeline failed after this script (i.e. this script already ran OK)
    const currIdx = scriptIndex(currScript);
    const thisIdx = scriptIndex(analysisScript);
    if (currIdx > thisIdx && thisIdx >= 0) return "success";
    // The current script is exactly this one — it failed
    return "failed";
  }

  return "pending";
}

function buildHazardNodes(hazard: HazardKey, status: ProcessStatus | null): PipelineNode[] {
  const analysisScript = `run_analysis_${hazard === "multi" ? "multi" : hazard}.py`;
  const nodeState = getHazardNodeState(hazard, analysisScript, status);

  if (hazard === "flood") {
    return [
      { id: "flood-lop", label: "Flood LOP", desc: "Menghitung peluang kerugian banjir per sawah.", state: nodeState },
      { id: "flood-loss", label: "Flood Loss", desc: "Menghitung total kerugian banjir per kab/kota.", state: nodeState },
      { id: "flood-aal", label: "Flood AAL", desc: "Menghitung Annual Average Loss untuk banjir.", state: nodeState },
      { id: "flood-output", label: "Flood Output", desc: "Menyimpan hasil akhir flood ke file GeoJSON.", state: nodeState },
    ];
  }

  if (hazard === "drought") {
    return [
      { id: "drought-di", label: "Drought DI", desc: "Menghitung Drought Indicator per wilayah.", state: nodeState },
      { id: "drought-lop", label: "Drought LOP", desc: "Menghitung peluang kerugian kekeringan.", state: nodeState },
      { id: "drought-loss", label: "Drought Loss", desc: "Menghitung total kerugian kekeringan per kab/kota.", state: nodeState },
      { id: "drought-aal", label: "Drought AAL", desc: "Menghitung Annual Average Loss untuk kekeringan.", state: nodeState },
    ];
  }

  return [
    { id: "multi-merge", label: "Merge Hazards", desc: "Menggabungkan hasil flood dan drought.", state: nodeState },
    { id: "multi-loss", label: "Multi Loss", desc: "Menghitung kerugian gabungan multi-hazard.", state: nodeState },
    { id: "multi-aal", label: "Multi AAL", desc: "Menghitung AAL untuk multi-hazard.", state: nodeState },
    { id: "multi-output", label: "Multi Output", desc: "Menyimpan hasil akhir multi-hazard.", state: nodeState },
  ];
}

function NodeCard({ node }: { node: PipelineNode }) {
  const styles = getNodeStyles(node.state);
  return (
    <div className={`rounded-2xl border p-4 ${styles.border} ${styles.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {styles.icon}
          <p className={`text-sm font-semibold ${styles.text}`}>{node.label}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600 shadow-sm">
          {styles.statusLabel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{node.desc}</p>
    </div>
  );
}

export default function AdminPipelineMonitorPage() {
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStatus = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      setErrorMessage("");
      const res = await fetchWithAuth("/api/admin/process-status");
      const json = await res.json();
      setStatus(json);
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal memuat status pipeline.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    if (status?.status !== "running") return;
    const id = setInterval(() => loadStatus(false), 2500);
    return () => clearInterval(id);
  }, [status?.status, loadStatus]);

  const statusTone = useMemo(
    () => getMainStatusTone(status?.status, status?.last_result),
    [status?.status, status?.last_result]
  );

  const mainStageLabel = useMemo(
    () => (status?.status === "running" ? inferMainStageLabel(status.current_script) : "Idle"),
    [status?.status, status?.current_script]
  );

  const mainNodes = useMemo(() => buildMainStageNodes(status), [status]);
  const floodNodes = useMemo(() => buildHazardNodes("flood", status), [status]);
  const droughtNodes = useMemo(() => buildHazardNodes("drought", status), [status]);
  const multiNodes = useMemo(() => buildHazardNodes("multi", status), [status]);

  const recentLogs = useMemo(() => (status?.logs || []).slice(-5).reverse(), [status?.logs]);

  const activeHazard = capitalize(status?.hazard || "-");
  const activeMode = capitalize(status?.mode || "-");

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              PIPELINE MONITOR
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Alur Proses
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
              Pantau tahapan pipeline, status setiap skrip, dan alur per hazard secara real-time.
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

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Status Pipeline</p>
              <h2 className={`mt-2 text-2xl font-bold ${statusTone.className}`}>
                {statusTone.label}
              </h2>
            </div>
            <div className={`rounded-2xl border px-3 py-2 text-xs font-semibold ${statusTone.badgeClass}`}>
              Live
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Status utama proses yang berjalan atau terakhir dijalankan.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Tahap Aktif</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{mainStageLabel}</h2>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3">
              <Workflow className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Tahap utama pipeline yang sedang aktif.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Hazard</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{activeHazard}</h2>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <GitBranch className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Hazard yang diproses atau terakhir dijalankan.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Mode</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{activeMode}</h2>
            </div>
            <div className="rounded-2xl bg-green-50 p-3">
              <Layers3 className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Mode proses yang dipakai.</p>
        </div>
      </section>

      {/* Main pipeline stages */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            MAIN PIPELINE
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Tahap Utama Proses
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Alur utama pipeline: Preprocess → Zonal → Analysis + ETL.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {mainNodes.map((node) => <NodeCard key={node.id} node={node} />)}
        </div>
      </section>

      {/* Hazard branches */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                FLOOD
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                Jalur Flood
              </h2>
            </div>
          </div>
          <div className="space-y-3">
            {floodNodes.map((node) => <NodeCard key={node.id} node={node} />)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                DROUGHT
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                Jalur Drought
              </h2>
            </div>
          </div>
          <div className="space-y-3">
            {droughtNodes.map((node) => <NodeCard key={node.id} node={node} />)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                MULTI-HAZARD
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                Jalur Multi-hazard
              </h2>
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            Multi-hazard bergantung pada hasil flood dan drought.
          </div>
          <div className="space-y-3">
            {multiNodes.map((node) => <NodeCard key={node.id} node={node} />)}
          </div>
        </div>
      </section>

      {/* Status detail + recent logs */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              STATUS DETAIL
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Ringkasan Saat Ini
            </h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {status?.progress_percent ?? 0}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, status?.progress_percent ?? 0))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current Script
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                  {status?.current_script || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Script ke-
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {status?.current_step ?? 0} / {status?.total_steps ?? 0}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Started At
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatDateTime(status?.started_at)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {status?.message || "Belum ada proses aktif."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              RECENT LOGS
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Log Terbaru</h2>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Memuat log...
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Belum ada log proses yang dapat ditampilkan.
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log, index) => {
                const hasError = log.returncode != null && log.returncode !== 0;
                return (
                  <div
                    key={index}
                    className={`rounded-2xl border px-4 py-4 ${
                      hasError ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {log.script || log.message || "Log entry"}
                      </p>
                      {log.returncode != null && (
                        <span className={`shrink-0 text-xs font-medium ${hasError ? "text-red-600" : "text-green-600"}`}>
                          rc: {log.returncode}
                        </span>
                      )}
                    </div>
                    {hasError && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Terjadi error pada langkah ini.
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(log.timestamp)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Guide */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            PANDUAN
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Cara Membaca Pipeline Monitor
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="font-semibold text-slate-900">Tahap Utama</p>
            <p className="mt-2 text-sm text-slate-600">
              Preprocess → Zonal → Analysis+ETL. Setiap tahap diwakili satu skrip runner.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="font-semibold text-slate-900">Jalur Hazard</p>
            <p className="mt-2 text-sm text-slate-600">
              Sub-langkah analisis di dalam skrip <code className="text-xs">run_analysis_*.py</code>. Semua node di satu hazard mencerminkan status skrip tersebut.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="font-semibold text-slate-900">Status Node</p>
            <p className="mt-2 text-sm text-slate-600">
              Pending = belum jalan, Running = sedang aktif (animasi), Success = selesai, Failed = gagal.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
