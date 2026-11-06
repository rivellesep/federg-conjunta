# Por qué la noticia borrada se seguía viendo

En la prueba del editor borramos la noticia "TEST", pero su dirección siguió funcionando con la cabecera `Cache-Control: public, s-maxage=604800`. En la revisión del 29/10 nos pidieron averiguar de dónde sale esa caché y decidir si hay que purgarla al borrar contenido. Aquí separamos lo que medimos, lo que dice Cloudflare y lo que creemos que pasa.

## Qué medimos

Lo medimos el 2 de noviembre de 2026 a las 12:00 UTC. La respuesta venía del centro de datos de Madrid (la cabecera `CF-Ray` termina en `MAD`).

La noticia se creó y se borró desde el editor el 29/10: commit `69914c8` a las 12:12 y commit `658b989` a las 12:14, hora peninsular. Cuatro días después:

| Dirección | Respuesta | `Cache-Control` | `CF-Cache-Status` | `Age` |
| --- | --- | --- | --- | --- |
| `/news/test/` (borrada) | 200, con el título "TEST · FEDERG" | `public, s-maxage=604800` | `HIT` | 348.422 s (4 días y 47 min) |
| `/news/world-kidney-day-2026/` (existe) | 200 | `public, max-age=0, must-revalidate` | no aparece | no aparece |
| `/` y `/news/` (existen) | 200 | `public, max-age=0, must-revalidate` | no aparece | no aparece |
| `/news/test` (sin barra al final) | 404 | `no-store` | no aparece | no aparece |
| `/noticia-que-no-existe/` | 404 | `no-store` | no aparece | no aparece |

Otras cosas que comprobamos:

- La noticia borrada ya no está en el listado de `/news/`, ni en `sitemap-0.xml`, ni en el buscador (buscando "gallo" no sale nada). Solo responde si alguien tiene la dirección exacta.
- Si a la hora de la medición le restamos el `Age`, sale el 29/10 a las 12:13, hora peninsular. Es el minuto en el que la noticia estaba publicada, así que la copia de la caché es de ese momento.
- 604.800 segundos son exactamente 7 días. Si no cambia nada, esa copia caduca hacia el 5/11/2026 a las 12:13.
- En el repositorio no hay ninguna regla que ponga `s-maxage`. `public/_headers` solo cambia la caché de `/_astro/*` (un año) y de `/pagefind/*` (una hora).

## Qué dice Cloudflare

La documentación de Cloudflare Pages ([Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), apartado *Asset retention*) explica que cada centro de datos guarda en caché los archivos de un despliegue con una "time-to-live (TTL) of one week", y que después de un despliegue nuevo esos archivos "could exist in that data center up to one week".

En la misma página dice que, para quitar archivos antiguos, hay que ir a la zona del dominio y usar Caching → Configuration → *Purge Everything*. Esa opción solo está disponible si la web tiene un dominio propio gestionado en Cloudflare.

## Qué creemos que pasa

1. **El `s-maxage=604800` no lo ponemos nosotros.** Viene de esa retención de archivos de Cloudflare Pages: cuando una dirección desaparece en un despliegue nuevo, Pages puede seguir sirviendo la copia del despliegue anterior durante una semana. Cuadran tres cosas: el valor es justo una semana, solo lo tiene la página borrada y la copia es del minuto en que la noticia existía. Que esto se aplique precisamente a las páginas borradas lo deducimos nosotros; la documentación habla de archivos de despliegues anteriores en general.
2. **Por eso las páginas editadas sí se actualizaban enseguida.** Las direcciones que siguen existiendo se sirven siempre desde el despliegue actual, con `max-age=0, must-revalidate`. En la prueba del 29/10 el cambio del evento World Kidney Day se vio publicado en uno o dos minutos. El problema solo pasa con lo que desaparece.
3. **Ahora mismo no se puede purgar.** La web está en `federg-conjunta.pages.dev`, que es un subdominio de Cloudflare y no una zona nuestra, así que no hay botón para purgar. Con un dominio propio sí se podría purgar solo esa dirección (*Custom Purge*), sin vaciar toda la caché.

## Qué decidimos

En el día a día **no purgamos**. Que una noticia borrada siga respondiendo hasta 7 días es aceptable: deja de estar enlazada, de salir en el buscador y de estar en el sitemap, y además todas las páginas llevan `noindex`. Conviene añadir una línea a EDITOR.md ("al borrar, la dirección antigua puede seguir respondiendo hasta 7 días") para que nadie piense que el borrado ha fallado.

Si hubiera que **retirar algo con urgencia**, por ejemplo un dato personal publicado por error, borrar no basta. Lo haríamos así, por orden:

1. **Sobrescribir antes de borrar.** Editar la noticia desde el editor, cambiar el texto y la imagen por "Contenido retirado", publicar y comprobar que se ve. Como la dirección sigue existiendo, Cloudflare sirve la versión nueva en uno o dos minutos. Cuando pase una semana, ya se puede borrar.
2. **Redirigir la dirección** con una regla en `public/_redirects`, por ejemplo `/news/test/  /news/  301`. La [documentación de redirecciones](https://developers.cloudflare.com/pages/configuration/redirects/) dice que las redirecciones "are always followed, regardless of whether or not an asset matches". No lo hemos probado con una copia retenida en caché, así que antes de fiarnos habría que probarlo en una rama.
3. **Con dominio propio**, además, purgar esa dirección en Cloudflare.

Nada de esto borra el contenido del historial de Git: el texto y la imagen siguen en los commits antiguos, y la imagen de la noticia de prueba sigue en el repositorio. Si el dato fuera de verdad sensible habría que reescribir el historial, y eso no se puede hacer desde el editor.

## Comprobación del 6/11

Volvimos a medir el 6 de noviembre de 2026 a las 11:27 UTC. `/news/test/` ya responde **404** con `Cache-Control: no-store`, igual que cualquier dirección que no existe. La copia caducó cuando habíamos calculado (hacia el 5/11 a mediodía), así que se confirma que era una caché de una semana y que se va sola.

## Pendiente de comprobar

- Probar la opción 2 (redirección) en una rama, con una página creada y borrada a propósito.
- Solo hemos medido desde el centro de datos de Madrid. En otros centros la copia puede caducar en otro momento o no existir.
