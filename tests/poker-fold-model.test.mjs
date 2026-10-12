import test from 'node:test';
import assert from 'node:assert/strict';
import {Poker} from '../dist/poker.mjs';
import {raiseFoldRate,raiseFoldRates} from '../dist/poker-fold-model.mjs';
import {decide as labDecide} from '../dist/strategy-lab.mjs';
import {humanDecide,HUMAN_OPPONENT_NAMES} from './fixtures/poker-human-opponents.mjs';
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
test('rule-based human-like opponents only take legal actions and conserve chips',()=>{
 for(const name of HUMAN_OPPONENT_NAMES)for(const players of [2,4,6])for(let s=1;s<=40;s++){
  const stacks=Array.from({length:players},(_,i)=>i===s%players?150+s*7:2000),total=stacks.reduce((a,b)=>a+b,0);
  const g=new Poker(stacks,{dealer:s%players,rng:rng(s*13+players)}),r=rng(s*7);let k=0;
  while(!g.done){if(!g.pending.size){g.advance();continue}const d=humanDecide(name,g.snapshot(g.turn),r);g.act(g.turn,d.action,d.target);assert.ok(++k<300)}
  assert.equal(g.players.reduce((n,p)=>n+p.chips,0),total);
 }
});
test('fold model returns a probability and never reads hidden cards',()=>{let checked=0;
 for(const players of [2,4])for(let s=1;s<=30;s++){const g=new Poker(Array(players).fill(2000),{dealer:s%players,rng:rng(s*29+players)});let k=0;
  while(!g.done&&k<200){if(!g.pending.size){g.advance();continue}const i=g.turn,snap=g.snapshot(i);
   for(const p of snap.players)Object.defineProperty(p,'cards',{get(){throw Error('hidden cards read')}});
   Object.defineProperty(snap,'deck',{get(){throw Error('deck read')}});
   if(snap.legal.canRaise){const to=Math.min(snap.legal.max,Math.max(snap.legal.min,snap.current*3||snap.bigBlind*3)),f=raiseFoldRate(snap,{to});if(f!==null){assert.ok(f>=0&&f<=1);checked++}}
   const d=labDecide(g.snapshot(i),(s+i)%9,{samples:40,rng:rng(s*100+k),foldModel:true});g.act(i,d.action,d.target);k++}}
 assert.ok(checked>50);
});
test('fold model hook only changes raise evaluation, and only when enabled',()=>{let n=0;
 for(let s=1;s<=30;s++){const g=new Poker([2000,2000,2000,2000],{dealer:s%4,rng:rng(s*41)});let k=0;
  while(!g.done&&k<200){if(!g.pending.size){g.advance();continue}const i=g.turn,snap=g.snapshot(i);
   const a=labDecide(snap,(s+i)%9,{samples:40,rng:rng(s*1000+k)}),b=labDecide(snap,(s+i)%9,{samples:40,rng:rng(s*1000+k),foldModel:true});
   assert.equal(a.equity,b.equity);if(!snap.legal.canRaise){assert.equal(a.action,b.action);assert.equal(a.target,b.target)}n++;
   g.act(i,a.action,a.target);k++}}
 assert.ok(n>100);
});
test('all-fold rate is the product of the per-opponent fold rates (independence assumption)',()=>{let n=0;
 for(const players of [3,4])for(let s=1;s<=20;s++){const g=new Poker(Array(players).fill(2000),{dealer:s%players,rng:rng(s*53+players)});let k=0;
  while(!g.done&&k<200){if(!g.pending.size){g.advance();continue}const i=g.turn,snap=g.snapshot(i);
   if(snap.legal.canRaise){const to=snap.legal.min,rates=raiseFoldRates(snap,{to}),all=raiseFoldRate(snap,{to});
    if(rates===null)assert.equal(all,0);else{assert.ok(rates.every(r=>r.fold>=0&&r.fold<=1&&r.seat!==i));assert.equal(all,rates.length?rates.reduce((p,r)=>p*r.fold,1):null);n++}}
   const d=labDecide(g.snapshot(i),(s+i)%9,{samples:40,rng:rng(s*77+k)});g.act(i,d.action,d.target);k++}}
 assert.ok(n>30);
});
