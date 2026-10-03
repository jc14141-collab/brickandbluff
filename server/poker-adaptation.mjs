// Public betting actions and completed chip results only; no hidden cards or deck access.
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function observePoker(r){
 if(r.mode!=='poker'||!r.solo||!r.game?.done||r.pokerObservedRound===r.round)return;
 r.pokerObservedRound=r.round;r.pokerReads??={};const g=r.game,bb=g.bigBlind??20;
 const decisions=g.players.map(()=>({entered:false,raises:0,actions:0,faced:0,folds:0}));
 let street=0,current=bb,bets=g.players.map(()=>0);bets[g.count===2?g.dealer:(g.dealer+1)%g.count]=g.smallBlind;bets[g.count===2?(g.dealer+1)%g.count:(g.dealer+2)%g.count]=bb;
 for(const a of g.actions){if(a.street!==street){street=a.street;current=0;bets.fill(0)}const read=decisions[a.seat];if(!read)continue;read.actions++;if(a.street===0&&['call','raise'].includes(a.kind))read.entered=true;if(current>bets[a.seat]){read.faced++;if(a.kind==='fold')read.folds++}if(a.kind==='raise'){read.raises++;current=a.to}bets[a.seat]=a.to}
 for(let i=0;i<r.seats.length;i++){const seat=r.seats[i],p=g.players[i];if(!seat.auth||seat.bot||seat.waiting||!p||p.departed)continue;const base=r.statBasis?.[seat.id]?.bank,net=Number.isFinite(base)?p.chips-base:(g.paid?.[i]??0)-p.total;const rows=r.pokerReads[seat.id]??=[];rows.push({...decisions[i],netBB:clamp(net/bb,-15,15)});if(rows.length>12)rows.shift()}
 const ids=new Set(r.seats.filter(s=>s.auth&&!s.bot).map(s=>s.id));for(const id of Object.keys(r.pokerReads))if(!ids.has(id))delete r.pokerReads[id];
}
export function pokerAdaptation(r,botSeat){
 if(!r.solo)return null;
 const active=r.game.players.map((p,i)=>({p,i,seat:r.seats[i]})).filter(({p,i,seat})=>i!==botSeat&&!p.fold&&seat?.auth&&!seat.bot&&!seat.waiting);
 let total=0,entryBias=0,aggressionBias=0,bluffBias=0,callBias=0,foldBias=0,valueBias=0,sizeBias=0;
 for(const {seat} of active){const rows=r.pokerReads?.[seat.id]??[];if(!rows.length)continue;const confidence=rows.length/(rows.length+8),sum=k=>rows.reduce((n,x)=>n+(x[k]??0),0),vpip=(sum('entered')+3)/(rows.length+6),fold=(sum('folds')+3)/(sum('faced')+6),raises=(sum('raises')+2)/(sum('actions')+10),momentum=clamp(rows.slice(-6).reduce((n,x)=>n+x.netBB,0)/(Math.min(rows.length,6)*15),-1,1);
  const overfold=Math.max(0,fold-.5),station=Math.max(0,vpip-.55)*(1-Math.max(0,fold-.45)),pressure=confidence*(overfold*.34+Math.max(0,momentum)*.035),value=confidence*(station*.25+Math.max(0,-momentum)*station*.06);
  entryBias+=confidence*(overfold*.08+Math.max(0,momentum)*.015);aggressionBias+=pressure+value*.65;bluffBias+=confidence*(overfold*.38-station*.35+momentum*.018);callBias+=confidence*Math.max(0,raises-.3)*.12;foldBias+=confidence*(fold-.5)*.4;valueBias+=value;sizeBias+=value*.8-pressure*.25;total++;
 }
 if(!total)return null;const humanShare=active.length/Math.max(1,r.game.players.filter(p=>!p.fold).length-1),bounded=(n,lo,hi)=>clamp(n/total*humanShare,lo,hi);
 return{entryBias:bounded(entryBias,-.03,.05),aggressionBias:bounded(aggressionBias,-.06,.12),bluffBias:bounded(bluffBias,-.15,.15),callBias:bounded(callBias,0,.045),foldBias:bounded(foldBias,-.12,.12),valueBias:bounded(valueBias,0,.08),sizeBias:bounded(sizeBias,-.05,.1)};
}
