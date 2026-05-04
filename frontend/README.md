# PADIS Frontend

Frontend PADIS adalah aplikasi Next.js untuk dashboard WebGIS, Admin UI, autentikasi, dan visualisasi hasil analisis risiko.

## Workflow Lokal Utama

Jalankan frontend bersama backend dari root project menggunakan PADIS CLI:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

`.\padis.ps1 start` akan menjalankan backend Flask, menjalankan frontend Next.js, lalu membuka Admin UI:

```text
http://localhost:3000/admin
```

Jika alias lokal sudah dipasang:

```powershell
padis check
padis start
```

## Debug Frontend Langsung

Gunakan `npm run dev` hanya jika ingin debug frontend secara terpisah dari backend launcher:

```powershell
cd frontend
npm install
npm run dev
```

Frontend berjalan di:

```text
http://localhost:3000
```

Pastikan `frontend/.env.local` mengarah ke backend lokal saat development:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## Catatan

- Workflow operator/admin utama tetap lewat `.\padis.ps1 start` dari root project.
- `npm run dev` tidak menjalankan backend.
- Pipeline tidak dijalankan oleh frontend secara langsung; pipeline dijalankan melalui Admin UI atau command `padis run`.
