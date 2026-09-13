import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Craps,NUMBERS,restoreCraps} from '../dist/craps.mjs';
import {EXTRA_BETS} from '../dist/craps-extra.mjs';
import {throwSimulation,physicalPose,visualRotation,support} from '../dist/craps-physics.mjs';
import {shotCamera} from '../dist/craps-motion.mjs';
const roll=(g,d)=>{g.rolling=true;return g.settle(d)};
const ratio=n=>[4,10].includes(n)?2:[5,9].includes(n)?1.5:1.2;
test('Buy, Lay and single-roll combinations reconcile bankroll plus escrow for every outcome',()=>{
 for(const c of EXTRA_BETS.filter(c=>c.group!=='odds'))for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  const g=new Craps(1000);g.point=8;g.add(c.key,60);const stake=g.bets[c.key],n=a+b,k=c.key;let expected;
  if(k.startsWith('buy'))expected=n===7?-stake:n===+k.slice(3)?stake*ratio(n)-Math.ceil(stake*.05):0;
  else if(k.startsWith('lay'))expected=n===+k.slice(3)?-stake:n===7?stake/ratio(+k.slice(3))-Math.ceil(stake/ratio(+k.slice(3))*.05-1e-9):0;
  else if(k.startsWith('hop'))expected=Math.min(a,b)===+k[3]&&Math.max(a,b)===+k[4]?stake*(a===b?30:15):-stake;
  else if(k==='ce')expected=stake*(n===11?7:[2,3,12].includes(n)?3:-1);
  else{const parts=k==='horn'?4:5,high=k.startsWith('horn')?+k.slice(4):0;expected=0;for(const v of [2,3,11,12])expected+=stake/parts*(high===v?2:1)*(n===v?([2,12].includes(v)?30:15):-1);if(k==='world')expected+=stake/5*(n===7?4:-1)}
  const r=roll(g,[a,b]);assert(Math.abs(r.net-expected)<1e-7,`${k} ${a},${b}: ${r.net}/${expected}`);assert(Math.abs(g.bank+g.escrow-1000-expected)<1e-7);
 }
});
test('Odds require base contracts, obey caps, resolve true odds and refund OFF Come odds',()=>{
 for(const n of NUMBERS)for(const against of [false,true])for(const win of [false,true]){
  const g=new Craps(1000),key=against?'odont':'opass';assert.throws(()=>g.add(key,10));g.add(against?'dont':'pass',20);g.point=n;g.add(key,60);assert.throws(()=>g.add(key,100));const stake=g.bets[key],total=win?(against?7:n):(against?n:7),d=total>6?[6,total-6]:[1,total-1];const expected=(win?20:-20)+(win?stake*(against?1/ratio(n):ratio(n)):-stake);assert.equal(roll(g,d).net,expected);assert.equal(g.escrow,0);
 }
 const g=new Craps(1000);g.point=8;g.travel={c6:10,d6:10};g.bank-=20;g.add('oc6',30);g.add('od6',30);g.point=0;const h=restoreCraps(JSON.parse(JSON.stringify(g)));assert.equal(roll(h,[3,4]).net,25);assert.equal(h.escrow,0);
 const j=new Craps(1000);j.point=8;j.travel={d6:10};j.bank-=10;j.add('od6',30);j.removeTravel('d6');assert.equal(j.bank,1000);assert.equal(j.escrow,0);
});
test('seeded throws vary, collide with rails, keep both dice framed and finish on authoritative faces',()=>{
 const ends=new Set();for(let seed=0;seed<24;seed++){
  const sim=throwSimulation(seed);assert(sim.contacts.some(c=>c.type==='rail'));assert(sim.contacts.some(c=>c.type==='felt'));ends.add(JSON.stringify(sim.frames.at(-1).map(d=>d.p.toArray())));
  for(const aspect of [16/9,4/3,3/4])for(const t of [.17,.3,.5,.7,.85,1]){const shot=shotCamera(t,aspect,seed),cam=new T.PerspectiveCamera(49,aspect,.08,65);cam.position.copy(shot.position);cam.lookAt(shot.target.x,shot.target.y,shot.target.z);cam.updateMatrixWorld();for(let i=0;i<2;i++){const {p,q}=physicalPose(t,i,seed),v=p.clone().project(cam);assert(Math.abs(v.x)<.9&&Math.abs(v.y)<.85,`seed ${seed} t ${t} aspect ${aspect}: ${v.toArray()}`);assert(p.y-support(q,new T.Vector3(0,1,0))>=1.205-.012)}}
  for(let value=1;value<=6;value++){const normal={1:[0,1,0],6:[0,-1,0],2:[0,0,1],5:[0,0,-1],3:[1,0,0],4:[-1,0,0]}[value];assert(new T.Vector3(...normal).applyQuaternion(visualRotation(1,0,value,seed)).distanceTo(new T.Vector3(0,1,0))<.0001)}
 }
 assert.equal(ends.size,24);const copy=JSON.stringify(throwSimulation('repeat').frames);for(let i=50;i<70;i++)throwSimulation(i);assert.equal(JSON.stringify(throwSimulation('repeat').frames),copy);
});
test('landing joins continuously and rests before the result transition',()=>{
 for(let seed=0;seed<24;seed++)for(let i=0;i<2;i++){
  for(const t of [.70,.95,1]){const a=physicalPose(t-1e-6,i,seed),b=physicalPose(t,i,seed);assert(a.p.distanceTo(b.p)<.001);assert(a.q.angleTo(b.q)<.001)}
  const a=physicalPose(.95,i,seed),b=physicalPose(1,i,seed);assert(a.p.distanceTo(b.p)<1e-8);assert(a.q.angleTo(b.q)<1e-7);
 }
});
test('Cannon sleep and recorded body orientation drive the entire landing',()=>{
 let pairContact=false;
 for(let seed=0;seed<24;seed++){
  const sim=throwSimulation(seed);assert.equal(sim.engine,'cannon-es');assert(sim.sleeping&&sim.valid);pairContact ||= sim.contacts.some(c=>c.type==='dice');
  for(const t of [.71,.79,.87,.91,.99])for(let i=0;i<2;i++){
   const u=Math.min(1,(t-.17)/.75)*(sim.frames.length-1),lo=Math.floor(u),hi=Math.min(lo+1,sim.frames.length-1),a=sim.frames[lo][i],b=sim.frames[hi][i],actual=physicalPose(t,i,seed);
   assert(actual.p.distanceTo(a.p.clone().lerp(b.p,u-lo))<1e-10);
   assert(actual.q.angleTo(a.q.clone().slerp(b.q,u-lo))<1e-7);
  }
 }
 assert(pairContact,'the two dice must interact through rigid-body contacts');
});

