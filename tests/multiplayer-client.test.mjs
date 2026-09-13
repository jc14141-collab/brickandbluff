import test from 'node:test';
import assert from 'node:assert/strict';
import {Rooms} from '../dist/multiplayer.mjs';
test('changing avatar while editing saves the profile rather than rejoining',async()=>{
 const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,{value:s==='#roomName'?'Friend':'',dataset:{avatar:'3'}});return nodes.get(s)};
 const previous=globalThis.document;globalThis.document={body:{classList:{remove(){}}}};
 try{const client=Object.assign(Object.create(Rooms.prototype),{name:'Friend',role:0,capacity:4,state:{mode:'poker',you:0,seats:[{name:'Friend',role:0}]},host:{innerHTML:'',querySelectorAll:()=>[get('avatar')]},q:get,toast:()=>{}});let sent;client.send=async d=>sent=d;client.editProfile();get('avatar').onclick();await get('[data-profile-submit]').onclick();assert.equal(sent.kind,'profile');assert.equal(sent.role,3)}finally{globalThis.document=previous}
});
test('action response releases the action lock before rendering the next controls',async()=>{
 const c=Object.assign(Object.create(Rooms.prototype),{alive:true,id:'room',state:{seq:7},api:async()=>({seq:8})});c.apply=()=>assert.equal(c.sending,false);await c.send({kind:'act'});assert.equal(c.sending,false)
});
test('late polling response cannot overwrite a newer authoritative view',()=>{
 const c=Object.assign(Object.create(Rooms.prototype),{state:{id:'room',seq:9}});c.apply({id:'room',seq:8});assert.equal(c.state.seq,9)
});
