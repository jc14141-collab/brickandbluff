import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Table3D} from '../dist/table3d.mjs';
for(const role of [0,1,2,3])test('role '+role+' expressions share a single surface throughout blinking and all five reactions',()=>{
 const saved=globalThis.document;const commands=[];const ctx={clearRect(){},fillRect(...args){assert.ok(args.every(Number.isFinite));commands.push(args)}};
 globalThis.document={createElement(){return{width:0,height:0,getContext(){return ctx}}}};
 try{const factory=Object.assign(Object.create(Table3D.prototype),{boxGeo:new T.BoxGeometry(1,1,1),materials:new Map(),textures:new Map(),reduced:false});const rig=factory.avatar(12501,role);rig.baseY=1;assert.ok(rig.faceArt);assert.equal(rig.lids.length,0);assert.equal(rig.brows.length,0);assert.equal(rig.mouth.parent,null);
 for(let kind=0;kind<5;kind++)for(let t=0;t<=1.5;t+=.03){rig.nextIdle=100;rig.nextBlink=100;rig.reaction=kind;rig.reactionAt=0;rig.blinkAt=.5;factory.animateRig(rig,t,.03);assert.ok(Math.abs(rig.head.rotation.x)<.08);assert.ok(Math.abs(rig.head.rotation.y)<.13)}assert.ok(commands.length>0)}finally{globalThis.document=saved}
});
