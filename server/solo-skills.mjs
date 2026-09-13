import {BIG_BLIND} from '../dist/poker.mjs';
import {blackjackAct,handPoints} from '../dist/blackjack.mjs';
import {SKILLS,cents} from '../dist/skill-rules.mjs';
const check=(v,m)=>{if(!v)throw Error(m)};
const random=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296};
export function startSkills(r){if(r.skill?.enabled)r.skill={enabled:true,events:[],players:r.seats.map(s=>({role:s.role,used:false,peek:null,marks:[],reward:0,rewarded:false,start:s.bank}))}}
export function skillView(r,i){const s=r.skill;if(!s?.enabled)return{enabled:false};const own=s.players?.[i];return{enabled:true,...own,peek:r.mode==='blackjack'&&own?.peek?.deckCount!==r.game?.deck?.length?null:own?.peek,events:s.events??[],players:(s.players??[]).map(({role,used,marks,reward})=>({role,used,marks,reward}))}}
export function skillAction(r,i,data,now){
 const s=r.skill?.players?.[i],g=r.game,p=g.players[i],poker=r.mode==='poker';
 check(r.skill?.enabled&&s&&!s.used&&!g.done&&!p.departed,'当前不能使用技能');
 const role=s.role,h=poker?null:p.hands[p.active],cards=poker?p.cards:h.cards,money=poker?'chips':'bank';
 let cost=0,targets=[],detail='';
 if(poker){
  check(!p.fold&&!g.runout&&g.turn===i,'请在自己的下注回合使用技能');
  check(role===2||g.street===0,'此技能仅限翻牌前');
  cost=role===0?5*BIG_BLIND:role===1?10*BIG_BLIND:0;
  check(p.chips>=cost,'筹码不足');
  if(role===0){const candidates=g.players.map((q,n)=>n).filter(n=>n!==i&&!g.players[n].fold);check(candidates.length,'没有可查看的对手');const target=candidates[Math.floor(random()*candidates.length)],index=Math.floor(random()*2);s.peek={seat:target,card:g.players[target].cards[index]};targets=[target];detail='私密查看一张底牌'}
  if(role===1){check(Number.isInteger(data.index)&&cards[data.index],'请选择要替换的手牌');cards[data.index]=g.deck.pop();detail='替换一张底牌'}
  if(role===2){p.shield=true;detail='本局禁止加注 · 结算返还底池 10%'}
  if(role===3){let candidates=g.players.map((q,n)=>n).filter(n=>n!==i&&!g.players[n].fold);while(candidates.length&&targets.length<2)targets.push(candidates.splice(Math.floor(random()*candidates.length),1)[0]);check(targets.length,'没有可标记的对手');s.marks=targets;detail='已标记 '+targets.map(n=>r.seats[n].name).join('、')}
  p.chips-=cost;g.skillPot=(g.skillPot??0)+cost;g.normalize();
 }else{
  check(h,'没有可用手牌');
  if(role===3){check(g.phase==='bets','悬赏只能在初始发牌前开启');check(!p.bounty,'悬赏已开启');check(p.bet?p.bank>=p.bet:p.bank>=2,'悬赏需额外预留一倍下注以覆盖最高损失');p.bank-=p.bet;p.riskReserve=p.bet;p.bounty=true;detail='悬赏赔率已启用'}
  else{
   check(p.bet>0&&g.phase!=='bets','请先下注并等待发牌');
   if(role!==2)check(g.phase==='players'&&g.turn===i&&!p.done,'请在自己的行动回合使用');
   cost=cents(h.bet*(role===2?.2:.5));check(p.bank>=cost,'可用筹码不足');
   if(role===0){s.peek={card:g.deck.at(-1),deckCount:g.deck.length};detail='私密查看下一张牌'}
   if(role===1){check(Number.isInteger(data.index)&&cards[data.index]&&g.dealer[0],'请选择要交换的手牌');[cards[data.index],g.dealer[0]]=[g.dealer[0],cards[data.index]];h.modified=true;g.dealerModified=true;detail='与庄家明牌交换'}
   if(role===2){check(['self','dealer'].includes(data.choice),'请选择自己的点数 +2 或庄家 −1');if(data.choice==='self'){h.adjust=(h.adjust??0)+2;h.modified=true;detail='本手点数 +2'}else{g.dealerAdjust=(g.dealerAdjust??0)-1;g.dealerModified=true;detail='庄家点数 −1'}}
   p.bank=cents(p.bank-cost);p.skillCost=cents((p.skillCost??0)+cost);
   if(g.phase==='players'&&g.turn===i&&!p.done&&handPoints(h)>=21)blackjackAct(g,i,'stand',0,now);
  }
 }
 s.used=true;r.skill.events.push({id:r.skill.events.length,seat:i,role,name:SKILLS[r.mode][role].name,cost,targets,detail,at:now});r.seq++;
}
export function settleSkills(r){if(!r.skill?.enabled)return;const g=r.game;for(let i=0;i<r.seats.length;i++){const s=r.skill.players?.[i];if(!s||s.rewarded)continue;s.rewarded=true;let reward=0;if(r.mode==='poker'&&s.used){if(s.role===2)reward=cents(g.pot*.1);if(s.role===3)reward=s.marks.filter(n=>g.players[n].fold||!(g.paid[n]>0)).length*5*BIG_BLIND;g.players[i].chips=cents(g.players[i].chips+reward);r.seats[i].bank=g.players[i].chips}s.reward=reward;if(reward)r.skill.events.push({id:r.skill.events.length,seat:i,role:s.role,name:SKILLS[r.mode][s.role].name,cost:0,targets:[],detail:'技能奖励 +'+reward,at:r.endedAt})}}
export function botSkill(r,now){if(!r.skill?.enabled||!r.skill.players||r.game.done)return false;const g=r.game;for(let i=0;i<r.seats.length;i++){const s=r.skill.players[i];if(!r.seats[i].bot||!s||s.used)continue;const ownTurn=g.turn===i;const timing=r.mode==='poker'?ownTurn&&!g.runout:(s.role===3?g.phase==='bets':ownTurn&&g.phase==='players');if(!timing)continue;try{skillAction(r,i,{index:0,choice:'dealer'},now);return true}catch{}}return false}
