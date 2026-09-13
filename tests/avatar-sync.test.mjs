import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,command,snapshot,pack,unpack,AVATAR_SEEDS} from '../server/rooms.mjs';
import {RoomGame,roomAvatarKey,seatOrder} from '../dist/room-game.mjs';
import {Table3D} from '../dist/table3d.mjs';
import * as T from '../dist/vendor/three.module.min.js';

test('each viewer receives the selected character in the correct relative seat for every game',()=>{
 const saved=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({clearRect(){},fillRect(){}})})};
 try{const f=Object.assign(Object.create(Table3D.prototype),{boxGeo:new T.BoxGeometry(1,1,1),materials:new Map(),textures:new Map()});
 for(const mode of ['poker','blackjack','guandan','craps','roulette']){
  let r=createRoom('p0',{mode,capacity:4,name:'Player 0',role:0},1000);
  for(let i=1;i<4;i++)command(r,'p'+i,{kind:'join',name:'Player '+i,role:i},1000);
  r=unpack(pack(r));
  for(let viewer=0;viewer<4;viewer++){
   const v=snapshot(r,'p'+viewer,1000),order=seatOrder(4,v.you);
   assert.equal(v.you,viewer);
   for(const seat of order.slice(1)){const p=v.seats[seat];assert.equal(p.role,seat);assert.equal(p.seed,AVATAR_SEEDS[seat]);const rig=f.avatar(p.seed,p.role);assert.equal(rig[['witch','engineer','guardian','ranger'][seat]],true)}
  }
 }
 }finally{globalThis.document=saved}
});

test('card tables refresh changed avatars within a round without rebuilding on bets or presence updates',()=>{
 const saved=globalThis.document;globalThis.document={querySelector:()=>null};
 try{const ui=Object.create(RoomGame.prototype);let mounts=0,destroys=0;
 Object.assign(ui,{mount(){mounts++;this.scene={destroy(){destroys++}}},renderTable(){},pokerEvents(){}});
 const r={id:'room',mode:'poker',you:0,round:1,serverNow:1000,seats:[{id:'a',role:0,seed:1,bank:2000},{id:'b',role:1,seed:2,bank:2000}]};
 ui.apply(r);assert.equal(mounts,1);
 r.seats[1].bank=1500;r.seats[1].connected=false;ui.apply(r);assert.equal(mounts,1);
 r.seats[1].role=3;ui.apply(r);assert.equal(mounts,2);assert.equal(destroys,1);
 r.seats[1]={...r.seats[1],id:'replacement'};ui.apply(r);assert.equal(mounts,3);
 const key=roomAvatarKey(r);r.you=1;assert.notEqual(roomAvatarKey(r),key);ui.apply(r);assert.equal(mounts,4);
 r.round++;ui.apply(r);assert.equal(mounts,5);
 }finally{globalThis.document=saved}
});
