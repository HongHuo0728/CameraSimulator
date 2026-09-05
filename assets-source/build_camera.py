"""Original CameraSimulator body. Run with Blender --background --python this_file.
Dimensions use centimetres, +Z up, -Y lens front. All geometry is authored here.
"""
import bpy, math, os, json
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'models')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)

def mat(name, color, metallic=0, rough=.4):
    m=bpy.data.materials.new(name); m.use_nodes=True
    m.node_tree.nodes.clear()
    p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');p.name='Principled BSDF'
    output=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(p.outputs['BSDF'],output.inputs['Surface'])
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=rough
    return m
metal=mat('Body_Metal',(.055,.064,.062),.78,.32)
edge=mat('Machined_Edges',(.09,.105,.10),.85,.28)
black=mat('Lens_Anodized',(.018,.022,.021),.7,.29)
rubber=mat('Soft_Rubber',(.009,.013,.012),.03,.64)
silver=mat('Polished_Chrome',(.38,.42,.40),.93,.22)
ink=mat('Warm_Engraving',(.55,.59,.53),.25,.45)
gold=mat('Accent_Champagne',(.34,.25,.13),.85,.3)
red=mat('Red_Record_Dot',(.27,.012,.011),.22,.38)
screen=mat('Display_Glass',(.007,.025,.022),.35,.18)
leather=mat('Grip_Leather',(.035,.039,.036),.02,.74)
grain_path=os.path.join(ROOT,'public','assets','textures','leather-grain.png')
if os.path.isfile(grain_path):
    nodes=leather.node_tree.nodes; links=leather.node_tree.links
    tex=nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(grain_path); tex.image.colorspace_settings.name='Non-Color'
    coord=nodes.new('ShaderNodeTexCoord'); mapping=nodes.new('ShaderNodeVectorMath'); mapping.operation='SCALE'; mapping.inputs[3].default_value=3.0
    links.new(coord.outputs['UV'],mapping.inputs[0]); links.new(mapping.outputs[0],tex.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.36; bump.inputs['Distance'].default_value=.025
    links.new(tex.outputs['Color'],bump.inputs['Height']); links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])

def finish(o,name,m,smooth=True):
    o.name=name
    if m:o.data.materials.append(m)
    if smooth and o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o
def bevel(o,width=.08,segments=3):
    mod=o.modifiers.new('Precision edge radii','BEVEL'); mod.width=width; mod.segments=segments
    mod=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    return o
def box(name,loc,size,m,rad=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m);bevel(o,rad,4);return o
def cylinder(name,loc,r,depth,m,axis='Y',verts=96,rad=.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='Y':o.rotation_euler[0]=math.pi/2
    if axis=='X':o.rotation_euler[1]=math.pi/2
    finish(o,name,m);bevel(o,rad,3);return o
def ring(name,loc,outer,inner,depth,m,verts=128):
    x,y,z=loc; vs=[];fs=[]
    for yy,rr in [(y-depth/2,outer),(y+depth/2,outer),(y-depth/2,inner),(y+depth/2,inner)]:
        for i in range(verts):
            a=i/verts*math.tau;vs.append((x+rr*math.cos(a),yy,z+rr*math.sin(a)))
    for i in range(verts):
        j=(i+1)%verts
        for a,b in [(0,1),(2,0),(1,3),(3,2)]:fs.append((a*verts+i,a*verts+j,b*verts+j,b*verts+i))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    finish(o,name,m);bevel(o,.018,2);return o
def text(name,value,loc,size,m,rotation=(math.pi/2,0,0),align='CENTER'):
    curve=bpy.data.curves.new(name,'FONT');curve.body=value;curve.align_x=align;curve.size=size;curve.extrude=.0015;curve.bevel_depth=.001
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rotation;curve.materials.append(m);return o
def screw(name,x,y,z,axis='Y',r=.10):
    o=cylinder(name,(x,y,z),r,.035,black,axis,32,.008)
    sl=box(name+'_slot',(x,y-.026,z),(.12,.012,.024),silver,.004)
    if axis=='Z':sl.location=(x,y,z+.025);sl.rotation_euler[0]=math.pi/2
def knurl(name,x,y,z,r,h,axis='Z',count=64):
    cylinder(name,(x,y,z),r,h,black,axis,96)
    for i in range(count):
        a=i*math.tau/count
        if axis=='Z':
            o=box(name+'_tooth',(x+math.cos(a)*r,y+math.sin(a)*r,z),(.047,.09,h*.79),edge,.012);o.rotation_euler[2]=a
        else:
            o=box(name+'_tooth',(x+math.cos(a)*r,y,z+math.sin(a)*r),(.055,h*.9,.075),rubber,.015);o.rotation_euler[1]=-a

# Die-cast main chassis, separate top and bottom plates, recessed seams.
box('Chassis',(0,0,4.20),(14.05,5.05,7.95),metal,.58)
box('Top_Plate',(0,.05,8.12),(14.2,5.15,.8),metal,.33)
box('Top_Gasket',(0,.06,7.68),(14.12,5.1,.09),rubber,.03)
box('Bottom_Plate',(0,.05,.39),(14.0,5.0,.52),black,.22)
box('Bottom_Gasket',(0,.05,.7),(14.0,5.0,.07),rubber,.025)
box('Front_Leather_Panel',(.1,-2.50,3.75),(13.5,.24,5.85),leather,.28)
box('Right_Side_Leather',(6.99,.05,4),(0.22,4.6,5.5),leather,.11)

# Organic ergonomic grip: cross sections control its contour rather than a plain box.
profiles=[(.72,1.36,1.75,-5.23,-1.22),(1.05,1.60,2.03,-5.3,-1.36),(2.0,1.73,2.17,-5.33,-1.34),(4.5,1.78,2.10,-5.35,-1.39),(6.2,1.68,1.92,-5.34,-1.28),(7.2,1.51,1.72,-5.24,-1.13),(7.55,1.41,1.6,-5.22,-.95)]
vs=[];fs=[];steps=48
for zz,rx,ry,cx,cy in profiles:
    for i in range(steps):
        a=i/steps*math.tau
        # Superellipse creates broad flat gripping faces and soft corner transitions.
        ca,sa=math.cos(a),math.sin(a);n=3.4
        vs.append((cx+rx*math.copysign(abs(ca)**(2/n),ca),cy+ry*math.copysign(abs(sa)**(2/n),sa),zz))
for j in range(len(profiles)-1):
    for i in range(steps):fs.append((j*steps+i,j*steps+(i+1)%steps,(j+1)*steps+(i+1)%steps,(j+1)*steps+i))
fs+=[tuple(reversed(range(steps))),tuple((len(profiles)-1)*steps+i for i in range(steps))]
mesh=bpy.data.meshes.new('SculptedGrip');mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new('Sculpted_Grip',mesh);bpy.context.collection.objects.link(o);finish(o,'Sculpted_Grip',leather)
sub=o.modifiers.new('Soft grip contour','SUBSURF');sub.levels=2
bpy.context.view_layer.objects.active=o;o.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.04);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
box('Grip_Crown',(-5.17,-1.10,7.69),(3.65,4.23,.78),metal,.52)
box('Grip_Accent',(-5.40,-3.24,7.4),(2.36,.095,.1),gold,.035)

# Viewfinder housing: tapered front prism with inclined sides and chamfered roof.
verts=[(-2.72,-2.54,8.2),(3.15,-2.54,8.2),(2.35,-1.85,10.58),(-1.88,-1.85,10.58),(-2.42,2.08,8.2),(2.85,2.08,8.2),(2.17,1.66,10.35),(-1.65,1.66,10.35)]
faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
mesh=bpy.data.meshes.new('PrismShell');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Viewfinder_Housing',mesh);bpy.context.collection.objects.link(o);finish(o,'Viewfinder_Housing',metal);bevel(o,.15,4)
box('Hotshoe_Base',(.1,.0,10.62),(2.2,2.65,.14),black,.07)
for xx in [-.95,1.15]:box('Hotshoe_Rail',(xx,.12,10.77),(.17,2.43,.20),silver,.035)
box('Hotshoe_Insert',(.1,.22,10.72),(1.63,1.86,.12),black,.04)
for i in range(5):cylinder('Hotshoe_Contact',(-.5+i*.3,-.8,10.8),.055,.03,gold,'Z',24)

# Precisely machined top controls, groove ribs and engraved mode marks.
for name,x,y,z,r,h in [('Mode_Dial',-3.5,.65,8.85,1.0,.48),('Exposure_Dial',4.9,.15,8.82,.93,.55),('Drive_Dial',-5.82,1.17,8.56,.64,.35)]:
    cylinder(name+'_under',(x,y,z-h*.45),r*1.05,.13,edge,'Z');knurl(name,x,y,z,r,h,count=64)
    cylinder(name+'_face',(x,y,z+h/2+.018),r*.93,.045,black,'Z')
    labels=['M','A','S','P','1','2'] if name=='Mode_Dial' else ['0','1','2','3','-1','-2']
    for i,label in enumerate(labels):
        a=i/len(labels)*math.tau;text(name+'_mark',label,(x+math.sin(a)*r*.63,y+math.cos(a)*r*.63,z+h/2+.05),.22,ink,rotation=(0,0,-a))
cylinder('Shutter_Ring',(-5.12,-2.30,8.12),.70,.16,silver,'Z')
cylinder('Shutter_Button',(-5.12,-2.30,8.28),.56,.22,black,'Z')
cylinder('Shutter_Center',(-5.12,-2.30,8.405),.42,.04,metal,'Z')
cylinder('Record_Button',(-3.73,-1.95,8.64),.23,.08,black,'Z');cylinder('Record_Red',(-3.73,-1.95,8.685),.105,.018,red,'Z')
box('Power_Lever',(-4.42,-2.18,8.15),(.55,.19,.12),black,.06)
knurl('Front_Command',-5.20,-3.05,6.75,.68,.28,'Z',56)

# Lens mount and barrel. Hollow rings maintain visible depth through front optics.
cx,cz=.75,4.37
ring('Lens_Mount',(cx,-2.74,cz),3.21,2.63,.32,silver)
ring('Mount_Gasket',(cx,-2.98,cz),3.3,2.67,.12,rubber)
ring('Lens_Rear_Barrel',(cx,-3.53,cz),3.24,2.72,1.02,black)
ring('Aperture_Ring',(cx,-4.24,cz),3.36,2.75,.43,edge)
for i in range(90):
    a=i/90*math.tau;o=box('Aperture_Rib',(cx+3.36*math.cos(a),-4.24,cz+3.36*math.sin(a)),(.048,.30,.045),black,.009);o.rotation_euler[1]=-a
ring('Lens_Barrel_Middle',(cx,-5.02,cz),3.52,2.77,1.08,black)
ring('Focus_Grip',(cx,-6.14,cz),3.71,2.80,1.25,rubber)
for i in range(144):
    a=i/144*math.tau;o=box('Focus_Rib',(cx+3.712*math.cos(a),-6.14,cz+3.712*math.sin(a)),(.048,1.10,.065),black,.013);o.rotation_euler[1]=-a
ring('Lens_Front_Barrel',(cx,-7.22,cz),3.64,2.81,.83,black)
ring('Front_Rim',(cx,-7.72,cz),3.68,3.13,.18,edge)
ring('Front_Name_Ring',(cx,-7.84,cz),3.60,2.94,.1,black)
for i in range(7):ring('Filter_Thread',(cx,-7.73+i*.07,cz),2.98-i*.012,2.915-i*.012,.03,edge)
for i in range(4):ring('Internal_Baffle',(cx,-7.12+i*.49,cz),2.95-i*.23,2.72-i*.23,.18,black)

# Curved, thin optical elements with physically transmissive surfaces.
glass=mat('Optical_Glass',(.37,.62,.55),0,.055)
p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.46
p.inputs['Coat Weight'].default_value=.36;p.inputs['Coat Roughness'].default_value=.04
def lens_element(name,yy,radius,curvature):
    vertices=[(cx,yy-curvature,cz)]; faces=[];rings=14;segments=128
    for j in range(1,rings+1):
        r=radius*j/rings;y=yy-curvature*math.sqrt(max(0,1-(r/radius)**2))
        for i in range(segments):a=i/segments*math.tau;vertices.append((cx+r*math.cos(a),y,cz+r*math.sin(a)))
    for i in range(segments):faces.append((0,1+i,1+(i+1)%segments))
    for j in range(rings-1):
        for i in range(segments):a=1+j*segments+i;b=1+j*segments+(i+1)%segments;faces.append((a,a+segments,b+segments,b))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);finish(ob,name,glass)
    sol=ob.modifiers.new('Optical thickness','SOLIDIFY');sol.thickness=.035
lens_element('Front_Optical_Element',-7.32,2.87,.19)
lens_element('Inner_Optical_Element',-6.18,2.40,.21)
ring('Iris_Housing',(cx,-5.48,cz),2.32,.98,.12,black)
# Nine overlapping metal iris leaves surrounding a true open aperture.
iris=mat('Iris_Blades',(.065,.085,.077),.7,.31)
for i in range(9):
    a=i/9*math.tau;coords=[]
    for r,t in [(1.00,0),(1.05,.50),(2.31,.68),(2.31,.1),(1.68,-.23)]:coords.append((cx+r*math.cos(a+t),-5.57-i*.002,cz+r*math.sin(a+t)))
    mesh=bpy.data.meshes.new('IrisBlade');mesh.from_pydata(coords,[],[(0,1,2,3,4)]);mesh.update();ob=bpy.data.objects.new('Iris_Blade_'+str(i),mesh);bpy.context.collection.objects.link(ob);finish(ob,ob.name,iris,False)
cylinder('Lens_Dark_Interior',(cx,-4.91,cz),1.13,.07,rubber)
text('Lens_Name','A U R A   5 0 m m   1 : 1 . 4',(cx,-7.912,cz+3.25),.17,ink)
text('Lens_Filter','\u00d8 67',(cx,-7.913,cz-3.34),.17,ink)
text('Focal_Marking','50',(cx+2.94,-5.1,cz+1.54),.22,ink)

# Front accessories and strap loops.
cylinder('Release_Button',(4.38,-2.72,3.37),.30,.14,metal)
cylinder('AF_Lamp',(-3.11,-2.71,7.08),.15,.09,screen)
for xx in [-7.19,7.18]:
    box('Strap_Base',(xx,.13,7.18),(.28,.57,.78),edge,.08)
    bpy.ops.mesh.primitive_torus_add(major_radius=.33,minor_radius=.065,major_segments=40,minor_segments=10,location=(xx*1.035,.11,7.2),rotation=(0,math.pi/2,0));finish(bpy.context.object,'Strap_Eyelet',silver)
for xx,zz in [(-6.68,.93),(6.62,.93),(6.65,7.36),(-3.12,7.33)]:screw('Front_Screw',xx,-2.655,zz)

# Back: articulating display frame, eyecup and actual control geometry.
box('LCD_Hinge',(-5.3,2.69,3.99),(.42,.44,5.83),black,.12)
box('LCD_Frame',(-.88,2.81,3.99),(9.05,.65,5.84),black,.25)
box('LCD_Bezel',(-.88,3.155,3.99),(8.56,.08,5.28),rubber,.15)
box('LCD_Glass',(-.88,3.214,4.05),(8.09,.035,4.65),screen,.095)
text('Rear_Label','C A M E R A S I M U L A T O R',(-.85,3.249,1.34),.17,ink,rotation=(math.pi/2,0,math.pi))
box('EVF_Eyecup',(.06,2.4,8.80),(3.30,1.12,2.07),rubber,.37)
box('EVF_Frame',(.06,3.0,8.85),(2.55,.19,1.38),black,.19)
box('EVF_Glass',(.06,3.115,8.86),(1.96,.04,.96),screen,.10)
for name,xx,zz,label in [('Menu',-5.75,7.7,'MENU'),('Playback',-4.25,7.7,'>'),('AF',4.54,7.72,'AF-ON'),('Q',5.78,6.50,'Q'),('Delete',5.76,1.16,'DEL')]:
    cylinder(name,(xx,2.70,zz),.29,.20,black);text(name+'_text',label,(xx,2.83,zz-.05),.12,ink,rotation=(math.pi/2,0,math.pi))
knurl('Rear_Control_Wheel',5.17,2.86,3.92,1.12,.27,'Y',64)
cylinder('Rear_OK_Button',(5.17,3.06,3.92),.50,.17,metal);text('Rear_OK','OK',(5.17,3.165,3.85),.19,ink,rotation=(math.pi/2,0,math.pi))
for xx in [-2.7,-2.4,-2.1]:box('Speaker_Slot',(xx,2.6,8.24),(.075,.10,.41),black,.03)
box('Thumb_Rest',(6.17,2.70,6.67),(1.34,.48,1.40),rubber,.34)
box('Battery_Door',(-4.77,.10,.096),(3.89,3.50,.07),black,.18)
cylinder('Tripod_Thread',(.75,0,.08),.25,.10,black,'Z',48)
for xx in [-6,5.9]:screw('Base_Screw',xx,1.4,.05,'Z')

# Metadata locates dynamic user inscriptions in the runtime coordinate system.
anchors={
 'brand':{'position':[.19,9.22,2.38],'rotation':[-.286,0,0],'width':3.78,'height':.64},
 'model':{'position':[5.28,7.0,2.65],'rotation':[0,0,0],'width':2.5,'height':.50},
 'lens':{'position':[.75,7.65,7.92],'rotation':[0,0,0],'width':3.9,'height':.22},
}
with open(os.path.join(OUT,'anchors.json'),'w',encoding='utf8') as f:json.dump(anchors,f)

# Save editable source and export camera only. Apply modelling modifiers to export.
bpy.ops.object.select_all(action='DESELECT')
for ob in list(bpy.context.scene.objects):
    ob.select_set(True)
    if ob.type=='FONT':
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
    ob.select_set(False)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets-source','CameraSimulator.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'camera.glb'),export_format='GLB',export_apply=True,export_materials='EXPORT',export_yup=True,export_extras=True)
print('CAMERA_MODEL_READY',os.path.join(OUT,'camera.glb'))

# Authoring preview, physically rendered by Blender, independent of app viewport.
floor=mat('Studio_Floor',(.016,.035,.027),.15,.37)
box('Studio_Ground',(0,0,-.23),(200,200,.4),floor,.06)
world=bpy.data.worlds.new('Studio World');bpy.context.scene.world=world;world.use_nodes=True
world.node_tree.nodes.clear();bg=world.node_tree.nodes.new('ShaderNodeBackground');bg.name='Background';wo=world.node_tree.nodes.new('ShaderNodeOutputWorld');world.node_tree.links.new(bg.outputs[0],wo.inputs['Surface'])
env=world.node_tree.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(os.path.join(ROOT,'public','assets','environment','studio_small_09_1k.hdr'))
world.node_tree.links.new(env.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color']);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
for loc,power,size in [((-9,-12,17),1800,10),((10,2,15),2300,8),((3,-15,7),600,6)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,4))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(-16,-27,16));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-1.7,4.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=23.6
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=920;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.filepath=os.path.join(ROOT,'design','model-authoring-preview.png')
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for device in prefs.devices:device.use=device.type!='CPU'
    scene.cycles.device='GPU'
except Exception:pass
bpy.ops.render.render(write_still=True)
