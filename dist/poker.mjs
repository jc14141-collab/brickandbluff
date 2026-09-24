import {deck,compare,evaluate} from './engine.mjs';
export const BIG_BLIND=20, SMALL_BLIND=10;
export class Poker {
 constructor(stacks,{dealer=0,names=['你','Atlas','Vega','Kite'],rng=Math.random,smallBlind=10}={}){
  this.smallBlind=smallBlind;this.bigBlind=smallBlind*2;
  if(stacks.length<2||stacks.length>10||stacks.some(n=>!Number.isInteger(n)||n<1))throw Error("牌桌需要 2–10 位玩家，每位至少 1 筹码");
  this.count=stacks.length;dealer=((dealer%this.count)+this.count)%this.count;
  this.players=stacks.map((chips,i)=>({name:names[i]??`玩家 ${i+1}`,chips,cards:[],fold:false,total:0,bet:0,status:'',actedAt:null,actedRaise:this.bigBlind,history:[]}));
  this.deck=deck(rng);this.board=[];this.dealer=dealer;this.street=0;this.current=this.bigBlind;this.lastRaise=this.bigBlind;this.done=false;this.actions=[];this.events=[];this.turn=this.count===2?dealer:(dealer+3)%this.count;this.lastAggressor=null;
  for(let n=0;n<2;n++)for(let k=1;k<=this.count;k++){let i=(dealer+k)%this.count;this.players[i].cards.push(this.deck.pop());this.events.push({kind:'deal',seat:i,index:n})}
  this.post(this.count===2?dealer:(dealer+1)%this.count,this.smallBlind,'小盲');this.post(this.count===2?(dealer+1)%this.count:(dealer+2)%this.count,this.bigBlind,'大盲');
  this.pending=new Set(this.players.map((p,i)=>i).filter(i=>this.players[i].chips>0));this.normalize();
 }
 get runout(){const live=this.players.filter(p=>!p.fold);return !this.done&&!this.pending.size&&live.length>1&&live.filter(p=>p.chips>0).length<=1}
 get pot(){return this.players.reduce((n,p)=>n+p.total,0)+(this.skillPot??0)}
 pay(i,amount){const p=this.players[i],n=Math.min(p.chips,Math.max(0,Math.floor(amount)));p.chips-=n;p.total+=n;p.bet+=n;return n}
 post(i,n,label){let v=this.pay(i,n);this.players[i].status=label+' '+v;this.events.push({kind:'bet',seat:i,amount:v})}
 legal(i=this.turn){let p=this.players[i],owe=Math.max(0,this.current-p.bet),max=p.bet+p.chips;
  let reopened=p.actedAt===null||this.current-p.actedAt>=p.actedRaise;
  // Checking before an incomplete opening all-in does not consume the right to complete the bet.
  if(p.actedAt===0&&this.current>0)reopened=true;
  const hasOpponent=this.players.some((q,j)=>j!==i&&!q.fold&&q.chips>0);
  const min=this.current<this.bigBlind?this.bigBlind:this.current+this.lastRaise;
  return {call:Math.min(owe,p.chips),owe,min,max,canRaise:!p.shield&&reopened&&hasOpponent&&max>this.current,fullRaise:max>=min,allIn:p.chips>0&&(max<=this.current||!p.shield&&reopened&&hasOpponent)};
 }
 act(i,action,target){if(this.done||i!==this.turn||!this.pending.has(i))throw Error('当前不能行动');let p=this.players[i],l=this.legal(i),kind=action,amount=0,old=this.current;
  if(action==='allin'){if(!l.allIn)throw Error('未重新开放加注');if(l.max<=this.current)action='call';else{action='raise';target=l.max}}
  if(action==='fold'){p.fold=true;p.status='弃牌'}
  else if(action==='check'||action==='call'){if(action==='check'&&l.owe>0)throw Error('需要跟注');amount=this.pay(i,l.owe);p.status=amount?'跟注 '+amount:'过牌';kind=amount?'call':'check'}
  else if(action==='raise'){
   target=Number(target);if(!l.canRaise||!Number.isInteger(target)||target>l.max||target<=this.current||(target<l.min&&target!==l.max))throw Error('不合法的加注额度');
   amount=this.pay(i,target-p.bet);this.current=p.bet;
   const increment=old<this.bigBlind?Math.max(this.bigBlind,this.current-old):this.current-old;
   if(this.current>=this.bigBlind&&increment>=this.lastRaise)this.lastRaise=increment;
   this.lastAggressor=i;p.status=(old?'加注至 ':'下注 ')+p.bet;kind='raise';
   this.players.forEach((q,j)=>{if(j!==i&&!q.fold&&q.chips>0&&q.bet<this.current)this.pending.add(j)});
  }else throw Error('未知行动');
  if(!p.chips&&!p.fold)p.status='全下 '+p.bet;
  this.pending.delete(i);p.actedAt=this.current;p.actedRaise=this.lastRaise;
  const record={seat:i,street:this.street,kind,amount,to:p.bet,pot:this.pot};this.actions.push(record);p.history.push(record);this.events.push({...record,kind:p.fold?'fold':kind==='check'?'check':'bet'});
  this.turn=(i+1)%this.count;this.normalize();return record;
 }
 normalize(){if(this.done)return;const live=this.players.map((p,i)=>i).filter(i=>!this.players[i].fold);if(live.length===1){this.finish();return}
  for(const i of this.pending)if(this.players[i].fold||this.players[i].chips===0)this.pending.delete(i);
  const able=live.filter(i=>this.players[i].chips>0);if(able.length===1&&this.players[able[0]].bet>=this.current)this.pending.clear();
  if(this.pending.size){for(let n=0;n<this.count&&!this.pending.has(this.turn);n++)this.turn=(this.turn+1)%this.count}else this.turn=-1;
 }
 advance(){if(this.done||this.pending.size)return false;this.returnUncalled();if(this.street===3){this.finish();return true}
  this.street++;this.deck.pop();const count=this.street===1?3:1;
  for(let n=0;n<count;n++){this.board.push(this.deck.pop());this.events.push({kind:'community',index:this.board.length-1})}
  this.current=0;this.lastRaise=this.bigBlind;this.players.forEach(p=>{p.bet=0;p.actedAt=null;p.actedRaise=this.bigBlind;if(!p.fold)p.status=p.chips?'':'全下'});
  this.pending=new Set(this.players.map((p,i)=>i).filter(i=>!this.players[i].fold&&this.players[i].chips>0));this.turn=(this.dealer+1)%this.count;this.normalize();return true;
 }
 returnUncalled(){const order=this.players.map((p,i)=>({i,total:p.total})).sort((a,b)=>b.total-a.total);let diff=order[0].total-order[1].total;if(diff>0){let p=this.players[order[0].i];p.chips+=diff;p.total-=diff;p.bet=Math.max(0,p.bet-diff);this.events.push({kind:'return',seat:order[0].i,amount:diff})}}
 finish(){this.returnUncalled();const paid=this.players.map(()=>0),pots=[],levels=[...new Set(this.players.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b);let prev=0;const live=this.players.map((p,i)=>i).filter(i=>!this.players[i].fold);
  for(const level of levels){const contributors=this.players.map((p,i)=>i).filter(i=>this.players[i].total>=level);const eligible=contributors.filter(i=>!this.players[i].fold);const amount=(level-prev)*contributors.length;prev=level;let winners;
   if(live.length===1)winners=live;
   else if(eligible.length===1)winners=eligible;
   else {const scores=eligible.map(i=>({i,v:evaluate([...this.players[i].cards,...this.board])})).sort((a,b)=>compare(b.v,a.v));winners=scores.filter(s=>compare(s.v,scores[0].v)===0).map(s=>s.i)}
   if(!winners.length)throw Error('底池没有合法获胜者');
   winners.sort((a,b)=>((a-this.dealer+this.count-1)%this.count)-((b-this.dealer+this.count-1)%this.count));winners.forEach((i,j)=>paid[i]+=Math.floor(amount/winners.length)+(j<amount%winners.length?1:0));pots.push({amount,winners});
  }
  if(this.skillPot){let winners=live;if(live.length>1){const scores=live.map(i=>({i,v:evaluate([...this.players[i].cards,...this.board])})).sort((a,b)=>compare(b.v,a.v));winners=scores.filter(s=>compare(s.v,scores[0].v)===0).map(s=>s.i)}const amount=this.skillPot;winners.forEach((i,j)=>paid[i]+=Math.floor(amount/winners.length)+(j<amount%winners.length?1:0));pots.push({amount,winners,skill:true})}
  this.paid=paid;this.pots=pots;this.showdown=live.length>1;this.done=true;this.turn=-1;this.pending.clear();this.players.forEach((p,i)=>p.chips+=paid[i]);this.events.push({kind:'win',winners:paid.map((v,i)=>v>0?i:null).filter(i=>i!==null)});
 }
 snapshot(i){const p=this.players[i];return {bigBlind:this.bigBlind,smallBlind:this.smallBlind,seat:i,hole:p.cards.map(c=>({...c})),board:this.board.map(c=>({...c})),street:this.street,dealer:this.dealer,current:this.current,lastRaise:this.lastRaise,lastAggressor:this.lastAggressor,pot:this.pot,legal:this.legal(i),players:this.players.map(q=>({chips:q.chips,bet:q.bet,total:q.total,fold:q.fold,history:q.history.map(a=>({...a}))})),actions:this.actions.map(a=>({...a}))}}
}
