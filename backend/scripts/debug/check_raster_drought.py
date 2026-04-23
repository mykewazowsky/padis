import os
import numpy as np
import rasterio


def check_raster(path):
    print("\n" + "=" * 100)
    print(f"📂 FILE: {path}")
    print("=" * 100)

    try:
        with rasterio.open(path) as src:
            data = src.read(1)

            # handle nodata
            if src.nodata is not None:
                data = np.where(data == src.nodata, np.nan, data)

            valid = data[~np.isnan(data)]

            print(f"CRS           : {src.crs}")
            print(f"Shape         : {data.shape}")
            print(f"Resolution    : {src.res}")
            print(f"Nodata        : {src.nodata}")

            if valid.size == 0:
                print("❌ Semua pixel NaN")
                return

            print("\nSTATISTIK:")
            print(f"Min           : {np.min(valid):.6f}")
            print(f"Max           : {np.max(valid):.6f}")
            print(f"Mean          : {np.mean(valid):.6f}")
            print(f"Std           : {np.std(valid):.6f}")

            zero_count = np.sum(valid == 0)
            print(f"Jumlah pixel  : {valid.size}")
            print(f"Zero count    : {zero_count}")
            print(f"% Zero        : {zero_count / valid.size * 100:.2f}%")

    except Exception as e:
        print(f"❌ ERROR: {e}")


def main():
    base_dir = r"D:\01. Project\Kuliah\TEKNIK GEODESI DAN GEOMATIKA\Capstone\PADIS\backend\data\processed\hazard"

    files = [f for f in os.listdir(base_dir) if f.endswith("_norm.tif")]

    for f in files:
        path = os.path.join(base_dir, f)
        check_raster(path)


if __name__ == "__main__":
    main()