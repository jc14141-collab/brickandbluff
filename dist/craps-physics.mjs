import * as T from './vendor/three.module.min.js';
import * as C from './vendor/cannon-es.js';
import {faceQuaternion,FACE_VALUES} from './craps-dice.mjs';
export const DICE_SIZE=.50,DICE_CORE=.215,DICE_EDGE=.035;
const FLOOR=1.205,DT=1/360,cache=new Map(),clamp=x=>Math.max(0,Math.min(1,x));
const normals=FACE_VALUES.map(v=>new T.Vector3(0,1,0).applyQuaternion(faceQuaternion(v).invert()));
export function support(q,n){const local=n.clone().applyQuaternion(q.clone().invert());return DICE_CORE*(Math.abs(local.x)+Math.abs(local.y)+Math.abs(local.z))+DICE_EDGE}
function upper(q){let face=1,height=-2;normals.forEach((n,i)=>{const y=n.clone().applyQuaternion(q).y;if(y>height){height=y;face=FACE_VALUES[i]}});return{face,height,q:q.clone()}}
function simulate(seed,attempt){
 let state=2166136261;for(const c of String(seed)+':'+attempt)state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0),allowSleep:true});world.solver.iterations=24;world.solver.tolerance=1e-8;
 const diceMat=new C.Material('acrylic'),felt=new C.Material('felt'),rail=new C.Material('rubber');
 for(const [mat,friction,restitution]of [[felt,.32,.36],[rail,.22,.65],[diceMat,.22,.42]])world.addContactMaterial(new C.ContactMaterial(diceMat,mat,{friction,restitution,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
 function plane(x,y,z,n,mat,kind){const body=new C.Body({mass:0,shape:new C.Plane(),material:mat});body.position.set(x,y,z);body.quaternion.setFromVectors(new C.Vec3(0,0,1),new C.Vec3(...n));body.kind=kind;world.addBody(body)}
 plane(0,FLOOR,0,[0,1,0],felt,'felt');plane(-6.51,0,0,[1,0,0],rail,'rail');plane(6.51,0,0,[-1,0,0],rail,'rail');plane(0,0,-3.18,[0,0,1],rail,'rail');plane(0,0,3.18,[0,0,-1],rail,'rail');
 const contacts=[],frames=[],bodies=[0,1].map(i=>{
  const b=new C.Body({mass:.055,shape:new C.Box(new C.Vec3(.25,.25,.25)),material:diceMat,allowSleep:true,sleepSpeedLimit:.045,sleepTimeLimit:.35,linearDamping:.08,angularDamping:.10});
  b.position.set(4.35,2.86,1.4+(i?1:-1)*.34);b.velocity.set(-12.6-random()*1.2,1.6+random()*1.7,-.25+(i?1:-1)*random()*.65);b.angularVelocity.set(7+random()*8,random()*12-6,random()*16-8);const q=faceQuaternion(i+3,random()*.3);b.quaternion.set(q.x,q.y,q.z,q.w);b.kind='dice';world.addBody(b);
  let last=-1;b.addEventListener('collide',e=>{const speed=Math.abs(e.contact.getImpactVelocityAlongNormal());if(speed>.35&&world.time-last>.065){last=world.time;contacts.push({seconds:world.time,type:e.body.kind,index:i,speed})}});return b;
 });
 function capture(){frames.push(bodies.map(b=>({p:new T.Vector3(b.position.x,b.position.y,b.position.z),q:new T.Quaternion(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w)})))}
 capture();let sleeping=false;for(let step=0;step<3600;step++){world.step(DT);capture();if(bodies.every(b=>b.sleepState===C.Body.SLEEPING)){sleeping=true;break}}
 const rest=frames.at(-1).map(d=>upper(d.q));
 return{frames,rest,contacts,duration:(frames.length-1)*DT,sleeping,valid:sleeping&&rest.every(r=>r.height>.9995)&&contacts.some(c=>c.type==='rail'),engine:'cannon-es'};
}
export function throwSimulation(seed=0){
 const key=String(seed);if(cache.has(key))return cache.get(key);let sim;
 // A cocked die is re-thrown during preparation, never rotated into place.
 for(let attempt=0;attempt<12;attempt++){sim=simulate(seed,attempt);if(sim.valid)break}
 if(!sim.valid)throw Error('Dice did not settle');
 // The final 8% is a genuinely stationary hold; no procedural landing or snap.
 sim.contacts=sim.contacts.map(c=>({...c,time:.17+.75*c.seconds/sim.duration}));cache.set(key,sim);if(cache.size>16)cache.delete(cache.keys().next().value);return sim;
}
export function physicalPose(progress,index,seed=0){
 const t=clamp(progress),sim=throwSimulation(seed);if(t<.17){const pull=Math.sin(t/.17*Math.PI),a=sim.frames[0][index];return{p:a.p.clone().add(new T.Vector3(pull*.20,pull*.08,0)),q:a.q.clone()}}
 const position=clamp((t-.17)/.75)*(sim.frames.length-1),lo=Math.floor(position),hi=Math.min(sim.frames.length-1,lo+1),a=sim.frames[lo][index],b=sim.frames[hi][index];return{p:a.p.clone().lerp(b.p,position-lo),q:a.q.clone().slerp(b.q,position-lo)};
}
// Fix the label orientation before release using a cube symmetry. It is constant
// throughout the throw, preserves opposite faces, and never changes the body path.
export function visualRotation(t,index,value,seed=0){const sim=throwSimulation(seed);return physicalPose(t,index,seed).q.multiply(faceQuaternion(sim.rest[index].face).invert().multiply(faceQuaternion(value)))}
