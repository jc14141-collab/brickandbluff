// Bounded public-information search for solo practice. Opponents are sampled
// independently from unseen cards; no actual opponent cards or human identity enter.
import {BigTwo,newDeck,moves,power,bracketMultiplier,twoMultiplier,settle} from './bigtwo.mjs';
import {chooseMove} from './bigtwo-strategy.mjs';
const strength=m=>m.tier*100+m.power*4+m.suit;
function rollout(s){
 const legal=moves(s.hand,s.target,s.opts,s.opening);if(!legal.length)return null;
 const finish=legal.find(m=>m.size===s.hand.length);if(finish)return finish;
 const closest=Math.min(...s.counts.filter((n,i)=>i!==s.seat&&n>0));
 if(s.target?.size===1&&((s.owner>=0&&s.counts[s.owner]<=2)||s.counts[(s.seat+1)%4]===1))return legal.sort((a,b)=>strength(b)-strength(a))[0];
 const score=m=>{const rest=s.hand.filter(c=>!m.cards.some(x=>x.id===c.id));return m.size*8-strength(m)*.05+Math.log2((1+s.hand.length*bracketMultiplier(s.hand.length)*twoMultiplier(s.hand))/(1+rest.length*bracketMultiplier(rest.length)*twoMultiplier(rest)))*12};
 return legal.sort((a,b)=>score(b)-score(a)||strength(a)-strength(b))[0];
}
export function choosePracticeMove(s,{rng=Math.random,samples=6}={}){
 const base=chooseMove(s),legal=moves(s.hand,s.target,s.opts,s.opening);
 if(!legal.length||base?.size===s.hand.length)return base;
 // A known last-card danger must never be relaxed by noisy samples.
 if(s.target?.size===1&&(s.counts[(s.seat+1)%4]===1||s.owner>=0&&s.counts[s.owner]<=2))return base;
 const seen=new Set([...s.hand,...(s.actions??[]).flatMap(a=>a.cards??[]),...(s.target?.cards??[])].map(c=>c.r+':'+c.s));
 const pool=newDeck(()=>.5).filter(c=>!seen.has(c.r+':'+c.s));
 if(pool.length!==s.counts.reduce((n,c,i)=>n+(i===s.seat?0:c),0))return base;
 const candidates=[],add=m=>{if(!candidates.some(x=>x===m||x&&m&&x.key===m.key))candidates.push(m)};
 add(base);
 // Compare efficient disposal, minimum sufficient cover and control-heavy cover.
 add([...legal].sort((a,b)=>b.size-a.size||strength(a)-strength(b))[0]);
 add([...legal].sort((a,b)=>strength(a)-strength(b))[0]);
 add([...legal].sort((a,b)=>strength(b)-strength(a))[0]);
 if(candidates.length<2)return base;
 const results=candidates.map(()=>({profit:0,wins:0}));
 for(let n=0;n<Math.max(1,Math.min(12,samples));n++){
  const shuffled=[...pool];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
  let offset=0;const hands=s.counts.map((count,i)=>{if(i===s.seat)return s.hand;const h=shuffled.slice(offset,offset+count);offset+=count;return h});
  for(let k=0;k<candidates.length;k++){
   const g=new BigTwo({hands,first:s.seat,opening:s.opening,opts:s.opts});g.target=s.target;g.owner=s.owner;g.pending=new Set([0,1,2,3].filter(i=>i!==s.owner));const history=s.actions??[];let lastPlay=history.length-1;while(lastPlay>=0&&history[lastPlay].pass)lastPlay--;for(const a of history.slice(lastPlay+1))if(a.pass)g.pending.delete(a.seat);
   const chosen=candidates[k];g.act(s.seat,chosen?.cards.map(c=>c.id)??[]);
   let steps=0;while(!g.done&&steps++<120){const m=rollout(g.snapshot(g.turn));g.act(g.turn,m?.cards.map(c=>c.id)??[])}
   if(!g.done)continue;
   const net=settle(g,50).scores[s.seat]/50;
   // Net-profit probability matters, alongside bounded expected income and loss.
   results[k].wins+=net>0?1:net<0?-1:0;results[k].profit+=Math.max(-60,Math.min(60,net));
  }
 }
 let best=0;for(let i=1;i<results.length;i++)if(results[i].wins*12+results[i].profit>results[best].wins*12+results[best].profit+8)best=i;
 return candidates[best];
}
