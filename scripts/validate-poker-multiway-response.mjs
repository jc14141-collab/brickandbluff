import {Poker} from '../dist/poker.mjs';
import {decide} from '../tests/fixtures/poker-strategy-v127.mjs';
import {handFeatures} from '../dist/poker-range.mjs';
import {multiwayResponseRates} from '../dist/poker-multiway-response.mjs';
import responseData from '../dist/poker-multiway-response-data.mjs';

const rng=s=>()=>{s=Math.imul(s,1664525)+1013904223|0;return(s>>>0)/4294967296};
const hands=Number(process.argv[2]??1000),offset=Number(process.argv[3]??9000000),rows=[];
const trainCounts=Object.values(responseData.global).reduce((a,b)=>a.map((x,i)=>x+b[i]),[0,0,0]);
const pooledFold=trainCounts[0]/Math.max(1,trainCounts[0]+trainCounts[1]);
const clamp=p=>Math.max(.001,Math.min(.999,p));
const loss=(p,y)=>-(y?Math.log(p):Math.log(1-p));

for(const players of [4,6]) for(let h=0;h<hands;h++){
 const seed=offset+players*100000+h,stack=[400,1200,2000,4000][Math.floor(h/4)%4];
 const g=new Poker(Array(players).fill(stack),{dealer:h%players,rng:rng(seed)}),street=h%4;
 while(g.street<street&&!g.done){while(g.pending.size)g.act(g.turn,g.legal().owe?'call':'check');g.advance()}
 if(g.done||!g.pending.size||!g.legal().canRaise)continue;
 g.act(g.turn,'raise',g.legal().max);
 const profiles=Array.from({length:players},(_,i)=>(h+i*2)%9),random=profiles.map((_,i)=>rng(seed+i+1));
 while(g.pending.size&&!g.done){
  const i=g.turn,s=g.snapshot(i),live=s.players.map((p,j)=>({p,j,order:(j-s.dealer-1+players)%players})).filter(x=>!x.p.fold);
  const actingOrder=(i-s.dealer-1+players)%players;
  const features={street:s.street,...handFeatures(s.hole,s.board),active:live.length,price:s.legal.call,pot:s.pot,inPosition:live.every(x=>actingOrder>=x.order)};
  const rates=multiwayResponseRates(features),pFold=clamp(rates[0]/Math.max(1e-9,rates[0]+rates[1]));
  const d=decide(s,profiles[i],{samples:100,rng:random[i]}),label=d.action==='fold'?1:0;
  rows.push({players,hand:h,pFold,label,context:[features.street,features.active,features.price>0?1:0]});
  g.act(i,d.action,d.target);
 }
 if((h+1)%250===0)console.log(JSON.stringify({players,hands:h+1,totalHands:hands,observations:rows.filter(x=>x.players===players).length}));
}

const reports=[];
for(const players of [4,6]){
 const r=rows.filter(x=>x.players===players),folds=r.filter(x=>x.label).length;
 const modelBrier=r.reduce((n,x)=>n+(x.pFold-x.label)**2,0)/Math.max(1,r.length);
 const pooledBrier=r.reduce((n,x)=>n+(pooledFold-x.label)**2,0)/Math.max(1,r.length);
 const modelLogLoss=r.reduce((n,x)=>n+loss(x.pFold,x.label),0)/Math.max(1,r.length);
 const pooledLogLoss=r.reduce((n,x)=>n+loss(clamp(pooledFold),x.label),0)/Math.max(1,r.length);
 const bins=Array.from({length:5},(_,i)=>{const b=r.filter(x=>Math.min(4,Math.floor(x.pFold*5))===i);return{predictedFold:b.length?b.reduce((n,x)=>n+x.pFold,0)/b.length:null,observedFold:b.length?b.filter(x=>x.label).length/b.length:null,n:b.length}});
 const perHand=Array.from({length:hands},(_,hand)=>r.filter(x=>x.hand===hand));
 const pairedCI=field=>{const values=perHand.filter(a=>a.length).map(a=>a.reduce((n,x)=>n+(field==='brier'?(x.pFold-x.label)**2-(pooledFold-x.label)**2:loss(x.pFold,x.label)-loss(clamp(pooledFold),x.label)),0)/a.length),mean=values.reduce((n,x)=>n+x,0)/values.length,se=Math.sqrt(values.reduce((n,x)=>n+(x-mean)**2,0)/Math.max(1,values.length-1)/values.length);return[mean-1.96*se,mean+1.96*se]};
 reports.push({players,hands,observations:r.length,foldRate:folds/Math.max(1,r.length),modelBrier,pooledBrier,brierDifference95CI:pairedCI('brier'),modelLogLoss,pooledLogLoss,logLossDifference95CI:pairedCI('log'),bins});
}
const report={offset,hands,trainingHands:responseData.naturalHands,responseTrainingObservations:responseData.observations,responseTrainingAllInObservations:responseData.allinObservations,pooledTrainingFoldRate:pooledFold,reports,limitation:'Held-out forced all-in responses from the legacy synthetic bot policy. This validates response prediction only; it does not establish better chip earnings or predict human opponents.'};
console.log(JSON.stringify(report,null,2));
