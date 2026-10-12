import {responseRates,raiseSizeRates} from './poker-response.mjs';
import {fastRank} from './engine.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));

export const cardKey=c=>c.r+c.s;
export const cards=[];for(const s of ['♠','♥','♣','♦'])for(let r=2;r<=14;r++)cards.push({r,s});
export function startingStrength(h){const hi=Math.max(h[0].r,h[1].r),lo=Math.min(h[0].r,h[1].r),gap=hi-lo;return clamp((hi+lo-4)/28*.62+(hi===lo?.32:0)+(h[0].s===h[1].s?.07:0)+(gap<=2?.06:0)+(hi===14?.08:0)-(gap>4?.09:0))}
export function handFeatures(h,board,knownRank){
 if(board.length<3)return{strength:startingStrength(h),draw:0};
 const rank=knownRank??fastRank([...h,...board]),cat=rank[0],high=rank[1]??2;
 const scales=[.12,.42,.64,.75,.80,.86,.94,.98,1];
 let strength=clamp(scales[cat]+(cat<4?(high-2)/12*.13:0));
 // A paired board alone is much weaker than pairing a hole card.
 if(cat===1&&!h.some(c=>c.r===high))strength-=.15;
 const all=[...h,...board],ranks=new Set(all.flatMap(c=>c.r===14?[14,1]:[c.r]));
 let straight=0;for(let start=1;start<=10;start++){let n=0;for(let i=0;i<5;i++)n+=ranks.has(start+i)?1:0;if(n===4)straight=1}
 const flush=['♠','♥','♣','♦'].some(s=>all.filter(c=>c.s===s).length===4&&h.some(c=>c.s===s));
 const draw=board.length<5?Math.max(flush?.75:0,straight?.5:0):0;
 return{strength:clamp(strength),draw};
}
const cache=new Map(),LIMIT=48;
export function clearRangeCache(){cache.clear()}
export function rangeCacheSize(){return cache.size}
export function opponentRange(snapshot,seat,{cacheEnabled=true}={}){
 // Explicit public projection: never serialize or inspect opponent cards/deck.
 const history=(snapshot.actions??[]).map(a=>[a.seat,a.street,a.kind,a.amount,a.to,a.pot]);
 const key=JSON.stringify([snapshot.seat,seat,snapshot.dealer,snapshot.bigBlind,snapshot.players.length,snapshot.hole,snapshot.board,snapshot.players.map(p=>[p.publicStyle??null,p.styleBelief??null]),history]);
 if(cacheEnabled&&cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit}
 const known=new Set([...snapshot.hole,...snapshot.board].map(cardKey));const pool=cards.filter(c=>!known.has(cardKey(c)));
 const count=snapshot.players.length,bb=snapshot.bigBlind??20,bets=Array(count).fill(0);bets[count===2?snapshot.dealer:(snapshot.dealer+1)%count]=bb/2;bets[count===2?(snapshot.dealer+1)%count:(snapshot.dealer+2)%count]=bb;
 let street=0,current=bb,raises=0;const actions=[];for(const a of snapshot.actions??[]){if(a.street!==street){street=a.street;current=0;raises=0;bets.fill(0)}if(a.seat===seat){const pos=street===0?(seat-snapshot.dealer+count)%count:(seat-snapshot.dealer-1+count)%count;actions.push({...a,facingRaises:raises,price:Math.max(0,current-bets[seat]),beforePot:Math.max(bb,(a.pot??0)-(a.amount??0)),inPosition:street===0?pos===0||pos===count-1:pos===count-1})}bets[a.seat]=a.to??bets[a.seat];if(a.kind==='raise'){current=a.to;raises++}}
 for(const a of actions){a.board=snapshot.board.slice(0,a.street===0?0:a.street===1?3:a.street===2?4:5);a.sizeRates=Array.from({length:8},(_,bucket)=>[0,1].map(draw=>raiseSizeRates({street:a.street,strength:(bucket+.5)/8,draw,price:a.price,pot:a.beforePot,inPosition:a.inPosition,facingRaises:a.facingRaises,publicStyle:snapshot.players[seat].publicStyle,styleBelief:snapshot.players[seat].styleBelief})));a.rates=Array.from({length:8},(_,bucket)=>[0,1].map(draw=>responseRates({street:a.street,strength:(bucket+.5)/8,draw,price:a.price,pot:a.beforePot,inPosition:a.inPosition,facingRaises:a.facingRaises,publicStyle:snapshot.players[seat].publicStyle,styleBelief:snapshot.players[seat].styleBelief})))}
 let total=0;const entries=[];for(let i=0;i<pool.length-1;i++)for(let j=i+1;j<pool.length;j++){
  const hand=[pool[i],pool[j]],features=[];let weight=1;
  for(const a of actions){const f=features[a.street]??(features[a.street]=handFeatures(hand,a.board)),probs=a.rates[Math.min(7,Math.floor(f.strength*8))][f.draw>0?1:0];weight*=Math.max(.015,probs[a.kind==='raise'?2:a.kind==='fold'?0:1]);if(a.kind==='raise'){const fraction=Math.max(0,(a.amount??0)-a.price)/Math.max(1,a.beforePot+a.price);weight*=Math.max(.03,a.sizeRates[Math.min(7,Math.floor(f.strength*8))][f.draw>0?1:0][fraction<=.65?0:fraction<=1.2?1:2]);const pressure=a.street===0?Math.max(0,(a.to??0)/bb-3)*.025:Math.max(0,(a.amount??0)/a.beforePot-.5)*.3;weight*=Math.pow(.15+.85*f.strength,Math.min(1.5,pressure))}}
  weight=Math.max(1e-8,weight);total+=weight;entries.push({hand,weight,cumulative:total});
 }
 const result={entries,total,pool};if(cacheEnabled){cache.set(key,result);while(cache.size>LIMIT)cache.delete(cache.keys().next().value)}return result;
}
export function sampleRange(range,rng){const x=rng()*range.total;let lo=0,hi=range.entries.length-1;while(lo<hi){const m=(lo+hi)>>1;if(range.entries[m].cumulative<x)lo=m+1;else hi=m}return range.entries[lo].hand}
