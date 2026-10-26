# Verificación de servicios OGC

Generado el 2026-10-26 20:33 con `geoserver/verificar.py`.

| Servicio | Prueba | Resultado | Detalle |
|---|---|:---:|---|
| WMS | GetCapabilities | ✅ | 48 de 48 capas anunciadas |
| WMS | GetMap de cada capa (PNG, extensión de Chaco) | ✅ | 48 de 48 capas |
| WMS | GetLegendGraphic de las capas con estilo propio | ✅ | 5 de 5 leyendas |
| WMS | GetFeatureInfo sobre Resistencia | ✅ | devuelve: Resistencia |
| WFS | GetCapabilities | ✅ | 48 de 48 capas anunciadas; operación Transaction disponible |
| WFS | GetFeature de cada capa (GeoJSON, 1 entidad) | ✅ | 47 de 47 capas |
| WFS | GetFeature de localidades con filtro BBOX de Chaco | ✅ | 1294 localidades en el rectángulo |
| WFS-T | Insertar en obras_rn11 sin usuario | ✅ | rechazado |
| WFS-T | Insertar en red_vial (capa del IGN) como editor | ✅ | rechazado |
| WFS-T | Insertar en obras_rn11 como editor | ✅ | insertado obras_rn11.5 |
| WFS-T | Borrar el punto de prueba como editor | ✅ | borrado |

Pruebas: 11. Con problemas: 0.
