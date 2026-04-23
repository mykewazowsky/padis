"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../../../../lib/api";
import { getToken } from "../../../../lib/auth";

type DatasetStatus = "active" | "ready" | "missing" | "invalid" | "partial";
type DatasetType = "vector" | "raster" | "table" | "bundle";

type ArtifactItem = {
  id: string;
  name: string;
  group: "registry";
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
  raw: unknown[];
  processed: unknown[];
  registry: ArtifactItem[];
};

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

export default function AdminArtifactsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DatasetStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [data, setData] = useState<DataRegistryResponse>({
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

  const fetchArtifacts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();
      const res = await fetch(buildApiUrl("/api/admin/data"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat artifacts.");
      }

      setData(json);
    } catch (err: any) {
      console.error("Fetch artifacts error:", err);
      setError(err.message || "Gagal memuat artifacts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const artifacts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data.registry.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.filename.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(keyword));

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data.registry, search, statusFilter]);

  const summary = useMemo(() => {
    const total = data.registry.length;
    const ready = data.registry.filter((item) => item.status === "ready").length;
    const partial = data.registry.filter((item) => item.status === "partial").length;
    const missing = data.registry.filter((item) => item.status === "missing").length;
    const invalid = data.registry.filter((item) => item.status === "invalid").length;

    return { total, ready, partial, missing, invalid };
  }, [data.registry]);

  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-7">
        <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
          ARTIFACTS
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Pipeline Artifacts & Readiness
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 md:text-base">
          Halaman ini digunakan untuk memantau kesiapan dataset logis, dependency
          artifacts, dan status file antara yang dibutuhkan pipeline PADIS.
          Berbeda dari Data Management, fokus di sini adalah readiness dan
          keterhubungan antar hasil proses.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Total Artifacts</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
          <p className="mt-2 text-sm text-gray-600">
            Total logical dataset dan dependency artifacts yang terdaftar.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Ready</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{summary.ready}</p>
          <p className="mt-2 text-sm text-gray-600">
            Artifact siap dipakai pipeline atau tahapan berikutnya.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Partial</p>
          <p className="mt-2 text-2xl font-bold text-yellow-600">{summary.partial}</p>
          <p className="mt-2 text-sm text-gray-600">
            Artifact ada tetapi belum lengkap secara logika atau isi.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Missing</p>
          <p className="mt-2 text-2xl font-bold text-slate-700">{summary.missing}</p>
          <p className="mt-2 text-sm text-gray-600">
            Artifact belum ditemukan dan bisa menghambat pipeline.
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Invalid</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{summary.invalid}</p>
          <p className="mt-2 text-sm text-gray-600">
            Artifact terdeteksi tetapi tidak valid untuk digunakan.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
              ARTIFACT REGISTRY
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
              Kesiapan Dataset Logis
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Gunakan halaman ini untuk menilai apakah dependency pipeline sudah siap.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari artifact, kategori, filename, atau tag..."
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)]"
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as DatasetStatus | "all")
              }
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[var(--color-primary)]"
            >
              <option value="all">Semua Status</option>
              <option value="ready">Ready</option>
              <option value="partial">Partial</option>
              <option value="missing">Missing</option>
              <option value="invalid">Invalid</option>
              <option value="active">Active</option>
            </select>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Memuat artifacts...
              </div>
            ) : artifacts.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Tidak ada artifact yang cocok dengan filter saat ini.
              </div>
            ) : (
              artifacts.map((item) => {
                const expanded = expandedId === item.id;

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

                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                            {item.category.toUpperCase()}
                          </span>
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
                            <p className="text-xs text-gray-500">Contained Files / Members</p>
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
                READINESS GUIDE
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                Cara Membaca Status Artifacts
              </h2>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
                <p className="font-semibold text-gray-900">READY</p>
                <p className="mt-1">
                  Artifact tersedia dan siap digunakan oleh proses atau tahapan berikutnya.
                </p>
              </div>

              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4">
                <p className="font-semibold text-gray-900">PARTIAL</p>
                <p className="mt-1">
                  Sebagian komponen artifact sudah ada, tetapi belum lengkap secara logika.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-gray-900">MISSING</p>
                <p className="mt-1">
                  Artifact belum ditemukan dan kemungkinan besar akan menghambat pipeline.
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
                <p className="font-semibold text-gray-900">INVALID</p>
                <p className="mt-1">
                  Artifact ada, tetapi tidak lolos pemeriksaan atau tidak dapat dipakai.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold tracking-wide text-[var(--color-primary)]">
                QUICK NOTES
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">
                Catatan Operasional
              </h2>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                Cek halaman ini sebelum menjalankan pipeline bila ingin memastikan
                dependency antar hasil proses sudah siap.
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                Data Management dipakai untuk upload dan kelola file, sedangkan
                Artifacts dipakai untuk melihat kesiapan logis dataset.
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                Jika banyak artifact berstatus missing atau partial, sebaiknya
                periksa tahap preprocess, zonal, atau hasil proses sebelumnya.
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}