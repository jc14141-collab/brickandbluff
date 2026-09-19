import {SKILLS} from './skill-rules.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderRoomSkills(view,r){
 const s=r.skill,g=r.game;if(!s?.enabled)return;const own=g.players[r.you],poker=r.mode==='poker',role=s.role,rule=SKILLS[r.mode][role];if(!rule)return;
 const h=poker?{cards:own.cards}:own.hands[own.active];
 let can=!s.used&&!g.done&&(poker?g.turn===r.you&&!own.fold&&!g.runout&&(role===2||g.street===0):role===3?g.phase==='bets':!own.acted&&g.phase==='players'&&g.turn===r.you&&!own.done);
 const cost=poker?(role===0?100:role===1?200:0):role===3?0:Math.round(h.bet*(role===2?.2:.5)*100)/100;can=can&&(poker?own.chips:own.bank)>=cost;if(!poker&&role===3)can=can&&(own.bet?own.bank>=own.bet:own.bank>=2);
 if(!g.done)view.q('.mp-own').insertAdjacentHTML('beforeend',`<section class="mp-skill-dock"><div class="skill-dock-title"><strong>${esc(rule.name)}</strong><small>${cost?cost+' 筹码':'免费'}</small><details><summary aria-label="技能说明与记录">?</summary><div><p>${esc(rule.text)}</p>${s.events.slice(-8).map(e=>'<p>'+esc(r.seats[e.seat]?.name)+' · '+esc(e.name)+' · '+esc(e.detail)+'</p>').join('')}</div></details></div><div class="skill-dock-actions">${role===1?'<select data-skill-card aria-label="选择手牌">'+h.cards.map((c,i)=>'<option value="'+i+'">第 '+(i+1)+' 张</option>').join('')+'</select>':''}${!poker&&role===2?'<select data-skill-choice aria-label="过载效果"><option value="self">本手 +2 点</option><option value="dealer">庄家 −1 点</option></select>':''}<button data-solo-skill ${can?'':'disabled'}>${s.used?'本局已使用':!poker&&role!==3&&own.acted?'已行动 · 不可使用':'发动技能'}</button></div></section>`);
 view.q('[data-solo-skill]')?.addEventListener('click',()=>view.send({action:'skill',index:Number(view.q('[data-skill-card]')?.value??0),choice:view.q('[data-skill-choice]')?.value??'self'}).catch(()=>{}));
 if(s.peek?.card&&!g.done){const target=poker?view.q('[data-seat-label="'+view.order.indexOf(s.peek.seat)+'"]'):view.q('.mp-own');target?.insertAdjacentHTML('beforeend','<span class="mp-skill-peek">仅你可见 · '+(poker?'已探测底牌':'下一张牌')+view.card(s.peek.card)+'</span>')}
 const key=r.id+':'+r.round;if(view.skillRound!==key){view.skillRound=key;view.skillCursor=s.events.at(-1)?.id??-1}
 const fresh=s.events.filter(e=>e.id>view.skillCursor);view.skillCursor=s.events.at(-1)?.id??-1;
 for(const e of fresh){view.scene?.skillEffect(e.role,view.order.indexOf(e.seat),0,e.name);view.toast(r.seats[e.seat].name+' 发动 '+e.name+' · '+e.detail);view.beep('chips')}
 for(const [i,state] of s.players.entries()){if(state.used&&state.role===2&&poker)view.q('[data-seat-label="'+view.order.indexOf(i)+'"]')?.insertAdjacentHTML('beforeend','<small>◇ 护盾 · 禁止加注</small>');for(const n of state.marks??[])view.q('[data-seat-label="'+view.order.indexOf(n)+'"]')?.insertAdjacentHTML('beforeend','<small>⌖ '+esc(r.seats[i].name)+'的标记</small>')}
}
