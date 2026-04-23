import sys
import time
import json

from backend.scripts.pipeline.orchestrator import run_padis_pipeline
from backend.scripts.config.settings import DEBUG, VERBOSE


def pretty_print_results(results: dict):
    print("\n=== HASIL PIPELINE ===")

    for stage, value in results.items():
        print(f"\n[{stage.upper()}]")

        if isinstance(value, list):
            for item in value:
                hazard = item.get("hazard", "-")
                status = item.get("status", "-")
                output = item.get("output", "-")

                print(f"  - {hazard}: {status}")
                if VERBOSE:
                    print(f"    output: {output}")
        else:
            print(f"  {value}")


def main():
    start = time.time()

    try:
        result = run_padis_pipeline()

        elapsed = time.time() - start

        if VERBOSE:
            pretty_print_results(result["results"])

        print(f"\n⏱️ Total waktu: {elapsed:.2f} detik")
        print("🎉 Pipeline berhasil")

        # optional: save log json
        if DEBUG:
            with open("pipeline_result.json", "w") as f:
                json.dump(result, f, indent=2)

        sys.exit(0)

    except Exception as e:
        print("\n❌ PIPELINE GAGAL")
        print(f"Error: {e}")

        sys.exit(1)


if __name__ == "__main__":
    main()
