import {fastRank,compare} from './engine.mjs';
export const PROFILES=[
 {name:'ATLAS',label:'均衡混合',bluff:.26,risk:.02,range:.0,sizes:[.33,.66,1],temperature:.028},
 {name:'VEGA',label:'极化施压',bluff:.38,risk:-.025,range:-.03,sizes:[.75,1.25,1.6],temperature:.035},
 {name:'KITE',label:'位置控制',bluff:.22,risk:.045,range:.035,sizes:[.25,.5,.85],temperature:.025},
 {name:'ORION',label:'紧凶',bluff:.18,risk:.025,range:-.015,sizes:[.5,.8,1.2],temperature:.022},
 {name:'NOVA',label:'阻断',bluff:.29,risk:.01,range:0,sizes:[.4,.8,1.4],temperature:.03},
 {name:'LYRA',label:'控池',bluff:.19,risk:.03,range:.015,sizes:[.25,.45,.7],temperature:.022},
 {name:'SABLE',label:'深筹码',bluff:.25,risk:.01,range:.01,sizes:[.33,.75,1.5],temperature:.03},
 {name:'ZENITH',label:'价值',bluff:.17,risk:.015,range:-.01,sizes:[.5,1,1.4],temperature:.024},
 {name:'RUNE',label:'反击',bluff:.27,risk:0,range:.02,sizes:[.33,.7,1.1],temperature:.028}
];
// Persistent personalities influence participation, calling and aggression independently.
const styles=[
 {label:'均衡型',tightness:0,callBias:0,aggression:0},
 {label:'松凶',tightness:-.14,callBias:.055,aggression:.12,bluff:.55,temperature:.045},
 {label:'松被动',tightness:-.16,callBias:.13,aggression:-.17,bluff:.07,temperature:.04},
 {label:'紧凶',tightness:.11,callBias:-.04,aggression:.08,bluff:.2,temperature:.022},
 {label:'诈唬施压',tightness:-.07,callBias:.015,aggression:.11,bluff:.65,temperature:.05},
 {label:'紧被动',tightness:.15,callBias:-.06,aggression:-.19,bluff:.025,temperature:.02},
 {label:'松凶控池',tightness:-.1,callBias:.06,aggression:.055,bluff:.35,temperature:.035},
 {label:'价值猎手',tightness:.08,callBias:-.015,aggression:.025,bluff:.055,temperature:.025},
 {label:'激进反击',tightness:-.04,callBias:.015,aggression:.14,bluff:.44,temperature:.045}
];
PROFILES.forEach((p,i)=>Object.assign(p,styles[i]));
export function randomProfile(rng=Math.random){return Math.min(PROFILES.length-1,Math.floor(rng()*PROFILES.length))}
const full=[];for(const s of ['♠','♥','♣','♦'])for(let r=2;r<=14;r++)full.push({s,r});
const key=c=>c.r+c.s;
export function preflop(h){let hi=Math.max(h[0].r,h[1].r),lo=Math.min(h[0].r,h[1].r),gap=hi-lo;return Math.max(0,Math.min(1,(hi+lo-4)/28*.62+(hi===lo?.32:0)+(h[0].s===h[1].s?.07:0)+(gap<=2?.06:0)+(hi===14?.08:0)-(gap>4?.09:0)))}
function rangeWeight(h,p,street,board){let s=preflop(h),raises=p.history.filter(a=>a.kind==='raise'),pre=raises.filter(a=>a.street===0).length,w=.15+.85*s;if(pre)w*=Math.pow(.08+.92*s,1+pre);if(p.history.some(a=>a.kind==='call'&&a.street===0))w*=.35+.65*s;if(board.length>=3&&raises.some(a=>a.street>0)){let cat=fastRank([...h,...board])[0];w*=cat>=2?1:cat===1?.7:.28}return Math.max(.004,w)}
// Cache weighted ranges per decision, rather than accepting an arbitrary hand
// after a fixed number of failed rejection attempts. No private opponent cards.
export function equity(snapshot,samples=1200,rng=Math.random){
 const known=new Set([...snapshot.hole,...snapshot.board].map(key)),pool=full.filter(c=>!known.has(key(c)));
 const opponents=snapshot.players.filter((p,i)=>i!==snapshot.seat&&!p.fold);
 if(!opponents.length)return 1;
 const ranges=opponents.map(p=>{let total=0,entries=[];for(let a=0;a<pool.length-1;a++)for(let b=a+1;b<pool.length;b++){const weight=rangeWeight([pool[a],pool[b]],p,snapshot.street,snapshot.board);total+=weight;entries.push({a,b,weight,cumulative:total})}return{entries,total}});
 let win=0;
 for(let n=0;n<samples;n++){
  const used=new Uint8Array(pool.length),hands=[];
  for(const range of ranges){let chosen;
   for(let attempt=0;attempt<64;attempt++){const value=rng()*range.total;let lo=0,hi=range.entries.length-1;while(lo<hi){const m=(lo+hi)>>1;if(range.entries[m].cumulative<value)lo=m+1;else hi=m}const e=range.entries[lo];if(!used[e.a]&&!used[e.b]){chosen=e;break}}
   if(!chosen){let total=0;for(const e of range.entries)if(!used[e.a]&&!used[e.b])total+=e.weight;let draw=rng()*total;for(const e of range.entries)if(!used[e.a]&&!used[e.b]&&(draw-=e.weight)<=0){chosen=e;break}}
   used[chosen.a]=used[chosen.b]=1;hands.push([pool[chosen.a],pool[chosen.b]]);
  }
  const board=snapshot.board.slice();while(board.length<5){const i=Math.floor(rng()*pool.length);if(!used[i]){used[i]=1;board.push(pool[i])}}
  const mine=fastRank([...snapshot.hole,...board]);let ties=1,lost=false;
  for(const h of hands){const c=compare(fastRank([...h,...board]),mine);if(c>0){lost=true;break}if(c===0)ties++}if(!lost)win+=1/ties;
 }
 return win/samples;
}
export function decide(snapshot,profile=0,{samples=1200,rng=Math.random}={}){
 const model=PROFILES[profile%PROFILES.length],l=snapshot.legal,p=snapshot.players[snapshot.seat],active=snapshot.players.filter(p=>!p.fold).length,eq=equity(snapshot,samples,rng),pot=Math.max(20,snapshot.players.reduce((sum,q)=>sum+Math.min(q.total,p.total+l.call),0)),owe=l.call,odds=owe/(pot+owe),position=(snapshot.seat-snapshot.dealer+snapshot.players.length)%snapshot.players.length,onButton=position===0,last=snapshot.lastAggressor===snapshot.seat,ownPF=preflop(snapshot.hole),cat=snapshot.board.length>=3?fastRank([...snapshot.hole,...snapshot.board])[0]:0;
 const aggressiveOpponents=snapshot.actions.filter(a=>a.street===snapshot.street&&a.kind==='raise').length;
 const realization=snapshot.street===3||owe===p.chips?1:Math.max(.66,Math.min(1,(onButton?1:.90)-.035*(active-2)+model.range));
 const effectiveEq=eq*realization,blocker=snapshot.hole.some(c=>c.r===14)||snapshot.hole.some(c=>c.r>=12&&snapshot.board.filter(b=>b.s===c.s).length>=3);
 const late=onButton||position===snapshot.players.length-1,threshold=.46+model.tightness+(late?0:.09)+.018*Math.max(0,snapshot.players.length-6)+Math.min(.15,aggressiveOpponents*.05);
 // Unopened pots use a style-led entry policy, rather than forcing every bot
 // through the same EV ranking. Premium hands remain playable in all styles.
 if(snapshot.street===0&&snapshot.current<=20){
  const enter=ownPF>=threshold||(model.tightness<0&&ownPF>=threshold-.12&&rng()<.22);
  if(enter){const raiseChance=model.aggression<0?(ownPF>.8?.55:.12):Math.min(.94,.7+model.aggression*1.5);if(l.canRaise&&rng()<raiseChance){const limpers=snapshot.actions.filter(a=>a.street===0&&a.kind==='call').length,target=Math.min(l.max,Math.max(l.min,Math.round(20*(2.5+limpers*.75+Math.max(0,model.aggression)*3))));return{action:'raise',target,equity:eq,profile:model.name,samples}}return{action:owe?'call':'check',equity:eq,profile:model.name,samples}}
  return{action:owe?'fold':'check',equity:eq,profile:model.name,samples};
 }
 const candidates=[];
 if(owe)candidates.push({action:'fold',ev:0});
 candidates.push({action:owe?'call':'check',ev:effectiveEq*(pot+owe)-owe+model.callBias*pot*(owe?Math.min(1,owe/Math.max(20,pot*.25)):0)-(snapshot.street===0&&owe&&ownPF<threshold?(threshold-ownPF)*(pot+owe)*.9:0)});
 if(l.canRaise){let targets;
  if(snapshot.street===0){let open=snapshot.current<=20;targets=open?[Math.round(20*(onButton?2.4:2.8)),60,80]:[Math.round(snapshot.current*(onButton?2.7:3.2)),Math.round(snapshot.current*4)]}
  else targets=model.sizes.map(f=>Math.round(snapshot.current+f*(pot+owe)));
  if(eq>.72||p.chips/(pot+owe)<1.2)targets.push(l.max);
  targets=[...new Set(targets.map(t=>Math.min(l.max,Math.max(l.min,t))))];
  const positionPressure=onButton?.07:0,rangePressure=snapshot.street===0?(ownPF>.7?.12:0):(last?.07:0),bluffEdge=(blocker?.08:0)+(active===2?.09:-.06);
  for(let to of targets){if(to<l.min&&to!==l.max)continue;let cost=to-p.bet,raiseBy=to-snapshot.current,effective=Math.min(cost,Math.max(...snapshot.players.filter((q,i)=>i!==snapshot.seat&&!q.fold).map(q=>q.chips+q.bet-p.bet).map(v=>Math.max(v,owe)))),ratio=raiseBy/(pot+owe),baseFold=Math.min(.72,Math.max(.08,.16+ratio*.21+positionPressure+rangePressure+bluffEdge-aggressiveOpponents*.065));
   // Multiway folds become less likely; continuing ranges are stronger than the initial range.
   let allFold=snapshot.players.some((q,i)=>i!==snapshot.seat&&!q.fold&&!q.chips)?0:Math.pow(baseFold,active-1),calledEq=Math.max(.02,effectiveEq-(.045+ratio*.025)*(active-1)),value=allFold*pot+(1-allFold)*(calledEq*(pot+effective*2)-effective);
   let valueHand=eq>(active===2?.59:.47),draw=cat<4&&eq>.28,bluffChance=model.bluff*(blocker?1.35:1)*(draw?1:.6)/(active-1);
   if(snapshot.street===0&&ownPF<threshold)bluffChance*=.08;
   if(!valueHand&&rng()>bluffChance)continue;
   if(snapshot.street===0&&ownPF<threshold)value-=(threshold-ownPF)*(pot+cost);
   value+=model.aggression*pot*Math.min(1,raiseBy/Math.max(20,pot))-(model.aggression>0?Math.max(0,ratio-1.5)*pot*.045:0);
   value+=(profile===1&&ratio>=.75&&valueHand?.035:0)*pot;
   if(profile===2&&!onButton)value-=.045*pot;
   candidates.push({action:'raise',target:to,ev:value});
  }
 }
 // Quantal mixing over abstract action EVs avoids a deterministic threshold bot.
 const max=Math.max(...candidates.map(c=>c.ev)),temp=Math.max(.75,pot*model.temperature);let weights=candidates.map(c=>Math.exp(Math.max(-35,(c.ev-max)/temp))),sum=weights.reduce((a,b)=>a+b,0),draw=rng()*sum,index=0;while(index<weights.length-1&&(draw-=weights[index])>0)index++;
 let chosen=candidates[index];return {...chosen,equity:eq,potOdds:odds,profile:model.name,samples};
}
