-- Paso 6: pasa los nombres de columnas del esquema ign a minúsculas sin acentos
-- (situación -> situacion). Se ejecuta después de cada carga con: CALL ign.normalizar_columnas();

CREATE OR REPLACE PROCEDURE ign.normalizar_columnas()
LANGUAGE plpgsql
AS $$
DECLARE
  c record;
  nuevo text;
BEGIN
  FOR c IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'ign'
  LOOP
    nuevo := regexp_replace(lower(public.unaccent(c.column_name)), '[^a-z0-9_]', '_', 'g');
    IF nuevo <> c.column_name THEN
      EXECUTE format('ALTER TABLE ign.%I RENAME COLUMN %I TO %I', c.table_name, c.column_name, nuevo);
      RAISE NOTICE '%: % -> %', c.table_name, c.column_name, nuevo;
    END IF;
  END LOOP;
END;
$$;

CALL ign.normalizar_columnas();

-- Control: no debe devolver filas.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'ign' AND column_name !~ '^[a-z0-9_]+$';
