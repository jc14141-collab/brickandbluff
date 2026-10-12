// Calibration of opponent-range and fold-rate predictions against what fixed opponent pools
// actually do. Measures predictions, not winnings.
//   node scripts/calibrate-poker-ranges.mjs <hands> <players> <pool:v127|human> <offset> [--out file]
// The evaluated seat plays the production strategy (dist/strategy.mjs, samples 100). At each
// of its decisions we record, for every live opponent:
//   - range: probability the legacy range (production rangeWeight, restated below) and the lab
//     public-action range (dist/poker-range.mjs opponentRange) give to the opponent's actual
//     hand, and to its strength bucket; uniform range as the reference point.
// Whenever the evaluated seat raises we record the fold predictions for that raise size:
//   - legacy: baseFold per opponent and baseFold^(n-1) for everyone folding, restated from
//     dist/strategy.mjs decide() (not available for unopened preflop pots, where production
//     uses its entry policy and no fold estimate);
//   - model: dist/poker-fold-model.mjs raiseFoldRates (per opponent) and their product,
// then play on and record each opponent's first response to that raise (fold or not) and
// whether everyone folded. Opponents' cards come from the real deal; neither predictor sees them.
import fs from 'node:fs';
import {Poker} from '../dist/poker.mjs';
import {decide,preflop} from '../dist/strategy.mjs';
import {fastRank} from '../dist/engine.mjs';
import {decide as v127} from '../tests/fixtures/poker-strategy-v127.mjs';
import {humanDecide,HUMAN_OPPONENT_NAMES} from '../tests/fixtures/poker-human-opponents.mjs';
import {opponentRange,handFeatures} from '../dist/poker-range.mjs';
import {raiseFoldRates} from '../dist/poker-fold-model.mjs';
const args=process.argv.slice(2),[hands,players]=[Number(args[0]),Number(args[1])],pool=args[2],offset=Number(args[3]);
const outIdx=args.indexOf('--out'),out=outIdx>=0?args[outIdx+1]:`.build/poker-validation/calibration-${players}p-${pool}-${offset}.json`;
if(pool!=='v127'&&pool!=='human')throw Error('pool must be v127 or human');
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
const key=c=>c.r+c.s;
const FULL=[];for(const s of ['♠','♥','♣','♦'])for(let r=2;r<=14;r++)FULL.push({r,s});
// Restated from dist/strategy.mjs (rangeWeight): production's legacy opponent weighting.
function legacyWeight(h,p,board){let s=preflop(h),raises=p.history.filter(a=>a.kind==='raise'),pre=raises.filter(a=>a.street===0).length,w=.15+.85*s;if(pre)w*=Math.pow(.08+.92*s,1+pre);if(p.history.some(a=>a.kind==='call'&&a.street===0))w*=.35+.65*s;if(board.length>=3&&raises.some(a=>a.street>0)){let cat=fastRank([...h,...board])[0];w*=cat>=2?1:cat===1?.7:.28}return Math.max(.004,w)}
// Restated from dist/strategy.mjs decide(): fixed fold formula for a raise to `to`.
function legacyFold(s,to){const l=s.legal,p=s.players[s.seat],n=s.players.length,active=s.players.filter(q=>!q.fold).length;
 const pot=Math.max(s.bigBlind??20,s.players.reduce((sum,q)=>sum+Math.min(q.total,p.total+l.call),0)),owe=l.call,position=(s.seat-s.dealer+n)%n,onButton=position===0,last=s.lastAggressor===s.seat;
 const blocker=s.hole.some(c=>c.r===14)||s.hole.some(c=>c.r>=12&&s.board.filter(b=>b.s===c.s).length>=3);
 const aggressive=s.actions.filter(a=>a.street===s.street&&a.kind==='raise').length,ratio=(to-s.current)/(pot+owe);
 const base=Math.min(.72,Math.max(.08,.16+ratio*.21+(onButton?.07:0)+(s.street===0?(preflop(s.hole)>.7?.12:0):(last?.07:0))+(blocker?.08:0)+(active===2?.09:-.06)-aggressive*.065));
 const allIn=s.players.some((q,i)=>i!==s.seat&&!q.fold&&!q.chips);
 return{perOpponent:base,all:allIn?0:Math.pow(base,active-1)}}
const bucketOf=(h,board)=>Math.min(7,Math.floor(handFeatures(h,board).strength*8));
function rangeStats(weights,pool,actualIdx,board,actualBucket){
 let total=0;const mass=new Float64Array(8);for(let i=0;i<weights.length;i++){total+=weights[i];mass[pool.b[i]]+=weights[i]}
 for(let b=0;b<8;b++)mass[b]/=total;
 return{logp:Math.log(weights[actualIdx]/total),bucketP:mass[actualBucket],mass:[...mass]}}
function seqOf(s){const raises=s.actions.filter(a=>a.street===s.street&&a.kind==='raise').length;
 if(s.street===0){const calls=s.actions.filter(a=>a.street===0&&a.kind==='call').length;return raises===0?(calls?'iso':'open'):raises===1?'3bet':'4bet+'}
 return raises===0?'bet':'raise'}
function lineOf(s,q){// opponent's own line so far, public
 const h=s.players[q].history,pre=h.filter(a=>a.street===0),pr=pre.filter(a=>a.kind==='raise').length,pc=pre.some(a=>a.kind==='call');
 const preLine=pr>=2?'re-raised':pr===1?'raised':pc?'called':pre.length?'checked':'unacted';
 if(s.street===0)return 'pre:'+preLine;
 const cur=h.filter(a=>a.street===s.street);const now=cur.some(a=>a.kind==='raise')?'bet':cur.some(a=>a.kind==='call')?'called':cur.length?'checked':'unacted';
 return 'pre:'+preLine+'|now:'+now}
const rangeRows=[],raiseRows=[],respRows=[];
const started=Date.now();
for(let h=1;h<=hands;h++){
 const seed=offset+h,seat=seed%players,profiles=Array.from({length:players},(_,i)=>(seed+i)%9);
 // Seat and dealer rotate independently so every position is covered (seat = seed mod n,
 // dealer = floor(seed / n) mod n).
 const g=new Poker(Array(players).fill(2000),{dealer:Math.floor(seed/players)%players,rng:rng(seed*7919+337)}),streams=Array.from({length:players},(_,i)=>rng(seed*17+i+1));
 const types=Array.from({length:players},(_,i)=>HUMAN_OPPONENT_NAMES[profiles[i]%HUMAN_OPPONENT_NAMES.length]);
 const other=(snap,i)=>pool==='v127'?v127(snap,profiles[i],{samples:100,rng:streams[i]}):humanDecide(types[i],snap,streams[i]);
 let open=null,steps=0;// pending raise awaiting responses
 while(!g.done){
  if(!g.pending.size){if(open)close(open,g);open=null;g.advance();continue}
  const i=g.turn,s=g.snapshot(i);
  if(i!==seat){const d=other(s,i);
   if(open&&open.waiting.has(i)){open.waiting.delete(i);respRows.push({hand:seed,seat:i,type:pool==='human'?types[i]:'v127',fold:d.action==='fold'?1:0,afterReRaise:open.reRaised?1:0,legacy:open.legacy?.perOpponent??null,model:open.model?.[i]??null,street:open.street,seq:open.seq,line:open.lines[i],players})}
   if(open&&d.action==='raise')open.reRaised=true;
   g.act(i,d.action,d.target);if(++steps>300)throw Error('loop');continue}
  if(open){close(open,g);open=null}
  // range calibration for every live opponent
  const known=new Set([...s.hole,...s.board].map(key)),cards=FULL.filter(c=>!known.has(key(c)));const pairs=[],b=[];
  for(let a=0;a<cards.length-1;a++)for(let c=a+1;c<cards.length;c++){pairs.push([cards[a],cards[c]]);b.push(bucketOf([cards[a],cards[c]],s.board))}
  const poolInfo={b};
  for(let q=0;q<players;q++){if(q===seat||s.players[q].fold)continue;
   const actual=g.players[q].cards,ak=new Set(actual.map(key)),idx=pairs.findIndex(p=>ak.has(key(p[0]))&&ak.has(key(p[1]))),ab=b[idx];
   const legacy=rangeStats(pairs.map(p=>legacyWeight(p,s.players[q],s.board)),poolInfo,idx,s.board,ab);
   const r=opponentRange(s,q),labW=r.entries.map(e=>e.weight);
   // opponentRange enumerates the same unseen-card pairs in the same order; check it.
   if(r.entries.length!==pairs.length||key(r.entries[idx].hand[0])!==key(pairs[idx][0])||key(r.entries[idx].hand[1])!==key(pairs[idx][1]))throw Error('range order mismatch');
   const lab=rangeStats(labW,poolInfo,idx,s.board,ab);
   rangeRows.push({hand:seed,street:s.street,line:lineOf(s,q),type:pool==='human'?types[q]:'v127',players,uniformLogp:-Math.log(pairs.length),legacyLogp:legacy.logp,labLogp:lab.logp,bucket:ab,legacyBucketP:legacy.bucketP,labBucketP:lab.bucketP,legacyMass:legacy.mass,labMass:lab.mass});
  }
  const sd=decide(s,profiles[i],{samples:100,rng:rng(seed*100003+steps*31),equityRng:rng((seed*100003+steps*31)^0x5bd1e995)});
  if(sd.action==='raise'){
   const unopened=s.street===0&&s.current<=(s.bigBlind??20),rates=raiseFoldRates(s,{to:sd.target}),live=s.players.map((q,j)=>j!==seat&&!q.fold&&q.chips>0?j:-1).filter(j=>j>=0);
   const model=rates?Object.fromEntries(rates.map(r=>[r.seat,r.fold])):null;
   open={hand:seed,street:s.street,seq:seqOf(s),unopened,legacy:unopened?null:legacyFold(s,sd.target),model,modelAll:rates?rates.reduce((p,r)=>p*r.fold,1):0,anyAllIn:rates===null,waiting:new Set(live),opponents:live,folded:new Set(),lines:Object.fromEntries(live.map(j=>[j,lineOf(s,j)])),reRaised:false,raiseIndex:g.actions.length};
  }
  g.act(i,sd.action,sd.target);if(++steps>300)throw Error('loop');
 }
 if(open)close(open,g);
 if(h%500===0)console.error(JSON.stringify({hands:h,rangeRows:rangeRows.length,raises:raiseRows.length,elapsedS:Math.round((Date.now()-started)/1000)}));
}
function close(o,g){// everyone folded = every opponent live at the raise folded before anyone called or raised
 const after=g.actions.slice(o.raiseIndex+1);let all=1;for(const a of after){if(a.seat===g.actions[o.raiseIndex].seat)break;if(o.opponents.includes(a.seat)&&a.kind!=='fold'){all=0;break}}
 const responded=new Set(after.filter(a=>o.opponents.includes(a.seat)).map(a=>a.seat));if(o.opponents.some(j=>!responded.has(j)))all=0;
 raiseRows.push({hand:o.hand,street:o.street,seq:o.seq,unopened:o.unopened,opponents:o.opponents.length,players:g.players.length,anyAllIn:o.anyAllIn,legacyAll:o.legacy?.all??null,modelAll:o.modelAll,allFold:all});
}
fs.mkdirSync('.build/poker-validation',{recursive:true});
fs.writeFileSync(out,JSON.stringify({hands,players,pool,offset,elapsedSeconds:Math.round((Date.now()-started)/1000),rangeRows,raiseRows,respRows}));
console.log(JSON.stringify({out,hands,players,pool,offset,rangeRows:rangeRows.length,raises:raiseRows.length,responses:respRows.length,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
