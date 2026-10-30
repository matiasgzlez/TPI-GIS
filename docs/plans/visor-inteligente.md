# Spec: visor más intuitivo, con estadísticas y consultas en lenguaje natural (A.3, segunda etapa)

Estado: **implementado en `develop`, sin commitear** (29/10/2026).

## Objetivo

Que lo que muestra el visor se entienda al primer toque:

- lo seleccionado se ve claro en el mapa;
- las consultas traen un resumen con gráficos;
- se puede preguntar en castellano ("localidades a menos de 10 km de la RN11") y el visor aprende de lo que se consulta.

Todo con el movimiento fluido de iOS. Criterio de calidad: nivel Awwwards/FWA, verificado con capturas y ciclos de mejora.

## Decisiones (grill del 29/10/2026)

| Tema | Decisión |
|---|---|
| Lenguaje natural | Intérprete propio, sin internet ni API: una gramática que combina capas, relaciones ("a menos de X km de", "en", "sobre", "cuántos") y lugares, con las consultas de la parte B como frases de primera clase |
| Aprendizaje | Cuando no entiende, propone las interpretaciones más parecidas y guarda la elegida. También aprende sinónimos, sube lo más consultado y completa la frase mientras se escribe |
| Dónde aprende | En la base, compartido por el equipo: tabla nueva `edicion.aprendizaje`, publicada en GeoServer con escritura para el usuario `editor` (toca A.1 y A.2) |
| Gráficos | SVG propio animado con `motion` (barras, donas, números que cuentan). HeroUI v3 y Aceternity no tienen gráficos de datos |
| Tablero RN11 | Muestra en vivo km, localidades y población a 10 y 20 km, y puentes. Tiene que coincidir con PostGIS (ver "Números de referencia") |
| Tamaño | Configurable: Compacto, Normal (por defecto, más chico que hoy) y Grande (el actual, para el proyector) |
| Configuración | Panel con tamaño, tema, animaciones, cuadrícula y minimapa, más un manual de ayuda (qué hace cada herramienta, con un ejemplo, y los atajos) |
| Movimiento | Resortes físicos (`motion`) en paneles, listas, switches y gráficos; interrumpibles; respetan "reducir movimiento" |

## Números de referencia (PostGIS, distancia geodésica sobre el elipsoide)

| Consulta | Resultado |
|---|---|
| Localidades de Chaco hasta 10 km de la RN11 | 22 localidades · 363.320 hab. |
| Entre 10 y 20 km | 15 localidades · 26.080 hab. |
| Puentes a menos de 100 m de la traza | 17 |

GeoServer coincide hasta 10 km, pero a 20 km deja afuera a Puerto Bermejo Nuevo (19.885 m), porque aproxima metros en grados. Por eso el visor pide los candidatos con margen (`DWithin` 25 km) y calcula la distancia exacta en el navegador con la escala del elipsoide en cada latitud. El tablero tiene que mostrar exactamente estos números.

## Restricciones

- Sin servicios externos: la demo anda sin internet.
- El intérprete nunca inventa: si no entiende, lo dice y propone.
- `npm run build` sin errores, rendimiento medido contra [optimizacion-visor.md](../optimizacion-visor.md) sin retrocesos, y capturas en claro, oscuro, 1440, 1100 y 390 px.
- Sin commits hasta que Matias lo pida.

## Tickets

- [x] **T1 · Configuración, tamaño y manual.** Escala de la interfaz con una variable CSS (Compacto, Normal, Grande; Normal por defecto). Panel de configuración (tamaño, tema, animaciones, cuadrícula, minimapa) guardado en el navegador. Manual de ayuda dentro del panel.
- [x] **T2 · Movimiento estilo iOS.** Resortes en la entrada y salida de paneles (`AnimatePresence`), listas, dock, switches y buscador. Ajustar curvas y duraciones con capturas cuadro a cuadro.
  Bloqueado por: T1.
- [x] **T3 · Selección clara.** Al pasar el mouse sobre el mapa, cartel con el nombre (GetFeatureInfo con espera de 250 ms). Al tocar, halo animado sobre la entidad, acercamiento suave y ficha con lo importante arriba, en lenguaje humano.
- [x] **T4 · Gráficos y resumen de consultas.** Componentes SVG de barras, dona y número animado. Cada consulta abre con un resumen: entidades por capa, por tipo y totales como los habitantes.
  Bloqueado por: T2.
- [x] **T5 · Tablero RN11.** Km, localidades y población a 10 y 20 km (franjas excluyentes, con refinamiento geodésico) y puentes a menos de 100 m, con gráficos, y las localidades listadas y resaltadas en el mapa. Verificado contra los números de referencia.
  Bloqueado por: T4.
- [x] **T6 · Manejo de capas.** Buscador dentro del panel, opacidad por capa (la capa con opacidad propia sale de la imagen combinada a su propia capa WMS), "ver solo esta" y conjuntos listos (Contexto RN11, Hidrografía, Infraestructura, Servicios).
- [x] **T7 · Lenguaje natural.** Gramática y analizador. Se traduce a WFS con `DWithin`/`Intersects`, más el refinamiento geodésico. "en X" usa el ejido de la localidad si existe y, si no, 5 km. Respuestas con resumen y gráfico. Autocompletado de frases con el árbol de posibilidades (capas × relaciones × lugares × distancias) y las consultas de la parte B.
  Bloqueado por: T4.
- [x] **T8 · Aprendizaje compartido.**
  - `sql/04_aprendizaje.sql` (frase, interpretación en JSON, usos, fecha), aplicado también a la base existente.
  - `geoserver/publicar.py` publica la capa con escritura para `editor`.
  - "¿Quisiste decir…?" guarda la elegida; los sinónimos aprendidos y el ranking por usos alimentan el autocompletado.

  Bloqueado por: T7.
- [x] **T9 · Consultas predichas.** Sugerencias según la vista actual ("Hay 14 puentes en esta vista"), con conteos `resultType=hits` limitados y con espera, y según lo más consultado.
  Bloqueado por: T7.
- [x] **T10 · Pase de calidad.** `impeccable` sobre todo lo nuevo, medición de rendimiento antes y después, README, SPEC y resumen para el Google Doc del equipo.
  Bloqueado por: T1–T9.

## Cómo quedó

- **Configuración** (engranaje arriba a la derecha): tema, tamaño (Compacto, Normal y Grande, con `zoom` CSS sobre la capa de paneles y no sobre el mapa), cuadrícula, minimapa, reducir movimiento y el manual.
- **Movimiento:** resortes compartidos (`src/movimiento.ts`), pastilla deslizante en el dock y en los controles segmentados, switch al estilo iOS.
  - El switch tiene un rebote mínimo a propósito; el detector de `impeccable` lo marca como aviso y queda así por pedido.
- **Selección:** cartel con el nombre al pasar el mouse (`src/cartel.ts`, GetFeatureInfo con espera de 250 ms), latido de la entidad elegida y ficha en la consulta por punto.
- **Gráficos** (`src/componentes/ui/graficos.tsx`):
  - barras, dona y números animados;
  - colores de datos `--dato-1` y `--dato-2`, validados con el validador de paleta en claro y en oscuro (banda de luminosidad, separación para daltonismo y para visión normal).
- **Tablero RN11** (`src/analisisRn11.ts` y `TableroRn11.tsx`): coincide con PostGIS.
  - 172,4 km (PostGIS: 172,37 km);
  - 22 localidades y 363.320 hab. hasta 10 km;
  - 15 localidades y 26.080 hab. entre 10 y 20 km;
  - 17 puentes a menos de 100 m.

  En el mapa se ven las bandas de 10 y 20 km y las localidades con un círculo proporcional a la población.
- **Capas:** conjuntos listos, filtro (usa los sinónimos), opacidad (la capa sale a su propia capa WMS, arriba de la combinada) y "Ver solo esta capa".
- **Lenguaje natural** (`src/lenguaje.ts` y `src/consultaLenguaje.ts`): intención, capa, relación y lugar. Las consultas sobre la RN11 se recortan a Chaco, como la parte B.
- **Aprendizaje** (`src/aprendizaje.ts`): tabla `edicion.aprendizaje` (`sql/04_aprendizaje.sql`), publicada en GeoServer con escritura para `editor`. Probado de punta a punta: una frase desconocida, "¿Quisiste decir…?", y después se entiende sola y aprende el sinónimo.
- **Consultas predichas** (`src/prediccion.ts`): conteos `resultType=hits` de la vista, en el buscador vacío.
- **Rendimiento** frente a la etapa anterior: FCP 180 → 96 ms, LCP 1.052 → 980 ms y las mismas 107 teselas; lo nuevo se carga en partes chicas recién al usarlo.

**Para levantarlo en una base existente:**

```sh
docker compose exec -T db psql -U postgres -d tpi -f - < sql/04_aprendizaje.sql
docker compose run --rm publicar
```

Con el volumen nuevo, `04_aprendizaje.sql` corre solo.
