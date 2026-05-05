# Panduan Operasional Pipeline

Dokumen ini untuk operator yang menjalankan pipeline PADIS dari Admin UI atau launcher lokal.

## Prasyarat

Pastikan hal berikut sudah siap:

- Backend dan frontend dapat berjalan.
- `DATABASE_URL` tersedia di `backend/.env`.
- File input berada di `backend/data/raw/`.
- User yang dipakai untuk Admin UI memiliki role `admin`.

Jalankan aplikasi lokal:

```powershell
.\padis.ps1 check
.\padis.ps1 start
```

Admin UI dibuka di:

```text
http://localhost:3000/admin
```

## Alur Kerja Operator

Urutan yang disarankan:

1. Buka Admin UI.
2. Masuk ke Process Control.
3. Jalankan pipeline penuh untuk `flood`.
4. Jalankan pipeline penuh untuk `drought`.
5. Jalankan pipeline penuh untuk `multi`.
6. Pastikan tiga file final lengkap.
7. Klik "Muat ke Database Saja".
8. Pantau run di Pipeline Monitor.
9. Aktifkan run sukses jika akan dipakai dashboard.

## Menjalankan Pipeline Penuh

Di halaman Process Control:

1. Pilih hazard.
2. Isi nama operator.
3. Klik "Jalankan Pipeline Penuh".

Tombol ini hanya menjalankan analisis sesuai hazard yang dipilih.

| Hazard dipilih | File yang dihasilkan |
|---|---|
| Flood | `kabkota_flood_final.geojson` |
| Drought | `kabkota_drought_final.geojson` |
| Multi-hazard | `kabkota_multihazard_final.geojson` |

Tombol ini tidak menjalankan ETL/load database.

## Kesiapan File Final

Process Control menampilkan status tiga file final:

```text
backend/data/output/analysis/kabkota_flood_final.geojson
backend/data/output/analysis/kabkota_drought_final.geojson
backend/data/output/analysis/kabkota_multihazard_final.geojson
```

Status ini diambil dari:

```text
GET /api/admin/final-analysis-status
```

Jika salah satu file belum ada, UI menampilkan file yang belum tersedia.

## Muat ke Database Saja

Tombol "Muat ke Database Saja":

- Tidak bergantung pada hazard yang sedang dipilih.
- Tidak mengirim hazard ke backend.
- Hanya berjalan jika tiga file final lengkap.
- Menjalankan ETL untuk flood, drought, dan multihazard sebagai satu proses.

Endpoint yang dipakai:

```text
POST /api/admin/load-database
```

Jika file belum lengkap, backend mengembalikan `409` dengan daftar `missing`.

## Monitoring

Buka Pipeline Monitor untuk melihat:

- Status run: `running`, `success`, `failed`.
- Tahap aktif: `preprocess`, `zonal`, `analysis`, `etl`.
- Progres dalam persen.
- Pesan terakhir dari pipeline.
- Riwayat run terbaru.
- Validasi run sebelum aktivasi.

Endpoint yang dipakai:

```text
GET /api/admin/run-status
GET /api/admin/runs
GET /api/admin/runs/{run_id}/validate
PATCH /api/admin/runs/{run_id}/activate
```

## Menjalankan dari CLI

Gunakan dari root project:

```powershell
.\padis.ps1 run --mode full --hazard flood --operator nama_operator
.\padis.ps1 run --mode full --hazard drought --operator nama_operator
.\padis.ps1 run --mode full --hazard multi --operator nama_operator
```

Untuk ETL saja:

```powershell
.\padis.ps1 run --mode web --hazard multi --operator nama_operator
```

Catatan: untuk operator, Admin UI lebih aman karena menampilkan status kesiapan tiga file final sebelum load database.

## Mode CLI

| Mode | Keterangan |
|---|---|
| `full` | Jalankan preprocess, zonal, dan analysis untuk flood/drought. Untuk multi hanya analysis multihazard. |
| `analysis` | Jalankan zonal dan analysis untuk flood/drought. Untuk multi hanya analysis multihazard. |
| `preprocess` | Jalankan preprocess saja. |
| `web` | Jalankan ETL/load database saja. |

## Troubleshooting

### Tombol load database disabled

Minimal satu file final belum tersedia. Jalankan pipeline penuh untuk hazard yang belum selesai.

### Load database gagal dengan error 409

Kemungkinan:

- Ada pipeline lain sedang berjalan.
- Salah satu file final belum ada.

Cek pesan error di UI. Jika error berisi `missing`, jalankan ulang hazard yang file finalnya belum ada.

### Multi-hazard gagal

Multi-hazard membutuhkan:

```text
kabkota_flood_final.geojson
kabkota_drought_final.geojson
```

Jalankan `full + flood` dan `full + drought` terlebih dahulu. Jika keduanya sudah ada tetapi multi tetap gagal, cek waktu modifikasi file; pipeline menolak input flood dan drought yang terlihat berasal dari run berbeda.

### Pipeline tidak bisa dimulai

Backend menolak run baru jika ada run `source='local'` yang masih `running` dan belum stale. Tunggu selesai, atau jika proses benar-benar mati, tandai run lama sebagai failed di database.

```sql
UPDATE runs
SET status = 'failed'
WHERE status = 'running' AND source = 'local';
```

### Data tidak muncul di dashboard setelah ETL

Pastikan:

- ETL selesai dengan status `success`.
- Run sudah aktif atau dashboard membaca run yang benar.
- Tabel `losses`, `aal`, dan `zonal_kabupaten` punya data untuk flood, drought, dan multihazard.
