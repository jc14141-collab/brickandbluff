import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {decorateRouletteAtmosphere} from '../dist/roulette-atmosphere.mjs';
import {buildRouletteModel} from '../dist/roulette-model.mjs';
import {WHEEL} from '../dist/roulette.mjs';
import {createRouletteFocus} from '../dist/roulette-focus.mjs';

test('tavern dealer and foreground props leave all roulette landing pockets visible',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{})})})};
 try{const scene=new T.Scene(),rotor=new T.Group();scene.add(rotor);const camera=new T.PerspectiveCamera(43,16/9,.1,50),decor=decorateRouletteAtmosphere(scene,camera,new T.Texture());const {ball}=buildRouletteModel(scene,rotor,()=>null);ball.removeFromParent();const ray=new T.Raycaster();for(const elevation of [.77,.96]){camera.position.set(0,Math.sin(elevation)*9.2,Math.cos(elevation)*9.2);camera.lookAt(0,0,0);scene.updateMatrixWorld(true);for(let i=0;i<38;i++){const a=i*Math.PI*2/38,center=new T.Vector3(Math.sin(a)*1.92,.18,Math.cos(a)*1.92);ray.set(camera.position,center.clone().sub(camera.position).normalize());ray.far=camera.position.distanceTo(center)-.08;assert.equal(ray.intersectObjects(scene.children,true).filter(h=>h.object.isMesh).length,0,'Decoration occludes '+WHEEL[i])}}decor.update(1000);assert.equal(decor.patrons.length,3);decor.dispose()}finally{globalThis.document=previous}
});
test('depth focus resizes with the viewport and renders the final image to the canvas',()=>{
 let target=null;const draws=[],renderer={getDrawingBufferSize:v=>v.set(1920,1080),setRenderTarget:t=>target=t,render:(s,c)=>draws.push({target,s,c})};const effect=createRouletteFocus(renderer),world=new T.Scene(),camera=new T.PerspectiveCamera();camera.position.set(0,7,6);effect.render(world,camera);assert.equal(draws.length,2);assert.equal(draws[0].target.width,1920);assert.equal(draws[0].target.height,1080);assert(draws[0].target.depthTexture);assert.equal(draws[1].target,null);effect.dispose();
});
