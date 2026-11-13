"""Construye el tramo desértico y el kit modular 3D usado por Road Rush 3D."""
import bpy, math, os, random
from mathutils import Vector

random.seed(31)
scene = bpy.context.scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    if collection != scene.collection:
        try: bpy.data.collections.remove(collection)
        except RuntimeError: pass
kit = bpy.data.collections.new("KIT BLENDER PARA EL JUEGO")
scene.collection.children.link(kit)
stage = bpy.data.collections.new("TRAMO DE CARRETERA")
scene.collection.children.link(stage)

def material(name, color, metallic=0, roughness=.8, emission=None):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1)
    m.use_nodes = True; p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic; p.inputs["Roughness"].default_value = roughness
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1); p.inputs["Emission Strength"].default_value = 2.0
    return m

MAT = {
    "sand": material("Arena de desierto", (.52,.33,.17), roughness=.98),
    "sandlight": material("Arena clara", (.69,.49,.27), roughness=.95),
    "road": material("Asfalto oscuro", (.045,.05,.058), .03,.92),
    "shoulder": material("Acotamiento de concreto", (.34,.30,.24), roughness=.95),
    "line": material("Pintura gastada", (.82,.78,.68), roughness=.8),
    "cactus": material("Piel de cactus", (.105,.17,.09), roughness=.9),
    "rib": material("Costillas claras", (.28,.48,.20), roughness=.86),
    "rock": material("Roca volcánica", (.25,.20,.15), roughness=.98),
    "rock2": material("Arista de roca", (.39,.31,.23), roughness=.96),
    "metal": material("Poste grafito", (.055,.075,.083), .72,.3),
    "glow": material("LED cálido", (1,.58,.22), .1,.32,(1,.36,.06)),
    "pit": material("Borde quebrado", (.20,.14,.09), roughness=1),
    "black": material("Profundidad del hueco", (.008,.006,.005), roughness=1),
}

def move_collection(obj, col=kit):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)

def new_root(name, position=(0,0,0)):
    root = bpy.data.objects.new(name, None); kit.objects.link(root)
    root.empty_display_type="CIRCLE"; root.empty_display_size=.18
    root.location=(0,0,0)
    root["preview_position"]=position
    return root

def attach(obj, root):
    move_collection(obj, kit); obj.parent=root; obj.matrix_parent_inverse=root.matrix_world.inverted()
    return obj

def beam(name, a, b, r0, r1, mat, parent=None, sides=10):
    a,b=Vector(a),Vector(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=r0, radius2=r1, depth=d.length, location=(a+b)*.5)
    obj=bpy.context.object; obj.name=name; obj.rotation_euler=d.to_track_quat("Z","Y").to_euler(); obj.data.materials.append(mat)
    return attach(obj,parent) if parent else obj

def cactus(name,height=4.1,arms=True,position=(0,0,0)):
    root=new_root(name,position); radius=height*.073
    def limb(label,controls,r):
        points=[Vector(v) for v in controls]; rings=32; sides=64; verts=[]; faces=[]
        for j in range(rings+1):
            t=j/rings
            c=(1-t)**3*points[0]+3*t*(1-t)**2*points[1]+3*t*t*(1-t)*points[2]+t**3*points[3]
            tangent=3*(1-t)**2*(points[1]-points[0])+6*t*(1-t)*(points[2]-points[1])+3*t*t*(points[3]-points[2])
            q=tangent.to_track_quat("Z","Y")
            cap=math.sqrt(max(.0001,1-max(0,(t-.89)/.11)**2))
            for i in range(sides):
                angle=i/sides*math.tau; rib=1+.105*math.cos(angle*12)
                rr=r*(1-.18*t)*cap*rib
                v=c+q@Vector((math.cos(angle)*rr,math.sin(angle)*rr,0));verts.append(v)
                if j<rings:
                    k=j*sides+i;n=j*sides+(i+1)%sides
                    faces.append((k,n,n+sides,k+sides))
        faces.append(tuple(rings*sides+i for i in range(sides)))
        mesh=bpy.data.meshes.new(label);mesh.from_pydata(verts,[],faces);mesh.materials.append(MAT["cactus"]);mesh.update()
        obj=bpy.data.objects.new(label,mesh);kit.objects.link(obj);attach(obj,root)
        for face in mesh.polygons:face.use_smooth=True
    limb("Tronco con doce costillas",[(0,0,0),(.03,0,height*.3),(-.06,0,height*.8),(0,0,height)],radius)
    if arms:
        for side,level in ((-1,.44),(1,.59)):
            x=side*height*.25;z=height*level
            limb("Brazo curvo y redondeado",[(0,0,z),(x*1.3,0,z-.04),(x,0,z+height*.16),(x,0,z+height*.33)],radius*.64)
    root.location=position
    return root

def rock(name,seed=0,position=(0,0,0)):
    root=new_root(name,position)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4,radius=1,location=(0,0,.48))
    obj=bpy.context.object; obj.name="Roca irregular"
    for v in obj.data.vertices:
        n=math.sin(v.co.x*13+v.co.y*7+v.co.z*11+seed*9)*.12
        v.co.x*=1+n; v.co.y*=.75+n*.5; v.co.z*=.63+n*.4
    obj.data.materials.append(MAT["rock"]); obj.data.materials.append(MAT["rock2"])
    for p in obj.data.polygons: p.use_smooth=True
    obj.scale=(1.2,1,.88); attach(obj,root)
    root.location=position
    return root

def lamp(name,position=(0,0,0)):
    root=new_root(name,position)
    beam("Columna del farol",(0,0,0),(0,0,6.8),.12,.065,MAT["metal"],root,12)
    beam("Brazo inclinado",(0,0,6.5),(.78,0,6.8),.065,.05,MAT["metal"],root,10)
    def box(label,loc,dims,mat,bevel=0):
        bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object;o.name=label;o.dimensions=dims
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
        if bevel:
            b=o.modifiers.new("Bordes suaves","BEVEL");b.width=bevel;b.segments=2
            o.modifiers.new("Normales","WEIGHTED_NORMAL")
        attach(o,root);return o
    box("Carcasa LED",(1.02,0,6.72),(.48,.28,.16),MAT["metal"],.05)
    box("Difusor de luz",(1.02,0,6.62),(.35,.20,.035),MAT["glow"],.025)
    root.location=position
    return root

def pothole(name,position=(0,0,0)):
    root=new_root(name,position); n=40
    rings=((1.48,.018),(1.18,.095),(.94,.07),(.72,.045))
    verts=[]; faces=[]; bands=[]
    for j,(r,z) in enumerate(rings):
        for i in range(n):
            a=i/n*math.tau; w=1+.055*math.sin(a*3+.4)+.03*math.cos(a*7)
            verts.append((math.cos(a)*r*w,math.sin(a)*r*1.72*w,z+.025*math.sin(a*5) if j<2 else z))
    for j in range(len(rings)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+i;d=(j+1)*n+(i+1)%n
            faces.extend(((a,b,c),(b,d,c)));bands.extend(([0,1,2][j],)*2)
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)));bands.append(3)
    mesh=bpy.data.meshes.new("Cuenco irregular");mesh.from_pydata(verts,[],faces)
    for m in (MAT["road"],MAT["pit"],MAT["sandlight"],MAT["black"]):mesh.materials.append(m)
    mesh.update();obj=bpy.data.objects.new("Borde erosionado y pozo",mesh);kit.objects.link(obj)
    for p,k in zip(mesh.polygons,bands):p.material_index=k
    attach(obj,root)
    bpy.ops.mesh.primitive_circle_add(vertices=40,radius=.73,fill_type="NGON",location=(0,0,.05))
    bottom=bpy.context.object;bottom.name="Fondo oscuro visible";bottom.scale.y=1.72;bottom.data.materials.append(MAT["black"]);attach(bottom,root)
    for i in range(9):
        a=i*math.tau/9+.13
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.11+(i%3)*.035,location=(math.cos(a)*1.2,math.sin(a)*2,.06))
        pebble=bpy.context.object;pebble.name="Grava suelta";pebble.scale=(1.3,.72,.42);pebble.data.materials.append(MAT["rock2"] if i%2 else MAT["pit"]);attach(pebble,root)
    root.location=position
    return root

def mesh_object(name,vertices,faces,mat,col):
    mesh=bpy.data.meshes.new(name+" Mesh");mesh.from_pydata(vertices,[],faces);mesh.materials.append(mat);mesh.update()
    obj=bpy.data.objects.new(name,mesh);col.objects.link(obj);return obj

# Malla de asfalto con ligera corona central y UV longitudinal para la textura fija del juego.
road_width,road_length=13.0,700.0
xs=(-6.5,-4.33,-.08,.08,4.33,6.5);rv=[]
for y in (-road_length/2,road_length/2):
    for x in xs:rv.append((x,y,.025+.055*(1-abs(x)/6.5)))
rf=[(i,i+1,len(xs)+i+1,len(xs)+i) for i in range(len(xs)-1)]
road=mesh_object("RoadSurface",rv,rf,MAT["road"],stage)
uv=road.data.uv_layers.new(name="UV carretera")
for poly in road.data.polygons:
    for li in poly.loop_indices:
        vi=road.data.loops[li].vertex_index;uv.data[li].uv=((xs[vi%len(xs)]+6.5)/13,vi//len(xs))

for side in (-1,1):
    xx=(6.5,6.85,7.25);sv=[]
    for y in (-road_length/2,road_length/2):
        for j,x in enumerate(xx):sv.append((side*x,y,.015-j*.025))
    sf=[]
    for i in range(2):sf.append((i,i+1,3+i+1,3+i) if side>0 else (i,3+i,3+i+1,i+1))
    shoulder=mesh_object("RoadShoulderRight" if side>0 else "RoadShoulderLeft",sv,sf,MAT["shoulder"],stage)

# Paisaje de presentación con dunas visibles; el juego continúa deformando sus dunas en tiempo real.
bpy.ops.mesh.primitive_plane_add(size=900,location=(0,0,-.18));ground=bpy.context.object;ground.name="Arena base";ground.data.materials.append(MAT["sand"]);move_collection(ground,stage)
for side in (-1,1):
    nx,ny=34,48;dv=[];df=[]
    for iy in range(ny+1):
        y=-350+iy/ny*700
        for ix in range(nx+1):
            d=ix/nx*420;wave=6+6.5*math.sin(y*.026+d*.012+side)+5*math.sin(y*.009-d*.022)
            fade=min(1,d/35);z=max(0,wave*fade*min(1,d/100))
            dv.append((side*(7.25+d),y,z-.13))
            if ix<nx and iy<ny:
                a=iy*(nx+1)+ix;b=a+1;c=a+nx+1;f=c+1
                df.extend(((a,c,b),(b,c,f)) if side>0 else ((a,b,c),(b,f,c)))
    mesh_object("Dunas onduladas",dv,df,MAT["sand"],stage)

# Elementos del tramo de muestra (también son el kit GLB que instancia el juego).
assets={}
assets["Cactus_Saguaro_A"]=cactus("Cactus_Saguaro_A",4.2,True,(-10,12,0))
assets["Cactus_Saguaro_B"]=cactus("Cactus_Saguaro_B",3.2,True,(12,31,0))
assets["Cactus_Columnar"]=cactus("Cactus_Columnar",5.0,False,(-15,45,0))
assets["Rock_Desert"]=rock("Rock_Desert",.3,(14,8,0))
assets["Rock_Desert_Small"]=rock("Rock_Desert_Small",.8,(-12,28,0))
assets["StreetLight"]=lamp("StreetLight",(10.5,-5,0))
assets["StreetLightFar"]=lamp("StreetLightFar",(-10.5,23,0))
assets["Pothole"]=pothole("Pothole",(-1.8,39,0))
assets["PotholeDemo"]=pothole("PotholeDemo",(2.6,58,0))

# Rayas de muestra en la escena Blender; el juego usa pintura dibujada en su textura fija.
for x in (-road_width/3,road_width/3):
    y=-10
    while y<115:
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,.06));o=bpy.context.object;o.name="Marca discontinua"
        o.dimensions=(.15,4.8,.025);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(MAT["line"]);move_collection(o,stage);y+=13.5

def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
camera_data=bpy.data.cameras.new("Cámara de carretera");camera=bpy.data.objects.new("Cámara de carretera",camera_data);scene.collection.objects.link(camera)
camera.location=(17.5,-32,13);aim(camera,(0,38,.5));camera_data.lens=36;camera_data.clip_end=900;scene.camera=camera
for name,loc,power,size,color in (("Sol desértico",(-24,-10,45),4300,28,(1,.76,.48)),("Relleno",(26,28,25),1800,22,(.55,.73,1))):
    light_data=bpy.data.lights.new(name,"AREA");light_data.energy=power;light_data.shape="DISK";light_data.size=size;light_data.color=color
    light=bpy.data.objects.new(name,light_data);scene.collection.objects.link(light);light.location=loc;aim(light,(0,20,0))
world=bpy.data.worlds.new("Cielo árido") if not bpy.data.worlds else bpy.data.worlds[0]
scene.world=world;world.use_nodes=True;world.node_tree.nodes["Background"].inputs["Color"].default_value=(.32,.46,.58,1);world.node_tree.nodes["Background"].inputs["Strength"].default_value=.55
scene.render.engine="BLENDER_EEVEE";scene.render.resolution_x=1440;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform="AgX";scene.render.image_settings.file_format="PNG"
script_dir=os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else bpy.path.abspath("//")
project_dir=os.path.dirname(script_dir);model_dir=os.path.join(project_dir,"public","models");os.makedirs(model_dir,exist_ok=True)
blend_path=os.path.join(script_dir,"road_rush_desert.blend");glb_path=os.path.join(model_dir,"desert_environment.glb");preview=os.path.join(script_dir,"desert_path_preview.png")
scene.render.filepath=preview
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type=="VIEW_3D":area.spaces.active.region_3d.view_perspective="CAMERA"
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.object.select_all(action="DESELECT");road.select_set(True)
for name in ("RoadShoulderLeft","RoadShoulderRight"):bpy.data.objects[name].select_set(True)
for root in assets.values():
    root.select_set(True)
    for child in root.children_recursive:child.select_set(True)
bpy.context.view_layer.objects.active=road
bpy.ops.export_scene.gltf(filepath=glb_path,export_format="GLB",use_selection=True,export_apply=True)
bpy.ops.render.render(write_still=True)
print("BLEND:",blend_path);print("GLB:",glb_path);print("PREVIEW:",preview)
