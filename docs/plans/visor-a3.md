# Spec: Visor SIG · RN11 Chaco (A.3)

Estado: **implementado, sin commitear**, en la rama `feature/visor-diseno` (sale de `develop`). Falta la revisión del equipo.

## Objetivo

Llevar el visor de `web/` de la base funcional a una aplicación con diseño profesional, que cumpla las seis funciones de la consigna A.3 y se pueda mostrar en la presentación sin depender de internet.

Criterio de calidad: que pueda competir en Awwwards, Webby o FWA. Cada ticket que toca la interfaz se verifica con capturas reales del navegador y se itera hasta llegar a ese nivel.

## Decisiones (grill del 29/10/2026)

| Tema | Decisión |
|---|---|
| Quién | Lo implementa Claude; el equipo revisa el PR contra `develop` |
| Estética | Pro y moderna con componentes de HeroUI v3 (Tailwind 4): switches, buscador, formularios. Componentes de Aceternity UI: Floating Dock (herramientas, con nombre visible), Glowing Effect (buscador) y Stateful Button (guardar obra). `frontend-design` para construir y `impeccable` para el pase minimalista |
| Tema | Claro y oscuro con switch; arranca según el sistema |
| Layout | Mapa a pantalla completa con paneles flotantes: capas arriba a la izquierda, dock de herramientas abajo al centro, resultados a la derecha al consultar |
| Capas | Las 48 de GeoServer, agrupadas por tema y con nombres legibles |
| Capas al iniciar | Provincias, límites, cursos y espejos de agua, red vial, localidades y obras RN11 |
| Mapa de fondo | Ninguno externo: todo sale de GeoServer |
| Buscador | Localidades por WFS; elegir una vuela el mapa hasta ella |
| Consulta por rectángulo | Sobre todas las capas visibles, con resultados agrupados por capa y un límite por capa |
| Medición | Distancia y área, con el valor en vivo mientras se dibuja |
| Alta | Puntos en `obras_rn11`, con el esquema actual (tipo, prioridad, descripción) |
| Extras | Botón "Foco RN11 en Chaco", coordenadas bajo el cursor, minimapa |
| Entrada | Vuelo de Argentina a Chaco de ~1,5 s con los paneles entrando escalonados; se puede saltar y respeta `prefers-reduced-motion` |
| Nombre | "Visor SIG · RN11 Chaco", con "IGN SIG 250 · UTN FRRe 2026" |
| Pantallas | Pulido para escritorio y proyector; usable en celular, donde los paneles pasan a hojas desde abajo |

## Requisitos de la consigna y cómo se cumplen

| Requisito | Implementación |
|---|---|
| Navegación | Arrastre, rueda y botones de zoom propios; "Ver Chaco" vuelve a la extensión inicial |
| Activar/desactivar capas | Switch por capa dentro de grupos plegables, con contador de capas prendidas por grupo |
| Leyenda | `GetLegendGraphic` de GeoServer debajo de cada capa prendida |
| Escala | Barra de escala de OpenLayers y denominador `1:N` corregido por latitud |
| Consulta por punto | WMS `GetFeatureInfo` sobre las capas visibles; resultados en el panel derecho |
| Consulta por rectángulo | `DragBox` → un WFS `GetFeature` con `BBOX` por cada capa visible, con el total y hasta 50 entidades por capa |
| Medición | `Draw` de línea o polígono; `getLength` y `getArea` geodésicos de `ol/sphere`; etiqueta en vivo |
| Alta de entidades | `Draw` de punto y formulario → WFS-T `Insert` por el proxy `/wfst` (las credenciales del editor no llegan al navegador) |

## Restricciones

- No se toca A.1 ni A.2: ni la base, ni GeoServer, ni `compose.yaml`, salvo lo que el build del visor necesite.
- Las tipografías se instalan con npm (`@fontsource-variable/*`), no se cargan de Google: la demo anda sin internet.
- `npm run build` en `web/` sin errores al cerrar cada ticket.
- Sin commits hasta que Matias lo pida.

## Fuera de alcance

- **Estilos SLD de las 43 capas que usan el estilo por defecto de GeoServer.** Son de A.2. Si después se quiere que las leyendas estén a la altura del visor, va como cambio aparte en `geoserver/estilos/`.
- Editar o borrar obras (solo alta).
- Vista guardada en la URL y exportar a CSV.

## Rediseño del 29/10/2026 (después de la primera revisión)

Matias rechazó el primer diseño (vidrio translúcido, texto chico, buscador escondido y el switch de tema roto). Decisiones nuevas:

| Tema | Decisión |
|---|---|
| Dirección | "Producto moderno": superficies sólidas (blancas en claro, grafito en oscuro), una sola elevación por sombra, nada de vidrio |
| Tamaño | Texto base 15 px, buscador de 60 px de alto, filas de capas de 46 px, herramientas con ícono y nombre visibles |
| Buscador | Barra grande fija arriba al centro. Vacío: historial y sugerencias. Al escribir: acciones, capas (con sinónimos: "ríos" encuentra Cursos de agua) y lugares por WFS |
| Capas | "Apagar todas", "Restablecer" y un switch por grupo además del de cada capa |
| Tema | Control segmentado Claro/Oscuro (el switch anterior no tenía la parte clickeable de HeroUI) |
| Rendimiento | Un solo WMS por tesela, gzip y caché en nginx, carga diferida; ver [optimizacion-visor.md](../optimizacion-visor.md) |

## Decisiones tomadas al implementar

- **Estilos por `SLD_BODY`.** Cursos y espejos de agua, límites e islas usan en GeoServer el estilo por defecto (azul puro, gris con borde negro), que tapaba todo. El visor manda su propio SLD en cada pedido WMS y en `GetLegendGraphic` (`src/estilos.ts`). Por eso pide las capas sin prefijo de workspace: el `SLD_BODY` tiene que nombrar la capa igual que `LAYERS` en el servicio virtual `/tpi/wms`.
- **Tema oscuro por filtro CSS.** Las teselas de GeoServer están pensadas para fondo claro: en oscuro se invierten y se rota el tono (`.capa-wms`), y las leyendas reciben el mismo filtro para seguir coincidiendo con el mapa.
- **RN11 recortada a Chaco con WKT literal.** GeoServer no tiene la extensión `querylayer`, así que el polígono de Chaco (simplificado a ~120 vértices) va dentro del `CQL_FILTER`. En CQL sobre EPSG:4326 el orden es latitud longitud. Devuelve los 68 tramos de la consulta SQL; el visor muestra "≈ 173 km" (tramos enteros, geodésica en el cliente) y deja la cifra oficial para la parte B.
- **Entrada como zoom puro** centrado en Chaco, desde un nivel y medio más afuera: a escala país GeoServer tarda segundos en dibujar y el vuelo con desplazamiento mostraba teselas desalineadas.

## Tickets

- [x] **T1 · Base de diseño.** Tailwind 4 + HeroUI v3 + tipografías locales; tokens de color para claro y oscuro con switch; layout con el mapa a pantalla completa y los paneles flotantes vacíos; sin OSM. Catálogo de las 48 capas agrupadas por tema en `config.ts`.
  Verificación: build y capturas en claro y oscuro.
- [x] **T2 · Panel de capas.** Grupos plegables, switch por capa, leyenda al prender, contador por grupo. Barra de estado con escala, denominador y coordenadas; minimapa.
  Bloqueado por: T1.
- [x] **T3 · Dock y consultas.** Dock de herramientas (navegar, punto, rectángulo, medir, nueva obra) con atajos de teclado. Consulta por punto y por rectángulo multicapa; panel de resultados por capa con tarjetas que resaltan la entidad en el mapa.
  Bloqueado por: T1.
- [x] **T4 · Medición.** Distancia y área con etiqueta en vivo y total al terminar.
  Bloqueado por: T3.
- [x] **T5 · Alta de obras.** Formulario de HeroUI anclado al punto; guardado por WFS-T y la capa se refresca; error visible si falla.
  Bloqueado por: T3.
- [x] **T6 · Buscador y Foco RN11.** Buscador de localidades con autocompletado por WFS (`nombre ILIKE`, provincia como subtítulo) que vuela al resultado. Botón "Foco RN11" que vuela a Chaco y resalta la traza (`nro_ruta = '11' AND administra = 'Nacional'`, que intersecta Chaco: 68 tramos).
  Bloqueado por: T1.
- [x] **T7 · Entrada, movimiento y celular.** Entrada animada, transiciones de los paneles y hojas desde abajo en pantallas chicas.
  Bloqueado por: T2–T6.
- [x] **T8 · Pase de calidad.** `impeccable` en modo minimalista: auditar jerarquía, espaciado, tipografía, contraste en los dos temas y estados vacíos, de carga y de error, con capturas y ciclos de mejora hasta el estándar.
  Bloqueado por: T7.

Después de los tickets: code review contra esta spec, actualización de README y SPEC, y el resumen para el Google Doc del equipo.
