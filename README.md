# Yosselin MF Belleza — Landing Page

Landing page de una sola página (`index.html`, todo el CSS y JS están dentro del mismo archivo) lista para publicar en **GitHub Pages**.

## Cómo publicarla en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `yossemf-belleza`).
2. Copia `index.html` a la raíz de ese repositorio y haz commit + push.
3. En el repo, ve a **Settings → Pages**.
4. En "Build and deployment", elige **Deploy from a branch**, rama `main` y carpeta `/root`.
5. Guarda. En 1-2 minutos la página estará en `https://<tu-usuario>.github.io/<nombre-repo>/`.

Si prefieres que la URL sea `https://<tu-usuario>.github.io/` directamente (sin nombre de repo), el repositorio debe llamarse exactamente `<tu-usuario>.github.io`.

## Qué personalizar antes de publicar

Busca estos marcadores dentro de `index.html`:

- `CONFIG:` — textos que puedes cambiar libremente (titular principal, testimonios, etc.).
- `PLACEHOLDER:` — bloques con un ícono de cámara que representan fotos pendientes. Reemplázalos por una etiqueta `<img src="ruta-de-tu-foto.jpg" alt="...">` cuando tengan las fotos reales. Se recomienda crear una carpeta `img/` junto a `index.html` y guardar ahí las fotos.

## Enlaces ya configurados

- WhatsApp: `+51 942 029 354`
- Instagram: `@yossemf.belleza`
- TikTok: `@yossemf.belleza`

Si algún número o usuario cambia, se puede editar directamente en `index.html` — aparece varias veces (botones de WhatsApp, íconos de redes al final de la página, botón flotante de WhatsApp).

## Estructura de la página

1. Hero con CTA (WhatsApp / TikTok)
2. Mi historia + 6 pilares de contenido
3. Rutina de mañana y noche
4. Testimonios (nombres abreviados por privacidad)
5. Producto destacado (Epoch Polishing Bar)
6. Comunidad (galería de fotos pendiente)
7. Sección de reclutamiento — "Únete como socia"
8. CTA final + footer

## Notas de marca aplicadas

- Tono honesto: se usan palabras como "suaviza", "mejora", "renueva", "controla" — se evitan "elimina" y "cura".
- Testimonios con nombres abreviados/iniciales, respetando la privacidad de las clientas.
- Paleta rosa-nude elegante, tipografía Playfair Display + Poppins.
