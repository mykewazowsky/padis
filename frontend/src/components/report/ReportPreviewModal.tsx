"use client";

import { Printer, X, FileText, Download } from "lucide-react";
import type { ReportDocumentProps } from "./ReportDocument";
import ReportDocument from "./ReportDocument";

type Props = ReportDocumentProps & {
  onClose: () => void;
  /** Optional: triggers the server-side PDF download (different format / auth-gated). */
  onDownloadServerPdf?: () => void;
};

export default function ReportPreviewModal({ onClose, onDownloadServerPdf, ...docProps }: Props) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="no-print fixed inset-0 z-[9999] flex flex-col">

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="no-print flex shrink-0 items-center justify-between bg-gray-900 px-6 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-800 p-2">
            <FileText className="h-4 w-4 text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Buat Laporan PADIS</p>
            <p className="text-xs text-gray-400">
              Pratinjau layout A4 — gunakan tombol &ldquo;Cetak & Simpan PDF&rdquo; untuk mengunduh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Secondary: server-side data PDF (auth-gated, different format) */}
          {onDownloadServerPdf && (
            <button
              type="button"
              onClick={onDownloadServerPdf}
              title="Unduh PDF ringkas yang dibuat di server (memerlukan login)"
              className="flex items-center gap-2 rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Unduh PDF Data</span>
            </button>
          )}

          {/* Primary: browser print → Save as PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#c9a227" }}
          >
            <Printer className="h-4 w-4" />
            Cetak &amp; Simpan PDF
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
            Tutup
          </button>
        </div>
      </div>

      {/* ── Instruction bar ────────────────────────────────────────────────── */}
      <div className="no-print shrink-0 bg-gray-800/60 px-6 py-1.5">
        <p className="text-center text-[11px] text-gray-500">
          <span className="font-semibold text-gray-400">Cara simpan PDF:</span>{" "}
          Klik &ldquo;Cetak &amp; Simpan PDF&rdquo; → di dialog cetak browser pilih{" "}
          <span className="text-gray-300">Tujuan: Simpan sebagai PDF</span> → Simpan ·
          Dioptimalkan untuk kertas A4 portrait
        </p>
      </div>

      {/* ── Scrollable preview ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-8">
        <ReportDocument {...docProps} />
      </div>
    </div>
  );
}
