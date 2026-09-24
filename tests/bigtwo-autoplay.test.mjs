import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,command,tick,snapshot,pack,unpack} from '../server/rooms.mjs';
import {CARD_VALUES,normalizeValue,BigTwoMatch} from '../dist/bigtwo.mjs';
function room(){const r=createRoom('me',{mode:'bigtwo',capacity:4,name:'我',role:0,value:500},1000);for(let i=0;i<3;i++)command(r,'me',{kind:'addBot'},1000);r.seats.forEach(s=>s.bank=1000000);command(r,'me',{kind:'start'},1000);const lead=r.game.turn;[r.game.hands[0],r.game.hands[lead]]=[r.game.hands[lead],r.game.hands[0]];r.game.turn=0;return r}
test('autoplay is reversible, persists, retains identity and does not close the room',()=>{
 let r=room();const before=r.game.actions.length;command(r,'me',{kind:'autoplay',enabled:true},1000);assert.equal(r.seats[0].bot,false);assert.equal(r.seats[0].auth,'me');assert.equal(r.closeAfterRound,undefined);assert.equal(snapshot(r,'me',1000).seats[0].autoplay,true);
 r=unpack(pack(r));assert.equal(r.seats[0].autoplay,true);tick(r,2200);assert.equal(r.game.actions.length,before+1);
 command(r,'me',{kind:'autoplay',enabled:false},2300);r.game.turn=0;r.nextAt=3000;const count=r.game.actions.length;tick(r,3000);assert.equal(r.game.actions.length,count);assert.equal(snapshot(r,'me',3000).seats[0].autoplay,false);
 const m=r.game.legal(0)[0];command(r,'me',{kind:'act',seq:r.seq,ids:m?.cards.map(c=>c.id)??[]},3000);assert.equal(r.game.actions.length,count+1);
});
test('autoplay rejects manual moves and non-boolean toggle, resets on next round',()=>{
 const r=room();assert.throws(()=>command(r,'me',{kind:'autoplay',enabled:'yes'},1000));command(r,'me',{kind:'autoplay',enabled:true},1000);const m=r.game.legal(0)[0];assert.throws(()=>command(r,'me',{kind:'act',seq:r.seq,ids:m.cards.map(c=>c.id)},1000),/取消托管/);
 let now=1000;for(let n=0;n<400&&r.status==='playing';n++)tick(r,now+=2000);assert.equal(r.status,'roundEnd');assert.equal(r.seats[0].ready,false);command(r,'me',{kind:'next'},now+5000);assert.equal(r.round,2);assert.equal(r.seats[0].autoplay,false);
});
test('new stake choices are 50 to 500 while existing tables retain agreed legacy stakes',()=>{
 assert.deepEqual(CARD_VALUES,[50,100,150,200,250,300,350,400,450,500]);assert.equal(normalizeValue(10),50);assert.equal(normalizeValue(999),500);
 const r=room();r.value=20;r.match.value=20;r.seats[0].autoplay=true;let now=1000;for(let n=0;n<400&&r.status==='playing';n++)tick(r,now+=2000);assert.equal(r.match.result.value,20);assert.equal(snapshot(r,'me',now).game.value,20);command(r,'me',{kind:'next'},now+5000);assert.equal(r.match.value,20);
});
