import {fastRank,compare} from './engine.mjs';
import {handFeatures} from './poker-range.mjs';
import {multiwayResponseRates} from './poker-multiway-response.mjs';
// Largest-stack all-in only: nobody can raise above the hero, so every response
// is fold/call and there is no future betting. Worlds are public-range samples.
export function multiwayAllInValue(s,worlds,{rates=multiwayResponseRates,budgetMs=24,nowFn=()=>performance.now()}={}){
 const start=nowFn(),h=s.players[s.seat],target=h.bet+h.chips,live=s.players.map((p,i)=>({p,i})).filter(x=>!x.p.fold),opps=live.filter(x=>x.i!==s.seat),past=h.total-h.bet;
 if(live.length<3||live.length>6||!s.legal.canRaise||target<=s.current||s.skillsEnabled||s.skillEnabled||s.pot!==s.players.reduce((n,p)=>n+p.total,0)||!worlds?.length||live.some(x=>x.p.chips<=0||x.p.bet+x.p.chips>target||x.p.total-x.p.bet!==past)||s.players.some(p=>p.total>h.total+h.chips))return null;
 const expired=()=>{if(nowFn()-start>=budgetMs)throw Error('multiway-budget')};
 try{expired();const n=opps.length,order=opps.map((x,k)=>({k,order:(x.i-s.seat-1+s.players.length)%s.players.length})).sort((a,b)=>a.order-b.order).map(x=>x.k),costs=opps.map(x=>Math.min(x.p.chips,target-x.p.bet)),heroOrder=(s.seat-s.dealer+s.players.length-1)%s.players.length,plans=[];
  for(let mask=0;mask<(1<<n);mask++){const totals=s.players.map(p=>p.total);totals[s.seat]+=h.chips;for(let k=0;k<n;k++)if(mask&(1<<k))totals[opps[k].i]+=costs[k];const levels=[...new Set(totals.filter(x=>x>0))].sort((a,b)=>a-b),layers=[];let prev=0;
   for(const level of levels){const contributors=totals.filter(x=>x>=level).length,eligible=opps.map((x,k)=>({x,k})).filter(({x,k})=>(mask&(1<<k))&&totals[x.i]>=level).map(x=>x.k);layers.push({amount:(level-prev)*contributors,eligible});prev=level}plans.push(layers);
  }
  let ev=0,allFold=0;const callerMass=Array(n+1).fill(0);
  for(let w=0;w<worlds.length;w++){expired();const world=worlds[w],mine=world.mine??fastRank([...s.hole,...world.board]),cmps=world.hands.map(hand=>compare(fastRank([...hand,...world.board]),mine)),features=world.hands.map(hand=>handFeatures(hand,s.board));
   const payoff=mask=>{let paid=0;for(const layer of plans[mask]){if(layer.eligible.some(k=>cmps[k]>0))continue;const ties=layer.eligible.filter(k=>cmps[k]===0),count=ties.length+1,earlier=ties.filter(k=>(opps[k].i-s.dealer+s.players.length-1)%s.players.length<heroOrder).length;paid+=Math.floor(layer.amount/count)+(earlier<layer.amount%count?1:0)}return paid-h.chips};
   function visit(depth,mask,mass,folded,totals){if(!mass)return;if(depth===n){const callers=depth-folded;ev+=mass*payoff(mask)/worlds.length;callerMass[callers]+=mass/worlds.length;if(!callers)allFold+=mass/worlds.length;return}
    const k=order[depth],x=opps[k],cap=x.p.total+costs[k],pot=totals.reduce((a,t)=>a+Math.min(t,cap),0),position=(x.i-s.dealer-1+s.players.length)%s.players.length,last=live.every(y=>(y.i-s.dealer-1+s.players.length)%s.players.length<=position),p=rates({street:s.street,...features[k],active:live.length-folded,price:costs[k],pot,inPosition:last}),fold=Math.max(0,Math.min(1,p[0]));
    visit(depth+1,mask,mass*fold,folded+1,totals);const called=totals.slice();called[x.i]+=costs[k];visit(depth+1,mask|(1<<k),mass*(1-fold),folded,called);
   }
   const totals=s.players.map(p=>p.total);totals[s.seat]+=h.chips;visit(0,0,1,0,totals);
  }
  expired();return{ev,allFold,callerMass,worlds:worlds.length,elapsedMs:nowFn()-start,scope:'largest-stack multiway all-in'};
 }catch(e){if(e.message==='multiway-budget')return null;throw e}
}
