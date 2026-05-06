"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  GitBranch,
  Layers3,
  Pencil,
  PlayCircle,
  Power,
  RefreshCw,
  Star,
  Trash2,
  Workflow,
  X,
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
  finished_at: string | null;
  status: string;
  is_active: boolean;
  step: string | null;
  progress: number;
  message: string | null;
  operator_name: string | null;
  source: string | null;
  data_year: number | null;
};

type ValidationTableRow = { hazard: string; regions: number; rows: number };

type ValidationResult = {
  run_id: number;
  exists: boolean;
  status: string | null;
  tables: {
    aal:             ValidationTableRow[];
    losses:          ValidationTableRow[];
    zonal_kabupaten: ValidationTableRow[];
  };
  all_hazards_present: boolean;
  complete: boolean;
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
  if (step === "zonal")      return 1;
  if (step === "analysis")   return 2;
  if (step === "etl")        return 3;
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

function formatHazardLabel(hazard?: string | null) {
  if (!hazard) return "-";
  if (hazard === "flood") return "Banjir";
  if (hazard === "drought") return "Kekeringan";
  if (hazard === "multi" || hazard === "multihazard") return "Multi-hazard";
  return capitalize(hazard);
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
    { id: "preprocess", label: "Preprocess", desc: "Reproyeksi raster dan interseksi vektor sawah–administrasi.", state: stageState(0) },
    { id: "zonal",      label: "Zonal",      desc: "Menghitung statistik zonal per wilayah untuk setiap hazard.", state: stageState(1) },
    { id: "analysis",   label: "Analysis",   desc: "LOP → Loss → AAL → Aggregate per hazard.",                   state: stageState(2) },
    { id: "etl",        label: "ETL",        desc: "Muat hasil analisis ke database (Supabase).",                 state: stageState(3) },
  ];
}

function buildHazardNode(hazard: HazardKey, run: RunStatus | null): PipelineNode {
  const activeHazard = extractHazard(run?.run_name ?? null);
  const included =
    activeHazard === hazard ||
    (activeHazard === "multi" && hazard !== "multi");

  let state: StepState = "pending";
  if (included && run) {
    const stage = stepToStageIndex(run.step);
    if (run.status === "success") state = "success";
    else if (run.status === "running" && stage >= 2) state = "running";
    else if (run.status === "failed"  && stage >= 2) state = "failed";
  }

  const meta: Record<HazardKey, { label: string; desc: string }> = {
    flood:   { label: "Analisis Banjir",      desc: "LOP → Loss → AAL untuk hazard banjir." },
    drought: { label: "Analisis Kekeringan",  desc: "DI → LOP → Loss → AAL untuk hazard kekeringan." },
    multi:   { label: "Multi-hazard",         desc: "Menggabungkan banjir + kekeringan → AAL gabungan." },
  };

  return { id: hazard, ...meta[hazard], state };
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

  // Activation modal state
  const [activationTarget, setActivationTarget] = useState<RunStatus | null>(null);
  const [validation, setValidation]             = useState<ValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError]     = useState("");
  const [activating, setActivating]               = useState(false);
  const [activationError, setActivationError]     = useState("");

  // Inline data_year editor state
  const [editingYearRunId, setEditingYearRunId] = useState<number | null>(null);
  const [yearDraft, setYearDraft]               = useState("");
  const [savingYear, setSavingYear]             = useState(false);
  const [yearError, setYearError]               = useState<string | null>(null);

  // Deletion modal state
  const [deletionTarget, setDeletionTarget] = useState<RunStatus | null>(null);
  const [deletionValidation, setDeletionValidation] = useState<ValidationResult | null>(null);
  const [deletionValidationLoading, setDeletionValidationLoading] = useState(false);
  const [deletionValidationError, setDeletionValidationError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [deletionConfirmText, setDeletionConfirmText] = useState("");

  const loadData = useCallback(async (showRefresh = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (showRefresh) setRefreshing(true);
    setErrorMessage("");

    try {
      const [statusRes, runsRes] = await Promise.allSettled([
        fetchWithAuth("/api/admin/run-status").then((r) => {
          if (!r.ok) throw new Error("Gagal memuat status pipeline. Coba refresh atau periksa koneksi server.");
          return r.json();
        }),
        fetchWithAuth("/api/admin/runs?limit=10").then((r) => {
          if (!r.ok) throw new Error("Gagal memuat riwayat run. Coba refresh atau periksa koneksi server.");
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

  const startEditYear = (run: RunStatus) => {
    setEditingYearRunId(run.id);
    setYearDraft(run.data_year != null ? String(run.data_year) : "");
    setYearError(null);
  };

  const cancelEditYear = () => {
    setEditingYearRunId(null);
    setYearDraft("");
    setYearError(null);
  };

  const saveDataYear = async (runId: number) => {
    const trimmed = yearDraft.trim();
    const year    = trimmed === "" ? null : parseInt(trimmed, 10);

    if (trimmed !== "" && (isNaN(year!) || year! < 1990 || year! > 2100)) {
      setYearError("Tahun harus antara 1990–2100, atau kosongkan untuk hapus.");
      return;
    }

    setSavingYear(true);
    setYearError(null);

    try {
      const res = await fetchWithAuth(`/api/admin/runs/${runId}/data-year`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_year: year }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Gagal menyimpan tahun model data.");
      }
      // Patch local state without waiting for next poll
      setRecentRuns((prev) =>
        prev.map((r) => (r.id === runId ? { ...r, data_year: year } : r))
      );
      if (currentRun?.id === runId) {
        setCurrentRun((prev) => prev ? { ...prev, data_year: year } : prev);
      }
      setEditingYearRunId(null);
      setYearDraft("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
      setYearError(msg);
    } finally {
      setSavingYear(false);
    }
  };

  // Open activation modal: pre-fetch validation snapshot for the chosen run.
  const openActivationModal = useCallback(async (run: RunStatus) => {
    setActivationTarget(run);
    setValidation(null);
    setValidationError("");
    setActivationError("");
    setValidationLoading(true);
    try {
      const res  = await fetchWithAuth(`/api/admin/runs/${run.id}/validate`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal memvalidasi run.");
      }
      setValidation(json as ValidationResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memvalidasi run.";
      setValidationError(msg);
    } finally {
      setValidationLoading(false);
    }
  }, []);

  const closeActivationModal = useCallback(() => {
    if (activating) return;
    setActivationTarget(null);
    setValidation(null);
    setValidationError("");
    setActivationError("");
  }, [activating]);

  const submitActivation = useCallback(async () => {
    if (!activationTarget) return;
    setActivating(true);
    setActivationError("");
    try {
      const res = await fetchWithAuth(
        `/api/admin/runs/${activationTarget.id}/activate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal mengaktifkan run.");
      }
      setActivationTarget(null);
      setValidation(null);
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengaktifkan run.";
      setActivationError(msg);
    } finally {
      setActivating(false);
    }
  }, [activationTarget, loadData]);

  const activeRunId = useMemo(
    () => recentRuns.find((r) => r.is_active)?.id ?? null,
    [recentRuns],
  );

  // Open deletion modal: pre-fetch validation snapshot to show row counts.
  const openDeletionModal = useCallback(async (run: RunStatus) => {
    setDeletionTarget(run);
    setDeletionValidation(null);
    setDeletionValidationError("");
    setDeletionError("");
    setDeletionConfirmText("");
    setDeletionValidationLoading(true);
    try {
      const res  = await fetchWithAuth(`/api/admin/runs/${run.id}/validate`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal mengambil informasi run.");
      }
      setDeletionValidation(json as ValidationResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengambil informasi run.";
      setDeletionValidationError(msg);
    } finally {
      setDeletionValidationLoading(false);
    }
  }, []);

  const closeDeletionModal = useCallback(() => {
    if (deleting) return;
    setDeletionTarget(null);
    setDeletionValidation(null);
    setDeletionValidationError("");
    setDeletionError("");
    setDeletionConfirmText("");
  }, [deleting]);

  const submitDeletion = useCallback(async () => {
    if (!deletionTarget) return;
    setDeleting(true);
    setDeletionError("");
    try {
      const res = await fetchWithAuth(
        `/api/admin/runs/${deletionTarget.id}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal menghapus run.");
      }
      setDeletionTarget(null);
      setDeletionValidation(null);
      setDeletionConfirmText("");
      await loadData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus run.";
      setDeletionError(msg);
    } finally {
      setDeleting(false);
    }
  }, [deletionTarget, loadData]);

  const statusTone   = useMemo(() => getStatusTone(currentRun?.status), [currentRun?.status]);
  const activeHazard = useMemo(() => formatHazardLabel(extractHazard(currentRun?.run_name ?? null)), [currentRun?.run_name]);
  const activeStep   = useMemo(() => capitalize(currentRun?.step), [currentRun?.step]);

  const mainNodes   = useMemo(() => buildMainStageNodes(currentRun), [currentRun]);
  const floodNode   = useMemo(() => buildHazardNode("flood", currentRun), [currentRun]);
  const droughtNode = useMemo(() => buildHazardNode("drought", currentRun), [currentRun]);
  const multiNode   = useMemo(() => buildHazardNode("multi", currentRun), [currentRun]);

  return (
    <main className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">PIPELINE MONITOR</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Alur Proses</h1>
          <p className="mt-1 text-xs text-slate-500">
            Riwayat run, aktivasi data aktif, dan status pipeline real-time ·{" "}
            auto-refresh setiap {POLL_MS / 1000}s
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Link
            href="/admin/process-control"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Jalankan Pipeline
          </Link>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Memuat…" : "Refresh"}
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">STATUS SAAT INI</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Run Terbaru</h2>
          </div>
          {currentRun && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(currentRun.status)}`}>
              {capitalize(currentRun.status)}
            </span>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="h-8 rounded bg-slate-200" />
          </div>
        ) : currentRun === null ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Belum ada monitoring run.{" "}
            <Link href="/admin/process-control" className="font-semibold text-[var(--color-primary)] hover:underline">
              Jalankan pipeline →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Progress */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
                <p className="text-sm font-bold text-slate-900">{currentRun.progress}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${getProgressBarClass(currentRun.status)}`}
                  style={{ width: `${Math.min(100, Math.max(0, currentRun.progress))}%` }}
                />
              </div>
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Tahap",    value: capitalize(currentRun.step) || "—"     },
                { label: "Hazard",   value: capitalize(extractHazard(currentRun.run_name)) || "—" },
                { label: "Operator", value: currentRun.operator_name || "—"        },
                { label: "Mulai",    value: formatDateTime(currentRun.created_at)  },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-800" title={value}>{value}</p>
                </div>
              ))}
            </div>

            {currentRun.message && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Keterangan</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{currentRun.message}</p>
              </div>
            )}

            {(currentRun.status === "success" || currentRun.status === "failed") && (
              <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                currentRun.status === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}>
                <span>{currentRun.status === "success" ? "Pipeline selesai." : "Pipeline gagal."}</span>
                <Link href="/admin/outputs" className="font-semibold underline-offset-2 hover:underline">
                  Lihat Output →
                </Link>
              </div>
            )}
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
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {mainNodes.map((node) => <NodeCard key={node.id} node={node} />)}
        </div>
      </section>

      {/* ── Hazard branches — compact strip ─────────────────────────────────── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            JALUR HAZARD
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Status per Hazard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Status analisis untuk masing-masing jalur hazard pada run terpilih.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[floodNode, droughtNode, multiNode].map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
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
                  {["Run Name", "Status", "Aktif", "Progress", "Th. Model", "Operator", "Dibuat", "Selesai", "Aksi"].map((h) => (
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
                {recentRuns.map((run) => {
                  const isSuccess  = run.status === "success";
                  const isThisActive = run.is_active;
                  return (
                    <tr key={run.id} className={`transition-colors hover:bg-slate-50 ${isThisActive ? "bg-amber-50/40" : ""}`}>
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
                        {isThisActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            Aktif
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
                      <td className="py-3 pr-4">
                        {editingYearRunId === run.id ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={yearDraft}
                                onChange={(e) => setYearDraft(e.target.value)}
                                placeholder="Tahun"
                                min={1990}
                                max={2100}
                                className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-900 focus:border-[var(--color-primary)] focus:outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void saveDataYear(run.id);
                                  if (e.key === "Escape") cancelEditYear();
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => void saveDataYear(run.id)}
                                disabled={savingYear}
                                className="rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                              >
                                {savingYear ? "…" : "Simpan"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditYear}
                                className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                Batal
                              </button>
                            </div>
                            {yearError && (
                              <p className="text-[10px] text-red-500">{yearError}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-700">
                              {run.data_year ?? <span className="font-normal text-slate-400">—</span>}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditYear(run)}
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit tahun model data"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{run.operator_name || "-"}</td>
                      <td className="py-3 pr-4 text-slate-500">{formatDateTime(run.created_at)}</td>
                      <td className="py-3 pr-4 text-slate-500">{formatDateTime(run.finished_at)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openActivationModal(run)}
                            disabled={!isSuccess || isThisActive}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
                            title={
                              !isSuccess
                                ? "Hanya run sukses yang dapat diaktifkan"
                                : isThisActive
                                ? "Run ini sudah aktif"
                                : "Jadikan run ini sumber data dashboard"
                            }
                          >
                            <Power className="h-3.5 w-3.5" />
                            {isThisActive ? "Aktif" : "Aktifkan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeletionModal(run)}
                            disabled={isThisActive || run.status === "running"}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
                            title={
                              isThisActive
                                ? "Run aktif tidak dapat dihapus. Aktifkan run lain dulu."
                                : run.status === "running"
                                ? "Run yang sedang berjalan tidak dapat dihapus."
                                : "Hapus run ini beserta seluruh data turunannya"
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {activeRunId !== null && (
              <p className="mt-3 text-xs text-slate-500">
                Dashboard publik saat ini menggunakan{" "}
                <span className="font-semibold text-slate-700">Run #{activeRunId}</span>
                {" "}sebagai sumber data.
              </p>
            )}
            {activeRunId === null && (
              <p className="mt-3 text-xs text-slate-500">
                Belum ada run yang diaktifkan secara eksplisit. Dashboard memakai
                run sukses terbaru sebagai fallback.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Panduan singkat — inline hint, bukan section terpisah */}
      <p className="px-1 text-xs text-slate-400">
        Tahap: Preprocess → Zonal → Analysis → ETL. Jalur hazard ditentukan dari prefix <code>run_name</code>.
        Auto-refresh setiap {POLL_MS / 1000} detik.
        Panduan lengkap di halaman <Link href="/admin/guide" className="underline hover:text-slate-700">Admin Guide</Link>.
      </p>

      {/* ── Activation modal ─────────────────────────────────────────────────── */}
      {activationTarget && (
        <ActivationModal
          run={activationTarget}
          validation={validation}
          validationLoading={validationLoading}
          validationError={validationError}
          activating={activating}
          activationError={activationError}
          onClose={closeActivationModal}
          onConfirm={submitActivation}
        />
      )}

      {/* ── Deletion modal ───────────────────────────────────────────────────── */}
      {deletionTarget && (
        <DeletionModal
          run={deletionTarget}
          validation={deletionValidation}
          validationLoading={deletionValidationLoading}
          validationError={deletionValidationError}
          deleting={deleting}
          deletionError={deletionError}
          confirmText={deletionConfirmText}
          onConfirmTextChange={setDeletionConfirmText}
          onClose={closeDeletionModal}
          onConfirm={submitDeletion}
        />
      )}
    </main>
  );
}

// =============================================================================
// ActivationModal
// =============================================================================

function ActivationModal({
  run,
  validation,
  validationLoading,
  validationError,
  activating,
  activationError,
  onClose,
  onConfirm,
}: {
  run: RunStatus;
  validation: ValidationResult | null;
  validationLoading: boolean;
  validationError: string;
  activating: boolean;
  activationError: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const allHazards: string[] = ["flood", "drought", "multihazard"];

  function regionsForHazard(rows: ValidationTableRow[], hazard: string): number {
    return rows.find((r) => r.hazard === hazard)?.regions ?? 0;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              AKTIFKAN RUN
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Run #{run.id} — {run.run_name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Setelah diaktifkan, dashboard publik akan memakai run ini sebagai
              sumber data untuk semua hazard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={activating}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {validationLoading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Memvalidasi data run…
            </div>
          )}

          {!validationLoading && validationError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {validationError}
            </div>
          )}

          {!validationLoading && validation && (
            <>
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  validation.complete
                    ? "border-green-200 bg-green-50 text-green-700"
                    : validation.all_hazards_present
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {validation.complete && (
                  <p className="font-semibold">
                    Run lengkap. Semua hazard punya data di tabel aal, losses,
                    dan zonal_kabupaten.
                  </p>
                )}
                {!validation.complete && validation.all_hazards_present && (
                  <p className="font-semibold">
                    Tabel aal lengkap untuk ketiga hazard, namun ada tabel lain
                    yang belum lengkap. Aktivasi tetap aman untuk tampilan
                    ringkasan AAL.
                  </p>
                )}
                {!validation.all_hazards_present && (
                  <p className="font-semibold">
                    Salah satu hazard belum punya data di tabel aal. Mengaktifkan
                    run ini akan membuat sebagian dashboard kosong.
                  </p>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tabel
                      </th>
                      {allHazards.map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {formatHazardLabel(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(["aal", "losses", "zonal_kabupaten"] as const).map((tableKey) => {
                      const rows = validation.tables[tableKey] ?? [];
                      return (
                        <tr key={tableKey}>
                          <td className="px-4 py-2 font-medium text-slate-700">
                            {tableKey}
                          </td>
                          {allHazards.map((hazard) => {
                            const regions = regionsForHazard(rows, hazard);
                            const empty   = regions === 0;
                            return (
                              <td
                                key={hazard}
                                className={`px-4 py-2 text-right tabular-nums ${
                                  empty ? "text-red-600" : "text-slate-700"
                                }`}
                              >
                                {regions.toLocaleString("id-ID")}
                                <span className="ml-1 text-xs text-slate-400">kab</span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500">
                Angka menunjukkan jumlah kabupaten/kota dengan nilai &gt; 0 pada
                run ini.
              </p>
            </>
          )}

          {activationError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {activationError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={activating}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={activating || validationLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Power className="h-4 w-4" />
            {activating ? "Mengaktifkan…" : "Aktifkan Run Ini"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DeletionModal
// =============================================================================

function DeletionModal({
  run,
  validation,
  validationLoading,
  validationError,
  deleting,
  deletionError,
  confirmText,
  onConfirmTextChange,
  onClose,
  onConfirm,
}: {
  run: RunStatus;
  validation: ValidationResult | null;
  validationLoading: boolean;
  validationError: string;
  deleting: boolean;
  deletionError: string;
  confirmText: string;
  onConfirmTextChange: (next: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const allHazards: string[] = ["flood", "drought", "multihazard"];

  function totalRowsForTable(rows: ValidationTableRow[] | undefined): number {
    if (!rows) return 0;
    return rows.reduce((sum, r) => sum + (r.rows ?? 0), 0);
  }

  function rowsForHazard(rows: ValidationTableRow[], hazard: string): number {
    return rows.find((r) => r.hazard === hazard)?.rows ?? 0;
  }

  const expectedConfirm = String(run.id);
  const confirmMatches  = confirmText.trim() === expectedConfirm;

  const grandTotal =
    totalRowsForTable(validation?.tables.aal) +
    totalRowsForTable(validation?.tables.losses) +
    totalRowsForTable(validation?.tables.zonal_kabupaten);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-red-600">
              HAPUS PERMANEN
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Run #{run.id} — {run.run_name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Operasi ini tidak dapat dibatalkan. Run beserta seluruh data
              turunannya di tabel aal, losses, dan zonal_kabupaten akan terhapus
              permanen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {validationLoading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Memuat ringkasan data run…
            </div>
          )}

          {!validationLoading && validationError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {validationError}
            </div>
          )}

          {!validationLoading && validation && (
            <>
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="font-semibold">
                  Total{" "}
                  <span className="tabular-nums">
                    {grandTotal.toLocaleString("id-ID")}
                  </span>{" "}
                  baris akan terhapus dari ketiga tabel.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tabel
                      </th>
                      {allHazards.map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {formatHazardLabel(h)}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(["aal", "losses", "zonal_kabupaten"] as const).map((tableKey) => {
                      const rows = validation.tables[tableKey] ?? [];
                      const total = totalRowsForTable(rows);
                      return (
                        <tr key={tableKey}>
                          <td className="px-4 py-2 font-medium text-slate-700">
                            {tableKey}
                          </td>
                          {allHazards.map((hazard) => (
                            <td
                              key={hazard}
                              className="px-4 py-2 text-right tabular-nums text-slate-700"
                            >
                              {rowsForHazard(rows, hazard).toLocaleString("id-ID")}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">
                            {total.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500">
                Angka menunjukkan jumlah baris (bukan kabupaten unik) yang akan
                terhapus per tabel per hazard.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Untuk konfirmasi, ketik{" "}
                  <span className="font-mono font-semibold text-red-600">
                    {expectedConfirm}
                  </span>{" "}
                  (ID run) di bawah:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => onConfirmTextChange(e.target.value)}
                  disabled={deleting}
                  autoComplete="off"
                  placeholder={expectedConfirm}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:opacity-50"
                />
              </div>
            </>
          )}

          {deletionError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deletionError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || validationLoading || !confirmMatches}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Menghapus…" : "Hapus Permanen"}
          </button>
        </div>
      </div>
    </div>
  );
}
