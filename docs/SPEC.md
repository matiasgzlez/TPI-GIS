# Spec: TPI SIG — Infraestructura, visor web, análisis RN11 y mapa

Estado: **borrador para revisión del equipo** (fase 1, especificación). Nada de esto está implementado todavía.

## Objetivo

Cumplir las tres partes de la [consigna](consignas.md) con un procedimiento reproducible en macOS (Apple Silicon) y Windows:

- **A** — Base espacial con las 47 capas IGN 250, publicadas por WMS/WFS, y un visor web que las consuma.
- **B** — Responder longitud de la RN11 en Chaco, población en franjas 0–10 km y >10–20 km, y puentes sobre la traza, con un informe de pasos y capturas.
- **C** — Mapa A4 en PDF del Chaco con la RN11, sus áreas de influencia, localidades, puentes y accidentes naturales.

Usuarios: la cátedra (evalúa y ve la presentación) y el equipo (tiene que poder levantar todo con un comando).

## Supuestos

1. Todo corre local; no hay despliegue público.
2. Los integrantes con Windows usan Docker Desktop con backend WSL2.
3. Los datos originales no se versionan ni se modifican; cada integrante indica su ruta en `.env`.
4. Se usan exclusivamente las capas provistas; datos externos (p. ej. INDEC) solo como contraste documentado, no como fuente principal.
5. El equipo es de 3 integrantes (decidido; la consigna sugiere 4–5).

## Stack tecnológico

| Pieza | Elección | Por qué | Alternativa descartada |
|---|---|---|---|
| Orquestación | Docker Compose | Igual en macOS y Windows; el host solo necesita Docker | Instalaciones nativas (difieren por SO) |
| Base espacial | PostgreSQL 17 + PostGIS 3.6, imagen `imresamu/postgis` | Tiene builds `amd64` y `arm64` | `postgis/postgis`: solo publica `amd64`; en Mac corre emulada y más lenta |
| Servidor de mapas | GeoServer 2.28.x, imagen oficial `docker.osgeo.org/geoserver` | Estándar OGC completo (WMS, WFS, WFS-T, GetLegendGraphic), multiarquitectura, es lo visto en clase | GeoServer 3.0 (muy reciente, menos material de referencia); MapServer/QGIS Server (sin WFS-T tan simple) |
| Carga de datos | `ogr2ogr` (GDAL) en un contenedor de un solo uso | Reproducible, sin instalar GDAL en Windows, controla codificación y nombres | `shp2pgsql` (menos control), carga manual desde QGIS (no reproducible) |
| Configuración de GeoServer | Script contra la API REST (`geoserver/publicar.py`) | Rehacer workspace, stores, capas, estilos y permisos con un comando | Versionar el `data_dir` (frágil, mezcla estado con configuración) |
| Estilos | SLD escritos a mano en `geoserver/estilos/` | Leyenda con clases por GetLegendGraphic y generalización por escala | Estilos por defecto (no muestran clases) |
| Administración BD | pgAdmin 4 de escritorio | El equipo ya lo usa en los labs; útil para capturas del informe | Contenedor `dpage/pgadmin4` (descartado: problemas de cookies del navegador y un servicio más) |
| Visor web | **Vite + React + TypeScript + OpenLayers**, con HeroUI v3 (Tailwind 4) y componentes de Aceternity UI | React para los paneles (lo eligió el equipo); OpenLayers trae nativo todo lo que pide A.3 (ver tabla siguiente). Diseño y decisiones en [plans/visor-a3.md](plans/visor-a3.md) | Leaflet (WFS-T y WMS GetFeatureInfo dependen de plugins poco mantenidos); MapLibre (orientado a teselas vectoriales, sin WFS-T) |
| Proxy web | Proxy de Vite en desarrollo; Nginx en Compose para la demo | Mismo origen que GeoServer: evita CORS y no expone credenciales de WFS-T | Habilitar CORS en GeoServer (más configuración, mismo resultado) |
| Análisis B | SQL en PostGIS, verificado en QGIS | Resultados reproducibles y auditables; QGIS da las capturas | Solo geoprocesos manuales en QGIS (difíciles de repetir) |
| Mapa C | Compositor de impresión de QGIS 4.2 (proyecto `.qgz` versionado) | Herramienta de diseño cartográfico de la materia; exporta PDF A4 | Imprimir desde el visor web (sin control cartográfico) |

### Cómo cubre OpenLayers cada requisito de A.3

| Requisito | Implementación |
|---|---|
| Navegación | `ol/Map` con controles por defecto y zoom a extensión |
| Activar/desactivar capas | Panel propio de capas WMS (o `ol-layerswitcher`) |
| Leyenda y escala | `GetLegendGraphic` de GeoServer + `ol/control/ScaleLine` y denominador de escala |
| Consulta por punto | WMS `GetFeatureInfo` sobre las capas visibles |
| Consulta por rectángulo | `ol/interaction/DragBox` → WFS `GetFeature` con filtro BBOX, con límite de entidades |
| Medición de distancias | `ol/interaction/Draw` + `ol/sphere.getLength` (geodésica, no grados) |
| Alta de entidades | `ol/interaction/Draw` + formulario de atributos → WFS-T `Insert` (`ol/format/WFS.writeTransaction`) |

## Datos: lo que ya se verificó

Relevamiento hecho sobre `SIG_IGN2011` con el `ogrinfo` incluido en QGIS:

- 47 shapefiles, 1 GB en total. Todas las capas inspeccionadas usan WGS84 geográfico.
- Codificación: 46 DBF declaran Windows‑1252 en su cabecera y `Provincias` trae `.cpg` UTF‑8; GDAL las interpreta solo. Verificar acentos y eñes después de cargar.
- Hay nombres con acentos (`Líneas_de_Conducción_Ene`, `Señalizaciones`). macOS y Windows normalizan Unicode distinto: los nombres de tabla se normalizan a `snake_case` ASCII.
- Capas grandes: `Curvas_de_Nivel` (164 MB), `Red_Vial` (118 955 tramos). WFS sin filtro sobre ellas no es viable en el navegador.
- **RN11**: `Red_Vial.Nro_Ruta = '11'` mezcla la ruta nacional con rutas provinciales 11 de otras provincias. El filtro correcto es `Nro_Ruta = '11' AND Administra = 'Nacional'`, recortado con el polígono de Chaco (`Provincias.provincia = 'Chaco'`).
- **Población**: en Chaco hay 425 localidades y solo 90 tienen `CantHab` cargado (suman 811 992 hab.). El faltante se documenta como limitación del dato.
- **Puentes**: son puntos (3852; tipos: vehiculares, colgantes, viaductos, túneles). Un punto casi nunca cae exactamente sobre la línea, así que se usa una tolerancia (`ST_DWithin`) y se valida a ojo en QGIS.

## Metodología del análisis B (propuesta)

- Longitud: `ST_Length(geom::geography)` de la RN11 recortada a Chaco, en km. Contraste con una proyección POSGAR 2007 / Argentina faja 5 (EPSG:5347).
- Franjas excluyentes: localidades con `ST_DWithin(geography, 10 000 m)` → franja 1; dentro de 20 km pero no de 10 km → franja 2. Se suman `CantHab` por franja y las localidades sin `CantHab` se informan como "sin dato" (decidido).
- Puentes: puntos de `Puente_Red_Vial_Puntos` a menos de X m de la traza (X a definir viendo los datos, p. ej. 50–100 m), listados con nombre y tipo. Se contrasta con los cruces de la RN11 con `Curso_de_Agua_Hid`.
- Cada consulta queda en `analysis/` como `.sql` y sus resultados se exportan a CSV para el informe.

## Comandos

```sh
cp .env.example .env                                     # Windows: copy .env.example .env
docker compose up -d                                     # PostGIS (y GeoServer desde A.2)
docker compose run --rm gdal sh scripts/cargar.sh        # shapefiles → PostGIS (A.1)
docker compose run --rm gdal sh -c "sh scripts/control.sh > docs/control-carga.md"
docker compose run --rm publicar                         # GeoServer: workspace, stores, capas, estilos, permisos (A.2)
docker compose run --rm publicar python geoserver/verificar.py   # WMS, WFS y WFS-T → docs/verificacion-servicios.md
```

Comandos del análisis B y del visor se agregan al implementarlos.

## Estructura del proyecto

```
compose.yaml            → servicios db (PostGIS), gdal (herramientas) y, desde A.2, geoserver
.env.example            → variables de ejemplo (base, usuario, contraseña, puertos)
.gitattributes          → finales de línea LF para scripts (compañeros en Windows)
data/SIG_IGN2011/       → shapefiles originales (no se versionan)
sql/                    → SQL de inicialización de la base (se ejecutan solos con el volumen vacío)
scripts/                → inventario, carga y control con GDAL
geoserver/              → publicación y estilos SLD (A.2)
analysis/               → consultas SQL del punto B
web/                    → visor Vite + React + TypeScript + OpenLayers (A.3)
qgis/                   → proyecto QGIS y composición A4 (C)
docs/                   → consigna, spec, plan, inventario y control
```

## Estilo de código

- SQL en minúsculas con nombres `snake_case`; tablas IGN en esquema `ign`, capa editable en esquema `edicion`, resultados del análisis en `analisis`.
- TypeScript estricto, un módulo por herramienta del visor (`layers.ts`, `identify.ts`, `measure.ts`, `edit.ts`).
- Scripts ejecutados dentro de contenedores; el host solo necesita Docker (y Node para desarrollar el visor).

## Estrategia de pruebas

- Carga: script que compara cantidad de entidades por capa entre shapefile y tabla, y verifica SRID e índice espacial.
- Servicios: `GetCapabilities`, `GetMap`, `GetFeature` y `GetLegendGraphic` de cada capa responden sin excepción OGC.
- Visor: pruebas unitarias con Vitest para armado de URLs/filtros; prueba manual guiada (checklist) de las siete funciones de A.3 para el informe.
- Análisis: resultados reproducibles al correr dos veces; contraste visual en QGIS.
- Persistencia: reiniciar contenedores y comprobar que datos, capas y entidades cargadas siguen.

## Límites

- **Siempre:** conservar los datos originales intactos; versionar scripts, estilos, SQL y proyecto QGIS; documentar cada decisión metodológica en el informe.
- **Consultar antes:** editar capas originales del IGN; agregar fuentes de datos externas; cambiar versiones mayores de imágenes.
- **Nunca:** versionar `.env`, volúmenes o credenciales reales; medir distancias en grados; exponer WFS-T sin autenticación.

## Criterios de éxito

- [ ] Las 47 capas están en PostGIS con SRID 4326, índice espacial y misma cantidad de entidades que el shapefile.
- [ ] Todas se publican en GeoServer y responden WMS y WFS; QGIS las consume como cliente.
- [ ] El visor cumple las siete funciones de A.3 contra GeoServer.
- [ ] Una entidad cargada desde el visor persiste en PostGIS y aparece después de reiniciar.
- [ ] El punto B tiene longitud en km, población por franja (con aclaración de cobertura) y lista de puentes, reproducibles con un comando.
- [ ] El PDF A4 incluye título, mapa principal, mapa de ubicación, leyenda, escala gráfica y numérica, norte, fuente, sistema de referencia y autores.
- [ ] Un integrante con Windows levanta todo desde cero siguiendo solo el README.

## Decisiones tomadas

- Equipo de 3 integrantes.
- Localidades sin `CantHab`: se informan como "sin dato".
- Capa para altas desde el visor: `edicion.obras_rn11` (intervenciones sobre la RN11), creada en A.1.
- A.1 y A.2 se hacen a mano paso a paso para sacar capturas: ver [plan-a1-a2.md](plan-a1-a2.md).

## Preguntas abiertas

1. ~~¿El visor publica las 47 capas o un subconjunto curado?~~ Decidido el 29/10/2026: las 48 de GeoServer, agrupadas por tema ([plans/visor-a3.md](plans/visor-a3.md)).
2. ¿Tolerancia para asignar puentes a la RN11?
3. ¿Arquitectura (Intel o ARM) de las computadoras Windows? Las imágenes elegidas soportan ambas.
