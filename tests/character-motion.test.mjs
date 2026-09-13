import test from 'node:test';import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mountCharacterMotion} from '../dist/character-motion.mjs';
test('each character displays its existing static room portrait without video playback',()=>{
 const saved=globalThis.document;
 const make=tag=>({tag,children:[],attrs:{},classList:{add(){}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},append(...v){this.children.push(...v)}});
 globalThis.document={createElement:make};
 const files=['witch-room-portrait.jpg','engineer-room-portrait.webp','guardian-room-portrait.webp','ranger-room-portrait.webp'];
 try{for(const role of [0,1,2,3,0]){const host=make('div');mountCharacterMotion(host,role);assert.equal(host.children.length,1);const img=host.children[0];assert.equal(img.tag,'img');assert.equal(img.src,'/media/'+files[role]);assert.ok(existsSync(new URL('../dist'+img.src,import.meta.url)))}}
 finally{globalThis.document=saved}
});
