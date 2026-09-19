import {handCard} from './hand-card.mjs';
import {fitWitchSeat} from './witch-model.mjs';
import {PokerTavern} from './poker-tavern.mjs';
import {Table3D} from './table3d.mjs';
import * as T from './vendor/three.module.min.js';
let RouletteUI,GuandanUI,CrapsUI,BigTwoUI;
const viewLoads=new Map();
export async function prepareRoomView(mode){
 if(!viewLoads.has(mode))viewLoads.set(mode,(async()=>{
  if(mode==='bigtwo')({BigTwoUI}=await import('./bigtwo-ui.mjs'));
  else if(mode==='roulette')({RouletteUI}=await import('./roulette-ui.mjs'));
  else if(mode==='craps')({CrapsUI}=await import('./craps-ui.mjs'));
  else if(mode==='guandan')({GuandanUI}=await import('./guandan-ui.mjs'));
 })().catch(e=>{viewLoads.delete(mode);throw e}));
 return viewLoads.get(mode);
}
import {renderRoomSkills} from './room-skills.mjs';
import {Guandan} from './guandan.mjs';
import {BigTwo,normalizeValue} from './bigtwo.mjs';
import {restoreCraps} from './craps.mjs';
import {evaluate,compare,rankName} from './engine.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TITLES={poker:'德州扑克',blackjack:'21 点',craps:'花旗骰',guandan:'掼蛋',bigtwo:'大老二',roulette:'美国轮盘'};
export function roomAvatarKey(r){return JSON.stringify([r.id,r.mode,r.you,r.seats.map(s=>[s.id,s.role,s.seed])])}
export function seatOrder(count,you){return Array.from({length:count},(_,i)=>(you+i)%count)}
// 把服务端的绝对座位号换算成“以你为 0”的相对顺序，与 guandanView 的做法一致。
// 大老二没有队友，各家只关心自己的手牌与全场剩牌数。
export function bigtwoView(r){
  const order=seatOrder(r.seats.length,r.you),rel=i=>i<0?-1:order.indexOf(i),d=r.game;
  const g=Object.assign(Object.create(BigTwo.prototype),{
    hands:order.map(i=>d.done&&d.remaining?d.remaining[i]:i===r.you?d.hand:Array(d.counts[i]).fill(null)),
    turn:rel(d.turn),target:d.target,owner:rel(d.owner),
    last:order.map(i=>d.last[i]),status:order.map(i=>d.status[i]),
    finish:d.finish.map(rel),done:d.done,trick:d.trick,opening:d.opening,finishType:d.finishType,
    opts:d.opts,actions:d.actions.map(a=>({...a,seat:rel(a.seat)})),
  });
  // 结算数据也要跟着座位翻转：scores/total/counts/mults 按相对顺序重排，
  // 每一笔「谁付给谁」的 from/to 同样换算，界面才能直接按自己的视角渲染。
  const result=d.result?{
    ...d.result,
    winner:rel(d.result.winner),
    scores:order.map(i=>d.result.scores[i]),
    total:order.map(i=>d.result.total[i]),
    counts:order.map(i=>d.result.counts[i]),
    mults:order.map(i=>d.result.mults[i]),
    pairs:(d.result.pairs??[]).map(p=>({...p,from:rel(p.from),to:rel(p.to)})),
  }:null;
  return{g,match:{round:d.round,total:order.map(i=>d.total[i]),value:normalizeValue(d.value),settle:()=>result},order};
}
export function guandanView(r){const order=seatOrder(r.seats.length,r.you),rel=i=>i<0?-1:order.indexOf(i),d=r.game,g=Object.assign(Object.create(Guandan.prototype),{level:d.level,hands:order.map(i=>d.done&&d.remaining?d.remaining[i]:i===r.you?d.hand:Array(d.counts[i]).fill(null)),turn:rel(d.turn),target:d.target,owner:rel(d.owner),last:order.map(i=>d.last[i]),status:order.map(i=>d.status[i]),finish:d.finish.map(rel),done:d.done,trick:d.trick,actions:d.actions.map(a=>({...a,seat:rel(a.seat)})),tributeLog:d.tributeLog,returns:d.returning?[{from:rel(d.returning.from),to:rel(d.returning.to)}]:[]});const result=d.result?{...d.result,team:d.result.team^(r.you%2),champion:d.result.champion===null?null:d.result.champion^(r.you%2)}:null;return{g,match:{levels:r.you%2?[...d.levels].reverse():d.levels,round:r.round,champion:d.champion===null?null:d.champion^(r.you%2),settle:()=>result,returnOptions:()=>d.hand.filter(c=>d.returnIds.includes(c.id))},order}}
function bestFive(cards){if(cards.length<5)return[];let best=[],score=[-1];for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const selected=[cards[a],cards[b],cards[c],cards[d],cards[e]],rank=evaluate(selected);if(compare(rank,score)>0){score=rank;best=selected}}return best.sort((a,b)=>b.r-a.r)}
export function blackjackSeat(count,i){
 if(i===0)return{x:0,z:2.3};
 const angles={2:[-60],3:[-65,65],4:[-70,-32,60],5:[-70,-35,35,70],6:[-72,-45,-22,36,70]};
 const a=(angles[count]??angles[2])[i-1]*Math.PI/180;return{x:6.3*Math.sin(a),z:-4.05*Math.cos(a)};
}
export function blackjackLayout(players,dealer){
 const out=[];
 const add=(cards,key,x,z,space,wide)=>cards.forEach((c,n)=>{const columns=Math.min(7,cards.length),w=Math.min(wide,space/Math.max(1,columns));out.push({c,key:key+':'+n,w,x:x+(n%7-(columns-1)/2)*(w+.015),z:z+Math.floor(n/7)*(w*1.45+.05)})});
 add(dealer,'dealer',0,-1.6,2.7,Math.min(1.15/(1+.13*Math.max(0,dealer.length-2)),1.3/(1.42*(Math.max(1,Math.ceil(dealer.length/7))-.5))));
 players.forEach((p,i)=>{const seat=blackjackSeat(players.length,i),x=i?seat.x*.77:0,z=i?seat.z*.72+1.2:seat.z,hands=p.hands??[{cards:p.hand}];hands.forEach((h,n)=>{const split=hands.length>1;add(h.cards,'p'+i+'h'+n,x+(split?(n%2-.5)*(i?.9:1.95):0),z+(split?(i?0:-.95)+Math.floor(n/2)*(i?.9:1.12):0),split?(i?.78:1.8):(i?2.55:4.2),split?(i?.37:.55):(i?(players.length===6?.7:1.0):1.05))})});
 // Fit each seat as a group inside an ellipse contained by the twelve-sided felt.
 // Scale positions and sizes together so rows and split hands retain their spacing.
 const groups=new Map();for(const card of out){const seat=card.key.split('h')[0].split(':')[0];if(!groups.has(seat))groups.set(seat,[]);groups.get(seat).push(card)}
 for(const cards of groups.values()){const rz=cards[0].key.startsWith('p0h')?3.8:2.95;const cx=(Math.min(...cards.map(c=>c.x-c.w/2))+Math.max(...cards.map(c=>c.x+c.w/2)))/2,cz=(Math.min(...cards.map(c=>c.z-c.w*.71))+Math.max(...cards.map(c=>c.z+c.w*.71)))/2,move=Math.min(1,.88/Math.hypot(cx/5.2,cz/rz)),ax=cx*move,az=cz*move;const fits=scale=>cards.every(c=>[-.5,.5].every(dx=>[-.71,.71].every(dz=>Math.hypot((ax+(c.x-cx+dx*c.w)*scale)/5.2,(az+(c.z-cz+dz*c.w)*scale)/rz)<=1)));let scale=1;if(!fits(1)){let lo=0,hi=1;for(let n=0;n<30;n++){const m=(lo+hi)/2;if(fits(m))lo=m;else hi=m}scale=lo}for(const c of cards){c.x=ax+(c.x-cx)*scale;c.z=az+(c.z-cz)*scale;c.w*=scale}}

 return out
}
export function blackjackChipLayout(cards,count,camera){
 camera.updateMatrixWorld(true);
 const rect=(x,z,w,d,h=0)=>{const pts=[];for(const dx of[-w/2,w/2])for(const dz of[-d/2,d/2])for(const y of[1.34,1.38+h])pts.push(new T.Vector3(x+dx,y,z+dz).project(camera));return{l:Math.min(...pts.map(p=>p.x)),r:Math.max(...pts.map(p=>p.x)),t:Math.max(...pts.map(p=>p.y)),b:Math.min(...pts.map(p=>p.y))}};
 const occupied=cards.map(c=>rect(c.x,c.z,c.w,c.w*1.42));occupied.push(rect(0,-2.85,.6,.85,.2));
 const overlap=(a,b)=>a.l<b.r+.018&&a.r>b.l-.018&&a.b<b.t+.018&&a.t>b.b-.018;
 const slots=[];for(let i=0;i<count;i++){const seat=blackjackSeat(count,i),preferred=i?{x:seat.x*.77,z:seat.z*.72}:{x:0,z:3.35};const candidates=[];
 for(let x=preferred.x-.3;x<=preferred.x+.301;x+=.1)for(let z=preferred.z-.3;z<=preferred.z+.301;z+=.1){if(![-.25,.25].every(dx=>[-.12,.12].every(dz=>Math.hypot((x+dx)/5.2,(z+dz)/(z+dz>0?3.8:2.95))<1)))continue;const box=rect(x,z,.5,.24,.1);if(box.l<-.97||box.r>.97||box.b<-.94||occupied.some(b=>overlap(box,b)))continue;candidates.push({x,z,box,cost:(x-preferred.x)**2+(z-preferred.z)**2})}
 candidates.sort((a,b)=>a.cost-b.cost);const best=candidates[0];slots.push(best?{x:best.x-.12,z:best.z}:null);if(best)occupied.push(best.box);
 }return slots
}
export class BlackjackTable extends PokerTavern{
 get isBlackjackTable(){return true}
 resize(){super.resize();if(this.dealerSeat)this.arrangeSeats()}
 buildTable(){super.buildTable();this.tableSurface.scale.set(1.25,1,1.0);for(const mesh of this.tableSurface.children){if(mesh.geometry?.type!=='CylinderGeometry')continue;if(mesh.scale.x>4){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++)if(a.getZ(i)>0)a.setZ(i,a.getZ(i)*1.35);a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()}else if(mesh.position.z>0)mesh.position.z*=1.35}for(const card of this.deckCards){card.position.x=0;card.position.z=-2.85}this.deckAnchor.set(0,1.52,-2.85);const shape=new T.Shape();shape.absellipse(0,0,4.9,2.75,0,Math.PI*2,false,0);const area=new T.Mesh(new T.ShapeGeometry(shape,64),this.surface('felt',0x315f3b));area.rotation.x=-Math.PI/2;area.position.set(0,1.3345,.28);area.receiveShadow=true;area.userData.blackjackPlayingArea=true;this.scene.add(area)}
 arrangeSeats(){for(const r of this.rigs){const dealer=r.seat===this.dealerSeat,p=dealer?{x:0,z:-4.05}:blackjackSeat(this.dealerSeat,r.seat);r.group.position.set(p.x,1.0,p.z);r.rest=r.group.rotation.y=Math.atan2(-p.x,1.2-p.z);r.baseY=1.0;r.group.scale.setScalar(r.guardian&&this.dealerSeat>=6?.82:.95);fitWitchSeat(r,5.8125,3.4)}this.camera.position.set(0,5.8,5.8);this.camera.fov=this.camera.aspect<1.5?(this.dealerSeat>=6?76:72):62;if(this.container?.clientWidth<=600)this.camera.fov=Math.min(100,Math.max(this.camera.fov,2*Math.atan(Math.tan(62*Math.PI/360)*1.5/this.camera.aspect)*180/Math.PI));if(this.container)this.camera.setViewOffset(this.container.clientWidth,this.container.clientHeight,0,this.container.clientHeight*.075,this.container.clientWidth,this.container.clientHeight);this.camera.updateProjectionMatrix();this.camera.lookAt(0,1.3,-.15);this.camera.updateMatrixWorld(true);
 const corner=new T.Vector3();let extent=1;for(const rig of this.rigs){rig.group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(rig.head);for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){corner.set(x,y,z).project(this.camera);extent=Math.max(extent,Math.abs(corner.x)/.96)}}
 if(extent>1){this.camera.fov=2*Math.atan(Math.tan(this.camera.fov*Math.PI/360)*extent)*180/Math.PI;this.camera.updateProjectionMatrix()}this.baseQuaternion.copy(this.camera.quaternion)}

 betPoint(i){if(i===0)return new T.Vector3(3,1.38,1.05);const p=blackjackSeat(this.dealerSeat,i);return new T.Vector3(p.x*.57,1.38,p.z*.35+.6)}
 showBets(players,beep){const totals=players.map(p=>p.hands.reduce((n,h)=>n+h.bet,0)),signature=JSON.stringify([players.map((p,i)=>[p.bank,totals[i]]),this.currentLayout]);if(signature===this.betSignature)return;const previous=this.betTotals;this.betTotals=totals;this.betSignature=signature;
 while(this.chipPiles.children.length)this.disposeGroup(this.chipPiles.children[0]);
 const slots=this.camera?blackjackChipLayout(this.currentLayout??[],players.length,this.camera):null;players.forEach((p,i)=>{if(slots&&!slots[i])return;const at=slots?new T.Vector3(slots[i].x,1.38,slots[i].z):this.betPoint(i);for(let n=0;n<Math.min(3,Math.ceil(totals[i]/25));n++)this.chip(this.chipPiles,at.x+0,1.38+n*.03,at.z,0xd3b65d);const reserve=at.clone();reserve.x+=.24;for(let n=0;n<Math.min(3,Math.ceil(p.bank/200));n++)this.chip(this.chipPiles,reserve.x+0,1.38+n*.03,reserve.z,0x83a99b);
 const amount=previous?totals[i]-previous[i]:0;if(amount>0){if(!this.onSound)beep?.('chips');const rig=this.rigs.find(r=>r.seat===i);if(rig)rig.gesture=1.6;this.react(i);for(let n=0;n<Math.min(6,Math.max(2,Math.ceil(amount/50)));n++){const chip=this.chip(this.scene,reserve.x,1.43+n*.025,reserve.z,0xe3c973);this.tween(chip,at,.6,n*.035,.1,()=>this.disposeGroup(chip))}if(i===0){const hand=new T.Group();this.box(hand,.3,.17,.42,0,0,0,0xe2bd7e);this.box(hand,.34,.2,.5,0,0,.4,0x7863a1);hand.position.set(at.x,1.6,3.2);this.scene.add(hand);this.tween(hand,new T.Vector3(at.x,1.53,at.z+.3),.4,0,.03,()=>{if(this.alive)this.tween(hand,new T.Vector3(at.x,1.55,3.6),.45,.12,0,()=>this.disposeGroup(hand))})}}});
 }
 showHands(players,dealer){const layout=blackjackLayout(players,dealer),wanted=new Set();this.currentLayout=layout;for(const item of layout){const {c,key,w,x,z}=item;wanted.add(key);const sig=c?c.r+c.s:'back',target=new T.Vector3(x,1.343,z);let e=this.cardObjects.get(key);if(!e){const obj=this.makeCard(c,w,w*1.42);obj.rotation.x=-Math.PI/2;obj.position.copy(this.deckAnchor);this.scene.add(obj);this.cardObjects.set(key,e={obj,sig,w});this.tween(obj,target,.95,0,.13)}else{if(e.sig!==sig){e.sig=sig;this.flips??=[];this.flips.push({obj:e.obj,start:this.elapsed,texture:this.faceTexture(c),baseY:target.y,lift:e.w*.5,rotation:[-Math.PI/2,0,0],swapped:false})}e.obj.scale.setScalar(w/e.w);if(e.obj.position.distanceTo(target)>.01&&!this.tweens.some(t=>t.obj===e.obj))this.tween(e.obj,target,.75,0,.02)}}for(const[key,e]of this.cardObjects)if(!wanted.has(key)){this.disposeGroup(e.obj);this.cardObjects.delete(key)}}
}
export class RoomGame{
 constructor(host,{rooms,toast,beep,reduced}){Object.assign(this,{host,rooms,toast,beep,reduced});this.q=s=>host.querySelector(s);this.round=-1;this.timer=setInterval(()=>this.clock(),200)}
 pokerEvents(r){const events=r.game.events??[];if(this.eventCursor===null||this.eventCursor===undefined){this.eventCursor=events.at(-1)?.id??-1;return}const fresh=events.filter(e=>e.id>this.eventCursor);this.eventCursor=events.at(-1)?.id??this.eventCursor;for(const e of fresh){const seat=this.order.indexOf(e.seat);if(e.kind==='bet'||e.kind==='return'){this.scene?.moveChips(seat,e.amount,e.kind==='return');this.scene?.react(seat);if(!this.scene?.onSound)this.beep('chips')}else if(e.kind==='check'||e.kind==='fold'){this.scene?.react(seat);const rig=this.scene?.rigs.find(x=>x.seat===seat);if(rig)rig.gesture=.8;this.beep(e.kind)}else if(e.kind==='community'&&!this.scene)this.beep('deal');else if(e.kind==='win')this.beep('win')}}
 now(){return Date.now()+(this.offset??0)}
 send(data){return this.rooms.send({kind:'act',...data})}
 updateControls(html){const node=this.q('.mp-controls');if(node&&node._controlsHTML!==html){node.innerHTML=html;node._controlsHTML=html}}
 clock(){if(document.hidden||!this.r)return;const r=this.r;if(r.mode==='poker'&&r.status==='roundEnd'){const stage=this.now()<(r.endedAt??0)+2200?0:this.now()<(r.reviewUntil??0)?1:2;if(stage!==this.stage){this.stage=stage;this.renderTable(r)}}if(r.status==='roundEnd'){const b=this.q('[data-next-room]')??this.q('[data-gnext]');if(b)b.disabled=r.seats[r.you].ready||this.now()<(r.reviewUntil??0)}}
 apply(r){this.offset=r.serverNow-Date.now();const avatarKey=roomAvatarKey(r),fresh=this.round!==r.round,changed=['poker','blackjack','guandan','bigtwo'].includes(r.mode)&&this.avatarKey!==avatarKey;this.r=r;if(fresh||changed){this.avatarKey=avatarKey;this.controller?.destroy();this.scene?.destroy();this.controller=null;this.scene=null;this.round=r.round;this.lastRoll=null;this.eventCursor=null;this.stage=-1;this.mount(r)}const wallet=document.querySelector('#wallet');if(wallet)wallet.textContent=r.mode==='guandan'?'—':r.seats[r.you].bank.toLocaleString();
 if(r.mode==='roulette'){this.controller.apply(r);return}
 if(r.mode==='guandan'){const v=guandanView(r),ui=this.controller;ui.game=v.g;ui.match=v.match;ui.names=v.order.map(i=>esc(r.seats[i].name)+(i===r.you?' · 你':i%2===r.you%2?' · 队友':' · 对手'));ui.busy=false;ui.message='经典规则 · 各自选择是否继续';ui.render();if(r.status==='roundEnd'){const b=this.q('[data-gnext]');if(b){b.textContent=r.seats[r.you].ready?'已准备，等待其他玩家':'继续下一副';b.disabled=r.seats[r.you].ready||this.now()<r.reviewUntil}}return}
 if(r.mode==='bigtwo'){const v=bigtwoView(r),ui=this.controller;ui.game=v.g;ui.match=v.match;ui.syncValue(v.match.value);ui.stacks=v.order.map(i=>r.seats[i].bank);ui.names=v.order.map(i=>esc(r.seats[i].name)+(i===r.you?' · 你':''));ui.busy=false;ui.message=r.closeAfterRound?'有玩家离桌托管 · 本副结算后自动关闭房间':'经典规则 · 各自选择是否继续';ui.render();if(r.status==='roundEnd'){const b=this.q('[data-gnext]');if(b){b.textContent=r.seats[r.you].ready?'已准备，等待其他玩家':'继续下一副';b.disabled=r.seats[r.you].ready||this.now()<r.reviewUntil}}return}
 if(r.mode==='craps'){
 const ui=this.controller,g=r.game;ui.authoritative=g.table;ui.engine=restoreCraps(g.table);
 Object.assign(ui.network,{canRoll:g.roller===r.you&&['bets','ready'].includes(g.phase),phase:g.phase==='ready'?'bets':g.phase,deadline:r.deadline,clockOffset:this.offset,others:g.others,you:r.you,roll:g.roll});
 ui.replayPending?.();ui.message='掷骰者：'+r.seats[g.roller].name+' · 仅七出后换人';
 ui.scene?.setGuests(r.seats.filter((_,i)=>i!==g.roller),r.seats[g.roller]);ui.render();
 if(g.phase==='rolling'&&g.roll&&this.lastRoll!==g.roll.id){this.lastRoll=g.roll.id;ui.scene?.throw(g.roll.dice,{seed:g.roll.id,durationMs:g.roll.ends-g.roll.started,elapsedMs:Math.max(0,this.now()-g.roll.started)})}
 if(g.phase==='landed'&&g.roll)ui.scene?.showResult(g.roll.dice,{seed:g.roll.id});
 let info=this.q('.mp-craps-info');if(!info){info=document.createElement('aside');info.className='mp-craps-info';this.q('.craps-room').append(info)}
 const contracts=g.others.some(p=>Object.entries(p.travel??{}).some(([k,v])=>k[0]==='c'&&v));
 info.innerHTML=r.host&&g.phase==='bets'&&!g.point&&!contracts?'<button data-end-craps>结束本桌</button>':'';
 if(this.q('[data-end-craps]'))this.q('[data-end-craps]').onclick=()=>this.rooms.send({kind:'endCraps'}).catch(()=>{});if(r.status==='roundEnd')this.result(r);return
 }
 this.renderTable(r);if(r.mode==='poker')this.pokerEvents(r)
 }
 mount(r){document.body.classList.add('in-game');const order=seatOrder(r.seats.length,r.you),roster=order.slice(1).map(i=>r.seats[i]),network={canSend:()=>!this.rooms.sending,send:data=>this.send(data),next:()=>this.rooms.send({kind:'next'}).catch(()=>{}),exit:()=>this.rooms.exit(),host:r.host,canRoll:false,phase:'bets'};
 if(r.mode==='roulette'){this.controller=new RouletteUI(this.host,{network:{...network,next:()=>this.rooms.send({kind:'next'})},beep:this.beep,toast:this.toast});return}
 if(r.mode==='guandan'){this.controller=new GuandanUI(this.host,{onExit:network.exit,onRules:()=>this.rules(),toast:this.toast,beep:this.beep,role:r.seats[r.you].role,reduced:this.reduced,network,roster});return}
 if(r.mode==='bigtwo'){this.controller=new BigTwoUI(this.host,{onExit:network.exit,onRules:()=>this.rules(),toast:this.toast,beep:this.beep,role:r.seats[r.you].role,reduced:this.reduced,network,roster});return}
 if(r.mode==='craps'){this.controller=new CrapsUI(this.host,{bank:r.game.table.bank,onBank:()=>{},onExit:network.exit,onRules:()=>this.rules(),beep:this.beep,toast:this.toast,reduced:this.reduced,network});return}
 this.order=order;this.host.innerHTML=`<section class="mp-table mp-${r.mode}"><div class="mp-stage"><div class="mp-labels"></div></div><header class="gd-heading"><h1>${TITLES[r.mode]} <span>${r.solo?'单人练习':'朋友房间'} · ${r.skill?.enabled?'角色技能桌':'经典规则'}</span></h1><button data-mp-exit>离开牌桌</button><button data-mp-full>全屏</button></header><div class="mp-phase"></div><div class="mp-own"></div><div class="mp-public-hands"></div><div class="mp-controls"></div><div class="mp-result"></div><div class="room-connection mp-connection">已连接</div></section>`;this.q('[data-mp-exit]').onclick=network.exit;this.q('[data-mp-full]').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{}};
 try{if(r.mode==='poker')this.scene=new PokerTavern(this.q('.mp-stage'),{role:r.seats[r.you].role,mode:'poker',roster,reduced:this.reduced,onSound:this.beep});else{this.scene=new BlackjackTable(this.q('.mp-stage'),{role:r.seats[r.you].role,mode:'poker',roster:[...roster,{seed:7789,name:'庄家'}],reduced:this.reduced,onSound:this.beep});this.scene.foreground.visible=false;const dealer=this.scene.rigs.at(-1);dealer.group.position.set(0,.75,-4.5);dealer.group.rotation.y=0;this.scene.dealerSeat=r.seats.length;this.scene.arrangeSeats()}}catch(e){console.warn(e);this.toast('3D 暂不可用，可使用清晰牌面区继续游戏')}
 }
 rules(){document.querySelector('[data-rule="'+this.r.mode+'"]')?.click()}
 card(c){return c?handCard(c,0,{small:true}):'<span class="gd-card small mp-back-card" aria-label="未公开">▦</span>'}
 renderTable(r){const g=r.game,order=this.order,poker=r.mode==='poker',own=g.players[r.you],turn=!g.done&&g.turn===r.you,active=turn&&(!poker?g.phase==='players':true),players=order.map(i=>g.players[i]);const revealWinner=g.done&&this.now()>=(r.endedAt??0)+2200;
 this.q('.mp-labels').innerHTML=order.slice(1).map((i,n)=>{const s=r.seats[i],p=g.players[i],win=poker&&revealWinner&&g.paid[i]>0;return`<div class="gd-seat mp-head ${!g.done&&g.turn===i?'active':''} ${poker?(p.fold?'poker-folded':'poker-live')+(!g.done&&!g.runout&&!p.fold&&g.turn===i?' poker-acting':''):''} ${win?'winner':''}" data-at-head="${!(poker&&g.runout&&!p.fold)}" data-seat-label="${n+1}"><strong>${esc(s.name)}</strong>${poker?'<b class="poker-seat-state">'+(p.fold?'已弃牌':!g.done&&!g.runout&&g.turn===i?'▶ 行动中':p.allin?'已全下':'在局中')+'</b>':''}<span class="player-chip-total">◉ ${Number(s.totalChips??(poker?p.chips:p.bank)).toLocaleString()}</span><small>${poker?win?'胜 · '+(g.showdown?rankName[evaluate([...p.cards,...g.board])[0]]:'其余弃牌'):g.runout&&!p.fold?(g.board.length>=3?rankName[evaluate([...p.cards,...g.board])[0]]:'等待翻牌'):p.status||'等待':p.done?p.result||'已停牌':p.bet?'下注 '+p.bet:'等待下注'}</small>${poker?'<span>本轮 '+p.bet+'</span>':p.hands.map((h,j)=>'<span class="mp-seat-hand">'+(p.hands.length>1?'手 '+(j+1)+' · ':'')+'<b>'+h.points+' 点</b> · '+h.cards.map(c=>esc((({11:'J',12:'Q',13:'K',14:'A'})[c.r]||c.r)+c.s)).join(' ')+'</span>').join('')}</div>`}).join('')+(poker?'':`<div class="gd-seat mp-head" data-at-head="true" data-seat-label="${r.seats.length}"><strong>庄家</strong><small>${g.dealerPoints} 点${g.reveal?'':' · 明牌'}</small></div>`);
 if(poker&&g.runout&&!own.fold)this.q('.mp-labels').innerHTML+=`<div class="gd-seat mp-head" data-at-head="false" data-seat-label="0"><strong>${esc(r.seats[r.you].name)}</strong><small>${g.board.length>=3?rankName[evaluate([...own.cards,...g.board])[0]]:'等待翻牌'}</small></div>`;
 if(poker){this.scene?.sync({dealer:order.indexOf(g.dealer),hand:own.cards,board:g.board,players,ownFold:own.fold,runout:g.runout,reveal:g.runout||g.done&&g.showdown,done:g.done,showdown:g.showdown,pot:g.pot,bank:own.chips,winningCards:revealWinner&&g.showdown?g.players.flatMap((p,i)=>g.paid[i]>0&&!p.fold?bestFive([...p.cards,...g.board]):[]):[],winningSeats:revealWinner?order.map((i,n)=>g.paid[i]>0?n:-1).filter(i=>i>=0):[]});this.q('.mp-phase').innerHTML=`<b>${g.done?(revealWinner?'最佳牌型亮牌':'摊牌 · 请看桌面'):g.runout?'全下摊牌 · 等待公牌落定':['翻牌前','翻牌','转牌','河牌'][g.street]}</b><div class="mp-pot"><small>底池 POT</small><strong>${g.pot}</strong></div>`;this.q('.mp-own').innerHTML=`<strong>你 · 总筹码 ${Number(r.seats[r.you].totalChips??own.chips).toLocaleString()}</strong><small>可用 ${own.chips} · 已下注 ${g.done?0:own.total}</small><div>${own.cards.map(c=>this.card(c)).join('')}</div>`;const l=g.legal,min=Math.min(l.min,l.max),value=Math.min(l.max,Math.max(min,this.raise??min));this.updateControls(g.done||g.runout?'':`<div class="mp-action-row"><strong>${turn?l.owe?'跟注需 '+l.call:'轮到你下注':'等待 '+esc(r.seats[g.turn]?.name??'发牌')}</strong><button data-action="fold" ${!active?'disabled':''}>弃牌</button><button class="mp-call" data-action="${l.owe?'call':'check'}" ${!active?'disabled':''}>${l.owe?'跟注 '+l.call:'过牌'}</button><button data-action="allin" ${!active||!l.allIn?'disabled':''}>全下 ${own.chips}</button></div><div class="mp-bet-row"><label>加注至<input data-range type="range" min="${min}" max="${l.max}" value="${value}" ${!active||!l.canRaise?'disabled':''}></label><input data-raise type="number" inputmode="numeric" min="${min}" max="${l.max}" value="${value}" aria-label="加注至总额" ${!active||!l.canRaise?'disabled':''}>${[[.33,'⅓ 池'],[.5,'½ 池'],[1,'满池']].map(([n,t])=>`<button data-size="${n}" ${!active||!l.canRaise?'disabled':''}>${t}</button>`).join('')}<button class="mp-confirm" data-action="raise" ${!active||!l.canRaise?'disabled':''}>确认${g.current?'加注':'下注'}</button></div>`);
 if(!g.done&&!g.runout){const set=n=>{this.raise=Math.round(Math.min(l.max,Math.max(min,n)));this.q('[data-raise]').value=this.raise;this.q('[data-range]').value=this.raise};this.q('[data-range]').oninput=e=>set(+e.target.value);this.q('[data-raise]').onchange=e=>set(+e.target.value);this.host.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>set((g.current??0)+Math.round((g.pot+l.owe)*+b.dataset.size)))}
 }else{this.scene?.showHands(players,g.dealer);this.scene?.showBets(players,this.beep);this.q('.mp-phase').innerHTML=`<b>${({bets:'选择下注',deal:'轮流发牌',players:'玩家行动',splitDeal:'分牌 · 逐手补牌',draw:'正在补牌',dealer:'庄家补牌',done:'本局结束'})[g.phase]}</b><div class="mp-dealer"><strong>庄家 · ${g.dealerPoints} 点${g.reveal?'':'（明牌）'}</strong><div>${g.dealer.map(c=>this.card(c)).join('')}</div></div>`;const renderHands=(p,name)=>`<strong>${esc(name)}</strong><div class="mp-hands">${p.hands.map((h,i)=>`<section class="mp-one-hand ${!p.done&&p.active===i?'current':''}"><label>第 ${i+1} 手 · <b>${h.points} 点${h.points>21?' · 爆牌':''}</b> · 注 ${h.bet}</label><div>${h.cards.map(c=>this.card(c)).join('')}</div>${h.result?'<small>'+h.result+'</small>':''}</section>`).join('')}</div>`;this.q('.mp-own').innerHTML=renderHands(own,'你 · 总筹码 '+Number(r.seats[r.you].totalChips??own.bank).toLocaleString()+' · 可用 '+own.bank);this.q('.mp-public-hands').innerHTML='';const h=own.hands[own.active];this.updateControls(g.done?'':g.phase==='bets'?`<strong>${own.bet?'已下注 '+own.bet:'自由下注 · 不设桌面上限'}</strong><input data-stake-input type="number" min="1" max="${Math.floor(own.bank/(own.bounty?2:1))}" value="${Math.min(50,Math.floor(own.bank/(own.bounty?2:1)))}" inputmode="numeric" aria-label="下注金额" ${own.bet?'disabled':''}>${[50,100,500].map(n=>`<button data-stake="${n}" ${own.bet||own.bank<n*(own.bounty?2:1)?'disabled':''}>${n}</button>`).join('')}<button data-stake="${Math.floor(own.bank/(own.bounty?2:1))}" ${own.bet?'disabled':''}>全部筹码</button><button data-custom-stake ${own.bet?'disabled':''}>确认下注</button>`:`<strong>${active?'第 '+(own.active+1)+' 手 · '+h.points+' 点':'等待牌桌行动'}</strong><button data-action="hit" ${!active?'disabled':''}>要牌 ＋</button><button data-action="stand" ${!active?'disabled':''}>停牌 ✓</button><button data-action="double" ${!active||h.cards.length!==2||own.bank<h.bet*(own.bounty?2:1)||h.splitAces?'disabled':''}>加倍 ×2</button><button data-action="split" ${!active||!own.canSplit?'disabled':''}>分牌 ⇆</button>`);if(this.q('[data-custom-stake]'))this.q('[data-custom-stake]').onclick=()=>this.send({action:'bet',amount:Number(this.q('[data-stake-input]').value)}).catch(()=>{})}
 renderRoomSkills(this,r);
 this.host.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>this.send({action:b.dataset.action,target:Number(this.q('[data-raise]')?.value)}).catch(()=>{}));this.host.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>this.send({action:'bet',amount:+b.dataset.stake}).catch(()=>{}));if(r.status==='roundEnd'&&(!poker||this.now()>=r.reviewUntil))this.result(r)
 }
 result(r){let node=this.q('.mp-result');if(!node){node=document.createElement('div');node.className='mp-result';this.host.append(node)}const g=r.game,ready=r.seats[r.you].ready;node.innerHTML=`<div class="mp-settlement"><strong>本局结算</strong><p>${r.mode==='poker'?r.seats.map((s,i)=>g.paid[i]>0?'<b>'+esc(s.name)+' · '+(g.showdown?rankName[evaluate([...g.players[i].cards,...g.board])[0]]:'无需摊牌')+' · 获得 '+g.paid[i]+'</b>':'').filter(Boolean).join('　'):r.mode==='blackjack'?esc(r.seats[r.you].name)+'：'+g.players[r.you].result+' · '+g.players[r.you].delta:'本桌可撤下注已退回'}</p><span>${r.seats.filter(s=>!s.bot&&s.ready).length} / ${r.seats.filter(s=>!s.bot).length} 人准备继续</span><button data-next-room ${ready||this.now()<r.reviewUntil?'disabled':''}>${ready?'已准备，等待同桌玩家':'继续下一局'}</button><button data-leave-room>不继续 · 离桌</button></div>`;this.q('[data-next-room]').onclick=()=>this.rooms.send({kind:'next'}).catch(()=>{});this.q('[data-leave-room]').onclick=()=>this.rooms.exit()}
 destroy(){clearInterval(this.timer);this.controller?.destroy();this.scene?.destroy();this.controller=null;this.scene=null;document.body.classList.remove('guandan-game','bigtwo-game','craps-game')}
}
