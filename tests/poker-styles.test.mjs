import test from 'node:test';
import assert from 'node:assert/strict';
import {Poker} from '../dist/poker.mjs';
import {decide,PROFILES,randomProfile} from '../dist/strategy.mjs';
import {createRoom,command,pack,unpack,snapshot} from '../server/rooms.mjs';
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
test('bot style is assigned on addition, survives serialization and is shown in the lobby',()=>{
 assert.equal(new Set(Array.from({length:9},(_,i)=>randomProfile(()=>(i+.5)/9))).size,9);
 const r=createRoom('host',{name:'Host',role:0,mode:'poker',capacity:4});for(let i=0;i<3;i++)command(r,'host',{kind:'addBot',role:i});
 const profiles=r.seats.slice(1).map(s=>s.aiProfile);assert(profiles.every(n=>Number.isInteger(n)&&PROFILES[n]));assert.deepEqual(unpack(pack(r)).seats.slice(1).map(s=>s.aiProfile),profiles);assert.deepEqual(snapshot(r,'host').seats.slice(1).map(s=>s.style),profiles.map(n=>PROFILES[n].label));
 command(r,'host',{kind:'start'});assert.deepEqual(r.seats.slice(1).map(s=>s.aiProfile),profiles);
});
test('loose aggressive and passive styles make measurably different legal choices',()=>{
 const stats=Object.fromEntries([1,2,3,5].map(i=>[i,{raise:0,play:0}]));
 for(let n=0;n<90;n++){const g=new Poker([2000,2000,2000,2000],{rng:rng(n+1)}),s=g.snapshot(g.turn);for(const i of [1,2,3,5]){const a=decide(s,i,{samples:30,rng:rng(n+123)});if(a.action==='raise'){assert(a.target>=s.legal.min&&a.target<=s.legal.max);stats[i].raise++}if(a.action!=='fold')stats[i].play++}}
 assert(stats[1].raise>stats[2].raise);assert(stats[3].raise>stats[5].raise);assert(stats[1].play>stats[3].play);console.log('Style comparison:',stats);
});
