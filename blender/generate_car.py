"""Genera en Blender un coche deportivo low-poly con cámaras trasera, frontal y lateral.

Abre este archivo en Blender 5.x y pulsa Run Script. Guarda un .blend y exporta
un GLB en esta misma carpeta. El frontal del coche mira hacia -Y; Z es vertical.
"""
import bpy
import math
import os
from mathutils import Vector


def material(name, color, metallic=0.0, roughness=0.35, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if name == "Cristal polarizado":
        specular = bsdf.inputs.get("Specular IOR Level")
        if specular:
            specular.default_value = 0.18
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.4
    return mat


BODY = material("Carrocería turquesa", (0.025, 0.48, 0.64), 0.48, 0.24)
BODY_LIGHT = material("Bordes azul claro", (0.055, 0.68, 0.82), 0.42, 0.26)
GLASS = material("Cristal polarizado", (0.008, 0.022, 0.032), 0.0, 0.58)
TIRE = material("Caucho", (0.018, 0.022, 0.024), 0.0, 0.82)
RIM = material("Aluminio", (0.48, 0.59, 0.62), 0.82, 0.22)
BLACK = material("Plástico negro", (0.018, 0.023, 0.026), 0.12, 0.4)
RED = material("Luces traseras", (0.8, 0.018, 0.025), 0.24, 0.22, (0.95, 0.012, 0.018))
WHITE = material("Luces delanteras", (0.72, 0.88, 0.96), 0.2, 0.15, (0.35, 0.7, 1.0))
PLATE = material("Placa", (0.88, 0.91, 0.9), 0.1, 0.4)


def bevelled_box(name, location, dimensions, mat, bevel=0.08, segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Aristas suavizadas", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        obj.modifiers.new("Normales de caras", "WEIGHTED_NORMAL")
    return obj


def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name + " Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def cylinder(name, location, radius, depth, mat, vertices=16, axis_x=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    if axis_x:
        obj.rotation_euler[1] = math.pi / 2
    obj.data.materials.append(mat)
    return obj


def text_on_rear(name, body, location, size, mat):
    bpy.ops.object.text_add(location=location, rotation=(-math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.001
    obj.data.materials.append(mat)
    return obj


def wheel(sx, y):
    x = sx * 0.98
    z = 0.48
    tire = cylinder("Neumático", (x, y, z), 0.46, 0.34, TIRE, 24, True)
    tire.modifiers.new("Flanco redondeado", "BEVEL").width = 0.045
    tire.modifiers.new("Normales de rueda", "WEIGHTED_NORMAL")
    face_x = sx * 1.17
    cylinder("Llanta", (sx * 1.0, y, z), 0.31, 0.37, RIM, 20, True)
    cylinder("Centro de llanta", (sx * 1.19, y, z), 0.09, 0.04, BLACK, 16, True)
    for i in range(5):
        a = i * math.tau / 5
        spoke = bevelled_box(
            "Radio de aluminio",
            (face_x, y + math.cos(a) * 0.16, z + math.sin(a) * 0.16),
            (0.055, 0.23, 0.055), RIM, 0.018, 1,
        )
        spoke.rotation_euler[0] = -a
    bpy.ops.mesh.primitive_torus_add(major_radius=0.33, minor_radius=0.025, major_segments=24, minor_segments=6,
                                     location=(face_x, y, z), rotation=(0, math.pi / 2, 0))
    bpy.context.object.name = "Aro exterior de llanta"
    bpy.context.object.data.materials.append(BLACK)
    return tire


def camera(name, location, target, lens=52):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    data.lens = lens
    return obj


# Escena limpia: elimina los objetos iniciales y genera colecciones ordenadas.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
    for item in list(datablocks):
        if item.users == 0:
            datablocks.remove(item)

car_collection = bpy.data.collections.new("COCHE | carrocería y piezas")
bpy.context.scene.collection.children.link(car_collection)
start_objects = set(bpy.context.scene.objects)

# Chasis y paneles forman una silueta angular de coupé deportivo.
bevelled_box("Chasis inferior", (0, 0, 0.53), (1.78, 4.25, 0.54), BLACK, 0.13, 2)
bevelled_box("Carrocería principal", (0, 0, 0.81), (1.98, 4.35, 0.74), BODY, 0.2, 2)
bevelled_box("Capó bajo", (0, -1.42, 1.11), (1.86, 1.25, 0.15), BODY_LIGHT, 0.13, 2)
bevelled_box("Tapa de maletero", (0, 1.56, 1.12), (1.8, 0.95, 0.14), BODY_LIGHT, 0.11, 2)

# Cabina trapezoidal, con ventanas separadas para que el coche se reconozca desde cada ángulo.
cab = [(-0.82, -1.05, 1.05), (0.82, -1.05, 1.05), (0.82, 1.02, 1.05), (-0.82, 1.02, 1.05),
       (-0.62, -0.56, 1.67), (0.62, -0.56, 1.67), (0.62, 0.55, 1.67), (-0.62, 0.55, 1.67)]
mesh_object("Cabina facetada", cab, [(4, 5, 6, 7)], BODY)
bevelled_box("Techo", (0, 0.0, 1.68), (1.24, 1.12, 0.12), BODY_LIGHT, 0.09, 2)
mesh_object("Parabrisas", [(-0.70, -1.10, 1.12), (0.70, -1.10, 1.12), (0.54, -0.53, 1.59), (-0.54, -0.53, 1.59)], [(0, 1, 2, 3)], GLASS)
mesh_object("Luneta trasera", [(-0.70, 1.09, 1.12), (0.70, 1.09, 1.12), (0.54, 0.53, 1.59), (-0.54, 0.53, 1.59)], [(0, 3, 2, 1)], GLASS)
for sx in (-1, 1):
    mesh_object("Ventana lateral", [(sx * 0.835, -0.91, 1.12), (sx * 0.835, 0.85, 1.12),
                                     (sx * 0.638, 0.49, 1.59), (sx * 0.638, -0.52, 1.59)], [(0, 1, 2, 3)], GLASS)
    bevelled_box("Pilar lateral", (sx * 0.85, -0.04, 1.37), (0.055, 0.09, 0.58), BODY_LIGHT, 0.02, 1)
    bevelled_box("Faldón lateral", (sx * 0.94, 0.0, 0.43), (0.16, 2.72, 0.22), BODY_LIGHT, 0.055, 2)
    bevelled_box("Retrovisor", (sx * 1.08, -0.72, 1.12), (0.25, 0.29, 0.14), BODY_LIGHT, 0.055, 2)
    bevelled_box("Base retrovisor", (sx * 0.95, -0.71, 1.04), (0.12, 0.24, 0.06), BLACK, 0.025, 1)
    bevelled_box("Manija", (sx * 1.0, 0.27, 0.94), (0.035, 0.27, 0.065), BLACK, 0.025, 1)

# Cuatro ruedas completas con neumático, llanta y radios metálicos.
for side in (-1, 1):
    wheel(side, -1.42)
    wheel(side, 1.42)

# Frontal: faros, rejilla baja y entradas de aire.
bevelled_box("Parrilla frontal", (0, -2.19, 0.68), (1.14, 0.11, 0.22), BLACK, 0.055, 2)
for sx in (-1, 1):
    bevelled_box("Faro delantero", (sx * 0.64, -2.17, 0.94), (0.42, 0.1, 0.14), WHITE, 0.055, 2)
    bevelled_box("Entrada de aire frontal", (sx * 0.72, -2.16, 0.52), (0.25, 0.09, 0.13), BLACK, 0.035, 1)

# Parte trasera: luneta, franja LED, placa, escape doble y difusor visible desde la cámara del juego.
bevelled_box("Parachoques trasero", (0, 2.18, 0.58), (1.9, 0.22, 0.3), BLACK, 0.08, 2)
bevelled_box("Franja de luces traseras", (0, 2.205, 0.93), (1.58, 0.09, 0.15), RED, 0.065, 2)
for sx in (-1, 1):
    bevelled_box("Luz trasera exterior", (sx * 0.76, 2.17, 0.99), (0.27, 0.12, 0.15), RED, 0.05, 2)
    cylinder("Escape cromado", (sx * 0.43, 2.26, 0.48), 0.115, 0.15, RIM, 16)
bevelled_box("Placa trasera", (0, 2.235, 0.72), (0.57, 0.035, 0.19), PLATE, 0.018, 1)
text_on_rear("Texto de matrícula", "RR-305", (0, 2.258, 0.72), 0.105, BLACK)
bevelled_box("Difusor", (0, 2.20, 0.38), (1.55, 0.12, 0.18), BLACK, 0.04, 1)
for sx in (-0.52, -0.26, 0.0, 0.26, 0.52):
    bevelled_box("Aleta del difusor", (sx, 2.25, 0.31), (0.045, 0.2, 0.2), RIM, 0.012, 1)
bevelled_box("Alerón trasero", (0, 2.13, 1.35), (1.58, 0.28, 0.095), BODY_LIGHT, 0.045, 2)
for sx in (-0.58, 0.58):
    bevelled_box("Soporte de alerón", (sx, 2.02, 1.25), (0.055, 0.07, 0.2), BLACK, 0.015, 1)

# Mueve todo el coche a una colección aparte, dejando cámaras e iluminación independientes.
for obj in set(bpy.context.scene.objects) - start_objects:
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    car_collection.objects.link(obj)

# Tres cámaras nombradas para revisar el frente, la trasera y el perfil en Blender.
rear_cam = camera("Vista trasera 3/4", (6.2, 7.2, 4.1), (0, 0.0, 0.78), 54)
camera("Vista frontal 3/4", (-6.2, -7.2, 4.1), (0, 0.0, 0.78), 54)
camera("Vista lateral", (7.2, 0.0, 3.0), (0, 0.0, 0.75), 58)
bpy.context.scene.camera = rear_cam

world = bpy.data.worlds.new("Estudio gris azulado") if not bpy.data.worlds else bpy.data.worlds[0]
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.22, 0.29, 0.34, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45

def area_light(name, location, energy, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    direction = Vector((0, 0, 0.5)) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj

area_light("Luz principal", (2, -4, 7), 1000, 5, (0.78, 0.9, 1.0))
area_light("Luz de contorno", (-4, 3, 5), 1200, 4, (0.22, 0.72, 1.0))
area_light("Luz trasera", (3, 5, 3), 850, 3, (1.0, 0.32, 0.2))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 850
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.render.filepath = "//road_rush_car_rear.png"

output_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else bpy.path.abspath("//")
if not output_dir:
    output_dir = os.path.expanduser("~/Documents")
blend_path = os.path.join(output_dir, "road_rush_car.blend")
asset_dir = os.path.join(os.path.dirname(output_dir), "public", "models")
os.makedirs(asset_dir, exist_ok=True)
glb_path = os.path.join(asset_dir, "road_rush_car.glb")
scene.render.filepath = os.path.join(output_dir, "road_rush_car_rear.png")
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type == "VIEW_3D":
        area.spaces.active.region_3d.view_perspective = "CAMERA"
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.object.select_all(action="DESELECT")
for obj in car_collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects.get("Carrocería principal")
try:
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True)
except Exception as error:
    print("El archivo Blender se guardó; no se encontró el exportador glTF:", error)
try:
    for camera_obj, filename in ((rear_cam, "road_rush_car_rear.png"),
                                 (bpy.data.objects.get("Vista frontal 3/4"), "road_rush_car_front.png"),
                                 (bpy.data.objects.get("Vista lateral"), "road_rush_car_side.png")):
        scene.camera = camera_obj
        scene.render.filepath = os.path.join(output_dir, filename)
        bpy.ops.render.render(write_still=True)
    scene.camera = rear_cam
except Exception as error:
    print("El archivo Blender se guardó; no se pudo generar la imagen previa:", error)
print("Modelo guardado:", blend_path)
print("Coche exportado:", glb_path)
