# Spec: visor de nivel premio, con modo simple y modo profesional (A.3, tercera etapa)

Estado: **aprobado, en curso en `develop`** (13/11/2026). Entrega del TPI: 01/12/2026.

## Objetivo

Complementar las consignas del TPI (sin reemplazarlas) con un visor que:

- en **modo simple** lo pueda usar cualquiera, "hasta un nene de 5 años";
- en **modo profesional** tenga más herramientas, más datos en pantalla y más jerarquía visual;
- en los dos modos tenga **todas** las funciones;
- apunte al nivel de Awwwards, Webby o FWA.

## Decisiones (grill del 13/11/2026)

| Tema | Decisión |
|---|---|
| Rama | `feature/rutas-nacionales` llevada a `develop` (fast-forward). Todo se trabaja en `develop`, sin commits hasta que Matias lo pida |
| Prioridad | T0 (arreglos de Gastón) → modos → PDF → mapa de calor → tabla → resto → 3D. Lo que no llegue se corta |
| Modos | Una sola app con un interruptor Simple ↔ Profesional siempre visible. El estado (capas, zoom, selección) se comparte. La primera vez que alguien entra elige el modo en dos tarjetas, y la elección se recuerda |
| Capas en modo simple | Temáticas y, dentro de cada una, tarjetas de capa con miniatura WMS real. Un toque en la temática la abre con sus capas apagadas y un botón "Mostrar todo" (decidido el 14/11, en lugar de prender todo al tocar). Si una temática tiene una sola capa, se prende directo |
| Modo profesional | Tres zonas, como un QGIS moderno: sidebar de capas a la izquierda (Aceternity Sidebar, colapsable), inspector a la derecha (atributos y leyenda) y cajón inferior con la tabla (HeroUI Drawer + Table) |
| Modo simple | Botones grandes con dibujo, lenguaje sin jerga (nada de WMS, WFS ni "feature") y una guía de primeros pasos que se puede repetir |
| Estética | Evolucionar la actual ("Producto moderno": HeroUI v3 + Aceternity, claro y oscuro, resortes) |
| Timelapse | Descartado: el SIG 250 no tiene datos con fechas (todo es de 2010). Se reemplaza por la animación de distancia (T5) |
| Perfil de elevación | Descartado: a lo largo de la RN11 en Chaco no hay alturas (3 curvas sin cota y ningún punto acotado) |
| Modo Presentación | Descartado |
| PDF | Mapa de la vista actual y resultados de consultas. **No** es la entrega de la parte C, que se hace en QGIS |
| Datos | Por WFS, nunca directo a PostgreSQL |
| 3D | deck.gl, cargado solo al abrir la vista 3D |

## Verificación de cada ticket

- `npm run build` sin errores.
- Capturas de los dos modos, en claro y oscuro, a 1366×768, 1536×864 y 2560×1440 (ver "Criterios de calidad").
- Rendimiento comparado con [optimizacion-visor.md](../optimizacion-visor.md), sin retrocesos.
- Rondas de autocrítica hasta que no quede nada que pulir.
- **Revisión independiente**: agentes que no participaron del desarrollo evalúan el ticket con los criterios de Awwwards (diseño, usabilidad, creatividad, contenido) y de accesibilidad. El ticket no se cierra hasta que pase.
- Las consignas A.3 siguen cumpliéndose en los dos modos: navegación, activar y desactivar capas, leyenda y escala, consulta por punto y rectángulo, medición y alta de entidades.

## Criterios de calidad para los revisores independientes

Todo agente que verifique un ticket o una corrección lee esta sección entera y evalúa contra ella.

**Estándar.** El visor apunta a un nivel que pueda ganar premios en Awwwards, Webby o FWA. No alcanza con "funciona" ni con "está prolijo".

**Jurado Awwwards**: puntaje de 1 a 10 en cada criterio.
- Diseño (40 %): jerarquía visual, tipografía, color, espaciado, coherencia entre claro y oscuro.
- Usabilidad (30 %): se entiende sin explicación, hay respuesta a cada acción y se puede usar en el celular.
- Creatividad (20 %): algo que lo distinga de un visor GIS genérico.
- Contenido (10 %): textos claros, en castellano y sin jerga donde no corresponde.

**Webby y FWA**: interacción y movimiento fluidos (resortes, nada que salte), detalle en los estados (carga, vacío, error) y sensación de producto terminado.

**Modo simple** (desde T1): lo tiene que poder usar un nene de 5 años. Nada de jerga (WMS, WFS, capa, feature), botones grandes con dibujo y una guía de primeros pasos.

**Modo profesional** (desde T1): más herramientas y más jerarquía visual, con la misma calidad. Los dos modos tienen todas las funciones.

**Consignas del TPI que nunca se pueden romper.** Están en [consignas.md](../consignas.md), parte A.3, y se cumplen en los dos modos:
- navegación (paneo y zoom);
- activar y desactivar capas;
- leyenda y escala visibles;
- consulta por punto y por rectángulo;
- medición de distancias;
- alta de una entidad con geometría y atributos (obras_rn11 por WFS-T).

Las partes B y C no se tocan. El tablero de la RN11 tiene que coincidir con los "Números de referencia" de [visor-inteligente.md](visor-inteligente.md).

**Restricciones**:
- La demo anda sin internet: nada de servicios externos.
- Los datos van por los servicios OGC de GeoServer, nunca directo a PostgreSQL.
- Ni commits ni PRs.

**Verificación mínima**:
- `npm run build` sin errores y sin errores en consola.
- Capturas en tema claro y oscuro, de cada modo que exista, en los tamaños donde se usa el visor (decisión del 13/11/2026):
  - **1366×768**: notebook chica, el caso más exigente de espacio;
  - **1536×864**: notebook de 15";
  - **2560×1440**: tele 2K de la presentación. Todo tiene que verse correctamente: nada diminuto ni perdido en el espacio, texto legible a distancia y paneles proporcionados.

  El celular y los anchos intermedios están fuera de alcance: no se verifican ni cuenta como problema lo que pase solo ahí.
- Rendimiento comparado con [optimizacion-visor.md](../optimizacion-visor.md), sin retrocesos.
- Accesibilidad WCAG 2.2 AA: teclado, foco visible, contraste y nombres accesibles.

**Batería de regresión** (`web/scripts/verificar/`, desde el 14/11). Antes de probar a mano, el revisor corre, desde `web/`:

```
npm run verificar -- --salida <carpeta del scratchpad>                  # nivel rápido, ~1 min
npm run verificar -- --nivel completo --salida <carpeta del scratchpad> # cierre de ticket, con alta por WFS-T
```

- Hace el build y mide sobre nginx (`http://localhost:8081`, el build que se presenta). Para no hacer el build se usa `--sin-build`. Para correr solo algunas pruebas, `--solo vista,tablero,consignas,teclado,rendimiento`.
- Corre en paralelo y espera por condiciones, nunca con pausas fijas: el fin de la entrada (`data-entrada="lista"`), el dibujo completo del mapa y las respuestas resueltas.
- Cubre las consignas A.3, el tablero contra los números de referencia, la escala gráfica, el texto guía del buscador y el teclado (diálogos modales, atajos, Tab atrapado y foco de vuelta). También corre axe y mide el rendimiento contra optimizacion-visor.md, con consola, red y respuestas ≥ 400 en cada página.
- Deja `informe.json` y capturas con nombres fijos. Termina con código 1 si hay fallas; los avisos no bloquean.
- Un chequeo de la batería que falla es un hallazgo, pero el revisor lo confirma a mano antes de reportarlo: puede ser la prueba y no la app. Si hace falta, también se corrige la batería.

**Dos niveles de verificación**:
- **Cierre de ticket.** Batería en nivel completo, más la revisión de diseño: puntajes Awwwards, capturas propias de los dos modos en los tres tamaños y claro y oscuro, y todo lo de esta sección.
- **Verificación de una corrección.** Batería en nivel rápido como red de regresión. Después, el revisor dedica su tiempo a atacar solo lo corregido, con sus propias pruebas: casos límite, repeticiones y combinaciones que la batería no cubre. Tope orientativo: 15 minutos. No hace falta repetir la matriz entera ni los puntajes.

En los dos niveles, el revisor es un agente nuevo y da un veredicto explícito.

**Qué entrega el revisor**:
- Para cada punto pedido: sí, parcial o no, con evidencia (captura o paso concreto).
- Puntajes Awwwards.
- Veredicto explícito: **APROBADO** o **NO APROBADO**. Es aprobado solo si no hay regresiones, todo lo pedido está en "sí" y no se rompe ninguna consigna.
- Problemas priorizados, con evidencia y arreglo concreto. Los del ticket van separados de los de tickets futuros.

El revisor no edita el repo. Sus capturas van al scratchpad de la sesión.

## Tickets

Estados: `propuesto` · `aprobado` · `en curso` · `hecho` · `descartado`.

- [x] **T0 · Arreglos de Gastón** — `hecho` (aprobado en la quinta revisión independiente, 13/11)
  - Niveles de detalle por escala: de lejos solo provincias, rutas nacionales, ríos grandes y ciudades grandes; el resto aparece al acercarse. Las capas prendidas pero ocultas por escala se marcan "visible al acercarte".
  - Panel de capas más minimalista.
  - Detalles de la RN11 en todas las rutas nacionales (revisar qué falta de lo hecho en `c6b8068`).
  - Minimapa de abajo: diagnosticar y arreglar.
  - Selección de habitantes "rara": diagnosticar y arreglar.
  - Se mantiene la selección con rectángulo, que funciona bien.

  **Hecho el 13/11 (falta cerrar la revisión independiente):**
  - *De lejos*: se cortaron dos fuentes de ruido.
    - Arroyos solo desde 1:1.500.000. Entre 1:1.500.000 y 1:2.500.000, solo los "Río …" permanentes; más lejos, solo los troncales.
    - Lagunas intermitentes, bañados y esteros ocultos a escala región o más lejos, y rutas provinciales ocultas a escala región.
  - *Nombres de provincia*: se repetían en cada tesela WMS. Ahora los pinta el visor, una vez por provincia, desde `web/src/provincias.ts`: los puntos salen de `ST_PointOnSurface` en PostGIS.
  - *Panel de capas*:
    - Los grupos arrancan cerrados y dicen qué tienen prendido.
    - "Leyenda y ajustes" se abre a pedido.
    - Las filas son más compactas y los conjuntos van en una sola fila deslizable.
  - *Todas las rutas*: el tablero ya servía para cualquier ruta nacional con doble clic. Ahora el buscador entiende "ruta 16" o "rn 81 en formosa" y ofrece la ruta en cada provincia por la que pasa, con la lista sacada de PostGIS.
  - *Minimapa*:
    - Antes, pasar el mouse movía el mapa principal y lo dejaba en otro lado. Ahora el paso muestra un recuadro punteado, el clic vuela hasta ahí y arrastrar recorre.
    - Nunca queda más cerca que el mapa principal.
  - *Habitantes*:
    - Burbujas con área proporcional a la población, y anillo hueco para las localidades sin dato. Una leyenda en el tablero explica cómo leerlas.
    - La localidad tocada queda elegida: la fila se marca y aparece una etiqueta con nombre y habitantes en el mapa.
    - El acercamiento ahora es a escala de departamento y no de calle. Las franjas se aclaran de cerca.

  **Revisión independiente (13/11): Diseño 7 · Usabilidad 6 · Creatividad 6 · Contenido 6.**

  Corregido después de la revisión:
  - La etiqueta de la localidad elegida quedaba tapada por la traza. Ahora va en la capa de foco y tapa el rótulo del WMS.
  - Los rótulos de provincia chocaban con los de ciudad a escala país. A esa escala callan las ciudades.
  - En la vista inicial no aparecía "CHACO". Ahora se ve desde 1:1.600.000.
  - El minimapa era todo naranja de cerca. Ahora Chaco va en gris oscuro.
  - El minimapa no se podía usar con teclado. Ahora tiene foco y responde a las flechas.
  - En el celular no había escala visible. Ahora hay una escala compacta.
  - Escape no limpiaba el buscador. Ahora lo limpia.
  - A escala país las burbujas formaban un manchón. Ahora se ocultan a esa escala.

  Pendiente, con el ticket donde se resuelve:
  - ~~**(T0)** La consulta por punto o rectángulo devolvía entidades que a esa escala no se dibujan.~~ **Hecho (opción 1, 13/11): la consulta devuelve solo lo que se ve.**
    - Punto y cartel: GetFeatureInfo por POST con el mismo SLD de las teselas. GeoServer aplica las reglas del estilo con sus filtros y escalas.
    - Rectángulo y "en esta vista": WFS 1.1.0 por POST con un filtro OGC (BBOX + el OR de las reglas activas a esa escala), generado con `filtroVisible()` en `estilos.ts`. Si la capa no se dibuja a esa escala, no se consulta.
    - El denominador que decide es el de GeoServer: la resolución del **nivel de teselas** que se pide, con el método OGC en EPSG:3857 (`denominadorWms`). La barra de escala sigue mostrando el real, corregido por latitud.
    - Primero se usó la resolución de la vista, y eso estaba mal: con zoom fraccionario cae entre dos niveles. En la vista inicial el filtro trabajaba a 1:2,63M, mientras las teselas se dibujaban a 1:2,18M. El rectángulo traía solo 5 cursos y no los ríos con nombre que se ven, como Río De Oro y Río Tragadero. Lo encontró la segunda revisión independiente.
    - Prueba corregida, en la vista inicial y sobre el este de Chaco:
      - Sin filtro, el WFS trae 423 cursos y 555 espejos.
      - Con el filtro, el rectángulo trae 28 cursos (los ríos con nombre que se dibujan) y 257 espejos (con las lagunas intermitentes visibles).

  Segunda revisión independiente (13/11): **NO APROBADO**. Diseño 7,5, Usabilidad 7, Creatividad 6,5 y Contenido 7. Corregido después:
  - La escala del filtro (ver arriba). "Aparece al acercarse" ahora acerca hasta el nivel de teselas donde la capa empieza a dibujarse.
  - El conjunto Hidrografía ensuciaba la vista de lejos: hidrófila e infraestructura hídrica salían con el estilo por defecto de GeoServer. Ahora tienen estilo propio con escala.
  - Las burbujas tapaban los rótulos del WMS ("●ontana", "R★Resistencia"). Con el tablero abierto, el WMS calla los rótulos de localidades. Los nombres los pinta el visor en una capa propia, por encima de la traza y de las burbujas, con declutter.
  - Muy de lejos (1:62M), el recuadro cubría el minimapa y la etiqueta de la elegida flotaba. Ahora el minimapa se desvanece más lejos que 1:28M y la etiqueta se oculta junto con las burbujas.

  Tercera revisión independiente (13/11): **NO APROBADO**. Diseño 7,5, Usabilidad 6, Creatividad 6,5 y Contenido 7. Las correcciones anteriores pasaron. Corregido después:
  - **La vista volvía sola a Chaco.** El atajo para saltear la animación de entrada seguía escuchando el primer clic o la rueda para siempre. Después de "Acercar", del minimapa, del buscador o de "Ver RN11", el primer toque devolvía la vista a Chaco. Era un bug anterior a T0. Ahora los escuchas se quitan cuando termina la entrada.
  - Resistencia no tenía rótulo: a 15 km de Corrientes, perdía el conflicto de rótulos. Ahora las capitales tienen prioridad sobre cualquier ciudad, y la del Chaco sobre las demás capitales.
  - El cartel quedaba clavado después de un vuelo. Ahora al moverse el mapa se cancela también el pedido en curso.
  - La banda de escala ("Local", "Provincia") se calculaba con la escala real. Ahora usa la de lo que se dibuja (nivel de teselas).

  Para T1: a 1100 px el texto guía del buscador se corta, y a 1:37M–62M los nombres de provincia se pisan entre sí.

  Cuarta revisión independiente (13/11): **NO APROBADO**. Diseño 7,5, Usabilidad 6,5, Creatividad 6,5 y Contenido 7. Sin regresiones; la vista ya no vuelve a Chaco. Corregido después:
  - **El cartel aparecía lejos del mouse** si se movía el mouse durante un vuelo, por ejemplo al tocar una localidad del tablero. Ahora no se pregunta mientras el mapa vuela, y se descarta toda respuesta pedida antes del último movimiento (contador de movimientos).
  - **Resistencia perdía el rótulo a 1:136k**, justo donde aterriza el buscador. El rótulo cruzaba el borde de una tesela y GeoServer lo descartaba (partials=false). Ahora los nombres de las 21 capitales los pinta el visor (`CAPITALES` en `provincias.ts`, sacadas de PostGIS); la estrella sigue en el WMS. En el declutter de OpenLayers gana el zIndex más alto, así que las capitales van por encima de los nombres de provincia y Resistencia por encima de Corrientes. Verificado de 1:121k a 1:7,7M.

  Para T1: Corrientes no se rotula a 1:1,22M, porque cede ante Resistencia. Hay que vigilar el JS que corre al mover el mouse (pasó de 23 a 29 ms).

  Quinta revisión independiente (13/11): **T0 APROBADO**. Diseño 7,5, Usabilidad 7, Creatividad 6,5 y Contenido 7 (ponderado ≈ 7,1).
  - **Cartel:** en 16 vuelos (tablero, minimapa y buscador) la distancia máxima entre el cartel y el mouse fue de 14 px, que es el desplazamiento fijo de la punta.
  - **Resistencia:** rotulada de 1:34k a 1:4,37M, en claro y en oscuro.
  - **Consultas:** el rectángulo inicial trae 28 cursos y 257 espejos.
  - **Tablero:** coincide con los números de referencia.
  - **Build y consola:** el build pasa y la consola queda limpia.
  - **Red:** ningún pedido a internet.
  - **JS al mover el mouse:** 24–30 ms, contra 24–26 ms en HEAD con el mismo servidor. No es retroceso de T0.

  Lo que quedó anotado y no bloquea:
  - (T1) Con el tablero abierto, un lugar elegido en el buscador que no está sobre la ruta (por ejemplo Charata) queda sin nombre, porque el WMS calla los rótulos. Además, la fila de la última localidad tocada sigue marcada. El buscador debería usar la etiqueta de foco y limpiar la selección del tablero.
  - (T1) San Miguel de Tucumán, Rawson y Río Gallegos no son "Capital" en el IGN: no tienen estrella ni rótulo de capital. Hay que sumarlas a `CAPITALES`.
  - **(T1)** En el celular, "Nueva obra" queda fuera de pantalla en la barra de herramientas y nada indica que se puede desplazar.
  - **(T1, modo pro)** La dona de población no dice nada cuando una franja tiene el 98 %. Cambiarla por una barra apilada.
  - **(T1)** La cabecera del tablero no tiene separación al desplazar, y los "Sin Nombre" repetidos meten ruido en la lista.
  - **(Fuera de T0)** La RN16 en Chaco da 0 puentes y su traza tiene un hueco al noroeste. Revisar si son datos del IGN o el análisis, y avisar en el tablero cuando la traza está cortada.
- [x] **T1 · Modo simple y modo profesional** — `hecho` (aprobado en la octava revisión independiente, 14/11)
  - Interruptor, estado compartido y pantalla "¿Cómo querés usarlo?".
  - Simple: temáticas → tarjetas con miniatura; botones "Medir", "¿Qué hay acá?", "Buscar un lugar", "Agregar obra" e "Imprimir"; vocabulario sin jerga; leyenda con dibujos; guía de primeros pasos en 3 burbujas.
  - Profesional: las tres zonas; todas las capas en árbol con miniatura; coordenadas, escala y herramientas a la vista.
  - Bloqueado por: T0.

  **Hecho el 13/11:**
  - *Infraestructura de modos*:
    - `interfaz.ts` tiene el contexto Simple/Pro, el vocabulario de cada modo (`useVoz`) y las 9 temáticas del modo simple, con nombres de todos los días. Las 48 capas están, cada una una sola vez.
    - La preferencia `interfaz` y la guía vista se guardan en el navegador.
    - El interruptor Simple/Pro está siempre visible y también en Configuración.
    - La primera vez aparece la bienvenida "¿Cómo querés usar el mapa?", con dos tarjetas.
  - *Miniaturas*:
    - `web/scripts/miniaturas.ts` genera las 48 con GeoServer y las mismas reglas del visor sin escalas (`sldMiniatura`), en `web/public/miniaturas/` (1,2 MB, carga diferida).
    - Las capas con pocos datos en Chaco se encuadran sobre su propia extensión, y las de elementos chicos sobre el Gran Resistencia.
    - En tema oscuro llevan el mismo filtro que el mapa.
  - *Modo simple*:
    - "¿Qué querés ver?": temáticas y, dentro de cada una, tarjetas con miniatura, nombre y una frase. Avisa "Se ve de más cerca" y explica "¿Qué significa cada color?".
    - Botones grandes con dibujo: Mover, ¿Qué hay?, Zona, Medir (qué tan lejos o qué tan grande) y Obra. Mientras una herramienta está activa, una burbuja dice qué hacer y hay un botón "Listo".
    - Referencias (la leyenda de todo lo que se ve) y la escala a la vista.
    - Guía de primeros pasos en 3 burbujas, con la pantalla oscurecida y el elemento iluminado. Se repite desde el botón de ayuda.
    - Vocabulario sin jerga en resultados, tablero y cartel ("cosas", "temas", "pueblos", "Qué tan larga es").
    - En el celular, "¿Qué querés ver?" se abre como hoja desde abajo.
  - *Modo profesional*:
    - En escritorio, tres zonas: barra lateral de capas con miniaturas (plegable); inspector a la derecha con "Información" (resultados, mediciones o tablero) y "Leyenda" (todas las capas prendidas, con su nombre en GeoServer); barra de estado al pie con escala, banda, coordenadas, SRS y capas prendidas.
    - Barra de herramientas arriba, con familias y atajos.
    - En el celular se usa la disposición flotante.
  - *Pendientes de T0 resueltos*:
    - En el celular el dock muestra las seis herramientas, solo con íconos.
    - La dona del tablero pasó a barra apilada con el total.
    - La cabecera del tablero se separa al desplazar.
    - "Lugar sin nombre" reemplaza a los "Sin Nombre".
    - Un lugar del buscador con el tablero abierto lleva su etiqueta, y la fila elegida se limpia.
    - San Miguel de Tucumán, Rawson y Río Gallegos tienen estrella y nombre de capital, pintados en el visor.
    - El texto guía del buscador se acorta en pantallas angostas.
  - *Márgenes del encuadre*: dependen de la disposición a la vista (`ponerDisposicion`).

  Primera revisión independiente de T1 (13/11): **NO APROBADO**. Simple ≈ 6,6 y Pro ≈ 6,9. No hubo regresiones de T0. Corregido después:
  - *Jerga en el modo simple*:
    - Los resultados muestran solo qué es (con el tipo del IGN traducido), cuánta gente vive y dónde queda (`datosSimples` y `nombreSimple` en `entidades.ts`). Precisión, escala y fuente quedan solo en pro.
    - El buscador del modo simple tiene títulos y subtítulos propios (`paraModoSimple`) y secciones con otro nombre.
    - El manual y el párrafo de Datos de Configuración están en versión simple.
    - "Ver la ruta 11" y "En el Chaco" en lugar de "Ver RN11" y "Traza en Chaco".
    - Las leyendas se piden a GeoServer con títulos de todos los días (`sldDeLeyenda(nombre, simple)`), y la de obras con la urgencia.
  - *Formulario de obra*: quedaba debajo del buscador. Ahora `panelIntoView` corre después de que la tarjeta tiene tamaño, con un margen de 120 px, y la pista de la herramienta se oculta mientras el formulario está abierto.
  - *Celular*:
    - La escala, Referencias (en simple) y el interruptor van en una fila fija debajo del buscador y siguen visibles con un panel abierto.
    - El menú de Referencias va en un portal: el transform de la animación de entrada atrapaba el position: fixed.
  - *Barra del modo pro*: las teclas se ven desde 1280 px y los nombres desde 1536 px.
  - *Miniaturas*:
    - en pro miden 64 px;
    - en oscuro no se invierten, solo se atenúan;
    - las capas con pocos puntos usan símbolos más grandes y las islas un relleno más visible;
    - los grupos cerrados del árbol no montan sus filas.
  - *Accesibilidad*:
    - la bienvenida y la guía dejan `inert` el resto, así el Tab no se escapa del diálogo;
    - `--tinta-3` pasó a #656b72, que da 4,9:1 de contraste;
    - el botón compacto de Referencias tiene nombre accesible.
  - *Menores*:
    - el contador de capas de la barra de estado y del riel se actualiza al cambiar las capas;
    - las capitales van primero entre los lugares del buscador, así "Rawson" ofrece primero la capital del Chubut;
    - el número animado termina en el valor exacto;
    - la ficha simple no repite el nombre.

  Segunda revisión independiente de T1 (13/11): **NO APROBADO**. Simple ≈ 6,9 y Pro ≈ 7,0. No hubo regresiones de T0. Corregido después:
  - **Formulario de obra.** Seguía tapado o fuera de pantalla, porque `panIntoView` no conoce los paneles. Se cambió el enfoque: el formulario ya no va anclado al punto, sino acoplado donde van los paneles de cada modo:
    - en pro, dentro del inspector (tiene prioridad sobre resultados y tablero);
    - en simple, en el panel de la derecha;
    - en el celular, en la hoja de abajo, con Guardar y Cancelar fijos al pie.

    El mapa centra el punto en el área libre sin cambiar el zoom. En simple el formulario dice "¿Qué hay que arreglar?" y "¿Qué tan urgente es? Mucho, Algo o Poco".
  - **Jerga.**
    - Los títulos de las respuestas pasan por `sinSiglas`.
    - "Lugar sin nombre" se usa en todas las listas.
    - Los tipos del IGN también se traducen en el gráfico de la zona.
    - "Ciudad importante de la zona" reemplaza a "cabecera".
    - El tablero ya no dice "franja".
    - Configuración usa "Líneas para ubicarse en el mapa", "Mapa chiquito de dónde estás" y "Tamaño de los botones y letras".
  - **Contraste del botón de la ruta activo.** Ahora usa `--vial-fuerte` (#b93f12 en claro y #b5400f en oscuro), que da más de 5:1 con texto blanco.
  - **Leyenda de pro.** La región que se desplaza puede recibir el foco (`tabIndex=0`).
  - **Minimapa en el modo simple.** Está desde 1280 px, junto al zoom.
  - **LCP de pro.** La barra de estado se pinta sin animación de entrada.
  - **Menores.**
    - Escape cierra la hoja del celular.
    - Las miniaturas escasas tienen símbolos de 14 px como mínimo.
    - En pro, entre 1024 y 1279 px, el inspector vacío se pliega a un botón "Leyenda" y el encuadre del mapa usa ese espacio.
    - Si se escribe otra ruta, no se proponen preguntas sobre la RN11.

  Tercera revisión independiente de T1 (13/11), ya con los tamaños nuevos (1366×768, 1536×864 y 2560×1440): **NO APROBADO**. Simple ≈ 7,2 y Pro ≈ 6,8. El formulario de obra quedó bien en 33 clics y no hubo regresiones. Corregido después:
  - **Tele 2K.**
    - Factor de pantalla (`factorPantalla` en `preferencias.ts`): desde 1900 px de ancho, la interfaz crece con el ancho, hasta 1,6× en 2560 px. A 2560 px la escala queda en 1,41.
    - El mismo factor agranda los rótulos y símbolos del WMS (`agrandarSld`: solo tamaños, las escalas de las reglas no cambian) y los del visor (`tamanoMapa`: provincias, capitales, nombres del tablero, burbujas y cuadrícula).
    - La vista de Chaco nunca queda más cerca que 1:2.100.000 (`minResolution` 600), así no aparece la maraña de caminos de tierra.
    - Las teselas son de 512 px, la cuarta parte de pedidos. La consulta por punto usa la misma grilla, para que su escala siga siendo la del dibujo.
  - **Buscador de pro a 1536 px.**
    - Los nombres y las teclas de la barra de herramientas usan consultas de contenedor, que miden el espacio útil después del zoom.
    - El texto guía se elige por el ancho real del campo, medido con ResizeObserver. A 1536 px el buscador pasó de 117 a 431 px.
  - **Contraste.**
    - El subtítulo del botón de la ruta activa va en blanco pleno.
    - `--tinta-3` pasó a #5e646b, que da AA también sobre `--superficie-3`.
  - **Modo simple.**
    - El aviso de guardado dice "¡Listo! Guardamos la obra".
    - Las cosas sin nombre se nombran por su tipo ("Escuela Provincial") y no repiten el tipo debajo.
  - **Inspector de pro.** Vacío y por debajo de 1440 px (la notebook de 1366), se pliega a un botón "Leyenda".
  Cuarta revisión independiente de T1 (13/11): **NO APROBADO**. Corregido el 13/11 (noche), después de levantar de nuevo el entorno:
  - **Escala gráfica.** Medía mal porque vive dentro de `.interfaz`, que tiene `zoom`: −12 % en la notebook y +41 % en la tele. `EscalaGrafica` (en `BarraEstado.tsx`) divide el ancho de la barra por el zoom efectivo del contenedor (`currentCSSZoom`) y pasa los anchos mínimo y máximo a píxeles del mapa. Medido en los dos modos, a 1366, 1536 y 2560: el ancho en pantalla coincide al píxel con la distancia del rótulo. Cambiar el tamaño en Configuración vuelve a dibujarla.
  - **LCP del simple en la tele.** La escala y "Referencias" se pintan sin animación de entrada, como la barra de estado de pro.
  - **Control de 20×20 en el tablero de pro.** No apareció: en el tablero y en la leyenda, en claro y oscuro, a 1366 y 2560, todos los botones miden 35 px o más. Lo único menor a 24 px es el `input` oculto de HeroUI dentro de los switches de grupo (recortado a 1 px); el área de toque es la etiqueta, de 46×30.
  - **JS al mover el mouse en pro.** La mitad era el brillo del buscador (`glowing-effect.tsx`), que medía su rectángulo en cada movimiento y forzaba un layout. Ahora guarda el rectángulo (se vuelve a medir con ResizeObserver, resize, scroll o al terminar una animación), no hace nada si el mouse está lejos y ya estaba apagado, y solo escribe `--active` cuando cambia. Las coordenadas de la barra de estado van en un `span` con `contain: strict`. En 120 movimientos: de 14 ms a 6–10 ms de JS, y ningún evento de más de 16 ms (antes, 11).
  - **Escuelas iguales.** En la lista de resultados, las cosas que se llaman igual llevan debajo el pueblo más cercano ("En Lapacho", "A 3,4 km de Playa Ford"), calculado con las localidades del IGN por WFS (`cercanias.ts`). Anda en los dos modos.
  Quinta revisión independiente de T1 (13/11): **NO APROBADO**. Simple ≈ 7,4 y Pro ≈ 7,1. Las cinco correcciones anteriores pasaron, sin regresiones; tablero, consignas, consola y red en orden. El control de 20×20 era el botón del deslizador de Opacidad (19,4 px en pantalla; cumple por espaciado). Corregido después:
  - **Nombres accesibles de la barra de pro.** Los botones se llamaban "1" a "6" (salía del `<kbd>`). Ahora tienen `aria-label` con el nombre de la herramienta, `aria-keyshortcuts` y el `<kbd>` es `aria-hidden`. Los nombres se ven desde 1780 px útiles, así aparecen en la tele (1818 útiles) y no en la notebook de 1536 (1745). Con el nombre a la vista la tecla se oculta: el buscador queda en 397 px a 2560.
  - **Superficies que no crecían en la tele.** La bienvenida (`.escalado`), la guía (`.pantalla-escalada`, con las posiciones divididas por `currentCSSZoom`), el cartel del mapa (zoom en `.cartel-mapa`) y la lista de "Tipo de obra" (tamaños con `--zoom-ui`) crecen con el resto. A 2560 el título de la bienvenida pasa de 46 a 65 px y el de la guía de 22 a 31 px; las burbujas quedan dentro de la pantalla en los tres pasos.
  - **"Sin Nombre" en pro.** Se titula con el tipo: "Escuela Provincial sin nombre" (`nombrePro` en `entidades.ts`), también en el cartel.
  - **Escape en Referencias.** Cierra el menú y devuelve el foco al botón, sin cerrar los resultados.
  - **Menores.** El botón del deslizador mide 28 px (≈ 24,6 en la notebook). En simple, el título de la respuesta usa el nombre de la temática ("Escuelas a menos de 5 km de la ruta 11 en Chaco"). En pro, el inspector vacío es una tarjeta compacta y no una columna blanca de alto completo.
  Sexta revisión independiente de T1 (14/11): **NO APROBADO**. Simple ≈ 7,5 y Pro ≈ 7,2. Pasaron las correcciones de la quinta, sin regresiones en consignas ni tablero. Corregido después:
  - **Texto guía del buscador.** Se cortaba en la tele con el tablero abierto. Ahora se elige midiéndolo con la fuente real del campo (`textoGuia` en `Buscador.tsx`): el más largo que entra. En pro, en la tele, el botón de la ruta pierde el subtítulo para dejarle lugar al buscador.
  - **Foco de la guía.** Al cerrarla (con "¡Listo!", "Saltear" o Escape) vuelve al botón de ayuda, y el Tab queda dentro de la burbuja.
  - **Bienvenida, guía, cartel y desplegable solo crecen.** Usan `max(1, --escala)` (`--zoom-ui`): en la notebook vuelven a su tamaño de antes (guía 22/16 px, bienvenida 46 px) y en la tele crecen igual.
  - **Menores.** El tilde de "Tipo de obra" escala con la lista. Las coordenadas de pro van en un bloque con `contain: strict` dentro del ítem flex: el layout al mover el mouse bajó de 5–8 a 3–4 ms cada 120 movimientos. Los grados, minutos y segundos se redondean sobre el total de segundos (antes podía salir "58°59′60″").
  Séptima revisión independiente de T1 (14/11; la primera corrida se cortó cuando la notebook se suspendió y se repitió con un agente nuevo): **NO APROBADO**. Simple ≈ 7,65 y Pro ≈ 7,15. Pasaron el texto guía (36 combinaciones), las superficies que solo crecen y los menores, sin regresiones. Corregido después:
  - **Escape no cerraba la guía con una respuesta abierta detrás** (5 de 5), y cerraba la respuesta. El oyente de teclado de la guía dependía de `onTerminar`, que App crea en cada render: el Escape de App provocaba un render a mitad del evento, la guía cambiaba de oyente y el nuevo no recibía ese evento. Ahora es un solo oyente en captura, con `onTerminar` en un ref, y la guía corta la propagación de toda tecla. Verificado 20 de 20, a 1366 y 2560.
  - **Atajos bajo los diálogos.** Con la bienvenida o la guía abiertas, el "4" activaba Medir detrás. Los atajos de App no actúan mientras hay un diálogo modal.
  - **Lista de "Tipo de obra" en la notebook.** Sus opciones eran más grandes que el valor del disparador. Ahora usan el mismo zoom que la interfaz (`--zoom-interfaz`).

  Anotado para después (no es de T1): en la vista inicial de pro a 1366, con zoom fraccionario, los rótulos de 10 px del WMS se ven a unos 7 px. En la tele, el rótulo de la cuadrícula de arriba a la derecha queda cortado por el borde.
  Octava revisión independiente de T1 (14/11): **APROBADO**. Simple 7,8 y Pro 7,25. Escape en la guía 30 de 30, atajos bloqueados bajo los diálogos, consignas y tablero en los dos modos, axe sin violaciones en 30 estados y rendimiento mejor que la línea de base (pro: LCP 136 ms contra 1.052). Retoques menores después:
  - Con "Referencias" abierto debajo de la guía, Escape cerraba las dos cosas. Ahora Referencias no toma el Escape si hay un diálogo modal encima.
  - El Tab de la bienvenida pasaba por el body. Ahora queda entre las dos tarjetas, como en la guía.
  - El valor de "Tipo de obra" va a 15 px, igual que las opciones.

  Para decidir con Matias: la decisión dice "un toque en la temática prende todas sus capas", y en la app el toque abre la temática con un botón "Mostrar todo".
  Anotado para después: las pestañas del inspector de pro usan `role="radio"` (sería mejor `tablist`), y en simple el tablero que se desplaza no tiene un degradé al pie. El JS al abrir pesa 362 KB contra 320 KB del 29/10: diferir más en T3 y T8.
  Verificación independiente de los retoques (14/11): **APROBADO**, sin regresiones (axe sin violaciones en 52 estados, tablero 12 de 12). Señaló dos problemas de teclado anteriores, corregidos después:
  - **Configuración no era modal para el teclado.** Ahora tiene `aria-modal`. Escape la cierra a ella primero (antes cerraba Referencias, que estaba detrás) y el Tab no sale de la hoja. Los atajos 1–6 no actúan mientras está abierta, y al cerrarla el foco vuelve al engranaje.
  - **Foco después de la bienvenida.** Si no viene la guía, queda en el modo elegido del interruptor Simple / Pro (antes quedaba en el body).
  Verificación independiente de esas correcciones (14/11): **NO APROBADO**. El foco después de la bienvenida pasó entero, y Escape, Tab, los atajos 1–6 y la vuelta del foco en Configuración también pasaron. Corregido después:
  - **"/" y ⌘K actuaban detrás de Configuración.** El oyente del buscador no miraba si había un diálogo. Ahora los tres oyentes globales (atajos de App, buscador y Escape de Referencias) consultan la misma función, `hayDialogoModal()` en `interfaz.ts`.
  - **El manual de Configuración no se desplazaba con teclado** (axe: scrollable-region-focusable). El área desplazable es enfocable (`tabIndex=0`, `role="region"`, con anillo de foco). Con PageDown y End llega al final en los dos modos, y axe queda sin violaciones.
  Al armar la batería de regresión (14/11) apareció un error real, ya corregido. Después de tocar un interruptor de capa, los atajos 1–6 y "/" dejaban de andar hasta tocar el mapa, porque el interruptor es un `<input>` y se lo tomaba como un campo de texto. Ahora `escribiendoEn()` (`interfaz.ts`) excluye casillas, radios y deslizadores. Además, App marca `data-entrada="lista"` en `<html>` cuando termina el vuelo de entrada, para que la batería sepa cuándo medir.
  Verificación de los atajos bajo diálogos y del manual con teclado (14/11): **APROBADO**. Retoques menores después:
  - Configuración deja de ser modal apenas empieza a salir (`useIsPresent`): antes, durante los ~0,57 s de la animación, "/", ⌘K y 1–6 se perdían y el foco quedaba en el body. Ahora el foco vuelve al engranaje enseguida.
  - El área del manual es enfocable solo en "Cómo se usa", y su anillo no baja de 2 px reales con el zoom de la notebook.
- [x] **T2 · Exportar a PDF con vista previa** — `hecho` (aprobado en la verificación independiente del 14/11, después de siete revisiones de cierre)
  - Mapa de la vista actual: A4 vertical u horizontal, título editable, norte, escala gráfica y numérica, leyenda de las capas activas, grilla de coordenadas, fuente y autores. La vista previa se actualiza en vivo.
  - Resultados de consultas y fichas de entidad: mapa, gráficos y tabla.
  - Bloqueado por: T1.

  **Decisiones (14/11, con Matias):** descarga directa del PDF, no el diálogo de impresión del navegador. Además, el toque en una temática del modo simple queda como está (abre con "Mostrar todo"), y se corrigió la decisión de arriba.

  **Hecho el 14/11:**
  - *Una ventana protagonista* (`exportar/Imprimir.tsx`; pedido de Matias el 14/11, en lugar del panel chico a la derecha). Se abre con el botón grande "Imprimir" en simple, con "Exportar a PDF" arriba en pro o con la tecla P (también en el manual).
    - Ventana grande al centro, con el mapa desenfocado detrás.
    - A la izquierda, la mesa: la hoja real, tan grande como entra, con sombra de papel y miniaturas de las páginas cuando hay más de una. Las pastillas de arriba dicen A4, la orientación, la escala y las páginas.
    - A la derecha, todo lo que se decide:
      - *textos*: título, descripción opcional y autores;
      - *hoja*: horizontal o vertical;
      - *encuadre*: lo que se veía, todo el Chaco o la ruta dibujada, con una escala redonda que se acerca o aleja de a un paso;
      - *qué mostrar*: leyenda, grilla, norte, escala gráfica y la respuesta abierta.
    - Abajo, "Descargar" con las páginas y el peso del archivo.
    - Es modal: el foco empieza en el título, el Tab no sale, Escape cierra, los atajos del visor no actúan detrás y el foco vuelve al botón que la abrió.
  - *Vista previa en vivo.* Es el PDF real dibujado con pdf.js (`exportar/VistaPrevia.tsx`): lo que se ve es lo que se descarga, igual en cualquier navegador. Cada cambio la rehace, y mientras tanto queda la imagen anterior y una pastilla avisa. Al cambiar la orientación, la hoja cambia de forma con un resorte.
  - *La hoja* (`exportar/pdf.ts`, jsPDF):
    - A4 horizontal o vertical, título editable y fecha.
    - Mapa a ~190 ppp (`exportar/mapaImpreso.ts`): un mapa de OpenLayers fuera de pantalla con pixelRatio 2. Encuadra lo que se ve sin los paneles (`extensionLibre`) en una escala redonda (1:2.500.000 y no 1:2.381.904).
    - Grilla de meridianos y paralelos con rótulos afuera del marco, norte, escala gráfica y numérica.
    - Leyenda de GeoServer a 192 ppp, que se achica sola hasta que entran todas las capas.
    - Fuente y autores (los autores se recuerdan). Texto vectorial con Instrument Sans incrustada (`src/fuentes/`, licencia OFL).
  - *Siempre en papel claro y con tamaños de notebook* (`capasParaImprimir`): aunque se exporte en oscuro o desde la tele, la paleta clara y el factor 1 se aplican solo durante cada llamada de estilo.
  - *Respuestas.* Con una consulta, una medición o el tablero de una ruta abiertos, la opción "Incluir resultados" suma páginas verticales: cifras, gráfico de barras y tabla paginada con encabezado repetido. En el tablero hay localidades por franja y puentes, y los números coinciden con los de referencia.
  - *Modo simple sin jerga.* "Imprimir el mapa", "Hoja acostada / parada", "¿Quién lo hizo?", "Qué significa cada color" y tipos traducidos. La fuente se cita sin EPSG.
  - *Peso.* jsPDF, pdf.js y la letra van en el panel de exportación (unos 270 KB comprimidos más el worker de pdf.js), que se carga solo al abrirlo. El JS al abrir el visor no cambió (365 KB).
  - *nginx* sirve los `.mjs` como JavaScript (el worker de pdf.js). Antes salían como `application/octet-stream` y el navegador los rechazaba.
  - *Batería.* La prueba `exportar` cubre:
    - la ventana modal en pantalla y la hoja protagonista (≥ 25 % de la pantalla);
    - el foco, el Tab, los atajos y axe;
    - que el encuadre, la escala, el título y la orientación rehagan la vista previa;
    - la descarga con el nombre del título y el contenido del archivo (imagen y letra incrustadas, páginas esperadas);
    - Escape y el foco de vuelta.
  Revisión independiente de cierre de T2 (14/11): **NO APROBADO**. Simple ≈ 7,3 y Pro ≈ 7,7. La ventana cumple el pedido y no hay regresiones: la escala medida en el PDF es exacta, el tablero coincide y la hoja sale clara desde el oscuro o la tele. Los retoques de T1 pasaron. Corregido después:
  - **"Lo que estás viendo" cortaba el este del Chaco.** `extensionLibre` seguía restando un panel derecho que ya no existe. Ahora recibe si de verdad hay un panel abierto (`panelAbierto`).
  - **Jerga en el PDF del modo simple.** Las páginas de respuesta usan los nombres de tema ("Rutas y caminos", "Lagunas y bañados", "Bordes"). El título de la pregunta sale igual que en el panel ("Escuelas a menos de…"), con `tituloSimple` en `interfaz.ts`, compartido por el panel y el PDF.
  - **La hoja se deformaba al girar.** La forma de la hoja sale de la orientación elegida. Un PDF de la orientación anterior no se dibuja: se funde y se espera al nuevo. El lienzo usa `object-fit: contain`.
  - **Sin estado de error.** El mapa de la hoja cuenta las teselas fallidas: si falta la mitad o más, la ventana muestra "No se pudo cargar el mapa" con "Reintentar" y no deja descargar.
  - **La escala no tenía tope.** Va de 1:50.000 a 1:10.000.000 y los botones se apagan en los extremos.
  - **Subtítulos huérfanos.** Antes de un subtítulo, de un encabezado de tabla, de las cifras o de las barras se comprueba que entre lo que encabezan; si no, pasa de página.
  - **Encuadre de la ruta justo.** Lleva 25 km de margen.
  - **Vista previa borrosa en monitores comunes.** Se dibuja al menos al doble de resolución.
  - **Teclado.** Los grupos de orientación y de encuadre se recorren con flechas (una sola parada de Tab), y Alejar, Acercar y Cerrar tienen anillo de 2 px.
  - **Además**, ⌘P / Ctrl+P abren esta ventana en lugar de la impresión del navegador.

  Para después, anotado por la revisión:
  - la leyenda del PDF no explica las franjas ni las burbujas del tablero;
  - la leyenda de GeoServer usa DejaVu;
  - en vertical queda espacio libre bajo la leyenda;
  - falta un encuadre "la respuesta";
  - la medición en el PDF muestra solo el total, sin los tramos.

  Segunda revisión de cierre de T2 (14/11): **NO APROBADO**. Simple ≈ 8,2 y Pro ≈ 8,3. Pasaron:
  - el encuadre, en 18 casos;
  - el vocabulario simple, en 16 PDF;
  - el giro, los topes de escala y los huérfanos;
  - el margen de la ruta, las flechas y ⌘P.

  Corregido después:
  - **Después de "Reintentar", el PDF salía sin leyenda.** Las leyendas se vuelven a pedir al reintentar y, si falta alguna, se avisa como error. Los errores del mapa, de la leyenda y del PDF van por separado, para que uno no borre al otro. Sin leyendas, la hoja no dibuja el título "Leyenda" suelto.
  - **La leyenda se veía rota en la vista previa con densidad 1.** La página se dibuja al triple de los píxeles reales de la hoja en pantalla (contando el zoom de la ventana) y se reduce en pasos con suavizado de calidad.
  - **El foco se perdía.** Alejar, Acercar y Descargar usan `aria-disabled` en lugar de `disabled`: siguen enfocables en los topes y mientras se arma la hoja. Después de "Reintentar", el foco va a Descargar.
  - **Las filas de una pregunta eran iguales.** Las cosas que se llaman igual llevan el pueblo más cercano ("En Lapacho", "A 14 km de Basail"), como en el panel.
  - **El error era una pastilla chica.** Ahora es un aviso centrado sobre la hoja, con ícono, explicación y un "Reintentar" grande.
  - **Menores.**
    - Escalas redondas con el 6.
    - En las miniaturas, el foco es un anillo punteado, distinto de la página elegida.
    - El escudo de la ruta no se lee en voz alta.
    - La columna "Nombre" en todas las tablas.
    - La pastilla dice la orientación de la página que se ve.
    - En un giro doble rápido, la imagen vieja no aparece mientras la hoja cambia de forma.
  - No se tocó, a propósito: los rótulos del WMS cortados en el borde del marco, que es lo normal en un mapa recortado.

  Tercera revisión de cierre de T2 (14/11): **NO APROBADO**. Simple ≈ 8,5 y Pro ≈ 8,5. Pasaron las correcciones de la segunda, salvo una parcial. El aviso de "JS al mover el mouse" es variación del entorno, no de T2. Corregido después:
  - **GeoServer colgado** (no responde, en lugar de rechazar). El mapa de la hoja cuenta las teselas pedidas: si a los 15 s llegó menos de la mitad, es error. Antes pasaba el tope de 30 s y salía una hoja vacía descargable.
  - **Descarga con la leyenda todavía en camino.** Mientras llegan las leyendas, o los pueblos cercanos de una pregunta, la hoja no se arma ni se puede descargar, y se ve "Actualizando…". Se acabó el parpadeo del botón al reintentar.
  - **Texto recién editado.** Hasta que el título, la descripción o los autores nuevos llegan a la hoja, no se puede descargar: lo que se baja es lo que se ve.
  - **La causa bajo "Descargar".** El pie dice qué falta: el mapa, la leyenda o el armado del PDF.
  - **Jerga en el error del modo simple.** Ahora dice "Puede que el servidor de mapas no esté andando. Probá de nuevo en un ratito."
  - **Además**, de los anotados para después: los nombres repetidos se buscan dentro de cada capa, así la provincia "Corrientes" no se confunde con la ciudad (en el PDF y en el panel).

  Cuarta revisión de cierre de T2 (14/11; se cortó por el límite de uso y se retomó con el mismo agente): **NO APROBADO**. Simple ≈ 8,5 y Pro ≈ 8,4. Pasaron cinco de las seis correcciones de la tercera. Encontró tres caminos nuevos para descargar un PDF incompleto o distinto de lo que se ve. Corregido después:
  - **Claves de vigencia** (`Imprimir.tsx`). El mapa, las leyendas y el PDF guardan la clave de lo que se les pidió (encuadre, escala, marco y reintento; modo y reintento; todas las opciones y textos de la hoja). Solo se arma la hoja con el mapa y las leyendas vigentes, y solo se descarga si la clave del PDF es la de lo que se está eligiendo. Resuelve:
    - la carrera "Acercar + apagar Norte" con el mapa lento, que bajaba un PDF a 1:5.000.000 mientras la ventana decía 1:4.000.000;
    - el instante habilitado después de "Reintentar".
    - La batería lo comprueba: justo después de cambiar la escala, la descarga queda bloqueada.
  - **Leyenda colgada.** Antes quedaba "Actualizando…" para siempre, incluso al reabrir, porque la promesa quedaba guardada. Ahora `cargarLeyenda` y `decode` tienen un tope de 15 s, `cargarLeyenda` comprueba la respuesta y, al vencer el tope, la leyenda cuenta como fallida: se avisa y se puede reintentar. `ubicarEntidades` tiene el mismo tope.
  - **Mapa con huecos.** Cualquier tesela fallida o que no llegó es error. Antes se toleraba hasta la mitad y salía un rectángulo vacío sobre Resistencia.
  - **Leyenda en error y "Leyenda" apagada.** Si la hoja no lleva leyenda, su error no bloquea la descarga.

  Quinta revisión de cierre de T2 (14/11): **NO APROBADO**. Simple ≈ 8,5 y Pro ≈ 8,5. Pasaron las cuatro correcciones de la cuarta; encontró tres caminos nuevos. Corregido después:
  - **Respuestas cortadas** (200 con media imagen). `imagenCompleta()` (`visor.ts`) comprueba que un PNG termine en IEND y un JPEG en FF D9. Una tesela cortada cuenta como fallida (error, con "Reintentar"). Las leyendas del PDF se piden siempre por fetch y se validan igual.
  - **Cercanías caídas en una pregunta.** `ubicarEntidades` ya no se calla un error: la ventana avisa ("No pudimos ubicar los lugares de la respuesta"), no deja descargar y "Reintentar" las vuelve a pedir. Si no se incluye la respuesta, no bloquea.
  - **Descarga antes de que se vea la hoja.** La vista previa avisa qué PDF terminó de mostrarse (`onDibujada`, después del dibujo o del fundido), y la descarga exige que sea ese. Si pdf.js no puede mostrarla, es error.
  - **Menores.**
    - El título va primero y la descripción y los autores después de Encuadre: a 1366, hoja, encuadre y escala entran sin desplazarse.
    - La escala elegida se conserva al girar la hoja.
    - La leyenda no incluye "Obras de mantenimiento" si no hay ninguna cargada.
  - **Batería.** Prueba nueva `integridad`: tesela cortada (error y Reintentar), descarga habilitada recién con la hoja nueva dibujada, y cercanías caídas.

  **Transiciones (pedido de Matias, 14/11): "que parezca que se está dibujando".**
  - *Al abrir.* La hoja entra con perspectiva: viene inclinada (rotateX 22°), de más abajo y más chica, y se apoya en la mesa con un resorte. Después se dibuja:
    - primero el boceto en lápiz (la misma página en grises y con contraste), que se descubre de arriba abajo detrás de una línea de trazado fina;
    - 0,38 s después pasa una segunda línea, naranja y con brillo, que la llena de color.
    - En total, unos 1,2 s.
  - *Al cambiar de página.* La anterior se da vuelta hacia el costado (rotateY con perspectiva, desde el borde) y se desvanece mientras la nueva se dibuja.
  - *Al girar la hoja.* Gira sobre la mesa (±9°) mientras cambia de forma y se vuelve a dibujar.
  - *Controles.* Las secciones de la derecha, el botón de descarga y las miniaturas entran en cascada.
  - *Cambios menores* (título, interruptores). La hoja se reemplaza sin el dibujo completo, para no cansar.
  - *Movimiento reducido.* Con "reducir movimiento" (del sistema o de Configuración), nada de esto: la hoja aparece con un fundido.

  Sexta revisión de cierre de T2 (14/11): **NO APROBADO**. Simple ≈ 8,7 y Pro ≈ 8,6. Pasaron las correcciones de la quinta. Las transiciones de entrada, giro y cascada salieron bien. Corregido después:
  - **Con varias páginas, la descarga se habilitaba a mitad del dibujo.**
    - Causa: la tira de miniaturas aparecía cuando llegaba el PDF, achicaba la hoja, el dibujo se reiniciaba sin animación y avisaba "lista" a los 220 ms.
    - Arreglo: la tira se reserva desde el principio cuando la hoja va a llevar la respuesta (`conMiniaturas`), y además cualquier aviso de "lista" espera al dibujo animado en curso (`dibujoEnCurso`).
    - Medido con el script del revisor en 15 corridas (una página, tablero, pregunta y medición, en los dos modos y los tres tamaños): 0 cuadros con la descarga habilitada mientras se dibuja. La batería lo comprueba ahora cuadro a cuadro.
  - **Paso de página turbio.** La página que sale se da vuelta desde el lomo (rotateY hasta 105°, opaca, con el dorso oculto) y la nueva empieza a dibujarse recién cuando la anterior ya pasó los 90° (0,34 s).
  - **Descarga habilitada durante el paso de página.** Al empezar un dibujo animado, la vista previa avisa que todavía no se ve el PDF completo (`onDibujada(null)`). La pastilla "Actualizando…" queda solo para cuando se arma un PDF nuevo.
  - **Pedidos repetidos al escribir.** `contenidoPdf` está memorizado en App: escribir los autores ya no vuelve a pedir los pueblos cercanos con cada tecla.
  - Sin cambios, por artificiales: un PNG con el medio corrupto y el IEND intacto, y una respuesta de cercanías vacía.

  Séptima revisión de cierre de T2 (14/11): **NO APROBADO**, por un solo detalle. Simple ≈ 8,8 y Pro ≈ 8,75. Pasó todo lo demás: varias páginas sin adelantos, paso de página limpio, ningún pedido al escribir, PDF igual a la vista previa, números del tablero y vocabulario simple.
  - **El bloqueo:** al tocar una miniatura, la descarga quedaba habilitada durante el primer cuadro (hasta ~100 ms a 2560), hasta que pdf.js terminaba y avisaba. Ahora `cambiarPagina` y el giro de la hoja avisan `onDibujada(null)` en el mismo instante del clic. La batería mide el paso de página cuadro a cuadro desde el clic. Con el script del revisor: 0 cuadros adelantados en 1→2, 2→1, 1→2→3 rápido y última→1, y ninguna descarga durante el paso.
  - **Menor:** en hojas de más de 1500 px de ancho (la tele), la página se dibuja al doble y no al triple, para aliviar la animación.
  - El revisor indicó que con esto alcanza una verificación de nivel rápido.

  Verificación de la corrección (14/11, nivel rápido): **APROBADO. T2 cerrado.**
  - Batería sin fallas.
  - 0 cuadros con la descarga habilitada en 5.024 cuadros medidos: paso de página y giro, clics encadenados, teclado, 1366 y 2560, los dos modos y con movimiento reducido.
  - 0 descargas en 4.930 intentos durante el dibujo.
  - La vista previa sale nítida contra un render ideal: PSNR ~32 dB.

  Anotado para después, sin bloquear:
  - El umbral de 1.500 px para dibujar la vista previa al doble no alcanza a la tele 2K: a 2560 la hoja mide 1.373 px de dispositivo y sigue al triple. Bajarlo a ~1.200 px, comprobando antes la nitidez de la leyenda.
  - Confirmar el ritmo de cuadros en la tele real, con GPU (sin GPU, el paso de página va a ~20 fps).
  - El JS al abrir el visor (366 KB contra 320 KB) viene de antes de T2.

- [x] **T3 · Mapas de calor** — `hecho` (14/11; cerró con la verificación rev23)
  - Población pesada por `canthab` (3.356 de las 10.804 localidades tienen habitantes).
  - Densidad para capas de puntos, con selector Puntos / Calor.
  - En el modo simple: la tarjeta "¿Dónde vive la gente?" y el botón "ver como manchas".
  - `Heatmap` de OpenLayers con datos WFS limitados a lo visible.
  - Bloqueado por: T1.

  **Hecho el 14/11** (con las correcciones de la revisión rev21):
  - *Datos* (`calor.ts`).
    - Cada capa en calor tiene un control que, cuando el mapa se queda quieto, pide por WFS los puntos de lo que se ve (con un margen de un cuarto del ancho) y reemplaza a los anteriores. El de la hoja impresa es aparte: pide su propio encuadre y no le cambia los datos al mapa.
    - Nunca hay una mancha parcial. Si en lo visible hay más de 60.000 puntos, la mancha se vacía y se avisa que hay que acercarse. "Otras edificaciones" (96.056) lo pide a escala país; las 10.804 localidades entran siempre.
    - Si un pedido falla, no se reintenta solo: se avisa, con "Reintentar".
    - Población: solo las localidades con `canthab > 0`. Cada una pesa (habitantes / 300.000) ^ 0,35: Resistencia 0,97, una ciudad de 50.000 0,53 y un pueblo de 2.000 0,17. De lejos, cada lugar pesa menos, porque a escala país la mitad norte saturaba.
    - Densidad: el peso depende de cuántos puntos se ven en ese momento (lo recalcula la capa al quedarse quieto el mapa): 0,7 con 150 o menos, así un hospital solo se ve; 0,05 con 5.000; 0,012 con las 36.000 casas de la provincia.
    - Antes de bajar los puntos se pide el conteo (`resultType=hits`); si pasan el tope, no se bajan.
  - *La capa* (`capaCalor.ts`, `calorColores.ts`).
    - Es un grupo: la mancha (`Heatmap`) y, en la de población, los nombres de los lugares, porque al pasar a calor las localidades salen del WMS y con ellas sus rótulos. De lejos solo se rotulan las ciudades grandes; de cerca, todos los lugares.
    - El tamaño de la mancha va en metros: de lejos, manchas regionales; de cerca, cada lugar. La pantalla 2K solo agranda sus topes en píxeles.
    - Rampas por tema. Población en magma, para que no se confunda con el naranja de las rutas; en oscuro, la rampa va hacia los claros. Densidad en violeta.
  - *En el visor* (`cambiarCalor` en `visor.ts`).
    - Una capa en calor sale del WMS, así sus puntos no se dibujan debajo de las manchas.
    - Las consultas por punto y por rectángulo siguen funcionando sobre esa capa, sin el filtro de escala de sus puntos.
    - El deslizador de opacidad también actúa sobre la mancha.
    - Apagar la capa apaga su calor.
  - *Estado a la vista.*
    - Debajo del selector (pro) o del botón (simple) hay una línea de estado: cargando, cuántos puntos, demasiados o error.
    - Sobre el mapa aparece un aviso cuando hay demasiados puntos (con "Acercar") o cuando falló un pedido (con "Reintentar").
  - *Pro.*
    - Selector "Puntos | Calor" al lado de "Leyenda y ajustes" en cada capa de puntos prendida, salvo las obras de la RN11 (son pocas y cada una importa).
    - Es un grupo de radios con flechas: el Tab entra y sale en un solo paso.
    - En el lugar de la leyenda de esa capa aparece la rampa "Menos / Más habitantes" (o densidad), con la nota del método.
  - *Simple.*
    - Tarjeta "¿Dónde vive la gente?" arriba de todo, a todo el ancho, con manchas dibujadas que laten mientras está activa. Con movimiento reducido, no laten.
    - Al tocar la tarjeta de nuevo, el mapa vuelve a como estaba: si la tarjeta prendió las localidades, las apaga.
    - Botón "Ver como manchas" / "Ver como puntos" en cada capa de puntos prendida.
    - Leyenda "Poca gente / Mucha gente" (o "Pocos / Muchos").
    - Con la mancha activa no aparece el aviso "Se ve de más cerca", que solo vale para los puntos del WMS.
  - *Impresión.*
    - La hoja carga las manchas de su propio encuadre y, en la leyenda, pone la rampa con sus extremos ("Localidades (mapa de calor)").
    - Si la mancha no se pudo cargar (error o demasiados puntos), la hoja da un error que dice por qué y no deja descargar. Es la misma promesa de T2: nunca un PDF incompleto.
  - *Peso.*
    - El WebGL del `Heatmap` va en un fragmento diferido (32 KB comprimidos) que se baja al prender el primer calor.
    - Hubo que sacar OpenLayers del grupo manual de Vite: el empaquetador metía igual en el fragmento inicial los 13 módulos de WebGL.
    - El JS al abrir el visor queda en 376 KB, 10 KB más que antes de T3, por la interfaz del calor.
  - *Batería.* Prueba `calor`:
    - el selector de pro, ida y vuelta, el WMS sin los puntos y la leyenda;
    - imprimir con la mancha caída: da error y no deja descargar;
    - con el WFS caído, no hay pedidos en bucle y aparece el aviso con "Reintentar";
    - "Otras edificaciones" a escala país: mancha vacía (nunca parcial) y aviso con "Acercar";
    - la tarjeta de simple, ida y vuelta, volviendo a como estaba;
    - "Ver como manchas" con las escuelas;
    - axe.

    Los avisos del WebGL por software de Chromium sin GPU no cuentan como errores de consola. La prueba del manual con el teclado ahora espera a que termine el desplazamiento suave en vez de una pausa fija (fallaba a veces).

  **Revisión rev21 (cierre, 14/11): NO APROBADO** (simple ≈ 7,05; pro ≈ 6,55). Hallazgos y qué se hizo:
  1. El PDF salía sin la mancha y se podía descargar: la hoja carga su propio calor y, si falla, da error sin descarga.
  2. Con el WFS caído había un bucle de unos 30 pedidos por segundo: no hay reintentos automáticos.
  3. Con el tope, la mancha parcial dejaba regiones vacías: ahora la mancha se vacía y se pide acercarse.
  4. El aviso de "parcial" quedaba viejo: el estado se publica en cada carga.
  5. En simple no se veía el estado: línea de estado y aviso sobre el mapa.
  6. Con movimiento reducido, el latido parpadeaba: con movimiento reducido no hay latido.
  7. La opacidad no hacía nada sobre la mancha: ahora sí.
  8. Legibilidad: no había nombres de lugares, el naranja se confundía con las rutas, la rampa no servía en oscuro, la densidad saturaba y los puntos sueltos no se veían. Se agregaron los rótulos, las rampas por tema y los pesos por cantidad, y el tamaño en metros.
  9. Se ofrecía calor para las obras de la RN11: ya no.
  10. Las etiquetas de la leyenda se pegaban, el selector tenía varias paradas de Tab y la consulta por rectángulo ignoraba las capas en calor: corregido.
  **Revisión rev22 (cierre, 14/11): NO APROBADO** (simple ≈ 7,65; pro ≈ 7,15). Los 10 hallazgos de rev21 quedaron resueltos salvo la legibilidad de la densidad. Hallazgos y qué se hizo:
  1. La leyenda no seguía el cambio de tema y contradecía al mapa: la leyenda y el dibujo de la tarjeta leen el tema en vivo.
  2. La densidad saturaba en las capas grandes, y su intensidad dependía de cómo se llegaba a la vista.
     - Ahora el peso de cada punto es una variable de la capa. Se recalcula con lo que se ve cada vez que el mapa queda quieto: 0,7 × (150 / puntos a la vista) ^ 0,75, entre 0,008 y 0,7.
     - La mancha de densidad es más chica que la de población.
     - En oscuro, la rampa termina en un violeta claro, no en blanco.
  3. La consulta por punto conservaba el filtro de escala: para las capas en calor se manda un SLD sin escalas.
  4. El error de imprimir con demasiados puntos hablaba de GeoServer y ofrecía Reintentar: ahora ofrece «Ver más cerca», que acerca la escala de la hoja.
  5. Con demasiados puntos se bajaban 1,4 MB para tirarlos:
     - primero se pide solo el conteo (`resultType=hits`);
     - el aviso dice «en esta zona», porque el conteo incluye el margen.
  6. Pulido:
     - «Menos/Más habitantes» va en un renglón;
     - después de Reintentar, el foco vuelve al mapa;
     - el dibujo de la tarjeta usa la rampa del tema.
  - De T2, encontrado de paso: al abrir la impresión con «p» la letra se escribía en el título. Corregido con `preventDefault`.
  - La batería suma tres pruebas: la rampa de la leyenda al cambiar de tema, el peso de la densidad al alejarse y volver, y la consulta por punto sobre la mancha a escala región.

  **Verificación rev23 (corrección, 14/11): APROBADO.** Los 6 hallazgos de rev22 y la «p» de T2, resueltos en la app real; batería sin fallas. Anotado para después (baja, no bloquea):
  - «Otras edificaciones» en calor a 1:1,8M baja 6,6 MB en 1366 y 11,2 MB en 2560 (la hoja impresa, hasta 12,8 MB). Se podría pedir menos decimales o centroides simplificados.
  - En 1366 claro, el núcleo de esa mancha queda casi uniforme y los rótulos violetas encima tienen poco contraste. En 2560 se lee mejor, porque el peso depende de cuántos puntos se ven.
  - En pro 1536, «Menos / Más habitantes» quedan a unos 4 px.

- [x] **T4 · Tabla de datos (modo profesional)** — `hecho` (15/11; cerró con la verificación rev26)
  - Tabla por capa vía WFS: buscar, ordenar, filtrar, "ir a la entidad" y exportar a CSV o GeoJSON. Paginada.
  - Solo lectura, salvo `obras_rn11` (WFS-T).
  - Bloqueado por: T1.

  **Hecho el 15/11:**
  - *Dónde.* Un cajón abajo, entre las capas y el inspector, sobre la barra de estado (`componentes/pro/TablaDatos.tsx`, carga diferida: 42 KB comprimidos más dos piezas chicas; el editor de obras, `EditarObra.tsx`, baja aparte recién al editar).
    - Se abre con la tecla T, con el botón de tabla de la barra de arriba o con «Tabla» en cada capa prendida del panel. Arriba tiene una pestaña por capa prendida.
    - Alto compacto (42 % del alto libre, mínimo 320 px) o agrandado (68 %).
    - Con la tabla abierta, el encuadre del mapa deja libre su alto (`ponerDisposicion`) y los botones de zoom y el minimapa suben.
    - Al pasar al modo simple, se cierra.
  - *Datos* (`tabla.ts`). Todo lo hace GeoServer por WFS: pagina de a 50, ordena (`sortBy`) y filtra (CQL). Así «Otras edificaciones» (96.056) se recorre igual que una capa de 20.
    - Columnas por `DescribeFeatureType`, sin los campos técnicos del IGN. Primero el nombre y los datos clave de la ficha; al final precisión, escala y fuente. La primera columna queda fija al desplazar.
    - *Buscar:* en todas las columnas de texto, sin tildes ni mayúsculas (`strStripAccents` + `ILIKE`); un número busca también en las columnas numéricas.
    - *Filtrar:* por columna, con condición (contiene, es igual a, mayor que, menor que, está vacío, tiene dato) y valor, como chips que se quitan uno por uno. También «Solo lo que se ve» (BBOX de la vista, se actualiza al mover el mapa).
    - *Ordenar:* clic en el encabezado (ascendente o descendente).
  - *Ir a la entidad:* clic o Enter en una fila. Trae la entidad con su geometría, prende la capa si estaba apagada, la muestra en el inspector («desde la tabla»), la selecciona y vuela hasta ella arriba de la tabla.
  - *Exportar:* CSV (geometría en WKT, WGS 84, con BOM para Excel) o GeoJSON, con todo lo filtrado, no solo la página, hasta 100.000 entidades.
  - *Obras de la RN11 (WFS-T):* activar una obra va a ella y abre al costado un panel para editar tipo, prioridad, estado y descripción (`wfs:Update`), o borrarla con confirmación (`wfs:Delete`). Después se recarga la página y el WMS.
    - La celda «Editar» no tiene un botón adentro: la celda ya es enfocable y axe marcaba los controles anidados.
  - *Accesibilidad:*
    - grilla de react-aria (HeroUI Table) con flechas, encabezados ordenables con `aria-sort` y pestañas de capa con flechas;
    - el pie anuncia «1–50 de N» (`role=status`);
    - mientras carga, filas que respiran (quietas con movimiento reducido).
  - De paso: rótulos que faltaban (situacion, trafico, categoría, km inicial, fecha de relevamiento, códigos) y la tecla T en la lista de atajos de Configuración.
  - *Batería.* Prueba `tabla` (pro, 1366 claro, 1536 oscuro y 2560 claro). Compara cada número con pedidos WFS hechos aparte:
    - T abre y cuenta todas las localidades;
    - los botones de zoom quedan sobre la tabla;
    - buscar «resisténcia»;
    - filtro de habitantes mayor que 100.000;
    - orden descendente, con la primera fila igual a la de mayor población;
    - página siguiente;
    - el CSV tiene todas las filas filtradas y la geometría;
    - Enter en una fila va a la entidad y la deja a la vista arriba de la tabla;
    - con `--con-alta`, editar y borrar una obra de prueba;
    - axe en tres estados;
    - T la cierra.
  - El JS al abrir el visor pasa de 377 a 380 KB.

  **Revisión rev24 (cierre, 15/11): NO APROBADO** (diseño 8, usabilidad 7,5, creatividad 7, contenido 8,5). Hallazgos y qué se hizo:
  1. Las flechas en las pestañas tiraban un error y el foco no seguía a la pestaña: se guarda el elemento antes del `requestAnimationFrame`. Se suman Home y End, y un `tabpanel` con `aria-controls`.
  2. axe marcaba el esqueleto de carga (`aria-label` sin rol): ahora tiene `role=status`.
  3. «Solo lo que se ve» contaba lo que tapan los paneles y la tabla: usa el rectángulo libre del mapa (`extensionLibre`) y se recalcula al agrandar o achicar la tabla.
  4. La tabla de obras no se actualizaba después de un alta con Nueva obra: App le avisa (`recargaObras`).
  5. El inspector quedaba viejo después de editar una obra: se vuelve a traer la obra. Si se borró, se cierra.
  6. El foco se perdía: al cerrar el editor, después de guardar o borrar, vuelve a la fila o a la grilla; al cerrar la tabla, al botón de la tabla.
  7. La exportación se cortaba en 100.000 sin avisar: el rótulo y el aviso dicen «100.000 de 120.470 (tope)» y sugieren filtrar.
  8. La pestaña abierta podía quedar fuera de vista: se desplaza hasta verse y los bordes se desvanecen.
  9. El esqueleto se desbordaba sobre el pie: ahora queda recortado.
  10. A la primera columna fija le faltaba la línea divisoria en algunas filas: corregido.
  11. El pie decía «Cargando…» con error: ahora dice «Sin datos». Los errores de red del editor salen en castellano.
  12. «1.5» se leía como 15: un punto es de miles solo si separa grupos de tres cifras.
  13. La búsqueda miraba precisión, escala y fuente (con «IGN» coincidía todo): esas columnas quedan afuera. Con «ñ» se busca tal cual.
  14. El GeoJSON salía con 4 decimales: se pide en EPSG:3857 y se reproyecta en el navegador con 7 (alrededor de 1 cm). El plan decía 43 KB y bajaban unos 87: el editor pasó a su propio fragmento.
  15. T abría las obras, vacías: ahora abre Localidades si está prendida.

  **Verificación rev25 (corrección, 15/11): NO APROBADO.** De los 15 hallazgos de rev24, 14 quedaron resueltos. El que faltaba: al cerrar la tabla con T teniendo el foco adentro, el foco iba al body (con la ✕ ya volvía al botón).
  - Ahora, al cerrar la tabla de cualquier forma, el foco vuelve al botón de la tabla. La batería lo comprueba.
  - De paso, «Solo lo que se ve» se recalcula también al plegar o desplegar las capas o el inspector.
  - Anotado para después (baja): el rectángulo libre deja afuera la franja de mapa debajo del inspector, a la derecha de la tabla.

  **Verificación rev26 (corrección, 15/11): APROBADO.**
  - T cierra la tabla desde cualquier control y el foco vuelve al botón de la tabla, en los tres tamaños. Si el foco estaba afuera, no se mueve.
  - «Solo lo que se ve» se recalcula al plegar o desplegar las capas y el inspector.
  - Batería sin fallas.

  Anotado para después (baja, no bloquea):
  - Con el foco en un botón del editor de obras, T no cierra la tabla: `escribiendoEn` cuenta todo el `form`. Esc sí cierra el editor.
  - Al abrir el editor, la tabla se agranda al instante y los botones de zoom tardan unos 0,4 s en subir. En ese lapso tapan la esquina de Exportar. Convendría animar los dos con la misma curva.
- [ ] **T5 · Animación de distancia** — `aprobado`
  - La franja alrededor de la ruta crece de 0 a 20 km mientras un contador suma localidades y habitantes en vivo, con los mismos números que el tablero (refinamiento geodésico).
  - Bloqueado por: T1.
- [ ] **T6 · Comparador deslizante** — `aprobado`
  - Cortina que divide el mapa en dos juegos de capas elegibles, con el atajo "Natural vs. Humano".
  - Bloqueado por: T1.
- [ ] **T7 · Link compartible** — `aprobado`
  - Capas, zoom, centro, selección y modo quedan en la URL.
- [ ] **T8 · Vista 3D explotada** — `aprobado` (último; se corta si no llega)
  - Las capas activas, apiladas en pisos con deck.gl (OrbitView), limitadas a Chaco y con un tope de entidades por capa. Se puede rotar y hacer zoom, y cada piso lleva su leyenda.
  - Bloqueado por: T1.
- ~~Timelapse por años~~ — `descartado` (sin datos temporales).
- ~~Perfil de elevación~~ — `descartado` (sin alturas sobre la RN11).
- ~~Modo Presentación~~ — `descartado`.

## Restricciones

- Sin servicios externos: la demo anda sin internet.
- No se toca la parte B ni la parte C.
- Sin commits ni PRs hasta que Matias lo pida.
