-- Paso 9: capa propia del TPI para cargar intervenciones sobre la RN11 desde el visor web (A.3).

CREATE TABLE IF NOT EXISTS edicion.obras_rn11 (
  gid serial PRIMARY KEY,
  tipo_obra varchar(30) NOT NULL
    CHECK (tipo_obra IN ('bacheo', 'repavimentacion', 'banquina', 'senalizacion', 'puente', 'drenaje', 'otro')),
  prioridad varchar(10) DEFAULT 'media'
    CHECK (prioridad IN ('alta', 'media', 'baja')),
  estado varchar(20) DEFAULT 'relevado'
    CHECK (estado IN ('relevado', 'planificado', 'en_ejecucion', 'finalizado')),
  descripcion text,
  fecha_relevamiento date DEFAULT current_date,
  geom geometry(Point, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS obras_rn11_geom_idx ON edicion.obras_rn11 USING gist (geom);

COMMENT ON TABLE edicion.obras_rn11 IS 'Intervenciones de mantenimiento sobre la RN11 en Chaco, cargadas desde el visor web';
COMMENT ON COLUMN edicion.obras_rn11.tipo_obra IS 'bacheo, repavimentacion, banquina, senalizacion, puente, drenaje u otro';
COMMENT ON COLUMN edicion.obras_rn11.prioridad IS 'alta, media o baja';
COMMENT ON COLUMN edicion.obras_rn11.estado IS 'relevado, planificado, en_ejecucion o finalizado';
