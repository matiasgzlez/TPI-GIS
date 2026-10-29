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
