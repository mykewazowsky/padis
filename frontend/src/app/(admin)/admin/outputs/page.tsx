"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Download,
  Eye,
  Map,
  RefreshCw,
  Star,
} from "lucide-react";
import { buildApiUrl } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";
import { fetchWithAuth } from "../../../../lib/fetcher-auth";

const GeoJsonMiniMap = dynamic(
  () => import("../../../../components/map/GeoJsonMiniMap"),
  { ssr: false }
);

type OutputFile = {
  filename: string;
  extension: string;
  size_bytes: number;
  modified_at: string;
};

type OutputGroup = {
  key: string;
  title: string;
  files: OutputFile[];
};

type FilterKey =
  | "all"
  | "flood"
  | "drought"
  | "multi"
  | "aal"
  | "report"
  | "other";

type PreviewData =
  | {
      type: "geojson";
      filename: string;
      feature_count: number;
      sample_properties: Record<string, any>;
    }
  | {
      type: "csv";
      filename: string;
      columns: string[];
      rows: Record<string, string>[];
      row_count_preview: number;
    }
  | {
      type: "unsupported";
      filename: string;
      message: string;
    };

type ActiveRun = {
  id: number;
  run_name: string;
  created_at: string | null;
  finished_at: string | null;
  status: string;
  operator_name: string | null;
};

const GEOJSON_PREVIEW_LIMIT = 10 * 1024 * 1024; // 10 MB — skip preview fetch above this size

const FILTER_OPTIONS: { key: FilterKey; label: string; desc: string }[] = [
  { key: "all", label: "Semua", desc: "Tampilkan semua hasil." },
  { key: "flood", label: "Banjir", desc: "Hasil untuk analisis banjir." },
  { key: "drought", label: "Kekeringan", desc: "Hasil untuk analisis kekeringan." },
  { key: "multi", label: "Multi-hazard", desc: "Hasil untuk analisis multi-hazard." },
  { key: "aal", label: "AAL", desc: "Ringkasan nilai AAL." },
  { key: "report", label: "Report", desc: "Dokumen dan aset laporan." },
  { key: "other", label: "Other", desc: "File lain di luar kategori utama." },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function categorizeOutput(filename: string): FilterKey {
  const name = filename.toLowerCase();

  if (name.includes("aal")) return "aal";

  if (name.startsWith("web_flood") || name.includes("kabkota_flood")) {
    return "flood";
  }

  if (name.startsWith("web_drought") || name.includes("kabkota_drought")) {
    return "drought";
  }

  if (
    name.startsWith("web_multi") ||
    name.startsWith("web_multihazard") ||
    name.includes("kabkota_multihazard")
  ) {
    return "multi";
  }

  if (
    name.startsWith("_report") ||
    name.startsWith("_temp_report") ||
    name.endsWith(".pdf") ||
    name.endsWith(".png")
  ) {
    return "report";
  }

  return "other";
}


export default function AdminOutputPage() {
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [downloadingFile, setDownloadingFile] = useState("");
  const [previewingFile, setPreviewingFile] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const [previewMap, setPreviewMap] = useState<Record<string, PreviewData>>({});
  const [geoJsonMap, setGeoJsonMap] = useState<Record<string, any>>({});

  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);

  const loadOutputs = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      setLoading(true);
      setError("");

      const res = await fetchWithAuth("/api/admin/outputs");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat hasil.");
      }

      const sorted = [...json].sort(
        (a: OutputFile, b: OutputFile) =>
          new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
      );

      setOutputs(sorted);
    } catch (err: any) {
      console.error("Load outputs error:", err);
      setError(err.message || "Gagal memuat hasil.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOutputs();
  }, [loadOutputs]);

  useEffect(() => {
    fetchWithAuth("/api/admin/runs/active")
      .then((r) => r.json())
      .then((json) => { if (json?.run) setActiveRun(json.run); })
      .catch(() => {});
  }, []);

  const countsByCategory = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      all: outputs.length,
      flood: 0,
      drought: 0,
      multi: 0,
      aal: 0,
      report: 0,
      other: 0,
    };

    for (const file of outputs) {
      const category = categorizeOutput(file.filename);
      counts[category] += 1;
    }

    return counts;
  }, [outputs]);

  const groupedOutputs = useMemo<OutputGroup[]>(() => {
    const groups: Record<Exclude<FilterKey, "all">, OutputGroup> = {
      flood: { key: "flood", title: "Hasil Banjir", files: [] },
      drought: { key: "drought", title: "Hasil Kekeringan", files: [] },
      multi: { key: "multi", title: "Hasil Multi-hazard", files: [] },
      aal: { key: "aal", title: "Hasil AAL", files: [] },
      report: { key: "report", title: "Laporan", files: [] },
      other: { key: "other", title: "File Lainnya", files: [] },
    };

    for (const file of outputs) {
      const category = categorizeOutput(file.filename);
      if (category !== "all") {
        groups[category].files.push(file);
      }
    }

    let result = Object.values(groups)
      .map((group) => ({
        ...group,
        files: [...group.files].sort(
          (a, b) =>
            new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
        ),
      }))
      .filter((group) => group.files.length > 0);

    if (activeFilter !== "all") {
      result = result.filter((group) => group.key === activeFilter);
    }

    return result;
  }, [outputs, activeFilter]);

  async function handleDownload(filename: string) {
    if (downloadingFile) return;

    try {
      setDownloadingFile(filename);
      setError("");

      const token = getToken();

      const res = await fetch(
        buildApiUrl(
          `/api/admin/outputs/download?filename=${encodeURIComponent(filename)}`
        ),
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
        } catch {}
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
      console.error("Download error:", err);
      setError(err.message || "Gagal mengunduh file.");
    } finally {
      setDownloadingFile("");
    }
  }

  function setTooBigPreview(filename: string, sizeBytes: number) {
    setPreviewMap((prev) => ({
      ...prev,
      [filename]: {
        type: "unsupported" as const,
        filename,
        message: `File terlalu besar untuk preview (${formatBytes(sizeBytes)}). Gunakan tombol Download untuk mengunduh file.`,
      },
    }));
    setExpandedFile(filename);
  }

  async function handlePreview(filename: string, sizeBytes = 0) {
    if (expandedFile === filename) {
      setExpandedFile(null);
      return;
    }

    if (previewMap[filename]) {
      setExpandedFile(filename);
      return;
    }

    const isGeoJson = filename.toLowerCase().endsWith(".geojson");

    if (isGeoJson && sizeBytes > GEOJSON_PREVIEW_LIMIT) {
      setTooBigPreview(filename, sizeBytes);
      return;
    }

    try {
      setPreviewingFile(filename);
      setError("");

      const res = await fetchWithAuth(
        `/api/admin/outputs/preview?filename=${encodeURIComponent(filename)}`
      );

      if (res.status === 413) {
        setTooBigPreview(filename, sizeBytes);
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat preview.");
      }

      setPreviewMap((prev) => ({
        ...prev,
        [filename]: json,
      }));

      if (isGeoJson && json.type === "geojson" && sizeBytes <= GEOJSON_PREVIEW_LIMIT) {
        const token = getToken();

        const fileRes = await fetch(
          buildApiUrl(
            `/api/admin/outputs/download?filename=${encodeURIComponent(filename)}`
          ),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (fileRes.ok) {
          const geoJson = await fileRes.json();
          setGeoJsonMap((prev) => ({
            ...prev,
            [filename]: geoJson,
          }));
        }
      }

      setExpandedFile(filename);
    } catch (err: any) {
      console.error("Preview error:", err);
      setError(err.message || "Gagal memuat preview.");
    } finally {
      setPreviewingFile("");
    }
  }

  const totalOutputs = outputs.length;

  const summaryCards = [
    {
      title: "Total Hasil",
      value: loading ? "Loading..." : totalOutputs,
      desc: "Jumlah seluruh file hasil yang tersedia.",
      valueClass: "text-[var(--color-primary)]",
    },
    {
      title: "Output Banjir",
      value: loading ? "Loading..." : countsByCategory.flood,
      desc: "Jumlah hasil untuk analisis banjir.",
      valueClass: "text-blue-600",
    },
    {
      title: "Output Kekeringan",
      value: loading ? "Loading..." : countsByCategory.drought,
      desc: "Jumlah hasil untuk analisis kekeringan.",
      valueClass: "text-orange-600",
    },
    {
      title: "Multi-hazard Outputs",
      value: loading ? "Loading..." : countsByCategory.multi,
      desc: "Jumlah hasil untuk analisis multi-hazard.",
      valueClass: "text-red-600",
    },
  ];

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
        <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
          OUTPUTS
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Hasil Analisis
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 md:text-base">
          Lihat, preview, dan unduh hasil akhir dari proses yang sudah dijalankan.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-gray-500">{card.title}</p>
            <h2 className={`mt-2 text-2xl font-bold ${card.valueClass}`}>
              {card.value}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{card.desc}</p>
          </div>
        ))}
      </section>

      {activeRun && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-2.5">
                <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-amber-700">
                  RUN AKTIF
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  Run #{activeRun.id} —{" "}
                  <span className="font-mono text-xs font-semibold text-slate-700">
                    {activeRun.run_name}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Dashboard publik menggunakan run ini sebagai sumber data.
                  Pastikan file output di bawah sesuai dengan run tersebut.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-xs text-slate-500">Operator</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {activeRun.operator_name || "-"}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-xs text-slate-500">Mulai</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {formatDateTime(activeRun.created_at ?? "")}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                <p className="text-xs text-slate-500">Selesai</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {activeRun.finished_at ? formatDateTime(activeRun.finished_at) : "-"}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              FILTER
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
              Filter Hasil
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Pilih kategori hasil yang ingin ditampilkan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadOutputs(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Memuat..." : "Refresh"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.filter(
            (item) => item.key === "all" || countsByCategory[item.key] > 0
          ).map((item) => {
            const isActive = activeFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveFilter(item.key)}
                className={
                  isActive
                    ? "rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                }
                title={item.desc}
              >
                {item.label} ({countsByCategory[item.key]})
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
            HASIL
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
            Daftar Hasil per Kategori
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Hasil dikelompokkan agar lebih mudah dilihat, dipreview, dan diunduh.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
            Memuat daftar hasil...
          </div>
        ) : groupedOutputs.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
            {outputs.length === 0 ? (
              <span>
                Belum ada output. Jalankan pipeline terlebih dahulu.{" "}
                <Link
                  href="/admin/process-control"
                  className="font-medium text-gray-800 underline hover:text-gray-900"
                >
                  Buka Process Control →
                </Link>
              </span>
            ) : (
              "Tidak ada file hasil pada kategori ini."
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedOutputs.map((group) => (
              <section key={group.key} className="space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {group.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {group.files.length} file
                  </p>
                </div>

                <div className="space-y-3">
                  {group.files.map((item, index) => {
                    const isExpanded = expandedFile === item.filename;
                    const isNewest =
                      index === 0 && outputs[0]?.filename === item.filename;
                    const preview = previewMap[item.filename];

                    return (
                      <div
                        key={item.filename}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-all text-base font-semibold text-gray-900">
                                {item.filename}
                              </p>
                              {isNewest ? (
                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                  Latest
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {item.extension.toUpperCase()}
                              </span>
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {formatBytes(item.size_bytes)}
                              </span>
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                {formatDateTime(item.modified_at)}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handlePreview(item.filename, item.size_bytes)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye className="h-4 w-4" />
                              {previewingFile === item.filename
                                ? "Loading..."
                                : isExpanded
                                ? "Tutup"
                                : "Preview"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownload(item.filename)}
                              disabled={downloadingFile === item.filename}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                              <Download className="h-4 w-4" />
                              {downloadingFile === item.filename
                                ? "Downloading..."
                                : "Download"}
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="mt-4 space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
                            {preview ? (
                              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                {preview.type === "geojson" ? (
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-xs text-gray-500">
                                        Jumlah Feature
                                      </p>
                                      <p className="mt-1 text-sm font-semibold text-gray-900">
                                        {preview.feature_count}
                                      </p>
                                    </div>

                                    {geoJsonMap[item.filename] ? (
                                      <div>
                                        <div className="mb-2 flex items-center gap-2">
                                          <Map className="h-4 w-4 text-slate-500" />
                                          <p className="text-xs text-gray-500">
                                            Mini Map Preview
                                          </p>
                                        </div>
                                        <GeoJsonMiniMap data={geoJsonMap[item.filename]} />
                                      </div>
                                    ) : (
                                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                                        Peta mini belum tersedia.
                                      </div>
                                    )}

                                    <div>
                                      <p className="text-xs text-gray-500">
                                        Sample Properties
                                      </p>
                                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
{JSON.stringify(preview.sample_properties, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                ) : preview.type === "csv" ? (
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-xs text-gray-500">Kolom</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {preview.columns.map((col) => (
                                          <span
                                            key={col}
                                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                                          >
                                            {col}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    <div>
                                      <p className="text-xs text-gray-500">
                                        Sample Rows
                                      </p>
                                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
{JSON.stringify(preview.rows, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-sm text-gray-600">
                                      {preview.message}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                                Preview belum dimuat.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
