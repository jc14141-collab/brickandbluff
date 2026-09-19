import {BigTwo,settle,moveLabel} from '../dist/bigtwo.mjs';
import {chooseMove} from '../dist/bigtwo-strategy.mjs';

let pass=0,fail=0;
const ok=(n,c,e='')=>{c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+' '+e))};

console.log('— 策略对局（4 台电脑互打）—');
let done=0,turns=[],wins=[0,0,0,0],illegal=0,stuck=0;
for(let n=0;n<200;n++){
  const g=new BigTwo({random:Math.random});
  let guard=0;
  while(!g.done&&guard++<3000){
    const i=g.turn;
    let m=null;
    try{m=chooseMove(g.snapshot(i))}catch(e){illegal++;break}
    try{
      if(!m){g.act(i,[])}else{g.act(i,m.cards.map(c=>c.id))}
    }catch(e){illegal++;console.log('   非法出牌:',e.message);break}
  }
  if(g.done){done++;turns.push(guard);wins[g.finish[0]]++}else stuck++;
}
ok('200 局全部结束',done===200,'完成 '+done+' 卡住 '+stuck);
ok('无非法出牌',illegal===0,'非法 '+illegal);
ok('四个座位都有胜局',wins.every(w=>w>0),wins);
const avg=turns.reduce((a,b)=>a+b,0)/turns.length;
ok('平均回合数合理(15-120)',avg>=15&&avg<=120,'平均 '+avg.toFixed(1));
console.log('    平均 '+avg.toFixed(1)+' 回合/局，胜场分布 '+wins.join('/'));

console.log('— 保留大牌的倾向 —');
// 桌面是 A，手上只有 2 能压过；打完还剩两张牌，且没人逼近终点 —— 应选择不出。
const s={seat:0,counts:[5,9,11,8],owner:1,opening:false,target:null,hand:[],opts:undefined};
const mk=(r,su)=> ({id:r*10+su.charCodeAt(0),r,s:su});
s.target={type:'single',size:1,tier:0,power:14,suit:1,rank:14,cards:[mk(14,'♦')]};
s.hand=[mk(2,'♠'),mk(6,'♦'),mk(8,'♣')];
ok('只有 2 可压且对手手牌多时选择不出',chooseMove(s)===null);

console.log('— 但能一把走完时仍然出手 —');
s.hand=[mk(2,'♠')];
const last=chooseMove(s);
ok('打完即获胜时果断出 2',last&&last.cards[0].r===2,last?moveLabel(last):'null');

console.log('— 对手快出完时会拦牌 —');
s.counts=[5,1,11,8];
s.hand=[mk(2,'♠'),mk(5,'♦')];
const pick=chooseMove(s);
ok('上家只剩 1 张时用最大牌压死',pick&&pick.cards[0].r===2,pick?moveLabel(pick):'null');

console.log('— 能一把走完就走完 —');
const t={seat:0,counts:[2,9,11,8],owner:1,opening:false,opts:undefined,
  hand:[mk(9,'♠'),mk(9,'♥')],
  target:{type:'pair',size:2,tier:0,power:5,suit:1,rank:5,cards:[mk(5,'♦'),mk(5,'♣')]}};
const fin=chooseMove(t);
ok('对子能压且可走完时出对子',fin&&fin.type==='pair'&&fin.cards.length===2,fin?moveLabel(fin):'null');

console.log('— 首手约束下策略仍可出牌 —');
const o={seat:0,counts:[13,13,13,13],owner:-1,opening:true,target:null,opts:undefined,
  hand:[mk(3,'♦'),mk(7,'♠'),mk(9,'♥'),mk(11,'♣'),mk(13,'♦')]};
const open=chooseMove(o);
ok('开局策略给出含方块3的牌',open&&open.cards.some(c=>c.r===3&&c.s==='♦'),open?moveLabel(open):'null');

console.log('— 无牌可压时返回 null —');
const none={seat:0,counts:[5,9,11,8],owner:1,opening:false,opts:undefined,
  hand:[mk(4,'♦'),mk(5,'♦')],
  target:{type:'single',size:1,tier:0,power:15,suit:4,rank:2,cards:[mk(2,'♠')]}};
ok('压不过单张 ♠2 时返回 null',chooseMove(none)===null);

console.log(`\n通过 ${pass} · 失败 ${fail}`);
process.exit(fail?1:0);
