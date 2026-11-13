# Optimización del visor (A.3)

Medido el 29/10/2026 sobre el build de producción servido por nginx (`http://127.0.0.1:8081`), con Chrome a 1440×900, sin caché del navegador. Script de medición: Playwright + Chrome DevTools Protocol (pedidos, bytes, FCP, LCP y tiempo de JavaScript durante 120 movimientos del mouse sobre el mapa).

| Métrica | Antes | Después |
|---|---:|---:|
| Pedidos al abrir el visor | 756 | 123 |
| Teselas WMS | 743 | 107 |
| Datos transferidos | 8,2 MB | 4,0 MB |
| JavaScript | 1.235 KB | 320 KB |
| CSS | 453 KB | 18 KB |
| Tipografías | 2 (69 KB) | 1 (30 KB) |
| First Contentful Paint | 308 ms | 180 ms |
| Largest Contentful Paint | 1.584 ms | 1.052 ms |
| JavaScript al mover el mouse (120 movimientos) | 62 ms | 23 ms |
| Tesela WMS p95, caché de nginx vacía / cargada | 35 ms | 182 ms / 77 ms |

La tesela p95 sube porque cada imagen ahora trae todas las capas juntas (una tesela pesa más, pero hay 7 veces menos). Con la caché de nginx cargada vuelve a bajar.

## Qué se cambió

1. **Renders innecesarios.** Las coordenadas del cursor se escriben directo en el DOM: mover el mouse ya no re-renderiza React. La visibilidad de las capas vive en el visor con suscriptores, y solo se redibuja el panel de capas.
2. **Bundle y carga diferida.** El formulario de obra y el panel de resultados se cargan recién cuando hacen falta (`React.lazy`). OpenLayers y React van en partes propias que el navegador cachea entre versiones. Los estilos de HeroUI se importan solo para los componentes que se usan.
3. **Pedidos y caché.**
   - Todas las capas prendidas se piden en **un solo WMS por tesela**, con un `SLD_BODY` que las lista en orden de dibujo (antes, un pedido por capa).
   - nginx comprime con gzip y guarda las teselas y las leyendas una hora (`proxy_cache`). Los archivos del build se cachean como inmutables.
   - Las consultas WFS y el WFS-T no se cachean (`no-store`).
4. **Consultas lentas y N+1.** Las 48 tablas tienen índice espacial GIST, así que no hay recorridos completos de tabla. La consulta por rectángulo hace un WFS por capa prendida, pero en paralelo y con límite de 50 entidades, así que no es un N+1 secuencial.
5. **Imágenes, fuentes y scripts.** Una sola tipografía variable (Instrument Sans, solo latín) y el SLD compactado (sin títulos de reglas ni parámetros con su valor por defecto).

## Las teselas van por POST

El SLD de las capas prendidas pesa 5–6 KB. En la URL, sumado a las cookies que el navegador manda a `localhost` (las de todas las apps que corren ahí), pasaba el límite de cabeceras de Node en el servidor de Vite (16 KB). La respuesta era un error 431 y el mapa quedaba vacío. Por eso las teselas y las leyendas con estilo propio se piden por POST, con el SLD en el cuerpo (`tileLoadFunction` de OpenLayers). En la URL va solo un hash corto del estilo, que es lo que usa la caché de nginx para distinguir cada combinación de capas. Probado con 14 KB de cookies en el navegador, tanto en `npm run dev` como en la demo de nginx. Además, `npm run dev` arranca Vite con `--max-http-header-size=65536`.

## Generalización por escala

A escala país el mapa se saturaba (961 ciudades rotuladas, 42.000 tramos de ríos, todas las rutas pavimentadas con el mismo peso). `web/src/estilos.ts` dibuja ahora por bandas de escala, con la misma paleta y tipografía; solo cambia qué se dibuja y con cuánto peso. Las reglas viajan en el `SLD_BODY`, así que no se toca lo publicado en GeoServer y la leyenda se actualiza sola.

| Banda | Denominador | Zoom aprox. (lat. 27° S) | Qué se ve |
|---|---|---|---|
| País | > 1:6.000.000 | ≤ 6 | Capitales y ciudades de 100.000 hab. o más con rótulo; ríos troncales por nombre; autopistas y rutas nacionales finas |
| Región | 1:6M – 1:2,5M | 7 | ríos con nombre «Río …»; + rutas provinciales; costa |
| Provincia | 1:2,5M – 1:800.000 | 8–9 | + ciudades de 20.000 a 100.000 hab. con rótulo; todos los cursos perennes; pavimentado vecinal y caminos consolidados; ciudades menores, localidades y pueblos como punto (desde 1:1,5M) |
| Local | < 1:800.000 | ≥ 10 | + acequias, canales y zanjones; rótulos de ciudades menores y localidades; parajes con rótulo desde 1:300.000 |

- La jerarquía de `localidades` es el tamaño real (`canthab`: 4 / 6 / 8 px) y los rótulos se ordenan por población (`Priority`) con `spaceAround` para que no se pisen.
- El panel de capas avisa «Aparece al acercarse» en una capa prendida que a la escala actual no dibuja nada, con un botón que acerca hasta donde aparece (`escalaMinima`). La barra de estado muestra el nombre de la banda junto a `1:N`.
- El SLD crece unos 3 KB; viaja por POST y el hash `ESTILO` cambia, así que la caché de nginx se renueva sola.
- `geoserver/estilos/localidades.sld` y `red_vial.sld` no se tocaron: el estilo publicado sigue siendo el de A.2.
