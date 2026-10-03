import test from 'node:test';import assert from 'node:assert/strict';
import {chooseMove} from '../dist/bigtwo-strategy.mjs';import {BigTwo,classify,beats,settle,newDeck} from '../dist/bigtwo.mjs';
let id=0;const c=(r,s='♦')=>({id:id++,r,s});
const view=(hand,extra={})=>({hand,seat:0,counts:[hand.length,9,11,8],target:null,owner:-1,opening:false,actions:[],...extra});
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
test('multiple 2s remain single control tickets instead of being paired away',()=>{
 const hand=[c(2,'♦'),c(2,'♣'),c(2,'♥'),c(2,'♠'),c(4),c(6),c(8),c(10),c(12),c(14)];
 const m=chooseMove(view(hand,{target:classify([c(14,'♠')]),owner:1}));assert.equal(m?.size,1);assert.equal(m?.rank,2);
});
test('weak scattered hand gets rid of lone low 2 while it can',()=>{
 const hand=[c(2),c(3,'♣'),c(5,'♥'),c(7,'♠'),c(9),c(11,'♣'),c(12,'♥')];
 const m=chooseMove(view(hand,{target:classify([c(14,'♠')]),owner:1}));assert.equal(m?.rank,2);
});
test('discard five-card combinations to cross the ten-card penalty boundary',()=>{
 const hand=[c(3),c(4,'♣'),c(5,'♥'),c(6,'♠'),c(7),c(8,'♣'),c(10,'♥'),c(11,'♠'),c(12),c(13,'♣')];
 assert.equal(chooseMove(view(hand)).size,5);
});
test('keep a reachable monster as final five, then finish for the bonus',()=>{
 const hand=[c(7,'♦'),c(7,'♣'),c(7,'♥'),c(7,'♠'),c(3),c(2,'♠')];
 const m=chooseMove(view(hand));assert.equal(m.size,1);assert.equal(m.rank,2);
 const rest=hand.filter(c=>!m.cards.includes(c));assert.equal(chooseMove(view(rest)).type,'four');
});
test('reported single in next seat forces strongest single including suit tie-break',()=>{
 const hand=[c(5),c(14,'♦'),c(14,'♠')];const s=view(hand,{counts:[3,1,9,8],target:classify([c(4)]),owner:2});
 assert.equal(chooseMove(s).cards[0].s,'♠');
});
test('bombs only beat single 2 when the existing room rule allows it',()=>{
 const hand=[c(7,'♦'),c(7,'♣'),c(7,'♥'),c(7,'♠'),c(3)],target=classify([c(2,'♠')]);
 assert.equal(chooseMove(view(hand,{target,owner:1})),null);
 assert.equal(chooseMove(view(hand,{target,owner:1,opts:{bombBeatsTwo:true}})).type,'four');
});
test('public snapshot only, deterministic and bounded across 200 seeded full games',()=>{
 let decisions=0,maxMs=0;const start=performance.now();
 for(let n=1;n<=200;n++){
  const g=new BigTwo({random:rng(n*7919)});let turns=0;
  while(!g.done&&turns++<300){const v=g.snapshot(g.turn);Object.defineProperty(v,'hands',{get(){throw Error('private hands')}});const time=performance.now(),m=chooseMove(v);maxMs=Math.max(maxMs,performance.now()-time);if(m){assert(beats(m,v.target,v.opts));assert.equal(new Set(m.cards.map(c=>c.id)).size,m.size);assert(m.cards.every(c=>v.hand.some(h=>h.id===c.id)))}else assert(v.target);g.act(g.turn,m?.cards.map(c=>c.id)??[]);decisions++}
  assert(g.done);const result=settle(g);assert.equal(result.scores.reduce((a,b)=>a+b,0),0);assert(result.scores.every(Number.isInteger));
 }
 console.log({decisions,elapsedMs:Math.round(performance.now()-start),maxDecisionMs:Math.round(maxMs)});
});
