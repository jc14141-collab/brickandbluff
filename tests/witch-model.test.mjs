import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Table3D} from '../dist/table3d.mjs';
import {fitWitchSeat} from '../dist/witch-model.mjs';
import {blackjackSeat,seatOrder} from '../dist/room-game.mjs';
for(const costume of ['witch','engineer','guardian','ranger'])test(costume+' seats clear the rail across 2–10 players, every viewer and screen ratio',()=>{
 for(let count=2;count<=10;count++)for(let viewer=0;viewer<count;viewer++)for(const aspect of [1,1.33,1.78,2.16]){
 const table=Object.assign(Object.create(Table3D.prototype),{seatCount:count,camera:{aspect}});
 for(const actual of seatOrder(count,viewer).slice(1)){const relative=seatOrder(count,viewer).indexOf(actual),g=new T.Group();g.position.copy(table.avatarPoint(relative));g.scale.setScalar(count>4?Math.max(.62,.96-(count-4)*.055):1);const rig={group:g,[costume]:true};fitWitchSeat(rig);const before=g.position.clone();fitWitchSeat(rig);assert.ok(before.distanceTo(g.position)<1e-9);assert.ok(Math.hypot(g.position.x/(5.8125+.68*g.scale.x+.04),g.position.z/(4.76+.68*g.scale.x+.04))>=1-1e-9);}
 }
});
test('blackjack witch positions clear the shorter table at every player count',()=>{for(let n=2;n<=6;n++)for(let i=1;i<n;i++){const p=blackjackSeat(n,i),g=new T.Group();g.position.set(p.x,1,p.z);g.scale.setScalar(.95);fitWitchSeat({group:g,witch:true},5.8125,3.4);assert.ok(Math.hypot(g.position.x/(5.8125+.686),g.position.z/(3.4+.686))>=1-1e-9)}});
