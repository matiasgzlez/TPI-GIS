#!/bin/sh
# Pasos 5 y 7: carga shapefiles del IGN en el esquema ign de PostGIS.
# Uso: sh scripts/cargar.sh Capa1 Capa2 ...   (sin argumentos carga todas las capas)
set -eu

. /tpi/scripts/comun.sh

cd /datos
[ "$#" -gt 0 ] || set -- $(ls *.shp | sed 's/\.shp$//')

for capa in "$@"; do
  tabla=$(nombre_tabla "$capa")
  geom=$(ogrinfo -ro -so -al "$capa.shp" 2>/dev/null | sed -n 's/^Geometry: //p')
  # Líneas y polígonos se pasan a multi porque el shapefile mezcla simples y múltiples;
  # los puntos quedan como Point.
  if [ "$geom" = "Point" ]; then tipo=POINT; else tipo=PROMOTE_TO_MULTI; fi

  echo "Cargando $capa ($geom) -> ign.$tabla"
  ogr2ogr -f PostgreSQL PG: "$capa.shp" \
    -nln "ign.$tabla" -nlt "$tipo" \
    -lco GEOMETRY_NAME=geom -lco FID=gid -lco SPATIAL_INDEX=GIST -lco PRECISION=NO \
    -overwrite -progress
done

# Paso 6: columnas sin acentos (situación -> situacion).
echo "Normalizando nombres de columnas"
ogrinfo -q PG: -sql "CALL ign.normalizar_columnas()" >/dev/null
echo "Listo: $# capas cargadas"
