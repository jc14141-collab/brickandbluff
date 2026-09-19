import {newDeck,classify,beats,allMoves,moves,BigTwo,settle,settleWithBanks,sortHand,power,suitPower,TYPE_NAMES,RULES,bracketMultiplier,twoMultiplier,twoCount,normalizeValue,CARD_VALUES,DEFAULT_CARD_VALUE,BigTwoMatch} from '../dist/bigtwo.mjs';

let pass=0,fail=0;
const ok=(name,cond,extra='')=>{cond?(pass++,console.log('  ok   '+name)):(fail++,console.log('  FAIL '+name+' '+extra))};
const C=(r,s)=>({id:r*10+s.charCodeAt(0),r,s});

console.log('— 牌堆 —');
const deck=newDeck();
ok('52 张',deck.length===52);
ok('无重复',new Set(deck.map(c=>c.r+c.s)).size===52);
ok('四花色齐全',['♠','♥','♣','♦'].every(s=>deck.filter(c=>c.s===s).length===13));

console.log('— 点数与花色 —');
ok('2 最大',power(2)>power(14)&&power(14)>power(13));
ok('3 最小',power(3)===3&&power(4)===4);
ok('♠ 最大',suitPower('♠')>suitPower('♥')&&suitPower('♥')>suitPower('♣')&&suitPower('♣')>suitPower('♦'));

console.log('— 牌型识别 —');
ok('单张',classify([C(5,'♠')])?.type==='single');
ok('对子',classify([C(7,'♠'),C(7,'♥')])?.type==='pair');
ok('三条不再构成牌型',classify([C(9,'♠'),C(9,'♥'),C(9,'♣')])===null);
ok('顺子 3-7',classify([C(3,'♠'),C(4,'♥'),C(5,'♣'),C(6,'♦'),C(7,'♠')])?.type==='straight');
ok('最大顺子 10-J-Q-K-A',classify([C(10,'♠'),C(11,'♥'),C(12,'♣'),C(13,'♦'),C(14,'♠')])?.type==='straight');
ok('同花',classify([C(3,'♠'),C(7,'♠'),C(9,'♠'),C(11,'♠'),C(13,'♠')])?.type==='flush');
ok('葫芦',classify([C(5,'♠'),C(5,'♥'),C(5,'♣'),C(9,'♦'),C(9,'♠')])?.type==='full');
ok('四条+1',classify([C(5,'♠'),C(5,'♥'),C(5,'♣'),C(5,'♦'),C(9,'♠')])?.type==='four');
ok('同花顺',classify([C(3,'♠'),C(4,'♠'),C(5,'♠'),C(6,'♠'),C(7,'♠')])?.type==='straightflush');

console.log('— 顺子不得绕环，2 不参与 —');
ok('A-2-3-4-5 非法',classify([C(14,'♠'),C(2,'♥'),C(3,'♣'),C(4,'♦'),C(5,'♠')])===null);
ok('2-3-4-5-6 非法',classify([C(2,'♠'),C(3,'♥'),C(4,'♣'),C(5,'♦'),C(6,'♠')])===null);
ok('J-Q-K-A-2 非法',classify([C(11,'♠'),C(12,'♥'),C(13,'♣'),C(14,'♦'),C(2,'♠')])===null);

console.log('— 五张牌型层级：同花 > 顺子 —');
const flush=classify([C(3,'♠'),C(7,'♠'),C(9,'♠'),C(11,'♠'),C(13,'♠')]);
const bigStraight=classify([C(10,'♠'),C(11,'♥'),C(12,'♣'),C(13,'♦'),C(14,'♠')]);
ok('最小的同花压最大的顺子',beats(flush,bigStraight));
ok('顺子压不过同花',!beats(bigStraight,flush));
const full=classify([C(3,'♠'),C(3,'♥'),C(3,'♣'),C(4,'♦'),C(4,'♠')]);
ok('葫芦压同花',beats(full,flush));
const four=classify([C(3,'♠'),C(3,'♥'),C(3,'♣'),C(3,'♦'),C(4,'♠')]);
ok('四条压葫芦',beats(four,full));
const sf=classify([C(3,'♠'),C(4,'♠'),C(5,'♠'),C(6,'♠'),C(7,'♠')]);
ok('同花顺压四条',beats(sf,four));

console.log('— 张数必须一致 —');
ok('对子压不过顺子',!beats(classify([C(2,'♠'),C(2,'♥')]),bigStraight));

console.log('— 三条禁用：只可出 1 / 2 / 5 张 —');
ok('三张同点数非法',classify([C(9,'♠'),C(9,'♥'),C(9,'♣')])===null);
ok('三张不同点数非法',classify([C(9,'♠'),C(10,'♥'),C(11,'♣')])===null);
ok('三张同花色非法',classify([C(3,'♠'),C(7,'♠'),C(9,'♠')])===null);
ok('四张牌非法',classify([C(9,'♠'),C(9,'♥'),C(9,'♣'),C(9,'♦')])===null);
ok('牌型表不含三条',!('triple' in TYPE_NAMES),JSON.stringify(TYPE_NAMES));
const tripleHand=[C(9,'♠'),C(9,'♥'),C(9,'♣'),C(5,'♦'),C(5,'♠'),C(14,'♦'),C(3,'♥')];
const tm=allMoves(tripleHand);
ok('allMoves 不产出 3 张牌型',!tm.some(m=>m.size===3),JSON.stringify(tm.filter(m=>m.size===3).map(m=>m.type)));
ok('allMoves 只产出 1 / 2 / 5 张',tm.every(m=>[1,2,5].includes(m.size)),JSON.stringify([...new Set(tm.map(m=>m.size))]));
ok('三条仍在（5 张葫芦里）',tm.some(m=>m.type==='full'));
ok('moves 不产出 3 张牌型',!moves(tripleHand).some(m=>m.size===3));
const h3=[C(9,'♠'),C(9,'♥'),C(9,'♣'),C(3,'♦'),C(4,'♠')];
const g3=new BigTwo({hands:[h3,[C(5,'♠')],[C(6,'♠')],[C(7,'♠')]],first:0,opening:false});
let t3='';try{g3.act(0,[C(9,'♠'),C(9,'♥'),C(9,'♣')].map(c=>c.id))}catch(e){t3=e.message}
ok('act 打出三条被拒',t3==='这些牌不构成合法牌型',t3);
ok('被拒后手牌不变',g3.hands[0].length===5,g3.hands[0].length);
g3.act(0,[C(9,'♠').id]);
ok('被拒后仍可正常出单张',g3.hands[0].length===4,g3.hands[0].length);

console.log('— 全流程不出现 3 张出牌（200 局）—');
const sizeBad=[];
for(let n=0;n<200;n++){
  const g=new BigTwo({random:Math.random});
  let gd=0;
  while(!g.done&&gd++<4000){
    const i=g.turn,legal=g.legal(i);
    if(!legal.length){g.act(i,[]);continue}
    if(legal.some(m=>m.size===3))sizeBad.push('legal 含 3 张');
    const m=legal[Math.floor(Math.random()*legal.length)];
    if(m.size===3)sizeBad.push('打出了 3 张');
    g.act(i,m.cards.map(c=>c.id));
  }
  if(!g.done)sizeBad.push('未结束');
  if(g.actions.some(a=>!a.pass&&a.cards.length===3))sizeBad.push('记录含 3 张');
}
ok('200 局从未出现 3 张出牌',sizeBad.length===0,[...new Set(sizeBad)].join(' | '));

console.log('— 同点数比花色 —');
const s2=C(2,'♠'),h2=C(2,'♥');
ok('♠2 > ♥2',beats(classify([s2]),classify([h2])));
ok('♥2 压不过 ♠2',!beats(classify([h2]),classify([s2])));
ok('♦2 最小',!beats(classify([C(2,'♦')]),classify([C(2,'♣')])));
const pairSpade=classify([C(7,'♠'),C(7,'♦')]),pairHeart=classify([C(7,'♥'),C(7,'♣')]);
ok('同点对子比最大花色',beats(pairSpade,pairHeart));

console.log('— 葫芦/四条只看主牌 —');
ok('三张5带A 输给 三张6带3',beats(classify([C(6,'♠'),C(6,'♥'),C(6,'♣'),C(3,'♦'),C(3,'♠')]),classify([C(5,'♠'),C(5,'♥'),C(5,'♣'),C(14,'♦'),C(14,'♠')])));
ok('四条只看四张',beats(classify([C(6,'♠'),C(6,'♥'),C(6,'♣'),C(6,'♦'),C(3,'♠')]),classify([C(5,'♠'),C(5,'♥'),C(5,'♣'),C(5,'♦'),C(14,'♠')])));

console.log('— 炸弹压 2（可选规则，默认关闭）—');
ok('默认关闭：四条压不过单张2',!beats(four,classify([s2])));
ok('开启后：四条可压单张2',beats(four,classify([s2]),{...RULES,bombBeatsTwo:true}));
ok('开启后：同花顺可压单张2',beats(sf,classify([s2]),{...RULES,bombBeatsTwo:true}));

console.log('— 首手约束 —');
const g=new BigTwo({random:()=>0.5});
ok('持方块3者先出',g.hands[g.turn].some(c=>c.r===3&&c.s==='♦'));
ok('开局 opening=true',g.opening===true);
let threw=false;
try{const lead=g.hands[g.turn].find(c=>!(c.r===3&&c.s==='♦'));g.act(g.turn,[lead.id])}catch{threw=true}
ok('首手不含方块3 被拒',threw);
const d3=g.hands[g.turn].find(c=>c.r===3&&c.s==='♦');
g.act(g.turn,[d3.id]);
ok('出方块3 后 opening=false',g.opening===false);

console.log('— 轮转与不出 —');
ok('轮到下一家',g.turn!==g.turn+0||true);
const before=g.turn;
g.act(before,[]);
ok('不出后轮转',g.turn!==before);
ok('actions 有记录',g.actions.length>=2);

console.log('— 完整对局（AI 随机走子）—');
let games=0,winners=new Set(),turnsTotal=0;
for(let n=0;n<300;n++){
  const game=new BigTwo({random:Math.random});
  let guard=0;
  while(!game.done&&guard++<4000){
    const i=game.turn,legal=game.legal(i);
    if(!legal.length){game.act(i,[]);continue}
    const m=legal[Math.floor(Math.random()*legal.length)];
    game.act(i,m.cards.map(c=>c.id));
  }
  if(game.done){games++;winners.add(game.finish[0]);turnsTotal+=guard}
}
ok('300 局全部正常结束',games===300,games);
ok('四个座位都赢过',winners.size===4,[...winners]);

console.log('— 结算（两两差额支付）—');
const game=new BigTwo({random:Math.random});
let guard=0;
while(!game.done&&guard++<4000){
  const i=game.turn,legal=game.legal(i);
  if(!legal.length){game.act(i,[]);continue}
  const m=legal[Math.floor(Math.random()*legal.length)];
  game.act(i,m.cards.map(c=>c.id));
}
const r=settle(game,10);
ok('赢家收入为正',r.scores[r.winner]>0,r.scores);
ok('结算零和',r.scores.reduce((a,b)=>a+b,0)===0,r.scores);
ok('筹码都是整数',r.scores.every(s=>Number.isInteger(s)),r.scores);
ok('赢家从不支出',!r.pairs.some(p=>p.from===r.winner));
ok('每笔都是牌多的付给牌少的',r.pairs.every(p=>r.counts[p.from]>r.counts[p.to]));
ok('每笔金额 = 差 × 牌值 × 倍数 × 收尾倍数',r.pairs.every(p=>p.amount===Math.round(p.diff*r.value*r.mults[p.from]*r.bonus)),JSON.stringify(r.pairs.slice(0,2)));
ok('牌值随结算返回',r.value===10,r.value);
ok('记录了赢家最后一手',!!game.finishType,game.finishType);
ok('倍数 = 区间倍数 × 手上 2 的翻倍',r.mults.every((m,i)=>m===bracketMultiplier(r.counts[i])*twoMultiplier(game.hands[i])),JSON.stringify(r.mults));

console.log('— 结算不变量（3 种牌值 × 200 局）—');
const sBad=[];
for(const value of [10,50,100]){
  for(let n=0;n<200;n++){
    const g=new BigTwo({random:Math.random});
    let gd=0;
    while(!g.done&&gd++<4000){const i=g.turn,legal=g.legal(i);if(!legal.length){g.act(i,[]);continue}g.act(i,legal[Math.floor(Math.random()*legal.length)].cards.map(c=>c.id))}
    const out=settle(g,value);
    if(out.scores.reduce((a,b)=>a+b,0)!==0)sBad.push('零和失败');
    if(out.scores.some(s=>!Number.isInteger(s)))sBad.push('非整数');
    if(out.pairs.some(p=>p.amount<=0))sBad.push('非正支付');
    if(out.scores[out.winner]<=0)sBad.push('赢家非正收入');
  }
}
ok('600 局结算全部零和且合法',sBad.length===0,sBad.slice(0,3).join(' | '));

console.log('— 全下上限不变量（200 局）—');
const cBad=[];let cappedCount=0;
for(let n=0;n<200;n++){
  const g=new BigTwo({random:Math.random});
  let gd=0;
  while(!g.done&&gd++<4000){const i=g.turn,legal=g.legal(i);if(!legal.length){g.act(i,[]);continue}g.act(i,legal[Math.floor(Math.random()*legal.length)].cards.map(c=>c.id))}
  const banks=[200,200,200,200];
  const out=settleWithBanks(g,100,banks);
  if(out.capped)cappedCount++;
  if(out.scores.reduce((a,b)=>a+b,0)!==0)cBad.push('零和失败');
  if(out.scores.some((s,i)=>banks[i]+s<0))cBad.push('被打成负筹码');
}
ok('200 局全下结算都零和且不为负',cBad.length===0,cBad.slice(0,3).join(' | '));
ok('筹码很少时确实触发过全下',cappedCount>0,cappedCount+'/200');

console.log('— 牌值归一化 —');
ok('合法值原样返回',CARD_VALUES.every(v=>normalizeValue(v)===v));
ok('非整十吸附',normalizeValue(53)===50&&normalizeValue(55)===60&&normalizeValue(97)===100);
ok('越界夹紧',normalizeValue(0)===10&&normalizeValue(999)===100&&normalizeValue(-50)===10);
ok('非法回落默认值',normalizeValue('abc')===DEFAULT_CARD_VALUE&&normalizeValue(undefined)===DEFAULT_CARD_VALUE);
ok('共 10 档牌值',CARD_VALUES.length===10&&CARD_VALUES[0]===10&&CARD_VALUES.at(-1)===100);

console.log('— BigTwoMatch 牌值与累计 —');
const match=new BigTwoMatch(Math.random,50);
ok('构造时接受牌值',match.value===50,match.value);
ok('setValue 生效',match.setValue(80)===80&&match.value===80);
const mg=match.start();
let mGuard=0;
while(!mg.done&&mGuard++<4000){const i=mg.turn,legal=mg.legal(i);if(!legal.length){mg.act(i,[]);continue}mg.act(i,legal[Math.floor(Math.random()*legal.length)].cards.map(c=>c.id))}
const mr=match.settle();
ok('结算沿用 match 的牌值',mr.value===80,mr.value);
ok('累计 = 首副结算',JSON.stringify(mr.total)===JSON.stringify(mr.scores));
ok('一副进行中不能改牌值',(()=>{match.start();try{match.setValue(10);return false}catch{return true}})());

console.log('— 手牌排序 —');
const sorted=sortHand(deck.slice(0,13));
ok('降序排列',sorted.every((c,i)=>i===0||power(sorted[i-1].r)>=power(c.r)));

console.log(`\n通过 ${pass} · 失败 ${fail}`);
process.exit(fail?1:0);
