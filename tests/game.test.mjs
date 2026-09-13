import assert from 'node:assert/strict';
import {Poker} from '../dist/poker.mjs';
import {deck,fastRank,compare} from '../dist/engine.mjs';
import {decide,equity,PROFILES} from '../dist/strategy.mjs';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const sum=a=>a.reduce((n,v)=>n+v,0);
let hands=0,sidePots=0;
for(let count=4;count<=10;count++)for(let n=0;n<140;n++){
 const rng=random(19000+count*1000+n),stacks=Array.from({length:count},()=>20+Math.floor(rng()*1981)),total=sum(stacks),dealer=n%count;
 const g=new Poker(stacks,{dealer,rng});
 assert.equal(g.players.length,count);assert.equal(g.turn,(dealer+3)%count);
 assert.equal(new Set(g.players.flatMap(p=>p.cards.map(c=>c.r+c.s))).size,count*2);
 const snapshot=g.snapshot(g.turn);assert(!JSON.stringify(snapshot.players).includes('cards'));assert(!('deck' in snapshot));
 let steps=0;
 while(!g.done){assert(++steps<600);if(!g.pending.size){g.advance();continue}const i=g.turn,l=g.legal(i),choice=rng();
  if(choice<.18&&l.owe)g.act(i,'fold');else if(choice<.44&&l.canRaise)g.act(i,'raise',rng()<.35?l.max:Math.min(l.max,l.min+Math.floor(rng()*150)));else g.act(i,l.owe?'call':'check');
  assert(g.players.every(p=>p.chips>=0&&Number.isInteger(p.chips)));
  if(!g.done)assert.equal(sum(g.players.map(p=>p.chips+p.total)),total);
 }
 assert.equal(sum(g.players.map(p=>p.chips)),total);assert.equal(g.paid.length,count);assert.equal(sum(g.paid),sum(g.pots.map(p=>p.amount)));
 if(g.pots.length>1)sidePots++;
 for(const pot of g.pots)for(const i of pot.winners)assert(!g.players[i].fold);
 hands++;
}
// Incomplete all-ins do not reopen a player who already called a full raise.
const g=new Poker([1000,130,1000,1000],{dealer:0,rng:random(9)});
g.act(3,'raise',100);g.act(0,'call');g.act(1,'allin');g.act(2,'call');
assert.equal(g.turn,3);assert.equal(g.legal(3).canRaise,false);g.act(3,'call');assert.equal(g.legal(0).canRaise,false);
// Public royal flush ties every live player, independently of sampled holdings.
const board=[10,11,12,13,14].map(r=>({r,s:'♠'}));
for(const count of [4,7,10]){const g=new Poker(Array(count).fill(2000));const s=g.snapshot(0);s.board=board;s.hole=[{r:2,s:'♥'},{r:3,s:'♦'}];s.street=3;assert(Math.abs(equity(s,50,random(2))-1/count)<1e-10)}
// Strategy actions must remain legal over table sizes and stages, including short stacks.
let decisions=0;
for(const count of [4,7,10])for(let n=0;n<9;n++){
 const rng=random(n+count*10),g=new Poker(Array.from({length:count},(_,i)=>i===1?45:1000),{dealer:n%count,rng});
 while(!g.done){if(!g.pending.size){g.advance();continue}const d=decide(g.snapshot(g.turn),n,{samples:60,rng});assert(Number.isFinite(d.equity));g.act(g.turn,d.action,d.target);decisions++;}
}
assert.equal(PROFILES.length,9);assert.equal(new Set(PROFILES.map(p=>p.name)).size,9);
console.log(JSON.stringify({hands,sidePots,legalAIDecisions:decisions,tableSizes:'4–10',result:'passed'}));
