import { assetUrl } from '../assetUrl.js';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const textureLoads=[];
function pbr(asset) {
  const maps={};
  for(const [key,channel] of [['map','diff'],['normalMap','nor_gl'],['roughnessMap','rough']]){
    let done;textureLoads.push(new Promise(resolve=>{done=resolve;}));
    const tex=new THREE.TextureLoader().load(assetUrl(`textures/${asset}_${channel}_2k.jpg`),done,undefined,done);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=16;
    tex.colorSpace=key==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;maps[key]=tex;
  }
  maps.normalScale=new THREE.Vector2(.55,.55);return maps;
}

const hash = (x, y, s=0) => { const n=Math.sin(x*127.1+y*311.7+s*91.7)*43758.5453; return n-Math.floor(n); };
function noise(x,y,s=0) {
  const ix=Math.floor(x), iy=Math.floor(y); let u=x-ix,v=y-iy;
  u=u*u*(3-2*u); v=v*v*(3-2*v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy,s),hash(ix+1,iy,s),u),THREE.MathUtils.lerp(hash(ix,iy+1,s),hash(ix+1,iy+1,s),u),v);
}

export function surface(kind, size=1024) {
  if(kind==='sand')return pbr('rock_ground');
  if(kind==='stone')return pbr('rock_boulder_dry');
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d'), pixels=ctx.createImageData(size,size);
  const palette=kind==='stone'?[105,102,91]:kind==='sand'?[133,122,102]:[65,65,62];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const broad=noise(x/150,y/150,2), medium=noise(x/25,y/25,5), grain=hash(x,y,7);
    const value=(broad-.5)*(kind==='asphalt'?5:18)+(medium-.5)*(kind==='asphalt'?5:16)+(grain-.5)*(kind==='asphalt'?26:32);
    const mineral=kind==='stone'&&noise(x/5,y/5,12)>.72?36:0;
    const i=(y*size+x)*4;
    for(let k=0;k<3;k++) pixels.data[i+k]=palette[k]+value+mineral;
    pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=16;
  const bump=tex.clone(); bump.colorSpace=THREE.NoColorSpace; bump.needsUpdate=true;
  return {map:tex,bumpMap:bump};
}

export function roadSurface() {
  const maps=surface('asphalt',2048), c=maps.map.image, ctx=c.getContext('2d'), s=c.width;
  // Pintura estrecha y desgastada; escala de árido fina, sin puntos blancos gigantes.
  ctx.fillStyle='#c6c3ac'; ctx.fillRect(s*.027,0,s*.009,s); ctx.fillRect(s*.964,0,s*.009,s);
  ctx.fillRect(s*.497,0,s*.006,s*.34);
  for(let i=0;i<18000;i++){const x=hash(i,1)*s,y=hash(i,2)*s;ctx.fillStyle='rgba(55,57,58,.22)';ctx.fillRect(x,y,1+hash(i,3)*3,1);}
  maps.map.needsUpdate=true;
  const scanned=pbr('asphalt_02');
  maps.normalMap=scanned.normalMap;maps.roughnessMap=scanned.roughnessMap;maps.normalScale=new THREE.Vector2(.35,.35);
  maps.normalMap.repeat.set(4,700/3);maps.roughnessMap.repeat.set(4,700/3);
  textureLoads.push(new Promise(resolve=>{
    const img=new Image();img.onload=()=>{
      for(let y=0;y<4;y++)for(let x=0;x<4;x++)ctx.drawImage(img,x*s/4,y*s/4,s/4,s/4);
      ctx.fillStyle='rgba(210,207,185,.85)';ctx.fillRect(s*.027,0,s*.009,s);ctx.fillRect(s*.964,0,s*.009,s);ctx.fillRect(s*.497,0,s*.006,s*.34);
      maps.map.needsUpdate=true;resolve();
    };img.onerror=resolve;img.src=assetUrl('textures/asphalt_02_diff_2k.jpg');
  }));
  delete maps.bumpMap;
  return maps;
}

let rockMaterial;
const rockGeometries=[];
export function rock(radius,seed) {
  if(!rockMaterial) rockMaterial=new THREE.MeshStandardMaterial({...surface('stone'),roughness:.94,bumpScale:.12,metalness:0});
  const variant=Math.floor(seed*6)%6;
  if(!rockGeometries[variant]) {
    let geo=new THREE.IcosahedronGeometry(1,8); const p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const k=1+.14*Math.sin(x*3+variant)*Math.cos(z*4+y*3)+.065*Math.sin(y*12+x*8)*Math.cos(z*11)+.018*Math.sin(x*39+y*27+z*31);
      p.setXYZ(i,x*k,Math.max(-.61,y*k*.75),z*k*.88);
    }
    geo=mergeVertices(geo); geo.computeVertexNormals(); rockGeometries[variant]=geo;
  }
  const mesh=new THREE.Mesh(rockGeometries[variant],rockMaterial);
  mesh.scale.setScalar(radius); mesh.position.y=radius*.61; mesh.rotation.y=seed*Math.PI*2;
  mesh.castShadow=mesh.receiveShadow=true; return mesh;
}

export const holes={values:{value:Array.from({length:32},()=>new THREE.Vector4(0,10000,1,1))},seeds:{value:new Float32Array(32)},count:{value:0}};
export function cutRoad(material) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.uHoles=holes.values; shader.uniforms.uHoleSeeds=holes.seeds; shader.uniforms.uHoleCount=holes.count;
    shader.vertexShader='varying vec3 vRoadWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadWorld=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader='varying vec3 vRoadWorld; uniform vec4 uHoles[32]; uniform float uHoleSeeds[32]; uniform int uHoleCount;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      for(int h=0;h<32;h++){if(h>=uHoleCount)break;vec2 p=(vRoadWorld.xz-uHoles[h].xy)/uHoles[h].zw;
      float a=atan(p.y,p.x);float r=1.0+.075*sin(a*3.0+uHoleSeeds[h]*6.0)+.035*cos(a*7.0);
      if(length(p)<r)discard;}`);
  };
  material.customProgramCacheKey=()=> 'road-open-pits-v1'; material.needsUpdate=true;
}
export function updateHoles(obstacles) {
  const list=obstacles.filter(o=>o.type==='hole'&&o.z<35).sort((a,b)=>b.z-a.z).slice(0,32);
  holes.count.value=list.length;
  list.forEach((o,i)=>{holes.values.value[i].set(o.x,o.z,o.w*.55,o.len*.52);holes.seeds.value[i]=o.seed;});
}

let pitMats;
export function pothole(o) {
  if(!pitMats) pitMats=[new THREE.MeshStandardMaterial({...surface('asphalt'),roughness:1,bumpScale:.05,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({...surface('sand'),color:0x756249,roughness:1,bumpScale:.13,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({...surface('sand'),color:0x514b39,roughness:.96,bumpScale:.08,side:THREE.DoubleSide})];
  const group=new THREE.Group(), n=72, rings=[[1.1,.10],[1,.12],[.96,-.08],[.76,-.34],[0,-.37]];
  const vertices=[],uv=[],indices=[];
  for(const [r,y] of rings) for(let i=0;i<n;i++) {
    const a=i/n*Math.PI*2, edge=1+.075*Math.sin(a*3+o.seed*6)+.035*Math.cos(a*7);
    const x=Math.cos(a)*o.w*.55*r*edge,z=Math.sin(a)*o.len*.52*r*edge;
    vertices.push(x,y,z);uv.push(x*.9,z*.9);
  }
  const geo=new THREE.BufferGeometry();
  for(let r=0;r<rings.length-1;r++) {
    const start=indices.length;
    for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n,c=(r+1)*n+i,d=(r+1)*n+(i+1)%n;indices.push(a,c,b,b,c,d);}
    geo.addGroup(start,indices.length-start,r===0?0:r<3?1:2);
  }
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const bowl=new THREE.Mesh(geo,pitMats);bowl.receiveShadow=true;group.add(bowl);
  for(let i=0;i<38;i++){const a=hash(i,o.seed)*Math.PI*2,r=.2+hash(i,9)*.52;const stone=rock(.025+hash(i,8)*.09,hash(i,3));stone.position.set(Math.cos(a)*o.w*.55*r,-.31,Math.sin(a)*o.len*.52*r);group.add(stone);}
  // Fragmentos de asfalto sobre el borde roto, además del cuenco bajo la carretera.
  const chips=new THREE.InstancedMesh(rockGeometries[0] || rock(.1,0).geometry,pitMats[0],48);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
  for(let i=0;i<48;i++){
    const a=i/48*Math.PI*2,edge=1+.075*Math.sin(a*3+o.seed*6)+.035*Math.cos(a*7);
    const r=1+hash(i,6)*.06,s=.055+hash(i,7)*.08;
    rotation.setFromEuler(new THREE.Euler(hash(i,3)*.5,a,hash(i,5)*.5));
    matrix.compose(new THREE.Vector3(Math.cos(a)*o.w*.55*r*edge,.105,Math.sin(a)*o.len*.52*r*edge),rotation,new THREE.Vector3(s,.045,s*.8));chips.setMatrixAt(i,matrix);
  }
  chips.receiveShadow=true;group.add(chips);
  group.userData.ownedGeometry=geo;return group;
}

const leafGeo=new THREE.ConeGeometry(.07,1,5),leafMat=new THREE.MeshStandardMaterial({color:0x67654a,roughness:1});
export function shrub(seed) {
  const mesh=new THREE.InstancedMesh(leafGeo,leafMat,110),m=new THREE.Matrix4(),q=new THREE.Quaternion();
  for(let i=0;i<110;i++){const a=hash(i,seed)*Math.PI*2,r=hash(i,13)*.65,s=.3+hash(i,5)*.5;q.setFromEuler(new THREE.Euler(Math.cos(a)*.8,a,Math.sin(a)*.8));m.compose(new THREE.Vector3(Math.cos(a)*r,s*.3,Math.sin(a)*r),q,new THREE.Vector3(.6,s,.6));mesh.setMatrixAt(i,m);}
  mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

export function mountains() {
  const geo=new THREE.PlaneGeometry(1600,350,240,70);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),fade=Math.sin((z+175)/350*Math.PI);
    const ridge=18+noise(x*.012,z*.016,3)*45+noise(x*.045,z*.05,9)*13;
    p.setY(i,Math.pow(Math.max(0,fade),1.6)*ridge-3);
  }
  geo.computeVertexNormals();
  const tex=surface('sand');tex.map.repeat.set(35,10);
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({...tex,color:0x898277,roughness:1}));mesh.position.z=-590;return mesh;
}

export function sky() {
  const c=document.createElement('canvas');c.width=2048;c.height=512;const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const t=y/c.height, cloud=noise(x/220,y/100,3)*.55+noise(x/65,y/35,8)*.3+noise(x/22,y/14,4)*.15;
    const alpha=Math.max(0,Math.min(1,(cloud-.43)*4))*Math.sin(t*Math.PI)*.8;
    const col=[91+110*t,124+76*t,148+42*t],i=(y*c.width+x)*4;
    for(let k=0;k<3;k++)pixels.data[i+k]=col[k]*(1-alpha)+(220-k*4)*alpha;
    pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.SphereGeometry(800,48,24),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,depthWrite:false,fog:false}));
}
