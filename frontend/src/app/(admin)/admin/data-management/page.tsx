"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../../../../lib/fetcher-auth";
import {
  CheckCircle2,
  XCircle,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type DataTabKey = "raw" | "processed";
type DatasetStatus = "active" | "ready" | "missing" | "invalid" | "partial";
type DatasetGroup = "raw" | "processed" | "registry";
type DatasetType = "vector" | "raster" | "table" | "bundle";

type DatasetItem = {
  id: string;
  name: string;
  group: DatasetGroup;
  type: DatasetType;
  category: string;
  folder: string;
  filename: string;
  status: DatasetStatus;
  active?: boolean;
  lastUpdated?: string | null;
  sizeLabel: string;
  description: string;
  tags?: string[];
  files?: string[];
  path?: string | null;
  exists?: boolean;
  size_bytes?: number;
};

type DataSummary = {
  raw_count: number;
  processed_count: number;
  registry_count: number;
  active_count: number;
  latest_update?: string | null;
};

type DataRegistryResponse = {
  summary: DataSummary;
  raw: DatasetItem[];
  processed: DatasetItem[];
  registry: DatasetItem[];
};

type PreviewResponse =
  | {
      type: "csv";
      filename: string;
      folder: string;
      columns: string[];
      rows: Record<string, string>[];
      row_count_preview: number;
    }
  | {
      type: "geojson";
      filename: string;
      folder: string;
      feature_count: number;
      property_keys: string[];
      sample_properties: Record<string, unknown>;
    }
  | {
      type: "raster";
      filename: string;
      folder: string;
      crs?: string | null;
      width?: number;
      height?: number;
      count?: number;
      dtype?: string | null;
      nodata?: number | null;
      bounds?: number[];
      message?: string;
    }
  | {
      type: "gpkg";
      filename: string;
      folder: string;
      layers?: string[];
      layer_count?: number;
      message?: string;
    }
  | {
      type: "unsupported";
      filename: string;
      folder: string;
      message: string;
    };

type CheckItem = { label: string; exists: boolean };
type CheckGroup = { label: string; folder: string; checks: CheckItem[]; ok: boolean };
type CheckResult = { all_ok: boolean; groups: CheckGroup[] };

const TAB_OPTIONS: { key: DataTabKey; label: string; desc: string }[] = [
  {
    key: "raw",
    label: "Raw Data",
    desc: "Data mentah yang menjadi input utama sistem.",
  },
  {
    key: "processed",
    label: "Processed Data",
    desc: "Data hasil proses awal yang dipakai di tahap berikutnya.",
  },
];

const FOLDER_TREE = [
  {
    folder: "raw/hazard/",
    files: [
      "flood_r25.tif",
      "flood_r50.tif",
      "flood_r100.tif",
      "flood_r250.tif",
      "flood_rc25.tif",
      "flood_rc50.tif",
      "flood_rc100.tif",
      "flood_rc250.tif",
      "drought_r25.tif",
      "drought_r50.tif",
      "drought_r100.tif",
      "drought_r250.tif",
      "drought_rc25.tif",
      "drought_rc50.tif",
      "drought_rc100.tif",
      "drought_rc250.tif",
    ],
  },
  {
    folder: "raw/administrasi/",
    files: ["regions.gpkg"],
  },
  {
    folder: "raw/exposure/",
    files: ["sawah_selected.gpkg", "totalproduksipadi.csv"],
  },
];

const TIPS = [
  {
    title: "Nama file harus tepat",
    body: "Pipeline membaca file berdasarkan nama yang sudah ditentukan. Jangan ubah nama file setelah diletakkan ke folder.",
  },
  {
    title: "Prefix flood_ dan drought_ wajib",
    body: "Raster hazard harus diawali flood_ atau drought_ diikuti kode return period (r25, r50, r100, r250) atau climate (rc25, rc50, rc100, rc250).",
  },
  {
    title: "Proyeksi EPSG:4326",
    body: "Pastikan semua file vektor dan raster sudah dalam sistem koordinat EPSG:4326 sebelum dimasukkan ke folder raw.",
  },
  {
    title: "Jalankan Cek Kesiapan sebelum pipeline",
    body: "Gunakan tombol Cek Kesiapan Data untuk memastikan semua file tersedia sebelum menjalankan pipeline. Pipeline akan gagal jika ada file yang kurang.",
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function getStatusBadgeClass(status: DatasetStatus) {
  if (status === "active")
    return "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700";
  if (status === "ready")
    return "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
  if (status === "partial")
    return "rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700";
  if (status === "invalid")
    return "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
  return "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";
}

function getStatusText(status: DatasetStatus) {
  if (status === "active") return "ACTIVE";
  if (status === "ready") return "READY";
  if (status === "partial") return "PARTIAL";
  if (status === "invalid") return "INVALID";
  return "MISSING";
}

function mapFolderToApiFolder(folder: string): "raw" | "processed" | "output" {
  if (folder === "raw") return "raw";
  if (folder === "processed") return "processed";
  return "output";
}

export default function AdminDataPage() {
  const [activeTab, setActiveTab] = useState<DataTabKey>("raw");
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const [registryData, setRegistryData] = useState<DataRegistryResponse>({
    summary: {
      raw_count: 0,
      processed_count: 0,
      registry_count: 0,
      active_count: 0,
      latest_update: null,
    },
    raw: [],
    processed: [],
    registry: [],
  });

  const fetchRegistry = useCallback(async () => {
    try {
      setLoadingData(true);
      setDataError("");
      const res = await fetchWithAuth("/api/admin/data");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data.");
      setRegistryData(json);
    } catch (err: any) {
      setDataError(err.message || "Gagal memuat data.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const datasetsForTab = useMemo(() => {
    const source = activeTab === "raw" ? registryData.raw : registryData.processed;
    const keyword = search.trim().toLowerCase();
    return source.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.filename.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(keyword));
      return matchesSearch && (!showOnlyActive || item.active);
    });
  }, [activeTab, registryData, search, showOnlyActive]);

  const summary = useMemo(() => ({
    rawCount: registryData.summary.raw_count,
    processedCount: registryData.summary.processed_count,
    activeCount: registryData.summary.active_count,
    latest: registryData.summary.latest_update,
  }), [registryData]);

  async function handlePreview(item: DatasetItem) {
    try {
      setPreviewLoading(true);
      setPreviewError("");
      setPreviewData(null);
      setPreviewTitle(item.name);
      setPreviewOpen(true);

      const folder = mapFolderToApiFolder(item.folder);
      const res = await fetchWithAuth(
        `/api/admin/data/preview?filename=${encodeURIComponent(item.filename)}&folder=${encodeURIComponent(folder)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat preview.");
      setPreviewData(json);
    } catch (err: any) {
      setPreviewError(err.message || "Gagal memuat preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCheck() {
    try {
      setChecking(true);
      setCheckError("");
      setCheckResult(null);
      const res = await fetchWithAuth("/api/admin/data/readiness");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memeriksa kesiapan data.");
      setCheckResult(json);
    } catch (err: any) {
      setCheckError(err.message || "Gagal memeriksa kesiapan data.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
        <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
          DATA MANAGEMENT
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Persiapan Data Pipeline
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 md:text-base">
          Pastikan semua data input tersedia di folder yang benar sebelum menjalankan pipeline.
        </p>
      </section>

      {dataError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dataError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Raw Data</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{summary.rawCount}</p>
          <p className="mt-2 text-sm text-gray-600">Data mentah yang menjadi sumber utama sistem.</p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Processed Data</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{summary.processedCount}</p>
          <p className="mt-2 text-sm text-gray-600">Data hasil proses awal yang dipakai di tahap berikutnya.</p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Active Sources</p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-primary)]">{summary.activeCount}</p>
          <p className="mt-2 text-sm text-gray-600">Data yang saat ini dipakai sebagai sumber aktif.</p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Last Update</p>
          <p className="mt-2 text-base font-semibold text-gray-900">{formatDateTime(summary.latest)}</p>
          <p className="mt-2 text-sm text-gray-600">Waktu pembaruan data terakhir.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* ── LEFT: Data List ── */}
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              DATA LIST
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
              Raw Data dan Processed Data
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Pilih tab untuk melihat data berdasarkan tahapannya.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {TAB_OPTIONS.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={
                    active
                      ? "rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama data, file, kategori, atau tag..."
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)]"
            />

            <button
              type="button"
              onClick={() => setShowOnlyActive((prev) => !prev)}
              className={
                showOnlyActive
                  ? "rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
                  : "rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700"
              }
            >
              {showOnlyActive ? "Active Only: ON" : "Active Only: OFF"}
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-500">
            {TAB_OPTIONS.find((item) => item.key === activeTab)?.desc}
          </p>

          <div className="mt-6 space-y-4">
            {loadingData ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Memuat data...
              </div>
            ) : datasetsForTab.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Tidak ada data yang cocok dengan filter saat ini.
              </div>
            ) : (
              datasetsForTab.map((item) => {
                const expanded = expandedId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{item.name}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={getStatusBadgeClass(item.status)}>
                            {getStatusText(item.status)}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {item.type.toUpperCase()}
                          </span>

                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            {item.category.toUpperCase()}
                          </span>

                          {item.active ? (
                            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                              ACTIVE SOURCE
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 text-sm text-gray-600">{item.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((prev) => (prev === item.id ? null : item.id))
                        }
                        className="btn-outline text-sm font-medium"
                      >
                        {expanded ? "Tutup Detail" : "Lihat Detail"}
                      </button>
                    </div>

                    {expanded ? (
                      <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs text-gray-500">Filename</p>
                          <p className="mt-1 break-all text-sm font-semibold text-gray-900">
                            {item.filename}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Folder</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{item.folder}</p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Last Updated</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {formatDateTime(item.lastUpdated)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Size / Info</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">{item.sizeLabel}</p>
                        </div>

                        {item.tags?.length ? (
                          <div className="md:col-span-2 xl:col-span-4">
                            <p className="text-xs text-gray-500">Tags</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {item.files?.length ? (
                          <div className="md:col-span-2 xl:col-span-4">
                            <p className="text-xs text-gray-500">Isi File / Anggota</p>
                            <div className="mt-2 space-y-1">
                              {item.files.map((file) => (
                                <p
                                  key={file}
                                  className="break-all rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700"
                                >
                                  {file}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="md:col-span-2 xl:col-span-4">
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handlePreview(item)}
                              className="btn-outline text-sm font-medium"
                            >
                              Preview Metadata
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: Folder Structure + Readiness + Tips ── */}
        <div className="space-y-6">
          {/* Folder Structure */}
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
                STRUKTUR FOLDER
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                Input Pipeline
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Letakkan file input di folder yang sesuai sebelum pipeline dijalankan.
              </p>
            </div>

            <div className="space-y-4">
              {FOLDER_TREE.map((group) => (
                <div key={group.folder} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-[var(--color-primary)]" />
                    <p className="text-sm font-semibold text-gray-900">{group.folder}</p>
                  </div>
                  <div className="mt-3 space-y-1">
                    {group.files.map((file) => (
                      <p
                        key={file}
                        className="ml-6 rounded-lg bg-white px-3 py-1.5 text-xs text-gray-700"
                      >
                        {file}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cek Kesiapan Data */}
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
                VALIDASI DATA
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                Cek Kesiapan Data
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Verifikasi keberadaan semua file input yang dibutuhkan pipeline.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {checking ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {checking ? "Memeriksa..." : "Cek Kesiapan Data"}
            </button>

            {checkError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {checkError}
              </div>
            ) : null}

            {checkResult ? (
              <div className="mt-4 space-y-4">
                <div
                  className={
                    checkResult.all_ok
                      ? "flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3"
                      : "flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
                  }
                >
                  {checkResult.all_ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <div className="flex-1">
                    <p
                      className={
                        checkResult.all_ok
                          ? "text-sm font-semibold text-green-700"
                          : "text-sm font-semibold text-red-700"
                      }
                    >
                      {checkResult.all_ok
                        ? "Semua file tersedia. Pipeline siap dijalankan."
                        : "Beberapa file belum tersedia. Periksa daftar di bawah."}
                    </p>
                    {checkResult.all_ok && (
                      <Link
                        href="/admin/process-control"
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-green-700 underline hover:text-green-900"
                      >
                        Buka Process Control →
                      </Link>
                    )}
                  </div>
                </div>

                {checkResult.groups.map((group) => (
                  <div
                    key={group.label}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{group.label}</p>
                      <span className="text-xs text-gray-500">{group.folder}</span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {group.checks.map((check) => (
                        <div key={check.label} className="flex items-center gap-2">
                          {check.exists ? (
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                          )}
                          <p
                            className={
                              check.exists
                                ? "text-xs text-gray-700"
                                : "text-xs font-medium text-red-600"
                            }
                          >
                            {check.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {/* Tips */}
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
                PANDUAN
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                Tips Persiapan Data
              </h2>
            </div>

            <div className="space-y-3">
              {TIPS.map((tip) => (
                <div
                  key={tip.title}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-gray-900">{tip.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{tip.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
                  PREVIEW METADATA
                </p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">{previewTitle}</h3>
              </div>

              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="btn-outline text-sm font-medium"
              >
                Tutup
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-6">
              {previewLoading ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                  Memuat preview...
                </div>
              ) : previewError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
                  {previewError}
                </div>
              ) : !previewData ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                  Tidak ada preview.
                </div>
              ) : previewData.type === "csv" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-900">Columns</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {previewData.columns.map((col) => (
                        <span
                          key={col}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {previewData.columns.map((col) => (
                            <th
                              key={col}
                              className="border-b px-4 py-3 text-left font-semibold text-gray-800"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            {previewData.columns.map((col) => (
                              <td key={col} className="px-4 py-3 text-gray-700">
                                {row[col] ?? "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <pre className="overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-6 text-gray-800">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
