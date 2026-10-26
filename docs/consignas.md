# Sistemas de Información Geográfica — Trabajo Práctico Integrador

Transcripción de la consigna provista por la cátedra. Se ajustaron el formato y la ortografía para facilitar la lectura, sin modificar los requisitos. El [PDF original](consigna-original.pdf) se conserva como referencia.

## Datos de la materia y entrega

- Materia Electiva de 4.º Nivel, Ingeniería en Sistemas de Información.
- Universidad Tecnológica Nacional, Facultad Regional Resistencia.
- Ciclo 2026.
- Docentes: Ing. Ilse Hodapp – Ing. Rodrigo Valdés.
- Modalidad: grupos de 4–5 integrantes. Presentación ante la clase.
- Fecha de entrega: martes 01/12/2026 – jueves 03/12/2026.

## A) Infraestructura y aplicación web

Utilizando los distintos software vistos en clase, o cualquier otro que considere conveniente, y las capas del SIG IGN 250 provistas a tal fin, se solicita desarrollar las siguientes consignas:

1. Implementar un servidor de BDs espaciales y cargar en él las capas vectoriales mencionadas.
2. Implementar un servidor de mapas que permita servir las capas mencionadas mediante servicios OGC (WMS y WFS).
3. Desarrollar una aplicación web para visualizar las capas montadas en el servidor de mapas que disponga, como mínimo, de las siguientes funcionalidades:
   - Navegación del mapa (paneo, zoom, etc.).
   - Activar/desactivar capas.
   - Mostrar la leyenda de las capas (clases de la simbología), y escala de visualización.
   - Consulta gráfica (punto y rectángulo) para cada capa.
   - Medición de distancias.
   - Ingresar nuevos elementos (features) en una capa vectorial (geometría y atributos). Dicha capa puede ser una creada a tal fin, o una de las del SIG250.

**Capas provistas:** [SIG IGN 250 en Google Drive](https://drive.google.com/file/d/1DrPP7D37aU5WHVqz_dzlA5NTD23WrKCT/view?usp=sharing).

## B) Análisis de la Ruta Nacional 11 en Chaco

Utilizando los distintos software vistos en clase, o cualquier otro que considere conveniente, y las capas del SIG IGN 250 provistas a tal fin, se solicita responder las consignas planteadas en el siguiente escenario:

El Ministerio de Planificación de la Nación pretende realizar obras de mantenimiento en la traza de la Ruta Nacional 11 correspondiente a la Provincia del Chaco.

Para la justificación de la obra y la confección de los pliegos de licitación se requiere la siguiente información:

1. ¿Cuántos km tiene la traza de dicha ruta en la provincia?
2. ¿A cuánta población afectará de manera directa esta obra? Para esto se definen dos categorías (excluyentes entre sí):
   - Población que vive hasta 10 km de la ruta.
   - Población que vive hasta 20 km de la ruta.
3. ¿Cuántos y cuáles puentes cruzan la traza de la ruta en la provincia?

Para la presentación de esta consigna se debe confeccionar un breve informe con la descripción de los pasos ejecutados y capturas de pantallas de los mismos.

## C) Mapa para impresión

Con la información obtenida en el punto B), confeccionar un mapa apto para impresión en formato PDF. El mismo debe servir para comunicar los alcances y el contexto geográfico de la obra, contener todos los elementos propios de un mapa (Un. 2) y cumplir con los conceptos de Diseño Cartográfico (Un. 2).

Parámetros:

- **Extensión:** Provincia del Chaco.
- **Formato:** A4.
- **Información que debe comunicar:**
  - Traza de la R11, en el contexto de la Red Vial de la Provincia.
  - Áreas de influencia (10 km y 20 km), y localidades abarcadas.
  - Puentes en la traza de la R11.
  - Accidentes naturales.
  - Cualquier otra información que considere necesaria para el contexto.

---

Las decisiones del equipo, interpretaciones metodológicas y aclaraciones posteriores se documentan por separado en el [plan de trabajo](../README.md), para distinguirlas del enunciado original.
