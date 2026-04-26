"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// =============================================================================
// Types
// =============================================================================

type RunStatus = {
  id: number;
  run_name: string;
  created_at: string | null;
  status: string;
  is_active: boolean;
  step: string | null;
  progress: number;
  message: string | null;
  operator_name: string | null;
  source: string | null;
};

type StepState = "pending" | "running" | "success" | "failed";

type PipelineNode = {
  id: string;
  label: string;
  desc: string;
  state: StepState;
};

type HazardKey = "flood" | "drought" | "multi";

// =============================================================================
// Pure helpers
// =============================================================================

function stepToStageIndex(step: string | null): number {
  if (step === "preprocess") return 0;
  if (step === "zonal") return 1;
  if (step === "analysis" || step === "etl") return 2;
  return -1;
}

function extractHazard(runName: string | null): HazardKey | null {
  if (!runName) return null;
  const h = runName.split("_")[0];
  return (["flood", "drought", "multi"] as HazardKey[]).includes(h as HazardKey)
    ? (h as HazardKey)
    : null;
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

function getStatusTone(status?: string | null) {
  if (status === "running")
    return { label: "Running", className: "text-amber-600", badgeClass: "border-amber-200 bg-amber-50 text-amber-700" };
  if (status === "success")
    return { label: "Success", className: "text-green-600", badgeClass: "border-green-200 bg-green-50 text-green-700" };
  if (status === "failed")
    return { label: "Failed", className: "text-red-600", badgeClass: "border-red-200 bg-red-50 text-red-700" };
  return { label: capitalize(status || "idle"), className: "text-slate-900", badgeClass: "border-slate-200 bg-slate-50 text-slate-700" };
}

function getStatusBadgeClass(status?: string | null) {
  if (status === "running") return "bg-amber-100 text-amber-700";
  if (status === "success") return "bg-green-100 text-green-700";
  if (status === "failed")  return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function getProgressBarClass(status?: string | null) {
  if (status === "failed")  return "bg-red-400";
  if (status === "success") return "bg-green-500";
  return "bg-[var(--color-primary)]";
}

// =============================================================================
// Pipeline node builders
// =============================================================================

function buildMainStageNodes(run: RunStatus | null): PipelineNode[] {
  const activeStage = stepToStageIndex(run?.step ?? null);
  const isRunning   = run?.status === "running";
  const failed      = run?.status === "failed";
  const succeeded   = run?.status === "success";

  function stageState(idx: number): StepState {
    if (succeeded) return "success";
    if (isRunning) {
      if (activeStage < 0) return "pending";
      if (idx < activeStage) return "success";
      if (idx === activeStage) return "running";
    } else if (failed) {
      if (activeStage < 0) return "pending";
      if (idx < activeStage) return "success";
      if (idx === activeStage) return "failed";
    }
    return "pending";
  }

  return [
    { id: "preprocess", label: "Preprocess",     desc: "Reproyeksi raster dan interseksi vektor sawah–administrasi.", state: stageState(0) },
    { id: "zonal",      label: "Zonal Stats",    desc: "Menghitung statistik zonal per wilayah untuk setiap hazard.", state: stageState(1) },
    { id: "analysis",   label: "Analysis + ETL", desc: "LOP → Loss → AAL → Aggregate, lalu muat hasil ke database.", state: stageState(2) },
  ];
}

function buildHazardNodes(hazard: HazardKey, run: RunStatus | null): PipelineNode[] {
  const activeHazard = extractHazard(run?.run_name ?? null);
  const included =
    activeHazard === hazard ||
    (activeHazard === "multi" && hazard !== "multi");

  let nodeState: StepState = "pending";
  if (included && run) {
    const stage = stepToStageIndex(run.step);
    if (run.status === "success") nodeState = "success";
    else if (run.status === "running" && stage === 2) nodeState = "running";
    else if (run.status === "failed"  && stage === 2) nodeState = "failed";
  }

  if (hazard === "flood") {
    return [
      { id: "flood-lop",    label: "Flood LOP",    desc: "Menghitung peluang kerugian banjir per sawah.",          state: nodeState },
      { id: "flood-loss",   label: "Flood Loss",   desc: "Menghitung total kerugian banjir per kab/kota.",         state: nodeState },
      { id: "flood-aal",    label: "Flood AAL",    desc: "Menghitung Annual Average Loss untuk banjir.",           state: nodeState },
      { id: "flood-output", label: "Flood Output", desc: "Menyimpan hasil akhir flood ke file GeoJSON.",           state: nodeState },
    ];
  }
  if (hazard === "drought") {
    return [
      { id: "drought-di",   label: "Drought DI",   desc: "Menghitung Drought Indicator per wilayah.",              state: nodeState },
      { id: "drought-lop",  label: "Drought LOP",  desc: "Menghitung peluang kerugian kekeringan.",                state: nodeState },
      { id: "drought-loss", label: "Drought Loss", desc: "Menghitung total kerugian kekeringan per kab/kota.",     state: nodeState },
      { id: "drought-aal",  label: "Drought AAL",  desc: "Menghitung Annual Average Loss untuk kekeringan.",       state: nodeState },
    ];
  }
  return [
    { id: "multi-merge",  label: "Merge Hazards", desc: "Menggabungkan hasil flood dan drought.",           state: nodeState },
    { id: "multi-loss",   label: "Multi Loss",    desc: "Menghitung kerugian gabungan multi-hazard.",       state: nodeState },
    { id: "multi-aal",    label: "Multi AAL",     desc: "Menghitung AAL untuk multi-hazard.",               state: nodeState },
    { id: "multi-output", label: "Multi Output",  desc: "Menyimpan hasil akhir multi-hazard.",              state: nodeState },
  ];
}

// =============================================================================
// NodeCard
// =============================================================================

function getNodeStyles(state: StepState) {
  if (state === "success")
    return { border: "border-green-200", bg: "bg-green-50", text: "text-green-700", icon: <CheckCircle2 className="h-4 w-4 text-green-600" />, statusLabel: "SUCCESS" };
  if (state === "running")
    return { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", icon: <Clock3 className="h-4 w-4 text-blue-600 animate-spin" />, statusLabel: "RUNNING" };
  if (state === "failed")
    return { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", icon: <XCircle className="h-4 w-4 text-red-600" />, statusLabel: "FAILED" };
  return { border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-600", icon: <Activity className="h-4 w-4 text-slate-400" />, statusLabel: "PENDING" };
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

// =============================================================================
// Page
// =============================================================================

const POLL_MS = 4000;

export default function AdminPipelineMonitorPage() {
  const [currentRun, setCurrentRun] = useState<RunStatus | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunStatus[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const inFlightRef = useRef(false);

  const loadData = useCallback(async (showRefresh = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (showRefresh) setRefreshing(true);
    setErrorMessage("");

    try {
      const [statusRes, runsRes] = await Promise.allSettled([
        fetchWithAuth("/api/admin/run-status").then((r) => {
          if (!r.ok) throw new Error(`run-status: HTTP ${r.status}`);
          return r.json();
        }),
        fetchWithAuth("/api/admin/runs?limit=10").then((r) => {
          if (!r.ok) throw new Error(`runs: HTTP ${r.status}`);
          return r.json();
        }),
      ]);

      const errors: string[] = [];

      if (statusRes.status === "fulfilled") {
        if (statusRes.value?.error) {
          errors.push(statusRes.value.error);
        } else {
          setCurrentRun(statusRes.value?.run ?? null);
        }
      } else {
        errors.push(statusRes.reason?.message ?? "Gagal memuat status run.");
      }

      if (runsRes.status === "fulfilled") {
        if (runsRes.value?.error) {
          errors.push(runsRes.value.error);
        } else {
          setRecentRuns(Array.isArray(runsRes.value?.runs) ? runsRes.value.runs : []);
        }
      } else {
        errors.push(runsRes.reason?.message ?? "Gagal memuat riwayat run.");
      }

      if (errors.length > 0) {
        setErrorMessage(errors.join(" · "));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data pipeline.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = window.setInterval(() => loadData(false), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadData]);

  const statusTone   = useMemo(() => getStatusTone(currentRun?.status), [currentRun?.status]);
  const activeHazard = useMemo(() => capitalize(extractHazard(currentRun?.run_name ?? null)), [currentRun?.run_name]);
  const activeStep   = useMemo(() => capitalize(currentRun?.step), [currentRun?.step]);

  const mainNodes    = useMemo(() => buildMainStageNodes(currentRun), [currentRun]);
  const floodNodes   = useMemo(() => buildHazardNodes("flood", currentRun), [currentRun]);
  const droughtNodes = useMemo(() => buildHazardNodes("drought", currentRun), [currentRun]);
  const multiNodes   = useMemo(() => buildHazardNodes("multi", currentRun), [currentRun]);

  return (
    <main className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
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
            <p className="mt-2 text-xs text-slate-500">
              Auto refresh setiap {POLL_MS / 1000} detik
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
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

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
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
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{activeStep}</h2>
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
              <p className="text-sm text-slate-500">Operator</p>
              <h2 className="mt-2 truncate text-2xl font-bold text-slate-900">
                {currentRun?.operator_name || "-"}
              </h2>
            </div>
            <div className="rounded-2xl bg-green-50 p-3">
              <Layers3 className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Operator yang menjalankan pipeline terakhir.</p>
        </div>
      </section>

      {/* ── Current run detail ───────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            STATUS SAAT INI
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Run Terbaru</h2>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="h-8 rounded bg-slate-200" />
            <div className="h-4 w-2/3 rounded bg-slate-200" />
          </div>
        ) : currentRun === null ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            Belum ada monitoring run. Jalankan pipeline menggunakan Docker CLI.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Progress
                </p>
                <p className="text-sm font-bold text-slate-900">{currentRun.progress}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${getProgressBarClass(currentRun.status)}`}
                  style={{ width: `${Math.min(100, Math.max(0, currentRun.progress))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tahap</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {capitalize(currentRun.step) || "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mulai</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(currentRun.created_at)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run Name</p>
                <p className="mt-1 break-all text-xs font-medium text-slate-700">
                  {currentRun.run_name}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pesan</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {currentRun.message || "Tidak ada pesan."}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Main pipeline stages ─────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            MAIN PIPELINE
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Tahap Utama Proses</h2>
          <p className="mt-1 text-sm text-slate-500">
            Alur utama pipeline: Preprocess → Zonal → Analysis + ETL.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {mainNodes.map((node) => <NodeCard key={node.id} node={node} />)}
        </div>
      </section>

      {/* ── Hazard branches ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">FLOOD</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Jalur Flood</h2>
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
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">DROUGHT</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Jalur Drought</h2>
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
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">MULTI-HAZARD</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Jalur Multi-hazard</h2>
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

      {/* ── Run history table ────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            RIWAYAT RUN
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">10 Run Terakhir</h2>
          <p className="mt-1 text-sm text-slate-500">
            Daftar monitoring run terbaru dari tabel{" "}
            <code className="text-xs">runs</code>, diperbarui setiap {POLL_MS / 1000} detik.
          </p>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : recentRuns.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            Belum ada riwayat run yang tersedia.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  {["Run Name", "Status", "Progress", "Operator", "Dibuat"].map((h) => (
                    <th
                      key={h}
                      className="pb-3 pr-4 last:pr-0 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRuns.map((run) => (
                  <tr key={run.id} className="transition-colors hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <p
                        className="max-w-[180px] truncate font-medium text-slate-900"
                        title={run.run_name}
                      >
                        {run.run_name}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(run.status)}`}
                      >
                        {capitalize(run.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${getProgressBarClass(run.status)}`}
                            style={{ width: `${Math.min(100, run.progress)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{run.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{run.operator_name || "-"}</td>
                    <td className="py-3 text-slate-500">{formatDateTime(run.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Guide ────────────────────────────────────────────────────────────── */}
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
              Preprocess → Zonal → Analysis+ETL. Tahap ditentukan dari field{" "}
              <code className="text-xs">step</code> di tabel runs.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="font-semibold text-slate-900">Jalur Hazard</p>
            <p className="mt-2 text-sm text-slate-600">
              Sub-langkah analisis per hazard ditentukan dari prefix{" "}
              <code className="text-xs">run_name</code> (flood/drought/multi).
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="font-semibold text-slate-900">Riwayat Run</p>
            <p className="mt-2 text-sm text-slate-600">
              10 monitoring run terakhir dari tabel runs. Auto-refresh setiap{" "}
              {POLL_MS / 1000} detik tanpa interaksi pengguna.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
