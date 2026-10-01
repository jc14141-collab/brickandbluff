import {endBigTwoEarly} from '../dist/bigtwo.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {Club} from '../server/club.mjs';
import {unpack,pack} from '../server/rooms.mjs';
import {adminLogin,isAdmin} from '../server/admin-auth.mjs';
import {passwordHash} from '../server/access.mjs';
function fixture(){const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));const db={prepare(q){return{bind(...args){return{async first(){return sql.prepare(q).get(...args)},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}}}}};return{club:new Club(db),db}}
let time=1800000000000;const id=()=>crypto.randomUUID().replaceAll('-','');
async function allow(c,auth='one'){const {player:p}=await c.session(auth,'iPad Safari',time);await c.profile(auth,{name:auth,role:1},time);await c.admin(auth,{kind:'permission',id:p.id,status:'allowed',requestId:id()},time);return p.id}

test('bigtwo departure settles current counts immediately, closes room and refunds once',async()=>{
 const {club:c}=fixture();for(const auth of ['one','friend'])await allow(c,auth);
 const r=await c.create('one',{mode:'bigtwo',capacity:4},time);
 const send=(auth,data)=>c.room(r.id,auth,{...data,requestId:id()},time);
 await send('friend',{kind:'join'});await send('one',{kind:'addBot'});await send('one',{kind:'addBot'});await send('friend',{kind:'ready',ready:true});await send('one',{kind:'start'});
 const expected=await c.change(s=>{const room=unpack(s.rooms[r.id]);room.game.hands.forEach((h,i)=>h.splice([7,9,10,13][i]));s.rooms[r.id]=pack(room);endBigTwoEarly(room.game);const result=room.match.settle(room.seats.map(s=>s.bank));assert.equal(result.bonus,1);assert.equal(result.scores.reduce((a,b)=>a+b,0),0);return room.seats.map((seat,i)=>seat.bank+result.scores[i])});
 const req={kind:'leave',requestId:id()};assert.equal((await c.room(r.id,'one',req,time)).closed,true);
 for(const [i,a]of ['one','friend'].entries()){const p=(await c.session(a,'',time)).player;assert.equal(p.bank,expected[i]);assert.equal(p.activeRoom,null);assert.equal(p.settling,false)}
 await c.room(r.id,'one',req,time);assert.equal((await c.session('one','',time)).player.bank,expected[0]);assert.equal((await c.list('friend',time)).rooms.length,0);
});
test('solo departure with equal remaining counts refunds immediately without autoplay',async()=>{
 const {club:c}=fixture();await allow(c);const r=await c.create('one',{mode:'bigtwo',solo:true,capacity:4},time);await c.room(r.id,'one',{kind:'leave',requestId:id()},time);const p=(await c.session('one','',time)).player;assert.equal(p.bank,2000);assert.equal(p.activeRoom,null);assert.equal(p.settling,false);assert.equal((await c.list('one',time)).rooms.length,0)
});
