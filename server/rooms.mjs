import {serializeRoom,restoreRoom} from './room-codec.mjs';
import {chipBalance} from './chip-balances.mjs';
import {startSkills,skillAction,settleSkills,skillView,botSkill} from './solo-skills.mjs';
import {newRoulette,rouletteAct,rouletteTick,rouletteView,rouletteBots} from '../dist/roulette.mjs';
import {newBlackjack,blackjackAct,blackjackTick,blackjackView} from '../dist/blackjack.mjs';
import {Poker} from '../dist/poker.mjs';
import {deck,points} from '../dist/engine.mjs';
import {decide,PROFILES,randomProfile} from '../dist/strategy.mjs';
import {Guandan,GuandanMatch} from '../dist/guandan.mjs';
import {chooseCompetitive} from '../dist/guandan-strategy.mjs';
import {BigTwo,BigTwoMatch,DEFAULT_CARD_VALUE,normalizeValue} from '../dist/bigtwo.mjs';
import {chooseMove as chooseBigTwoMove} from '../dist/bigtwo-strategy.mjs';
import {Craps,restoreCraps,die,LABELS} from '../dist/craps.mjs';
import {CRAPS_TIMING} from '../dist/craps-layout.mjs';
export const MODES=['poker','blackjack','craps','guandan','bigtwo','roulette'];
export const AVATAR_SEEDS=[12501,24403,33807,45709];
const secureRandom=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296};
const uuid=()=>crypto.randomUUID().replaceAll('-','');
const assert=(condition,message)=>{if(!condition)throw Error(message)};
const clone=v=>JSON.parse(JSON.stringify(v));
export const pack=serializeRoom;
export const unpack=text=>restoreRoom(text,secureRandom);
function profile(data){const name=String(data.name??'玩家').trim();assert(name.length>=1&&name.length<=16,'昵称需要 1–16 个字符');const role=Number(data.role);assert(Number.isInteger(role)&&role>=0&&role<4,'请选择有效形象');return{name,role,seed:AVATAR_SEEDS[role]}}
export function createRoom(auth,data,now=Date.now()){assert(MODES.includes(data.mode),'未知游戏');const cap=['guandan','bigtwo'].includes(data.mode)?4:Number(data.capacity??4),min=data.solo===true&&['craps','roulette','blackjack'].includes(data.mode)?1:data.mode==='poker'?4:2,max=data.mode==='poker'?10:data.mode==='blackjack'?6:['craps','roulette'].includes(data.mode)?8:4;assert(Number.isInteger(cap)&&cap>=min&&cap<=max,'人数设置不正确');const p=profile(data);return{id:uuid(),host:auth,mode:data.mode,value:normalizeValue(data.value),capacity:cap,status:'lobby',seats:[{...p,id:uuid(),auth,bot:false,ready:true,bank:2000,seen:now}],round:0,game:null,seq:0,created:now,expires:now+86400000,nextAt:0,requests:[],message:'邀请朋友，或添加电脑补位'} }
export function seatOf(r,auth){return r.seats.findIndex(s=>s.auth===auth)}
export function minimumPlayers(r){return ['guandan','bigtwo'].includes(r.mode)?4:r.solo?1:2}
function readyRound(r,now){assert(r.seats.length>=minimumPlayers(r),'人数不足：掼蛋与大老二需要四人，其他朋友房间至少两人');assert(r.seats.every(s=>s.bot||s.ready),'请等待所有玩家准备');assert(r.mode==='guandan'||r.seats.every(s=>s.bot||s.bank>0),'有玩家筹码不足，请联系管理员发放');r.seats.forEach(s=>delete s.waiting);r.status='playing';r.round++;r.seq++;r.message='游戏开始 · 经典规则';r.seats.forEach(s=>{if(s.bot&&!s.cashOwner){if(r.mode==='bigtwo'){const need=Math.max(2000,normalizeValue(r.value??DEFAULT_CARD_VALUE)*200);if(s.bank<need)s.bank=need}else if(s.bank<(r.mode==='blackjack'?50:20))s.bank=2000}});
 startSkills(r);
 if(r.mode==='poker'){r.seats.forEach(s=>{if(s.bot&&!Number.isInteger(s.aiProfile))s.aiProfile=randomProfile(secureRandom)});r.game=new Poker(r.seats.map(s=>Math.floor(s.bank)),{names:r.seats.map(s=>s.name),dealer:(r.round-1)%r.seats.length,rng:secureRandom});r.nextAt=now+1100;r.deadline=now+45000}
 if(r.mode==='guandan'){if(!r.match||r.match.champion!==null)r.match=new GuandanMatch(secureRandom);r.game=r.match.start();r.nextAt=now+1100;r.deadline=now+60000}
 // 大老二：BigTwoMatch 跨副累计罚分，因此只在首次创建，之后每副重新发牌。
 if(r.mode==='bigtwo'){r.match??=new BigTwoMatch(secureRandom);r.match.random=secureRandom;r.match.value=normalizeValue(r.value??DEFAULT_CARD_VALUE);r.game=r.match.start();r.nextAt=now+1100;r.deadline=now+60000}
 if(r.mode==='blackjack'){r.game=newBlackjack(r.seats.map(s=>s.bank),secureRandom,now);r.deadline=r.game.deadline;r.nextAt=r.game.nextAt}
 if(r.mode==='roulette'){r.game=newRoulette(r.seats.map(s=>s.bank),now,(r.round-1)%r.seats.length);rouletteBots(r.game,r.seats,secureRandom);r.seats.forEach((s,i)=>{if(r.game.players[i])s.bank=r.game.players[i].bank});r.nextAt=now+5000}
 if(r.mode==='craps'){r.game={tables:r.seats.map(s=>new Craps(s.bank)),point:0,phase:'bets',roller:(r.round-1)%r.seats.length,roll:null,done:false};r.deadline=0;r.nextAt=now+5000;r.seats.forEach((s,i)=>{if(s.bot&&r.game.tables[i].bank>=10)r.game.tables[i].add('pass',10)})}
}
function finishRoom(r,now=Date.now()){r.endedAt=now;r.reviewUntil=now+(r.mode==='guandan'?6000:r.mode==='poker'&&r.game.showdown?6000:1800);r.seats.forEach(s=>s.ready=s.bot||!!s.waiting);r.status='roundEnd';r.seq++;if(r.mode==='poker')r.seats.forEach((s,i)=>{if(r.game.players[i])s.bank=r.game.players[i].chips});if(['blackjack','roulette'].includes(r.mode))r.seats.forEach((s,i)=>{if(r.game.players[i])s.bank=r.game.players[i].bank});if(r.mode==='guandan')r.match.settle();if(r.mode==='bigtwo'&&!r.match.settled){const result=r.match.settle(r.seats.map(s=>s.bank));r.seats.forEach((s,i)=>{s.bank=Math.max(0,Math.round(s.bank+result.scores[i]))});r.message='本副结算 · 每张牌 '+r.match.value+' 筹码'}settleSkills(r)}
function crapsRoll(r,now){const g=r.game;assert(['bets','ready'].includes(g.phase),'请等待本掷结算完成');for(const t of g.tables)t.rolling=true;g.phase='rolling';g.roll={dice:[die(),die()],started:now,ends:now+CRAPS_TIMING.throw,holdEnds:now+CRAPS_TIMING.throw+CRAPS_TIMING.hold,id:uuid()};r.nextAt=g.roll.ends}
function resetTurn(r,now){r.nextAt=now+(r.mode==='poker'&&r.game.runout?2200:1050);r.deadline=now+(['guandan','bigtwo'].includes(r.mode)?60000:45000);r.seq++;if(r.game.done)finishRoom(r,now)}
export function command(r,auth,data,now=Date.now()){const kind=data.kind;let i=seatOf(r,auth);if(kind==='join'){if(i>=0){r.seats[i].seen=now;return}assert(!r.solo,'这是单人牌桌');assert(r.seats.length<r.capacity,'房间已满');r.seats.push({...profile(data),id:uuid(),auth,bot:false,ready:r.status!=='lobby',waiting:r.status!=='lobby',bank:2000,seen:now});r.seq++;return}assert(i>=0,'你尚未加入房间');r.seats[i].seen=now;const isHost=auth===r.host,seat=r.seats[i];
 if(kind==='profile'){assert(r.status==='lobby','游戏中不能更换形象');Object.assign(seat,profile(data),{ready:false});r.seq++;return}
 if(kind==='ready'){assert(r.status==='lobby','游戏已经开始');seat.ready=!!data.ready;r.seq++;return}
 if(kind==='value'){assert(r.mode==='bigtwo','只有大老二可以设置每张牌的价值');assert(isHost,'只有房主可以修改每张牌的价值');assert(r.status==='lobby','每张牌的价值只在开局前设定，开打后不能修改');r.value=normalizeValue(data.value);
  // 牌值只在开局前可改；match 已存在时同步，保证下一副沿用同一口径。
  if(r.match)r.match.value=r.value;
  r.message='每张牌价值已设为 '+r.value+' 筹码';r.seq++;return}
 if(kind==='addBot'){assert(isHost&&r.status==='lobby','只有房主可在准备区添加电脑');assert(r.seats.length<r.capacity,'房间已满');const role=Number(data.role??r.seats.length%4);r.seats.push({...profile({name:'电脑 '+(r.seats.length+1),role}),id:uuid(),auth:null,bot:true,aiProfile:r.mode==='poker'?randomProfile(secureRandom):undefined,ready:true,bank:2000,seen:now});r.seq++;return}
 if(kind==='removeBot'){assert(isHost&&r.status==='lobby','只有房主可以移除电脑');const n=r.seats.findIndex(s=>s.id===data.id&&s.bot);assert(n>=0,'该座位不是电脑');r.seats.splice(n,1);r.seq++;return}
 if(kind==='next'){assert(!r.closeAfterRound,'本副结算后房间将自动关闭');assert(r.status==='roundEnd'&&now>=(r.reviewUntil??0),'请先观看本局摊牌和结算');seat.ready=true;r.seq++;if(r.seats.every(s=>s.bot||s.ready))readyRound(r,now);return}
 if(kind==='start'){assert(isHost&&r.status==='lobby','请在准备区由房主开始');readyRound(r,now);return}
 if(kind==='lobby'){assert(!r.closeAfterRound,'本副结算后房间将自动关闭');assert(isHost&&r.status==='roundEnd','本局结束后房主可返回准备区');r.status='lobby';r.game=null;r.match=null;r.seats.forEach(s=>{delete s.waiting;s.ready=s.bot||s.auth===r.host});r.seq++;return}
 if(kind==='endCraps'){assert(isHost&&r.mode==='craps'&&r.status==='playing'&&['bets','ready'].includes(r.game.phase)&&!r.game.point&&!r.game.tables.some(t=>Object.entries(t.travel??{}).some(([k,v])=>k[0]==='c'&&v)),'请在无目标点数、无锁定 COME 合约且未掷骰时结束本桌');r.game.tables.forEach((t,n)=>{t.clear();r.seats[n].bank=t.bank});r.game.done=true;finishRoom(r,now);return}
 if(kind==='leave'){if(r.status==='lobby'||seat.waiting){r.seats.splice(i,1)}else{seat.bot=true;if(r.mode==='poker')seat.aiProfile??=randomProfile(secureRandom);seat.auth=null;seat.name='电脑补位';seat.ready=true}if(isHost)r.host=r.seats.find(s=>!s.bot)?.auth??null;r.seq++;if(r.status==='roundEnd'&&r.seats.some(s=>!s.bot)&&r.seats.every(s=>s.bot||s.ready)&&now>=(r.reviewUntil??0))readyRound(r,now);return}
 assert(!seat.waiting,'已入房，请等待下一局或下一轮下注');assert(r.status==='playing','当前没有进行中的对局');assert(['craps','roulette'].includes(r.mode)||data.seq===r.seq,'牌桌已更新，请根据最新画面操作');
 if(r.mode==='craps'&&data.action==='betBatch'){assert(Array.isArray(data.bets)&&data.bets.length>0&&data.bets.length<=32,'下注队列无效');for(const a of data.bets){assert(['bet','remove','removeTravel','clear'].includes(a.action),'下注操作无效');command(r,auth,{kind:'act',action:a.action,key:a.key,amount:a.amount},now)}return}
 if(data.action==='skill'){skillAction(r,i,data,now);if(r.mode==='blackjack'){r.nextAt=r.game.nextAt;r.deadline=r.game.deadline;r.seats[i].bank=r.game.players[i].bank}return}
 if(r.mode==='poker'){r.game.act(i,data.action,data.target);resetTurn(r,now)}
 else if(r.mode==='guandan'){if(r.game.returns.length){assert(r.game.returns[0].from===i,'请等待还贡');r.match.giveBack(data.ids?.[0])}else r.game.act(i,data.ids??[],data.key);resetTurn(r,now)}
 else if(r.mode==='bigtwo'){r.game.act(i,data.ids??[]);resetTurn(r,now)}
 else if(r.mode==='blackjack'){blackjackAct(r.game,i,data.action,Number(data.amount),now);r.nextAt=r.game.nextAt;r.deadline=r.game.deadline;r.seats[i].bank=r.game.players[i].bank;r.seq++}
 else if(r.mode==='roulette'){rouletteAct(r.game,i,data.action,data.key,data.amount,now);r.seats[i].bank=r.game.players[i].bank;r.seq++}
 else{const g=r.game,t=g.tables[i];if(data.action==='roll'){assert(g.roller===i,'当前由掷骰者投骰');crapsRoll(r,now)}else{assert(['bets','ready'].includes(g.phase),'下注已截止，请等待下一掷');if(data.action==='bet'){assert([5,10,25,100].includes(data.amount)&&Object.hasOwn(LABELS,data.key),'下注参数不正确');t.add(data.key,data.amount)}else if(data.action==='remove'){assert(Object.hasOwn(LABELS,data.key),'下注区域不正确');t.remove(data.key)}else if(data.action==='removeTravel'){assert(/^d(4|5|6|8|9|10)$/.test(data.key),'移点合约无效');t.removeTravel(data.key)}else if(data.action==='clear')t.clear();else throw Error('未知操作')}r.seats[i].bank=t.bank;r.seq++}
}
export function tick(r,now=Date.now()){if(!r.closeAfterRound&&r.status==='roundEnd'&&now>=(r.reviewUntil??0)&&r.seats.some(s=>!s.bot)&&r.seats.every(s=>s.bot||s.ready)){readyRound(r,now);return true}if(r.status!=='playing')return false;const g=r.game;if(now<r.nextAt)return false;if(botSkill(r,now)){r.nextAt=now+1000;return true;}
 if(r.mode==='poker'){if(g.done){finishRoom(r,now);return true}if(!g.pending.size){g.advance();resetTurn(r,now);return true}if(r.seats[g.turn].bot||now>=r.deadline){const i=g.turn,l=g.legal(i),m=r.seats[i].bot?decide(g.snapshot(i),r.seats[i].aiProfile??(r.seats[i].aiProfile=randomProfile(secureRandom)),{samples:100,rng:secureRandom}):{action:l.owe?'fold':'check'};g.act(i,m.action,m.target);resetTurn(r,now);return true}}
 if(r.mode==='guandan'){const i=g.returns.length?g.returns[0].from:g.turn;if(r.seats[i].bot||now>=r.deadline){if(g.returns.length)r.match.autoReturn();else{const m=chooseCompetitive(g.snapshot(i));g.act(i,m?.cards.map(c=>c.id)||[],m?.key)}resetTurn(r,now);return true}}
 // 超时同样由电脑代打，避免真人掉线后牌桌永久停住。
 if(r.mode==='bigtwo'){const i=g.turn;if(r.seats[i].bot||now>=r.deadline){const m=chooseBigTwoMove(g.snapshot(i));g.act(i,m?.cards.map(c=>c.id)||[]);resetTurn(r,now);return true}}
 if(r.mode==='blackjack'){if(blackjackTick(g,r.seats.map(s=>s.bot),now)){r.nextAt=g.nextAt;r.deadline=g.deadline;r.seats.forEach((s,i)=>{if(g.players[i])s.bank=g.players[i].bank});r.seq++;if(g.done)finishRoom(r,now);return true}}
 if(r.mode==='roulette'){if(g.launchAt===null){if(!r.seats[g.roller].bot)return false;rouletteAct(g,g.roller,'launch',null,0,now);r.nextAt=g.closeAt;r.seq++;return true}const changed=rouletteTick(g,now);r.nextAt=now<g.launchAt?g.launchAt:now<g.closeAt?g.closeAt:now<g.landAt?g.landAt:g.endAt;if(changed){r.seq++;if(g.done)finishRoom(r,now);return true}}
 if(r.mode==='craps'){if(g.phase==='rolling'){g.phase='landed';g.roll.holdEnds=now+CRAPS_TIMING.hold;r.nextAt=g.roll.holdEnds;r.seq++;return true}if(g.phase==='landed'){g.sevenOut=!!g.point&&g.roll.dice[0]+g.roll.dice[1]===7;for(const t of g.tables)t.settle(g.roll.dice);g.point=g.tables[0].point;r.seats.forEach((s,i)=>{if(g.tables[i])s.bank=g.tables[i].bank});g.phase='result';r.nextAt=now+2000;r.seq++;return true}if(g.phase==='result'){for(const seat of r.seats)if(seat.waiting){const t=new Craps(seat.bank);t.point=g.point;g.tables.push(t);delete seat.waiting;r.seq++}if(g.sevenOut)g.roller=(g.roller+1)%r.seats.length;g.phase='bets';r.nextAt=now+5000;r.deadline=0;for(let i=0;i<g.tables.length;i++)if(r.seats[i].bot&&!r.seats[i].cashOwner&&g.tables[i].bank>=10){const t=g.tables[i];if(!g.point&&!t.bets.pass)t.add('pass',10);else if(g.point&&!t.bets.p6&&t.bank>=12)t.add('p6',10)}r.seq++;return true}if(['bets','ready'].includes(g.phase)&&r.seats[g.roller].bot){crapsRoll(r,now);r.seq++;return true}}
 return false
}
export function snapshot(r,auth,now=Date.now()){const i=seatOf(r,auth),room={id:r.id,mode:r.mode,value:normalizeValue(r.value??DEFAULT_CARD_VALUE),solo:r.solo??false,skill:skillView(r,i),capacity:r.capacity,status:r.status,round:r.round,seq:r.seq,you:i,host:r.host===auth,hostId:r.seats.find(s=>s.auth===r.host)?.id??null,expires:r.expires,deadline:r.deadline??0,serverNow:now,endedAt:r.endedAt??0,reviewUntil:r.reviewUntil??0,message:r.message,seats:r.seats.map((s,n)=>({...chipBalance(r,n),id:s.id,name:s.name,role:s.role,seed:s.seed,bot:s.bot,style:r.mode==='poker'&&s.bot?PROFILES[s.aiProfile]?.label:null,ready:s.ready,bank:s.bank,connected:s.bot||now-s.seen<25000}))};room.closeAfterRound=!!r.closeAfterRound;room.minimumPlayers=minimumPlayers(r);room.waiting=!!r.seats[i]?.waiting;room.waitingPlayers=r.seats.filter(s=>s.waiting).map(s=>({name:s.name,role:s.role}));if(i<0||!r.game||room.waiting)return room;room.seats=room.seats.filter((_,n)=>!r.seats[n].waiting);const g=r.game;
 if(r.mode==='poker'){room.game={players:g.players.map((p,n)=>({name:p.name,chips:p.chips,bet:p.bet,total:p.total,fold:p.fold,status:p.status,cards:n===i||(g.runout||g.done&&g.showdown)&&!p.fold?p.cards:[null,null]})),board:g.board,turn:g.turn,dealer:g.dealer,street:g.street,pot:g.pot,current:g.current,done:g.done,showdown:g.showdown??false,runout:g.runout,paid:g.paid??[],legal:g.legal(i),last:g.events.at(-1)??null,events:g.events.map((e,id)=>({...e,id})).slice(-32)}}
 if(r.mode==='guandan'){room.game={hand:g.hands[i],remaining:g.done?g.hands:undefined,counts:g.hands.map(h=>h.length),level:g.level,turn:g.turn,target:g.target,owner:g.owner,last:g.last,status:g.status,finish:g.finish,done:g.done,trick:g.trick,actions:g.actions,tributeLog:g.tributeLog,returning:g.returns[0]??null,returnIds:g.returns[0]?.from===i?r.match.returnOptions(i).map(c=>c.id):[],levels:r.match.levels,champion:r.match.champion,result:g.result??null}}
 if(r.mode==='bigtwo'){room.game={hand:g.hands[i],remaining:g.done?g.hands:undefined,counts:g.hands.map(h=>h.length),turn:g.turn,target:g.target,owner:g.owner,last:g.last,status:g.status,finish:g.finish,done:g.done,trick:g.trick,actions:g.actions,opening:g.opening,finishType:g.finishType??null,opts:g.opts,round:r.match.round,total:r.match.total,value:r.match.value??normalizeValue(r.value),result:r.match.result??null}}
 if(r.mode==='roulette')room.game=rouletteView(g);
 if(r.mode==='blackjack'){room.game=blackjackView(g);}
 if(r.mode==='craps'){room.game={table:clone(g.tables[i]),point:g.point,phase:g.phase,roller:g.roller,roll:g.roll,others:g.tables.map((t,n)=>({name:r.seats[n].name,bank:t.bank,escrow:t.escrow,bets:t.bets,travel:t.travel,last:t.history[0]??null}))}}
 return room
}
