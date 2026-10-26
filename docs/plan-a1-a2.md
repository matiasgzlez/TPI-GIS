# Plan paso a paso: A.1 y A.2

Guía para hacer la base espacial (A.1) y el servidor de mapas (A.2), sacando capturas para el informe. Cada paso tiene un objetivo, qué hacer y cómo verificar que quedó bien. Los pasos con 📸 son los que conviene capturar.

Estado: **A.1 terminada** (26/10/2026). A.2 en curso.

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

## A.2 — Servidor de mapas (WMS y WFS)

### Paso 11 — Levantar GeoServer 📸
- Agregar el servicio `geoserver` a `compose.yaml`: volumen persistente para el *data dir*, sin datos de demo, contraseña de administrador desde `.env`.
- `docker compose up -d geoserver` y entrar a http://localhost:8080/geoserver.
- **Verificar:** login correcto y página *Server Status*. 📸

### Paso 12 — Espacio de trabajo 📸
- Crear el workspace `tpi`, con URI de espacio de nombres `https://github.com/matiasgzlez/TPI-GIS`.
- **Verificar:** aparece en *Workspaces*. 📸

### Paso 13 — Almacenes PostGIS 📸
- Crear el store `ign` (PostGIS, host `db`, esquema `ign`) y el store `edicion` (esquema `edicion`).
- **Verificar:** al crearlos, GeoServer lista las tablas disponibles para publicar. 📸

### Paso 14 — Publicar las 4 capas principales a mano 📸
- Publicar `provincias`, `red_vial`, `localidades` y `puente_red_vial_puntos`. En cada una: título legible, SRS EPSG:4326, *Compute from data* para la extensión nativa y *Compute from native bounds* para la geográfica.
- **Verificar:** *Layer Preview* en OpenLayers muestra cada capa. 📸 (una por lo menos)

### Paso 15 — Publicar las 43 capas restantes y `obras_rn11`
- Dos opciones:
  - **a) Desde la web.** Repetir el paso 14 para cada capa. Es lento pero no requiere escribir código.
  - **b) Con un script de la API REST de GeoServer.** Hace exactamente lo mismo que el paso 14 y sirve para reconstruir todo si se pierde el volumen. **Recomendada:** las capturas del paso 14 ya muestran el procedimiento manual.
- **Verificar:** 48 capas en *Layers* (47 IGN + `obras_rn11`). 📸

### Paso 16 — Estilos iniciales 📸
- Crear estilos SLD simples y legibles para las 4 capas principales: límites provinciales, red vial por tipo de camino, localidades y puentes. En QGIS se diseñan y se exportan como SLD; en GeoServer se cargan en *Styles*.
- Las demás capas quedan con el estilo por defecto según su geometría. La simbología por clases para la leyenda del visor se termina en A.3.
- **Verificar:** *Layer Preview* con el estilo nuevo y la leyenda (`GetLegendGraphic`). 📸

### Paso 17 — Verificar WMS 📸
- Abrir en el navegador `GetCapabilities` del WMS (las 48 capas listadas). 📸
- Hacer un `GetMap` en PNG de `provincias` + `red_vial` con extensión de Chaco. 📸
- Hacer un `GetFeatureInfo` sobre una localidad (la va a usar la consulta por punto de A.3).

### Paso 18 — Verificar WFS 📸
- Abrir `GetCapabilities` del WFS. 📸
- Hacer un `GetFeature` de `localidades` filtrado por un recuadro (BBOX) de Chaco y con `count=50`, en GeoJSON. 📸
- Comprobar que el WFS está en modo *Transactional* y que la seguridad solo permite escribir en `obras_rn11`. Esto lo necesita A.3.

### Paso 19 — Consumir los servicios desde QGIS 📸
- En QGIS, agregar una conexión WMS y otra WFS a `http://localhost:8080/geoserver/tpi/ows`.
- Cargar `red_vial` por WMS y `localidades` por WFS.
- **Verificar:** ambas se dibujan y la tabla de atributos WFS muestra datos. 📸

### Paso 20 — Persistencia 📸
- `docker compose down` (sin `-v`) y después `docker compose up -d`.
- **Verificar:** siguen las tablas en PostGIS, las capas y estilos en GeoServer y la conexión desde QGIS. 📸

**Cierre de A.2:** explicación en `docs/informe/a2.md` y README actualizado con cómo levantar todo.

---

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
