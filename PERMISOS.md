# Quién publica y quién solo propone

Pregunta de la revisión del 29/10: si la web fuera real y la editara la asociación, ¿quién debería poder publicar directamente y quién solo proponer cambios? Cómo montarlo con este stack y qué se rompería del editor. Marcamos cada dato como **probado**, **documentado** o **estimado**.

## Cómo está ahora

Sveltia CMS no tiene roles propios: usa los permisos del repositorio de GitHub (documentado). Quien tiene permiso de escritura puede guardar borradores **y** publicarlos; quien no lo tiene no puede ni guardar. Hoy los colaboradores somos Enric y Albert, así que cualquiera de los dos publica sin que nadie revise (probado: así publicamos las pruebas del 29/10).

Para una asociación eso no vale: una persona voluntaria con pocas horas de formación podría publicar un error, o un dato personal, sin que nadie lo vea antes.

## Propuesta: dos papeles

| Papel | Quién | Qué puede hacer | Permiso en GitHub |
| --- | --- | --- | --- |
| Editor | Voluntarios y personal que escribe noticias y eventos | Crear y modificar borradores y marcarlos como **Listo** | Write |
| Revisor | Una o dos personas de confianza, por ejemplo de la junta | Revisar la vista previa, aprobar y publicar | Maintain |
| Administrador | Dos personas (titular y suplente, ver [RECUPERACION.md](RECUPERACION.md)) | Cambiar ajustes, permisos y secretos | Owner de la organización |

Para poder separar así a las personas, el repositorio tendría que estar en una **organización de GitHub de la asociación**, con un equipo "editores" y otro "revisores", en lugar de en una cuenta personal como ahora.

## Cómo se monta

Una regla de protección (*ruleset*) sobre la rama `main`, en Settings → Rules → Rulesets (documentado):

1. **Exigir pull request antes de fusionar**, con **una aprobación** de otra persona. GitHub no deja aprobar la pull request propia, así que siempre la revisa alguien distinto de quien la escribió (documentado).
2. **Descartar las aprobaciones si el borrador cambia después**, para que no se publique algo distinto de lo que se revisó.
3. **Exigir que pase el build de Cloudflare Pages** (Cloudflare publica el resultado como *check run* en cada pull request). Así un borrador roto no puede llegar a la web, como el de la imagen del 29/10, cuyo build falló.
4. **Bloquear los `push --force` y que se pueda borrar `main`**.
5. **Permitir solo fusión con *squash***, que es la que usa el editor (`squash_merges: true` en `public/admin/config.yml`).
6. **Nadie en la lista de excepciones**, o solo los administradores, y solo para emergencias.

Además, verificación en dos pasos obligatoria para todo el mundo en la organización.

## Cómo quedaría el flujo

1. La persona editora crea o cambia una noticia en `/admin/` y la marca como **Listo**.
2. La persona revisora abre la pull request en GitHub, mira la vista previa de Cloudflare y, si está bien, la **aprueba**.
3. La revisora la publica: con el botón de fusionar de GitHub o con **Publicar** en el editor.

## Qué se rompe del editor

- **El botón Publicar falla para los editores.** El editor publica fusionando la pull request con el token de quien ha iniciado sesión; si falta la aprobación, GitHub rechaza la fusión y el editor da un error (estimado: es lo que esperamos por cómo funcionan las reglas, no lo hemos probado). Los editores seguirían pudiendo guardar y marcar Listo.
- **El editor no enseña la aprobación.** Los estados del editor (borrador, en revisión, listo) no saben si alguien ha aprobado la pull request, así que habrá que mirarlo en GitHub (estimado).
- **Borrar también pasa por revisión**, porque un borrado es otro borrador.
- **Con una sola revisora, sus propios cambios se quedan bloqueados**, porque no puede aprobárselos. Hacen falta al menos dos personas con papel de revisor, o que el cambio lo revise un administrador.
- **Las urgencias son más lentas**: para retirar algo hace falta que otra persona apruebe. Por eso conviene que haya administradores en la lista de excepciones solo para emergencias, y que quede registrado.
- **La reconstrucción diaria no se ve afectada**, porque usa el deploy hook y no hace commits en `main` (documentado en `.github/workflows/daily-rebuild.yml`).
- **El permiso del editor sigue siendo amplio**: el token que pide (`public_repo`) sirve para todos los repositorios públicos de esa persona, no solo para este (documentado).

**Con la opción A** (rama `sin-github`), quien guarda y publica en GitHub es la GitHub App, no la persona. Las reglas de `main` se aplicarían igual, pero los papeles habría que comprobarlos en el Worker (qué correos pueden publicar y cuáles solo guardar), porque para GitHub todos los cambios vendrían del mismo robot (estimado).

## Cómo lo probaríamos sin tocar la web publicada

No lo hemos probado todavía. Este sería el plan:

1. Crear un repositorio de prueba con una copia espejo de este (ver [RECUPERACION.md](RECUPERACION.md)) y activar en él la regla de protección de `main`.
2. Crear una rama `prueba-permisos` en este repositorio donde `public/admin/config.yml` apunte a ese repositorio de prueba. Su vista previa de Cloudflare tendría un `/admin/` que trabaja contra la copia, y el acceso funciona porque el Worker ya admite `*.federg-conjunta.pages.dev`.
3. Con una cuenta con permiso Write, crear un borrador, marcarlo Listo e intentar publicar: debería dar error.
4. Con otra cuenta con permiso Maintain, aprobarlo en GitHub y publicarlo desde el editor: debería funcionar.
5. Apuntar lo que pase de verdad aquí, cambiando "estimado" por "probado" donde corresponda, y borrar la rama y el repositorio de prueba.
