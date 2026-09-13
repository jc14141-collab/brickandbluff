import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';
import {passwordHash} from '../server/access.mjs';
function db(){const sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')))sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));return{prepare(query){return{bind(...args){return{async first(){return sql.prepare(query).get(...args)},async all(){return{results:sql.prepare(query).all(...args)}},async run(){return{meta:{changes:sql.prepare(query).run(...args).changes}}}}}}}}}
const origin='https://game.example';
test('deployed Worker contract serves assets, restricts API writes and isolates four-game sessions',async()=>{
 const salt='ab'.repeat(16),env={DB:db(),ACCESS_PASSWORD_HASH:salt+':'+await passwordHash('test-entry',salt),ACCESS_SESSION_KEY:'cd'.repeat(32),ADMIN_PASSWORD_HASH:salt+':'+await passwordHash('test-admin-password',salt)};assert.equal((await worker.fetch(new Request(origin+'/'),env)).status,200);const accessCookie='unused=1';let requestCounter=0;
 const jars=new Map();let prefix='';
 const request=async(path,identity,body)=>{const key=prefix+identity;const jar=jars.get(key)||new Map();jar.set(accessCookie.split('=')[0],accessCookie);const res=await worker.fetch(new Request(origin+path,{method:body?'POST':'GET',headers:{cookie:[...jar.values()].join('; '),'oai-authenticated-user-id':key,origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);const set=res.headers.get('set-cookie');if(set)jar.set(set.split('=')[0],set.split(';')[0]);jars.set(key,jar);return res};
 const register=async(name)=>{let res=await request('/api/session',name);assert.equal(res.status,200);const data=await res.json();await request('/api/profile',name,{name:prefix+name});assert.equal((await request('/api/rooms',name)).status,400);return data.player.id};
 const action=async(id,identity,body)=>{const res=await request('/api/rooms/'+id,identity,{...body,requestId:(++requestCounter).toString(16).padStart(32,'0')});assert.equal(res.status,200,await res.clone().text());return res.json()};
 assert.equal((await request('/','host')).status,200);assert.equal((await request('/server/index.js','host')).status,404);
 const font=await request('/art/fusion-pixel.woff2','host');assert.equal(font.status,200);assert.equal(font.headers.get('content-type'),'font/woff2');assert.equal(new TextDecoder().decode(new Uint8Array(await font.arrayBuffer()).slice(0,4)),'wOF2');assert.equal((await request('/voxel-hud.css','host')).status,200);
 assert.equal((await worker.fetch(new Request(origin+'/api/rooms',{method:'POST',headers:{cookie:accessCookie,origin:'https://other.example','content-type':'application/json'},body:'{}'}),env)).status,403);
 const guest=await worker.fetch(new Request(origin+'/api/session',{headers:{cookie:accessCookie}}),env);assert.match(guest.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 for(const mode of ['poker','blackjack','craps','guandan','roulette']){
 prefix=mode;const hostId=await register('host'),friendId=await register('friend'),strangerId=await register('stranger');assert.equal((await request('/api/admin','friend')).status,403);assert.equal((await request('/api/admin/login','host',{password:'test-admin-password'})).status,200);for(const id of [hostId,friendId,strangerId]){const allowed=await request('/api/admin','host',{kind:'permission',id,status:'allowed',requestId:(++requestCounter).toString(16).padStart(32,'0')});assert.equal(allowed.status,200)}
 const res=await request('/api/rooms','host',{mode,capacity:4,name:'Host',role:0});assert.equal(res.status,200);let room=await res.json();const directory=await(await request('/api/rooms','friend')).json();assert(directory.rooms.some(r=>r.id===room.id&&r.joinable));assert(!JSON.stringify(directory).includes('platform:'));assert(directory.rooms.every(r=>!('game' in r)));
 room=await action(room.id,'friend',{kind:'join',name:'Friend',role:2});assert.equal(room.you,1);
 await action(room.id,'friend',{kind:'ready',ready:true});await action(room.id,'host',{kind:'addBot',role:1});await action(room.id,'host',{kind:'addBot',role:3});room=await action(room.id,'host',{kind:'start'});assert.equal(room.status,'playing');
 const other=await (await request('/api/rooms/'+room.id,'friend')).json(),stranger=await(await request('/api/rooms/'+room.id,'stranger')).json();assert.equal(other.you,1);assert.equal(stranger.game,undefined);assert(!JSON.stringify(other).includes('platform:'));
 if(mode==='poker'){assert.deepEqual(other.game.players[0].cards,[null,null]);assert(other.game.players[1].cards.every(Boolean))}
 if(mode==='guandan')assert.equal(other.game.hand.length,27);
 if(mode==='roulette'){assert.equal(other.game.pocket,null);const bet=await action(room.id,'friend',{kind:'act',action:'bet',key:'s0-00',amount:25});assert.equal(bet.game.players[1].bets['s0-00'],25);for(const asset of ['roulette.mjs','roulette-ui.mjs','roulette3d.mjs','roulette.css'])assert.equal((await request('/'+asset,'host')).status,200)}
 await action(room.id,'host',{kind:'leave'});const transferred=await(await request('/api/rooms/'+room.id,'friend')).json();assert.equal(transferred.host,true);
 }
});
