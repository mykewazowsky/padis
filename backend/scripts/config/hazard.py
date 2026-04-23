HAZARDS = [
    {
        "name": "flood",
        "prefix": "flood_",          # FIX #5: prefix dengan underscore, tidak distrip
        "suffix": "_reproj.tif",
        "normalize": False,
        "analysis": "flood",
    },
    {
        "name": "drought",
        "prefix": "drought_",
        "suffix": "_norm.tif",
        "normalize": True,
        "analysis": "drought",
    },
    # FIX #9: multihazard didaftarkan agar analysis_pipeline tahu ada pass ke-2
    # Tidak memiliki raster sendiri — dihitung dari hasil flood & drought
    {
        "name": "multihazard",
        "prefix": None,
        "suffix": None,
        "normalize": False,
        "analysis": "multihazard",
        "derived": True,             # flag: tidak punya raster langsung
    },
]

# Hanya hazard dengan raster sendiri yang diproses di zonal step
RASTER_HAZARDS = [h for h in HAZARDS if not h.get("derived", False)]
