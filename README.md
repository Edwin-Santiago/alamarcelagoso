# Road Rush 3D · Análisis Numérico

Juego 3D (React + Three.js) con 3 vidas, huecos y rocas generados al azar, dificultad creciente y,
al perder, un análisis numérico completo de tu partida con procedimiento y gráficas.

## Cómo correrlo en Visual Studio Code
1. Instala Node.js 22 LTS (https://nodejs.org).
2. Abre esta carpeta en VS Code → Terminal → Nuevo terminal.
3. `npm install`
4. `npm run dev`  (abre http://localhost:5173)

Otros comandos: `npm test` (pruebas de métodos numéricos y simulación con bots), `npm run build`.

## Controles
W acelerar · S frenar · A/D izquierda-derecha · P pausa · M sonido

## Estructura
- `src/game/logic.js`   lógica pura del juego (vidas, obstáculos, niveles, registro de datos)
- `src/game/engine.js`  render 3D con Three.js
- `src/analysis/numerics.js`  regresión, trapecio, Simpson, bisección, punto fijo, Newton
- `src/analysis/AnalysisView.jsx` pantalla de análisis (tablas, procedimiento, gráficas)
- `blender/` modelos editables y scripts de generación

## Dificultad
Cada 600 m sube un nivel: más velocidad, filas más juntas, más obstáculos por fila y más huecos.
Edita las fórmulas en la parte superior de `src/game/logic.js`.


## Actualización gráfica
- El modelo Blender mantiene su giro de 180° dentro de un grupo independiente: las animaciones ya no invierten el frente.
- Carretera, líneas y bordes fijos; no se anima el desplazamiento UV del asfalto ni del suelo.
- Materiales PBR locales de 2K para asfalto, rocas y terreno, sombras de 2048 px y reflejos de entorno.
- Cactus redondeados con brazos curvos y costillas, generados y exportados desde Blender.
- Huecos abiertos en la superficie mediante máscara, con paredes bajo el asfalto, fondo y fragmentos de grava.
- Cordillera continua y vegetación adicional. Los objetos del escenario se acercan para representar el avance del coche.

### Archivos editables de Blender
`blender/road_rush_desert.blend` y los archivos del coche en `blender/`.
Para regenerar el escenario: `blender --background --python blender/generate_desert_path.py`.
Los materiales de textura y los huecos dinámicos se completan en `src/game/graphics.js`.

### Verificación visual opcional
Con Google Chrome instalado: `npm install --no-save --package-lock=false playwright`, seguido de `node scripts/visual-review.mjs`.
Comprueba orientación después de animar, carretera fija a velocidad 35 m/s y errores del navegador.
La captura y el informe se guardan en `artifacts/`.

## Intro del logo
Al abrir la aplicación aparece una intro de 3,8 segundos antes del menú. Se puede saltar con el botón, Enter o Escape. Respeta la preferencia de movimiento reducido. Código en src/components/Intro.jsx y Intro.css; imagen en public/branding/road-rush-logo.png.


## Menú cinematográfico animado
El menú usa el diseño aprobado con el deportivo turquesa al atardecer, letras que entran por separado y flotan suavemente, brillo en Jugar ahora y tarjetas con entrada escalonada. El fondo permanece fijo. Se adapta a móvil y respeta movimiento reducido. Código: src/components/MainMenu.jsx y MainMenu.css. Fondo generado con la herramienta integrada de imágenes: public/branding/menu-desert.png; prompt en menu-background-prompt.txt.


## Gráficas y vidas actualizadas
Las nueve pestañas del análisis comparten un diseño nuevo: áreas degradadas, series con leyenda interactiva, consulta con cursor/tacto y flechas, escalas legibles y eventos numerados sin etiquetas cortadas. Las áreas parten de cero y las líneas conservan los puntos y escalones de los datos.
Las vidas usan corazones pixelados con caras laterales y brillo, estados llenos/vacíos, partículas al recibir daño y pulso al quedar una vida. Se respeta movimiento reducido.
Código: src/analysis/TelemetryCharts.jsx, charts.css y src/components/VoxelHearts.jsx, VoxelHearts.css.
Verificación opcional: con Playwright instalado, ejecutar node scripts/review-charts.mjs. Comprueba las nueve gráficas y las vidas 3/2/1/0 con una partida simulada; guarda capturas en artifacts.


## Juego publicado
[Jugar Road Rush 3D](https://edwin-santiago.github.io/alamarcelagoso/)

GitHub Actions ejecuta las pruebas, compila y publica automáticamente cada cambio en `main`. La configuración está en `.github/workflows/pages.yml`. Las rutas relativas permiten cargar imágenes, texturas y modelos desde GitHub Pages, sin modificar el diseño ni la jugabilidad.
