## Pipeline Execution with Docker

Untuk mempermudah penggunaan oleh mitra dan memastikan konsistensi environment, pipeline PADIS dijalankan menggunakan Docker.

### Tujuan

* Menghindari instalasi manual dependency (GDAL, dll)
* Menjamin konsistensi hasil antar mesin
* Mempermudah penggunaan oleh operator non-teknis

---

### Build Image

```bash
docker build -t padis-pipeline .
```

---

### Run Pipeline

```bash
docker run --rm \
  -e DATABASE_URL=<your_database_url> \
  -e OPERATOR_NAME=<operator_name> \
  padis-pipeline \
  python scripts/main.py --mode full --hazard flood
```

---

### Menggunakan Volume Data

Jika data berada di local machine:

```bash
docker run --rm \
  -v /path/to/data:/data \
  -e DATABASE_URL=<your_database_url> \
  padis-pipeline \
  python scripts/main.py --input /data
```

---

### Catatan

* Data besar (±200GB) tidak dimasukkan ke dalam container
* Pipeline tetap berjalan secara lokal
* Hasil akan langsung disimpan ke database Supabase