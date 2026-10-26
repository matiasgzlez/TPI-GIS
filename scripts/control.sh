#!/bin/sh
# Paso 8: control de calidad de la carga. Compara cada shapefile con su tabla en PostGIS.
# Uso: sh scripts/control.sh > docs/control-carga.md
set -eu

. /tpi/scripts/comun.sh

cd /datos

echo "| Capa | Tabla | Entidades shp | Filas PostGIS | Coinciden | Geometría | SRID | Índice GiST | Geometrías inválidas |"
echo "|---|---|---:|---:|:---:|---|---:|:---:|---:|"
errores=0
for shp in *.shp; do
  capa=${shp%.shp}
  tabla=$(nombre_tabla "$capa")
  n_shp=$(ogrinfo -ro -so -al "$shp" 2>/dev/null | sed -n 's/^Feature Count: //p')

  fila=$(ogrinfo -ro PG: -sql "
    SELECT count(*) AS n,
           count(*) FILTER (WHERE NOT ST_IsValid(geom)) AS invalidas,
           (SELECT type FROM geometry_columns
             WHERE f_table_schema = 'ign' AND f_table_name = '$tabla') AS tipo,
           (SELECT srid FROM geometry_columns
             WHERE f_table_schema = 'ign' AND f_table_name = '$tabla') AS srid,
           (SELECT count(*) FROM pg_indexes
             WHERE schemaname = 'ign' AND tablename = '$tabla' AND indexdef ILIKE '%gist%') AS gist
    FROM ign.\"$tabla\"" 2>/dev/null || true)

  n_pg=$(printf '%s\n' "$fila" | valor n)
  if [ -z "$n_pg" ]; then
    echo "| $capa | ign.$tabla | $n_shp | falta | ❌ | | | | |"
    errores=$((errores + 1))
    continue
  fi
  invalidas=$(printf '%s\n' "$fila" | valor invalidas)
  tipo=$(printf '%s\n' "$fila" | valor tipo)
  srid=$(printf '%s\n' "$fila" | valor srid)
  gist=$(printf '%s\n' "$fila" | valor gist)

  ok=✅
  [ "$n_shp" = "$n_pg" ] && [ "$srid" = "4326" ] && [ "$gist" -gt 0 ] || { ok=❌; errores=$((errores + 1)); }
  [ "$gist" -gt 0 ] && indice=sí || indice=no
  echo "| $capa | ign.$tabla | $n_shp | $n_pg | $ok | $tipo | $srid | $indice | $invalidas |"
done

echo
echo "Capas controladas: $(ls *.shp | wc -l | tr -d ' '). Con problemas: $errores."
echo "Generado el $(date '+%Y-%m-%d %H:%M')."
