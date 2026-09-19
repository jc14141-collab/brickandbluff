// 服务端房间集成测试：不依赖 Cloudflare D1，直接驱动 rooms.mjs 的纯函数。
import {MODES,createRoom,command,tick,snapshot,pack,unpack,minimumPlayers,seatOf} from '../server/rooms.mjs';
import {BigTwo,BigTwoMatch} from '../dist/bigtwo.mjs';

let pass=0,fail=0;
const ok=(n,c,e='')=>{c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+' '+e))};

console.log('— 模式注册 —');
ok('MODES 含 bigtwo',MODES.includes('bigtwo'),MODES.join(','));

console.log('— 建房 —');
const r=createRoom('auth-0',{mode:'bigtwo',capacity:4,name:'房主',role:0},1000);
ok('mode 正确',r.mode==='bigtwo');
ok('capacity 固定为 4',r.capacity===4,r.capacity);
ok('最少 4 人',minimumPlayers(r)===4,minimumPlayers(r));
ok('初始无 game',r.game===null);
// 与掼蛋一致：人数被强制为 4，忽略传入的 capacity（不报错）。
const forced=createRoom('x',{mode:'bigtwo',capacity:3,name:'n',role:0});
ok('bigtwo capacity 强制为 4',forced.capacity===4,forced.capacity);

console.log('— 补满电脑并开局 —');
for(let i=0;i<3;i++)command(r,'auth-0',{kind:'addBot',role:i+1},1000+i);
ok('座位数 4',r.seats.length===4,r.seats.length);
ok('电脑标记正确',r.seats.filter(s=>s.bot).length===3);
console.log('— 每张牌的价值（准备区）—');
ok('房间默认牌值 10',r.value===10,r.value);
command(r,'auth-0',{kind:'value',value:50},1050);
ok('房主可改牌值',r.value===50,r.value);
ok('准备区快照同步 value',snapshot(r,'auth-0',1050).value===50);
let refused=false;try{command(r,'auth-1',{kind:'value',value:80},1050)}catch(e){refused=true}
ok('非房主不能改牌值',refused);
command(r,'auth-0',{kind:'value',value:1000},1050);
ok('越界牌值夹到 100',r.value===100,r.value);
command(r,'auth-0',{kind:'value',value:7},1050);
ok('过小牌值夹到 10',r.value===10,r.value);
command(r,'auth-0',{kind:'value',value:55},1050);
ok('非整十牌值吸附到 60',r.value===60,r.value);
command(r,'auth-0',{kind:'value',value:20},1050);
ok('牌值设为 20',r.value===20,r.value);

command(r,'auth-0',{kind:'start'},1100);
ok('状态进入 playing',r.status==='playing',r.status);
ok('game 已创建',!!r.game);
ok('四人各 13 张',r.game.hands.every(h=>h.length===13),r.game.hands.map(h=>h.length).join(','));
ok('总牌数 52',r.game.hands.reduce((a,h)=>a+h.length,0)===52);
ok('match 已创建',!!r.match&&r.match.round===1,r.match?.round);
ok('首手标记 opening',r.game.opening===true);
ok('持方块3者先出',r.game.hands[r.game.turn].some(c=>c.r===3&&c.s==='♦'));

console.log('— snapshot 结构 —');
const snap=snapshot(r,'auth-0',1200);
ok('you=0',snap.you===0);
ok('mode=bigtwo',snap.mode==='bigtwo');
ok('game.hand 13 张',snap.game.hand.length===13,snap.game.hand.length);
ok('game.counts 长度 4',snap.game.counts.length===4);
ok('game.opts 随对局下发',!!snap.game.opts&&snap.game.opts.bombBeatsTwo===false,JSON.stringify(snap.game.opts));
ok('game.round=1',snap.game.round===1);
ok('game.total 为 4 个 0',Array.isArray(snap.game.total)&&snap.game.total.every(v=>v===0),JSON.stringify(snap.game.total));
ok('对局结束前 result 为 null',snap.game.result===null);
ok('未结束时不下发 remaining',snap.game.remaining===undefined);

console.log('— pack / unpack 往返 —');
const raw=pack(r);
const back=unpack(raw);
ok('hands 保留',back.game.hands.every(h=>h.length===13));
ok('BigTwo 原型恢复',back.game instanceof BigTwo);
ok('BigTwoMatch 原型恢复',back.match instanceof BigTwoMatch&&typeof back.match.settle==='function');
ok('pending 恢复为 Set',back.game.pending instanceof Set);
ok('turn 保留',back.game.turn===r.game.turn);
ok('opening 保留',back.game.opening===r.game.opening);
ok('opts 保留',back.game.opts?.bombBeatsTwo===false);

console.log('— 开局后的牌值下发 —');
ok('快照下发 value',snapshot(r,'auth-0',1200).value===20);
ok('game.value 与房间一致',snapshot(r,'auth-0',1200).game.value===20);
ok('游戏中不能改牌值',(()=>{try{command(r,'auth-0',{kind:'value',value:30},1200);return false}catch{return true}})());
ok('改牌值失败后牌值不变',r.value===20,r.value);

console.log('— 电脑自动对局直到结束 —');
const banksBefore=r.seats.map(s=>s.bank);
const bankSumBefore=banksBefore.reduce((a,b)=>a+b,0);
let now=2000,guard=0;
while(r.status==='playing'&&guard++<20000){now+=1000;tick(r,now)}
ok('对局结束进入 roundEnd',r.status==='roundEnd',r.status);
ok('有赢家',r.game.done&&r.game.finish.length===1,r.game.finish);
ok('match 已结算',!!r.match.result);
const res=r.match.result;
ok('结算零和',res.scores.reduce((a,b)=>a+b,0)===0,JSON.stringify(res.scores));
ok('结算用了房间牌值 20',res.value===20,res.value);
const expectedPairs=res.counts.reduce((n,ci,i)=>n+res.counts.filter((cj,j)=>j!==i&&ci>cj).length,0);
ok('两两差额笔数与牌数差一致',res.pairs.length===expectedPairs,res.pairs.length+' vs '+expectedPairs);
ok('最多 6 笔',res.pairs.length<=6,res.pairs.length);
ok('牌数相同的玩家之间不结算',res.pairs.every(p=>res.counts[p.from]!==res.counts[p.to]));
ok('每笔都是牌多的付给牌少的',res.pairs.every(p=>res.counts[p.from]>res.counts[p.to]));
ok('每笔金额 = 差 × 牌值 × 倍数 × 收尾倍数',res.pairs.every(p=>p.amount===Math.round(p.diff*res.value*res.mults[p.from]*res.bonus)));
ok('赢家从不支出',!res.pairs.some(p=>p.from===res.winner));
ok('记录了赢家最后一手',!!r.game.finishType,r.game.finishType);
const banksAfter=r.seats.map(s=>s.bank);
const deltas=banksAfter.map((b,i)=>b-banksBefore[i]);
ok('筹码真的从输家转到赢家',deltas.some(d=>d!==0),JSON.stringify(deltas));
ok('桌面筹码变化 = 结算金额',JSON.stringify(deltas)===JSON.stringify(res.scores),JSON.stringify(deltas)+' vs '+JSON.stringify(res.scores));
ok('没人被扣成负筹码',banksAfter.every(b=>b>=0),JSON.stringify(banksAfter));
ok('桌面筹码总额守恒',banksAfter.reduce((a,b)=>a+b,0)===bankSumBefore,JSON.stringify(banksAfter));
ok('累计筹码 = 本副结算',JSON.stringify(r.match.total)===JSON.stringify(res.scores));
const after=snapshot(r,'auth-0',now);
ok('结束后下发 remaining',Array.isArray(after.game.remaining),typeof after.game.remaining);
ok('结束后下发 result',!!after.game.result);
ok('result.winner 是绝对座位号',Number.isInteger(after.game.result.winner),after.game.result.winner);
ok('result 带每副筹码输赢',Array.isArray(after.game.result.scores)&&after.game.result.scores.length===4,JSON.stringify(after.game.result.scores));
ok('result 带两两差额明细',Array.isArray(after.game.result.pairs),after.game.result.pairs?.length);
ok('快照带 seats.bank',after.seats.every(s=>Number.isFinite(s.bank)));

console.log('— 第二副继续累计 —');
r.seats.forEach(s=>s.ready=true);
const beforeTotal=[...r.match.total];
const banksBefore2=r.seats.map(s=>s.bank);
tick(r,now+7000);
ok('进入第二副',r.status==='playing'&&r.match.round===2,r.status+' round='+r.match.round);
ok('累计分保留',r.match.total.some((v,i)=>v===beforeTotal[i]),JSON.stringify(r.match.total));
ok('第二副沿用同一牌值',r.match.value===20,r.match.value);
let n2=now+7000,g2=0;
while(r.status==='playing'&&g2++<20000){n2+=1000;tick(r,n2)}
ok('第二副也正常结束',r.status==='roundEnd',r.status);
ok('两副后累计分变化',JSON.stringify(r.match.total)!==JSON.stringify(beforeTotal),JSON.stringify(r.match.total));
ok('两副累计仍零和',r.match.total.reduce((a,b)=>a+b,0)===0,JSON.stringify(r.match.total));
ok('第二副也动了筹码',r.seats.some((s,i)=>s.bank!==banksBefore2[i]));
ok('两副后仍无人负筹码',r.seats.every(s=>s.bank>=0),JSON.stringify(r.seats.map(s=>s.bank)));

console.log('— 开局后牌值锁定 —');
// 每张牌的价值只在开局前（lobby）设定一次。进入对局后，局间结算也不再允许改动，
// 否则同一桌的前后两副会用不同口径结算，累计筹码失去可比性。
const settledValue=r.match.result.value;
let lockedRefused=false;
try{command(r,'auth-0',{kind:'value',value:80},n2+1)}catch{lockedRefused=true}
ok('局间不能改牌值',lockedRefused);
ok('房间牌值保持不变',r.value===settledValue,r.value+' vs '+settledValue);
ok('match 牌值保持不变',r.match.value===settledValue,r.match.value);
ok('快照顶层仍是原牌值',snapshot(r,'auth-0',n2+2).value===settledValue,snapshot(r,'auth-0',n2+2).value);
ok('快照 game.value 也是原牌值',snapshot(r,'auth-0',n2+3).game.value===settledValue,snapshot(r,'auth-0',n2+3).game.value);
ok('已结算那一副的牌值不被改写',r.match.result.value===settledValue,settledValue+' -> '+r.match.result.value);
// 再打一副，确认沿用同一牌值
r.seats.forEach(s=>s.ready=true);
tick(r,n2+8000);
ok('第三副开始',r.status==='playing'&&r.match.round===3,r.status+' round='+r.match.round);
let nV=n2+8000,gV=0;
while(r.status==='playing'&&gV++<20000){nV+=1000;tick(r,nV)}
ok('第三副正常结束',r.status==='roundEnd',r.status);
ok('第三副沿用锁定牌值 '+settledValue,r.match.result.value===settledValue,r.match.result.value);

console.log('— 全下上限（桌面筹码很少）—');
const poor=createRoom('poor-0',{mode:'bigtwo',capacity:4,name:'穷',role:0},1000);
for(let i=0;i<3;i++)command(poor,'poor-0',{kind:'addBot',role:i+1},1000+i);
poor.seats.forEach(s=>{s.bank=50});
command(poor,'poor-0',{kind:'value',value:100},1100);
command(poor,'poor-0',{kind:'start'},1100);
ok('电脑按牌值自动补足筹码',poor.seats.filter(s=>s.bot).every(s=>s.bank>=Math.max(2000,100*200)),JSON.stringify(poor.seats.map(s=>s.bank)));
let n3=2000,g3=0;
while(poor.status==='playing'&&g3++<20000){n3+=1000;tick(poor,n3)}
ok('桌面只有 50 筹码也能打完一副',poor.status==='roundEnd',poor.status);
ok('全下后没人负筹码',poor.seats.every(s=>s.bank>=0),JSON.stringify(poor.seats.map(s=>s.bank)));
ok('全下后仍然零和',poor.match.result.scores.reduce((a,b)=>a+b,0)===0,JSON.stringify(poor.match.result.scores));
ok('全下金额不超过桌面筹码',poor.match.result.scores.every((v,i)=>v>=0||Math.abs(v)<=50||poor.seats[i].bank>0),JSON.stringify(poor.match.result.scores));

console.log(`\n通过 ${pass} · 失败 ${fail}`);
process.exit(fail?1:0);
