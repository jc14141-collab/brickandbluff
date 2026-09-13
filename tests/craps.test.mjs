import assert from 'node:assert/strict';
import {Craps,NUMBERS,die,HARDWAYS,PROPS} from '../dist/craps.mjs';
import {FACE_VALUES,faceQuaternion} from '../dist/craps3d.mjs';
import * as T from '../dist/vendor/three.module.min.js';
function roll(g,a,b){g.rolling=true;return g.settle([a,b])}
const counts=Array(13).fill(0);
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
 const total=a+b;counts[total]++;const g=new Craps(1000);g.add('pass',10);g.add('dont',10);g.add('field',10);roll(g,a,b);
 assert.equal(g.point,NUMBERS.includes(total)?total:0);
 const field=[2,12].includes(total)?30:[3,4,9,10,11].includes(total)?20:0;
 const lines=NUMBERS.includes(total)?0:total===12?10:20;
 assert.equal(g.bank,970+field+lines);assert.equal(g.escrow,NUMBERS.includes(total)?20:0);
 for(const point of NUMBERS){const h=new Craps(1000);h.add('pass',10);h.add('dont',10);for(const n of NUMBERS)h.add('p'+n,30);h.point=point;const r=roll(h,a,b);assert.equal(h.point,total===7||total===point?0:point);assert.equal(h.bets.pass,total===7||total===point?0:10);assert.equal(h.bets.dont,h.bets.pass);for(const n of NUMBERS)assert.equal(h.bets['p'+n],total===7?0:30);assert.equal(r.net,total===7?-180:NUMBERS.includes(total)?30*([4,10].includes(total)?9/5:[5,9].includes(total)?7/5:7/6):0)}
}
assert.deepEqual(counts.slice(2),[1,2,3,4,5,6,5,4,3,2,1]);
const g=new Craps(100);g.add('pass',10);g.add('p6',10);assert.equal(g.bets.p6,12);g.point=6;assert.equal(g.remove('pass'),0);assert.throws(()=>g.add('pass',5));g.clear();assert.equal(g.bank,90);g.rolling=true;assert.throws(()=>g.add('field',5));assert.equal(g.remove('pass'),0);roll(g,3,3);assert.equal(g.bank,110);assert.throws(()=>g.settle([3,3]));
let seq=[4294967295,4294967292,5],calls=0;assert.equal(die({getRandomValues(a){a[0]=seq[calls++]}}),6);assert.equal(calls,3);
const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
for(let n=1;n<=6;n++)for(const yaw of[0,.4,-1.2])assert(new T.Vector3(...normals[FACE_VALUES.indexOf(n)]).applyQuaternion(faceQuaternion(n,yaw)).distanceTo(new T.Vector3(0,1,0))<1e-10);
const camera=new T.PerspectiveCamera(47,4/3,.1,60);camera.position.set(0,7.3,9.4);camera.lookAt(0,1.2,-.8);camera.updateMatrixWorld();const p=new T.Vector3(.7,1.565,-2).project(camera);console.log('Dice resting center viewport fraction:',(1-p.y)/2);assert((1-p.y)/2<.46);
console.log('Craps: all 36 outcomes across come-out and six points, payouts, escrow, locks, RNG rejection and all face orientations passed.');
for(const point of [0,...NUMBERS])for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
 for(const n of HARDWAYS){const g=new Craps(100);g.add('h'+n,5);g.point=point;const total=a+b,win=total===n&&a===b,loss=total===7||(total===n&&a!==b),pay=[6,8].includes(n)?9:7;const r=roll(g,a,b);assert.equal(g.bank,90+5+(win?5*pay:0));assert.equal(g.bets['h'+n],loss?0:5);assert.equal(r.net,loss?-5:win?5*pay:0);g.clear();assert.equal(g.escrow,0)}
 for(const p of PROPS){const g=new Craps(100);g.add(p.key,5);g.point=point;const win=p.totals.includes(a+b);roll(g,a,b);assert.equal(g.bank,win?100+5*p.pay:95);assert.equal(g.escrow,0)}
}
const hard=new Craps(100);hard.add('h6',10);roll(hard,1,3);assert.equal(hard.bets.h6,10);roll(hard,3,3);assert.equal(hard.bank,180);assert.equal(hard.bets.h6,10);roll(hard,2,4);assert.equal(hard.bets.h6,0);assert.equal(hard.bank,180);
console.log('Center bets: 2,520 exhaustive Hardways/proposition cases, come-out working, standing win stakes and easy-way losses passed.');
