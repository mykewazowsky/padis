"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FolderTree,
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

function capitalize(text?: string | null) {
  if (!text) return "-";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getMainStatusTone(status?: string | null, lastResult?: string | null) {
  if (status === "running") {
    return {
      label: "Running",
      className: "text-amber-600",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (lastResult === "success") {
    return {
      label: "Idle (OK)",
      className: "text-green-600",
      badgeClass: "border-green-200 bg-green-50 text-green-700",
    };
  }

  if (lastResult === "failed") {
    return {
      label: "Idle (Failed)",
      className: "text-red-600",
      badgeClass: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: capitalize(status || "idle"),
    className: "text-slate-900",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function getNodeStyles(state: StepState) {
  if (state === "success") {
    return {
      border: "border-green-200",
      bg: "bg-green-50",
      text: "text-green-700",
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      statusLabel: "SUCCESS",
    };
  }

  if (state === "running") {
    return {
      border: "border-blue-200",
      bg: "bg-blue-50",
      text: "text-blue-700",
      icon: <Clock3 className="h-4 w-4 text-blue-600" />,
      statusLabel: "RUNNING",
    };
  }

  if (state === "failed") {
    return {
      border: "border-red-200",
      bg: "bg-red-50",
      text: "text-red-700",
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      statusLabel: "FAILED",
    };
  }

  return {
    border: "border-slate-200",
    bg: "bg-slate-50",
    text: "text-slate-600",
    icon: <Activity className="h-4 w-4 text-slate-400" />,
    statusLabel: "PENDING",
  };
}

function inferMainStage(currentStep?: number, totalSteps?: number): string {
  if (currentStep == null || totalSteps == null) return "Idle";

  if (currentStep <= 0) return "Preprocess";
  if (currentStep === 1) return "Zonal";
  if (currentStep >= 2) return "Analysis";

  return "Idle";
}

function buildMainStageNodes(status: ProcessStatus | null): PipelineNode[] {
  const currentStep = status?.current_step ?? -1;
  const isRunning = status?.status === "running";
  const failed = status?.last_result === "failed";

  return [
    {
      id: "preprocess",
      label: "Preprocess",
      desc: "Menyiapkan data awal sebelum analisis berjalan.",
      state:
        currentStep > 0
          ? "success"
          : currentStep === 0 && isRunning
          ? "running"
          : currentStep === 0 && failed
          ? "failed"
          : "pending",
    },
    {
      id: "zonal",
      label: "Zonal",
      desc: "Menghitung statistik per wilayah untuk data hazard.",
      state:
        currentStep > 1
          ? "success"
          : currentStep === 1 && isRunning
          ? "running"
          : currentStep === 1 && failed
          ? "failed"
          : "pending",
    },
    {
      id: "analysis",
      label: "Analysis",
      desc: "Menghasilkan output analisis utama dan ringkasan akhir.",
      state:
        currentStep > 2
          ? "success"
          : currentStep >= 2 && isRunning
          ? "running"
          : currentStep >= 2 && failed
          ? "failed"
          : "pending",
    },
  ];
}

function buildHazardNodes(
  hazard: HazardKey,
  status: ProcessStatus | null
): PipelineNode[] {
  const isRunningHazard = status?.hazard === hazard;
  const isRunning = status?.status === "running";
  const failed = status?.last_result === "failed";
  const succeeded = status?.last_result === "success";

  if (hazard === "flood") {
    return [
      {
        id: "flood-lop",
        label: "Flood LOP",
        desc: "Menghitung peluang kerugian untuk hazard banjir.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "flood" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
      {
        id: "flood-loss",
        label: "Flood Loss",
        desc: "Menghasilkan nilai kerugian banjir per wilayah.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "flood" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
      {
        id: "flood-aal",
        label: "Flood AAL",
        desc: "Menghitung AAL untuk hazard banjir.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "flood" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
      {
        id: "flood-web",
        label: "Flood Output",
        desc: "Menyiapkan hasil akhir banjir untuk dipakai sistem.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "flood" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
    ];
  }

  if (hazard === "drought") {
    return [
      {
        id: "drought-di",
        label: "Drought DI",
        desc: "Menghitung indikator kekeringan.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "drought" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
      {
        id: "drought-lop",
        label: "Drought LOP",
        desc: "Menghitung peluang kerugian untuk kekeringan.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "drought" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
      {
        id: "drought-loss",
        label: "Drought Loss",
        desc: "Menghasilkan nilai kerugian kekeringan per wilayah.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "drought" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
      {
        id: "drought-aal",
        label: "Drought AAL",
        desc: "Menghitung AAL untuk hazard kekeringan.",
        state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "drought" ? "success" : failed && isRunningHazard ? "failed" : "pending",
      },
    ];
  }

  return [
    {
      id: "multi-merge",
      label: "Merge Hazards",
      desc: "Menggabungkan hasil flood dan drought.",
      state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "multi" ? "success" : failed && isRunningHazard ? "failed" : "pending",
    },
    {
      id: "multi-loss",
      label: "Multi Loss",
      desc: "Menghasilkan nilai kerugian gabungan multi-hazard.",
      state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "multi" ? "success" : failed && isRunningHazard ? "failed" : "pending",
    },
    {
      id: "multi-aal",
      label: "Multi AAL",
      desc: "Menghitung AAL untuk multi-hazard.",
      state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "multi" ? "success" : failed && isRunningHazard ? "failed" : "pending",
    },
    {
      id: "multi-output",
      label: "Multi Output",
      desc: "Menyiapkan hasil akhir multi-hazard untuk sistem.",
      state: isRunningHazard && isRunning ? "running" : succeeded && status?.hazard === "multi" ? "success" : failed && isRunningHazard ? "failed" : "pending",
    },
  ];
}

function NodeCard({ node }: { node: PipelineNode }) {
  const styles = getNodeStyles(node.state);

  return (
    <div
      className={`rounded-2xl border p-4 ${styles.border} ${styles.bg}`}
    >
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
      console.error("Load pipeline monitor error:", err);
      setErrorMessage(err?.message || "Gagal memuat status pipeline.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.status !== "running") return;

    const intervalId = setInterval(() => {
      loadStatus(false);
    }, 2500);

    return () => clearInterval(intervalId);
  }, [status?.status, loadStatus]);

  const statusTone = useMemo(() => {
    return getMainStatusTone(status?.status, status?.last_result);
  }, [status?.status, status?.last_result]);

  const mainStage = useMemo(() => {
    return inferMainStage(status?.current_step, status?.total_steps);
  }, [status?.current_step, status?.total_steps]);

  const mainNodes = useMemo(() => {
    return buildMainStageNodes(status);
  }, [status]);

  const floodNodes = useMemo(() => buildHazardNodes("flood", status), [status]);
  const droughtNodes = useMemo(
    () => buildHazardNodes("drought", status),
    [status]
  );
  const multiNodes = useMemo(() => buildHazardNodes("multi", status), [status]);

  const recentLogs = useMemo(() => {
    return (status?.logs || []).slice(-5).reverse();
  }, [status?.logs]);

  const activeHazard = capitalize(status?.hazard || "-");
  const activeMode = capitalize(status?.mode || "-");

  return (
    <main className="space-y-6">
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
              Lihat tahapan proses, status setiap langkah, dan alur hazard dalam
              satu tampilan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadStatus(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Memuat..." : "Refresh"}
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

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
            Status utama proses yang sedang berjalan atau terakhir dijalankan.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Tahap Aktif</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {mainStage}
              </h2>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3">
              <Workflow className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Tahap utama pipeline yang sedang aktif saat ini.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Hazard</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {activeHazard}
              </h2>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <GitBranch className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Hazard yang sedang diproses atau terakhir dijalankan.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Mode</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {activeMode}
              </h2>
            </div>
            <div className="rounded-2xl bg-green-50 p-3">
              <Layers3 className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Mode proses yang sedang dipakai sistem.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
            MAIN PIPELINE
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Tahap Utama Proses
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Alur utama pipeline dari awal sampai hasil akhir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {mainNodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      </section>

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
            {floodNodes.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
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
            {droughtNodes.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
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
            {multiNodes.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
          </div>
        </div>
      </section>

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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progress
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {status?.progress_percent ?? 0}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, status?.progress_percent ?? 0)
                    )}%`,
                  }}
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
                  Started At
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(status?.started_at)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Message
              </p>
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
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Log Singkat
            </h2>
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
                      hasError
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {log.script || log.message || "Log entry"}
                    </p>
                    {hasError ? (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Terjadi error pada langkah ini.
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

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
              Menunjukkan alur besar proses dari preprocess sampai analysis.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="font-semibold text-slate-900">Jalur Hazard</p>
            <p className="mt-2 text-sm text-slate-600">
              Menunjukkan langkah yang terkait dengan flood, drought, dan
              multi-hazard.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="font-semibold text-slate-900">Status Node</p>
            <p className="mt-2 text-sm text-slate-600">
              Pending berarti belum berjalan, running berarti sedang aktif,
              success berarti selesai, dan failed berarti gagal.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}