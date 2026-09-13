import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Table3D} from '../dist/table3d.mjs';
import {BlackjackTable,RoomGame,guandanView,blackjackLayout,blackjackChipLayout} from '../dist/room-game.mjs';
import {createRoom,command,snapshot} from '../server/rooms.mjs';
test('dealer card size decreases with draws and chip stacks avoid projected cards',()=>{
 let previous=2;const c={r:3,s:'♣'};for(let n=2;n<=14;n++){const w=blackjackLayout([],Array(n).fill(c))[0].w;assert(w<=previous);previous=w}
 const camera=new T.PerspectiveCamera(62,1.7,.07,40);camera.position.set(0,5.8,5.8);camera.lookAt(0,1.3,-.15);camera.updateMatrixWorld(true);
 const box=(x,z,w,d,h)=>{const pts=[];for(const dx of[-w/2,w/2])for(const dz of[-d/2,d/2])for(const y of[1.34,1.38+h])pts.push(new T.Vector3(x+dx,y,z+dz).project(camera));return{l:Math.min(...pts.map(p=>p.x)),r:Math.max(...pts.map(p=>p.x)),b:Math.min(...pts.map(p=>p.y)),t:Math.max(...pts.map(p=>p.y))}};
 for(const split of [1,4]){const players=Array.from({length:6},()=>({hands:Array.from({length:split},()=>({cards:Array(4).fill(c)}))})),cards=blackjackLayout(players,Array(6).fill(c)),slots=blackjackChipLayout(cards,6,camera);assert(slots.some(Boolean));for(const s of slots.filter(Boolean)){const a=box(s.x+.12,s.z,.5,.24,.1);for(const card of cards){const b=box(card.x,card.z,card.w,card.w*1.42,0);assert(a.r<=b.l||a.l>=b.r||a.t<=b.b||a.b>=b.t,'chips obscure cards')}}}
});
test('blackjack stake increases animate once, including doubles and splits',()=>{
 const t=Object.create(BlackjackTable.prototype),sounds=[];Object.assign(t,{dealerSeat:2,chipPiles:{children:[]},scene:{},rigs:[{seat:1,gesture:0}],chip:()=>({}),tween(){},react(){}});
 const players=[{bank:2000,hands:[{bet:0}]},{bank:2000,hands:[{bet:0}]}];const beep=k=>sounds.push(k);t.showBets(players,beep);
 players[1].bank-=100;players[1].hands[0].bet=100;t.showBets(players,beep);t.showBets(players,beep);assert.equal(sounds.length,1);assert.equal(t.rigs[0].gesture,1.6);
 players[1].bank-=100;players[1].hands[0].bet=200;t.showBets(players,beep);players[1].hands.push({bet:200});players[1].bank-=200;t.showBets(players,beep);assert.equal(sounds.length,3);
 players[1].bank+=800;t.showBets(players,beep);assert.equal(sounds.length,3);
});
test('all card corners stay inside felt after repeated hits and four-way splits',()=>{
 for(let seats=1;seats<=6;seats++)for(const hands of [1,2,4])for(const count of [2,3,5,7,12,21]){
 const cards=Array.from({length:count},()=>({r:2,s:'♠'})),players=Array.from({length:seats},()=>({hands:Array.from({length:hands},()=>({cards}))})),layout=blackjackLayout(players,cards);
 assert.equal(layout.length,(seats*hands+1)*count);
 for(const c of layout)for(const dx of[-.5,.5])for(const dz of[-.71,.71])assert(Math.hypot((c.x+dx*c.w)/5.2,(c.z+dz*c.w)/(c.key.startsWith('p0h')?3.8:2.95))<=1.000001,'card crosses felt boundary');
 }
});
for(const role of [1,2,3])test('blackjack role '+role+' fan keeps heads separated in landscape first person',(context)=>{
 const saved=globalThis.document;context.after(()=>{globalThis.document=saved});globalThis.document={createElement(){return{getContext(){return{clearRect(){},fillRect(){}}}}}};
 for(let count=2;count<=6;count++)for(const [w,h]of [[2048,1197],[1024,768],[1366,1024]]){
 const t=Object.create(BlackjackTable.prototype);Object.assign(t,{dealerSeat:count,rigs:[],materials:new Map(),textures:new Map(),boxGeo:new T.BoxGeometry(1,1,1),camera:new T.PerspectiveCamera(49,w/h,.07,40),baseQuaternion:new T.Quaternion()});
 t.texture=()=>new T.Texture();for(let i=1;i<=count;i++){const r=t.avatar(12501,role);r.seat=i;t.rigs.push(r)}t.arrangeSeats();t.camera.updateMatrixWorld(true);
 // Body and chair centers must clear the physical tabletop ellipse.
 for(const r of t.rigs){const p=r.group.position;assert((p.x/5.8125)**2+(p.z/3.4)**2>1.15,'seat intersects tabletop');assert.equal(r.baseY,1)}
 const own=blackjackLayout([{hands:[{cards:[{r:6,s:'♥'},{r:3,s:'♠'}]}]}],[])[0];
 const left=new T.Vector3(own.x-own.w/2,1.343,own.z).project(t.camera),right=new T.Vector3(own.x+own.w/2,1.343,own.z).project(t.camera);
 assert((right.x-left.x)*w/2>85,'own card remains too small');
 const bounds=t.rigs.map(r=>{r.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(r.head),points=[];for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(t.camera));return{l:Math.min(...points.map(p=>p.x)),r:Math.max(...points.map(p=>p.x)),b:Math.min(...points.map(p=>p.y)),t:Math.max(...points.map(p=>p.y))}});
 for(const b of bounds)assert(b.l>-1&&b.r<1&&b.t<1,JSON.stringify({count,w,b}));for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];assert(a.r<b.l||b.r<a.l||a.t<b.b||b.t<a.b,`heads overlap: ${count},${w},${i},${j}`)}
 }
});
test('poker action animations rotate seats and never replay polling updates',()=>{
 const moved=[],sounds=[],ui=Object.create(RoomGame.prototype);Object.assign(ui,{order:[2,3,0,1],eventCursor:null,scene:{moveChips:(...a)=>moved.push(a),react(){},rigs:[]},beep:k=>sounds.push(k)});
 const r={game:{events:[{id:0,kind:'bet',seat:0,amount:10}]}};ui.pokerEvents(r);assert.equal(moved.length,0);r.game.events.push({id:1,kind:'bet',seat:3,amount:100});ui.pokerEvents(r);ui.pokerEvents(r);assert.deepEqual(moved,[[1,100,false]]);assert.deepEqual(sounds,['chips']);
});
test('Guandan reveals remaining cards only after the hand is finished, in every seat perspective',()=>{
 const r=createRoom('host',{mode:'guandan',capacity:4,name:'Host',role:0},1000);for(let i=0;i<3;i++)command(r,'host',{kind:'addBot',role:i},1000);command(r,'host',{kind:'start'},1000);
 assert.equal(snapshot(r,'host',1000).game.remaining,undefined);r.game.done=true;r.status='roundEnd';const s=snapshot(r,'host',1000);assert.deepEqual(s.game.remaining,r.game.hands);for(let you=0;you<4;you++){s.you=you;s.game.hand=r.game.hands[you];const v=guandanView(s);for(let i=0;i<4;i++)assert.deepEqual(v.g.hands[i],r.game.hands[(you+i)%4])}assert.equal(snapshot(r,'stranger',1000).game,undefined);
});
