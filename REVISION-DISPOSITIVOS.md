# Revisión en escritorio, tablet y móvil

Revisamos la versión conjunta publicada ([federg-conjunta.pages.dev](https://federg-conjunta.pages.dev/)) el 2 de noviembre de 2026, en cuatro tamaños de pantalla y con todas las páginas, no solo la portada.

## Cómo la revisamos

Probamos cuatro tamaños:

- Móvil: 375 × 812
- Tablet en vertical: 768 × 1024
- Tablet en horizontal: 1024 × 768
- Escritorio: 1440 × 900

En móvil y tablet activamos la emulación táctil, para que la web se comporte como en un dispositivo de verdad.

Pasamos por las 39 páginas que hay en `sitemap-0.xml` y por una dirección que no existe, para ver la página 404. Son 40 páginas en 4 tamaños, 160 cargas en total. Para no hacerlo a mano, usamos un script con Puppeteer ([`scripts/revision-dispositivos.mjs`](scripts/revision-dispositivos.mjs), se lanza con `npm run revision`) que abre cada página en Edge sin interfaz, baja hasta el final para que carguen las imágenes y las animaciones de entrada, y apunta lo que encuentra. Activamos el modo de movimiento reducido para que las capturas no salieran a mitad de una animación.

De 10 páginas guardamos capturas completas en los cuatro tamaños, más una con el menú abierto. Están en [`capturas/revision-dispositivos/`](capturas/revision-dispositivos/), junto con `resultados.json`, que tiene los datos de cada página y tamaño.

## Qué medimos

| Comprobación | Resultado |
| --- | --- |
| Páginas que cargan bien (la inexistente da 404, como debe) | 40 de 40, en los 4 tamaños |
| Páginas con scroll horizontal | Ninguna |
| Imágenes rotas | Ninguna |
| Imágenes sin `alt` | Ninguna |
| Páginas con un solo `h1` | 40 de 40 |
| Enlaces vacíos (`href="#"`) | Ninguno |
| Errores de JavaScript en la consola | Ninguno (solo el 404 de la página inexistente, que es lo esperado) |
| Rejillas con una tarjeta suelta en la última fila | Ninguna |
| Textos de menos de 12 px | 4 en la portada y 2 en actividades de miembros y en representaciones |

En escritorio y en tablet horizontal, las noticias y la junta directiva ("The Board", en Our members) salen en filas de 3 + 2. No son tarjetas sueltas: la última fila reparte las dos tarjetas a todo el ancho, y queda bien ([noticias en tablet](capturas/revision-dispositivos/tablet-1024/news.jpg), [miembros en escritorio](capturas/revision-dispositivos/escritorio-1440/about_members.jpg)). El script también marca como filas incompletas los grupos de etiquetas y los datos de los eventos que pasan a la línea siguiente, pero eso es normal.

## El menú en cada tamaño

| Tamaño | Cómo es el menú |
| --- | --- |
| Móvil 375 | Botón "Menu" que abre un panel con About FEDERG, Patient Stories, News & Events, Contact, el buscador y "Join FEDERG" ([captura](capturas/revision-dispositivos/movil-375/menu-abierto.jpg)) |
| Tablet 768 | Menú completo en la cabecera, con desplegables ([captura](capturas/revision-dispositivos/tablet-768/menu-abierto.jpg)) |
| Tablet 1024 | Igual que en 768 ([captura](capturas/revision-dispositivos/tablet-1024/menu-abierto.jpg)) |
| Escritorio 1440 | Menú completo y botón "Join FEDERG" ([captura](capturas/revision-dispositivos/escritorio-1440/menu-abierto.jpg)) |

En tablet y escritorio las secciones principales se ven sin abrir ningún menú, que era uno de los puntos de la revisión del 28/10. Solo probamos 375 y 768, así que no sabemos exactamente en qué ancho cambia de un menú a otro. "Join FEDERG" está en la cabecera solo en escritorio; en tablet no aparece y en móvil está dentro del menú.

## Qué vimos en las capturas

Lo que está bien:

- La identidad se mantiene en todas las páginas y tamaños: cabecera azul marino con estrellas, acentos en naranja y el logo original.
- El aviso de proyecto de prácticas sale en la portada y en el pie de todas las páginas, también en móvil.
- Las páginas interiores (noticias, eventos, historias, contacto, 404) tienen la misma cabecera, migas de pan y pie, y ningún texto se corta.
- El buscador funciona: buscando "dialysis" sale la historia de Marta y sus apartados.

Lo que se puede mejorar:

1. En la portada, los tres datos (20, 150+ y 80 %) quedan en dos filas en móvil y en tablet vertical, con "80 %" solo abajo ([captura](capturas/revision-dispositivos/tablet-768/home.jpg)). En tablet cabrían los tres en una fila.
2. Las ilustraciones de los boletines ("Members activities" y "FEDERG representations") llevan texto de unos 10 px ("FEDERG", "Summer issue · No. 2"). Es decoración, pero los lectores de pantalla lo leen. Habría que marcarlo con `aria-hidden="true"` o subirlo a 12 px.
3. Los enlaces del pie miden 17 px de alto, menos de los 24 px que pide WCAG 2.5.8 para tocar con el dedo. Entre uno y otro hay unos 30 px, así que cumplen por la excepción de espaciado, pero con un poco más de `padding` serían más cómodos en el móvil.
4. Si se abre `/search/?q=kidney`, el buscador sale vacío: no lee la búsqueda de la dirección. No es un error, pero estaría bien para poder enlazar búsquedas.
5. Se nos quedó un resto de la prueba del editor: el evento World Kidney Day 2027 sigue mostrando "(TEST)" al final del resumen (`src/content/events/world-kidney-day-2027.md`, línea 7), y también sale al buscar "test".

## Lo que no hemos comprobado

- Dispositivos reales. Todo lo hemos hecho emulando en Edge, que es un navegador basado en Chromium. Falta probar en Safari en iPhone y iPad, que es donde más suelen cambiar cosas como `position: sticky`, `backdrop-filter` o la altura de la pantalla.
- Navegación con teclado y con lector de pantalla. La estructura sí está medida (títulos, `alt`, enlaces), pero no hemos recorrido la web con Tab ni con NVDA o VoiceOver.
- El móvil en horizontal (por ejemplo, 740 × 360).
- El editor (`/admin/`) en tablet y móvil.
