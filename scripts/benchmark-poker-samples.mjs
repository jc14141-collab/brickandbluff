// Equity sample count, v127 vs itself: does a bot that estimates equity with more
// Monte Carlo samples win more chips? Paired seat-rotated fixed deals, reset 100 BB.
// Also reports an all-in EV adjusted result: once a hand reaches an all-in runout, the
// realised board is replaced by the expected chip result over remaining boards.
// Usage: node scripts/benchmark-poker-samples.mjs <groups> <opponentSamples> <challengerSamples> [offset] [players]
import {Poker} from '../dist/poker.mjs';
import {decide as v127} from '../tests/fixtures/poker-strategy-v127.mjs';
const [pairs=600,sa=100,sb=1200,offset=0,players=2]=process.argv.slice(2).map(Number);
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
const key=c=>c.r+c.s;
function clone(g){const c=Object.create(Poker.prototype);Object.assign(c,g);c.players=g.players.map(p=>({...p,cards:p.cards.slice(),history:[]}));c.board=g.board.slice();c.events=[];c.actions=[];c.pending=new Set();return c}
function allInEV(g,seat,boards=400){
 const seen=new Set([...g.players.flatMap(p=>p.cards),...g.board].map(key));
 const full=[];for(const s of ['♠','♥','♣','♦'])for(let r=2;r<=14;r++)if(!seen.has(r+s))full.push({r,s});
 const need=5-g.board.length;let total=0,n=0;const R=rng(97+g.board.length*13+g.players[0].cards[0].r);
 const run=board=>{const c=clone(g);c.board=board;c.street=3;c.finish();total+=c.players[seat].chips;n++};
 if(need===0)run(g.board.slice());
 else if(need<=2){for(let a=0;a<full.length;a++){if(need===1){run([...g.board,full[a]]);continue}for(let b=a+1;b<full.length;b++)run([...g.board,full[a],full[b]])}}
 else for(let k=0;k<boards;k++){const pool=full.slice(),b=g.board.slice();for(let j=0;j<need;j++)b.push(pool.splice(Math.floor(R()*pool.length),1)[0]);run(b)}
 return total/n;
}
const start=2000*players/players,rows=[];let allins=0;
for(let s=1;s<=pairs;s++){const dealSeed=s+offset;const legs=[],adj=[];
 for(let chal=0;chal<players;chal++){
  const g=new Poker(Array(players).fill(2000),{dealer:dealSeed%players,rng:rng(dealSeed*7919+337)}),random=Array.from({length:players},(_,i)=>rng(dealSeed*17+i+1));
  let ev=null,steps=0;
  while(!g.done){if(!g.pending.size){if(ev===null&&g.runout){ev=allInEV(g,chal);allins++}g.advance();continue}
   const i=g.turn,snap=g.snapshot(i),d=v127(snap,(dealSeed+i)%9,{samples:i===chal?sb:sa,rng:random[i]});g.act(i,d.action,d.target);if(++steps>200)throw Error('loop')}
  const net=(g.players[chal].chips-2000)/20;legs.push(net);adj.push(ev===null?net:(ev-2000)/20);
 }
 rows.push({raw:legs.reduce((a,b)=>a+b,0)/players,adj:adj.reduce((a,b)=>a+b,0)/players});
}
const stat=xs=>{const m=xs.reduce((a,b)=>a+b,0)/xs.length,v=xs.reduce((a,x)=>a+(x-m)**2,0)/(xs.length-1),se=Math.sqrt(v/xs.length);return{bbPer100:+(m*100).toFixed(2),ci95:[+((m-1.96*se)*100).toFixed(2),+((m+1.96*se)*100).toFixed(2)],sd:+Math.sqrt(v).toFixed(3)}};
console.log(JSON.stringify({players,pairs,hands:pairs*players,challengerSamples:sb,opponentSamples:sa,allinRunouts:allins,raw:stat(rows.map(r=>r.raw)),allInAdjusted:stat(rows.map(r=>r.adj))},null,1));
