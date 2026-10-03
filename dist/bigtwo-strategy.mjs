// Only own cards and public history are used. No opponent-hand sampling or hidden state.
import {allMoves,beats,isLeadCard,power,suitPower,bracketMultiplier,twoMultiplier} from './bigtwo.mjs';
const bomb=m=>m.type==='four'||m.type==='straightflush';
const twos=cards=>cards.filter(c=>c.r===2).length;
const strength=m=>m.tier*100+m.power*4+m.suit;

// Exact minimum partition of at most 13 cards: preserve useful combinations instead
// of greedily breaking them. Each memoized subproblem consumes its first card.
function planner(hand,all){
 const bit=new Map(hand.map((c,i)=>[c.id,1<<i])),full=(1<<hand.length)-1;
 const entries=all.map(m=>({m,mask:m.cards.reduce((n,c)=>n|bit.get(c.id),0)}));
 const byCard=hand.map((_,i)=>entries.filter(e=>e.mask&(1<<i)));
 const memo=new Int8Array(full+1);memo.fill(-1);memo[0]=0;
 function turns(mask){if(memo[mask]>=0)return memo[mask];const first=31-Math.clz32(mask&-mask);let best=13;for(const e of byCard[first])if((mask&e.mask)===e.mask)best=Math.min(best,1+turns(mask^e.mask));return memo[mask]=best}
 return{entries,full,turns,remaining:mask=>hand.filter((_,i)=>mask&(1<<i))};
}

export function chooseMove(s){
 if(!s.hand?.length)return null;
 const all=allMoves(s.hand),legal=all.filter(m=>beats(m,s.target,s.opts)&&(!s.opening||m.cards.some(isLeadCard)));
 if(!legal.length)return null;
 const finish=legal.find(m=>m.size===s.hand.length);if(finish)return finish;
 const opponents=s.counts.filter((n,i)=>i!==s.seat&&n>0),closest=Math.min(...opponents);
 const next=(s.seat+1)%s.counts.length,oneLeft=s.counts[next]===1;
 const ownerDanger=s.owner>=0&&s.owner!==s.seat&&s.counts[s.owner]<=2;
 // Preserve the strongest legal single against the next player's last card.
 if((oneLeft||ownerDanger)&&s.target?.size===1)return legal.sort((a,b)=>strength(b)-strength(a))[0];
 const p=planner(s.hand,all),initialTurns=p.turns(p.full),nTwo=twos(s.hand);
 const monsterEntries=p.entries.filter(e=>bomb(e.m)),monsters=monsterEntries.map(e=>e.m),high=s.hand.filter(c=>power(c.r)>=13).length;
 const strong=nTwo>=3||(monsters.length>0&&(nTwo>0||high>=3))||(nTwo>=2&&initialTurns<=5);
 const weak=nTwo<=1&&monsters.length===0&&high<=2&&initialTurns>=6;
 const urgent=closest<=3,seen=new Set([...(s.actions??[]).flatMap(a=>a.cards??[]),...s.hand].map(c=>c.r+':'+c.s));
 // An unbeaten single is known only when every higher card is ours or publicly played.
 const singleControl=m=>m.size===1&&![2,14,13,12,11,10,9,8,7,6,5,4,3].some(r=>['♦','♣','♥','♠'].some(suit=>!seen.has(r+':'+suit)&&(power(r)>m.power||power(r)===m.power&&suitPower(suit)>m.suit)));
 function score(e){
  const m=e.m,mask=p.full^e.mask,rest=p.remaining(mask),left=rest.length,k=twos(m.cards),turns=p.turns(mask);
  let value=(initialTurns-turns)*13+m.size*2-strength(m)*.018;
  // Settlement is pairwise: reduce both remaining count and retained-2 multiplier.
  const exposure=s.hand.length*bracketMultiplier(s.hand.length)*twoMultiplier(s.hand);
  const after=left*bracketMultiplier(left)*twoMultiplier(rest);
  value+=Math.log2((1+exposure)/(1+after))*(weak||urgent?16:4);
  if(s.hand.length>=10&&left<=9)value+=weak?28:12;
  if(m.size===5)value+=s.target?5:10;
  if(!s.target&&closest<=2&&m.size===5)value+=12;
  // Three/four 2s are separate control tickets unless a pair finishes or blocks danger.
  if(nTwo>=3&&m.type==='pair'&&k>0&&!urgent)value-=32;
  if(k){value-=strong?14*k:6*k;if(singleControl(m))value+=strong?18:10;if(weak||urgent)value+=12*k;}
  // Keep a monster intact and reachable as the final five cards when there is time.
  const kept=monsterEntries.filter(e=>(mask&e.mask)===e.mask);
  if(kept.length&&!urgent)value+=left===5?42:strong?14:7;
  if(bomb(m)&&!urgent)value-=strong?28:15;
  if(!bomb(m)&&monsters.length&&!kept.length&&!urgent)value-=20;
  // A single must be high enough when the next player has reported one card.
  if(!s.target&&oneLeft&&m.size===1)value+=strength(m)*.9;
  // Once a guaranteed control card takes the trick, account for the next lead.
  if(singleControl(m))value+=Math.max(0,4-turns)*5;
  return value;
 }
 const legalSet=new Set(legal),ranked=p.entries.filter(e=>legalSet.has(e.m)).map(e=>({...e,value:score(e)})).sort((a,b)=>b.value-a.value||strength(a.m)-strength(b.m)||a.mask-b.mask);
 const pick=ranked[0];
 if(s.target&&!urgent&&!ownerDanger){
  // Passing is allowed only when protection is worth more than the immediate reduction.
  // Never hoard a weak hand's lone 2, nor sit on 10+ cards near another player's finish.
  const protectedMove=(twos(pick.m.cards)>0||bomb(pick.m));
  if(protectedMove&&!weak&&s.hand.length<10&&!strong&&p.turns(p.full^pick.mask)>=2)return null;
  if(bomb(pick.m)&&strong&&p.turns(p.full^pick.mask)>=2)return null;
 }
 return pick.m;
}
