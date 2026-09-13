import {renderPixelRatio} from './voxel-art.mjs';
import {DICE_SIZE,DICE_CORE,DICE_EDGE,visualRotation,throwSimulation} from './craps-physics.mjs';
import * as T from './vendor/three.module.min.js';
import {PokerTavern} from './poker-tavern.mjs';
import {FACE_VALUES,faceQuaternion} from './craps-dice.mjs';
import {BET_CELLS,SEAT_COLORS,CRAPS_TIMING,drawCrapsFelt,feltToWorld,wagerTotal} from './craps-layout.mjs';
import {FELT_Y,dicePose,shotCamera,smooth,clamp} from './craps-motion.mjs';
import {createRouletteFocus} from './roulette-focus.mjs';

function dieMaterial(n){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 x.fillStyle='#af1b16';x.fillRect(0,0,256,256);x.fillStyle='#e03d24';x.fillRect(7,7,242,6);x.fillRect(7,7,6,242);x.fillStyle='#65100e';x.fillRect(7,244,242,6);x.fillRect(244,7,6,242);
 const dots={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
 for(const [a,b]of dots[n]){const xx=128+a*65,yy=128+b*65;x.fillStyle='#671c16';x.fillRect(xx-21,yy-19,43,43);x.fillStyle='#fff0cd';x.fillRect(xx-19,yy-20,38,38);x.fillStyle='#fffbed';x.fillRect(xx-16,yy-17,28,5)}
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter;
 return new T.MeshPhysicalMaterial({map,roughness:.22,metalness:.02,clearcoat:1,clearcoatRoughness:.17,transmission:0,thickness:.35,ior:1.48});
}
export class Craps3D{
 constructor(host,{reduced=false,onImpact=()=>{}}={}){
  Object.assign(this,{host,reduced,onImpact});this.alive=true;this.phase='bets';this.scene=new T.Scene();this.scene.background=new T.Color('#261a11');this.scene.fog=new T.FogExp2('#302116',.024);
  this.camera=new T.PerspectiveCamera(49,1,.08,65);this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(renderPixelRatio(globalThis.devicePixelRatio||1,host.clientWidth||1280,host.clientHeight||720));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;host.append(this.renderer.domElement);
  this.factory=Object.assign(Object.create(PokerTavern.prototype),{boxGeo:new T.BoxGeometry(1,1,1),materials:new Map(),textures:new Map(),renderer:this.renderer,scene:this.scene});const f=this.factory;
  f.buildRoom();this.clearOverhead();f.roomArchitecture.rotation.y=Math.PI/2;f.roomArchitecture.position.x=-3;
  for(const r of f.backgroundRigs)r.group.removeFromParent();f.batchBoxes(f.roomArchitecture);for(const r of f.backgroundRigs)f.roomArchitecture.add(r.group);f.roomArchitecture.traverse(o=>{if(o.isMesh)o.castShadow=false});
  this.scene.add(new T.HemisphereLight(0xffe7bf,0x293021,.32));const key=new T.DirectionalLight(0xffd69d,2.6);key.position.set(0,8,1);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-9,right:9,top:6,bottom:-6,near:.5,far:25});key.shadow.bias=-.0003;key.shadow.normalBias=.025;key.shadow.radius=4;this.scene.add(key);
  for(const z of [-3,3]){const lamp=new T.PointLight(0xffb550,18,16,2);lamp.position.set(-4,5,z);this.scene.add(lamp)}f.reflections();
  this.table=new T.Group();this.scene.add(this.table);this.buildTable();this.buildDice();this.buildHand();this.wagerGroup=new T.Group();this.scene.add(this.wagerGroup);this.guests=new T.Group();this.scene.add(this.guests);this.setGuests([],{name:'你',role:0});
  this.dust=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:0xffd28b,size:.022,transparent:true,opacity:.32,depthWrite:false}));const positions=new Float32Array(120*3);for(let i=0;i<120;i++){positions[i*3]=-10+Math.sin(i*173.1)*4;positions[i*3+1]=2+(i%17)/5;positions[i*3+2]=Math.sin(i*91.7)*6}this.dust.geometry.setAttribute('position',new T.BufferAttribute(positions,3));this.scene.add(this.dust);
  this.focus=this.reduced?null:createRouletteFocus(this.renderer);this.resize=()=>{const w=host.clientWidth,h=Math.max(1,host.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);if(!this.animation)this.pose(this.phase==='landed'?1:0);this.render()};this.observer=new ResizeObserver(this.resize);this.observer.observe(host);this.resize();this.loop=now=>{if(!this.alive)return;this.animate(now);this.frame=requestAnimationFrame(this.loop)};this.frame=requestAnimationFrame(this.loop);
 }
 block(parent,w,h,d,x,y,z,color,kind='wood'){const m=this.factory.box(parent,w,h,d,x,y,z,color);m.material=this.factory.surface(kind,color);return m}
 clearOverhead(){const room=this.factory.roomArchitecture;for(const o of [...room.children])if(o.isMesh&&o.position.y>5.5&&o.scale.z>10&&o.scale.y<.5)o.removeFromParent()}
 frameRing(ox,oz,ix,iz,top,depth,color,bevel=0){
  const shape=new T.Shape(),hole=new T.Path();const polygon=(path,x,z,c)=>{const pts=[[-x+c,-z],[x-c,-z],[x,-z+c],[x,z-c],[x-c,z],[-x+c,z],[-x,z-c],[-x,-z+c]];path.moveTo(...pts[0]);pts.slice(1).forEach(p=>path.lineTo(...p));path.closePath()};polygon(shape,ox,oz,.14);polygon(hole,ix,iz,Math.max(.025,.14-(ox-ix)));shape.holes.push(hole);
  const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:!!bevel,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1,curveSegments:1});geo.rotateX(Math.PI/2);const m=new T.Mesh(geo,this.factory.surface('wood',color));m.position.y=top;m.castShadow=m.receiveShadow=true;m.userData.frameRing=true;this.table.add(m);return m;
 }
 buildTable(){
  const g=this.table;this.block(g,14.2,.55,7.7,0,.90,0,0x57361e);this.block(g,13.65,.10,7.1,0,1.15,0,0x122d1c,'felt');
  const texture=new T.CanvasTexture(drawCrapsFelt(document.createElement('canvas')));texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());texture.magFilter=T.LinearFilter;this.feltTexture=texture;
  const felt=new T.Mesh(new T.PlaneGeometry(13.2,6.6),new T.MeshStandardMaterial({map:texture,roughness:.99,bumpMap:this.factory.texture('felt'),bumpScale:.006}));felt.rotation.x=-Math.PI/2;felt.position.y=FELT_Y;felt.receiveShadow=true;g.add(felt);
  this.frameRing(7.165,3.845,6.715,3.395,1.985,.83,0x694324);
  this.frameRing(7.237,3.917,6.643,3.323,2.092,.094,0x986238,.018);
  this.frameRing(6.665,3.345,6.635,3.315,2.096,.022,0xc2a261);
  for(const side of [-1,1]){
   this.block(g,.09,.58,6.64,side*6.68,1.51,0,0x103c27,'felt');this.block(g,13.27,.58,.09,0,1.51,side*3.365,0x103c27,'felt');
  }
  // Small rubber pyramids along the interior provide a visible rebound surface.
  const geo=new T.ConeGeometry(.095,.12,4),mat=this.factory.surface('felt',0x17492f),count=2*(44+88)*3,bumps=new T.InstancedMesh(geo,mat,count);const o=new T.Object3D();let index=0;
  for(const side of [-1,1])for(let row=0;row<3;row++){
   for(let i=0;i<44;i++){o.position.set(side*6.61,1.32+row*.17,-3.2+i*.148);o.rotation.set(0,0,side*Math.PI/2);o.updateMatrix();bumps.setMatrixAt(index++,o.matrix)}
   for(let i=0;i<88;i++){o.position.set(-6.47+i*.148,1.32+row*.17,side*3.30);o.rotation.set(-side*Math.PI/2,0,0);o.updateMatrix();bumps.setMatrixAt(index++,o.matrix)}
  }bumps.receiveShadow=true;g.add(bumps);
  for(const x of [-5.4,5.4])for(const z of [-2.8,2.8])this.block(g,.65,1.35,.65,x,.25,z,0x39271b);
  this.factory.batchBoxes(g);
  this.chipGeo=new T.CylinderGeometry(.14,.14,.05,16);this.chipMats=SEAT_COLORS.map(c=>new T.MeshStandardMaterial({color:c,roughness:.72,map:this.factory.texture('clay')}));
  this.chipFaces=SEAT_COLORS.map((c,i)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=c;ctx.fillRect(0,0,128,128);ctx.strokeStyle='#efe0b5';ctx.lineWidth=5;ctx.strokeRect(29,29,70,70);for(let n=0;n<8;n++){ctx.save();ctx.translate(64,64);ctx.rotate(n*Math.PI/4);ctx.fillStyle='#f2e4c3';ctx.fillRect(-8,-63,16,20);ctx.restore()}ctx.fillStyle='#f4e7cb';ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('B&B',64,66);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter;return new T.MeshStandardMaterial({map,roughness:.78})});
  this.chipWhite=this.factory.mat(0xf0dcad);
  this.chipStripeGeo=new T.BoxGeometry(.045,.052,.035);
  this.reserveChips=new T.Group();g.add(this.reserveChips);for(let p=0;p<10;p++){const x=-5.2+p*1.06,z=p%2?2.95:-2.95;for(let k=0;k<3+p%4;k++)this.makeChip(this.reserveChips,x,FELT_Y+.027+k*.053,z,p%8)}
 }
 makeChip(parent,x,y,z,seat){const mesh=new T.Mesh(this.chipGeo,[this.chipMats[seat%8],this.chipFaces[seat%8],this.chipFaces[seat%8]]);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);const stripes=new T.InstancedMesh(this.chipStripeGeo,this.chipWhite,8),o=new T.Object3D();for(let n=0;n<8;n++){const a=n*Math.PI/4;o.position.set(Math.sin(a)*.127,0,Math.cos(a)*.127);o.rotation.y=a;o.updateMatrix();stripes.setMatrixAt(n,o.matrix)}mesh.add(stripes);return mesh}
 buildDice(){
  const geo=new T.BoxGeometry(DICE_SIZE,DICE_SIZE,DICE_SIZE,6,6,6),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),inner=v.clone().clampScalar(-DICE_CORE,DICE_CORE);v.sub(inner).normalize().multiplyScalar(DICE_EDGE).add(inner);p.setXYZ(i,v.x,v.y,v.z)}geo.computeVertexNormals();
  const mats=FACE_VALUES.map(dieMaterial);this.dice=[0,1].map(i=>{const m=new T.Mesh(geo,mats);m.quaternion.copy(faceQuaternion(3+i));m.castShadow=m.receiveShadow=true;this.scene.add(m);return m});
  this.trail=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({size:.047,color:0xffc18a,transparent:true,opacity:.25,depthWrite:false}));this.trailPositions=new Float32Array(30*3);this.trail.geometry.setAttribute('position',new T.BufferAttribute(this.trailPositions,3));this.scene.add(this.trail);
 }
 buildHand(){const hand=this.hand=new T.Group();hand.scale.setScalar(1.25);this.scene.add(hand);this.block(hand,.7,.32,.70,.21,0,0,0xd0a078,'skin');this.block(hand,.93,.4,.69,1.0,-.09,0,0x39838a,'fabric');for(let i=0;i<4;i++)this.block(hand,.5,.22,.145,-.32,.1,-.255+i*.17,0xd9ab7e,'skin');this.block(hand,.35,.25,.20,.03,.13,.41,0xd9ab7e,'skin');hand.traverse(o=>{o.castShadow=false})}
 standRig(rig){
  const g=rig.group,chair=g.children.find(o=>o.isGroup&&o!==rig.head&&!rig.arms.includes(o));if(chair)g.remove(chair);
  for(const o of [...g.children])if(o.isMesh&&o.position.y<.05&&o.position.z>.25)g.remove(o);
  const lean=new T.Group();for(const o of [...g.children])lean.add(o);lean.rotation.x=.06;g.add(lean);rig.lean=lean;
  for(const side of [-1,1]){this.factory.box(g,.36,1.8,.36,side*.25,-.85,-.04,0x283633);this.factory.box(g,.4,.2,.58,side*.25,-1.9,.06,0x172621)}
  rig.arms.forEach(a=>a.position.y=1.01);rig.head.rotation.x=.045;g.scale.setScalar(.9);g.userData.standing=true;return rig;
 }
 setGuests(roster,shooter={}){
  const signature=JSON.stringify([roster.map(s=>[s.name,s.seed,s.role]),shooter.name,shooter.role]);if(signature===this.guestSignature)return;this.guestSignature=signature;
  // Avatar geometry/materials are shared with the factory; dispose only unique labels on replacement.
  this.guests.traverse(o=>{if(o.isSprite){for(const [k,t]of this.factory.textures)if(t===o.material.map)this.factory.textures.delete(k);o.material.map?.dispose();o.material.dispose()}});this.guests.clear();this.rigs=[];const f=this.factory;f.castIndex=1;
  const dealer=this.standRig(f.avatar(7789));dealer.group.position.set(-7.48,1.5,0);dealer.group.rotation.y=Math.PI/2;this.guests.add(dealer.group);this.rigs.push(dealer);
  const spots=[[-3.8,-4.13],[-3.8,4.13],[-.7,-4.13],[-.7,4.13],[2.4,-4.13],[2.4,4.13],[4.9,-4.13]];
  roster.slice(0,7).forEach((s,i)=>{const rig=this.standRig(f.avatar(s.seed??417+i*331,s.role));const [x,z]=spots[i];rig.group.position.set(x,1.5,z);rig.group.rotation.y=z>0?Math.PI:0;this.guests.add(rig.group);this.rigs.push(rig);const map=f.textTexture(s.name??'玩家','#f3dfac','#253223',512,96);const label=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));label.position.set(x,3.35,z);label.scale.set(1.5,.28,1);this.guests.add(label)});
  const skin=[0xe2bd7e,0x805340,0xcce2dc,0xe2bd7e][shooter.role??0];this.hand?.traverse(o=>{if(o.material?.map===f.texture('skin'))o.material=f.surface('skin',skin)});
 }
 setWagers(players){
  const signature=JSON.stringify(players.map(p=>[p.bets,p.travel]));if(signature===this.wagerSignature)return;this.wagerSignature=signature;this.wagerGroup.clear();
  for(const c of BET_CELLS){if(c.kind==='vertical')continue;players.forEach((p,i)=>{const n=wagerTotal(p,c.key);if(!n)return;const pos=feltToWorld(c.x+c.w*(.15+(i%4)*.23),c.y+c.h*(i<4?.72:.91));for(let k=0;k<Math.min(4,Math.max(1,Math.ceil(n/25)));k++)this.makeChip(this.wagerGroup,pos.x,FELT_Y+.027+k*.053,pos.z,i)})}
 }
 setPhase(phase){if(this.phase===phase)return;this.phase=phase;if(phase==='ready'){this.cancelThrow();this.pose(0)}else if(phase==='landed'){if(this.animation)this.completeThrow()}else if(['bets','result'].includes(phase)){this.cancelThrow();this.hand.visible=false}this.render()}
 pose(t,values=this.values??[3,4]){
  this.lastProgress=t;const a=dicePose(t,0,this.motionSeed??0),b=dicePose(t,1,this.motionSeed??0);this.dice.forEach((d,i)=>{const p=i?b:a;d.position.set(p.x,p.y,p.z);
   d.quaternion.copy(visualRotation(t,i,values[i],this.motionSeed??0));

  });
  const shot=this.reduced?{position:{x:8.5,y:9,z:7.5},target:{x:0,y:1.3,z:0}}:shotCamera(t,this.camera.aspect,this.motionSeed??0);this.camera.position.set(shot.position.x,shot.position.y,shot.position.z);this.camera.lookAt(shot.target.x,shot.target.y,shot.target.z);this.focusDistance=this.camera.position.distanceTo(new T.Vector3(shot.target.x,shot.target.y,shot.target.z));
  // Follow-through is anchored to the shooter's body, never to airborne dice.
  const pull=t<=.17?Math.sin(t/.17*Math.PI):0,release=smooth((t-.17)/.12);this.hand.visible=!this.reduced&&t<.29;this.hand.position.set(4.60+pull*.20-release*.65,2.33+pull*.08-release*.38,1.4);this.hand.rotation.z=pull*.08-release*.65;
  this.trail.visible=!this.reduced&&t>.17&&t<.72;if(this.trail.visible)for(let i=0;i<30;i++){const pos=dicePose(clamp(t-(i%15)*.0025),i<15?0:1,this.motionSeed??0);this.trailPositions.set([pos.x,pos.y,pos.z],i*3)}this.trail.geometry.attributes.position.needsUpdate=true;
 }
 animate(now){
  if(!['ready','rolling','landed'].includes(this.phase))return;
  if(this.animation){const a=this.animation,t=clamp((now-a.start)/a.duration);this.pose(t);for(const contact of throwSimulation(this.motionSeed).contacts)if(contact.speed>1&&a.previous<contact.time&&t>=contact.time&&t-a.previous<.2)this.onImpact();a.previous=t;if(t===1)this.completeThrow()}
  for(const [i,f]of this.factory.torchFlames.entries())f.material.emissiveIntensity=1.8+(this.reduced?0:Math.sin(now/310+i)*.18);
  if(!this.reduced){for(const [i,r]of this.rigs.entries()){r.head.rotation.y=Math.sin(now/3000+i)*.055;r.head.rotation.x=.045+Math.sin(now/1900+i)*.012}for(const [i,r]of this.factory.backgroundRigs.entries())r.head.rotation.y=Math.sin(now/3200+i)*.08;this.dust.position.y=Math.sin(now/7000)*.1}
  this.render();
 }
 render(){if(!this.renderer)return;if(this.focus)this.focus.render(this.scene,this.camera,this.focusDistance??8);else this.renderer.render(this.scene,this.camera)}
 throw(values,{durationMs=CRAPS_TIMING.throw,elapsedMs=0,seed=crypto.getRandomValues(new Uint32Array(1))[0]}={}){this.cancelThrow();this.motionSeed=seed;this.values=values;this.phase='rolling';const duration=Math.max(1,durationMs);return new Promise(resolve=>{this.animation={start:performance.now()-Math.max(0,elapsedMs),duration,resolve,previous:Math.max(0,elapsedMs)/duration};this.pose(clamp(elapsedMs/duration));if(elapsedMs>=duration)this.completeThrow()})}
 showResult(values,{seed=this.motionSeed??0}={}){this.motionSeed=seed;this.values=values;this.cancelThrow();this.phase='landed';this.pose(1,values);this.render()}
 completeThrow(){const a=this.animation;this.animation=null;this.pose(1);a?.resolve()}
 cancelThrow(){const a=this.animation;this.animation=null;a?.resolve()}
 destroy(){this.alive=false;cancelAnimationFrame(this.frame);this.cancelThrow();this.observer.disconnect();this.focus?.dispose();this.factory.tavernEnv?.dispose();const geometries=new Set(),materials=new Set(),textures=new Set(this.factory.textures.values());this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});for(const m of materials){for(const k of ['map','bumpMap','normalMap'])if(m[k])textures.add(m[k]);m.dispose()}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());this.renderer.dispose();this.renderer.domElement.remove()}
}
