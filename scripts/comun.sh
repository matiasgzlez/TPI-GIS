# Funciones compartidas por los scripts de carga y control. Se incluye con: . scripts/comun.sh

# Nombre de tabla en minúsculas y sin acentos (Líneas_de_Conducción_Ene -> lineas_de_conduccion_ene).
nombre_tabla() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
    | sed 's/á/a/g; s/é/e/g; s/í/i/g; s/ó/o/g; s/ú/u/g; s/ñ/n/g; s/Á/a/g; s/É/e/g; s/Í/i/g; s/Ó/o/g; s/Ú/u/g; s/Ñ/n/g'
}

# Valor de un campo en la salida de ogrinfo -sql (líneas "  campo (Tipo) = valor").
valor() {
  sed -n "s/^  $1 ([^)]*) = //p"
}
