# Coche low-poly para Road Rush 3D

`generate_car.py` crea un coupé deportivo low-poly en Blender, con carrocería facetada turquesa, cristales, cuatro ruedas con radios, espejos, faros, luces traseras, matrícula, escapes y difusor.

## Generar el archivo Blender

1. Abre la carpeta del proyecto en Visual Studio Code.
2. Pulsa `Ctrl+Shift+P`, busca **Tasks: Run Task** y elige **Blender: generar coche 3D**.
3. La tarea abre Blender en segundo plano, guarda `road_rush_car.blend` y tres vistas PNG en esta carpeta, y exporta `road_rush_car.glb` a `public/models`.

El archivo contiene las cámaras `Vista trasera 3/4`, `Vista frontal 3/4` y `Vista lateral`. La cámara trasera queda seleccionada al abrir la escena. El juego carga el GLB de Blender y conserva el modelo provisional como respaldo.

## Generar carretera, cactus, faroles y huecos

En VS Code, ejecuta **Blender: generar carretera y utilería 3D** desde **Tasks: Run Task**. `generate_desert_path.py` guarda `road_rush_desert.blend`, una vista previa del tramo y `public/models/desert_environment.glb`. El GLB contiene la malla de carretera y hombros, tres cactus, rocas, farol y hueco; el juego instancia estos modelos al poblar el camino.

El juego conserva modelos provisionales de Three.js mientras carga los archivos Blender, por si el GLB no está disponible.
