# TPI — Sistemas de Información Geográfica

Trabajo práctico integrador de SIG (UTN FRRe, 2026) con las capas del SIG IGN 250: base de datos espacial, servidor de mapas OGC, visor web, análisis de la RN11 en Chaco y mapa para impresión.

- [Consigna](docs/consignas.md) · [PDF original](docs/consigna-original.pdf)
- [Especificación y decisiones](docs/SPEC.md)
- [Plan paso a paso de A.1 y A.2](docs/plan-a1-a2.md)

## Estado

| Parte | Estado |
|---|---|
| A.1 Base de datos espacial | ✅ PostGIS con las 47 capas cargadas y controladas |
| A.2 Servidor de mapas (WMS/WFS) | ✅ GeoServer con las 48 capas, estilos y edición por WFS-T verificados |
| A.3 Visor web | En revisión: las 7 funciones con las 48 capas, tema claro/oscuro y Foco RN11 ([spec](docs/plans/visor-a3.md)) |
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
5. Publicar las capas en GeoServer (workspace, stores, capas, estilos y permisos) y verificar los servicios:
   ```sh
   docker compose run --rm publicar
   docker compose run --rm publicar python geoserver/verificar.py
   ```
   `docs/verificacion-servicios.md` tiene que terminar con "Con problemas: 0".

| Servicio | Dirección | Usuario |
|---|---|---|
| PostGIS (pgAdmin, QGIS) | `127.0.0.1:5432`, base `tpi` | `postgres` / `postgres` |
| GeoServer (web) | http://127.0.0.1:8080/geoserver | `admin` / `geoserver` |
| WMS / WFS | `http://127.0.0.1:8080/geoserver/tpi/wms` · `/tpi/wfs` | lectura libre |
| WFS-T sobre `obras_rn11` | `http://127.0.0.1:8080/geoserver/wfs` | `editor` / `editor` |

Usar `127.0.0.1` y no `localhost` en el navegador: con `localhost` pueden fallar por cookies de otras aplicaciones.

## Visor web (A.3)

Requisito extra: Node.js 22 o superior. Con la base y GeoServer levantados:

```sh
cd web
npm install          # la primera vez y cada vez que cambie package.json
npm run dev          # http://localhost:5173, se recarga solo al guardar
```

Para la demo, generar el build y servirlo con nginx en http://127.0.0.1:8081:

```sh
cd web && npm run build && cd ..
docker compose up -d web
```

En los dos casos el proxy (Vite en desarrollo, `web/nginx.conf` en la demo) manda `/geoserver` a GeoServer y agrega las credenciales del `editor` solo en `/wfst`. Si se cambia la contraseña del editor en `.env`, actualizar también el base64 de `web/nginx.conf`.

Atajos del visor: `1`–`6` eligen herramienta (navegar, consulta por punto, por rectángulo, distancia, área, nueva obra), `/` o `⌘K` van al buscador central (lugares, capas, herramientas y el historial) y `Esc` vuelve a navegar.

Las capas prendidas se piden juntas, en un solo WMS por tesela, con un `SLD_BODY` que las lista en orden de dibujo; las de contexto (cursos y espejos de agua, límites, islas) llevan ahí su estilo propio (`web/src/estilos.ts`) y la configuración de GeoServer no cambia. Rendimiento medido antes y después: [docs/optimizacion-visor.md](docs/optimizacion-visor.md).

`docker compose down -v` borra la base.

## Ramas

| Rama | Para qué |
|---|---|
| `main` | Versión estable, la que se entrega y se muestra en la demo |
| `develop` | Integración: acá llegan todas las features |
| `visor-...`, `analisis-...`, etc. | Una por tarea, creada desde `develop` |

```sh
git checkout develop && git pull
git checkout -b visor-nombre-de-la-tarea
# ...cambios y commits...
git push -u origin visor-nombre-de-la-tarea
```

Después, abrir un Pull Request en GitHub **con base `develop`** (GitHub propone `main` por defecto: cambiarlo). Otro integrante lo prueba y lo aprueba antes de mergear. Cuando `develop` está probada, se abre un PR de `develop` a `main`.

## Estructura

| Ruta | Contenido |
|---|---|
| `compose.yaml` | Servicios `db` (PostgreSQL 17 + PostGIS 3.6), `geoserver` (GeoServer 2.28) `web` (nginx con el build del visor) y las herramientas `gdal` y `publicar` |
| `sql/` | Inicialización de la base: esquemas `ign` y `edicion`, normalización de nombres, `obras_rn11` |
| `scripts/` | Inventario, carga y control de capas con GDAL |
| `geoserver/` | Publicación por API REST (`publicar.py`), verificación de servicios (`verificar.py`) y estilos SLD |
| `web/` | Visor web: Vite + React + TypeScript + OpenLayers, con componentes de HeroUI y Aceternity UI (`src/config.ts` las 48 capas agrupadas, `src/visor.ts` el mapa, `src/estilos.ts` los SLD del cliente, `src/herramientas.ts` consultas y medición, `src/obras.ts` el WFS-T, `src/componentes/` los paneles y `src/componentes/ui/` los de Aceternity) |
| `docs/` | Consigna, especificación, plan, [inventario](docs/inventario-capas.md), [control de carga](docs/control-carga.md) y [verificación de servicios](docs/verificacion-servicios.md) |
| `data/` | Shapefiles originales (no se versionan) |

## Equipo

Tres integrantes; macOS y Windows. Repositorio: https://github.com/matiasgzlez/TPI-GIS
