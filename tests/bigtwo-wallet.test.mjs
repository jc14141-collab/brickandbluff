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

test('bigtwo leaving releases admission immediately and pays escrow once without closing a new room',async()=>{
 const {club:c}=fixture();await allow(c);await allow(c,'friend');let finalBanks;const close=c.closeRoom.bind(c);c.closeRoom=(s,r)=>{if(r.mode==='bigtwo')finalBanks=r.seats.map(x=>x.bank);return close(s,r)};
 let r=await c.create('one',{mode:'bigtwo',capacity:4},time);
 const send=(auth,data,now=time)=>c.room(r.id,auth,{...data,requestId:id()},now);
 await send('friend',{kind:'join'});await send('one',{kind:'addBot'});await send('one',{kind:'addBot'});await send('friend',{kind:'ready',ready:true});await send('one',{kind:'start'});
 await send('one',{kind:'leave'});let p=(await c.session('one','',time)).player;assert.equal(p.activeRoom,null);assert.equal(p.bank,0);
 const info=await c.session('one','',time);assert.equal(info.players.find(x=>x.name==='one').totalChips,2000);
 const admin=await c.admin('friend',null,time);const player=admin.players.find(x=>x.name==='one');await c.admin('friend',{kind:'grant',id:player.id,amount:123,requestId:id()},time);
 const other=await c.create('one',{mode:'roulette',solo:true},time);
 let end;for(let n=1;n<400;n++){end=await c.room(r.id,'friend',null,time+n*2000);if(end.closed)break;if(end.game?.turn===end.you){const raw=await c.change(s=>s.rooms[r.id]);const state=unpack(raw);const m=state.game.legal(end.you)[0];end=await send('friend',{kind:'act',seq:end.seq,ids:m?m.cards.map(c=>c.id):[]},time+n*2000);if(end.closed)break}}
 assert.equal(end.closed,true);const amount=finalBanks[0];assert.equal((await c.session('friend','',time+799999)).player.bank,finalBanks[1]);
 p=(await c.session('one','',time+800000)).player;assert.equal(p.activeRoom,other.id);assert.equal(p.bank,amount);
 await c.room(r.id,'friend',null,time+800001);assert.equal((await c.session('one','',time+800002)).player.bank,amount);
});

test('solo departure preserves escrow and finishes automatically through lobby refresh',async()=>{
 const {club:c}=fixture();await allow(c);let finalBank;const close=c.closeRoom.bind(c);c.closeRoom=(s,r)=>{if(r.mode==='bigtwo')finalBank=r.seats[0].bank;return close(s,r)};
 const r=await c.create('one',{mode:'bigtwo',capacity:4,solo:true},time);
 await c.room(r.id,'one',{kind:'leave',requestId:id()},time);
 const before=(await c.session('one','',time)).player;assert.equal(before.activeRoom,null);assert.equal(before.settling,true);assert.equal(before.tableBank,2000);assert.equal(before.bank,0);
 let p;for(let n=1;n<=30;n++){p=(await c.session('one','',time+n*15000)).player;if(!p.settling)break}
 assert.equal(p.settling,false);assert.equal(p.tableBank,0);assert.equal(p.bank,finalBank);assert.ok(Number.isFinite(finalBank));
 assert.equal((await c.list('one',time+500000)).rooms.length,0);
 assert.equal((await c.session('one','',time+501000)).player.bank,finalBank);
});
