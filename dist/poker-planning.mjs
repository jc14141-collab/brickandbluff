import {responseRates,raiseSizeRates} from './poker-response.mjs';
import {fastRank,compare} from './engine.mjs';
import {opponentRange,sampleRange,handFeatures,cards,cardKey} from './poker-range.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const now=()=>performance.now();
// Bounded belief-tree search, not a GTO solver. Hero optimizes over an entire
// posterior range; it never chooses a separate action for each sampled hand.
export function planHeadsUp(s,model,{rng=Math.random,worlds=96,rivers=8,budgetMs=24,nowFn=now}={}){
 const started=nowFn(),deadline=started+budgetMs;let nodes=0;
 const expired=()=>{if(++nodes%8===0&&nowFn()>=deadline)throw Error('search-budget')};
 const live=s.players.map((p,i)=>({p,i})).filter(x=>!x.p.fold);
 if(s.street<2||s.board.length<4||live.length!==2||live.some(x=>x.p.chips<=0)||!Number.isFinite(s.pot))return null;
 const villain=live.find(x=>x.i!==s.seat),hero=s.players[s.seat],cap=Math.min(hero.chips,villain.p.chips+Math.max(0,s.current-hero.bet));
 if(cap<s.legal.call||s.legal.call===hero.chips||hero.total-hero.bet!==villain.p.total-villain.p.bet)return null;
 try{
  if(nowFn()>=deadline)return null;
  // A royal flush on the board is a publicly known tie; no learned bluff
  // probability may invent fold equity or justify a raise here.
  if(s.board.length===5){const rank=fastRank(s.board);if(rank[0]===8&&rank[1]===14)return{action:s.legal.call?'call':'check',ev:(s.pot-s.legal.call)/2,search:{nodes:1,worlds:0,rivers:0,elapsedMs:nowFn()-started,candidates:[],publicTie:true}}}

  const range=opponentRange(s,villain.i);if(nowFn()>=deadline)return null;
  const belief=Array.from({length:Math.max(16,worlds)},(_,id)=>({id,hand:sampleRange(range,rng),w:1}));
  const available=cards.filter(c=>![...s.hole,...s.board].some(k=>cardKey(k)===cardKey(c)));
  const selected=[];if(s.street===2){const bag=available.slice();for(let i=0;i<Math.min(rivers,bag.length);i++){const j=Math.floor(rng()*bag.length);selected.push(bag.splice(j,1)[0])}}
  const basePot=s.pot,bb=s.bigBlind??20,vCap=cap-s.legal.call;
  // Postflop action order starts LEFT of the button; the button is last.
  const order=i=>(i-s.dealer-1+s.players.length)%s.players.length;
  const heroLast=order(s.seat)>order(villain.i);
  function mass(b){return b.reduce((n,x)=>n+x.w,0)}
  const prepared=new Map(),boardRefs=new WeakMap();
  function feature(x,board){let state=boardRefs.get(board);if(!state){const key=board.map(cardKey).join(',');state=prepared.get(key);if(!state){state={features:[],hero:board.length===5?fastRank([...s.hole,...board]):null};prepared.set(key,state)}boardRefs.set(board,state)}let f=state.features[x.id];if(!f){const score=state.hero?compare(state.hero,fastRank([...x.hand,...board])):null;f={...handFeatures(x.hand,board),share:score===null?null:score>0?1:score===0?.5:0};state.features[x.id]=f}return f}
  function payoff(b,board,h,v){expired();const m=mass(b);return b.reduce((n,x)=>n+x.w*(feature(x,board).share*(basePot+h+v)-h),0)/m}
  // Merge equal observed raise amounts before hero responds, so intent behind
  // a capped all-in size cannot leak additional private information.
  function branch(b,board,price,pot,canRaise,maxContribution,minIncrement,facingRaises=1){const groups={fold:[],call:[],raises:new Map()};
   const context={street:board.length===5?3:2,price,pot,inPosition:!heroLast,facingRaises,publicStyle:villain.p.publicStyle,styleBelief:villain.p.styleBelief};
   const table=Array.from({length:8},(_,bucket)=>[0,1].map(draw=>{const f={...context,strength:(bucket+.5)/8,draw};return{probs:responseRates(f),sizes:raiseSizeRates(f)}}));
   for(const x of b){const f=feature(x,board),{probs:rates,sizes}=table[Math.min(7,Math.floor(f.strength*8))][f.draw>0?1:0],probs=canRaise?rates:[rates[0],rates[1]+rates[2],0];
    if(probs[0])groups.fold.push({...x,w:x.w*probs[0]});if(probs[1])groups.call.push({...x,w:x.w*probs[1]});
    if(probs[2])for(let i=0;i<3;i++){const amount=Math.min(maxContribution,price+Math.max(minIncrement,Math.round([.5,1,1.5][i]*(pot+price))));if(!groups.raises.has(amount))groups.raises.set(amount,[]);groups.raises.get(amount).push({...x,w:x.w*probs[2]*sizes[i]})}
   }return groups;
  }
  function endStreet(b,board,h,v){expired();if(board.length===5||h>=cap||v>=vCap)return board.length===5?payoff(b,board,h,v):riverValue(b,h,v,true);return riverValue(b,h,v,false)}
  function riverValue(b,h,v,allIn){let total=0,weight=0;for(const card of selected){const valid=b.filter(x=>!x.hand.some(c=>cardKey(c)===cardKey(card)));const m=mass(valid);if(!m)continue;const board=[...s.board,card];total+=m*(allIn?payoff(valid,board,h,v):round(valid,board,h,v,heroLast));weight+=m}return weight?total/weight:0}
  function betValue(b,board,h,v,amount,facingRaises=1){expired();const pot=basePot+h+v,groups=branch(b,board,amount,pot+amount,amount<Math.min(cap-h,vCap-v),vCap-v,Math.max(bb,amount),facingRaises),m=mass(b);let value=0;
   if(mass(groups.fold))value+=mass(groups.fold)/m*(basePot+v);
   if(mass(groups.call))value+=mass(groups.call)/m*endStreet(groups.call,board,h+amount,v+amount);
   for(const [raise,posterior]of groups.raises){const call=endStreet(posterior,board,h+raise,v+raise);value+=mass(posterior)/m*Math.max(-h-amount,call)}return value;
  }
  function chooseBet(b,board,h,v){const room=Math.max(0,Math.min(cap-h,vCap-v)),pot=basePot+h+v;const opts=[{ev:endStreet(b,board,h,v),amount:0}];for(const f of [.5,1]){const amount=Math.min(room,Math.max(bb,Math.round(pot*f)));if(amount>0)opts.push({ev:betValue(b,board,h,v,amount),amount})}return opts.sort((a,b)=>b.ev-a.ev)[0].ev}
  function opponentLead(b,board,h,v){expired();const pot=basePot+h+v,room=Math.min(vCap-v,cap-h);if(room<=0)return endStreet(b,board,h,v);
   const checking=[],betting=new Map(),table=Array.from({length:8},(_,bucket)=>[0,1].map(draw=>{const f={street:board.length===5?3:2,strength:(bucket+.5)/8,draw,price:0,pot,inPosition:!heroLast,facingRaises:0,publicStyle:villain.p.publicStyle,styleBelief:villain.p.styleBelief};return{p:responseRates(f)[2],sizes:raiseSizeRates(f)}}));
   for(const x of b){const f=feature(x,board),{p,sizes}=table[Math.min(7,Math.floor(f.strength*8))][f.draw>0?1:0];checking.push({...x,w:x.w*(1-p)});for(let i=0;i<3;i++){const amount=Math.min(room,Math.max(bb,Math.round(pot*[.5,1,1.5][i])));if(!betting.has(amount))betting.set(amount,[]);betting.get(amount).push({...x,w:x.w*p*sizes[i]})}}
   const m=mass(b);let value=mass(checking)/m*(heroLast?chooseBet(checking,board,h,v):endStreet(checking,board,h,v));
   for(const [amount,posterior]of betting){let best=Math.max(-h,endStreet(posterior,board,h+amount,v+amount));const remaining=Math.min(cap-h-amount,vCap-v-amount);if(remaining>0){const extra=Math.min(remaining,Math.max(bb,amount,Math.round((pot+amount*2)*.75)));best=Math.max(best,betValue(posterior,board,h+amount,v+amount,extra,2))}value+=mass(posterior)/m*best}return value;
  }
  function round(b,board,h,v,last){return last?opponentLead(b,board,h,v):Math.max(opponentLead(b,board,h,v),chooseBet(b,board,h,v))}
  const owe=s.legal.call,opts=[];if(owe)opts.push({action:'fold',ev:0});
  opts.push({action:owe?'call':'check',ev:owe||heroLast?endStreet(belief,s.board,owe,0):opponentLead(belief,s.board,0,0)});
  if(s.legal.canRaise)for(const f of [.5,1]){const target=Math.min(s.legal.max,Math.max(s.legal.min,Math.round(s.current+f*(basePot+owe))));const h=target-hero.bet,price=target-s.current;if(h>cap||price<=0)continue;const priorRaises=s.actions.filter(a=>a.street===s.street&&a.kind==='raise').length,groups=branch(belief,s.board,price,basePot+h,price<vCap,vCap,Math.max(price,s.lastRaise??bb),priorRaises+1),m=mass(belief);let ev=0;
   if(mass(groups.fold))ev+=mass(groups.fold)/m*basePot;
   if(mass(groups.call))ev+=mass(groups.call)/m*endStreet(groups.call,s.board,h,price);
   for(const [v,posterior]of groups.raises){ev+=mass(posterior)/m*Math.max(-h,endStreet(posterior,s.board,v+owe,v))}opts.push({action:'raise',target,ev});
  }
  if(nowFn()>=deadline)return null;
  const temp=Math.max(.5,basePot*model.temperature),best=Math.max(...opts.map(x=>x.ev));const weights=opts.map(x=>Math.exp(clamp((x.ev-best)/temp,-35,0)));let draw=rng()*weights.reduce((a,b)=>a+b,0),pick=0;while(pick<weights.length-1&&(draw-=weights[pick])>0)pick++;
  return{...opts[pick],search:{nodes,worlds:belief.length,rivers:selected.length,elapsedMs:nowFn()-started,candidates:opts.map(x=>({...x}))}};
 }catch(e){if(e.message==='search-budget')return null;throw e}
}
