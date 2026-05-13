"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../../../../lib/fetcher-auth";
import { getErrorMessage, getResponseError } from "../../../../lib/error";
import {
  CheckCircle2,
  XCircle,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

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
  registry: unknown[];
};

type CheckItem = { label: string; exists: boolean };
type CheckGroup = { label: string; folder: string; checks: CheckItem[]; ok: boolean };
type CheckResult = { all_ok: boolean; groups: CheckGroup[] };

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
    body: "Raster hazard harus diawali flood_ atau drought_ diikuti kode periode ulang (r25, r50, r100, r250) atau projection (rc25, rc50, rc100, rc250).",
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

export default function AdminDataPage() {
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

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
      if (!res.ok) throw new Error(getResponseError(json, "Gagal memuat data."));
      setRegistryData(json);
    } catch (err: unknown) {
      setDataError(getErrorMessage(err, "Gagal memuat data."));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const summary = useMemo(() => ({
    rawCount: registryData.summary.raw_count,
    processedCount: registryData.summary.processed_count,
    activeCount: registryData.summary.active_count,
    latest: registryData.summary.latest_update,
  }), [registryData]);

  async function handleCheck() {
    try {
      setChecking(true);
      setCheckError("");
      setCheckResult(null);
      const res = await fetchWithAuth("/api/admin/data/readiness");
      const json = await res.json();
      if (!res.ok) throw new Error(getResponseError(json, "Gagal memeriksa kesiapan data."));
      setCheckResult(json);
    } catch (err: unknown) {
      setCheckError(getErrorMessage(err, "Gagal memeriksa kesiapan data."));
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
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {loadingData ? "—" : summary.rawCount}
          </p>
          <p className="mt-2 text-sm text-gray-600">Data mentah yang menjadi sumber utama sistem.</p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Processed Data</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {loadingData ? "—" : summary.processedCount}
          </p>
          <p className="mt-2 text-sm text-gray-600">Data hasil proses awal yang dipakai di tahap berikutnya.</p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Active Sources</p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-primary)]">
            {loadingData ? "—" : summary.activeCount}
          </p>
          <p className="mt-2 text-sm text-gray-600">Data yang saat ini dipakai sebagai sumber aktif.</p>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Last Update</p>
          <p className="mt-2 text-base font-semibold text-gray-900">
            {loadingData ? "—" : formatDateTime(summary.latest)}
          </p>
          <p className="mt-2 text-sm text-gray-600">Waktu pembaruan data terakhir.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Folder Structure */}
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
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
        </div>

        {/* Cek Kesiapan Data */}
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
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
        </div>
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
    </main>
  );
}
