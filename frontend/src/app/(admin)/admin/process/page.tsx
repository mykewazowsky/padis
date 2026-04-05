"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";
import { fetchWithAuth } from "../../../../lib/fetcher-auth";

type HazardKey = "flood" | "drought" | "multi";
type ModeKey = "full" | "preprocess" | "analysis" | "web";

type DependencyItem = {
  type?: string;
  label: string;
  path: string;
  exists: boolean;
};

type DependencyResponse =
  | DependencyItem[]
  | {
      hazard: string;
      all_ok: boolean;
      checks: DependencyItem[];
    };

type ProcessLog = {
  script: string;
  returncode: number;
  stdout: string;
  stderr: string;
  timestamp: string;
};

type UpdatedOutput = {
  filename: string;
  modified_at: string;
  size_bytes: number;
};

type ProcessStatus = {
  status: "idle" | "running";
  started_at: string | null;
  finished_at: string | null;
  last_result: string | null;
  message: string;
  hazard: HazardKey | null;
  mode: ModeKey | null;
  logs: ProcessLog[];
  current_script: string | null;
  current_step: number;
  total_steps: number;
  progress_percent: number;
  updated_outputs?: UpdatedOutput[];
};

const HAZARD_OPTIONS: { key: HazardKey; label: string; desc: string }[] = [
  {
    key: "flood",
    label: "Flood",
    desc: "Pipeline banjir: preprocess raster, zonal, agregasi, LOP, loss, AAL, dan web layer.",
  },
  {
    key: "drought",
    label: "Drought",
    desc: "Pipeline kekeringan: preprocess raster, zonal, agregasi, DI, LOP, loss, AAL, dan web layer.",
  },
  {
    key: "multi",
    label: "Multi-hazard",
    desc: "Pipeline multi-hazard: gabungkan flood + drought, hitung AAL, lalu siapkan web layer.",
  },
];

const MODE_OPTIONS: { key: ModeKey; label: string; desc: string }[] = [
  {
    key: "full",
    label: "Full",
    desc: "Menjalankan seluruh tahapan pipeline untuk hazard yang dipilih.",
  },
  {
    key: "preprocess",
    label: "Preprocess",
    desc: "Menyiapkan input dasar sebelum analisis.",
  },
  {
    key: "analysis",
    label: "Analysis",
    desc: "Menjalankan proses analisis utama sampai output analitik siap.",
  },
  {
    key: "web",
    label: "Web",
    desc: "Membuat output layer web dan menambahkan AAL ke layer final.",
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getResultBadge(lastResult?: string | null) {
  if (lastResult === "success") {
    return "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
  }
  if (lastResult === "failed") {
    return "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
  }
  if (lastResult === "running") {
    return "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700";
  }
  return "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";
}

function getResultText(lastResult?: string | null) {
  if (lastResult === "success") return "Success";
  if (lastResult === "failed") return "Failed";
  if (lastResult === "running") return "Running";
  return "Idle";
}

export default function AdminProcessPage() {
  const [selectedHazard, setSelectedHazard] = useState<HazardKey>("multi");
  const [selectedMode, setSelectedMode] = useState<ModeKey>("full");

  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [dependencies, setDependencies] = useState<DependencyItem[]>([]);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingDependencies, setLoadingDependencies] = useState(true);
  const [runningAction, setRunningAction] = useState(false);

  const [error, setError] = useState("");
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(0);

  const selectedHazardMeta = useMemo(
    () => HAZARD_OPTIONS.find((item) => item.key === selectedHazard),
    [selectedHazard]
  );

  const selectedModeMeta = useMemo(
    () => MODE_OPTIONS.find((item) => item.key === selectedMode),
    [selectedMode]
  );

  const loadProcessStatus = useCallback(async () => {
    try {
      setLoadingStatus((prev) => (status ? prev : true));

      const res = await fetchWithAuth("/api/admin/process-status");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat process status.");
      }

      setStatus(json);
    } catch (err: any) {
      console.error("Load process status error:", err);
      setError(err.message || "Gagal memuat process status.");
    } finally {
      setLoadingStatus(false);
    }
  }, [status]);

  const loadDependencies = useCallback(async (hazard: HazardKey) => {
    try {
      setLoadingDependencies(true);

      const res = await fetchWithAuth(`/api/admin/dependencies?hazard=${hazard}`);
      const json: DependencyResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          (json as any)?.error || "Gagal memuat dependency pipeline."
        );
      }

      if (Array.isArray(json)) {
        setDependencies(json);
      } else {
        setDependencies(json.checks || []);
      }
    } catch (err: any) {
      console.error("Load dependencies error:", err);
      setError(err.message || "Gagal memuat dependency pipeline.");
      setDependencies([]);
    } finally {
      setLoadingDependencies(false);
    }
  }, []);

  useEffect(() => {
    loadProcessStatus();
  }, [loadProcessStatus]);

  useEffect(() => {
    loadDependencies(selectedHazard);
  }, [selectedHazard, loadDependencies]);

  useEffect(() => {
    if (status?.status !== "running") return;

    const interval = window.setInterval(() => {
      loadProcessStatus();
    }, 2500);

    return () => window.clearInterval(interval);
  }, [status?.status, loadProcessStatus]);

  async function handleRunPipeline() {
    if (runningAction) return;

    try {
      setRunningAction(true);
      setError("");

      const res = await fetchWithAuth("/api/admin/run-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hazard: selectedHazard,
          mode: selectedMode,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal menjalankan pipeline.");
      }

      await loadProcessStatus();
      await loadDependencies(selectedHazard);
    } catch (err: any) {
      console.error("Run pipeline error:", err);
      setError(err.message || "Gagal menjalankan pipeline.");
    } finally {
      setRunningAction(false);
    }
  }

  async function handleFinishManual() {
    if (runningAction) return;

    try {
      setRunningAction(true);
      setError("");

      const res = await fetchWithAuth("/api/admin/finish-analysis", {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal menyelesaikan analisis manual.");
      }

      await loadProcessStatus();
    } catch (err: any) {
      console.error("Finish analysis error:", err);
      setError(err.message || "Gagal menyelesaikan analisis manual.");
    } finally {
      setRunningAction(false);
    }
  }

  async function handleDownload(filename: string) {
    try {
      setError("");

      const token = getToken();
      const res = await fetch(
        buildApiUrl(`/api/admin/outputs/download?filename=${encodeURIComponent(filename)}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        let message = "Gagal mengunduh file.";
        try {
          const json = await res.json();
          message = json.error || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Download output error:", err);
      setError(err.message || "Gagal mengunduh file.");
    }
  }

  const dependencySummary = useMemo(() => {
    const total = dependencies.length;
    const ok = dependencies.filter((item) => item.exists).length;
    const missing = total - ok;
    return { total, ok, missing };
  }, [dependencies]);

  const canRun = useMemo(() => {
    if (!status) return true;
    if (status.status === "running") return false;
    return true;
  }, [status]);

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
        <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
          PROCESS CONTROL
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Admin Pipeline PADIS
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 md:text-base">
          Jalankan pipeline flood, drought, atau multi-hazard dari admin panel,
          lalu pantau progress, dependency, log proses, dan output yang diperbarui.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Status Saat Ini</p>
          <div className="mt-3">
            <span className={getResultBadge(status?.last_result)}>
              {loadingStatus ? "Loading..." : getResultText(status?.last_result)}
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            {loadingStatus ? "Memuat status..." : status?.message || "-"}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Current Script</p>
          <p className="mt-2 break-all text-base font-semibold text-gray-900">
            {loadingStatus ? "Loading..." : status?.current_script || "-"}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Step {status?.current_step ?? 0} / {status?.total_steps ?? 0}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Progress</p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-primary)]">
            {loadingStatus ? "..." : `${status?.progress_percent ?? 0}%`}
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${status?.progress_percent ?? 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Last Finished</p>
          <p className="mt-2 text-base font-semibold text-gray-900">
            {loadingStatus ? "Loading..." : formatDateTime(status?.finished_at)}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Started: {formatDateTime(status?.started_at)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              PIPELINE SETUP
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
              Pilih Hazard dan Mode
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Tentukan pipeline yang ingin dijalankan dari admin panel.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-800">Hazard</p>
              <div className="space-y-3">
                {HAZARD_OPTIONS.map((item) => {
                  const active = selectedHazard === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedHazard(item.key)}
                      className={
                        active
                          ? "w-full rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-4 py-3 text-left"
                          : "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-[var(--color-primary)]"
                      }
                    >
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      <p className="mt-1 text-xs text-gray-600">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-800">Mode</p>
              <div className="space-y-3">
                {MODE_OPTIONS.map((item) => {
                  const active = selectedMode === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedMode(item.key)}
                      className={
                        active
                          ? "w-full rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-4 py-3 text-left"
                          : "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-[var(--color-primary)]"
                      }
                    >
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      <p className="mt-1 text-xs text-gray-600">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs text-gray-500">Hazard Terpilih</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {selectedHazardMeta?.label}
              </p>
              <p className="mt-1 text-xs text-gray-600">{selectedHazardMeta?.desc}</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs text-gray-500">Mode Terpilih</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {selectedModeMeta?.label}
              </p>
              <p className="mt-1 text-xs text-gray-600">{selectedModeMeta?.desc}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRunPipeline}
              disabled={!canRun || runningAction}
              className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runningAction ? "Menjalankan..." : "Run Pipeline"}
            </button>

            <button
              type="button"
              onClick={handleFinishManual}
              disabled={runningAction}
              className="btn-outline text-sm font-medium disabled:opacity-60"
            >
              Finish Manual
            </button>

            <button
              type="button"
              onClick={() => {
                loadProcessStatus();
                loadDependencies(selectedHazard);
              }}
              className="btn-outline text-sm font-medium"
            >
              Refresh Status
            </button>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              DEPENDENCIES
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
              Cek Kesiapan Pipeline
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Verifikasi script dan file penting untuk hazard yang dipilih.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
              <p className="text-xs text-gray-500">Total</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {loadingDependencies ? "..." : dependencySummary.total}
              </p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 px-3 py-3">
              <p className="text-xs text-green-700">Ready</p>
              <p className="mt-1 text-sm font-semibold text-green-800">
                {loadingDependencies ? "..." : dependencySummary.ok}
              </p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3">
              <p className="text-xs text-red-700">Missing</p>
              <p className="mt-1 text-sm font-semibold text-red-800">
                {loadingDependencies ? "..." : dependencySummary.missing}
              </p>
            </div>
          </div>

          {loadingDependencies ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
              Memuat dependency...
            </div>
          ) : dependencies.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
              Tidak ada dependency yang ditampilkan.
            </div>
          ) : (
            <div className="space-y-3">
              {dependencies.map((item, index) => (
                <div
                  key={`${item.path}-${index}`}
                  className={
                    item.exists
                      ? "rounded-2xl border border-green-200 bg-green-50 px-4 py-3"
                      : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      <p className="mt-1 break-all text-xs text-gray-600">{item.path}</p>
                    </div>
                    <span
                      className={
                        item.exists
                          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                          : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                      }
                    >
                      {item.exists ? "Ready" : "Missing"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
            PROCESS LOGS
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
            Log Eksekusi Pipeline
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Detail stdout dan stderr dari setiap script yang dijalankan.
          </p>
        </div>

        {loadingStatus ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
            Memuat logs...
          </div>
        ) : !status?.logs?.length ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
            Belum ada log proses.
          </div>
        ) : (
          <div className="space-y-4">
            {status.logs
              .slice()
              .reverse()
              .map((log, reversedIndex) => {
                const realIndex = status.logs.length - 1 - reversedIndex;
                const expanded = expandedLogIndex === realIndex;

                return (
                  <div
                    key={`${log.script}-${log.timestamp}-${realIndex}`}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="break-all text-sm font-semibold text-gray-900">
                          {log.script}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {formatDateTime(log.timestamp)}
                          </span>
                          <span
                            className={
                              log.returncode === 0
                                ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                            }
                          >
                            returncode: {log.returncode}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedLogIndex((prev) =>
                            prev === realIndex ? null : realIndex
                          )
                        }
                        className="btn-outline text-sm font-medium"
                      >
                        {expanded ? "Tutup Log" : "Lihat Log"}
                      </button>
                    </div>

                    {expanded ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500">
                            STDOUT
                          </p>
                          <pre className="max-h-80 overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-xs leading-6 text-gray-800">
                            {log.stdout?.trim() || "(stdout kosong)"}
                          </pre>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500">
                            STDERR
                          </p>
                          <pre className="max-h-80 overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-xs leading-6 text-gray-800">
                            {log.stderr?.trim() || "(stderr kosong)"}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
            UPDATED OUTPUTS
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
            Output Terbaru dari Pipeline
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            File output yang baru diperbarui setelah proses pipeline selesai.
          </p>
        </div>

        {loadingStatus ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
            Memuat output terbaru...
          </div>
        ) : !status?.updated_outputs?.length ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
            Belum ada output baru yang terdeteksi.
          </div>
        ) : (
          <div className="space-y-3">
            {status.updated_outputs.map((item) => (
              <div
                key={`${item.filename}-${item.modified_at}`}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="break-all text-base font-semibold text-gray-900">
                      {item.filename}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {formatBytes(item.size_bytes)}
                      </span>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {formatDateTime(item.modified_at)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownload(item.filename)}
                    className="btn-outline text-sm font-medium"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}