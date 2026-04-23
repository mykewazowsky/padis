"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";

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

type UploadFormState = {
  data_type: string;
  scenario: string;
  climate_type: string;
  notes: string;
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

const TAB_OPTIONS: { key: DataTabKey; label: string; desc: string }[] = [
  {
    key: "raw",
    label: "Raw Data",
    desc: "Kelola data mentah yang menjadi input utama sistem.",
  },
  {
    key: "processed",
    label: "Processed Data",
    desc: "Lihat data hasil proses awal yang dipakai di tahap berikutnya.",
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

function getStatusBadgeClass(status: DatasetStatus) {
  if (status === "active") {
    return "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700";
  }
  if (status === "ready") {
    return "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
  }
  if (status === "partial") {
    return "rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700";
  }
  if (status === "invalid") {
    return "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
  }
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

function getSetActiveKey(item: DatasetItem): string | null {
  if (item.id === "raw-admin-boundary") return "admin_boundary";
  if (item.id === "raw-sawah") return "sawah_layer";
  if (item.id === "raw-total-prod") return "total_prod_csv";
  return null;
}

export default function AdminDataPage() {
  const [activeTab, setActiveTab] = useState<DataTabKey>("raw");
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");

  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const [workingId, setWorkingId] = useState<string | null>(null);

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

  const [uploadForm, setUploadForm] = useState<UploadFormState>({
    data_type: "unknown",
    scenario: "",
    climate_type: "",
    notes: "",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchRegistry = useCallback(async () => {
    try {
      setLoadingData(true);
      setDataError("");

      const token = getToken();
      const res = await fetch(buildApiUrl("/api/admin/data"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat data.");
      }

      setRegistryData(json);
    } catch (err: any) {
      console.error("Fetch registry error:", err);
      setDataError(err.message || "Gagal memuat data.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const datasetsForTab = useMemo(() => {
    let source: DatasetItem[] = [];

    if (activeTab === "raw") source = registryData.raw;
    if (activeTab === "processed") source = registryData.processed;

    const keyword = search.trim().toLowerCase();

    return source.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.filename.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(keyword));

      const matchesActive = !showOnlyActive || item.active;

      return matchesSearch && matchesActive;
    });
  }, [activeTab, registryData, search, showOnlyActive]);

  const summary = useMemo(() => {
    return {
      rawCount: registryData.summary.raw_count,
      processedCount: registryData.summary.processed_count,
      activeCount: registryData.summary.active_count,
      latest: registryData.summary.latest_update,
    };
  }, [registryData]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedFile) {
      setUploadError("Pilih file terlebih dahulu.");
      return;
    }

    try {
      setUploading(true);
      setUploadError("");
      setUploadMessage("");

      const token = getToken();
      const formData = new FormData();
      formData.append("data_type", uploadForm.data_type);
      formData.append("scenario", uploadForm.scenario);
      formData.append("climate_type", uploadForm.climate_type);
      formData.append("notes", uploadForm.notes);
      formData.append("replace_existing", "true");
      formData.append("file", selectedFile);

      const res = await fetch(buildApiUrl("/api/admin/upload-data"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal upload data.");
      }

      setUploadMessage(
        `Upload berhasil: ${json.saved_filename || selectedFile.name} (${json.data_type || "unknown"})`
      );

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setUploadForm({
        data_type: "unknown",
        scenario: "",
        climate_type: "",
        notes: "",
      });

      await fetchRegistry();
    } catch (err: any) {
      console.error("Upload data error:", err);
      setUploadError(err.message || "Gagal upload data.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePreview(item: DatasetItem) {
    try {
      setPreviewLoading(true);
      setPreviewError("");
      setPreviewData(null);
      setPreviewTitle(item.name);
      setPreviewOpen(true);

      const token = getToken();
      const folder = mapFolderToApiFolder(item.folder);
      const res = await fetch(
        buildApiUrl(
          `/api/admin/data/preview?filename=${encodeURIComponent(
            item.filename
          )}&folder=${encodeURIComponent(folder)}`
        ),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat preview.");
      }

      setPreviewData(json);
    } catch (err: any) {
      console.error("Preview error:", err);
      setPreviewError(err.message || "Gagal memuat preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDelete(item: DatasetItem) {
    const confirmed = window.confirm(`Hapus file ${item.filename}?`);
    if (!confirmed) return;

    try {
      setWorkingId(item.id);
      setDataError("");

      const token = getToken();
      const res = await fetch(buildApiUrl("/api/admin/data/delete"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: item.filename,
          folder: mapFolderToApiFolder(item.folder),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal menghapus file.");
      }

      await fetchRegistry();
    } catch (err: any) {
      console.error("Delete error:", err);
      setDataError(err.message || "Gagal menghapus file.");
    } finally {
      setWorkingId(null);
    }
  }

  async function handleSetActive(item: DatasetItem) {
    const datasetKey = getSetActiveKey(item);
    if (!datasetKey) {
      setDataError("Set Active belum didukung untuk dataset ini.");
      return;
    }

    try {
      setWorkingId(item.id);
      setDataError("");

      const token = getToken();
      const res = await fetch(buildApiUrl("/api/admin/data/set-active"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataset_key: datasetKey,
          filename: item.filename,
          folder: "raw",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal mengubah active source.");
      }

      await fetchRegistry();
    } catch (err: any) {
      console.error("Set active error:", err);
      setDataError(err.message || "Gagal mengubah active source.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
        <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
          DATA MANAGEMENT
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Kelola Data Sistem
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 md:text-base">
          Lihat, upload, ganti, dan atur data yang digunakan dalam sistem.
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
          <p className="mt-2 text-sm text-gray-600">
            Data mentah yang menjadi sumber utama sistem.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Processed Data</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {summary.processedCount}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Data hasil proses awal yang dipakai di tahap berikutnya.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Active Sources</p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-primary)]">
            {summary.activeCount}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Data yang saat ini dipakai sebagai sumber aktif.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Last Update</p>
          <p className="mt-2 text-base font-semibold text-gray-900">
            {formatDateTime(summary.latest)}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Waktu pembaruan data terakhir.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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
                const canSetActive = item.group === "raw" && !!getSetActiveKey(item);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {item.name}
                        </p>

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

                        <p className="mt-3 text-sm text-gray-600">
                          {item.description}
                        </p>
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
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {item.folder}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Last Updated</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {formatDateTime(item.lastUpdated)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Size / Info</p>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {item.sizeLabel}
                          </p>
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

                            <button
                              type="button"
                              className="btn-outline text-sm font-medium"
                              disabled
                              title="Validasi belum diaktifkan"
                            >
                              Validate
                            </button>

                            {canSetActive ? (
                              <button
                                type="button"
                                onClick={() => handleSetActive(item)}
                                disabled={workingId === item.id}
                                className="btn-outline text-sm font-medium disabled:opacity-60"
                              >
                                {workingId === item.id ? "Menyimpan..." : "Set Active"}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={workingId === item.id}
                              className="rounded-2xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {workingId === item.id ? "Menghapus..." : "Delete"}
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

        <div className="space-y-6">
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
                UPLOAD DATA
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                Upload / Replace Data
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Gunakan form ini untuk mengunggah data baru atau mengganti data yang sudah ada.
              </p>
            </div>

            {uploadError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {uploadError}
              </div>
            ) : null}

            {uploadMessage ? (
              <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {uploadMessage}
              </div>
            ) : null}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">
                  Data Type
                </label>
                <select
                  value={uploadForm.data_type}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      data_type: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)]"
                >
                  <option value="unknown">Pilih jenis data</option>
                  <option value="admin_boundary">Admin Boundary</option>
                  <option value="sawah_layer">Sawah Layer</option>
                  <option value="total_prod_csv">Total Produksi CSV</option>
                  <option value="flood_raster">Flood Raster</option>
                  <option value="drought_raster">Drought Raster</option>
                  <option value="processed_vector">Processed Vector</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">
                    Scenario
                  </label>
                  <select
                    value={uploadForm.scenario}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        scenario: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)]"
                  >
                    <option value="">Optional</option>
                    <option value="rp25">RP25</option>
                    <option value="rp50">RP50</option>
                    <option value="rp100">RP100</option>
                    <option value="rp250">RP250</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">
                    Climate Type
                  </label>
                  <select
                    value={uploadForm.climate_type}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        climate_type: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)]"
                  >
                    <option value="">Optional</option>
                    <option value="nonclimate">Non-climate</option>
                    <option value="climate">Climate</option>
                    <option value="gpm">GPM</option>
                    <option value="mme">MME</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">
                  Notes
                </label>
                <textarea
                  value={uploadForm.notes}
                  onChange={(e) =>
                    setUploadForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Catatan sumber data, versi, atau perubahan data..."
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">
                  File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                  className="block w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
                />
                {selectedFile ? (
                  <p className="mt-2 text-xs text-gray-500">
                    Selected:{" "}
                    <span className="font-semibold text-gray-700">
                      {selectedFile.name}
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">
                    Belum ada file dipilih.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Upload Data"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadForm({
                      data_type: "unknown",
                      scenario: "",
                      climate_type: "",
                      notes: "",
                    });
                    setSelectedFile(null);
                    setUploadError("");
                    setUploadMessage("");
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="btn-outline text-sm font-medium"
                >
                  Reset Form
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
                PANDUAN
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                Panduan Singkat
              </h2>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="font-semibold text-gray-900">Raw Data</p>
                <p className="mt-1">
                  Gunakan tab ini untuk memastikan semua data utama tersedia sebelum proses dijalankan.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="font-semibold text-gray-900">Processed Data</p>
                <p className="mt-1">
                  Tab ini menampilkan data hasil proses awal yang digunakan di tahap berikutnya.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="font-semibold text-gray-900">Set Active</p>
                <p className="mt-1">
                  Gunakan tombol Set Active untuk memilih data utama yang dipakai sistem.
                </p>
              </div>
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
                <h3 className="mt-1 text-xl font-bold text-gray-900">
                  {previewTitle}
                </h3>
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