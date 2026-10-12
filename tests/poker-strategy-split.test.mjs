import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Poker} from '../dist/poker.mjs';
import {decide} from '../dist/strategy.mjs';
import {decide as labDecide} from '../dist/strategy-lab.mjs';
import {decide as v127} from './fixtures/poker-strategy-v127.mjs';
import {SERVER_POKER_SAMPLES} from '../server/rooms.mjs';
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
const same=(a,b)=>a.action===b.action&&a.target===b.target&&a.equity===b.equity;
test('production strategy does not import experimental models',()=>{
 const source=fs.readFileSync(new URL('../dist/strategy.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/^import .*poker-(range|planning|river-value|multiway|response|behavior)/m);
 assert.doesNotMatch(source,/^import[^\n]*strategy-lab/m);
});
test('production default, lab default and pinned v127 make identical decisions',()=>{
 let n=0;
 for(const players of [2,4,6])for(let s=1;s<=40;s++){
  const g=new Poker(Array(players).fill(2000),{dealer:s%players,rng:rng(s*31+players)});let k=0;
  while(!g.done&&k<200){if(!g.pending.size){g.advance();continue}
   const i=g.turn,snap=g.snapshot(i),seed=s*1000+k,profile=(s+i)%9;
   const a=decide(snap,profile,{samples:60,rng:rng(seed)}),b=v127(snap,profile,{samples:60,rng:rng(seed)}),c=labDecide(snap,profile,{samples:60,rng:rng(seed)});
   assert.ok(same(a,b),'production differs from v127');assert.ok(same(a,c),'lab default differs from production');n++;
   g.act(i,a.action,a.target);k++}}
 assert.ok(n>300);
});
test('server bot sample count stays at 100 until a confirmed improvement',()=>{assert.equal(SERVER_POKER_SAMPLES,100)});
