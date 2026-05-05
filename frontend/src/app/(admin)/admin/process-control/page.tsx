"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock3,
  Database,
  Gauge,
  GitBranch,
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

type FinalFile = {
  hazard: string;
  filename: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  modified_at: string | null;
};

type FinalAnalysisStatus = {
  ready: boolean;
  files: FinalFile[];
  missing: string[];
};

const HAZARD_OPTIONS: { key: HazardKey; label: string; desc: string }[] = [
  {
    key: "flood",
    label: "Flood",
    desc: "Analisis hazard banjir → menghasilkan kabkota_flood_final.geojson.",
  },
  {
    key: "drought",
    label: "Drought",
    desc: "Analisis hazard kekeringan → menghasilkan kabkota_drought_final.geojson.",
  },
  {
    key: "multi",
    label: "Multi-hazard",
    desc: "Gabungkan flood + drought → menghasilkan kabkota_multihazard_final.geojson. Butuh dua file final lain sudah ada.",
  },
];

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

const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pending: "Menunggu",
  running: "Berjalan",
  success: "Selesai",
  failed:  "Gagal",
};

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

function formatBytes(n: number) {
  if (!n) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
            {STEP_STATUS_LABEL[step.status]}
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
  const [finalStatus, setFinalStatus] = useState<FinalAnalysisStatus | null>(null);
  const [runningAction, setRunningAction] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasRunThisSession, setHasRunThisSession] = useState(false);

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

  const loadFinalStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/final-analysis-status");
      if (!res.ok) return;
      const json: FinalAnalysisStatus = await res.json();
      setFinalStatus(json);
    } catch {
      // non-blocking — UI tetap tampil meskipun status final gagal dimuat
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadFinalStatus();
  }, [loadStatus, loadFinalStatus]);

  useEffect(() => {
    if (status?.status !== "running") return;
    const id = setInterval(() => {
      loadStatus(false);
      loadFinalStatus();
    }, 2000);
    return () => clearInterval(id);
  }, [status?.status, loadStatus, loadFinalStatus]);

  // Re-poll final status setelah pipeline berhasil selesai (file mungkin baru ditulis)
  useEffect(() => {
    if (status?.status === "success") {
      loadFinalStatus();
    }
  }, [status?.status, loadFinalStatus]);

  async function handleRun(mode: ModeKey) {
    try {
      setRunningAction(true);
      setErrorMessage("");
      setSuccessMessage("");
      const res = await fetchWithAuth("/api/admin/start-pipeline", {
        method: "POST",
        body: JSON.stringify({ mode, hazard: selectedHazard, operator: operatorName || "operator" }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 202) {
        const pid = (json as any).pid;
        setSuccessMessage(
          `Pipeline analisis berhasil dimulai${pid ? ` (PID ${pid})` : ""}. Pantau progress di bawah.`
        );
        setHasRunThisSession(true);
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

  async function handleLoadDatabase() {
    try {
      setRunningAction(true);
      setErrorMessage("");
      setSuccessMessage("");

      // Refresh status terlebih dahulu agar pesan error akurat.
      await loadFinalStatus();

      const res = await fetchWithAuth("/api/admin/load-database", {
        method: "POST",
        body: JSON.stringify({ operator: operatorName || "operator" }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 202) {
        const pid = (json as any).pid;
        setSuccessMessage(
          `Load database berhasil dimulai${pid ? ` (PID ${pid})` : ""}. Pantau progress di bawah.`
        );
        setHasRunThisSession(true);
        await loadStatus(false);
      } else if (res.status === 409) {
        const missing = (json as any).missing as string[] | undefined;
        if (missing && missing.length > 0) {
          setFinalStatus((prev) =>
            prev
              ? { ...prev, missing, ready: false }
              : { ready: false, files: [], missing }
          );
          setErrorMessage(
            `Belum bisa memuat ke database. File final berikut belum tersedia: ${missing.join(", ")}.`
          );
        } else {
          setErrorMessage((json as any)?.error || "Tidak dapat menjalankan load database saat ini.");
        }
      } else {
        throw new Error(
          (json as any)?.error ||
          `Gagal memulai load database (${res.status}). Periksa koneksi server.`
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal menjalankan load database. Periksa koneksi server.");
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
  const isPipelineRunning = status?.status === "running";
  const canRun = !runningAction && !isPipelineRunning;
  const finalReady = finalStatus?.ready === true;
  const canLoadDatabase = canRun && finalReady;

  const readyCount = finalStatus
    ? finalStatus.files.filter((f) => f.exists).length
    : 0;
  const totalFinal = finalStatus?.files.length ?? 3;

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
              Jalankan pipeline analisis hazard untuk menghasilkan file final, lalu muat ketiga
              hasil ke database setelah semuanya siap.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              loadStatus(true);
              loadFinalStatus();
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Memuat..." : "Refresh"}
          </button>
        </div>

        {/* Workflow guide */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Alur kerja singkat</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
            <li>Jalankan <span className="font-semibold">Pipeline Penuh</span> untuk hazard <em>flood</em>, lalu <em>drought</em>, lalu <em>multi-hazard</em>.</li>
            <li>Setelah ketiga file final tersedia, klik <span className="font-semibold">Muat ke Database</span> untuk push hasil ke Postgres.</li>
            <li>Setelah ETL sukses, aktifkan run baru di halaman <Link href="/admin/pipeline-monitor" className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline">Pipeline Monitor</Link>.</li>
          </ol>
        </div>
      </section>

      {successMessage && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {hasRunThisSession && status?.status === "success" && (
        <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          <GitBranch className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Proses terakhir selesai dengan sukses.</p>
            <p className="mt-1 leading-relaxed">
              Buka{" "}
              <Link
                href="/admin/pipeline-monitor"
                className="font-semibold underline underline-offset-2"
              >
                Pipeline Monitor
              </Link>{" "}
              untuk mengaktifkan run baru ke frontend.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Final analysis readiness */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              KESIAPAN FILE FINAL
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Status File Final Analisis
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Database hanya dapat dimuat setelah ketiga file final ini tersedia.
            </p>
          </div>
          <div
            className={
              finalReady
                ? "inline-flex items-center gap-2 self-start rounded-full bg-green-50 px-4 py-2 text-xs font-semibold text-green-700"
                : "inline-flex items-center gap-2 self-start rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700"
            }
          >
            {finalReady ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
            {finalReady ? "Siap dimuat ke database" : `Belum lengkap (${readyCount}/${totalFinal})`}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {(finalStatus?.files ?? [
            { hazard: "flood",       filename: "kabkota_flood_final.geojson",       exists: false, path: "", size_bytes: 0, modified_at: null },
            { hazard: "drought",     filename: "kabkota_drought_final.geojson",     exists: false, path: "", size_bytes: 0, modified_at: null },
            { hazard: "multihazard", filename: "kabkota_multihazard_final.geojson", exists: false, path: "", size_bytes: 0, modified_at: null },
          ]).map((file) => (
            <div
              key={file.filename}
              className={
                file.exists
                  ? "rounded-2xl border border-green-200 bg-green-50/50 p-4"
                  : "rounded-2xl border border-slate-200 bg-slate-50 p-4"
              }
            >
              <div className="flex items-center gap-2">
                {file.exists ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-slate-400" />
                )}
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {file.hazard}
                </p>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-slate-600">
                {file.filename}
              </p>
              <dl className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex justify-between">
                  <dt>Status</dt>
                  <dd className={file.exists ? "font-semibold text-green-700" : "font-semibold text-amber-700"}>
                    {file.exists ? "Tersedia" : "Belum ada"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Ukuran</dt>
                  <dd>{file.exists ? formatBytes(file.size_bytes) : "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Diperbarui</dt>
                  <dd>{file.exists ? formatDateTime(file.modified_at) : "-"}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

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
              Pilih hazard dan operator. Tombol Pipeline Penuh hanya menjalankan analisis
              (tanpa load database).
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
                  disabled={isPipelineRunning}
                  className={
                    active
                      ? "rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-4 text-left shadow-sm"
                      : "rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={isPipelineRunning}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {selectedHazard === "multi" && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">Perhatian:</span>{" "}
                Multi-hazard membutuhkan kabkota_flood_final.geojson dan kabkota_drought_final.geojson sudah ada.
                Pipeline ini hanya menjalankan langkah multi-hazard — flood dan drought tidak akan dijalankan ulang.
              </span>
            </div>
          )}

          {/* Primary actions */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2">
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
              <p className="text-xs leading-relaxed text-slate-500">
                Menjalankan analisis hazard yang dipilih sampai menghasilkan file final GeoJSON.
                <span className="font-semibold"> Tidak</span> memuat ke database.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLoadDatabase}
                disabled={!canLoadDatabase}
                title={!finalReady ? "Lengkapi ketiga file final terlebih dahulu" : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Database className="h-4 w-4 shrink-0" />
                <span>Muat ke Database</span>
              </button>
              <p className="text-xs leading-relaxed text-slate-500">
                Memuat ketiga file final ke Postgres (flood + drought + multihazard sekaligus).
                Aktif setelah ketiga file final tersedia.
              </p>
            </div>
          </div>

          {/* Advanced (collapsed by default) */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              <span className="inline-flex items-center gap-1">
              {showAdvanced ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {showAdvanced ? "Sembunyikan opsi lanjutan" : "Opsi lanjutan"}
            </span>
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
