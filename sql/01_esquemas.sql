-- Paso 3: extensiones y esquemas de la base del TPI.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;  -- para normalizar nombres de columnas (paso 6)

CREATE SCHEMA IF NOT EXISTS ign;
COMMENT ON SCHEMA ign IS 'Capas originales del SIG IGN 250';

CREATE SCHEMA IF NOT EXISTS edicion;
COMMENT ON SCHEMA edicion IS 'Capas propias del TPI, editables desde el visor web';

SELECT postgis_full_version();
