# Dokumentasi Frontend

Frontend PADIS adalah aplikasi Next.js App Router dengan React, TypeScript, Tailwind CSS, Leaflet, dan Recharts.

## Stack

| Paket | Versi | Fungsi |
|---|---|---|
| Next.js | 16.1.7 | Routing, build, App Router |
| React | 19.2.3 | UI |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| Leaflet | 1.9.4 | Peta interaktif |
| React Leaflet | 5.0.0 | Binding Leaflet untuk React |
| Leaflet.VectorGrid | 1.3.0 | Render MVT |
| Recharts | 3.8.0 | Grafik |
| simple-statistics | 7.8.9 | Klasifikasi Jenks |
| chroma-js | 3.2.0 | Palet warna |
| lucide-react | 1.7.0 | Ikon |
| Supabase JS | 2.104.1 | Integrasi Supabase client-side jika diperlukan |

## Struktur Route

```
src/app/
|-- (main)/
|   |-- page.tsx                 # Landing page
|   |-- dashboard/page.tsx       # Dashboard Web-GIS
|   |-- about/page.tsx
|   |-- cara-kerja/page.tsx
|   |-- metodologi/page.tsx
|   `-- kebijakan-privasi/page.tsx
|-- (admin)/
|   `-- admin/
|       |-- page.tsx             # Ringkasan admin
|       |-- data-management/
|       |-- process-control/
|       |-- pipeline-monitor/
|       |-- outputs/
|       |-- artifacts/
|       |-- users/
|       `-- guide/
|-- (auth)/
|   |-- login/
|   |-- register/
|   |-- forgot-password/
|   `-- reset-password/
|-- auth/callback/
|-- layout.tsx
|-- loading.tsx
|-- error.tsx
`-- not-found.tsx
```

Route admin dilindungi oleh `AdminGuard` dan membutuhkan JWT dengan role `admin`.

## Helper API dan Auth

File penting:

- `src/lib/api.ts`: membangun base URL API.
- `src/lib/fetcher.ts`: fetch JSON umum.
- `src/lib/fetcher-auth.ts`: fetch dengan token JWT.
- `src/lib/auth.ts`: simpan, baca, decode, dan hapus token.
- `src/services/fetchLayers.ts`: fetch layer dashboard dan tile URL.

Node graphify yang paling terhubung di frontend adalah `buildApiUrl()`, `getToken()`, `clearToken()`, `fetchWithAuth()`, dan `fetchJson()`. Itu berarti helper ini menjadi jalur utama komunikasi UI dengan backend.

## Dashboard Web-GIS

Route:

```text
src/app/(main)/dashboard/page.tsx
```

State utama:

| State | Fungsi |
|---|---|
| `hazard` | Hazard aktif: flood, drought, multihazard. |
| `scenario` | Return period: rp25, rp50, rp100, rp250. |
| `climate` | Climate scenario: nonclimate atau climate. |
| `runId` | Run yang sedang dipakai dashboard. |
| `selectedRegion` | Wilayah yang dipilih user. |
| `layers` | Data atribut untuk regions, production, loss, aal, hazard. |
| `activeLayers` | Toggle layer peta. |
| `regionCentroids` | Centroid wilayah untuk zoom dropdown. |

Data diambil melalui `fetchAllLayers()` dari `src/services/fetchLayers.ts`.

## Komponen Peta

```
MapView
  -> MapViewClient
      -> MapCanvas
          -> VectorTileLayer
          -> GeoServerLayerManager
          -> MapLayerControlPanel
          -> MapLegendPanel
          -> LayerItem
```

### MapView

`MapView` adalah wrapper yang aman untuk SSR. Komponen ini menghitung:

- selected feature dari wilayah yang dipilih.
- total loss dan total AAL.
- persentase kontribusi wilayah.
- data bounds untuk fit-to-data.
- metrik utama overlay dashboard.

### MapViewClient

Komponen client-only yang mengatur klasifikasi layer:

- loss
- AAL
- hazard index

Klasifikasi memakai Jenks natural breaks dan palet warna dari `chroma-js`.

### MapCanvas

Komponen Leaflet utama. Fungsi:

- Menampilkan basemap.
- Menampilkan MVT layer dari `/api/tiles`.
- Menangani klik wilayah.
- Menangani zoom ke centroid wilayah.
- Menampilkan label kabupaten/kota pada zoom tertentu.
- Menampilkan legend layer analisis.

## Layer Dashboard

Layer yang dipakai:

| Layer | Sumber data | Rendering |
|---|---|---|
| `regions` | `/api/tiles/regions` | Batas administrasi. |
| `production` | `/api/layers/values/production` dan `/api/tiles/production` | Produksi padi. |
| `loss` | `/api/layers/values/loss` dan `/api/tiles/loss` | Kerugian ekonomi. |
| `aal` | `/api/layers/values/aal` dan `/api/tiles/aal` | Annual Average Loss. |
| `hazard` | `/api/layers/values/hazard` dan `/api/tiles/hazard` | Indeks hazard. |

Prioritas legend dan format saat beberapa layer aktif:

```text
hazard > loss > aal > production
```

## Chart

Komponen chart utama:

- `AdvancedCharts.tsx`: top regions dan distribusi loss.
- `ComparisonCharts.tsx`: perbandingan AAL dan loss antar hazard/scenario.
- `chartTheme.ts`: warna dan tema chart.

Chart mengambil data dari endpoint analitik seperti:

- `/api/top-regions`
- `/api/aal-summary-all-hazards`
- `/api/loss-summary-compare-climate`

## Report

Komponen report:

- `ReportPreviewModal.tsx`
- `ReportDocument.tsx`

Report dapat mengambil data dashboard, menampilkan preview, dan memicu download dari backend. Download yang membutuhkan auth memakai helper protected download.

## Admin UI

Route admin utama:

| Route | Fungsi |
|---|---|
| `/admin` | Ringkasan admin. |
| `/admin/data-management` | Kesiapan data raw, processed, dan output. |
| `/admin/process-control` | Jalankan pipeline analisis dan load database. |
| `/admin/pipeline-monitor` | Monitoring run, validasi, aktivasi, hapus run. |
| `/admin/outputs` | Preview dan download output analisis. |
| `/admin/users` | Kelola user. |
| `/admin/guide` | Panduan operator di UI. |

### Process Control

File:

```text
src/app/(admin)/admin/process-control/page.tsx
```

Perilaku terbaru:

- `handleRun(mode)` memanggil `/api/admin/start-pipeline`.
- Tombol "Jalankan Pipeline Penuh" mengirim `mode=full` dan hazard terpilih.
- `handleLoadDatabase()` memanggil `/api/admin/load-database`.
- Tombol "Muat ke Database Saja" tidak mengirim hazard.
- UI memanggil `/api/admin/final-analysis-status` untuk menampilkan kesiapan tiga file final.
- Tombol load database disabled jika file final belum lengkap.

### Pipeline Monitor

File:

```text
src/app/(admin)/admin/pipeline-monitor/page.tsx
```

Fungsi:

- Polling status run.
- Menampilkan tahap pipeline.
- Menampilkan riwayat run.
- Validasi kelengkapan run.
- Aktivasi run.
- Hapus run dengan konfirmasi.

## Styling

Frontend memakai Tailwind CSS 4 dan CSS variable di `globals.css`. Konvensi umum:

- Layout admin menggunakan `AdminShell`.
- Icon memakai `lucide-react`.
- Komponen dashboard padat dan informatif.
- Kartu dipakai untuk item berulang, status, dan panel alat.
- Responsif untuk mobile, tablet, dan desktop.

## Environment Frontend

File:

```text
frontend/.env.local
```

Isi lokal:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Untuk production:

```env
NEXT_PUBLIC_API_BASE_URL=https://url-backend-production
```

## Command Frontend

```powershell
cd frontend
npm install
npm run dev
npm run lint
npm run build
```

Script dev memakai:

```text
next dev --webpack
```
