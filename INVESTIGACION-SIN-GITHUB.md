# Actualizar la web de FEDERG sin conectar GitHub

> **Proyecto de prácticas.** No es la web oficial de FEDERG (la oficial es [federg.org](https://federg.org/)). Todo el contenido es de ejemplo y las historias de pacientes son inventadas.

Investigación del 5 de noviembre de 2026, a partir de la tarea del tutor: buscar formas de que el equipo de una asociación de pacientes actualice la web sin tener cuenta de GitHub, sin permisos en el repositorio y sin tokens.

## Resumen

Hoy, para editar la web, hace falta una cuenta de GitHub con permiso de escritura en el repositorio y verificación en dos pasos. Hemos comparado tres caminos y probado el que mejor encaja:

- **Recomendación: mantener el editor actual (Sveltia CMS) y ponerle delante un acceso por email con Cloudflare Access.** Un Worker hace de intermediario y escribe en GitHub con una aplicación propia, así que la persona que edita no ve GitHub en ningún momento. Conserva los borradores, la vista previa, el historial y la publicación en Cloudflare Pages tal como funcionan ahora, y cuesta 0 €.
- **Alternativa sin programar: Pages CMS**, un editor alojado y gratuito que invita por email. Es lo más sencillo de montar, pero publica directamente, sin borradores ni vista previa, y deja escribir en el repositorio a un servicio de terceros.
- **Lo que no recomendamos para FEDERG**: un CMS con base de datos propia como Sanity. Saca el contenido de Git, el historial gratuito dura solo tres días y obliga a reescribir la web.

Hemos montado la opción recomendada en una rama aparte (`sin-github`) y funciona de punta a punta para crear y publicar una noticia con imagen. Quedan sin probar algunas partes que se detallan más abajo, sobre todo el acceso de una persona que no tenga cuenta de Cloudflare.

## Cómo hemos trabajado

- Toda la información sale de la documentación oficial de cada servicio consultada el 5 de noviembre de 2026. Los precios y los planes gratuitos cambian a menudo, así que conviene revisarlos antes de decidir.
- Cada dato lleva una de estas marcas:
  - **Probado**: lo hemos hecho y comprobado nosotros.
  - **Documentado**: lo dice la documentación oficial, pero no lo hemos probado.
  - **Estimado**: es una deducción nuestra, sin confirmar.
- No hemos tocado la web publicada, el editor actual ni el Worker de GitHub. La prueba vive en la rama `sin-github` y en un Worker nuevo.

## Las tres opciones comparadas

### A. Editor actual con acceso por email (Cloudflare Access y un Worker propio)

El editor abre una dirección propia del CMS. Cloudflare Access le pide el email y le envía un código. Detrás, un Worker comprueba ese acceso en cada petición y habla con GitHub usando una GitHub App, una "cuenta de robot" que solo tiene permiso sobre este repositorio. El token de esa app dura una hora y nunca llega al navegador.

| Criterio | Detalle |
| --- | --- |
| Cómo entra el equipo | Email y código de un solo uso de Cloudflare Access (**documentado**). En la prueba entramos con la cuenta de Cloudflare, no con el código (**probado**, ver límites). |
| Roles y permisos | Access decide quién entra. Dentro del editor todos pueden lo mismo, como ahora. |
| Vista previa | La misma de ahora: cada borrador es una rama y Cloudflare construye su copia de la web (**probado**). Que el enlace aparezca dentro del editor no lo llegamos a comprobar. |
| Imágenes | Igual que ahora: se suben desde el editor, se convierten a WebP y Astro las optimiza (**probado**). |
| Historial | Sigue en Git. Cada cambio queda como commit, pero el autor es el robot. El Worker añade al mensaje un nombre del editor, nunca su email, porque el repositorio es público (**probado**). |
| Publicación en Cloudflare Pages | Igual que ahora: publicar fusiona el borrador y Cloudflare reconstruye la web (**probado**). |
| Coste y límites | Zero Trust es gratis hasta 50 personas (**documentado**), pero pide un método de pago al activarlo aunque cueste 0 € (**probado**). Workers gratis. |
| Qué se pierde frente al flujo actual | Nada del flujo del editor. Se pierde saber, solo con GitHub, quién hizo cada cambio, y el editor ya no puede deshacer cambios desde la web de GitHub. |
| Qué hay que mantener | Unas 380 líneas de código propio en `cms-email/`, la GitHub App y la regla de Access. |

### B. Pages CMS alojado (invitación por email)

Un editor web gratuito que se conecta al repositorio con su propia GitHub App. Quien administra invita a cada persona por email y esa persona entra sin cuenta de GitHub.

| Criterio | Detalle |
| --- | --- |
| Cómo entra el equipo | Invitación por email, sin cuenta de GitHub (**documentado**). |
| Roles y permisos | Las personas invitadas editan contenido e imágenes, pero no la configuración ni las invitaciones (**documentado**). |
| Vista previa | No hay borradores ni vista previa documentados. Hay una petición abierta desde 2023 para trabajar en una rama antes de publicar (**documentado**). |
| Imágenes | En el repositorio, con su propio gestor (**documentado**). Habría que comprobar que respeta las rutas que necesita Astro (**estimado**). |
| Historial | En Git. Por defecto, los commits no dicen qué persona invitada los hizo, aunque se puede configurar (**documentado**). |
| Publicación en Cloudflare Pages | Cada guardado es un commit en la rama principal y Cloudflare publica al momento (**estimado**). |
| Coste y límites | Gratis en su versión alojada (**documentado**). |
| Qué se pierde frente al flujo actual | Los borradores, la vista previa y la revisión antes de publicar. Hay que rehacer la configuración del editor en su formato. |
| Qué hay que mantener | Solo su archivo de configuración. Dependemos de que el servicio siga funcionando y siendo gratis. |

### C. CMS con base de datos propia (Sanity)

El contenido sale de Git y pasa a la base de datos de Sanity. La web lo lee al construirse y Sanity avisa a Cloudflare para reconstruirla.

| Criterio | Detalle |
| --- | --- |
| Cómo entra el equipo | Cuenta de Sanity, con email o Google. |
| Roles y permisos | Hasta 20 personas y 2 roles en el plan gratuito (**documentado**). |
| Vista previa | En una web estática hay que montar una construcción aparte para ver borradores (**estimado**). |
| Imágenes | En el servicio de imágenes de Sanity, con 100 GB gratis (**documentado**). |
| Historial | En Sanity, solo 3 días en el plan gratuito (**documentado**). |
| Publicación en Cloudflare Pages | Un aviso automático al deploy hook de Cloudflare (**estimado**: no hemos confirmado que el plan gratuito lo incluya). |
| Coste y límites | Gratis con 10.000 documentos y 250.000 llamadas al mes (**documentado**). |
| Qué se pierde frente al flujo actual | El historial largo, el contenido en archivos y el trabajo hecho: habría que reescribir la carga de contenidos y migrar todo. |
| Qué hay que mantener | El esquema en Sanity, la integración con Astro y las copias de seguridad, que habría que exportar aparte. |

## Otras opciones que miramos y descartamos

- **Keystatic Cloud**: entra sin GitHub y es gratis hasta 3 personas, pero obliga a pasar Astro a modo servidor y las imágenes en su nube son de pago.
- **TinaCloud**: gratis para 2 personas, pero los borradores (editorial workflow) son de pago y habría que rehacer todo el contenido con su sistema.
- **Decap Turbo**: invita editores sin servidor propio, pero su plan gratuito es de 1 sitio y 1 plaza, y habría que cambiar Sveltia por Decap.
- **Storyblok**: solo 1 plaza gratis, como mucho 2.
- **Directus**: cerró su plan gratuito en la nube y alojarlo nosotros necesita un servidor, que no es gratis.
- **Notion o Google Sheets como fuente de contenido**: cómodos para el equipo, pero sin vista previa ni validación de campos. Las imágenes de Notion caducan en una hora y su botón para avisar a Cloudflare es de pago. Podría servir solo para una tabla de eventos.

## La prueba de la opción A

### Cómo está montada

- `cms-email/src/index.js`: el Worker. Sirve el editor, responde al inicio de sesión del editor con un valor de relleno que no es secreto y hace de intermediario con GitHub.
- `cms-email/build-config.mjs`: genera la configuración del editor a partir de la actual, `public/admin/config.yml`. Las colecciones son las mismas y solo cambia la conexión.
- `cms-email/wrangler.toml`: la configuración del Worker. La clave de la GitHub App está como secreto en Cloudflare, no en el código.
- Para la prueba, el editor guarda y publica en la rama `sin-github`, no en `main`. La web de prueba es `sin-github.federg-conjunta.pages.dev`. Para usarlo de verdad bastaría con cambiar la rama en `build-config.mjs`.

El Worker comprueba por su cuenta la firma del acceso de Cloudflare en cada petición, aunque Cloudflare ya la compruebe antes. Además, solo deja pasar llamadas a este repositorio y bloquea lo que el editor no necesita: otros repositorios, claves, webhooks, colaboradores, Actions, secretos, protección de ramas y borrar el repositorio.

### Qué hemos probado

**Medido en local** (`npm run cms-email:test`): 26 comprobaciones con Cloudflare y GitHub simulados, todas correctas. Por ejemplo, que se rechace un acceso caducado, de otra aplicación o con otra firma, que se bloqueen las rutas peligrosas y que el token real nunca salga del Worker.

**Observado en la prueba real**:

- Al abrir el editor, Cloudflare pide identificarse y después se entra sin ninguna cuenta de GitHub.
- La primera vez falló: Sveltia añade `/api/v3` a las direcciones cuando el servidor no es GitHub.com, como haría con GitHub Enterprise. Lo corregimos en el Worker.
- Crear una noticia con imagen generó la rama `cms/news/test-email-cms` y la pull request #5. Cloudflare construyó su vista previa en `cms-news-test-email-cms.federg-conjunta.pages.dev`.
- Al publicar, la app fusionó la pull request y borró la rama. La noticia apareció en `sin-github.federg-conjunta.pages.dev/news/` con `noindex`. La web principal no cambió.
- El commit lo firma `federg-cms-email[bot]` con el mensaje "Edited with the email CMS by editor 1cc35603". No aparece el email de nadie.
- La imagen se guardó convertida a WebP en `src/assets/news/`.

**No probado**:

- **Entrar sin cuenta de Cloudflare.** La pantalla que ofrece Cloudflare para proteger un Worker solo deja elegir entre "miembros de la cuenta de Cloudflare" o "todo un dominio de email". En la prueba entramos como miembro de la cuenta. Para una persona de la asociación habría que crear una regla con su email en el panel de Zero Trust y usar el código de un solo uso. Según la documentación es posible, pero no lo hemos hecho.
- Modificar un evento, ver el enlace de vista previa dentro del editor, borrar una entrada y deshacer un cambio.
- Varias personas editando a la vez y qué pasa cuando caduca la sesión.

## Riesgos

**Opción A**

- El Worker es código nuestro y tiene en sus manos un token con escritura en el repositorio. Un fallo en él sería grave. Lo mitigan el permiso mínimo de la app, el bloqueo de rutas y la comprobación del acceso en cada petición, pero alguien tiene que mantenerlo.
- Si la clave privada de la GitHub App se filtra, quien la tenga puede escribir en el repositorio hasta que se revoque. Está guardada como secreto en Cloudflare.
- Todo queda a nombre del robot. Para saber quién hizo un cambio hay que fiarse del nombre que añade el Worker.
- Zero Trust pide un método de pago para activarse. En una asociación habría que decidir qué tarjeta se pone y vigilar no pasar de 50 personas.
- Depende de que Sveltia siga funcionando igual: una actualización podría cambiar las llamadas que hace. Por eso está fijado a una versión.

**Opción B**

- Un servicio externo tiene permiso de escritura en el repositorio y guarda la lista de personas invitadas.
- Sin vista previa, un error se publica directamente.
- Si el servicio cierra o deja de ser gratis, hay que cambiar de editor.

**Opción C**

- El contenido queda en un servicio externo y el historial gratuito es de tres días.
- Si se superan los límites del plan gratuito se paga por uso.
- La migración es grande y se pierde lo que ya funciona.

## Por qué recomendamos la opción A

1. **Cumple el objetivo**: la persona que edita no tiene ni conecta GitHub.
2. **No se pierde nada del flujo actual**: borradores, vista previa en Cloudflare, publicación, historial en Git e imágenes optimizadas.
3. **Sigue siendo gratis** en Cloudflare Pages, Workers y Zero Trust, con hasta 50 personas.
4. **Convive con la versión actual**: las dos pueden funcionar a la vez sobre el mismo contenido mientras se decide.

El precio es mantener un poco de código propio y aceptar que Cloudflare pida un método de pago. Si eso no fuera aceptable, la opción B es la salida más sencilla, sabiendo que se pierden los borradores y la vista previa.

## Límites y tareas pendientes

- Probar la entrada con email y código de una persona sin cuenta de Cloudflare, creando la regla por emails en Zero Trust.
- Probar la edición de un evento, el enlace de vista previa en el editor, el borrado y cómo deshacer un cambio.
- Sin cuenta de GitHub, el editor no puede usar el botón Revert de GitHub. Deshacer pasa por volver a editar en el editor o por pedirlo a quien administra.
- Sin acceso a GitHub ni a Cloudflare, el editor tampoco ve por qué falla una construcción. Habría que avisar a quien administra.
- Si algún día se usa en serio: cambiar la rama a `main`, revisar la regla de Access, guardar la clave privada en un gestor de contraseñas y apuntar cómo volver a montarlo todo.
- El botón del editor sigue diciendo "Iniciar sesión con GitHub", aunque no pide GitHub. Es el texto de Sveltia para este tipo de conexión y puede confundir.

## Fuentes

- Cloudflare: [precios de Zero Trust](https://en-us.www.cloudflare.com/teams-pricing/), [lanzamiento del plan gratuito de 50 usuarios](https://blog.cloudflare.com/teams-plans/), [Access en Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [cambios de Access en Workers de agosto de 2026](https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/), [políticas reutilizables](https://developers.cloudflare.com/changelog/post/2025-12-03-reusable-access-policies/), [aplicaciones protegidas](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [problemas conocidos de Pages](https://developers.cloudflare.com/pages/platform/known-issues/), [límites de Pages](https://developers.cloudflare.com/pages/platform/limits/).
- Sveltia CMS: [conexión con GitHub](https://sveltiacms.app/en/docs/backends/github), [tipos de conexión](https://sveltiacms.app/en/docs/backends). Proyectos parecidos de la comunidad: [sveltia-cms-cloudflare-access-auth](https://github.com/hollesse/sveltia-cms-cloudflare-access-auth) y [sveltia-auth-proxy](https://github.com/maikunari/sveltia-auth-proxy).
- GitHub: [tokens de instalación de una GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).
- Decap: [Git Gateway](https://decapcms.org/docs/git-gateway-backend/), [Decap Turbo](https://decapcms.org/turbo/), [facturación de Turbo](https://decapcms.org/docs/turbo-billing/).
- Pages CMS: [colaboradores](https://pagescms.org/docs/configuration/collaborators/), [autenticación](https://pagescms.org/docs/development/authentication/), [web](https://pagescms.org/), [petición de borradores](https://github.com/pages-cms/pages-cms/issues/22).
- Keystatic: [Keystatic Cloud](https://keystatic.com/docs/cloud), [instalación con Astro](https://keystatic.com/docs/installation-astro).
- Tina: [precios](https://tina.io/pricing), [editorial workflow](https://tina.io/docs/tinacloud/editorial-workflow), [cambios de precios](https://tina.io/blog/tinacloud-pricing-changes).
- Sanity: [precios](https://www.sanity.io/pricing), [historial](https://www.sanity.io/docs/user-guides/history-experience), [límites técnicos](https://www.sanity.io/docs/content-lake/technical-limits).
- Storyblok: [precios](https://www.storyblok.com/pricing). Directus: [precios](https://directus.io/pricing/self-hosted).
- Notion: [límites de la API](https://developers.notion.com/reference/request-limits), [archivos](https://developers.notion.com/reference/file-object), [acciones de webhook](https://www.notion.com/help/webhook-actions). Astro: [loaders de la comunidad](https://astro.build/blog/community-loaders/).
