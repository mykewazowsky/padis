import os
import requests
import logging
from urllib.parse import urlparse, parse_qs
from requests.auth import HTTPBasicAuth

# Setup logging agar mempermudah monitoring di terminal
logger = logging.getLogger(__name__)

# --- Helper Functions ---
def get_env(name: str, default: str = "") -> str:
    return os.getenv(name, default)

def get_auth():
    return HTTPBasicAuth(get_env("GEOSERVER_USER"), get_env("GEOSERVER_PASSWORD"))

def get_geoserver_url():
    return get_env("GEOSERVER_URL").rstrip("/")

def get_workspace():
    return get_env("GEOSERVER_WORKSPACE", "padis")

def get_store():
    return get_env("GEOSERVER_STORE", "padis_postgis")

def _headers():
    return {"Content-Type": "application/json"}

# --- Core Logic ---

def parse_database_url():
    database_url = get_env("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL belum di-set di environment")

    parsed = urlparse(database_url)
    query = parse_qs(parsed.query)

    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "schema": query.get("currentSchema", ["public"])[0],
        "sslmode": query.get("sslmode", ["disable"])[0], # Ubah default ke disable jika lokal
    }

def ensure_workspace():
    url = f"{get_geoserver_url()}/rest/workspaces"
    workspace = get_workspace()
    
    # Cek dulu apakah workspace sudah ada (GET) sebelum POST
    check = requests.get(f"{url}/{workspace}", auth=get_auth())
    if check.status_code == 200:
        return # Sudah ada, tidak perlu post

    r = requests.post(url, json={"workspace": {"name": workspace}}, auth=get_auth(), headers=_headers())
    if r.status_code not in (201, 409):
        raise RuntimeError(f"Gagal create workspace: {r.text}")

def ensure_postgis_store(schema: str | None = None):
    ensure_workspace()
    ws = get_workspace()
    store = get_store()
    db = parse_database_url()
    
    url = f"{get_geoserver_url()}/rest/workspaces/{ws}/datastores"
    
    # Cek apakah datastore sudah ada
    check = requests.get(f"{url}/{store}", auth=get_auth())
    if check.status_code == 200:
        return

    payload = {
        "dataStore": {
            "name": store,
            "connectionParameters": {
                "entry": [
                    {"@key": "dbtype", "$": "postgis"},
                    {"@key": "host", "$": db["host"]},
                    {"@key": "port", "$": str(db["port"])},
                    {"@key": "database", "$": db["database"]},
                    {"@key": "user", "$": db["user"]},
                    {"@key": "passwd", "$": db["password"]},
                    {"@key": "schema", "$": schema or db["schema"]},
                    {"@key": "sslmode", "$": db["sslmode"]},
                    {"@key": "Expose primary keys", "$": "true"}
                ]
            }
        }
    }
    r = requests.post(url, json=payload, auth=get_auth(), headers=_headers())
    if r.status_code not in (201, 409):
        raise RuntimeError(f"Gagal create datastore: {r.text}")

def publish_featuretype(native_name: str, layer_name: str | None = None, srs: str = "EPSG:4326", schema: str | None = None):
    ensure_postgis_store(schema=schema)
    
    ws = get_workspace()
    st = get_store()
    published_name = layer_name or native_name
    url = f"{get_geoserver_url()}/rest/workspaces/{ws}/datastores/{st}/featuretypes"

    # Jika layer sudah ada (409), kita hapus dulu agar datanya terupdate (re-publish)
    # Sangat berguna untuk data Capstone yang sering di-running ulang
    requests.delete(f"{url}/{published_name}?recurse=true", auth=get_auth())

    payload = {
        "featureType": {
            "name": published_name,
            "nativeName": native_name,
            "title": published_name,
            "srs": srs,
            "enabled": True,
            # Menambahkan instruksi agar GeoServer menghitung ulang Bounding Box dari data PostGIS
            "projectionPolicy": "FORCE_DECLARED" 
        }
    }

    r = requests.post(url, json=payload, auth=get_auth(), headers=_headers())
    if r.status_code != 201:
        raise RuntimeError(f"Gagal publish layer {published_name}: {r.text}")

    return {
        "workspace": ws,
        "layer_name": published_name,
        "qualified_name": f"{ws}:{published_name}",
        "wms_url": f"{get_geoserver_url()}/{ws}/wms"
    }