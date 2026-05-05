# PADIS Frontend

Frontend PADIS adalah aplikasi Next.js untuk dashboard Web-GIS, Admin UI, autentikasi, chart, report preview, dan visualisasi hasil analisis risiko.

Dokumen ini khusus untuk folder `frontend`. Untuk orientasi project lengkap, baca `../README.md` dan dokumen di `../docs/`.

## Workflow Lokal Utama

Jalankan frontend bersama backend dari root project:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

Admin UI lokal:

```text
http://localhost:3000/admin
```

Jika alias opsional sudah dipasang:

```powershell
padis check
padis start
```

## Environment

Buat `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Untuk production, isi dengan URL backend production:

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
npm start
```

Script:

| Command | Fungsi |
|---|---|
| `npm run dev` | Menjalankan Next.js dev server dengan webpack. |
| `npm run lint` | Menjalankan ESLint. |
| `npm run build` | Build production. |
| `npm start` | Menjalankan build production. |

## Struktur Singkat

```
src/
|-- app/
|   |-- (main)/dashboard/        # Dashboard Web-GIS
|   |-- (admin)/admin/           # Admin UI
|   |-- (auth)/                  # Login/register/reset
|   `-- layout.tsx
|-- components/
|   |-- map/
|   |-- dashboard/
|   |-- charts/
|   |-- admin/
|   `-- report/
|-- lib/
|-- services/
`-- types/
```

## Catatan Pipeline

Frontend tidak menjalankan pipeline langsung. Frontend hanya memanggil endpoint admin backend:

- `POST /api/admin/start-pipeline` untuk pipeline analisis sesuai hazard.
- `GET /api/admin/final-analysis-status` untuk status tiga file final.
- `POST /api/admin/load-database` untuk ETL/load database setelah file final lengkap.

Tombol "Muat ke Database Saja" tidak mengirim hazard ke backend.
