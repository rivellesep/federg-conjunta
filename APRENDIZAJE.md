# Aprendizaje: versión conjunta del rediseño de FEDERG

> **Proyecto de prácticas.** No es la web oficial de FEDERG ni está relacionado con la asociación. La web oficial es [federg.org](https://federg.org/). Todo el contenido es de ejemplo y las historias de pacientes son inventadas.

La versión conjunta junta los dos rediseños que hicimos por separado, el de Enric ([rivellesep/Redise-o-web-de-FEDERG](https://github.com/rivellesep/Redise-o-web-de-FEDERG)) y el de Albert ([MrAlbertus/rediseno-web-federg](https://github.com/MrAlbertus/rediseno-web-federg)), y les añade un editor de contenidos para que alguien sin conocimientos técnicos pueda publicar.

- Web: [federg-conjunta.pages.dev](https://federg-conjunta.pages.dev/), publicada en Cloudflare Pages con `noindex` en todas las páginas.
- Editor: [federg-conjunta.pages.dev/admin/](https://federg-conjunta.pages.dev/admin/), con Sveltia CMS y acceso con GitHub a través de un Worker de Cloudflare (`federg-cms-auth`).
- Cada borrador del editor tiene su propia vista previa, y la web se reconstruye sola cada mañana para mover los eventos pasados.
- La guía para quien edita está en [EDITOR.md](EDITOR.md).

## 1. Qué se conserva de cada versión original y por qué

**De la versión de Enric** se conserva la estructura casi entera: la cabecera con el menú definido en `src/data/nav.ts`, el pie, la plantilla común, las rutas (representaciones, actividades de miembros, enlaces útiles, etiquetas, boletines), los datos en YAML de la junta, los boletines y los enlaces, la animación de palabras del hero con su botón de pausa y la mayor parte de `global.css`. También el despliegue en Cloudflare Pages, con `_headers`, `robots.txt` y Node 24. Nos quedamos con esta base porque ya estaba pensada para Cloudflare, cubría más secciones de la web real y tenía el esquema de contenidos más completo.

**De la versión de Albert** se conserva el panel azul marino del hero con las estrellas de la UE (`Stars.astro` es idéntico), la lista de eventos que separa los próximos de los pasados (`EventList.astro`), las historias inventadas de Marta y Elena, la idea del script de Lighthouse y la parte de este documento que compara WordPress con un sitio estático. Su versión ya proponía añadir un CMS basado en Git para que editara personal no técnico; aquí se ha hecho con Sveltia en lugar de Decap.

**Lo que es nuevo en la versión conjunta** viene casi todo de pensar en el editor:

- Las imágenes de las noticias están en `src/assets/` y no en `public/`, para que Astro las optimice y el editor pueda subirlas con una ruta relativa.
- Las historias y las páginas pasan de MDX a Markdown, porque el editor trabaja con Markdown.
- Cada asociación miembro es un archivo YAML aparte, para que el editor la trate como una entrada más.
- El esquema de `src/content.config.ts` y el de `public/admin/config.yml` van campo por campo, y el texto alternativo de las imágenes es obligatorio en los dos.
- Una acción de GitHub reconstruye la web cada mañana, porque al ser estática decide qué eventos son "próximos" al construirse, no al visitarse.

## 2. Sveltia CMS frente a Decap CMS

Comparamos con Decap porque es el CMS que proponía la versión de Albert y porque Sveltia nació como sustituto directo suyo: los dos leen un `config.yml` casi igual y escriben los mismos archivos Markdown en el repositorio.

| Aspecto | Sveltia CMS (el que usamos) | Decap CMS |
| --- | --- | --- |
| Autenticación | Inicio de sesión con GitHub mediante un proxy OAuth. Usamos `sveltia-cms-auth`, un Worker de Cloudflare gratuito. Pedimos solo el permiso `public_repo` y hemos desactivado el acceso con token personal. También permite trabajar con una carpeta local del ordenador. | También necesita un proxy OAuth para GitHub si no se aloja en Netlify. En Netlify se apoyaba en Netlify Identity y Git Gateway, que no nos sirven en Cloudflare. El esfuerzo de montarlo sería parecido. |
| Permisos | No tiene roles propios. Quien tiene permiso de escritura en el repositorio puede publicar, y quien no lo tiene no puede ni guardar borradores. | Igual. Los permisos son los de GitHub. |
| Imágenes | Puede convertir y reducir las imágenes en el navegador antes de subirlas. Lo tenemos configurado a WebP, calidad 85 y 2000 px como máximo. Permite carpeta de imágenes por colección. | Sube la imagen tal cual. Astro la optimiza igualmente al construir, pero el repositorio guarda el original más pesado. |
| Vista previa | Vista previa dentro del editor. La vista previa real la hace Cloudflare en cada borrador, y la encontramos en el comentario que Cloudflare deja en la pull request. | Vista previa dentro del editor, que suele necesitar plantillas propias para parecerse a la web. Busca el enlace a la vista previa en los estados de commit de GitHub. Cloudflare Pages publica "check runs", no estados, así que es probable que Decap no encuentre el enlace. |
| Publicación en Cloudflare Pages | Cada borrador es una rama y una pull request. Publicar fusiona la pull request en `main` (en nuestro caso con squash) y Cloudflare construye la web. | El mismo flujo editorial con ramas y pull requests. Cloudflare se comporta igual porque solo ve commits en GitHub. |
| Coste | Gratis y de código abierto. El Worker cabe en el plan gratuito de Cloudflare. | Gratis y de código abierto. Mismo coste de infraestructura. |
| Límites | Versión 0.x, mantenida en gran parte por una sola persona. El editor se carga desde unpkg con la versión fijada. Hereda los límites de la API de GitHub y del plan gratuito de Pages. | Proyecto más veterano y con más comunidad, pero con un desarrollo más lento y fallos conocidos que motivaron la aparición de Sveltia. Mismos límites de GitHub y de Pages. |

En resumen, para este proyecto Sveltia sale mejor sobre todo por las imágenes y porque el flujo con las vistas previas de Cloudflare funciona sin tocar nada. Su punto débil es la madurez: es joven y depende mucho de una persona.

## 3. ¿Y con WordPress?

La web actual de FEDERG funciona con WordPress 7.1.4, con los plugins WPBakery Page Builder y Slider Revolution según su propio HTML, y la comparación no es tan simple como "estático rápido, WordPress lento".

**Caché.** Un WordPress bien configurado, con caché de páginas y una CDN delante, también sirve HTML ya hecho y puede ser muy rápido. La diferencia que medimos (sección 4) se debe sobre todo al peso de la página y a lo que tarda el servidor en responder, no a WordPress en sí. Un sitio estático tampoco se libra de la caché: en la prueba, una noticia borrada siguió apareciendo en su dirección más de diez minutos porque Cloudflare tenía guardada la copia antigua.

**Riesgos de las cuentas.** En WordPress el riesgo está en las cuentas de `/wp-admin`. Aquí está en las cuentas de GitHub: quien tiene permiso de escritura puede cambiar la web entera, y el token que usa el editor sirve para todos los repositorios públicos de esa persona, no solo para este. Por eso la verificación en dos pasos en GitHub es imprescindible. A eso se suman la cuenta de Cloudflare, los secretos del Worker y la URL del deploy hook, que funciona como una contraseña.

**Dependencias.** WordPress depende de PHP, de la base de datos y de cada plugin, y todo eso se ejecuta en el servidor con cada visita. Aquí las dependencias de npm (Astro, sharp, Pagefind) solo se usan al construir y no quedan expuestas en la web. Pero dependemos de servicios externos: GitHub para el contenido y el acceso, Cloudflare para construir, servir y autenticar, y unpkg para cargar el editor. Si cae GitHub, no se puede editar. Si cae unpkg, el editor no carga, aunque la web sigue funcionando.

**El propio CMS.** WordPress es muy maduro y cualquiera lo conoce. Sveltia es joven y su futuro depende de pocas personas. La ventaja es que el contenido son archivos Markdown normales: si Sveltia desapareciera, el contenido seguiría intacto y se podría cambiar de editor sin migrar una base de datos.

**Git no sustituye a las copias de seguridad.** Git guarda el historial de cada cambio y permite deshacerlo, pero no protege de todo. Si se borra el repositorio, se pierde la cuenta o alguien reescribe el historial con un `push --force`, el historial se va con él. Además, el repositorio no guarda la configuración de Cloudflare, los secretos del Worker, la aplicación OAuth de GitHub ni la lista de colaboradores. Habría que tener una copia del repositorio fuera de GitHub y una nota con cómo volver a montar esa configuración.

## 4. Lighthouse: web actual frente a versión conjunta

Medimos las dos portadas publicadas el 29 de octubre de 2026 con el script `npm run lighthouse`, en el mismo ordenador y en las mismas condiciones:

- Lighthouse 13.6.0 con Microsoft Edge sin interfaz.
- Móvil con el preset por defecto de Lighthouse (pantalla de móvil, red 4G lenta simulada y CPU cuatro veces más lenta). Escritorio con el preset de escritorio.
- Tres pasadas por URL y dispositivo. Se guarda la mediana.

Los informes completos están en [lighthouse/](lighthouse/) en HTML y JSON, y el resumen en [lighthouse/resumen.md](lighthouse/resumen.md).

| | Actual, móvil | Conjunta, móvil | Actual, escritorio | Conjunta, escritorio |
| --- | --- | --- | --- | --- |
| Rendimiento | 69 | 100 | 70 | 100 |
| Accesibilidad | 87 | 100 | 87 | 100 |
| Buenas prácticas | 100 | 100 | 100 | 100 |
| SEO | 100 | 69 | 100 | 69 |
| First Contentful Paint | 4,2 s | 1,0 s | 1,0 s | 0,3 s |
| Largest Contentful Paint | 4,4 s | 1,1 s | 4,2 s | 0,3 s |
| Total Blocking Time | 30 ms | 0 ms | 0 ms | 0 ms |
| Cumulative Layout Shift | 0,002 | 0 | 0,001 | 0 |
| Speed Index | 8,0 s | 1,3 s | 3,0 s | 0,5 s |
| Peso de la página | 4653 KiB | 57 KiB | 4660 KiB | 54 KiB |
| Peticiones | 93 | 7 | 93 | 7 |
| Respuesta del servidor (HTML) | 1,3 s | 30 ms | 2,0 s | 40 ms |

Notas para leer la tabla:

- El SEO de la versión conjunta baja a 69 solo por la auditoría `is-crawlable`, porque las páginas llevan `noindex` a propósito para que nadie las confunda con la web oficial. Es el resultado que queremos.
- La accesibilidad de la web actual pierde puntos por enlaces sin nombre accesible, enlaces dentro del texto que solo se distinguen por el color y la falta de un elemento `main`.
- La web actual carga 40 scripts y 26 hojas de estilo. La conjunta, un script y el CSS dentro del propio HTML.
- En móvil, el rendimiento de la web actual varió entre 58 y 70 en las tres pasadas. La conjunta dio 100 en todas.

## 5. Conclusiones

**Medido**

- La portada de la versión conjunta pesa unas 80 veces menos que la actual (unos 55 KiB frente a unos 4,6 MB) y hace 7 peticiones en lugar de 93.
- En móvil, el contenido principal aparece en 1,1 s frente a 4,4 s.
- El servidor de la web actual tarda entre 1,3 y 2 s en devolver el HTML. Cloudflare lo devuelve en 30 a 40 ms.
- Rendimiento y accesibilidad pasan de unos 70 y 87 a 100 en móvil y en escritorio.

**Observado** (en la prueba del flujo editorial del 29 de octubre de 2026)

- Guardar en el editor crea una rama `cms/...` y una pull request. Cloudflare tuvo la vista previa lista en aproximadamente un minuto.
- Publicar fusiona la pull request en `main` con un solo commit, borra la rama, y la web pública se actualizó en uno o dos minutos.
- Borrar una entrada es un borrador más: hay que pulsar Eliminar dos veces. La imagen de la noticia se queda en el repositorio.
- Un borrador que usaba una imagen de otro borrador sin publicar hizo fallar la vista previa. La web pública no se vio afectada en ningún momento.
- Al guardar un evento, el editor reordenó los campos y cambió el formato de las etiquetas. El cambio real era una palabra, pero el diff ocupaba más líneas.
- Una noticia borrada siguió respondiendo en su dirección antigua más de diez minutos con `CF-Cache-Status: HIT`, aunque ya no aparecía en el listado. No sabemos por qué esa página tenía una caché de una semana (`s-maxage=604800`) cuando el resto tiene `max-age=0`.
- Todas las páginas llevan la cabecera `X-Robots-Tag: noindex, nofollow`, también las vistas previas.

**Estimado** (sin medir ni probar)

- Con los usuarios reales la mejora debería ser parecida, pero Lighthouse es una prueba de laboratorio con red simulada. No tenemos datos de visitas reales.
- Un WordPress con caché de página completa y menos plugins acortaría bastante la distancia en tiempo de respuesta, aunque no en peso, que depende sobre todo del tema y de los plugins.
- Con Decap, la vista previa de Cloudflare probablemente no aparecería enlazada en el editor, porque Decap busca estados de commit y Cloudflare publica check runs.
- El coste es cero mientras el uso quepa en los planes gratuitos. Con la reconstrucción diaria (unas 30 construcciones al mes) y un uso normal del editor, debería sobrar margen hasta las 500 construcciones al mes del plan gratuito de Pages.

## 6. Dependencias y límites pendientes

**Servicios de los que depende**

- GitHub: el contenido, el acceso al editor, los permisos y la reconstrucción diaria.
- Cloudflare Pages: construye y sirve la web. El plan gratuito permite 500 construcciones al mes, una a la vez, 20 minutos por construcción, 20.000 archivos y 25 MiB por archivo. Cada vez que se guarda un borrador se gasta una construcción.
- Cloudflare Workers: el proxy OAuth `federg-cms-auth`.
- unpkg: sirve el código de Sveltia CMS 0.253.2. Si cae, el editor no carga.
- npm: Astro, sharp, Pagefind, Wrangler y Lighthouse, solo al construir o medir.

**Límites y tareas pendientes**

- No hay roles: todas las personas colaboradoras pueden publicar. Una protección de rama en `main` obligaría a revisar, pero probablemente impediría publicar desde el editor. No lo hemos probado.
- El token del editor sirve para todos los repositorios públicos de quien inicia sesión.
- La biblioteca de medios enseña imágenes de borradores ajenos sin publicar, lo que puede romper una vista previa.
- Las imágenes de noticias borradas se quedan en el repositorio y hay que borrarlas a mano.
- No hay copia del repositorio fuera de GitHub, ni una nota con la configuración de Cloudflare y de la aplicación OAuth para volver a montarla.
- GitHub pausa las acciones programadas tras 60 días sin commits en un repositorio público. Si eso pasa, la reconstrucción diaria deja de funcionar hasta reactivarla.
- Sveltia está fijado a una versión concreta. Actualizarlo es cambiar el número en `public/admin/index.html` y probar el editor.
- El editor está en español y el contenido en inglés. Si la web fuera multilingüe, habría que configurar los idiomas en el CMS.
- Hay que entender por qué la página borrada quedó en la caché de Cloudflare con una semana de duración, y si hace falta purgarla después de borrar algo.
- Las medidas de Lighthouse son de una sola página y de un solo día. Para conclusiones más firmes habría que medir más páginas y en varios días.

## 7. Qué hemos aprendido, dificultades y qué haríamos distinto

*Esta parte la escribimos nosotros.*

### Qué hemos aprendido

-

### Dificultades

-

### Qué haríamos distinto

-
