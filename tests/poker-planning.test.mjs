import test from 'node:test';import assert from 'node:assert/strict';
import {Poker} from '../dist/poker.mjs';import {decide,PROFILES} from '../dist/strategy-lab.mjs';
import {decide as old} from './fixtures/poker-strategy-v127.mjs';
import {opponentRange,clearRangeCache,rangeCacheSize,handFeatures} from '../dist/poker-range.mjs';
import {planHeadsUp} from '../dist/poker-planning.mjs';
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
function turn(seed=1){const g=new Poker([2000,2000],{rng:rng(seed)});while(g.street<2){while(g.pending.size)g.act(g.turn,g.legal().owe?'call':'check');g.advance()}return g}
test('default production policy remains identical to the pinned old strategy',()=>{for(let n=1;n<=20;n++){const g=turn(n),s=g.snapshot(g.turn);assert.deepEqual(decide(s,n%9,{samples:30,rng:rng(n)}),old(s,n%9,{samples:30,rng:rng(n)}))}});
test('public range recognizes larger raises and never reads hidden cards',()=>{const g=turn(),s=g.snapshot(g.turn),v=1-s.seat;for(const p of s.players)Object.defineProperty(p,'cards',{get(){throw Error('private cards read')}});Object.defineProperty(s,'deck',{get(){throw Error('deck read')}});const average=r=>r.entries.reduce((n,x)=>n+x.weight*handFeatures(x.hand,[]).strength,0)/r.total;
 s.actions=[{seat:v,street:0,kind:'raise',to:50,amount:40,pot:70}];const low=opponentRange(s,v);s.actions=[{seat:v,street:0,kind:'raise',to:300,amount:290,pot:320}];const high=opponentRange(s,v);assert(average(high)>average(low));assert(high.entries.every(x=>!x.hand.some(c=>[...s.hole,...s.board].some(k=>c.r===k.r&&c.s===k.s))));
 const planned=planHeadsUp(s,PROFILES[0],{rng:rng(4),budgetMs:1000});assert(planned?.search.nodes>0);
});
test('range cache is bounded and includes each action amount',()=>{clearRangeCache();const s=turn().snapshot(0);for(let n=0;n<60;n++){s.actions=[{seat:1,street:0,kind:'raise',to:40+n,amount:30+n,pot:70+n}];opponentRange(s,1)}assert.equal(rangeCacheSize(),48);clearRangeCache()});
test('search budget expiry returns fallback and uses no partial tree',()=>{let t=0;const s=turn().snapshot(0);assert.equal(planHeadsUp(s,PROFILES[0],{nowFn:()=>t+=10,budgetMs:1}),null)});
test('heads-up search stays legal through short stacks and river actions',()=>{let searched=0;for(let seed=1;seed<=18;seed++){const random=rng(seed),g=new Poker([seed%2?80:2000,2000],{rng:random});let steps=0;while(!g.done){if(!g.pending.size){g.advance();continue}const s=g.snapshot(g.turn),d=decide(s,seed%9,{samples:30,rng:random,rangeModel:'public',lookahead:true,searchBudgetMs:1000});if(d.search)searched++;assert(Number.isFinite(d.equity));g.act(g.turn,d.action,d.target);assert(++steps<100)}assert.equal(g.players.reduce((n,p)=>n+p.chips,0),seed%2?2080:4000)}assert(searched>0)});

test('range cache separates public bot styles without requiring private information',()=>{const s=turn(3).snapshot(0);s.players[1].publicStyle=2;const loose=opponentRange(s,1);s.players[1].publicStyle=3;const tight=opponentRange(s,1);assert.notStrictEqual(loose,tight);s.players[1].publicStyle=2;assert.strictEqual(opponentRange(s,1),loose)});
