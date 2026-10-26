"""Pasos 17 y 18: verifica los servicios WMS, WFS y WFS-T publicados por GeoServer.

Prueba cada capa publicada y los permisos de escritura, y escribe un informe en Markdown.
La prueba de WFS-T inserta un punto de prueba en obras_rn11 y después lo borra.

Uso: docker compose run --rm publicar python geoserver/verificar.py
"""

import base64
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

GEOSERVER = os.environ["GEOSERVER_URL"].rstrip("/")
ADMIN = (os.environ["GEOSERVER_ADMIN_USER"], os.environ["GEOSERVER_ADMIN_PASSWORD"])
EDITOR = (os.environ["GEOSERVER_EDITOR_USER"], os.environ["GEOSERVER_EDITOR_PASSWORD"])
WORKSPACE = "tpi"
NAMESPACE_URI = "https://github.com/matiasgzlez/TPI-GIS"
INFORME = Path("/salida/verificacion-servicios.md")

CHACO = "-63.6,-28.2,-58.2,-23.9"
RESISTENCIA = (-58.99566, -27.45546)
ESTILOS = ["provincias", "red_vial", "localidades", "puente_red_vial_puntos", "obras_rn11"]

resultados = []


def http(url, cuerpo=None, usuario=None):
    """Devuelve (código, tipo de contenido, cuerpo en bytes)."""
    pedido = urllib.request.Request(url, data=cuerpo, method="POST" if cuerpo else "GET")
    if cuerpo:
        pedido.add_header("Content-Type", "text/xml")
    if usuario:
        credenciales = base64.b64encode(f"{usuario[0]}:{usuario[1]}".encode()).decode()
        pedido.add_header("Authorization", f"Basic {credenciales}")
    try:
        with urllib.request.urlopen(pedido, timeout=300) as respuesta:
            return respuesta.status, respuesta.headers.get("Content-Type", ""), respuesta.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get("Content-Type", ""), error.read()


def esperar_geoserver():
    for _ in range(60):
        try:
            if http(f"{GEOSERVER}/rest/about/version.json", usuario=ADMIN)[0] == 200:
                return
        except (urllib.error.URLError, ConnectionError):
            pass
        print("Esperando a que GeoServer termine de arrancar...")
        time.sleep(5)
    raise SystemExit("GeoServer no responde en " + GEOSERVER)


def ows(servicio, **parametros):
    return f"{GEOSERVER}/{WORKSPACE}/ows?" + urllib.parse.urlencode({"service": servicio, **parametros})


def registrar(seccion, prueba, ok, detalle):
    resultados.append((seccion, prueba, ok, detalle))
    print(f"{'OK ' if ok else 'ERR'} {seccion}: {prueba} — {detalle}")


def anunciadas_en(capabilities, capas):
    """Capas publicadas que aparecen en un GetCapabilities (con o sin el prefijo tpi:)."""
    nombres = {n.decode() for n in re.findall(rb"<Name>(?:tpi:)?([^<]+)</Name>", capabilities)}
    return nombres & set(capas)


def capas_publicadas():
    _, _, cuerpo = http(f"{GEOSERVER}/rest/workspaces/{WORKSPACE}/layers.json", usuario=ADMIN)
    return sorted(capa["name"] for capa in json.loads(cuerpo)["layers"]["layer"])


def verificar_wms(capas):
    _, _, cuerpo = http(ows("WMS", version="1.3.0", request="GetCapabilities"))
    anunciadas = anunciadas_en(cuerpo, capas)
    registrar("WMS", "GetCapabilities", len(anunciadas) == len(capas), f"{len(anunciadas)} de {len(capas)} capas anunciadas")

    fallas = []
    for capa in capas:
        _, tipo, _ = http(ows("WMS", version="1.1.1", request="GetMap", layers=f"tpi:{capa}", styles="",
                              bbox=CHACO, width=300, height=240, srs="EPSG:4326", format="image/png"))
        if tipo != "image/png":
            fallas.append(capa)
    registrar("WMS", "GetMap de cada capa (PNG, extensión de Chaco)", not fallas,
              f"{len(capas) - len(fallas)} de {len(capas)} capas" + (f"; fallan: {', '.join(fallas)}" if fallas else ""))

    fallas = []
    for estilo in ESTILOS:
        _, tipo, _ = http(ows("WMS", version="1.1.1", request="GetLegendGraphic", layer=f"tpi:{estilo}", format="image/png"))
        if tipo != "image/png":
            fallas.append(estilo)
    registrar("WMS", "GetLegendGraphic de las capas con estilo propio", not fallas,
              f"{len(ESTILOS) - len(fallas)} de {len(ESTILOS)} leyendas")

    x, y = RESISTENCIA
    _, _, cuerpo = http(ows("WMS", version="1.1.1", request="GetFeatureInfo", layers="tpi:localidades",
                            query_layers="tpi:localidades", styles="", srs="EPSG:4326",
                            bbox=f"{x - 0.01},{y - 0.01},{x + 0.01},{y + 0.01}", width=101, height=101,
                            x=50, y=50, info_format="application/json"))
    nombres = [f["properties"].get("nombre") for f in json.loads(cuerpo).get("features", [])]
    registrar("WMS", "GetFeatureInfo sobre Resistencia", "Resistencia" in nombres, f"devuelve: {', '.join(nombres) or 'nada'}")


def verificar_wfs(capas):
    _, _, cuerpo = http(ows("WFS", version="2.0.0", request="GetCapabilities"))
    anunciadas = anunciadas_en(cuerpo, capas)
    transaccional = b"Transaction" in cuerpo
    registrar("WFS", "GetCapabilities", len(anunciadas) == len(capas) and transaccional,
              f"{len(anunciadas)} de {len(capas)} capas anunciadas; operación Transaction {'disponible' if transaccional else 'NO disponible'}")

    fallas = []
    for capa in capas:
        if capa in ("obras_rn11",):
            continue  # vacía hasta que se carguen puntos desde el visor
        _, _, cuerpo = http(ows("WFS", version="2.0.0", request="GetFeature", typeNames=f"tpi:{capa}",
                                count=1, outputFormat="application/json"))
        try:
            if not json.loads(cuerpo)["features"]:
                fallas.append(capa)
        except (ValueError, KeyError):
            fallas.append(capa)
    probadas = len(capas) - 1
    registrar("WFS", "GetFeature de cada capa (GeoJSON, 1 entidad)", not fallas,
              f"{probadas - len(fallas)} de {probadas} capas" + (f"; fallan: {', '.join(fallas)}" if fallas else ""))

    _, _, cuerpo = http(ows("WFS", version="2.0.0", request="GetFeature", typeNames="tpi:localidades",
                            bbox=f"{CHACO},EPSG:4326", count=10000, outputFormat="application/json"))
    total = len(json.loads(cuerpo)["features"])
    registrar("WFS", "GetFeature de localidades con filtro BBOX de Chaco", total > 0, f"{total} localidades en el rectángulo")


def insertar(capa, usuario):
    xml = f"""<wfs:Transaction service="WFS" version="1.1.0"
    xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:tpi="{NAMESPACE_URI}">
  <wfs:Insert>
    <tpi:{capa}>
      <tpi:tipo_obra>bacheo</tpi:tipo_obra>
      <tpi:prioridad>alta</tpi:prioridad>
      <tpi:descripcion>Prueba automática de WFS-T (se borra al terminar)</tpi:descripcion>
      <tpi:geom><gml:Point srsName="EPSG:4326"><gml:pos>-59.05 -27.45</gml:pos></gml:Point></tpi:geom>
    </tpi:{capa}>
  </wfs:Insert>
</wfs:Transaction>"""
    codigo, _, cuerpo = http(f"{GEOSERVER}/wfs", xml.encode(), usuario)
    fid = re.search(rb'fid="([^"]+)"', cuerpo)
    return codigo, fid.group(1).decode() if fid and b"totalInserted>1<" in cuerpo else None


def borrar(fid, usuario):
    capa = fid.split(".")[0]
    xml = f"""<wfs:Transaction service="WFS" version="1.1.0"
    xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:tpi="{NAMESPACE_URI}">
  <wfs:Delete typeName="tpi:{capa}"><ogc:Filter><ogc:FeatureId fid="{fid}"/></ogc:Filter></wfs:Delete>
</wfs:Transaction>"""
    _, _, cuerpo = http(f"{GEOSERVER}/wfs", xml.encode(), usuario)
    return b"totalDeleted>1<" in cuerpo


def verificar_wfst():
    codigo, fid = insertar("obras_rn11", None)
    registrar("WFS-T", "Insertar en obras_rn11 sin usuario", fid is None, "rechazado" if fid is None else f"PERMITIDO ({fid})")
    if fid:
        borrar(fid, ADMIN)

    codigo, fid = insertar("red_vial", EDITOR)
    registrar("WFS-T", f"Insertar en red_vial (capa del IGN) como {EDITOR[0]}", fid is None,
              "rechazado" if fid is None else f"PERMITIDO ({fid})")
    if fid:
        borrar(fid, ADMIN)

    codigo, fid = insertar("obras_rn11", EDITOR)
    registrar("WFS-T", f"Insertar en obras_rn11 como {EDITOR[0]}", fid is not None,
              f"insertado {fid}" if fid else f"falló (HTTP {codigo})")
    if fid:
        borrado = borrar(fid, EDITOR)
        registrar("WFS-T", f"Borrar el punto de prueba como {EDITOR[0]}", borrado, "borrado" if borrado else "no se pudo borrar")


def escribir_informe():
    lineas = [
        "# Verificación de servicios OGC",
        "",
        f"Generado el {datetime.now():%Y-%m-%d %H:%M} con `geoserver/verificar.py`.",
        "",
        "| Servicio | Prueba | Resultado | Detalle |",
        "|---|---|:---:|---|",
    ]
    lineas += [f"| {s} | {p} | {'✅' if ok else '❌'} | {d} |" for s, p, ok, d in resultados]
    errores = sum(not ok for *_, ok, _ in resultados)
    lineas += ["", f"Pruebas: {len(resultados)}. Con problemas: {errores}."]
    INFORME.write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"\nInforme en docs/{INFORME.name}. Pruebas: {len(resultados)}. Con problemas: {errores}.")


def main():
    esperar_geoserver()
    capas = capas_publicadas()
    verificar_wms(capas)
    verificar_wfs(capas)
    verificar_wfst()
    escribir_informe()


if __name__ == "__main__":
    main()
