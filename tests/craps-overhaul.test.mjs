import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Craps,restoreCraps,LABELS,NUMBERS} from '../dist/craps.mjs';
import {BET_CELLS,CRAPS_TIMING,primaryCell,feltToWorld,wagerTotal} from '../dist/craps-layout.mjs';
import {ALL_UI_CELLS} from '../dist/craps-single-layout.mjs';
import {DICE_CORE,DICE_EDGE} from '../dist/craps-physics.mjs';
import {Craps3D} from '../dist/craps3d.mjs';
import {PokerTavern} from '../dist/poker-tavern.mjs';
import {dicePose,FELT_Y,rollProgress} from '../dist/craps-motion.mjs';
import {createRoom,command,tick,snapshot,pack,unpack} from '../server/rooms.mjs';
const roll=(g,d)=>{g.rolling=true;return g.settle(d)};
test('every marked region is functional, non-overlapping and shares the 3D coordinates',()=>{
 assert.deepEqual([...new Set(ALL_UI_CELLS.map(c=>c.key))].sort(),Object.keys(LABELS).sort());
 for(const c of BET_CELLS){assert(c.x>0&&c.y>0&&c.x+c.w<1000&&c.y+c.h<500);assert(primaryCell(c.key));const p=feltToWorld(c.x+c.w/2,c.y+c.h/2);assert(Math.abs(p.x)<6.6&&Math.abs(p.z)<3.3)}
 for(let i=0;i<BET_CELLS.length;i++)for(let j=i+1;j<BET_CELLS.length;j++){const a=BET_CELLS[i],b=BET_CELLS[j];assert(!(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-7&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-7),a.key+' overlaps '+b.key)}
 for(const k of ['pass','dont','come','dcome','field',...NUMBERS.map(n=>'p'+n)])assert(BET_CELLS.filter(c=>c.key===k).length>=2);
});
test('COME first-roll payouts cover all 36 outcomes and travel without leaking escrow',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(const k of ['come','dcome']){
  const g=new Craps(100);g.point=8;g.add(k,10);const r=roll(g,[a,b]),n=a+b,prefix=k==='come'?'c':'d';
  if(NUMBERS.includes(n)){assert.equal(g.bets[k],0);assert.equal(g.travel[prefix+n],10);assert.equal(g.escrow,10);assert.equal(r.net,0)}
  else{const win=k==='come'?[7,11].includes(n):[2,3].includes(n),push=k==='dcome'&&n===12;assert.equal(g.bank,win?110:push?100:90);assert.equal(g.escrow,0)}
 }
 assert.throws(()=>new Craps(100).add('come',10));assert.throws(()=>new Craps(100).add('dcome',10));
});
test('travelled contracts resolve before new wagers on the same number, even on come-out',()=>{
 const g=new Craps(500);g.point=8;g.add('come',10);g.add('dcome',25);roll(g,[3,3]);assert.equal(g.bank,465);assert.deepEqual(g.travel,{c6:10,d6:25});
 g.add('come',5);roll(g,[4,4]);assert.equal(g.point,0);assert.equal(g.travel.c8,5);
 assert.equal(g.removeTravel('c6'),0);assert.equal(g.removeTravel('d6'),25);assert.equal(g.bank,485);
 const restored=restoreCraps(JSON.parse(JSON.stringify(g)));roll(restored,[2,4]);assert.equal(restored.bank,505);assert.equal(restored.travel.c6,0);assert.equal(restored.travel.c8,5);
 const h=new Craps(200);h.point=8;h.add('come',10);roll(h,[3,3]);h.add('come',5);roll(h,[3,3]);assert.equal(h.bank,205);assert.equal(h.travel.c6,5);assert.equal(h.escrow,5);
 assert.equal(wagerTotal({bets:{p6:12},travel:{c6:10,d6:25}},'p6'),47);
});
test('Big six/eight resolve independently; migration adds the new boxes to saved games',()=>{
 for(const n of [6,8])for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){const g=new Craps(100);g.add('big'+n,10);roll(g,[a,b]);assert.equal(g.bank,a+b===n?100:90);assert.equal(g.bets['big'+n],a+b===7?0:10)}
 const old={bank:100,point:8,bets:{pass:10},history:[],rolling:false};const g=restoreCraps(old);g.add('come',10);assert.equal(g.bets.come,10);assert.deepEqual(g.travel,{});
});
test('multiplayer holds actual dice for three seconds before touching bankrolls',()=>{
 let now=100000;let r=createRoom('a',{mode:'craps',capacity:2,name:'A',role:0},now);
 command(r,'b',{kind:'join',name:'B',role:1},now);command(r,'b',{kind:'ready',ready:true},now);command(r,'a',{kind:'start'},now);
 command(r,'a',{kind:'act',action:'bet',key:'h6',amount:25},now);now+=CRAPS_TIMING.bet;tick(r,now);assert.equal(r.game.phase,'bets');
 command(r,'a',{kind:'act',action:'roll'},now);r.game.roll.dice=[3,3];const bank=r.game.tables[0].bank;
 tick(r,now+CRAPS_TIMING.throw-1);assert.equal(r.game.phase,'rolling');assert.equal(r.game.tables[0].bank,bank);
 now+=CRAPS_TIMING.throw;tick(r,now);assert.equal(r.game.phase,'landed');assert.equal(r.game.tables[0].history.length,0);assert.equal(r.game.tables[0].bank,bank);
 assert.throws(()=>command(r,'b',{kind:'act',action:'bet',key:'field',amount:10},now));
 r=unpack(pack(r));const v=snapshot(r,'b',now);assert.deepEqual(v.game.roll.dice,[3,3]);assert.equal(v.game.roll.holdEnds,now+3000);
 tick(r,now+2999);assert.equal(r.game.phase,'landed');tick(r,now+3000);assert.equal(r.game.phase,'result');assert.equal(r.game.tables[0].bank,bank+225);assert.equal(r.game.tables[0].history.length,1);
 tick(r,now+5000);assert.equal(r.game.phase,'bets');assert.equal(r.deadline,0);
});
function poseScene(aspect){const scene=Object.create(Craps3D.prototype);Object.assign(scene,{camera:new T.PerspectiveCamera(49,aspect,.08,65),dice:[new T.Object3D(),new T.Object3D()],hand:new T.Object3D(),trail:{geometry:{attributes:{position:{}}}},trailPositions:new Float32Array(90),reduced:false});return scene}
test('dice remain above felt and within rails; landing faces are authoritative and framed',()=>{
 for(const aspect of [16/9,4/3,3/4]){
  const s=poseScene(aspect);
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
   for(let n=0;n<=100;n++){const t=n/100;s.pose(t,[a,b]);s.camera.updateMatrixWorld();for(const d of s.dice){d.updateMatrixWorld();const m=new T.Matrix4().makeRotationFromQuaternion(d.quaternion).elements;const half=row=>DICE_CORE*(Math.abs(m[row])+Math.abs(m[row+4])+Math.abs(m[row+8]))+DICE_EDGE;assert(d.position.y-half(1)>=FELT_Y-.012);assert(Math.abs(d.position.x)+half(0)<=6.51+.012);assert(Math.abs(d.position.z)+half(2)<=3.18+.012);if(t>.42){const v=d.position.clone().project(s.camera);assert(Math.abs(v.x)<.72&&Math.abs(v.y)<.66,'camera lost die')}}}
   for(const [i,value]of [a,b].entries()){const normals={1:[0,1,0],6:[0,-1,0],2:[0,0,1],5:[0,0,-1],3:[1,0,0],4:[-1,0,0]};assert(new T.Vector3(...normals[value]).applyQuaternion(s.dice[i].quaternion).distanceTo(new T.Vector3(0,1,0))<.0001)}
  }
 }
 assert.equal(rollProgress(1400,{started:1000,ends:5000}),.1);assert.equal(rollProgress(7000,{started:1000,ends:5000}),1);
 assert(Math.abs(dicePose(.169999,0).x-dicePose(.17,0).x)<.001,'release must be continuous');
});
test('the constructed tavern leaves both dice unobstructed, including their visible top faces',()=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{})})})};
 try{
  const s=poseScene(4/3);s.scene=new T.Scene();s.table=new T.Group();s.guests=new T.Group();s.scene.add(s.table,s.guests);s.factory=Object.assign(Object.create(PokerTavern.prototype),{scene:s.scene,renderer:{capabilities:{getMaxAnisotropy:()=>4}},boxGeo:new T.BoxGeometry(1,1,1),textures:new Map(),materials:new Map()});
  s.renderer=s.factory.renderer;s.buildTable();s.buildDice();s.buildHand();s.setGuests(Array.from({length:7},(_,i)=>({name:'Player '+i,seed:418+i*331,role:i%4})),{name:'Shooter',role:0});
  for(const rig of s.rigs){assert(rig.group.userData.standing);assert.equal(rig.group.children.filter(o=>o.isGroup).length,1);rig.group.updateMatrixWorld(true);for(const arm of rig.arms){const palm=arm.localToWorld(new T.Vector3(0,-.31,.67));assert(Math.abs(palm.y-2.10)<.04,'palms must rest on the rail')}}
  const ray=new T.Raycaster();ray.camera=s.camera;for(const aspect of [16/9,4/3,3/4]){s.camera.aspect=aspect;s.camera.updateProjectionMatrix();for(const t of [0,.08,.17,.3,.5,.7,.85,1]){s.pose(t,[2,6]);s.scene.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);
   for(const d of s.dice){const points=d.geometry.attributes.position;for(let i=0;i<points.count;i++){const v=new T.Vector3().fromBufferAttribute(points,i).applyMatrix4(d.matrixWorld).project(s.camera);assert(Math.abs(v.x)<.99&&Math.abs(v.y)<.9,`die clipped at ${aspect}, t=${t}: ${v.x},${v.y}`)}
    if(t===1){const target=d.position.clone().add(new T.Vector3(0,.25,0));ray.set(s.camera.position,target.clone().sub(s.camera.position).normalize());ray.far=s.camera.position.distanceTo(target)-.03;assert.equal(ray.intersectObjects([s.table,s.guests],true).length,0,'table decor covers result '+JSON.stringify(ray.intersectObjects([s.table,s.guests],true).map(h=>({point:h.point,kind:h.object.geometry.type}))))}
   }
  }}
  s.factory.buildRoom();s.clearOverhead();assert(!s.factory.roomArchitecture.children.some(o=>o.isMesh&&o.position.y>5.5&&o.scale.z>10&&o.scale.y<.5));s.factory.roomArchitecture.rotation.y=Math.PI/2;s.factory.roomArchitecture.position.x=-3;
  const chips=s.reserveChips.children.map(o=>o.position.toArray());
  for(let seed=0;seed<24;seed++){s.motionSeed=seed;s.pose(.22,[2,6]);const hand=s.hand.position.toArray();s.motionSeed=seed+100;s.pose(.22,[2,6]);assert.deepEqual(s.hand.position.toArray(),hand,'hand must not follow the dice path');s.motionSeed=seed;s.pose(1,[2,6]);assert(!s.hand.visible);assert.deepEqual(s.reserveChips.children.map(o=>o.position.toArray()),chips,'decorative chips must stay fixed');s.scene.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);for(const d of s.dice){const target=d.position.clone().add(new T.Vector3(0,.25,0));ray.set(s.camera.position,target.clone().sub(s.camera.position).normalize());ray.far=s.camera.position.distanceTo(target)-.03;assert.equal(ray.intersectObjects([s.table,s.guests,s.factory.roomArchitecture],true).length,0,'architecture or rail obscures seed '+seed+' '+JSON.stringify(ray.intersectObjects([s.table,s.guests,s.factory.roomArchitecture],true).map(h=>({p:h.point,type:h.object.geometry.type,frame:h.object.userData.frameRing}))))}}
  const old=s.rigs;s.setGuests(Array.from({length:7},(_,i)=>({name:'Player '+i,seed:418+i*331,role:i%4,bank:2000-i})),{name:'Shooter',role:0,bank:1400});assert.equal(s.rigs,old,'bankroll polling must not rebuild avatars');
 }finally{globalThis.document=previous}
});
