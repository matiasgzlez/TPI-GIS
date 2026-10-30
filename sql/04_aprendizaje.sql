-- A.3: lo que aprende el buscador en lenguaje natural del visor, compartido por todo el equipo.
-- tipo = 'frase': una frase que el visor no entendió y la interpretación que eligió quien la escribió.
-- tipo = 'sinonimo': una palabra nueva para una capa (por ejemplo "riachos" → curso_de_agua_hid).
-- tipo = 'consulta': una consulta que se hizo; "usos" ordena las sugerencias por lo más consultado.

CREATE TABLE IF NOT EXISTS edicion.aprendizaje (
  gid serial PRIMARY KEY,
  tipo varchar(10) NOT NULL CHECK (tipo IN ('frase', 'sinonimo', 'consulta')),
  clave text NOT NULL,
  valor text NOT NULL,
  usos integer NOT NULL DEFAULT 1,
  actualizado timestamptz NOT NULL DEFAULT now(),
  -- Sin uso: GeoServer publica y edita por WFS-T más simple una tabla con geometría.
  geom geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS aprendizaje_tipo_clave_idx ON edicion.aprendizaje (tipo, clave);

COMMENT ON TABLE edicion.aprendizaje IS 'Frases, sinónimos y consultas que aprende el buscador del visor web';
