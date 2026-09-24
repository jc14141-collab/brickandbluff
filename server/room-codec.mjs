import {BigTwo,BigTwoMatch} from '../dist/bigtwo.mjs';
// Versioned persistence codec. Functions are runtime dependencies, not saved state.
import {Poker} from '../dist/poker.mjs';
import {Guandan,GuandanMatch} from '../dist/guandan.mjs';
import {Craps,restoreCraps} from '../dist/craps.mjs';
function encode(value,path,ancestors=new Set()){
 if(value===undefined)return{$codec:'undefined'};
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Invalid saved number at '+path);return value}
 if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')throw Error('Unsupported saved value at '+path);
 if(ancestors.has(value))throw Error('Circular saved state at '+path);
 ancestors.add(value);let result;
 const child=(v,k)=>encode(v,path+'.'+k,ancestors);
 if(value instanceof Set)result={$set:[...value].map((v,i)=>child(v,i))};
 else if(value instanceof Map)result={$codec:'map',value:[...value].map(([k,v],i)=>[child(k,i+'key'),child(v,i)])};
 else if(value instanceof Date){if(!Number.isFinite(value.getTime()))throw Error('Invalid saved date at '+path);result={$codec:'date',value:value.toISOString()}}
 else if(Array.isArray(value))result=value.map(child);
 else {const proto=Object.getPrototypeOf(value);if(![Object.prototype,null,BigTwo.prototype,BigTwoMatch.prototype,Poker.prototype,Guandan.prototype,GuandanMatch.prototype,Craps.prototype].includes(proto))throw Error('Unsupported saved object at '+path);const fields={};for(const [k,v]of Object.entries(value)){if(path==='room.match'&&(k==='random'||k==='game'))continue;fields[k]=child(v,k)}result=(Object.hasOwn(fields,'$codec')||Object.hasOwn(fields,'$set'))?{$codec:'object',value:fields}:fields}
 ancestors.delete(value);return result;
}
function decode(value){
 if(value===null||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(decode);
 if(Array.isArray(value.$set))return new Set(value.$set.map(decode));
 switch(value.$codec){
 case 'undefined':return undefined;
 case 'set':return new Set(value.value.map(decode));
 case 'map':return new Map(value.value.map(([k,v])=>[decode(k),decode(v)]));
 case 'date':return new Date(value.value);
 case 'object':return Object.fromEntries(Object.entries(value.value).map(([k,v])=>[k,decode(v)]));
 default:return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
 }
}
export function serializeRoom(room){return JSON.stringify({...encode(room,'room'),storageVersion:1})}
export function restoreRoom(text,random){
 const raw=JSON.parse(text);if(raw.storageVersion!==undefined&&raw.storageVersion!==1)throw Error('Unsupported room storage version');
 // Read existing production saves, then upgrade only when that room is saved.
 const r=raw.storageVersion===1?decode(raw):JSON.parse(text,(_,v)=>v&&typeof v==='object'&&Array.isArray(v.$set)?new Set(v.$set):v);
 delete r.storageVersion;
 if(r.game){
  if(r.mode==='blackjack'){r.game.nextAt??=r.nextAt;r.game.deadline??=r.deadline}
  if(r.mode==='poker'){if(!Array.isArray(r.game.players)||!(r.game.pending instanceof Set))throw Error('Invalid poker save');r.game=Object.assign(Object.create(Poker.prototype),{smallBlind:10,bigBlind:20},r.game)}
  if(r.mode==='guandan'){if(!Array.isArray(r.game.hands)||!r.match)throw Error('Invalid guandan save');r.game=Object.assign(Object.create(Guandan.prototype),r.game);r.match=Object.assign(Object.create(GuandanMatch.prototype),r.match,{random,game:r.game})}
  if(r.mode==='bigtwo'){if(!Array.isArray(r.game.hands)||!r.match)throw Error('Invalid bigtwo save');r.game=Object.assign(Object.create(BigTwo.prototype),r.game);r.match=Object.assign(Object.create(BigTwoMatch.prototype),r.match,{random,game:r.game})}
  if(r.mode==='craps')r.game.tables=r.game.tables.map(restoreCraps);
 }
 return r;
}
