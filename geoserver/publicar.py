"""Pasos 12 a 16 y permisos del 18: publica en GeoServer las capas de PostGIS mediante la API REST.

Crea el workspace "tpi" y los stores "ign" y "edicion" si no existen, y publica todas las
tablas que todavía no estén publicadas. Lo que ya existe no se modifica, así que se puede
ejecutar varias veces. Los estilos de geoserver/estilos/ se suben (o se actualizan) siempre
y se asignan como estilo por defecto de la capa con el mismo nombre.

Uso: docker compose run --rm publicar
"""

import base64
import json
import os
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

GEOSERVER = os.environ["GEOSERVER_URL"].rstrip("/")
USUARIO = os.environ["GEOSERVER_ADMIN_USER"]
CLAVE = os.environ["GEOSERVER_ADMIN_PASSWORD"]
DATOS = Path("/datos")
ESTILOS = Path(__file__).parent / "estilos"

WORKSPACE = "tpi"
NAMESPACE_URI = "https://github.com/matiasgzlez/TPI-GIS"
STORES = {
    "ign": "Capas originales del SIG IGN 250",
    "edicion": "Capas propias del TPI (editables)",
}
TITULOS_EDICION = {
    "obras_rn11": ("Obras de mantenimiento RN11", "Intervenciones de mantenimiento sobre la RN11 en Chaco, cargadas desde el visor web"),
}
# Las capas de edición arrancan vacías: sin una extensión fija GeoServer usaría 0,0.
# Extensión de la provincia del Chaco en ign.provincias, redondeada hacia afuera.
EXTENSION_CHACO = {"minx": -63.5, "miny": -28.1, "maxx": -58.3, "maxy": -24.0, "crs": "EPSG:4326"}


def pedir(metodo, ruta, cuerpo=None, sld=None):
    """Hace un pedido a la API REST y devuelve (código HTTP, JSON o None).

    El cuerpo va como JSON, salvo que se pase un SLD (bytes), que va como XML.
    """
    if sld is not None:
        datos, tipo = sld, "application/vnd.ogc.sld+xml"
    elif cuerpo is not None:
        datos, tipo = json.dumps(cuerpo).encode(), "application/json"
    else:
        datos, tipo = None, None
    pedido = urllib.request.Request(f"{GEOSERVER}/rest/{ruta}", data=datos, method=metodo)
    credenciales = base64.b64encode(f"{USUARIO}:{CLAVE}".encode()).decode()
    pedido.add_header("Authorization", f"Basic {credenciales}")
    pedido.add_header("Accept", "application/json")
    if tipo:
        pedido.add_header("Content-Type", tipo)
    try:
        with urllib.request.urlopen(pedido, timeout=300) as respuesta:
            texto = respuesta.read().decode()
            return respuesta.status, json.loads(texto) if texto.startswith(("{", "[")) else None
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def esperar_geoserver():
    for _ in range(60):
        try:
            if pedir("GET", "about/version.json")[0] == 200:
                return
        except (urllib.error.URLError, ConnectionError):
            pass
        print("Esperando a que GeoServer termine de arrancar...")
        time.sleep(5)
    raise SystemExit("GeoServer no responde en " + GEOSERVER)


def nombre_tabla(capa):
    """Misma regla que scripts/comun.sh: minúsculas y sin acentos."""
    sin_acentos = unicodedata.normalize("NFKD", capa).encode("ascii", "ignore").decode()
    return sin_acentos.lower()


def titulos_ign():
    """Título y resumen de cada tabla, a partir del nombre original del shapefile."""
    titulos = {}
    for shp in sorted(DATOS.glob("*.shp")):
        capa = unicodedata.normalize("NFC", shp.stem)
        titulo = capa.replace("_", " ")
        titulos[nombre_tabla(capa)] = (titulo[0].upper() + titulo[1:], f"Capa {capa} del SIG IGN 250")
    return titulos


def asegurar_workspace():
    if pedir("GET", f"workspaces/{WORKSPACE}.json")[0] == 200:
        print(f"Workspace {WORKSPACE}: ya existe")
        return
    pedir("POST", "namespaces", {"namespace": {"prefix": WORKSPACE, "uri": NAMESPACE_URI}})
    pedir("PUT", "workspaces/default", {"workspace": {"name": WORKSPACE}})
    print(f"Workspace {WORKSPACE}: creado")


def asegurar_store(store, descripcion):
    ruta = f"workspaces/{WORKSPACE}/datastores"
    codigo, actual = pedir("GET", f"{ruta}/{store}.json")
    if codigo == 200:
        if not actual["dataStore"].get("enabled"):
            pedir("PUT", f"{ruta}/{store}", {"dataStore": {"name": store, "enabled": True}})
            print(f"Store {store}: estaba desactivado, se activó")
        else:
            print(f"Store {store}: ya existe")
        return
    parametros = {
        "dbtype": "postgis",
        "host": "db",
        "port": "5432",
        "database": os.environ["POSTGRES_DB"],
        "schema": store,
        "user": os.environ["POSTGRES_USER"],
        "passwd": os.environ["POSTGRES_PASSWORD"],
        "Expose primary keys": "false",
    }
    codigo, respuesta = pedir("POST", ruta, {
        "dataStore": {
            "name": store,
            "description": descripcion,
            "enabled": True,
            "connectionParameters": {"entry": [{"@key": k, "$": v} for k, v in parametros.items()]},
        }
    })
    if codigo != 201:
        raise SystemExit(f"No se pudo crear el store {store}: {codigo} {respuesta}")
    print(f"Store {store}: creado")


def publicar_store(store, titulos, extension=None):
    ruta = f"workspaces/{WORKSPACE}/datastores/{store}/featuretypes"
    _, disponibles = pedir("GET", f"{ruta}.json?list=available")
    tablas = (disponibles or {}).get("list", {}).get("string", [])
    if isinstance(tablas, str):
        tablas = [tablas]
    for tabla in sorted(tablas):
        titulo, resumen = titulos.get(tabla, (tabla, ""))
        capa = {
            "name": tabla,
            "nativeName": tabla,
            "title": titulo,
            "abstract": resumen,
            "srs": "EPSG:4326",
            "projectionPolicy": "FORCE_DECLARED",
            "enabled": True,
        }
        if extension:
            capa["nativeBoundingBox"] = extension
            capa["latLonBoundingBox"] = extension
        codigo, respuesta = pedir("POST", ruta, {"featureType": capa})
        estado = "publicada" if codigo == 201 else f"ERROR {codigo}: {respuesta}"
        print(f"  {WORKSPACE}:{tabla} ({titulo}): {estado}")
    return len(tablas)


def aplicar_estilos():
    ruta = f"workspaces/{WORKSPACE}/styles"
    for archivo in sorted(ESTILOS.glob("*.sld")):
        estilo = archivo.stem
        sld = archivo.read_bytes()
        if pedir("GET", f"{ruta}/{estilo}.json")[0] == 200:
            codigo, respuesta = pedir("PUT", f"{ruta}/{estilo}", sld=sld)
            accion = "actualizado"
        else:
            codigo, respuesta = pedir("POST", f"{ruta}?name={estilo}", sld=sld)
            accion = "creado"
        if codigo not in (200, 201):
            print(f"  Estilo {estilo}: ERROR {codigo}: {respuesta}")
            continue
        codigo, respuesta = pedir("PUT", f"layers/{WORKSPACE}:{estilo}", {
            "layer": {"defaultStyle": {"name": estilo, "workspace": WORKSPACE}}
        })
        asignado = "asignado a la capa" if codigo == 200 else f"sin asignar ({codigo}: {respuesta})"
        print(f"  Estilo {estilo}: {accion}, {asignado}")


def configurar_seguridad():
    """Usuario editor con rol EDITOR: puede escribir (WFS-T) solo en las capas de edición."""
    editor = os.environ["GEOSERVER_EDITOR_USER"]
    if pedir("GET", "security/roles/role/EDITOR.json")[0] != 200:
        pedir("POST", "security/roles/role/EDITOR")
    _, usuarios = pedir("GET", "security/usergroup/users.json")
    if editor not in [u["userName"] for u in (usuarios or {}).get("users", [])]:
        pedir("POST", "security/usergroup/users", {
            "user": {"userName": editor, "password": os.environ["GEOSERVER_EDITOR_PASSWORD"], "enabled": True}
        })
    pedir("POST", f"security/roles/role/EDITOR/user/{editor}")

    _, reglas = pedir("GET", "security/acl/layers.json")
    for capa in TITULOS_EDICION:
        regla = {f"{WORKSPACE}.{capa}.w": "ADMIN,GROUP_ADMIN,EDITOR"}
        metodo = "PUT" if next(iter(regla)) in (reglas or {}) else "POST"
        codigo, respuesta = pedir(metodo, "security/acl/layers", regla)
        estado = "ok" if codigo in (200, 201) else f"ERROR {codigo}: {respuesta}"
        print(f"  Escritura en {WORKSPACE}:{capa} para {editor} (rol EDITOR): {estado}")


def main():
    esperar_geoserver()
    asegurar_workspace()
    for store, descripcion in STORES.items():
        asegurar_store(store, descripcion)

    print("Publicando capas pendientes del store ign...")
    nuevas = publicar_store("ign", titulos_ign())
    print("Publicando capas pendientes del store edicion...")
    nuevas += publicar_store("edicion", TITULOS_EDICION, EXTENSION_CHACO)
    print("Aplicando estilos...")
    aplicar_estilos()
    print("Configurando permisos de edición...")
    configurar_seguridad()

    _, capas = pedir("GET", f"workspaces/{WORKSPACE}/layers.json")
    total = len((capas or {}).get("layers", {}).get("layer", []) or [])
    print(f"Listo: {nuevas} capas nuevas, {total} capas publicadas en el workspace {WORKSPACE}")


if __name__ == "__main__":
    main()
