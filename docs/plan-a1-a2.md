# Plan paso a paso: A.1 y A.2

Guía para hacer la base espacial (A.1) y el servidor de mapas (A.2), sacando capturas para el informe. Cada paso tiene un objetivo, qué hacer y cómo verificar que quedó bien. Los pasos con 📸 son los que conviene capturar.

Estado: **A.1 y A.2 terminadas** (26/10/2026).

## Convenciones

- Los comandos se escriben en una sola línea para que funcionen igual en la Terminal de macOS y en PowerShell de Windows.
- Las herramientas de línea de comandos (GDAL) se usan dentro de contenedores; en la compu solo hace falta Docker, pgAdmin y QGIS.
- Los datos originales no se tocan. Van en `data/SIG_IGN2011/`, que no se versiona.

## Versiones elegidas

| Servicio | Imagen | Notas |
|---|---|---|
| PostgreSQL 17 + PostGIS 3.6 | `imresamu/postgis:17-3.6` | Imagen para Intel y ARM (la oficial `postgis/postgis` es solo Intel) |
| GeoServer 2.28 | `docker.osgeo.org/geoserver:2.28.6` | Imagen oficial; Intel y ARM |
| GDAL 3.13 (carga y control) | `ghcr.io/osgeo/gdal:ubuntu-small-3.13.3` | Solo para ejecutar comandos (perfil `herramientas`) |
| pgAdmin 4 | Instalado en la compu | Se descartó el contenedor: el de escritorio ya lo tiene el equipo y evita problemas de cookies del navegador |

## Datos relevados

- 47 shapefiles en WGS84 geográfico (EPSG:4326), 1 GB en total. Detalle en [inventario-capas.md](inventario-capas.md).
- Codificación: 46 DBF en CP1252 y `Provincias` en UTF‑8; GDAL convierte todo a UTF‑8.
- 60 geometrías inválidas en 10 capas de polígonos, propias del dato original (Buenos Aires en `provincias`; Chaco es válida). Detalle en [control-carga.md](control-carga.md).

---

## Paso 0 — Preparación (cada integrante)

- Instalar Docker Desktop (en Windows, con WSL2), pgAdmin 4 y QGIS.
- Clonar el repo y descomprimir las capas en `data/SIG_IGN2011/`. En macOS no usar Descargas: el sistema bloquea el acceso de Docker y la Terminal.
- **Verificar:** `docker version` muestra la sección *Server* y hay 47 `.shp`.

## A.1 — Servidor de base de datos espacial ✅

| Paso | Qué se hizo | Archivo |
|---|---|---|
| 1 | Configuración: variables (`postgres`/`postgres`, base `tpi`), finales de línea LF, servicio `db` con puerto solo en `127.0.0.1` | `compose.yaml`, `.env.example`, `.gitattributes` |
| 2 | `docker compose up -d`; base *healthy* y volumen `tpi-gis_db-data` | |
| 3 | pgAdmin de escritorio en `127.0.0.1:5432`; extensiones `postgis` y `unaccent`, esquemas `ign` y `edicion` | `sql/01_esquemas.sql` |
| 4 | Inventario de las 47 capas | `scripts/inventario.sh` → `docs/inventario-capas.md` |
| 5 | Carga de prueba de 4 capas con `ogr2ogr` (multi para líneas y polígonos, `POINT` para puntos, índice GiST) | `scripts/cargar.sh` |
| 6 | Nombres de tablas y columnas sin acentos | `scripts/comun.sh`, `sql/02_normalizar_nombres.sql` |
| 7 | Carga de las 47 capas (`docker compose run --rm gdal sh scripts/cargar.sh`) | `scripts/cargar.sh` |
| 8 | Control: 47/47 coinciden, SRID 4326 e índice espacial | `scripts/control.sh` → `docs/control-carga.md` |
| 9 | Capa propia `edicion.obras_rn11` (Point 4326, valores controlados con `CHECK`) | `sql/03_obras_rn11.sql` |
| 10 | Conexión desde QGIS y filtro de la RN11 (`nro_ruta = '11' AND administra = 'Nacional'`) | |

Los tres SQL se ejecutan solos al crear la base por primera vez (montados en `/docker-entrypoint-initdb.d`), así que en una compu nueva A.1 se reduce a: `.env`, `docker compose up -d`, `cargar.sh` y `control.sh`.

## A.2 — Servidor de mapas (WMS y WFS) ✅

| Paso | Qué se hizo | Archivo |
|---|---|---|
| 11 | Servicio `geoserver` (2.28.6) con volumen persistente, sin datos de demo, CORS activado, en `127.0.0.1:8080` | `compose.yaml` |
| 12 | Workspace `tpi` (default), URI `https://github.com/matiasgzlez/TPI-GIS` | |
| 13 | Stores PostGIS `ign` y `edicion` (host `db`) | |
| 14 | Publicación manual de `provincias`, `red_vial`, `localidades` y `puente_red_vial_puntos` | |
| 15 | Publicación del resto por API REST; `obras_rn11` con extensión fija de Chaco | `geoserver/publicar.py` |
| 16 | Estilos SLD con clases y generalización por escala para las 4 capas principales y `obras_rn11` | `geoserver/estilos/` |
| 17 | WMS: GetCapabilities, GetMap, GetFeatureInfo y GetLegendGraphic | |
| 18 | WFS: GetCapabilities y GetFeature con BBOX. WFS-T: usuario `editor` (rol EDITOR) que solo puede escribir en `obras_rn11` | `geoserver/publicar.py`, `geoserver/verificar.py` |
| 19 | QGIS como cliente WMS (estilos y leyenda del servidor) y WFS (vectores) | |
| 20 | Persistencia tras `docker compose down` / `up`: 11 de 11 pruebas | `docs/verificacion-servicios.md` |

Problemas encontrados:
- Store creado con la casilla *Enabled* destildada: sus capas no se servían y se publicaron desactivadas con estilo `polygon`. `publicar.py` ahora activa los stores desactivados.
- La imagen oficial reescribe `users.xml` y `roles.xml` en cada arranque si recibe `GEOSERVER_ADMIN_USER`/`PASSWORD`, y borraba el usuario `editor`. Se quitaron esas variables del servicio (el admin queda con los valores por defecto).

En una compu nueva, A.2 se reduce a `docker compose up -d`, `docker compose run --rm publicar` y `docker compose run --rm publicar python geoserver/verificar.py`.

## Qué se versiona y qué no

| Se versiona | No se versiona |
|---|---|
| `compose.yaml`, `.env.example`, `.gitattributes` | `.env` |
| Scripts SQL y de carga, script REST (si se elige 15b) | Volúmenes de PostGIS y GeoServer |
| SLD de estilos | Shapefiles originales |
| Inventario, informe y capturas | |

## Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| Los datos quedan en una subcarpeta o en otra ruta | Ruta fija `data/SIG_IGN2011/` dentro del repo; `control.sh` detecta capas faltantes |
| Scripts con finales CRLF en Windows | `.gitattributes` del paso 1 |
| Puerto 5432 u 8080 ocupado | Puertos configurables en `.env` |
| `Curvas_de_Nivel` tarda en cargar o en dibujarse | Se carga igual; en GeoServer, limitar la escala de visualización |
| Se pierde la configuración de GeoServer | Volumen persistente (paso 20) y script REST (opción 15b) |
