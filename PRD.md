# Product Requirements Document (PRD) PADIS

Tanggal: 2026-05-06  
Produk: PADIS - Paddy Disaster Information System  
Jenis: Platform Web-GIS analisis risiko bencana terhadap produksi padi  
Status dokumen: Draft lengkap berbasis kondisi project saat ini

## 1. Ringkasan Eksekutif

PADIS adalah platform Web-GIS untuk menganalisis dan memvisualisasikan risiko bencana terhadap produksi padi di Indonesia. Produk ini menggabungkan peta interaktif, analitik kerugian, Average Annual Loss (AAL), indeks hazard, data produksi padi, pipeline geospasial, database PostGIS, laporan, dan panel admin untuk menjalankan serta mengelola proses analisis.

Sistem mendukung tiga tipe hazard utama:

- Flood: analisis risiko banjir.
- Drought: analisis risiko kekeringan.
- Multi-hazard: analisis gabungan dari hasil flood dan drought.

PADIS ditujukan untuk membantu eksplorasi spasial risiko, pemantauan hasil pipeline, dan penyusunan output berbasis data bagi operator, analis, akademisi, dan pemangku kepentingan yang membutuhkan informasi risiko padi secara terstruktur.

## 2. Latar Belakang

Produksi padi merupakan komponen penting dalam ketahanan pangan. Risiko bencana seperti banjir dan kekeringan dapat memengaruhi produksi secara spasial dan temporal. Data hazard, wilayah sawah, produksi padi, batas administrasi, serta nilai kerugian perlu diproses dan disajikan dalam bentuk yang mudah dianalisis.

Masalah utama yang ingin diselesaikan PADIS:

- Data risiko padi tersebar dalam format geospasial dan tabular yang sulit dibaca langsung oleh pengguna non-teknis.
- Analisis hazard membutuhkan pipeline komputasi geospasial yang terkontrol dan dapat diaudit.
- Hasil analisis perlu ditampilkan di dashboard Web-GIS yang ringan, interaktif, dan dapat difilter.
- Operator membutuhkan panel admin untuk menjalankan pipeline, memeriksa kesiapan data, memonitor proses, dan mengaktifkan run yang valid.
- Pengguna membutuhkan laporan dan ekspor data untuk dokumentasi, analisis lanjutan, dan pengambilan keputusan.

## 3. Visi Produk

PADIS menjadi sistem informasi risiko bencana padi yang menyatukan pemrosesan geospasial, manajemen data, visualisasi peta, analitik, dan pelaporan dalam satu platform yang mudah digunakan, transparan, dan dapat dikembangkan.

## 4. Tujuan Produk

Tujuan utama:

- Menyediakan dashboard Web-GIS untuk mengeksplorasi distribusi risiko padi per kabupaten/kota.
- Menampilkan loss, AAL, indeks hazard, produksi, dan batas administrasi dalam peta interaktif.
- Menyediakan filter analisis berdasarkan hazard, skenario iklim, return period, run aktif, dan wilayah.
- Menyediakan grafik analitik untuk memahami perbandingan hazard, perubahan skenario, distribusi loss, dan prioritas wilayah.
- Menyediakan report preview dan export data untuk kebutuhan dokumentasi.
- Menyediakan panel admin untuk mengelola data, menjalankan pipeline, memonitor run, mengelola output, dan mengelola user.
- Memisahkan pipeline geospasial berat dari request web agar sistem dashboard tetap responsif.

Tujuan pendukung:

- Mendukung workflow lokal operator melalui Admin UI dan CLI.
- Mendukung deployment backend, frontend, dan database secara terpisah.
- Menjaga konsistensi data dashboard melalui konsep run aktif.
- Menyediakan dokumentasi teknis dan operasional yang jelas untuk developer serta operator.

## 5. Non-Tujuan

Hal yang tidak menjadi fokus utama pada fase saat ini:

- Analisis hazard di luar flood, drought, dan multi-hazard.
- Editor geospasial penuh di browser.
- Pemodelan bencana real-time.
- Sistem notifikasi publik skala nasional.
- Kolaborasi multi-tenant kompleks.
- Penggantian software GIS desktop untuk preprocessing manual tingkat lanjut.

## 6. Target Pengguna

### 6.1 Pengguna Dashboard

Pengguna yang membuka dashboard untuk membaca hasil analisis risiko.

Kebutuhan:

- Melihat peta risiko secara cepat.
- Memilih hazard, scenario, return period, dan wilayah.
- Membaca ringkasan loss, AAL, prioritas wilayah, dan distribusi risiko.
- Mengunduh CSV atau membuat laporan.

### 6.2 Admin atau Operator Pipeline

Pengguna dengan role admin yang menjalankan dan mengelola pipeline.

Kebutuhan:

- Mengecek kesiapan data input.
- Menjalankan pipeline flood, drought, dan multi-hazard.
- Memastikan tiga file final tersedia.
- Memuat hasil analisis ke database.
- Memantau status run.
- Mengaktifkan run sukses sebagai sumber data dashboard.
- Mengelola output dan user.

### 6.3 Analis atau Peneliti

Pengguna yang membutuhkan data untuk interpretasi teknis dan akademis.

Kebutuhan:

- Membaca metrik loss, AAL, hazard index, dan produksi.
- Membandingkan hazard dan skenario iklim.
- Mengakses output CSV, XLSX, report, dan file analisis.
- Melihat metodologi dan asumsi sistem.

### 6.4 Stakeholder Kebijakan

Pengguna yang membutuhkan informasi ringkas untuk prioritas wilayah.

Kebutuhan:

- Mengetahui wilayah berisiko tinggi.
- Membandingkan perubahan risiko antar skenario.
- Mendapat ringkasan yang mudah dibaca dan dapat dibagikan.

## 7. Ruang Lingkup Produk

### 7.1 Ruang Lingkup Saat Ini

PADIS mencakup:

- Frontend Next.js untuk landing page, dashboard, halaman metodologi, halaman cara kerja, halaman tentang, auth, dan admin.
- Backend Flask untuk API auth, layer values, vector tiles, analytics, report, admin, pipeline control, dan user management.
- Database PostgreSQL + PostGIS untuk data spasial, data produksi, hasil analisis, run, dan user.
- Pipeline Python geospasial untuk preprocess, zonal statistics, analysis, dan ETL.
- Vector tile MVT untuk rendering peta yang ringan.
- Recharts untuk chart analitik.
- Leaflet untuk interaksi peta.

### 7.2 Hazard dan Scenario

Hazard:

- flood
- drought
- multihazard

Scenario iklim:

- nonclimate
- climate

Return period:

- RP25
- RP50
- RP100
- RP250

## 8. Prinsip Produk

- Peta adalah fokus utama dashboard.
- Filter harus menjelaskan konteks analisis tanpa perlu teks status tambahan yang berulang.
- Data yang tampil harus konsisten dengan run aktif.
- Pipeline dan ETL harus terpisah agar operator dapat mengontrol setiap tahap.
- Dashboard harus membaca data atribut tanpa geometri untuk performa, sementara geometri peta diambil dari vector tile.
- Admin UI harus mengurangi risiko operator menjalankan ETL ketika file final belum lengkap.
- UI harus profesional, akademis, dan informatif tanpa terasa seperti generic dashboard.

## 9. Arsitektur Tingkat Tinggi

Alur utama sistem:

```text
Browser
  -> Frontend Next.js
      -> Flask API
          -> PostgreSQL + PostGIS

Admin UI / PADIS CLI
  -> Subprocess pipeline Python
      -> preprocess
      -> zonal statistics
      -> analysis
      -> final GeoJSON
      -> ETL/load database
```

Jalur baca dashboard:

```text
User memilih filter
  -> Frontend menyimpan state dashboard
  -> Frontend mengambil layer values dan tile URL
  -> Backend membaca database
  -> Backend mengembalikan atribut, analytics, dan MVT
  -> Frontend merender peta, chart, panel layer, dan ringkasan
```

Jalur pipeline:

```text
Admin menjalankan pipeline
  -> Backend spawn subprocess
  -> Pipeline menulis status ke tabel runs
  -> Pipeline menghasilkan file final GeoJSON
  -> Admin menjalankan load database setelah tiga file final lengkap
  -> Dashboard membaca run aktif dari database
```

## 10. Kebutuhan Fungsional

### 10.1 Landing dan Halaman Informasi

Sistem harus menyediakan halaman publik untuk:

- Beranda.
- Cara kerja.
- Metodologi.
- Tentang Kami.
- Kebijakan privasi.

Acceptance criteria:

- Pengguna dapat memahami tujuan PADIS tanpa login.
- Navigasi menuju dashboard tersedia.
- Halaman metodologi dapat menjelaskan pendekatan flood, drought, multi-hazard, loss, dan AAL secara ringkas.

### 10.2 Auth dan Role

Sistem harus menyediakan:

- Register user.
- Login user.
- Logout sisi client.
- Ambil profil user saat ini.
- Forgot password.
- Reset password.
- Role admin dan user.
- Proteksi route admin menggunakan JWT admin.

Acceptance criteria:

- User biasa tidak dapat mengakses route admin.
- Admin dapat mengakses panel admin setelah login.
- Token JWT dikirim melalui header Authorization Bearer.
- Reset password memakai token yang memiliki masa berlaku dan status penggunaan.

### 10.3 Dashboard Web-GIS

Dashboard harus menjadi pengalaman utama produk.

Kebutuhan utama:

- Menampilkan peta risiko wilayah.
- Menampilkan filter hazard, climate scenario, return period, dan kabupaten/kota.
- Menampilkan ringkasan cepat seperti total loss, perubahan AAL/loss, prioritas wilayah, dan jumlah wilayah.
- Menampilkan panel layer untuk mengatur basemap, overlay, layer analisis, opacity, dan urutan layer.
- Menampilkan legend sesuai layer aktif.
- Menampilkan panel wilayah terpilih ketika user memilih kabupaten/kota.
- Menyediakan aksi perbesar peta, reset tampilan, unduh CSV, dan buat laporan.

Acceptance criteria:

- Perubahan filter memperbarui peta, chart, ringkasan, dan report context.
- Dropdown wilayah dapat melakukan zoom ke wilayah terpilih.
- Klik wilayah pada peta memperbarui selected region.
- Layer values dan vector tile memakai parameter hazard, climate, scenario/return period, dan run_id yang konsisten.
- Dashboard tetap dapat fallback ke run terbaru jika run aktif tidak tersedia, sesuai aturan backend.

### 10.4 Filter Analisis

Filter analisis harus:

- Menyediakan pilihan jenis bencana.
- Menyediakan pilihan skenario analisis.
- Menyediakan pilihan periode ulang.
- Menyediakan pilihan kabupaten/kota.
- Menyatu secara visual dengan area peta.
- Tidak menampilkan ringkasan aktif yang menduplikasi pilihan filter.

Acceptance criteria:

- Filter aktif dapat menjelaskan konteks analisis tanpa teks tambahan seperti "Analisis aktif".
- Layout filter tidak mengambil fokus lebih besar daripada peta.
- Filter tetap mudah dipindai pada desktop dan mobile.

### 10.5 Peta dan Layer

Layer yang harus didukung:

- regions: batas administrasi.
- production: produksi padi.
- loss: kerugian ekonomi.
- aal: Average Annual Loss.
- hazard: indeks hazard.

Kebutuhan rendering:

- Geometri peta dirender melalui MVT endpoint.
- Values endpoint mengembalikan atribut tanpa geometri.
- Klasifikasi warna dilakukan di frontend.
- Legend mengikuti prioritas layer aktif.
- Panel layer mendukung opacity dan pengaturan layer.

Prioritas legend:

```text
hazard > loss > aal > production
```

Acceptance criteria:

- Peta dapat dirender tanpa memuat GeoJSON besar di client.
- Tile endpoint mengembalikan MVT binary.
- Layer aktif dapat diubah tanpa reload halaman penuh.
- Label kabupaten/kota dapat muncul pada kondisi zoom yang sesuai.

### 10.6 Chart dan Analitik

Chart harus membantu pengguna memahami pola risiko tanpa mengalihkan fokus dari peta.

Kebutuhan chart:

- Menampilkan top regions.
- Menampilkan distribusi loss.
- Menampilkan perbandingan AAL lintas hazard.
- Menampilkan perbandingan loss antar scenario climate/nonclimate.
- Menjaga konten data yang sama dengan filter dashboard.

Acceptance criteria:

- Chart memakai endpoint analitik yang sesuai.
- Chart tidak mengubah konten metrik yang dihitung backend.
- Chart memiliki visual yang profesional, akademis, dan tidak terasa terlalu chart-heavy.
- Chart tetap terbaca pada viewport desktop dan mobile.

### 10.7 Report dan Export

Sistem harus menyediakan:

- Download CSV berdasarkan filter dashboard.
- Generate report berdasarkan hazard, scenario, climate, run, dan region.
- Report preview di frontend.
- Report backend yang dapat menyertakan peta, chart, ringkasan, dan tabel.

Acceptance criteria:

- CSV memakai filter dashboard aktif.
- Generate report dapat dilakukan untuk seluruh wilayah atau region tertentu.
- Download yang membutuhkan auth memakai helper protected download.
- Report menghasilkan file yang dapat dipakai sebagai dokumen analisis.

### 10.8 Admin - Data Management

Admin harus dapat:

- Melihat kesiapan file input raw.
- Melihat ringkasan dataset raw, processed, dan output.
- Preview file data dari folder yang diizinkan.
- Upload data jika flow UI diaktifkan.
- Menghapus file dari folder yang diizinkan.
- Menandai data raw tertentu sebagai aktif.

Acceptance criteria:

- Backend membatasi folder dan nama file yang dapat diakses.
- Admin dapat mengidentifikasi data yang kurang sebelum menjalankan pipeline.
- Preview file tidak membuka akses arbitrary path.

### 10.9 Admin - Process Control

Admin harus dapat:

- Memilih hazard untuk pipeline penuh.
- Menjalankan pipeline full untuk flood.
- Menjalankan pipeline full untuk drought.
- Menjalankan pipeline full untuk multi-hazard.
- Melihat status kesiapan tiga file final.
- Menjalankan load database hanya setelah tiga file final lengkap.

Aturan penting:

- Jalankan Pipeline Penuh tidak menjalankan ETL.
- Muat ke Database Saja tidak memakai hazard yang sedang dipilih.
- Muat ke Database Saja memuat flood, drought, dan multihazard sekaligus.

Acceptance criteria:

- Tombol load database disabled ketika file final belum lengkap.
- Backend mengembalikan 409 jika load database diminta ketika file final belum lengkap.
- Backend menolak run baru jika masih ada run non-stale yang running.

### 10.10 Admin - Pipeline Monitor

Admin harus dapat:

- Melihat status run terbaru.
- Melihat progress pipeline.
- Melihat tahap aktif.
- Melihat pesan terakhir.
- Melihat riwayat run.
- Validasi kelengkapan run.
- Mengaktifkan run sukses.
- Menghapus run yang tidak aktif dan tidak running.
- Menghentikan run yang tersangkut di status running.
- Melihat status metadata run, mengunduh metadata JSON, dan membuat metadata backfill untuk run lama.

Acceptance criteria:

- Run aktif tidak dapat dihapus.
- Run running tidak dapat dihapus sebelum dihentikan.
- Aktivasi run memakai endpoint PATCH.
- Stop run mengubah status monitoring menjadi stopped.
- Dashboard membaca run aktif setelah aktivasi.

### 10.11 Admin - Output Management

Admin harus dapat:

- Melihat daftar file output analisis.
- Preview output.
- Download output.
- Mengidentifikasi file final flood, drought, dan multihazard.

Acceptance criteria:

- Output dibaca dari folder analisis yang diizinkan.
- Nama output dinormalisasi agar mudah dipahami operator.
- Preview menangani file besar dengan batas ukuran yang aman.

### 10.12 Admin - User Management

Admin harus dapat:

- Melihat daftar user.
- Mengubah role user.
- Mengubah status user.

Acceptance criteria:

- Hanya admin yang dapat mengelola user.
- Sistem mencegah kondisi yang membuat tidak ada admin aktif jika aturan tersebut diterapkan di backend.

## 11. Kebutuhan Data

### 11.1 Data Input

Data input pipeline berada di:

```text
backend/data/raw/
```

Struktur wajib:

```text
backend/data/raw/
|-- administrasi/
|   `-- regions.gpkg
|-- exposure/
|   |-- sawah_selected.gpkg
|   `-- totalproduksipadi.csv
`-- hazard/
    |-- flood_r25.tif
    |-- flood_r50.tif
    |-- flood_r100.tif
    |-- flood_r250.tif
    |-- flood_rc25.tif
    |-- flood_rc50.tif
    |-- flood_rc100.tif
    |-- flood_rc250.tif
    |-- drought_r25.tif
    |-- drought_r50.tif
    |-- drought_r100.tif
    |-- drought_r250.tif
    |-- drought_rc25.tif
    |-- drought_rc50.tif
    |-- drought_rc100.tif
    `-- drought_rc250.tif
```

Administrasi:

- File: regions.gpkg.
- Format: GeoPackage.
- Geometri: Polygon atau MultiPolygon.
- CRS: valid.
- Kolom wajib: id_kabkota, kab_kota, prov.

Sawah:

- File: sawah_selected.gpkg.
- Format: GeoPackage.
- Geometri: Polygon atau MultiPolygon.
- CRS: valid.

Produksi padi:

- File: totalproduksipadi.csv.
- Format: CSV UTF-8.
- Kolom wajib: id_kabkota, total_prod.
- Kolom disarankan: kab_kota, prov.

Hazard raster:

- Flood: delapan raster flood.
- Drought: delapan raster drought.
- Multi-hazard tidak membaca raster baru; ia membaca file final flood dan drought.

### 11.2 Data Output

File final wajib:

```text
backend/data/output/analysis/kabkota_flood_final.geojson
backend/data/output/analysis/kabkota_drought_final.geojson
backend/data/output/analysis/kabkota_multihazard_final.geojson
```

ETL/load database hanya boleh berjalan jika ketiga file final tersedia.

### 11.3 Database

Database utama adalah PostgreSQL + PostGIS.

Tabel referensi:

- hazards.
- scenarios.
- return_periods.

Tabel spasial dan produksi:

- regions_adm.
- regions_sawah.
- production.

Tabel hasil analisis:

- losses.
- aal.
- zonal_kabupaten.

Tabel operasional:

- runs.
- app_users.
- password_reset_tokens.

Requirement data integrity:

- losses unik berdasarkan id_kabkota, hazard_id, scenario_id, rp_id, dan run_id.
- aal unik berdasarkan id_kabkota, hazard_id, scenario_id, dan run_id.
- zonal_kabupaten unik berdasarkan id_kabkota, hazard_id, scenario_id, rp_id, dan run_id.
- Dashboard harus memakai run aktif atau fallback run terbaru.

## 12. Pipeline Geospasial

Pipeline terdiri dari empat tahap:

### 12.1 Preprocess

Fungsi:

- Membaca raster hazard.
- Reproject raster ke CRS kerja.
- Normalisasi raster drought jika diperlukan.
- Menyiapkan vector sawah dan administrasi.
- Menghasilkan sawah_admin_intersection.geojson.

### 12.2 Zonal Statistics

Fungsi:

- Menghitung nilai rata-rata raster hazard pada wilayah sawah-administrasi.
- Menghasilkan file zonal flood dan drought.

Output utama:

```text
backend/data/output/zonal/flood_stats.geojson
backend/data/output/zonal/drought_stats.geojson
```

### 12.3 Analysis

Flood:

- Membaca flood_stats.geojson.
- Menghitung LOP flood.
- Menggabungkan produksi padi.
- Menghitung loss per return period dan scenario.
- Menghitung AAL.
- Menulis kabkota_flood_final.geojson.

Drought:

- Membaca drought_stats.geojson.
- Menghitung DI.
- Menghitung LOP drought.
- Menggabungkan produksi padi.
- Menghitung loss.
- Menghitung AAL.
- Menulis kabkota_drought_final.geojson.

Multi-hazard:

- Membaca file final flood dan drought.
- Menggabungkan loss flood dan drought.
- Menghitung loss multi-hazard.
- Menghitung AAL multi-hazard.
- Menulis kabkota_multihazard_final.geojson.

### 12.4 ETL / Load Database

Fungsi:

- Memuat regions_adm.
- Memuat regions_sawah.
- Memuat production.
- Memuat losses.
- Memuat aal.
- Memuat zonal_kabupaten.
- Memuat metadata runs.

Requirement:

- ETL hanya berjalan setelah tiga file final tersedia.
- ETL dipanggil sebagai mode web.
- Hazard pada mode web hanya label internal; loader membaca semua file final.

## 13. API Requirements

### 13.1 Auth

Endpoint:

- POST /api/register.
- POST /api/login.
- GET /api/me.
- POST /api/logout.
- POST /api/forgot-password.
- POST /api/reset-password.

### 13.2 Run dan Analitik

Endpoint:

- GET /api/runs/latest.
- GET /api/aal-summary.
- GET /api/aal-summary-all-hazards.
- GET /api/loss-summary.
- GET /api/loss-summary-compare-climate.
- GET /api/top-regions.
- GET /api/hazard-breakdown.

### 13.3 Layer Values

Endpoint:

- GET /api/layers/values/loss.
- GET /api/layers/values/aal.
- GET /api/layers/values/hazard.
- GET /api/layers/values/production.
- GET /api/layers/values/regions.

Requirement:

- Values endpoint mengembalikan atribut tanpa geometri.
- Response harus cukup untuk klasifikasi warna, overlay, chart, dropdown, dan report context.

### 13.4 Vector Tiles

Endpoint:

- GET /api/tiles/loss/{z}/{x}/{y}.
- GET /api/tiles/aal/{z}/{x}/{y}.
- GET /api/tiles/hazard/{z}/{x}/{y}.
- GET /api/tiles/production/{z}/{x}/{y}.
- GET /api/tiles/regions/{z}/{x}/{y}.

Utility endpoint:

- GET /api/tiles/cache/stats.
- POST /api/tiles/cache/clear.
- GET /api/tiles/debug/losses.

Requirement:

- Response tile memakai Content-Type application/x-protobuf.
- Tile query harus mendukung filter hazard, scenario, climate, dan run_id.
- Tile backend dapat memakai cache in-memory untuk request berulang.

### 13.5 Report dan Download

Endpoint:

- GET /api/download-csv.
- GET /api/generate-report-v2.

Requirement:

- Endpoint menerima parameter hazard, scenario, climate, run_id, dan region jika tersedia.
- Report harus bisa dipakai untuk dokumentasi analisis.

### 13.6 Admin

Pipeline status:

- GET /api/admin/run-status.
- GET /api/admin/process-status.
- GET /api/admin/runs.
- GET /api/admin/runs/active.
- GET /api/admin/runs/{run_id}/validate.
- GET /api/admin/runs/{run_id}/metadata.
- GET /api/admin/runs/{run_id}/metadata/download.
- POST /api/admin/runs/{run_id}/metadata/backfill.
- PATCH /api/admin/runs/{run_id}/activate.
- PATCH /api/admin/runs/{run_id}/stop.
- DELETE /api/admin/runs/{run_id}.

Process control:

- POST /api/admin/start-pipeline.
- GET /api/admin/final-analysis-status.
- POST /api/admin/load-database.
- GET /api/admin/dependencies.

Data dan output:

- GET /api/admin/data/readiness.
- GET /api/admin/data.
- GET /api/admin/data/preview.
- POST /api/admin/upload-data.
- POST /api/admin/data/delete.
- POST /api/admin/data/set-active.
- GET /api/admin/outputs.
- GET /api/admin/outputs/preview.
- GET /api/admin/outputs/download.

User:

- GET /api/admin/users.
- PATCH /api/admin/users/{user_id}/role.
- PATCH /api/admin/users/{user_id}/status.

## 14. UX dan UI Requirements

### 14.1 Karakter Visual

PADIS harus terasa:

- Profesional.
- Akademis.
- Geospasial.
- Ringkas.
- Terpercaya.
- Tidak generik seperti template dashboard glass.

### 14.2 Dashboard

Requirement desain:

- Peta menjadi fokus utama.
- Background dashboard mendukung fokus ke peta, bukan bersaing dengan peta.
- Filter menyatu dengan kontainer peta.
- Chart terasa sebagai analitik pendukung, bukan dashboard lain di dalam dashboard.
- Panel layer dan legend harus terasa seperti fitur peta yang natural.
- Ringkasan cepat harus mudah dibaca tanpa mengambil terlalu banyak ruang.

### 14.3 Admin

Requirement desain:

- UI admin harus padat, jelas, dan operasional.
- Status pipeline harus mudah dipahami oleh operator.
- Tombol berisiko seperti delete harus memiliki konfirmasi.
- Disabled state harus menjelaskan penyebab aksi tidak tersedia.

### 14.4 Responsiveness

Requirement:

- Dashboard tetap usable di desktop, tablet, dan mobile.
- Filter tidak boleh merusak layout pada viewport kecil.
- Teks dalam tombol, kartu, dan panel tidak boleh overflow.
- Peta tetap mendapat area visual yang memadai.

## 15. Non-Functional Requirements

### 15.1 Performance

- Peta harus memakai MVT agar lebih ringan dibanding GeoJSON besar.
- Endpoint values harus menghindari geometri besar.
- Tile cache dapat digunakan untuk request berulang.
- Dashboard tidak boleh melakukan reload penuh hanya karena filter berubah.
- Chart dan overlay harus mengambil data sesuai kebutuhan.

Target awal:

- Dashboard initial usable render dalam waktu yang wajar pada koneksi lokal/deploy standar.
- Perubahan filter tidak membuat UI freeze.
- Tile dapat dimuat bertahap sesuai viewport dan zoom.

### 15.2 Reliability

- Pipeline tidak berjalan di thread request Flask.
- Backend harus menolak run baru ketika run aktif masih running dan belum stale.
- ETL harus menolak load database jika file final belum lengkap.
- Run status harus tersimpan di tabel runs.
- Dashboard harus memiliki fallback ketika run aktif tidak tersedia.

### 15.3 Security

- Admin endpoint wajib membutuhkan JWT admin.
- Password disimpan sebagai hash.
- Reset password memakai token hash, expiry, dan used_at.
- CORS production harus dibatasi ke frontend origin yang valid.
- Folder preview/upload/delete harus dibatasi.
- Secret key dan database URL tidak boleh disimpan di frontend.

### 15.4 Maintainability

- Frontend memakai helper API terpusat.
- Backend memakai blueprint per domain.
- Pipeline dipisah menjadi module preprocess, zonal, analysis, dan ETL.
- Dokumentasi teknis disimpan di folder docs.
- Migration SQL disimpan di backend/migrations.

### 15.5 Observability

- Pipeline harus mencatat status, step, progress, message, operator, dan source.
- Admin UI harus membaca status run secara berkala.
- Backend menyediakan health check.
- Tile cache memiliki endpoint stats dan clear.

### 15.6 Accessibility

- Navigasi utama harus jelas.
- Tombol harus memiliki label yang dapat dipahami.
- Warna risiko tidak boleh menjadi satu-satunya pembeda tanpa legend.
- Focus state dan keyboard access perlu dijaga untuk form dan kontrol penting.

## 16. Success Metrics

Metrik produk:

- Pengguna dapat menemukan wilayah prioritas risiko dalam waktu singkat.
- Pengguna dapat mengganti hazard, scenario, return period, dan wilayah tanpa kebingungan.
- Admin dapat menjalankan urutan flood, drought, multi-hazard, dan load database tanpa langkah manual tambahan yang rawan salah.
- Dashboard konsisten membaca run aktif.
- Report dan CSV berhasil dihasilkan dari filter dashboard.

Metrik teknis:

- Endpoint health check sukses pada environment deploy.
- Tile endpoint regions tidak error fatal.
- Lint/build frontend dapat berjalan.
- Compile backend dapat berjalan.
- ETL hanya berjalan jika tiga file final lengkap.
- Migration database dapat diterapkan sesuai urutan.

## 17. Acceptance Criteria End-to-End

### 17.1 Flow Dashboard User

1. User membuka dashboard.
2. Sistem mengambil run aktif melalui /api/runs/latest.
3. User memilih hazard, climate scenario, return period, dan wilayah.
4. Sistem mengambil layer values dan tile sesuai filter.
5. Peta memperbarui warna wilayah.
6. Ringkasan cepat memperbarui total loss, perubahan, dan prioritas.
7. Chart memperbarui data analitik.
8. User memilih wilayah pada peta atau dropdown.
9. Panel wilayah terpilih muncul.
10. User dapat mengunduh CSV atau membuat laporan.

### 17.2 Flow Operator Pipeline

1. Admin login.
2. Admin membuka Process Control.
3. Admin menjalankan full flood.
4. Admin menjalankan full drought.
5. Admin menjalankan full multi-hazard.
6. Sistem menampilkan status tiga file final.
7. Tombol load database aktif ketika file lengkap.
8. Admin menjalankan Muat ke Database Saja.
9. Admin memantau ETL di Pipeline Monitor.
10. Admin memvalidasi run.
11. Admin mengaktifkan run sukses.
12. Dashboard menampilkan data dari run aktif.

### 17.3 Flow Report

1. User berada di dashboard dengan filter aktif.
2. User menekan Buat Laporan.
3. Frontend membuka preview report.
4. Backend menerima parameter filter.
5. Report berisi konteks hazard, scenario, climate, run, region jika ada, peta, chart, dan ringkasan.
6. User dapat mengunduh report.

## 18. Environment dan Deployment

### 18.1 Backend

Backend dapat dijalankan di Railway.

Environment variable:

- DATABASE_URL.
- SECRET_KEY.
- JWT_SECRET_KEY.
- FRONTEND_ORIGINS.
- LOG_LEVEL opsional.

Start command production:

```text
cd backend && gunicorn run:app
```

Health check:

```text
GET /health
```

### 18.2 Frontend

Frontend dapat dijalankan di Vercel atau Railway.

Environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://url-backend-production
```

Production tidak boleh memakai localhost sebagai API base URL.

### 18.3 Database

Database memakai Supabase PostgreSQL + PostGIS.

Requirement:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Migration manual:

1. 001_mvt_indexes.sql.
2. 002_runs_tracking_columns.sql.
3. 003_runs_created_at_index.sql.
4. 004_runs_active_management.sql.
5. 005_password_reset_tokens.sql.

### 18.4 Pipeline Production

Karena proses geospasial berat, pipeline production disarankan berjalan:

- di mesin operator lokal yang memiliki data lengkap, atau
- di container pipeline khusus, atau
- dipisah dari backend web production.

Backend production sebaiknya fokus pada serving API dashboard, tiles, auth, report, dan admin monitoring.

## 19. Risiko dan Mitigasi

### 19.1 Risiko Data Tidak Lengkap

Risiko:

- Pipeline gagal karena raster, vector, atau CSV tidak tersedia.
- ETL menghasilkan data tidak lengkap.

Mitigasi:

- Admin UI menampilkan data readiness.
- final-analysis-status mengecek tiga file final.
- load-database menolak proses jika file belum lengkap.

### 19.2 Risiko Run Tidak Konsisten

Risiko:

- Dashboard membaca layer dari run yang berbeda.
- Multi-hazard memakai flood dan drought dari run berbeda.

Mitigasi:

- Dashboard memakai run_id aktif.
- Pipeline multi-hazard menolak input stale jika flood dan drought terlihat tidak sejalan.
- Admin dapat validasi run sebelum aktivasi.

### 19.3 Risiko Performa Peta

Risiko:

- GeoJSON besar membuat dashboard lambat.

Mitigasi:

- Geometri memakai MVT.
- Values endpoint tanpa geometri.
- Tile cache in-memory.

### 19.4 Risiko Keamanan Admin

Risiko:

- Endpoint admin diakses user tanpa otorisasi.
- File system diekspos melalui preview/download.

Mitigasi:

- admin_required pada endpoint admin.
- Folder dan nama file dibatasi.
- JWT secret kuat.
- CORS production dibatasi.

### 19.5 Risiko Kompleksitas Pipeline

Risiko:

- Operator salah urutan menjalankan pipeline.

Mitigasi:

- Admin UI memberikan workflow Process Control.
- Tombol load database dipisah dari pipeline penuh.
- Dokumentasi pipeline-operation tersedia.

## 20. Roadmap

### Fase 1 - Stabilitas MVP

- Pastikan dashboard membaca run aktif secara konsisten.
- Pastikan semua endpoint utama stabil.
- Pastikan flow flood, drought, multi, dan load database dapat dijalankan dari Admin UI.
- Pastikan report dan CSV sesuai filter dashboard.

### Fase 2 - UX dan Analitik

- Perkuat hierarchy dashboard agar peta menjadi pusat.
- Rapikan chart agar lebih ringan, akademis, dan tidak chart-heavy.
- Perbaiki empty state, loading state, dan error state.
- Tambahkan insight tekstual yang berbasis data jika dibutuhkan.

### Fase 3 - Operasional dan Audit

- Perluas validasi data input.
- Perjelas audit trail run dan output.
- Tambahkan log pipeline yang lebih mudah dibaca operator.
- Tambahkan dokumentasi troubleshooting berbasis kasus nyata.

### Fase 4 - Skalabilitas

- Evaluasi cache tile yang lebih persisten.
- Evaluasi background worker untuk pipeline.
- Evaluasi object storage untuk output besar.
- Evaluasi observability production.

### Fase 5 - Ekstensi Produk

- Tambahkan hazard baru jika metodologi dan data tersedia.
- Tambahkan fitur komparasi antar run.
- Tambahkan mode cerita laporan untuk stakeholder.
- Tambahkan ekspor format tambahan bila dibutuhkan.

## 21. Pertanyaan Terbuka

- Apakah dashboard publik harus dapat diakses tanpa login untuk semua fitur, atau sebagian fitur seperti report perlu login?
- Apakah data produksi padi memakai satu tahun tetap atau perlu dukungan multi-year di UI?
- Apakah AAL dan loss perlu ditampilkan dalam satuan tetap atau mengikuti format compact Rupiah di semua konteks?
- Apakah report final ditargetkan sebagai HTML, PDF, XLSX, atau kombinasi format?
- Apakah pipeline production akan tetap lokal/operator atau dipindahkan ke worker/container khusus?
- Apakah ada standar institusi untuk palet warna risiko dan klasifikasi hazard yang wajib diikuti?
- Apakah user role perlu diperluas di luar admin dan user, misalnya operator, reviewer, atau viewer?

## 22. Referensi Internal Project

Dokumen:

- README.md.
- docs/architecture.md.
- docs/api.md.
- docs/frontend.md.
- docs/database.md.
- docs/data-requirements.md.
- docs/pipeline.md.
- docs/pipeline-operation.md.
- docs/deployment.md.
- docs/padis-dev-commands.md.

Kode utama:

- backend/app/__init__.py.
- backend/app/routes/.
- backend/scripts/main.py.
- backend/scripts/pipeline/.
- backend/scripts/analysis/.
- backend/scripts/etl/.
- frontend/src/app/(main)/dashboard/page.tsx.
- frontend/src/components/map/.
- frontend/src/components/dashboard/.
- frontend/src/components/charts/.
- frontend/src/components/report/.
- frontend/src/app/(admin)/admin/.

Graphify:

- frontend/graphify-out/GRAPH_REPORT.md.
- backend/graphify-out/GRAPH_REPORT.md.

## 23. Lampiran Ringkas Stack

Frontend:

- Next.js 16.1.7.
- React 19.2.3.
- TypeScript.
- Tailwind CSS 4.
- Leaflet.
- React Leaflet.
- Leaflet.VectorGrid.
- Recharts.
- simple-statistics.
- chroma-js.
- lucide-react.

Backend:

- Flask 3.1.3.
- Python 3.11.
- JWT auth.
- Flask-CORS.
- Gunicorn untuk production.

Database:

- PostgreSQL.
- PostGIS.
- Supabase.

Geospasial:

- GeoPandas.
- Rasterio.
- Fiona.
- Shapely.
- PyProj.

Deployment:

- Railway untuk backend.
- Vercel atau Railway untuk frontend.
- Supabase untuk database.
