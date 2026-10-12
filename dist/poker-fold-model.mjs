// Experimental (lab only): fold probability of a raise, from the public-action range of
// each live opponent and the calibrated response model, replacing the fixed formula in
// strategy.mjs. Uses only the snapshot's public information plus our own cards.
import {opponentRange,handFeatures} from './poker-range.mjs';
import {responseRates} from './poker-response.mjs';
const masses=new WeakMap();
// Range mass by (strength bucket, draw) for the current board; cached per range object.
function bucketMass(range,board){
 let cached=masses.get(range);if(cached&&cached.board===board.length)return cached.mass;
 const mass=Array.from({length:8},()=>[0,0]);
 for(const e of range.entries){const f=handFeatures(e.hand,board);mass[Math.min(7,Math.floor(f.strength*8))][f.draw>0?1:0]+=e.weight}
 for(const row of mass){row[0]/=range.total;row[1]/=range.total}
 masses.set(range,{board:board.length,mass});return mass;
}
// Per-opponent fold probabilities for a raise to `to` (seat -> probability), or null when an
// opponent is all-in (the pot stays contested). Exposed for calibration; raiseFoldRate() is the
// product, i.e. it assumes opponents respond independently.
export function raiseFoldRates(snapshot,{to}){
 const me=snapshot.players[snapshot.seat],count=snapshot.players.length,cost=to-me.bet,potAfter=(snapshot.pot??snapshot.players.reduce((n,p)=>n+p.total,0))+cost;
 const raisesThisStreet=(snapshot.actions??[]).filter(a=>a.street===snapshot.street&&a.kind==='raise').length;
 const out=[];
 for(let q=0;q<count;q++){
  const p=snapshot.players[q];if(q===snapshot.seat||p.fold)continue;
  if(!p.chips)return null;
  const price=Math.min(p.chips,Math.max(0,to-p.bet));if(!(price>0)){out.push({seat:q,fold:1});continue}
  const pos=snapshot.street===0?(q-snapshot.dealer+count)%count:(q-snapshot.dealer-1+count)%count,inPosition=snapshot.street===0?pos===0||pos===count-1:pos===count-1;
  const mass=bucketMass(opponentRange(snapshot,q),snapshot.board);let fold=0;
  for(let b=0;b<8;b++)for(let d=0;d<2;d++){const m=mass[b][d];if(!m)continue;fold+=m*responseRates({street:snapshot.street,strength:(b+.5)/8,draw:d,price,pot:potAfter,inPosition,facingRaises:Math.min(2,raisesThisStreet+1)})[0]}
  out.push({seat:q,fold:Math.max(0,Math.min(1,fold))});
 }
 return out;
}
export function raiseFoldRate(snapshot,{to}){
 const rates=raiseFoldRates(snapshot,{to});if(rates===null)return 0;
 let all=1;for(const r of rates)all*=r.fold;
 return rates.length?all:null;
}
