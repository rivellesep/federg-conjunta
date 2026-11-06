# Nota de recuperación

Qué habría que volver a montar si perdemos el repositorio o alguna cuenta, dónde está la copia fuera de GitHub y cómo se hace el relevo de quien administra. Marcamos cada dato como **probado** (lo hemos hecho), **documentado** (lo dice la documentación oficial o el propio código) o **estimado** (lo suponemos, sin comprobar).

## Qué guarda el repositorio y qué no

El repositorio `rivellesep/federg-conjunta` guarda el código, el contenido (noticias, eventos, historias, miembros), la configuración del editor (`public/admin/config.yml`), el código del Worker de acceso (`cms-auth/`) y la acción de GitHub que reconstruye la web cada mañana.

No guarda nada de esto:

- Las cuentas: quién es propietario del repositorio, quién colabora y la cuenta de Cloudflare.
- Los secretos: el *client secret* de la aplicación OAuth y la URL del deploy hook.
- La configuración que se hace en los paneles: el proyecto de Cloudflare Pages, las variables secretas del Worker y la aplicación OAuth de GitHub.
- Las pull requests, sus comentarios y el historial de las acciones de GitHub.

Por eso Git no es una copia de seguridad: si se borra el repositorio o se pierde la cuenta, el historial se va con ellos, y aunque lo tengamos copiado, todo lo de la lista anterior hay que montarlo otra vez a mano.

## Las piezas y cómo se vuelven a montar

| Pieza | Dónde vive | Qué está en el repo | Qué hay que guardar aparte | Cómo se vuelve a crear |
| --- | --- | --- | --- | --- |
| Repositorio | GitHub, cuenta de Enric (`rivellesep`) | Todo el código y el contenido | Lista de colaboradores y ajustes del repo | Crear un repositorio vacío y subir la copia espejo (ver abajo) |
| Proyecto de Cloudflare Pages `federg-conjunta` | Cuenta de Cloudflare | `wrangler.toml` (nombre y carpeta `dist`), `.node-version` (Node 24) | Nada secreto | Crear el proyecto conectado a GitHub, rama de producción `main`, comando `npm run build`, carpeta `dist` (documentado) |
| Aplicación OAuth de GitHub | Ajustes de desarrollador de la cuenta de GitHub que la creó | Nada | *Client ID* y *client secret* | Crear una aplicación OAuth nueva con la URL de retorno `https://<worker>/callback` (la ruta `/callback` está en `cms-auth/src/index.js`) |
| Worker `federg-cms-auth` | Cuenta de Cloudflare, subdominio `enric-albert-federg.workers.dev` | El código (`cms-auth/`) y `ALLOWED_DOMAINS` | Los secretos `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` | `npm run cms-auth:deploy` y añadir los dos secretos en el panel. Si cambia el subdominio de la cuenta, cambiar `base_url` en `public/admin/config.yml` |
| Deploy hook | Ajustes del proyecto de Pages | La acción `.github/workflows/daily-rebuild.yml` | La URL del hook | Crear un deploy hook nuevo para `main` y guardarlo como secreto `CLOUDFLARE_DEPLOY_HOOK` en GitHub (Settings → Secrets and variables → Actions) |

Si seguimos con la opción A de la rama `sin-github` (acceso al editor con email), se añaden estas piezas, todas en Cloudflare o en GitHub: el Worker `federg-cms-email`, la organización de Zero Trust `federg-practicas` con su método de pago, la aplicación de Access, la GitHub App (ID 5625343) instalada en el repositorio y sus secretos `GITHUB_APP_PRIVATE_KEY` y `EDITOR_ALIASES`.

Los secretos de GitHub Actions y de los Workers no se pueden volver a leer una vez guardados (documentado). Si no tenemos una copia, hay que generar unos nuevos.

## Copia fuera de GitHub

**Cómo la hacemos.** Una copia espejo del repositorio, que incluye todas las ramas y todo el historial:

```bash
git clone --mirror https://github.com/rivellesep/federg-conjunta.git
```

Para ponerla al día más adelante, dentro de esa carpeta:

```bash
git remote update
```

Lo probamos el 6/11: la copia ocupa 7,2 MB, tiene las ramas `main` y `sin-github`, y al clonar desde ella sale el proyecto completo con el último commit (probado).

**Dónde la guardamos.** En un sitio que no dependa de la cuenta de GitHub: un disco externo o el almacenamiento en la nube de la asociación. La ponemos al día una vez al mes y después de cada cambio grande (estimado: es lo que nos parece razonable para la frecuencia con la que cambia la web).

**Cómo se restaura.** Crear un repositorio vacío y, desde la carpeta de la copia:

```bash
git push --mirror https://github.com/NUEVA-CUENTA/federg-conjunta.git
```

Esto último no lo hemos probado porque habría que crear otro repositorio. Después hay que cambiar `repo` en `public/admin/config.yml` y, si se usa la opción A, `REPO_OWNER` y `REPO_NAME` en `cms-email/wrangler.toml`.

**Los secretos no van en la copia.** Van en un gestor de contraseñas compartido de la asociación, junto con quién tiene acceso a cada cuenta.

## Orden para volver a montarlo todo

1. Restaurar el repositorio desde la copia espejo y volver a invitar a las personas que colaboran.
2. Crear la aplicación OAuth de GitHub.
3. Desplegar el Worker `federg-cms-auth` y añadirle los dos secretos.
4. Si el Worker tiene una dirección nueva, cambiar `base_url` en `public/admin/config.yml`.
5. Crear el proyecto de Cloudflare Pages conectado al repositorio.
6. Crear el deploy hook y guardarlo como secreto de GitHub Actions.
7. Comprobar que funciona: entrar en `/admin/`, crear un borrador de prueba, ver su vista previa y descartarlo.

No hemos hecho una restauración completa, así que no sabemos cuánto tarda (estimado: una o dos horas para alguien que ya conozca las piezas).

## Relevo de quien administra

Con la configuración actual la cuenta crítica es la de GitHub, y con la opción A pasaría a ser la de Cloudflare (cuenta, método de pago y panel de Zero Trust). La opción A no quita el problema, lo cambia de sitio: siempre hay una cuenta de la que depende todo.

**Quién debería ser.** En una asociación real, una persona estable de la junta (por ejemplo, de secretaría), no un voluntario de paso ni alguien en prácticas. Y siempre dos: una titular y una suplente, para que nada dependa de una sola persona. Las cuentas, a nombre de un correo de la asociación (del tipo `web@federg.org`) y no de un correo personal, y el método de pago, a nombre de la asociación.

**Qué pasa si deja de estarlo sin relevo.** La asociación puede quedarse sin acceso a la cuenta donde están la web, el acceso al editor y los secretos. Si el repositorio es de una cuenta personal, como ahora (`rivellesep`), depende de esa persona que se pueda seguir editando. Por eso, en una asociación real el repositorio debería estar en una organización de GitHub de la asociación, con al menos dos propietarios.

**Cómo se hace el relevo** (antes de que la persona se vaya, no después):

1. Dar a la persona nueva el rol más alto en GitHub (propietaria de la organización) y en Cloudflare (Super Administrator).
2. Pasarle la titularidad de las cuentas y el método de pago.
3. Cambiar los secretos que conocía la persona saliente: el *client secret* de la aplicación OAuth, la URL del deploy hook y, con la opción A, la clave de la GitHub App. Actualizarlos en el gestor de contraseñas.
4. Revisar quién tiene acceso: colaboradores del repositorio y, con la opción A, los correos permitidos en Access.
5. Quitar los permisos de la persona saliente.
6. Comprobar que todo sigue funcionando (paso 7 de la lista anterior) y apuntar en esta nota quién es ahora titular y suplente, con la fecha.

**Responsables actuales** (a mantener al día):

| Cuenta | Titular | Suplente | Última revisión |
| --- | --- | --- | --- |
| GitHub (repositorio) | | | |
| Cloudflare | | | |
| Gestor de contraseñas | | | |

Esta nota hay que repasarla cada seis meses y cada vez que cambie alguna pieza.
