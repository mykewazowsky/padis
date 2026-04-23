import os
from scripts.config.analysis_registry import ANALYSIS_REGISTRY


def run_analysis(zonal_results: list[dict]) -> list[dict]:
    """
    Menjalankan setiap pipeline analysis berdasarkan ANALYSIS_REGISTRY.

    FIX #8: Registry sekarang berisi { hazard: callable(zonal_path) -> output_path }
    bukan list of functions. Juga menambahkan multihazard sebagai pass terpisah
    setelah flood dan drought selesai.
    """
    print("=== ANALYSIS PIPELINE ===")

    results = []
    completed = {}  # hazard → output_path, untuk referensi multihazard

    # ===============================
    # PASS 1: flood & drought
    # ===============================
    for item in zonal_results:
        hazard = item["hazard"]
        input_path = item["output"]

        if hazard == "multihazard":
            # multihazard dijalankan di pass 2, skip dulu
            continue

        print(f"\n[ANALYSIS] {hazard.upper()}")

        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input zonal tidak ditemukan: {input_path}")

        if hazard not in ANALYSIS_REGISTRY:
            print(f"⚠️  Tidak ada analysis untuk '{hazard}', skip")
            continue

        try:
            pipeline_fn = ANALYSIS_REGISTRY[hazard]
            output_path = pipeline_fn(input_path)

            completed[hazard] = output_path
            results.append({
                "hazard": hazard,
                "output": output_path,
                "status": "success",
            })

        except Exception as e:
            print(f"❌ Analysis {hazard} gagal: {e}")
            raise

    # ===============================
    # PASS 2: multihazard
    # Dijalankan setelah flood & drought confirmed selesai
    # ===============================
    if "multihazard" in ANALYSIS_REGISTRY:
        print("\n[ANALYSIS] MULTIHAZARD")

        missing = [h for h in ("flood", "drought") if h not in completed]
        if missing:
            raise RuntimeError(
                f"Multihazard membutuhkan {missing} selesai lebih dulu. "
                f"Tambahkan hazard tersebut ke HAZARDS di config/hazard.py"
            )

        try:
            # zonal_path dummy — multihazard membaca dari OUTPUT_ANALYSIS_DIR
            pipeline_fn = ANALYSIS_REGISTRY["multihazard"]
            output_path = pipeline_fn("")

            results.append({
                "hazard": "multihazard",
                "output": output_path,
                "status": "success",
            })

        except Exception as e:
            print(f"❌ Analysis multihazard gagal: {e}")
            raise

    print("\n✅ Semua analysis selesai")
    return results
