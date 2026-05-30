"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fetchJson } from "../../lib/fetcher";
import type { AalSummary } from "../../types/map";

// ── Types ────────────────────────────────────────────────────────────────────

type TopRegion = { name: string; loss: number };

type RegionRow = {
  id_kabkota?: string;
  kab_kota: string;
  prov: string;
  loss?: number | null;
  aal?: number | null;
  mean_value?: number | null;
  total_prod?: number | null;
};

type LossValuesResponse = {
  data?: RegionRow[];
};

export type ReportDocumentProps = {
  hazard: string;
  climate: string;
  scenario: string;
  runId: number;
  selectedRegion?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const NAVY = "#0d2137";
const GOLD = "#c9a227";
const BLUE = "#1e63b5";
const AMBER = "#d97706";

const BLUE_SHADES = [
  "#0d2137", "#1a3a5c", "#1e4f8a", "#1e63b5", "#2563eb",
  "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe",
];

// ── Formatters ────────────────────────────────────────────────────────────────

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function fmtFull(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "—";
  return IDR.format(Number(v));
}

function fmtCompact(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return "—";
  const n = Number(v);
  const a = Math.abs(n);
  if (a >= 1e12) return `Rp ${(n / 1e12).toFixed(2)} T`;
  if (a >= 1e9)  return `Rp ${(n / 1e9).toFixed(2)} M`;
  if (a >= 1e6)  return `Rp ${(n / 1e6).toFixed(1)} Jt`;
  if (a >= 1e3)  return `Rp ${(n / 1e3).toFixed(0)} Rb`;
  return IDR.format(n);
}

function fmtChartTick(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(0)} M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} Jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)} Rb`;
  return String(v);
}

// ── Label helpers ──────────────────────────────────────────────────────────────

function hazardLabel(h: string): string {
  if (h === "flood")   return "Banjir";
  if (h === "drought") return "Kekeringan";
  return "Multi-Hazard";
}

function climateLabel(c: string): string {
  return c === "climate" ? "Projection" : "Baseline";
}

function scenarioLabel(s: string): string {
  const m: Record<string, string> = {
    rp25:  "25 Tahun (RP25)",
    rp50:  "50 Tahun (RP50)",
    rp100: "100 Tahun (RP100)",
    rp250: "250 Tahun (RP250)",
  };
  return m[s] ?? s.toUpperCase();
}

function nowFormatted(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function runTag(runId: number): string {
  return `PADIS/RPT/${new Date().getFullYear()}/${String(runId).padStart(4, "0")}`;
}

// ── Small sub-components ──────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = GOLD }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded bg-white p-3 shadow-sm" style={{ borderTop: `3px solid ${accent}` }}>
      <p className="text-[8px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-[15px] font-bold leading-tight text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-[9px] text-gray-500">{sub}</p>}
    </div>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: NAVY }}
      >
        {num}
      </div>
      <div className="flex-1">
        <p className="text-[8px] font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
          Bagian {num}
        </p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-900 leading-tight">
          {title}
        </p>
      </div>
      <div className="flex-1 border-b border-gray-200" />
    </div>
  );
}

function PageFooter({ page, total, runId }: { page: number; total: number; runId: number }) {
  return (
    <div
      className="mx-10 mt-5 flex items-center justify-between border-t border-gray-200 pt-2"
    >
      <p className="text-[7px] text-gray-400">
        PADIS — Paddy Disaster Information System · Laporan Analisis Risiko Bencana Pertanian
      </p>
      <p className="text-[8px] font-bold" style={{ color: GOLD }}>
        Hal. {page} / {total}
      </p>
      <p className="text-[7px] text-gray-400">
        {runTag(runId)} · {nowFormatted()}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportDocument({
  hazard, climate, scenario, runId, selectedRegion,
}: ReportDocumentProps) {
  const [topRegions, setTopRegions] = useState<TopRegion[]>([]);
  const [allRegions, setAllRegions] = useState<RegionRow[]>([]);
  const [aalSummary, setAalSummary] = useState<AalSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const h = hazard.toLowerCase();
    const s = scenario.toLowerCase();
    const c = climate.toLowerCase();

    // Report preview mirrors the dashboard filter state but fetches only the
    // summary/value endpoints needed for the printable A4 document.
    Promise.all([
      fetchJson(
        `/api/top-regions?hazard=${h}&scenario=${s}&climate=${c}&run_id=${runId}`
      ),
      fetchJson<AalSummary>(
        `/api/aal-summary?hazard=${h}&run_id=${runId}`
      ),
      fetchJson<LossValuesResponse>(
        `/api/layers/values/loss?hazard=${h}&scenario=${s}&climate=${c}&run_id=${runId}`
      ),
    ])
      .then(([topJson, aalJson, lossJson]) => {
        setTopRegions(topJson as TopRegion[]);
        setAalSummary(aalJson);

        const rows = ((lossJson.data ?? []) as RegionRow[])
          .sort((a, b) => (b.loss ?? 0) - (a.loss ?? 0));

        setAllRegions(rows);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hazard, climate, scenario, runId]);

  if (loading) {
    return (
      <div className="flex h-80 w-[210mm] mx-auto items-center justify-center bg-white shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200" style={{ borderTopColor: BLUE }} />
          <p className="text-xs text-gray-500">Memuat data laporan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-80 w-[210mm] mx-auto items-center justify-center bg-white shadow-lg">
        <p className="text-sm text-red-600">Gagal memuat data: {error}</p>
      </div>
    );
  }

  // Derived values
  const top3         = topRegions.slice(0, 3);
  const top10Chart   = topRegions.slice(0, 10);
  const totalLoss    = allRegions.reduce((s, r) => s + (r.loss ?? 0), 0);
  const aalNc        = aalSummary?.total_aal_nonclimate ?? 0;
  const aalC         = aalSummary?.total_aal_climate    ?? 0;
  const aalDelta     = aalNc > 0 ? ((aalC - aalNc) / aalNc) * 100 : null;
  const aalDeltaLbl  = aalDelta != null ? `${aalDelta >= 0 ? "+" : ""}${aalDelta.toFixed(1)}%` : "N/A";
  const dataCount    = allRegions.length;
  const validCount   = allRegions.filter(r => (r.loss ?? 0) > 0).length;
  const top3Loss     = top3.reduce((s, r) => s + r.loss, 0);
  const top3Share    = totalLoss > 0 ? (top3Loss / totalLoss) * 100 : 0;
  const topLossShare = totalLoss > 0 && top3[0] ? (top3[0].loss / totalLoss) * 100 : 0;
  const regionDisplay = selectedRegion?.trim() || "Seluruh Indonesia";

  const aalCompareData = [
    { name: "Baseline",   value: aalNc },
    { name: "Projection", value: aalC  },
  ];

  const MEDAL_COLORS = ["#c9a227", "#9ca3af", "#b45309"] as const;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div id="padis-report" className="bg-[#e0e2e6] font-sans print:bg-white">

      {/* ─── Print CSS ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm 14mm 16mm 14mm; }

          .report-page {
            width: 100%;
            /* Remove the 297 mm floor — natural content height only */
            min-height: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          /* Both legacy and modern page-break syntax */
          .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }

          /* Cap chart containers to a fixed print height;
             overflow:hidden clips any SVG that overruns */
          .chart-wrapper {
            height: 148px !important;
            overflow: hidden !important;
          }

          .recharts-wrapper,
          .recharts-responsive-container {
            overflow: visible !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 1
      ════════════════════════════════════════════════════════════════════ */}
      <div className="report-page mx-auto w-[210mm] min-h-[297mm] print:min-h-0 bg-white shadow-[0_4px_48px_rgba(0,0,0,0.20)]">

        {/* ── Letterhead ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-5 px-10 py-5 print:py-3" style={{ backgroundColor: NAVY }}>
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/padis.svg" alt="PADIS" className="h-14 w-14 shrink-0 object-contain" />

          {/* Title block */}
          <div className="flex-1 border-l border-white/20 pl-5">
            <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-white/60">
              Sistem Informasi Analisis Risiko Bencana Pertanian
            </p>
            <h1 className="mt-0.5 text-[16px] font-bold uppercase tracking-wide text-white">
              Laporan Analisis Risiko Bencana
            </h1>
            <p className="mt-0.5 text-[9px] font-medium text-white/60">
              Paddy Disaster Information System (PADIS) · Teknik Geodesi dan Geomatika
            </p>
          </div>

          {/* Official badge */}
          <div
            className="shrink-0 rounded px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest"
            style={{ border: `1.5px solid ${GOLD}`, color: GOLD }}
          >
            Dokumen Resmi
          </div>
        </div>

        {/* Gold stripe */}
        <div style={{ height: 3, backgroundColor: GOLD }} />

        {/* Sub-header bar */}
        <div className="flex items-center justify-between bg-gray-50 px-10 py-2 border-b border-gray-200">
          <p className="text-[8px] text-gray-500">
            No. Laporan: <span className="font-semibold text-gray-800">{runTag(runId)}</span>
          </p>
          <p className="text-[8px] text-gray-500">
            Tanggal: <span className="font-semibold text-gray-800">{nowFormatted()}</span>
          </p>
          <p className="text-[8px] text-gray-500">
            Run ID: <span className="font-mono font-semibold text-gray-800">#{runId}</span>
          </p>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-10 pt-5 pb-4 space-y-5 print:pt-3 print:pb-2 print:space-y-3">

          {/* ── Identity table ── */}
          <div className="avoid-break">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-[2px] w-5 rounded" style={{ backgroundColor: GOLD }} />
              <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-gray-600">
                Identitas Laporan
              </p>
            </div>
            <div
              className="grid grid-cols-3 gap-px overflow-hidden rounded-sm"
              style={{ backgroundColor: "#d1d5db", border: "1px solid #d1d5db" }}
            >
              {([
                ["Jenis Bahaya",          hazardLabel(hazard)],
                ["Skenario",              climateLabel(climate)],
                ["Periode Ulang",         scenarioLabel(scenario)],
                ["Wilayah Analisis",      regionDisplay],
                ["Jumlah Kabupaten/Kota", `${validCount} terdampak · ${dataCount} total`],
                ["Sumber Analisis",       "Pipeline Spasial PADIS"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="bg-white px-4 py-2.5">
                  <p className="text-[7.5px] font-semibold uppercase tracking-wider text-gray-400">{k}</p>
                  <p className="mt-0.5 text-[10.5px] font-semibold text-gray-800">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section I: Executive Summary ── */}
          <div className="avoid-break">
            <SectionHead num="I" title="Ringkasan Eksekutif" />

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-2.5 mb-4 print:mb-2">
              <KpiCard
                label="Total Kerugian"
                value={fmtCompact(totalLoss)}
                sub={`${validCount} terdampak · ${dataCount} total`}
                accent={NAVY}
              />
              <KpiCard
                label="AAL Baseline"
                value={fmtCompact(aalNc)}
                sub="Kerugian tahunan baseline"
                accent={BLUE}
              />
              <KpiCard
                label="AAL Projection"
                value={fmtCompact(aalC)}
                sub="Projection"
                accent={AMBER}
              />
              <KpiCard
                label="Perubahan Risiko"
                value={aalDeltaLbl}
                sub={aalDelta != null ? (aalDelta >= 0 ? "Risiko meningkat" : "Risiko menurun") : "Data tidak tersedia"}
                accent={aalDelta != null && aalDelta >= 0 ? "#dc2626" : "#16a34a"}
              />
            </div>

            {/* Top 3 */}
            {top3.length > 0 && (
              <div className="mb-3 print:mb-1">
                <p className="mb-2 text-[8px] font-semibold uppercase tracking-widest text-gray-500">
                  Tiga Wilayah Prioritas Risiko Tertinggi
                </p>
                <div className="space-y-1.5">
                  {top3.map((r, i) => (
                    <div
                      key={r.name}
                      className="flex items-center gap-3 rounded-sm bg-gray-50 px-4 py-2.5"
                      style={{ borderLeft: `3px solid ${MEDAL_COLORS[i]}` }}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: MEDAL_COLORS[i] }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-900 truncate">{r.name}</p>
                        <p className="text-[8px] text-gray-500">
                          Kerugian tertinggi · {hazardLabel(hazard)} · {scenarioLabel(scenario)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold text-gray-900">{fmtCompact(r.loss)}</p>
                        {totalLoss > 0 && (
                          <p className="text-[8px] text-gray-400">
                            {((r.loss / totalLoss) * 100).toFixed(1)}% dari total
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insight paragraph */}
            <div
              className="rounded-sm p-3 text-[9px] leading-relaxed text-gray-700"
              style={{ backgroundColor: "#eff6ff", borderLeft: `3px solid ${BLUE}` }}
            >
              <strong className="text-gray-900">Analisis Ringkas: </strong>
              Berdasarkan hasil pemodelan spasial PADIS dengan parameter{" "}
              <em>{hazardLabel(hazard)}</em>, skenario{" "}
              <em>{climateLabel(climate)}</em>, dan periode ulang{" "}
              <em>{scenarioLabel(scenario)}</em>, total estimasi kerugian produksi padi
              mencapai <strong>{fmtCompact(totalLoss)}</strong> dari <strong>{validCount}</strong> kabupaten/kota
              terdampak (dari {dataCount} wilayah teranalisis). Wilayah prioritas utama adalah{" "}
              <strong>{top3[0]?.name ?? "—"}</strong>
              {top3[1] ? `, ${top3[1].name}` : ""}
              {top3[2] ? `, dan ${top3[2].name}` : ""}.
              {topLossShare > 0 &&
                ` Wilayah tertinggi menyumbang ${topLossShare.toFixed(1)}% dari total kerugian.`}
              {top3Share > 0 && top3.length >= 2 &&
                ` Tiga wilayah teratas secara kolektif menyumbang ${top3Share.toFixed(1)}% dari total kerugian.`}
              {aalDelta != null &&
                ` Skenario perubahan iklim memproyeksikan perubahan AAL sebesar ${aalDeltaLbl} terhadap kondisi baseline.`}
            </div>
          </div>

          {/* ── Section II: Charts ── */}
          <div className="avoid-break">
            <SectionHead num="II" title="Visualisasi Data Analisis" />

            <div className="grid grid-cols-2 gap-4">
              {/* Chart A — Top 10 by loss */}
              <div>
                <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-widest text-gray-500">
                  A. 10 Wilayah Kerugian Tertinggi
                </p>
                <div className="chart-wrapper" style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={top10Chart.map((r) => ({
                        name: r.name
                          .replace(/^Kabupaten /i, "Kab. ")
                          .substring(0, 16),
                        loss: r.loss,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis
                        type="number"
                        tickFormatter={fmtChartTick}
                        tick={{ fontSize: 7, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={{ fontSize: 7, fill: "#374151" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => [fmtFull(Number(v)), "Kerugian"]}
                        contentStyle={{ fontSize: 9, borderRadius: 6, border: "1px solid #e5e7eb" }}
                        cursor={{ fill: "#f9fafb" }}
                      />
                      <Bar dataKey="loss" radius={[0, 3, 3, 0]} maxBarSize={16}>
                        {top10Chart.map((_, i) => (
                          <Cell key={i} fill={BLUE_SHADES[i] ?? BLUE} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart B — AAL comparison */}
              <div>
                <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-widest text-gray-500">
                  B. Perbandingan AAL: Baseline vs Projection
                </p>
                <div className="chart-wrapper" style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={aalCompareData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 8, fill: "#374151" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={fmtChartTick}
                        tick={{ fontSize: 7, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => [fmtFull(Number(v)), "Total AAL"]}
                        contentStyle={{ fontSize: 9, borderRadius: 6, border: "1px solid #e5e7eb" }}
                        cursor={{ fill: "#f9fafb" }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={52}>
                        <Cell fill={BLUE}  />
                        <Cell fill={AMBER} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {aalDelta != null && (
                  <p className="mt-1 text-center text-[8px] text-gray-500">
                    Δ AAL:{" "}
                    <span
                      className="font-bold"
                      style={{ color: aalDelta >= 0 ? "#dc2626" : "#16a34a" }}
                    >
                      {aalDeltaLbl}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>

        <PageFooter page={1} total={2} runId={runId} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PAGE 2
      ════════════════════════════════════════════════════════════════════ */}
      <div className="report-page page-break mx-auto mt-6 w-[210mm] min-h-[297mm] print:min-h-0 bg-white shadow-[0_4px_48px_rgba(0,0,0,0.20)] print:mt-0">

        {/* Continuation mini-header */}
        <div
          className="flex items-center justify-between border-b border-gray-200 px-10 py-3"
          style={{ borderTop: `3px solid ${GOLD}` }}
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/padis.svg" alt="PADIS" className="h-8 w-8 object-contain" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: NAVY }}>
                PADIS
              </p>
              <p className="text-[7.5px] text-gray-400">Laporan Analisis Risiko Bencana (Lanjutan)</p>
            </div>
          </div>
          <p className="text-[8px] text-gray-400">
            {runTag(runId)} · Hal. 2 dari 2
          </p>
        </div>

        <div className="px-10 pt-5 pb-4 space-y-5 print:pt-3 print:pb-2 print:space-y-3">

          {/* ── Section III: Top 10 table ── */}
          <div className="avoid-break">
            <SectionHead num="III" title="10 Wilayah Terdampak Tertinggi" />

            <div className="overflow-hidden rounded-sm" style={{ border: `1px solid #e5e7eb` }}>
              <table className="w-full border-collapse" style={{ fontSize: 8 }}>
                <thead>
                  <tr style={{ backgroundColor: NAVY }}>
                    {["No.", "Wilayah", "Kerugian (Rp)", "Share (%)"].map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-white"
                        style={{ fontSize: 7, letterSpacing: "0.06em" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topRegions.slice(0, 10).map((row, i) => (
                    <tr
                      key={row.name}
                      style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}
                    >
                      <td className="px-3 py-1.5 text-gray-400" style={{ fontSize: 7.5 }}>{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">{row.name}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-gray-900">{fmtFull(row.loss)}</td>
                      <td className="px-3 py-1.5 text-right font-medium" style={{ color: "#1e3a5c" }}>
                        {totalLoss > 0 && row.loss > 0
                          ? `${((row.loss / totalLoss) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {topRegions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[10px] text-gray-400">
                        Tidak ada data tersedia untuk kombinasi filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
                {topRegions.length > 0 && (() => {
                  const top10Loss = topRegions.slice(0, 10).reduce((s, r) => s + r.loss, 0);
                  return (
                    <tfoot>
                      <tr style={{ backgroundColor: "#f3f4f6", borderTop: `2px solid ${NAVY}` }}>
                        <td
                          colSpan={2}
                          className="px-3 py-2 font-bold uppercase tracking-wider text-gray-700"
                          style={{ fontSize: 7 }}
                        >
                          Total (Top 10)
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">{fmtFull(top10Loss)}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">
                          {totalLoss > 0 ? `${((top10Loss / totalLoss) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>

            <p className="mt-2 text-[8px] italic text-gray-500">
              Catatan: Rincian data seluruh wilayah dapat dilihat melalui lampiran dokumen Excel (.xlsx).
            </p>
          </div>

          {/* ── Section IV: Methodology ── */}
          <div className="avoid-break">
            <SectionHead num="IV" title="Catatan Metodologi dan Sumber Data" />

            <div className="grid grid-cols-2 gap-4 text-[8.5px] leading-relaxed text-gray-600">
              <div>
                <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider text-gray-700">
                  Definisi Istilah
                </p>
                <dl className="space-y-1">
                  {[
                    ["Kerugian (Loss)", "Estimasi kerugian produksi padi akibat bencana pada periode ulang tertentu, dinyatakan dalam Rupiah."],
                    ["AAL (Average Annual Loss)", "Rata-rata kerugian tahunan yang diharapkan, dihitung dari integral kurva probabilitas bahaya × kurva kerentanan."],
                    ["Indeks Bahaya", "Nilai normalisasi (0–1) intensitas bahaya spasial per wilayah berdasarkan data raster."],
                    ["Periode Ulang (RP)", "Periode ulang rata-rata — kemungkinan bencana dengan intensitas tersebut atau lebih besar terjadi sekali dalam RP tahun."],
                  ].map(([t, d]) => (
                    <div key={t}>
                      <dt className="font-semibold text-gray-800">{t}</dt>
                      <dd className="text-gray-600">{d}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider text-gray-700">
                  Metodologi dan Sumber
                </p>
                <dl className="space-y-1">
                  {[
                    ["Data Bahaya", "Raster hazard resolusi spasial tinggi dari model hidrologis (banjir) dan model klimatologis (kekeringan)."],
                    ["Data Eksposur", "Produksi sawah kabupaten/kota (BPS) dan batas administrasi level kabupaten."],
                    ["Kerentanan", "Kurva loss function berdasarkan referensi ilmiah dan validasi historis kejadian bencana."],
                    ["Integrasi Spasial", "Zonal statistics via overlay raster–vektor menggunakan GIS pipeline Python (geopandas/rasterio)."],
                  ].map(([t, d]) => (
                    <div key={t}>
                      <dt className="font-semibold text-gray-800">{t}</dt>
                      <dd className="text-gray-600">{d}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {/* Disclaimer */}
            <div
              className="mt-3 rounded-sm p-3 text-[8px] leading-relaxed text-gray-700"
              style={{ backgroundColor: "#fffbeb", borderLeft: `3px solid ${GOLD}` }}
            >
              <strong className="text-gray-900">Pernyataan Penyangkalan (Disclaimer): </strong>
              Laporan ini merupakan keluaran model analisis spasial PADIS yang bersifat estimasi. Angka kerugian yang tersaji bukan merupakan data resmi kebencanaan dari instansi pemerintah manapun. Hasil analisis dapat digunakan sebagai acuan perencanaan dan mitigasi risiko, namun tidak menggantikan survei lapangan dan kajian teknis yang lebih mendalam. Akurasi analisis bergantung pada resolusi, kualitas, dan kemutakhiran data input yang digunakan.
            </div>
          </div>

          {/* ── Signature / stamp block ── */}
          <div className="avoid-break">
            <div
              className="mt-2 flex items-start justify-between rounded-sm p-4"
              style={{ border: `1px solid #e5e7eb` }}
            >
              <div className="text-[8.5px] text-gray-600">
                <p className="font-bold text-gray-800">Dihasilkan secara otomatis oleh:</p>
                <p className="mt-0.5">Paddy Disaster Information System (PADIS)</p>
                <p className="text-gray-400">Sistem Analisis Risiko Bencana Pertanian Berbasis GIS</p>
                <p className="mt-2 font-mono text-[7.5px] text-gray-400">
                  run_id: {runId} · generated: {new Date().toISOString()}
                </p>
              </div>

              <div className="flex flex-col items-center text-[7.5px] text-gray-400">
                <div
                  className="mb-1 flex h-[60px] w-[60px] items-center justify-center rounded-full"
                  style={{ border: `1.5px dashed ${GOLD}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo/padis.svg" alt="" className="h-10 w-10 object-contain opacity-25" />
                </div>
                <p className="text-center">Stempel Digital</p>
                <p className="text-center">PADIS System</p>
              </div>
            </div>
          </div>

        </div>

        <PageFooter page={2} total={2} runId={runId} />
      </div>
    </div>
  );
}
