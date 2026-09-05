import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, useTexture } from '@react-three/drei';
import { Aperture, Camera, Crosshair, Info, Moon, Sun, Timer } from '@phosphor-icons/react';
import * as THREE from 'three';
import { SCENES, cameraEV, clamp, depthOfField, derive, exposureMultiplier, formatShutter, parseNumber, type CameraConfig, type SceneId, type Shot } from './camera';

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 vUv; uniform sampler2D tColor,tDepth; uniform vec2 resolution;
uniform float nearPlane,farPlane,focal,sensorWidth,focusDistance,aperture,exposure,iso,fullWell,readNoise,pixelPitch,temperature,blades,seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
float viewDepth(vec2 uv){float d=texture2D(tDepth,uv).x;return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
float blurRadius(float z){float f=focal;float s=focusDistance*1000.;float zm=z*1000.;return min(45.,abs(f*f*(zm-s)/(aperture*max(zm,1.)*max(s-f,1.)))/sensorWidth*resolution.x*.5);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){float z=viewDepth(vUv);float radius=blurRadius(z);vec3 color=texture2D(tColor,vUv).rgb;float total=1.;
for(int i=0;i<24;i++){float fi=float(i);float a=fi*2.399963;float r=sqrt((fi+.5)/24.);float polygon=cos(3.141593/blades)/cos(mod(a,6.283185/blades)-3.141593/blades);vec2 off=vec2(cos(a),sin(a))*r*radius*polygon/resolution;vec2 uv=clamp(vUv+off,vec2(.001),vec2(.999));float nz=viewDepth(uv);float w=nz<z*.94 ? .12 : 1.;color+=texture2D(tColor,uv).rgb*w;total+=w;}
color=color/total*exposure;float balance=temperature/5500.;color*=vec3(pow(balance,.28),1.,pow(1./balance,.35));
float electrons=max(30.,fullWell*pow(pixelPitch/6.,2.)*100./iso);vec2 p=vUv*resolution;float u=max(.0001,hash(p));float v=hash(p+vec2(31.7,91.2));float g=sqrt(-2.*log(u))*cos(6.283185*v);
vec3 noise=sqrt(max(color,vec3(0.))/electrons+vec3(pow(readNoise/electrons,2.)));color=max(vec3(0.),color+noise*g);
float vignette=1.-.12*pow(length((vUv-.5)*1.4),2.);color=aces(color*vignette);gl_FragColor=vec4(pow(color,vec3(1./2.2)),1.);}`;
const copyFragment=`varying vec2 vUv;uniform sampler2D map;uniform float weight;void main(){gl_FragColor=vec4(texture2D(map,vUv).rgb,weight);}`;
const shapePoints = [[0,0],[.31,0],[.37,.1],[.38,.33],[.29,.58],[.17,.75],[.16,1.1],[.20,1.12]].map(([r,y])=>new THREE.Vector2(r,y));
function Vase({ position, color = '#d7cbb0', scale = 1 }: { position: [number,number,number]; color?: string; scale?: number }) {
  return <mesh position={position} scale={scale} castShadow receiveShadow><latheGeometry args={[shapePoints,64]}/><meshStandardMaterial color={color} roughness={.32} metalness={.03}/></mesh>;
}
function Plant({ position }: { position: [number,number,number] }) {
  return <group position={position}><Vase position={[0,0,0]} scale={.48} color="#a96b41" />{Array.from({length:9},(_,i)=>{const a=i*2.4;const y=.48+i*.09;return <group key={i} position={[Math.sin(a)*.07,y,Math.cos(a)*.07]} rotation={[.5*Math.sin(a),a,.42*Math.cos(a)]}><mesh castShadow><cylinderGeometry args={[.009,.012,.95,8]}/><meshStandardMaterial color="#4e5f30"/></mesh><mesh position={[.15,.23,0]} rotation={[0,0,-.6]} scale={[.14,.32,.025]} castShadow><sphereGeometry args={[1,12,12]}/><meshStandardMaterial color={i%2?'#4e7140':'#72834a'} roughness={.8}/></mesh></group>;})}</group>;
}
function StillScene() {
  return <group>
    <mesh position={[0,.83,3.4]} receiveShadow castShadow><boxGeometry args={[5,.18,4]}/><meshStandardMaterial color="#b29b75" roughness={.7}/></mesh>
    <mesh position={[0,-.1,0]} receiveShadow rotation={[-Math.PI/2,0,0]}><planeGeometry args={[100,100]}/><meshStandardMaterial color="#738878" roughness={.9}/></mesh>
    <mesh position={[0,3,-1]} receiveShadow><boxGeometry args={[20,7,.2]}/><meshStandardMaterial color="#819385" roughness={.9}/></mesh>
    <Vase position={[-.45,.92,4]} color="#e2d9c0" />
    <Plant position={[1.24,.92,2.1]} />
    {Array.from({length:3},(_,i)=><group key={i} position={[.6,.98+i*.13,3.84]} rotation={[0,.1+i*.08,0]}><mesh castShadow receiveShadow><boxGeometry args={[1.04,.115,.72]}/><meshStandardMaterial color={['#8d4636','#c2b18f','#3f6654'][i]}/></mesh><mesh position={[0,0,.365]}><boxGeometry args={[.98,.07,.015]}/><meshStandardMaterial color="#d7d0b9"/></mesh></group>)}
    <mesh position={[.82,1.53,3.90]} castShadow><sphereGeometry args={[.22,40,32]}/><meshStandardMaterial color="#d98732" roughness={.72}/></mesh>
    <mesh position={[-1.25,1.05,4.27]} castShadow><torusGeometry args={[.23,.067,16,64]}/><meshStandardMaterial color="#be9c59" metalness={.88} roughness={.2}/></mesh>
    <spotLight position={[-4,8,7]} intensity={180} angle={.66} penumbra={.7} castShadow shadow-mapSize={[1024,1024]}/><ambientLight intensity={.36}/>
  </group>;
}
function NightScene() {
  return <group>
    <mesh position={[0,-.08,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[100,100]}/><meshStandardMaterial color="#223033" metalness={.45} roughness={.34}/></mesh>
    <mesh position={[0,.7,2]} castShadow><cylinderGeometry args={[.6,.66,1.4,48]}/><meshStandardMaterial color="#263e3d" metalness={.65} roughness={.31}/></mesh>
    <Vase position={[0,1.4,2]} color="#48806e" scale={.75}/>
    {Array.from({length:21},(_,i)=>{const x=Math.sin(i*8.3)*6,z=-2-(i%7)*2;return <group key={i} position={[x,0,z]}><mesh castShadow position={[0,1.9,0]}><cylinderGeometry args={[.025,.034,3.8,10]}/><meshStandardMaterial color="#28353d" metalness={.65} roughness={.3}/></mesh><mesh position={[0,3.5,0]}><sphereGeometry args={[.09,16,12]}/><meshStandardMaterial color={i%3?'#ffc88f':'#8cbcc5'} emissive={i%3?'#ff9945':'#70b7cf'} emissiveIntensity={5}/></mesh></group>;})}
    <pointLight position={[-2,4,4]} intensity={30} color="#f7c48c"/><pointLight position={[3,3,0]} intensity={20} color="#739fad"/><ambientLight intensity={.2}/>
    <mesh position={[0,4,-18]}><planeGeometry args={[40,12]}/><meshStandardMaterial color="#092532" roughness={1}/></mesh>
  </group>;
}
function MotionScene({ moving }: { moving: MutableRefObject<THREE.Group | null> }) {
  return <group>
    <mesh position={[0,-.04,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[100,100]}/><meshStandardMaterial color="#c1baa2" roughness={.8}/></mesh>
    <mesh position={[0,1.1,-1.5]} receiveShadow><boxGeometry args={[16,2.2,.35]}/><meshStandardMaterial color="#496956" roughness={.8}/></mesh>
    {Array.from({length:13},(_,i)=><mesh key={i} position={[(i-6)*.95,1.1,-1.28]}><boxGeometry args={[.055,2.2,.035]}/><meshStandardMaterial color="#a9b69c"/></mesh>)}
    <group ref={moving} position={[0,.45,0]}>
      <mesh position={[0,.05,0]} castShadow><boxGeometry args={[1.12,.34,.60]}/><meshStandardMaterial color="#ad503d" metalness={.5} roughness={.25}/></mesh>
      <mesh position={[-.12,.32,0]} castShadow><boxGeometry args={[.57,.35,.53]}/><meshStandardMaterial color="#e2b95e" metalness={.4} roughness={.28}/></mesh>
      <mesh position={[-.12,.37,.271]}><planeGeometry args={[.39,.19]}/><meshStandardMaterial color="#4e7880" metalness={.4} roughness={.18}/></mesh>
      {[-.37,.37].flatMap(x=>[-.32,.32].map(z=><mesh key={x+','+z} position={[x,-.14,z]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.19,.19,.12,32]}/><meshStandardMaterial color="#202b28" roughness={.8}/></mesh>))}
    </group>
    <mesh position={[0,1.45,-8]}><boxGeometry args={[20,2.9,1]}/><meshStandardMaterial color="#778475"/></mesh>
    <directionalLight position={[-3,6,7]} intensity={2.8} castShadow shadow-mapSize={[1024,1024]}/><ambientLight intensity={.5}/>
  </group>;
}
function Pipeline({ config, shot, sceneId, moving, captureRef, onHistogram }: { config: CameraConfig; shot: Shot; sceneId: SceneId; moving: MutableRefObject<THREE.Group | null>; captureRef: MutableRefObject<(() => Promise<string>) | null>; onHistogram: (h: number[])=>void }) {
  const { gl,scene,camera,size } = useThree(); const dimensions=derive(config,shot); const histogramClock=useRef(0); const time=useRef(0);
  const targets=useMemo(()=>{
    const source=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});source.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    const acc=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    const histogram=new THREE.WebGLRenderTarget(64,32,{depthBuffer:false});return{source,acc,histogram};
  },[]);
  const pass=useMemo(()=>{
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);const geometry=new THREE.PlaneGeometry(2,2);
    const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,uniforms:{
      tColor:{value:null},tDepth:{value:null},resolution:{value:new THREE.Vector2(1,1)},nearPlane:{value:.05},farPlane:{value:120},
      focal:{value:50},sensorWidth:{value:36},focusDistance:{value:4},aperture:{value:4},exposure:{value:1},iso:{value:400},
      fullWell:{value:45000},readNoise:{value:2.4},pixelPitch:{value:6},temperature:{value:5500},blades:{value:9},seed:{value:1}
    }});
    const blend=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:copyFragment,depthTest:false,depthWrite:false,transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation,uniforms:{map:{value:null},weight:{value:1}}});
    const quad=new THREE.Mesh(geometry,material);quad.frustumCulled=false;scene.add(quad);return{scene,camera,material,blend,quad,geometry};
  },[]);
  useEffect(()=>()=>{Object.values(targets).forEach(t=>t.dispose());pass.material.dispose();pass.blend.dispose();pass.geometry.dispose();captureRef.current=null;},[targets,pass,captureRef]);
  useEffect(()=>{if(camera instanceof THREE.PerspectiveCamera){camera.fov=clamp(dimensions.fov,.1,175);camera.aspect=dimensions.aspect;camera.near=.05;camera.far=120;camera.position.set(0,sceneId==='motion'?1.8:1.65,8);camera.lookAt(0,sceneId==='motion'?.6:1.4,0);camera.updateProjectionMatrix();}},[camera,dimensions.fov,dimensions.aspect,sceneId]);
  const draw=(w:number,h:number,samples:number,seed:number)=>{
    targets.source.setSize(w,h);targets.acc.setSize(w,h);
    const oldAuto=gl.autoClear;gl.autoClear=false;gl.setRenderTarget(targets.acc);gl.setClearColor('#000000',1);gl.clear();
    for(let i=0;i<samples;i++){
      if(moving.current){const t=time.current+(i/Math.max(1,samples-1)-.5)*shot.shutter;moving.current.position.x=Math.sin(t*.8)*1.75;}
      gl.setRenderTarget(targets.source);gl.setClearColor(sceneId==='night'?'#071923':sceneId==='still'?'#7e9387':'#96aba0',1);gl.clear();gl.render(scene,camera);
      pass.quad.material=pass.blend;pass.blend.uniforms.map.value=targets.source.texture;pass.blend.uniforms.weight.value=1/samples;
      gl.setRenderTarget(targets.acc);gl.render(pass.scene,pass.camera);
    }
    const u=pass.material.uniforms;u.tColor.value=targets.acc.texture;u.tDepth.value=targets.source.depthTexture;u.resolution.value.set(w,h);
    u.focal.value=config.lens.focalLength;u.sensorWidth.value=config.sensor.width;u.focusDistance.value=shot.focusDistance;u.aperture.value=shot.aperture;
    u.exposure.value=clamp(exposureMultiplier(shot,SCENES[sceneId].ev),.00000001,100000);u.iso.value=shot.iso;u.fullWell.value=config.auxiliary.fullWell;u.readNoise.value=config.auxiliary.readNoise;u.pixelPitch.value=dimensions.pixelPitch;u.temperature.value=shot.whiteBalance;u.blades.value=config.lens.blades;u.seed.value=seed;
    pass.quad.material=pass.material;gl.setRenderTarget(null);gl.clear();gl.render(pass.scene,pass.camera);gl.autoClear=oldAuto;
  };
  useFrame((state,dt)=>{
    time.current+=dt;const buffer=gl.getDrawingBufferSize(new THREE.Vector2());const samples=sceneId==='motion'?clamp(Math.ceil(shot.shutter*90),1,8):1;
    draw(buffer.x,buffer.y,samples,1);
    histogramClock.current+=dt;
    if(histogramClock.current>.8){histogramClock.current=0;gl.setRenderTarget(targets.histogram);gl.render(pass.scene,pass.camera);const pixels=new Uint8Array(64*32*4);gl.readRenderTargetPixels(targets.histogram,0,0,64,32,pixels);gl.setRenderTarget(null);const bins=new Array(64).fill(0);for(let i=0;i<pixels.length;i+=4)bins[Math.min(63,Math.floor((pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/4))]++;onHistogram(bins);}
  },1);
  useEffect(()=>{captureRef.current=async()=>{
    const ratio=gl.getPixelRatio();const oldSize=gl.getSize(new THREE.Vector2());const aspect=dimensions.aspect;
    const width=aspect>=1?1600:Math.max(1,Math.round(1600*aspect));const height=aspect>=1?Math.max(1,Math.round(1600/aspect)):1600;
    try{gl.setPixelRatio(1);gl.setSize(width,height,false);draw(width,height,sceneId==='motion'?32:1,1);return gl.domElement.toDataURL('image/png');}
    finally{gl.setPixelRatio(ratio);gl.setSize(oldSize.x,oldSize.y,false);}
  };},[config,shot,sceneId,dimensions.aspect,gl,size]);
  return null;
}
function Histogram({ bins }: { bins: number[] }) {
  const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);const max=Math.max(1,...bins);ctx.fillStyle='#a6bea5';bins.forEach((n,i)=>ctx.fillRect(i*3,48-Math.sqrt(n/max)*46,2,Math.sqrt(n/max)*46));},[bins]);
  return <canvas className="histogram" ref={ref} width={192} height={48} aria-label="实时亮度直方图"/>;
}
function Slider({label,value,min,max,onChange,format,log=false}:{label:string;value:number;min:number;max:number;onChange:(n:number)=>void;format:(n:number)=>string;log?:boolean}) {
    const display=(n:number)=>label==='快门'?(n<1?`1/${Number((1/n).toPrecision(6))}`:String(Number(n.toPrecision(6)))):String(Number(n.toPrecision(6)));
    const [text,setText]=useState(display(value)); const [invalid,setInvalid]=useState(false);
    useEffect(()=>{setText(display(value));setInvalid(false);},[value]);
    function commit(){const n=parseNumber(text);if(!Number.isFinite(n)||n<min||n>max){setInvalid(true);return;}onChange(n);setInvalid(false);}
    return <div className="shot-slider"><span>{label}<strong>{format(value)}</strong></span><input type="range" aria-label={label} aria-valuetext={format(value)} min={log?Math.log(min):min} max={log?Math.log(max):max} step="any" value={log?Math.log(value):value} disabled={min===max} onChange={e=>onChange(log?Math.exp(Number(e.target.value)):Number(e.target.value))}/><small><span>{format(min)}</span><span>{format(max)}</span></small><input className="shot-number" aria-label={`${label}精确数值`} aria-invalid={invalid} value={text} inputMode="decimal" onChange={e=>{setText(e.target.value);setInvalid(false);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setText(display(value));setInvalid(false);}}}/>{invalid&&<span className="shot-input-error">请输入 {display(min)}–{display(max)} 范围内的数值</span>}</div>;
  }
export function Simulation({config,shot,setShot,sceneId,setScene,captureRef}:{config:CameraConfig;shot:Shot;setShot:(s:Shot)=>void;sceneId:SceneId;setScene:(s:SceneId)=>void;captureRef:MutableRefObject<(()=>Promise<string>)|null>}) {
  const moving=useRef<THREE.Group|null>(null);const[histogram,setHistogram]=useState<number[]>([]);const[focused,setFocused]=useState(false);
  const d=derive(config,shot);const dof=depthOfField(config,shot);const ev=SCENES[sceneId].ev-cameraEV(shot);
  function focus(e:ThreeEvent<PointerEvent>){e.stopPropagation();const z=-e.camera.worldToLocal(e.point.clone()).z;setShot({...shot,focusDistance:clamp(z,Math.max(.05,config.lens.focalLength/1000+.01),10000)});setFocused(true);setTimeout(()=>setFocused(false),800);}
  return <>
    <aside className="shoot-inspector"><div className="inspector-heading"><p className="eyebrow">拍摄模拟 / M</p><h1>{config.brand} <span>{config.model}</span></h1><p>{config.sensor.width} × {config.sensor.height} mm · {config.lens.focalLength} mm</p></div>
      <div className="shoot-scroll"><h2>选择一个场景</h2><div className="scene-picker">{Object.entries(SCENES).map(([id,scene])=><button key={id} className={sceneId===id?'active':''} onClick={()=>{setScene(id as SceneId);setShot({...shot,focusDistance:Math.max(scene.focus,config.lens.focalLength/1000+.01)});}}>{id==='still'?<Sun size={20}/>:id==='night'?<Moon size={20}/>:<Timer size={20}/>}<span>{scene.name}<small>{scene.subtitle}</small></span></button>)}</div>
      <h2>手动曝光</h2><Slider label="光圈" value={shot.aperture} min={config.lens.apertureMin} max={config.lens.apertureMax} log onChange={aperture=>setShot({...shot,aperture})} format={n=>`f/${n.toFixed(1)}`}/>
      <Slider label="快门" value={shot.shutter} min={config.limits.shutterFast} max={config.limits.shutterSlow} log onChange={shutter=>setShot({...shot,shutter})} format={n=>formatShutter(n)}/>
      <Slider label="ISO" value={shot.iso} min={config.limits.isoMin} max={config.limits.isoMax} log onChange={iso=>setShot({...shot,iso:Math.round(iso)})} format={n=>String(Math.round(n))}/>
      <div className="form-section"><Slider label="对焦距离" value={shot.focusDistance} min={Math.max(.05,config.lens.focalLength/1000+.01)} max={Math.max(100,shot.focusDistance)} log onChange={focusDistance=>setShot({...shot,focusDistance})} format={n=>`${n.toFixed(2)} m`}/><Slider label="白平衡" value={shot.whiteBalance} min={1000} max={40000} onChange={whiteBalance=>setShot({...shot,whiteBalance})} format={n=>`${Math.round(n)} K`}/></div>
      <p className="helper"><Info size={13}/> 参数范围来自你定义的相机。提高 ISO 会增加亮度，也会放大噪声。</p></div>
    </aside>
    <section className="shoot-main"><div className="shoot-toolbar"><span><b/> {SCENES[sceneId].name}</span><span><Crosshair size={16}/> 点击主体对焦</span></div><div className="viewfinder-wrap"><div className={'viewfinder '+(focused?'focused':'')} style={{'--aspect':d.aspect,aspectRatio:d.aspect} as CSSProperties}>
      <Canvas shadows="percentage" dpr={[1,1.25]} camera={{position:[0,1.65,8],fov:d.fov,near:.05,far:120}} gl={{antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance',toneMapping:THREE.NoToneMapping}}>
        <Environment files="/assets/environment/studio_small_09_1k.hdr" environmentIntensity={sceneId==='night'?.08:.38}/><group onPointerDown={focus}>{sceneId==='still'?<StillScene/>:sceneId==='night'?<NightScene/>:<MotionScene moving={moving}/>}</group><Pipeline config={config} shot={shot} sceneId={sceneId} moving={moving} captureRef={captureRef} onHistogram={setHistogram}/>
      </Canvas><div className="viewfinder-overlay"><span className="vf-mode">M</span><span className="vf-format">{config.sensor.megapixels.toFixed(1)} MP</span><Crosshair className="focus-marker" size={40} weight="thin"/><div className="vf-bottom"><span>{formatShutter(shot.shutter)}</span><span>F{shot.aperture.toFixed(1)}</span><span>ISO {Math.round(shot.iso)}</span></div></div></div></div>
      <div className="shoot-readout"><div><small>曝光偏差</small><strong className={Math.abs(ev)>2?'exposure-warning':''}>{ev>0?'+':''}{ev.toFixed(1)} <em>EV</em></strong><span>{ev>1?'画面偏亮':ev<-1?'画面偏暗':'曝光适中'}</span></div><div><small>景深范围</small><strong>{dof.near.toFixed(2)} – {Number.isFinite(dof.far)?dof.far.toFixed(2):'∞'} <em>m</em></strong><span>对焦 {shot.focusDistance.toFixed(2)} m</span></div><div><small>亮度直方图</small><Histogram bins={histogram}/><span>暗部 <b/> 高光</span></div></div>
      <p className="simulation-note">摄影规律模拟 · PNG 长边 1600 px · 不包含界面叠加</p>
    </section>
  </>;
}

