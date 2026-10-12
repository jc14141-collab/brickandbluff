// Decision-level paired evaluation: only the decisions where two policies disagree.
//
// Full-hand A/B benchmarks spend almost all of their hands on decisions where both
// policies do the same thing, so the confidence interval is dominated by card luck.
// Here the hand is played by the incumbent policy (A). At every decision of the
// evaluated seat we ask both A and B what they would do. When they disagree we branch:
// from the identical state, A's action and B's action are each played to the end of the
// hand (A keeps playing A, B keeps playing B, every other seat uses the baseline bot),
// and this is repeated with freshly dealt future board cards. Both branches of a
// rollout share the same future board and the same decision random streams, so the
// difference is not diluted by card luck. Hidden hole cards are fixed to the real
// deal, as in the actual game; nothing about them reaches either policy.
//
// Random streams: the evaluated policies get two independent streams per decision, one
// for equity sampling (equityRng) and one for action mixing (rng). A and B share both
// seeds, so when only the sample count differs, the action-mixing draws stay aligned and
// a disagreement reflects a different equity estimate rather than a reshuffled draw.
//
// Only the FIRST disagreement in a hand is branched. With aligned streams A and B play
// the same moves up to that point, and from it each branch plays its own policy to the
// end, so the branch difference is exactly B's minus A's result for that hand (with the
// future board resampled). Later disagreements are counted but not branched again, which
// would double-count B's continuation.
//
// Usage:
//   node scripts/eval-poker-decisions.mjs <hands> <players> '<A options JSON>' '<B options JSON>' [rollouts=24] [offset=0] [opponents=v127]
// opponents: v127 (pinned old bot, default), human (the five rule-based human-like
// opponents from tests/fixtures/poker-human-opponents.mjs, rotating by seat), or one name.
// Example (round-5 river model vs the same configuration without it, heads-up):
//   node scripts/eval-poker-decisions.mjs 3000 2 '{"rangeModel":"public"}' '{"rangeModel":"public","riverValue":true}' 24 900000
// Options are passed to dist/strategy-lab.mjs decide(); "samples" defaults to 100.
// Output: disagreements, hands affected, chip gain of B over A per 100 hands with
// a 95% interval over hands, and the mean gain per affected hand (BB).
import fs from 'node:fs';
import {Poker} from '../dist/poker.mjs';
import {decide as lab} from '../dist/strategy-lab.mjs';
import {decide as baseline} from '../tests/fixtures/poker-strategy-v127.mjs';
import {humanDecide,HUMAN_OPPONENT_NAMES} from '../tests/fixtures/poker-human-opponents.mjs';
const [handsArg,playersArg,aArg='{}',bArg='{}',rolloutsArg,offsetArg,opponentsArg='v127']=process.argv.slice(2);
const hands=Number(handsArg??500),players=Number(playersArg??2),A=JSON.parse(aArg),B=JSON.parse(bArg),K=Number(rolloutsArg??24),offset=Number(offsetArg??0);
const STACK=2000,BB=20,baseSamples=100;
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
const key=c=>c.r+c.s;
const policy=(opts)=>(snap,profile,r,er)=>lab(snap,profile,{samples:baseSamples,searchBudgetMs:1000,...opts,rng:r,equityRng:er});
const polA=policy(A),polB=policy(B);
const opponents=opponentsArg;if(opponents!=='v127'&&opponents!=='human'&&!HUMAN_OPPONENT_NAMES.includes(opponents))throw Error('unknown opponents: '+opponents);
const other=(snap,profile,r)=>opponents==='v127'?baseline(snap,profile,{samples:baseSamples,rng:r}):humanDecide(opponents==='human'?HUMAN_OPPONENT_NAMES[profile%HUMAN_OPPONENT_NAMES.length]:opponents,snap,r);
function clone(g,futureDeck){
 const c=Object.create(Poker.prototype);Object.assign(c,g);
 c.players=g.players.map(p=>({...p,cards:p.cards.slice(),history:p.history.slice()}));
 c.board=g.board.slice();c.actions=g.actions.slice();c.events=[];c.pending=new Set(g.pending);c.deck=futureDeck;
 return c;
}
function unseen(g){const seen=new Set([...g.players.flatMap(p=>p.cards),...g.board].map(key));const out=[];for(const s of ['♠','♥','♣','♦'])for(let r=2;r<=14;r++)if(!seen.has(r+s))out.push({r,s});return out}
function shuffle(xs,r){const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function finishHand(g,seat,first,pol,profiles,streams,equityStreams){
 g.act(seat,first.action,first.target);let steps=0;
 while(!g.done){if(!g.pending.size){g.advance();continue}const i=g.turn,snap=g.snapshot(i),d=i===seat?pol(snap,profiles[i],streams[i],equityStreams[i]):other(snap,profiles[i],streams[i]);g.act(i,d.action,d.target);if(++steps>200)throw Error('nonterminating rollout')}
 return g.players[seat].chips;
}
const same=(x,y)=>x.action===y.action&&(x.target??null)===(y.target??null);
const perHand=[];let decisions=0,disagreements=0,branchedHands=0,changedByStreet=[0,0,0,0];const examples=[];
const started=Date.now();
for(let h=1;h<=hands;h++){
 const seed=h+offset,seat=seed%players,profiles=Array.from({length:players},(_,i)=>(seed+i)%9);
 const g=new Poker(Array(players).fill(STACK),{dealer:seed%players,rng:rng(seed*7919+337)}),streams=Array.from({length:players},(_,i)=>rng(seed*17+i+1));
 let handGain=0,steps=0,branched=false;
 while(!g.done){
  if(!g.pending.size){g.advance();continue}
  const i=g.turn,snap=g.snapshot(i);
  if(i!==seat){const d=other(snap,profiles[i],streams[i]);g.act(i,d.action,d.target);if(++steps>200)throw Error('loop');continue}
  decisions++;
  const s0=seed*100003+steps*31,EQ=0x5bd1e995,a=polA(snap,profiles[i],rng(s0),rng(s0^EQ)),b=polB(g.snapshot(i),profiles[i],rng(s0),rng(s0^EQ));
  if(!same(a,b))disagreements++;
  if(!same(a,b)&&!branched){
   branched=true;branchedHands++;changedByStreet[g.street]++;let diff=0;
   for(let k=0;k<K;k++){
    const future=shuffle(unseen(g),rng(s0*7+k*104729+1));
    const mk=()=>Array.from({length:players},(_,j)=>rng(s0*13+k*7+j*101+5)),mkE=()=>Array.from({length:players},(_,j)=>rng((s0*13+k*7+j*101+5)^EQ));
    const chipsA=finishHand(clone(g,future.slice()),i,a,polA,profiles,mk(),mkE());
    const chipsB=finishHand(clone(g,future.slice()),i,b,polB,profiles,mk(),mkE());
    diff+=(chipsB-chipsA)/BB;
   }
   handGain+=diff/K;
   if(examples.length<12)examples.push({hand:seed,street:g.street,A:a.action+(a.target?' '+a.target:''),B:b.action+(b.target?' '+b.target:''),gainBB:+(diff/K).toFixed(2)});
  }
  g.act(i,a.action,a.target);if(++steps>200)throw Error('loop');
 }
 perHand.push(handGain);
 if(h%200===0)console.error(JSON.stringify({hands:h,disagreements,elapsedS:Math.round((Date.now()-started)/1000)}));
}
const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const m=mean(perHand),sd=Math.sqrt(perHand.reduce((s,x)=>s+(x-m)**2,0)/Math.max(1,perHand.length-1)),se=sd/Math.sqrt(perHand.length);
const report={
 metric:'chip gain of policy B over policy A per hand; each hand is branched at its first disagreement and both branches play their own policy to the end, sharing future boards and random streams',
 players,hands,rollouts:K,offset,opponents,A,B,decisions,disagreements,disagreementRate:+(disagreements/Math.max(1,decisions)).toFixed(4),handsWithDisagreement:branchedHands,firstDisagreementByStreet:{preflop:changedByStreet[0],flop:changedByStreet[1],turn:changedByStreet[2],river:changedByStreet[3]},
 gainPer100Hands:+(m*100).toFixed(2),ci95Per100Hands:[+((m-1.96*se)*100).toFixed(2),+((m+1.96*se)*100).toFixed(2)],
 gainPerAffectedHandBB:branchedHands?+(m*hands/branchedHands).toFixed(3):0,
 examples,
 limitations:'Opponents are the v127 bot family with fixed random profiles; one-hand horizon with reset stacks; hidden hole cards fixed to the real deal; not evidence about human opponents.',
 elapsedSeconds:Math.round((Date.now()-started)/1000)
};
fs.mkdirSync('.build/poker-training',{recursive:true});
fs.writeFileSync(`.build/poker-training/decisions-${players}p-${hands}-${offset}-${opponents}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
