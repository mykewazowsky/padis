from flask import Blueprint, jsonify, request
import logging # Tambahkan logging untuk memantau error di terminal
from app.services.geoserver_service import publish_featuretype

# Inisialisasi logger
logger = logging.getLogger(__name__)

admin_geoserver_bp = Blueprint(
    "admin_geoserver_bp",
    __name__,
    url_prefix="/api/admin/geoserver",
)

@admin_geoserver_bp.route("/publish", methods=["POST"])
def publish_layer():
    # Gunakan silent=False agar kita tahu jika JSON yang dikirim rusak (Malformed JSON)
    body = request.get_json() or {}

    # 1. Validasi: native_name (nama tabel PostGIS) WAJIB ada
    native_name = body.get("native_name")
    if not native_name:
        return jsonify({"error": "Parameter 'native_name' (nama tabel) wajib diisi"}), 400

    # 2. Pengaturan Parameter (Layer name default ke native_name jika kosong)
    layer_name = body.get("layer_name", native_name)
    srs = body.get("srs", "EPSG:4326")
    schema = body.get("schema", "public")

    try:
        # Menjalankan fungsi publikasi ke GeoServer
        result = publish_featuretype(
            native_name=native_name,
            layer_name=layer_name,
            srs=srs,
            schema=schema,
        )
        
        # Log keberhasilan untuk admin
        logger.info(f"Layer {layer_name} berhasil dipublikasikan dari tabel {native_name}")
        
        return jsonify({
            "status": "success",
            "message": f"Layer '{layer_name}' berhasil dipublikasikan",
            "details": result
        }), 201

    except RuntimeError as e:
        # Menangani error spesifik dari geoserver_service (misal: gagal konek ke GS)
        logger.error(f"GeoServer Error: {str(e)}")
        return jsonify({"error": "Gagal berkomunikasi dengan GeoServer", "message": str(e)}), 502
    
    except Exception as e:
        # Menangani error umum lainnya
        logger.error(f"Unexpected Error: {str(e)}")
        return jsonify({"error": "Terjadi kesalahan internal server", "message": str(e)}), 500