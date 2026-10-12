// Reproducible paired full-hand matches: the control (production strategy, dist/strategy.mjs)
// and the candidate (dist/strategy-lab.mjs with given flags) each play the SAME deals from the
// same seat against the same frozen opponents with the same random streams.
//   node scripts/match-poker-paired.mjs <hands> <players> <pool:v127|human> <offset> '<candidate flags JSON>'
// Seat = seed mod n, dealer = floor(seed / n) mod n, so seats and positions rotate evenly.
// Stacks reset to 100 BB every hand. Results are in BB; once a hand reaches an all-in runout,
// the realised board is replaced by the expected result over the remaining boards (exact for
// one or two cards to come, 400 sampled boards otherwise), for both policies alike.
// Report: candidate minus control BB/100 with 95% CI over hands, by position, by the street
// where the two policies first diverged, each policy's own BB/100 and fold frequencies.
import fs from 'node:fs';
import {Poker} from '../dist/poker.mjs';
import {decide as control} from '../dist/strategy.mjs';
import {decide as lab} from '../dist/strategy-lab.mjs';
import {decide as v127} from '../tests/fixtures/poker-strategy-v127.mjs';
import {humanDecide,HUMAN_OPPONENT_NAMES} from '../tests/fixtures/poker-human-opponents.mjs';
const [handsArg,playersArg,pool,offsetArg,flagsArg='{"foldModel":true}']=process.argv.slice(2);
const hands=Number(handsArg),players=Number(playersArg),offset=Number(offsetArg),flags=JSON.parse(flagsArg),BB=20,SAMPLES=100;
if(pool!=='v127'&&pool!=='human')throw Error('pool must be v127 or human');
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
const POS={2:['BTN/SB','BB'],3:['BTN','SB','BB'],4:['BTN','SB','BB','UTG']};
function play(seed,usesLab){
 const seat=seed%players,dealer=Math.floor(seed/players)%players,profiles=Array.from({length:players},(_,i)=>(seed+i)%9);
 const types=Array.from({length:players},(_,i)=>HUMAN_OPPONENT_NAMES[profiles[i]%HUMAN_OPPONENT_NAMES.length]);
 const g=new Poker(Array(players).fill(2000),{dealer,rng:rng(seed*7919+337)}),streams=Array.from({length:players},(_,i)=>rng(seed*17+i+1));
 let ev=null,steps=0,k=0;const trace=[];let foldStreet=null,raised=0,raisesFolded=0,opened=null;
 while(!g.done){
  if(!g.pending.size){if(ev===null&&g.runout)ev=allInEV(g,seat);g.advance();continue}
  const i=g.turn,s=g.snapshot(i);let d;
  if(i===seat){const base=seed*100003+k*31,opts={samples:SAMPLES,rng:rng(base),equityRng:rng(base^0x5bd1e995)};
   d=usesLab?lab(s,profiles[i],{...opts,searchBudgetMs:1000,...flags}):control(s,profiles[i],opts);k++;
   trace.push(g.street+':'+d.action+(d.target??''));if(d.action==='fold')foldStreet=g.street;if(d.action==='raise')raised++;}
  else d=pool==='v127'?v127(s,profiles[i],{samples:SAMPLES,rng:streams[i]}):humanDecide(types[i],s,streams[i]);
  g.act(i,d.action,d.target);if(++steps>300)throw Error('loop');
 }
 const net=((ev??g.players[seat].chips)-2000)/BB;
 return{net,trace,foldStreet,position:POS[players][(seat-dealer+players)%players],endStreet:g.street,showdown:g.showdown,raised};
}
const rows=[];const started=Date.now();
for(let h=1;h<=hands;h++){const seed=offset+h,a=play(seed,false),b=play(seed,true);
 let div=-1;for(let j=0;j<Math.max(a.trace.length,b.trace.length);j++)if(a.trace[j]!==b.trace[j]){div=Number((a.trace[j]??b.trace[j]).split(':')[0]);break}
 rows.push({hand:seed,position:a.position,diverged:div,a:a.net,b:b.net,aFold:a.foldStreet,bFold:b.foldStreet});
 if(h%1000===0)console.error(JSON.stringify({hands:h,elapsedS:Math.round((Date.now()-started)/1000)}));
}
const stat=xs=>{const n=xs.length;if(!n)return{n:0};const m=xs.reduce((s,x)=>s+x,0)/n,sd=Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,n-1)),se=sd/Math.sqrt(n);return{n,bbPer100:+(m*100).toFixed(2),ci95:[+((m-1.96*se)*100).toFixed(2),+((m+1.96*se)*100).toFixed(2)]}};
const by=(f)=>{const m={};for(const r of rows){const k=f(r);(m[k]??=[]).push(r)}return m};
const STREET=['preflop','flop','turn','river'];
const foldFreq=(rs,k)=>{const f=[0,0,0,0];let n=0;for(const r of rs){n++;if(r[k]!==null)f[r[k]]++}return{hands:n,foldedPreflop:+(f[0]/n).toFixed(4),foldedFlop:+(f[1]/n).toFixed(4),foldedTurn:+(f[2]/n).toFixed(4),foldedRiver:+(f[3]/n).toFixed(4)}};
const report={players,pool,hands,offset,candidate:flags,samples:SAMPLES,
 candidateMinusControl:stat(rows.map(r=>r.b-r.a)),
 control:stat(rows.map(r=>r.a)),candidate_:stat(rows.map(r=>r.b)),
 handsDiverged:rows.filter(r=>r.diverged>=0).length,
 byPosition:Object.fromEntries(Object.entries(by(r=>r.position)).map(([k,v])=>[k,{diff:stat(v.map(r=>r.b-r.a)),control:stat(v.map(r=>r.a)),candidate:stat(v.map(r=>r.b))}])),
 byFirstDivergenceStreet:Object.fromEntries(Object.entries(by(r=>r.diverged<0?'none':STREET[r.diverged])).map(([k,v])=>[k,{diffPer100AllHands:+(v.reduce((s,r)=>s+r.b-r.a,0)/rows.length*100).toFixed(2),...stat(v.map(r=>r.b-r.a))}])),
 foldFrequency:{control:foldFreq(rows,'aFold'),candidate:foldFreq(rows,'bFold')},
 elapsedSeconds:Math.round((Date.now()-started)/1000)};
report.candidate=report.candidate_;delete report.candidate_;report.candidateFlags=flags;
fs.mkdirSync('.build/poker-validation',{recursive:true});
fs.writeFileSync(`.build/poker-validation/match-${players}p-${pool}-${offset}.json`,JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
