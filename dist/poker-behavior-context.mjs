import data from './poker-behavior-context-data.mjs';
const sum=a=>a.reduce((n,x)=>n+x,0);
export function publicDecisionRecords(actions,{seat,count,dealer,bigBlind=20}){
 const bets=Array(count).fill(0),out=[];bets[count===2?dealer:(dealer+1)%count]=bigBlind/2;bets[count===2?(dealer+1)%count:(dealer+2)%count]=bigBlind;
 let current=bigBlind,street=0,raises=0;
 for(const a of actions){if(a.street!==street){street=a.street;current=0;raises=0;bets.fill(0)}const price=Math.max(0,current-bets[a.seat]);if(a.seat===seat&&['fold','check','call','raise'].includes(a.kind)){
  const order=(seat-dealer-1+count)%count,position=street===0?(seat===dealer?2:order<2?0:1):(order===count-1?2:order===0?0:1),pot=Math.max(bigBlind,(a.pot??0)-(a.amount??0)),owed=price>0?1:0,size=owed?Math.min(3,Math.floor(price/(pot+price)*8)):0,players=count===2?2:count<=4?4:6;
  out.push({exact:[players,street,position,owed,size,Math.min(2,raises)].join(':'),coarse:[players,street,owed,Math.min(2,raises)].join(':'),global:[players,street,owed].join(':'),action:a.kind==='fold'?0:a.kind==='raise'?2:1,street});
 }bets[a.seat]=a.to??bets[a.seat];if(a.kind==='raise'){current=a.to;raises++}}
 return out;
}
function probability(style,e){const g=data.global[style+':'+e.global]??[1,2,1],prior=g.map(x=>(x+1)/(sum(g)+3)),c=data.coarse[style+':'+e.coarse]??[0,0,0],base=c.map((x,i)=>(x+prior[i]*20)/(sum(c)+20)),a=data.exact[style+':'+e.exact]??[0,0,0];return(a[e.action]+base[e.action]*30)/(sum(a)+30)}
export function inferContextStyle(hands){
 const recent=hands.slice(-40).filter(x=>x.length),logs=Array(9).fill(0);let effective=0;
 for(const events of recent){const weight=1/Math.sqrt(events.length);effective+=weight*events.length;for(let style=0;style<9;style++)for(const e of events)logs[style]+=.4*weight*Math.log(Math.max(.02,probability(style,e)))}
 const max=Math.max(...logs),weights=logs.map(x=>Math.exp(x-max)),total=sum(weights);for(let i=0;i<9;i++)weights[i]/=total;
 return{weights,confidence:Math.min(.65,effective/(effective+40)),effectiveObservations:effective};
}
