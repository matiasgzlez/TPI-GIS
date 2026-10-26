#!/bin/sh
# Paso 4: inventario de las capas del SIG IGN 250.
# Uso: sh inventario.sh [carpeta]  (por defecto /datos, la carpeta montada en el contenedor)
set -eu

cd "${1:-/datos}"

echo "| Capa | Geometría | Entidades | Sistema de referencia | Codificación |"
echo "|---|---|---:|---|---|"
for shp in *.shp; do
  capa=${shp%.shp}
  info=$(ogrinfo -ro -so -al -mdd all "$shp" 2>/dev/null)
  geom=$(printf '%s\n' "$info" | sed -n 's/^Geometry: //p')
  n=$(printf '%s\n' "$info" | sed -n 's/^Feature Count: //p')
  srs=$(printf '%s\n' "$info" | sed -n 's/^[A-Z]*CRS\["\([^"]*\)".*/\1/p' | head -n 1)
  enc=$(printf '%s\n' "$info" | sed -n 's/^ *SOURCE_ENCODING=//p')
  echo "| $capa | $geom | $n | ${srs:-?} | ${enc:-?} |"
done
echo
echo "Total: $(ls *.shp | wc -l | tr -d ' ') capas"
