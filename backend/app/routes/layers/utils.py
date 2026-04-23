import json

def build_geojson(rows, value_key):
    features = []

    for row in rows:
        if not row.geometry:
            continue

        features.append({
            "type": "Feature",
            "geometry": json.loads(row.geometry),
            "properties": {
                "id_kabkota": row.id_kabkota,
                "kab_kota": getattr(row, "kab_kota", None),
                "prov": getattr(row, "prov", None),
                value_key: float(getattr(row, value_key) or 0)
            }
        })

    return {"type": "FeatureCollection", "features": features}


def get_scenario_id(climate):
    return 1 if climate == "nonclimate" else 2


def get_rp_value(scenario):
    return int(scenario.replace("rp", ""))
