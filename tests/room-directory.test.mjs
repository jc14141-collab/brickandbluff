import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {RoomStore} from '../server/store.mjs';
import {blackjackLayout,blackjackSeat} from '../dist/room-game.mjs';
import {RoomDirectory} from '../dist/multiplayer.mjs';
test('room directory exposes only public metadata, supports all games and hides abandoned rooms',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../drizzle/0000_cheerful_longshot.sql',import.meta.url),'utf8'));
 const store=new RoomStore({prepare(q){return{bind(...args){return{async first(){return sql.prepare(q).get(...args)},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}}}}});
 const now=1000000;
 for(const mode of ['poker','blackjack','craps','guandan'])await store.create('secret-host',{mode,capacity:4,name:'Host',role:0},now);
 let list=await store.list('friend',now);assert.equal(list.rooms.length,4);assert(list.rooms.every(r=>r.joinable&&!r.member));assert(!JSON.stringify(list).includes('secret-host'));assert(list.rooms.every(r=>Object.keys(r).sort().join(',')==='capacity,count,id,joinable,member,mode,name,status'));
 assert((await store.list('secret-host',now)).rooms.every(r=>r.member));assert.equal((await store.list('friend',now+120001)).rooms.length,0);
 const id=list.rooms[0].id;await store.room(id,'secret-host',{kind:'leave',requestId:'a'.repeat(32)},now);assert.equal((await store.list('friend',now)).rooms.length,3);sql.close();
});
test('blackjack remote hands sit near their owners for two through six seats',()=>{
 for(let count=2;count<=6;count++){const players=Array.from({length:count},()=>({hands:[{cards:[{r:3,s:'♠'},{r:8,s:'♣'}]}]})),layout=blackjackLayout(players,[]);
 for(let i=1;i<count;i++){const seat=blackjackSeat(count,i),cards=layout.filter(c=>c.key.startsWith('p'+i+'h'));const x=cards.reduce((s,c)=>s+c.x,0)/cards.length,z=cards[0].z;assert(Math.hypot(x-seat.x,z-seat.z)<2.6);assert.equal(Math.sign(x),Math.sign(seat.x));assert(z<1.6)}
 }
});
test('fixed Guandan CSS coordinates cannot override poker head projections',()=>{
 const css=fs.readFileSync(new URL('../dist/table-polish.css',import.meta.url),'utf8');for(const rule of css.matchAll(/([^{}]+)\{[^{}]*(?:left|top):[^{}]*!important[^{}]*\}/g)){if(rule[1].includes('data-seat-label'))assert(rule[1].split(',').every(s=>s.trim().startsWith('.gd-room ')))}
});
test('late directory responses cannot replace a page after joining',async()=>{
 const original=globalThis.fetch;let resolve;globalThis.fetch=()=>new Promise(r=>resolve=r);const host={innerHTML:'original'};
 try{const d=new RoomDirectory(host,()=>{});d.destroy();resolve({ok:true,json:async()=>({rooms:[]})});await new Promise(r=>setImmediate(r));assert.equal(host.innerHTML,'original');assert.equal(d.timer,undefined)}finally{globalThis.fetch=original}
});
