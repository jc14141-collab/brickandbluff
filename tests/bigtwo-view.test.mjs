import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,snapshot,tick} from '../server/rooms.mjs';
import {bigtwoView} from '../dist/room-game.mjs';
import {BigTwoUI} from '../dist/bigtwo-ui.mjs';
test('all four perspectives keep hands private and rotate payouts and legal choices correctly',()=>{
 const r=createRoom('a',{mode:'bigtwo',capacity:4,name:'A',role:0},1000);
 for(const auth of ['b','c','d']){command(r,auth,{kind:'join',name:auth,role:1},1000);command(r,auth,{kind:'ready',ready:true},1000)}command(r,'a',{kind:'start'},1000);
 const auths=['a','b','c','d'];for(let i=0;i<4;i++){
  const snap=snapshot(r,auths[i],1000),{g,order}=bigtwoView(snap);
  assert.deepEqual(g.hands[0],r.game.hands[i]);assert(g.hands.slice(1).flat().every(c=>c===null));
  assert.deepEqual(g.legal(0).map(m=>m.key),r.game.legal(i).map(m=>m.key));assert.equal(order[g.turn],r.game.turn);
  assert.equal(snap.game.remaining,undefined);assert.equal(snap.game.deck,undefined);
 }
 r.seats.forEach(s=>s.bot=true);let now=1000;for(let k=0;k<400&&r.status==='playing';k++)tick(r,now+=2000);assert.equal(r.status,'roundEnd');
 for(let i=0;i<4;i++){const {g,match,order}=bigtwoView(snapshot(r,auths[i],now));const result=match.settle();assert.equal(order[result.winner],r.match.result.winner);assert.equal(result.scores[0],r.match.result.scores[i]);assert.deepEqual(g.hands[0],r.game.hands[i]);assert.equal(g.finishType,r.game.finishType)}
});
test('settlement button starts the next network round',()=>{
 let calls=0;const nodes=new Map(),q=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',scrollLeft:0});return nodes.get(k)};
 const ui=Object.assign(Object.create(BigTwoUI.prototype),{alive:true,network:{next(){calls++}},q,host:{querySelectorAll:()=>[]},game:{done:true,hands:[[],[],[],[]],turn:0,opening:false,actions:[],trick:0,last:[],owner:-1,target:null},match:{round:1},selected:new Set(),names:['你','B','C','D'],value:10,stacks:[2000,2000,2000,2000],resultMarkup:()=>'',message:''});
 ui.render();q('[data-gnext]').onclick();assert.equal(calls,1);
});
