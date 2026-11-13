// Mantiene los recursos dentro de la URL del juego, también en GitHub Pages.
export const assetUrl = path => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
