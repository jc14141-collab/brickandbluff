import data from './poker-response-round1-data.mjs';
const sum=a=>a.reduce((n,x)=>n+x,0);
export function responseRates({street,strength,draw=0,price=0,pot=0,inPosition=false}){
 const owed=price>0?1:0,bucket=Math.min(7,Math.max(0,Math.floor(strength*8))),odds=Math.min(4,Math.floor(price/Math.max(1,pot+price)*10));
 const g=data.global[[street,owed].join(':')]??(owed?[2,5,1]:[0,5,1]);const prior=g.map(x=>(x+1)/(sum(g)+3));
 const c=data.coarse[[street,owed,bucket].join(':')]??[0,0,0],base=c.map((x,i)=>(x+prior[i]*12)/(sum(c)+12));
 const e=data.exact[[street,owed,bucket,odds,inPosition?1:0,draw>0?1:0].join(':')]??[0,0,0];let out=e.map((x,i)=>(x+base[i]*16)/(sum(e)+16));
 if(!owed){out[1]+=out[0];out[0]=0}const total=sum(out);return out.map(x=>x/total);
}
export const responseTraining={hands:data.trainedHands,observations:data.observations};
