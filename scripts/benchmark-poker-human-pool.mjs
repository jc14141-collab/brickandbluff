// How hard does a strategy punish common human leaks? The evaluated seat plays the given
// strategy-lab options against three copies of one rule-based opponent type, for every
// type in tests/fixtures/poker-human-opponents.mjs. Reset 100 BB stacks, seat rotates.
// Reports BB/100 per opponent type with a 95% interval, and the minimum across types
// (the "most resistant leak" for this strategy).
// Usage: node scripts/benchmark-poker-human-pool.mjs <hands per type> '<options JSON>' [offset=0] [players=4]
import {Poker} from '../dist/poker.mjs';
import {decide} from '../dist/strategy-lab.mjs';
import {humanDecide,HUMAN_OPPONENT_NAMES} from '../tests/fixtures/poker-human-opponents.mjs';
const [handsArg,optArg='{}',offsetArg,playersArg]=process.argv.slice(2);
const hands=Number(handsArg??1000),opts=JSON.parse(optArg),offset=Number(offsetArg??0),players=Number(playersArg??4);
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
const out={players,handsPerType:hands,options:opts,offset,types:{}};
for(const [t,name] of HUMAN_OPPONENT_NAMES.entries()){
 const xs=[];
 for(let h=1;h<=hands;h++){const seed=h+offset+t*1e6,seat=seed%players;
  const g=new Poker(Array(players).fill(2000),{dealer:seed%players,rng:rng(seed*7919+337)}),streams=Array.from({length:players},(_,i)=>rng(seed*17+i+1));let steps=0;
  while(!g.done){if(!g.pending.size){g.advance();continue}const i=g.turn,s=g.snapshot(i),d=i===seat?decide(s,seed%9,{samples:100,searchBudgetMs:1000,...opts,rng:streams[i]}):humanDecide(name,s,streams[i]);g.act(i,d.action,d.target);if(++steps>200)throw Error('loop')}
  xs.push((g.players[seat].chips-2000)/20)}
 const m=xs.reduce((a,b)=>a+b,0)/xs.length,se=Math.sqrt(xs.reduce((a,x)=>a+(x-m)**2,0)/(xs.length-1)/xs.length);
 out.types[name]={bbPer100:+(m*100).toFixed(1),ci95:[+((m-1.96*se)*100).toFixed(1),+((m+1.96*se)*100).toFixed(1)]};
}
out.minimum=Math.min(...Object.values(out.types).map(x=>x.bbPer100));
console.log(JSON.stringify(out,null,1));
