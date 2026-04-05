import os
from urllib.parse import urlparse, parse_qs

import requests
from requests.auth import HTTPBasicAuth


def get_env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def get_auth():
    return HTTPBasicAuth(
        get_env("GEOSERVER_USER"),
        get_env("GEOSERVER_PASSWORD"),
    )


def get_geoserver_url():
    return get_env("GEOSERVER_URL").rstrip("/")


def get_workspace():
    return get_env("GEOSERVER_WORKSPACE", "padis")


def get_store():
    return get_env("GEOSERVER_STORE", "padis_postgis")


def get_public_wms():
    return get_env("GEOSERVER_PUBLIC_WMS", "")


def get_public_wfs():
    return get_env("GEOSERVER_PUBLIC_WFS", "")


def get_database_url():
    return get_env("DATABASE_URL", "")


def _headers():
    return {"Content-Type": "application/json"}


def _ok(status_code: int) -> bool:
    return status_code in (200, 201, 202, 409)


def parse_database_url():
    database_url = get_database_url()
    if not database_url:
        raise ValueError("DATABASE_URL belum di-set")

    parsed = urlparse(database_url)
    query = parse_qs(parsed.query)

    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "schema": query.get("currentSchema", ["public"])[0],
        "sslmode": query.get("sslmode", ["require"])[0],
    }


def ensure_workspace():
    geoserver_url = get_geoserver_url()
    workspace = get_workspace()

    if not geoserver_url:
        raise ValueError("GEOSERVER_URL belum di-set")

    url = f"{geoserver_url}/rest/workspaces"
    payload = {"workspace": {"name": workspace}}

    r = requests.post(
        url,
        json=payload,
        auth=get_auth(),
        headers=_headers(),
        timeout=30,
    )
    if not _ok(r.status_code):
        raise RuntimeError(f"Gagal create workspace: {r.status_code} - {r.text}")


def ensure_postgis_store(schema: str | None = None):
    ensure_workspace()

    geoserver_url = get_geoserver_url()
    workspace = get_workspace()
    store = get_store()
    db = parse_database_url()

    schema_name = schema or db["schema"] or "public"

    url = f"{geoserver_url}/rest/workspaces/{workspace}/datastores"

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
                    {"@key": "schema", "$": schema_name},
                    {"@key": "sslmode", "$": db["sslmode"]},
                    {"@key": "Expose primary keys", "$": "true"},
                    {"@key": "validate connections", "$": "true"},
                    {"@key": "fetch size", "$": "1000"},
                ]
            },
        }
    }

    r = requests.post(
        url,
        json=payload,
        auth=get_auth(),
        headers=_headers(),
        timeout=30,
    )
    if not _ok(r.status_code):
        raise RuntimeError(f"Gagal create datastore: {r.status_code} - {r.text}")


def publish_featuretype(
    native_name: str,
    layer_name: str | None = None,
    srs: str = "EPSG:4326",
    schema: str | None = None,
):
    ensure_postgis_store(schema=schema)

    geoserver_url = get_geoserver_url()
    workspace = get_workspace()
    store = get_store()
    public_wms = get_public_wms()
    public_wfs = get_public_wfs()

    published_name = layer_name or native_name
    url = (
        f"{geoserver_url}/rest/workspaces/{workspace}"
        f"/datastores/{store}/featuretypes"
    )

    payload = {
        "featureType": {
            "name": published_name,
            "nativeName": native_name,
            "title": published_name,
            "srs": srs,
            "enabled": True,
        }
    }

    r = requests.post(
        url,
        json=payload,
        auth=get_auth(),
        headers=_headers(),
        timeout=30,
    )
    if not _ok(r.status_code):
        raise RuntimeError(f"Gagal publish feature type: {r.status_code} - {r.text}")

    return {
        "workspace": workspace,
        "store": store,
        "layer_name": published_name,
        "qualified_name": f"{workspace}:{published_name}",
        "wms_url": public_wms or f"{geoserver_url}/{workspace}/wms",
        "wfs_url": public_wfs or f"{geoserver_url}/{workspace}/wfs",
    }