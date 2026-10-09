# GitHub Branch Grabber

Extensión de Chrome que agrega un botón en los issues de GitHub para copiar al portapapeles el
nombre de la rama del PR vinculado, sin tener que abrir el PR.

## Qué hace

En la página de un issue, al lado de cada PR que aparece en la sección **Development** de la barra
lateral, agrega un botón `⎘`. Al hacer click:

1. Busca la página del PR usando tu sesión de GitHub ya iniciada (funciona en repos privados, sin
   tokens).
2. Extrae el nombre de la rama (`headRefName`) del JSON que GitHub incrusta en el HTML.
3. Lo copia al portapapeles y muestra `✓` (o `!` si algo falló; pasá el mouse por encima para ver
   el detalle).

El nombre de rama queda cacheado mientras no recargues la página.

## Instalación

1. Abrí `chrome://extensions` (también funciona en Edge: `edge://extensions`).
2. Activá **Developer mode**.
3. Click en **Load unpacked** y elegí esta carpeta.

Después de modificar el código, apretá el botón de recarga de la extensión en
`chrome://extensions` y refrescá la pestaña de GitHub.

## Estructura

| Archivo         | Descripción                                                    |
| --------------- | -------------------------------------------------------------- |
| `manifest.json` | Manifest V3: permisos y registro del content script.           |
| `content.js`    | Detecta los links a PRs, agrega los botones y obtiene la rama. |
| `content.css`   | Estilos del botón (usa las variables de color de GitHub).      |

## Notas

- **Navegación sin recarga**: GitHub cambia de página con Turbo, así que el content script se
  inyecta en todo `github.com` y solo actúa cuando la URL es un issue (`/<owner>/<repo>/issues/<n>`).
  Un `MutationObserver` reinyecta los botones cuando cambia el DOM.
- **Dependencia del HTML de GitHub**: si GitHub cambia cómo incrusta los datos del PR, la extracción
  puede romperse. Hay un fallback que busca el elemento `.commit-ref` del DOM. Si el botón muestra
  `!`, revisá la consola del navegador (los errores tienen el prefijo `branch-grabber:`).
