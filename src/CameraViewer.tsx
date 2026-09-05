import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { type Draft, parseNumber } from './camera';
interface Props { draft: Draft; view: string; viewTick: number; autoRotate: boolean; light: number; zoomDelta: { n: number; delta: number } }
function Inscription({ text, position, width, height, color, rotation = [0,0,0] }: { text: string; position: [number,number,number]; width: number; height: number; color: string; rotation?: [number,number,number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!;
    const font = '500 112px "Microsoft YaHei", Arial, sans-serif';ctx.font=font;
    canvas.width=Math.max(64,Math.ceil(ctx.measureText(text).width+24));canvas.height=160;
    ctx.font=font;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,84);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }, [text,color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const ratio=texture.image.width/texture.image.height;const labelWidth=Math.min(width,height*ratio);
  return <mesh position={position} rotation={rotation} renderOrder={2}><planeGeometry args={[labelWidth,labelWidth/ratio]} /><meshStandardMaterial map={texture} transparent roughness={.36} metalness={.55} depthWrite={false} polygonOffset polygonOffsetFactor={-3} /></mesh>;
}
function LensInscription({draft,color}:{draft:Draft;color:string}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
    function arc(text:string,bottom:boolean){
      let size=34;ctx.font=`500 ${size}px "Microsoft YaHei",Arial,sans-serif`;
      while(ctx.measureText(text).width>700&&size>14){size-=2;ctx.font=`500 ${size}px "Microsoft YaHei",Arial,sans-serif`;}
      const chars=Array.from(text),widths=chars.map(c=>ctx.measureText(c).width+3),total=widths.reduce((a,b)=>a+b,0);let offset=-total/2;
      chars.forEach((char,i)=>{const a=(bottom?Math.PI/2:-Math.PI/2)+(bottom?-1:1)*(offset+widths[i]/2)/456;ctx.save();ctx.translate(512+Math.cos(a)*456,512+Math.sin(a)*456);ctx.rotate(a+(bottom?-Math.PI/2:Math.PI/2));ctx.fillText(char,0,0);ctx.restore();offset+=widths[i];});
    }
    arc(`${draft.brand||'CUSTOM'}  ${draft.focalLength||'50'}`,false);
    arc(`${draft.focalLength||'50'}mm  1:${draft.apertureMin||'1.4'}  Ø67`,true);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
  },[draft.brand,draft.focalLength,draft.apertureMin,color]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={[.75,4.37,7.97]} renderOrder={2}><planeGeometry args={[7.3,7.3]}/><meshStandardMaterial map={texture} transparent color="#ffffff" roughness={.5} metalness={.2} depthWrite={false}/></mesh>;
}
function Iris({draft}:{draft:Draft}){
  const count=Math.min(16,Math.max(3,Math.round(parseNumber(draft.blades)||9)));
  const opening=Math.min(2.1,Math.max(.12,(parseNumber(draft.focalLength)||50)/(parseNumber(draft.apertureMin)||1.4)/20));
  const leaves=useMemo(()=>Array.from({length:count},(_,i)=>{
    const a=i*Math.PI*2/count,b=(i+1)*Math.PI*2/count,r=2.68;
    const s=new THREE.Shape();s.moveTo(opening*Math.cos(a),opening*Math.sin(a));
    s.quadraticCurveTo(2.15*Math.cos(a-.2),2.15*Math.sin(a-.2),r*Math.cos(a-.3),r*Math.sin(a-.3));
    s.absarc(0,0,r,a-.3,b-.3,false);
    s.quadraticCurveTo(2.15*Math.cos(b-.2),2.15*Math.sin(b-.2),opening*Math.cos(b),opening*Math.sin(b));
    s.absarc(0,0,opening,b,a,true);s.closePath();return new THREE.ShapeGeometry(s,24);
  }),[count,opening]);
  useEffect(()=>()=>leaves.forEach(g=>g.dispose()),[leaves]);
  return <group position={[.75,4.37,6.92]}>{leaves.map((g,i)=><mesh key={i} geometry={g} position={[0,0,i*.0015]}><meshStandardMaterial color={new THREE.Color().setHSL(.36,.1,.15+(i%3)*.015)} roughness={.38} metalness={.6} side={THREE.DoubleSide}/></mesh>)}</group>;
}
function Model({ draft }: { draft: Draft }) {
  const gltf = useGLTF('/assets/models/camera.glb'); const grain = useTexture('/assets/textures/leather-grain.png');
  const scene = useMemo(() => {
    const root = new THREE.Group();
    const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh) || o.name.startsWith('Lens_Name') || o.name.startsWith('Lens_Filter') || o.name.startsWith('Focal_Marking') || o.name.startsWith('Iris_')) return;
      const m = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.Material;
      const key = m.name === 'Optical_Glass' || o.name.startsWith('Iris_Blade') ? o.name : m.name;
      if (!batches.has(key)) batches.set(key, { material: m.clone(), geometries: [] });
      let geometry=o.geometry.clone();if(geometry.index)geometry=geometry.toNonIndexed();geometry.applyMatrix4(o.matrixWorld);
      for(const attr of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(attr))geometry.deleteAttribute(attr);
      if(!geometry.attributes.normal)geometry.computeVertexNormals();
      if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
      if(m.name==='Grip_Leather'||m.name==='Body_Metal'){
        const p=geometry.attributes.position,n=geometry.attributes.normal;const uv=new Float32Array(p.count*2);
        for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv[i*2]=(z>=x&&z>=y?p.getX(i):x>=y?p.getZ(i):p.getX(i))/14;uv[i*2+1]=(y>z&&y>x?p.getZ(i):p.getY(i))/14;}
        geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      }
      batches.get(key)!.geometries.push(geometry);
    });
    for (const [name, batch] of batches) {
      const geometry = mergeGeometries(batch.geometries, false)!;
      batch.geometries.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geometry, batch.material); mesh.name=name;mesh.castShadow=batch.material.name!=='Optical_Glass';mesh.receiveShadow=true;root.add(mesh);
    }
    return root;
  }, [gltf]);
  const bump = useMemo(() => { const t = grain.clone(); t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);t.anisotropy=8;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;return t; }, [grain]);
  useEffect(() => {
    scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (m.name === 'Body_Metal') { m.color.set(({graphite:'#39403b',forest:'#285143',titanium:'#919b95'})[draft.bodyColor]);m.roughness=.54;m.metalness=.65;m.envMapIntensity=.7;m.bumpMap=bump;m.bumpScale=.006; }
        if (m.name === 'Grip_Leather') { m.color.set(({graphite:'#414a40',forest:'#24573e',titanium:'#484f48'})[draft.bodyColor]);m.normalMap=null;m.map=draft.material==='leather'?bump:null;m.bumpMap = draft.material==='leather' ? bump : null;m.bumpScale=.16;m.roughness=draft.material==='leather'?.53:.92;m.envMapIntensity=.65; }
        if (m.name === 'Optical_Glass' && m instanceof THREE.MeshPhysicalMaterial) { m.color.set('#c2cfc7'); m.transmission=.98; m.ior=1.48; m.roughness=.025; m.thickness=.1; m.iridescence=.22; m.iridescenceIOR=1.35; m.iridescenceThicknessRange=[160,420]; m.envMapIntensity=.45; m.side=THREE.DoubleSide; }
        m.needsUpdate=true;
      }
      if (o.name.startsWith('Lens_Name') || o.name.startsWith('Focal_Marking')) o.visible=false;
    });
  }, [scene,draft.bodyColor,draft.material,bump]);
  useEffect(() => () => { scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});bump.dispose(); }, [scene,bump]);
  const color = draft.inscription==='gold' ? '#d1ba86' : '#b5bcb1';
  return <group><primitive object={scene} />
    <Iris draft={draft}/>
    <Inscription text={draft.brand} position={[.18,9.23,2.38]} rotation={[-.286,0,0]} width={2.7} height={.67} color={color} />
    <Inscription text={draft.model} position={[5.22,6.96,2.65]} width={1.65} height={.43} color={color} />
    <LensInscription draft={draft} color={color}/>
  </group>;
}
function Controls({ view, viewTick, autoRotate, zoomDelta }: Omit<Props,'draft'|'light'>) {
  const controls = useRef<OrbitControlsType>(null); const { camera } = useThree();
  const target = useRef(new THREE.Vector3(-10,14,29)); const moving=useRef(true);
  useEffect(() => {
    const positions: Record<string,[number,number,number]>={hero:[-10,14,29],front:[.6,5.5,29],back:[-12,10,-28],top:[.6,34,2]};
    target.current.set(...(positions[view]||positions.hero)); moving.current=true;
  }, [view,viewTick]);
  useEffect(()=>{ if(!zoomDelta.n || !controls.current)return; const center=controls.current.target;camera.position.sub(center).multiplyScalar(zoomDelta.delta>0?.86:1.16).add(center);controls.current.update();moving.current=false; },[zoomDelta,camera]);
  useFrame((_,dt)=>{if(moving.current){camera.position.lerp(target.current,1-Math.exp(-dt*7));controls.current?.target.set(0,4.9,1.1);controls.current?.update();if(camera.position.distanceTo(target.current)<.025)moving.current=false;}});
  return <OrbitControls ref={controls} makeDefault target={[0,4.9,1.1]} enablePan={false} minDistance={18} maxDistance={48} minPolarAngle={.025} maxPolarAngle={Math.PI*.52} autoRotate={autoRotate} autoRotateSpeed={.55} enableDamping dampingFactor={.085} onStart={()=>{moving.current=false;}} />;
}
function PerformanceProbe() {
  const elapsed=useRef(0),frames=useRef(0),reported=useRef(false);
  useFrame((state,dt)=>{if(reported.current)return;elapsed.current+=dt;frames.current++;if(elapsed.current>12){console.info(`CameraSimulator renderer sample: ${Math.round(frames.current/elapsed.current)} FPS; ${state.gl.info.render.calls} draw calls`);reported.current=true;}});return null;
}
export function CameraViewer(props: Props) {
  return <Canvas shadows="variance" dpr={[1,1.6]} camera={{ position:[-10,14,29],fov:30,near:.1,far:200 }} gl={{ antialias:true,alpha:true,powerPreference:'high-performance' }}>
    <color attach="background" args={['#0b211a']} />
    <ambientLight intensity={.25} /><Environment files="/assets/environment/studio_small_09_1k.hdr" environmentIntensity={[.7,1.05,.4][props.light]} environmentRotation={[0,.7,0]} />
    <directionalLight position={[-10,15,10]} intensity={2.2} color="#e8eadb" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} shadow-camera-far={65} shadow-normalBias={.025} shadow-radius={5} shadow-blurSamples={12}/>
    <spotLight position={[-12,22,15]} angle={.6} penumbra={1} intensity={110} castShadow shadow-mapSize={[2048,2048]} shadow-bias={-.001} />
    <pointLight position={[12,13,-9]} intensity={props.light===2?280:100} color="#dbe9d4" />
    <Model draft={props.draft} />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} receiveShadow><planeGeometry args={[200,200]} /><meshStandardMaterial color="#0b2116" roughness={.86} metalness={0} envMapIntensity={.17} /></mesh>
    <fog attach="fog" args={['#0b211a',42,100]} /><Controls view={props.view} viewTick={props.viewTick} autoRotate={props.autoRotate} zoomDelta={props.zoomDelta} />{import.meta.env.DEV&&<PerformanceProbe />}
  </Canvas>;
}



