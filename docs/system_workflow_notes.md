## Catatan Cakupan Data
- Data raster banjir yang digunakan pada tahap pengembangan saat ini masih mencakup Pulau Jawa.
- Pipeline analisis PADIS dirancang untuk dapat memproses data raster banjir skala nasional tanpa perubahan logika utama.
- Ketika raster banjir nasional tersedia, sistem akan menjalankan ulang preprocessing, zonal statistics, agregasi, perhitungan LOP, dan loss secara otomatis atau melalui trigger admin.