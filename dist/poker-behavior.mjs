import prototypes from './poker-behavior-data.mjs';
// Only past, completed public betting records. No showdown cards or chip outcomes.
export function publicBehavior(actions,{seat,count,dealer,bigBlind=20}){
 const out={entry:0,preRaise:0,preHands:1,faces:0,folds:0,raises:0,postActions:0,large:0,sizeActions:0};
 const bets=Array(count).fill(0);bets[count===2?dealer:(dealer+1)%count]=bigBlind/2;bets[count===2?(dealer+1)%count:(dealer+2)%count]=bigBlind;
 let current=bigBlind,street=0;
 for(const a of actions){if(a.street!==street){street=a.street;current=0;bets.fill(0)}const price=Math.max(0,current-bets[a.seat]);if(a.seat===seat){if(!street){if(a.kind==='call'||a.kind==='raise')out.entry=1;if(a.kind==='raise')out.preRaise=1}else{out.postActions++;if(price>0){out.faces++;if(a.kind==='fold')out.folds++}if(a.kind==='raise'){out.raises++;out.sizeActions++;if(((a.amount??0)-price)/Math.max(1,(a.pot??0)-(a.amount??0)+price)>1.2)out.large++}}}bets[a.seat]=a.to??bets[a.seat];if(a.kind==='raise')current=a.to}
 return out;
}
const metrics=[['entry','preHands'],['preRaise','preHands'],['folds','faces'],['raises','postActions'],['large','sizeActions']];
export function inferStyle(rows){
 const recent=rows.slice(-12),totals={};for(const row of recent)for(const [k,v]of Object.entries(row))if(Number.isFinite(v)&&v>=0)totals[k]=(totals[k]??0)+v;
 const logs=prototypes.map(p=>metrics.reduce((n,[yes,all])=>{const trials=Math.min(12,totals[all]??0),success=trials*((totals[yes]??0)/Math.max(1,totals[all]??0)),rate=Math.max(.03,Math.min(.97,p[yes]));return n+.35*(success*Math.log(rate)+(trials-success)*Math.log(1-rate))},0));
 const max=Math.max(...logs),weights=logs.map(x=>Math.exp(x-max)),sum=weights.reduce((n,x)=>n+x,0);for(let i=0;i<9;i++)weights[i]/=sum;
 // Keep uncertainty; never label a person as a single known bot style.
 return{weights,confidence:recent.length/(recent.length+12)};
}
export const behaviorMetrics=metrics;
