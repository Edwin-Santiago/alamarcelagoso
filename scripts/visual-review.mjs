import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort'],{stdio:'pipe'});
let browser;
try {
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('Local:'))resolve();});server.on('exit',code=>reject(new Error('Servidor terminó '+code)));});
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5179/?debug');
  await page.getByRole('button',{name:'JUGAR AHORA'}).click();
  await page.waitForFunction(()=>window.__rr?.car.getObjectByName('Coche Blender')&&window.__rr?.environmentAssets.streetLight,{timeout:30000});
  await page.evaluate(()=>window.__rr.texturesReady());
  const result=await page.evaluate(()=>{
    const e=window.__rr;e.paused=true;e.core.v=0;e.core.x=0;e.core.vx=0;e.core.respawnT=0;e.core.invuln=0;
    e.core.obstacles=[{id:900,type:'rock',x:3,z:-12,r:1.2,seed:.4},{id:901,type:'hole',x:-2,z:-10,w:2.5,len:5.5,seed:.3}];
    e.syncWorld();e.poseCar();e.poseCar();e.scene.updateMatrixWorld(true);
    const lights=[];e.car.traverse(o=>{if(/Faro_delantero|Franja_de_luces_traseras/.test(o.name)){const p=o.position.clone();o.getWorldPosition(p);lights.push({name:o.name,z:p.z});}});
    const offset=e.roadTex.offset.y,position=e.roadMesh.position.clone();e.core.v=35;e.advanceVisuals(1);e.core.v=0;const stable=offset===e.roadTex.offset.y&&position.equals(e.roadMesh.position);
    e.renderer.render(e.scene,e.camera);
    return {lights,stable,triangles:e.renderer.info.render.triangles};
  });
  await page.waitForTimeout(800);
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/game-graphics.png'});
  await writeFile('artifacts/visual-review.json',JSON.stringify({result,errors},null,2));
  assert(result.stable,'La textura de la carretera se está desplazando');
  const front=result.lights.filter(l=>l.name.includes('Faro_delantero'));
  const rear=result.lights.find(l=>l.name.includes('Franja_de_luces_traseras'));
  assert(front.length&&rear,'No se encontraron los faros y las luces traseras');
  assert(front.every(l=>l.z<rear.z),'El coche apunta hacia atrás después de animarse');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({result,errors}));
} finally {await browser?.close();server.kill();}
