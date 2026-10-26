# TPI — Sistemas de Información Geográfica

Trabajo práctico integrador de SIG (UTN FRRe, 2026) con las capas del SIG IGN 250: base de datos espacial, servidor de mapas OGC, visor web, análisis de la RN11 en Chaco y mapa para impresión.

- [Consigna](docs/consignas.md) · [PDF original](docs/consigna-original.pdf)
- [Especificación y decisiones](docs/SPEC.md)
- [Plan paso a paso de A.1 y A.2](docs/plan-a1-a2.md)

## Estado

| Parte | Estado |
|---|---|
| A.1 Base de datos espacial | ✅ PostGIS con las 47 capas cargadas y controladas |
| A.2 Servidor de mapas (WMS/WFS) | En curso |
| A.3 Visor web | Pendiente |
| B Análisis RN11 | Pendiente |
| C Mapa A4 | Pendiente |

## Puesta en marcha

Requisitos: Docker Desktop (en Windows con WSL 2), pgAdmin 4 y QGIS.

1. Descomprimir las [capas de la cátedra](https://drive.google.com/file/d/1DrPP7D37aU5WHVqz_dzlA5NTD23WrKCT/view?usp=sharing) en `data/SIG_IGN2011/` (47 `.shp`). No se versionan: pesan 1 GB.
2. Crear el archivo de variables:
   ```sh
   cp .env.example .env        # Windows: copy .env.example .env
   ```
3. Levantar la base. La primera vez crea los esquemas, el procedimiento de normalización y la tabla `edicion.obras_rn11`:
   ```sh
   docker compose up -d
   ```
4. Cargar las capas y controlar la carga:
   ```sh
   docker compose run --rm gdal sh scripts/cargar.sh
   docker compose run --rm gdal sh -c "sh scripts/control.sh > docs/control-carga.md"
   ```
   `docs/control-carga.md` tiene que terminar con "Con problemas: 0".

Conexión desde pgAdmin o QGIS: host `127.0.0.1`, puerto `5432`, base `tpi`, usuario y contraseña `postgres`.

No levantar a la vez el Docker de los laboratorios: ambos usan el puerto 5432. `docker compose down -v` borra la base.

## Estructura

| Ruta | Contenido |
|---|---|
| `compose.yaml` | Servicios `db` (PostgreSQL 17 + PostGIS 3.6) y `gdal` (herramientas) |
| `sql/` | Inicialización de la base: esquemas `ign` y `edicion`, normalización de nombres, `obras_rn11` |
| `scripts/` | Inventario, carga y control de capas con GDAL |
| `docs/` | Consigna, especificación, plan, [inventario](docs/inventario-capas.md) y [control de carga](docs/control-carga.md) |
| `data/` | Shapefiles originales (no se versionan) |

## Equipo

Tres integrantes; macOS y Windows. Repositorio: https://github.com/matiasgzlez/TPI-GIS
