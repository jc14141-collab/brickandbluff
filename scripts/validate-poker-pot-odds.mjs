// Hand-calculated checks of call amounts, pot size, minimum raise, all-in handling, side pots
// and the pot / price used inside the production decide().
//   node scripts/validate-poker-pot-odds.mjs
// Writes .build/poker-validation/pot-odds.json; exit 1 if any check fails.
// Every expected number below is worked out by hand in the comment next to it; nothing is
// computed by calling the code under test. Blinds 10/20 unless stated.
import fs from 'node:fs';
import {Poker} from '../dist/poker.mjs';
import {decide} from '../dist/strategy.mjs';
const results=[];let failed=0;
function check(group,name,actual,expected,note){const ok=JSON.stringify(actual)===JSON.stringify(expected);results.push({group,name,ok,expected,actual,...(note?{note}:{})});if(!ok){failed++;console.error('FAIL',group,name,'expected',JSON.stringify(expected),'got',JSON.stringify(actual))}}
const SUITS={s:'♠',h:'♥',c:'♣',d:'♦'};
const card=t=>{const m=t.match(/^(10|[2-9TJQKA])([shcd])$/),r={T:10,J:11,Q:12,K:13,A:14}[m[1]]??Number(m[1]);return{r,s:SUITS[m[2]]}};
const cards=s=>s.split(/\s+/).map(card);
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
const pick=(l,keys)=>Object.fromEntries(keys.map(k=>[k,l[k]]));
const L=['call','owe','min','max','canRaise','allIn'];
// decide()'s price: returns potOdds = owe/(pot+owe) on the non-unopened path. We check it
// against the hand-computed effective pot, and that the action is legal, over 40 seeds.
function decideOdds(g,expectedPot){const i=g.turn,s=g.snapshot(i),l=s.legal;let odds=null,illegal=0;
 for(let k=0;k<40;k++){const d=decide(s,k%9,{samples:60,rng:rng(500+k)});odds=d.potOdds;
  if(d.action==='raise'&&(!l.canRaise||d.target>l.max||d.target<=s.current||(d.target<l.min&&d.target!==l.max)))illegal++;
  if(d.action==='check'&&l.owe)illegal++;}
 return{potOdds:+odds.toFixed(6),expected:+(l.call/(expectedPot+l.call)).toFixed(6),illegalActions:illegal}}
const odds=(g,pot)=>{const r=decideOdds(g,pot);return[r.potOdds===r.expected,r.illegalActions]};
// ---------- heads-up preflop ----------
{const g=new Poker([2000,2000],{dealer:0,rng:rng(1)});
 // dealer posts SB 10 and acts first; owes 10; min raise to 20+20=40; max 10+1990=2000.
 check('legal','单挑翻前 小盲（庄位）先行动',pick(g.legal(),L),{call:10,owe:10,min:40,max:2000,canRaise:true,allIn:true});
 check('pot','单挑翻前 底池',g.pot,30);
 g.act(0,'raise',60);// raise to 60: increment 40 -> lastRaise 40
 // BB owes 40; min = 60+40 = 100.
 check('legal','单挑翻前 大盲面对加注到 60',pick(g.legal(),L),{call:40,owe:40,min:100,max:2000,canRaise:true,allIn:true});
 // decide pot = min(60,60)+min(20,60) = 80; potOdds = 40/120.
 check('decide-price','单挑翻前 大盲面对加注 决策底池与跟注额',odds(g,80),[true,0]);
}
// ---------- 4 players: open, cold call, squeeze spots ----------
{const g=new Poker([2000,2000,2000,2000],{dealer:0,rng:rng(2)});// SB=1, BB=2, UTG=3 acts first
 check('legal','四人翻前 枪口位首先行动',[g.turn,pick(g.legal(),L)],[3,{call:20,owe:20,min:40,max:2000,canRaise:true,allIn:true}]);
 g.act(3,'raise',60);g.act(0,'call');// open to 60, button cold-calls
 // SB: bet 10, owes 50, min = 60+40 = 100, max = 10+1990 = 2000.
 check('legal','四人 开池+冷跟后 小盲',pick(g.legal(),L),{call:50,owe:50,min:100,max:2000,canRaise:true,allIn:true});
 // pot = 60+60+10+20 = 150 -> decide pot 150 (no one capped), potOdds = 50/200.
 check('pot','四人 开池+冷跟后 底池',g.pot,150);
 check('decide-price','四人 开池+冷跟后 小盲 决策底池与跟注额',odds(g,150),[true,0]);
 g.act(1,'call');
 // BB owes 40, pot 60*3+20 = 200, potOdds = 40/240.
 check('decide-price','四人 开池+两家冷跟后 大盲',odds(g,200),[true,0]);
}
{const g=new Poker([2000,2000,2000,2000],{dealer:0,rng:rng(3)});
 g.act(3,'raise',60);g.act(0,'raise',180);g.act(1,'fold');// open 60, 3-bet to 180 (increment 120), SB folds
 // BB: owes 160, min = 180+120 = 300; pot = 60+180+10+20 = 270; potOdds = 160/430.
 check('legal','四人 3bet 后 大盲',pick(g.legal(),L),{call:160,owe:160,min:300,max:2000,canRaise:true,allIn:true});
 check('decide-price','四人 3bet 后 大盲 决策底池与跟注额（含死钱）',odds(g,270),[true,0]);
 g.act(2,'fold');
 // Opener: bet 60, owes 120, min 300.
 check('legal','四人 3bet 后 回到开池者',pick(g.legal(),L),{call:120,owe:120,min:300,max:2000,canRaise:true,allIn:true});
 check('decide-price','四人 3bet 后 开池者 决策底池',odds(g,270),[true,0]);
}
// ---------- short stack: call capped, effective pot ----------
{const g=new Poker([2000,2000,100,2000],{dealer:0,rng:rng(4)});
 g.act(3,'raise',60);g.act(0,'raise',180);g.act(1,'fold');
 // BB has 100 total (20 posted, 80 behind): owes 160 but can only call 80; cannot raise (max 100 <= 180).
 check('legal','短码大盲面对 3bet',pick(g.legal(),L),{call:80,owe:160,min:300,max:100,canRaise:false,allIn:true});
 // Effective pot for BB: min(60,100)+min(180,100)+min(10,100)+min(20,100) = 190; potOdds = 80/270.
 check('decide-price','短码大盲 有效底池只计可赢部分',odds(g,190),[true,0]);
}
// ---------- incomplete all-in does not reopen ----------
{const g=new Poker([2000,150,2000],{dealer:0,rng:rng(5)});// 3 players: dealer acts first preflop
 g.act(0,'raise',100);// increment 80 -> lastRaise 80
 g.act(1,'allin');// SB all-in to 150: increment 50 < 80, incomplete
 // BB has not acted: may raise, min = 150+80 = 230.
 check('legal','不完整全下后 未行动的大盲可加注',pick(g.legal(),L),{call:130,owe:130,min:230,max:2000,canRaise:true,allIn:true});
 g.act(2,'call');
 // Dealer already acted at 100; 150-100 = 50 < 80: not reopened -> call or fold only.
 check('legal','不完整全下后 已行动者不能再加注',pick(g.legal(),L),{call:50,owe:50,min:230,max:2000,canRaise:false,allIn:false});
 // pot = 100+150+150 = 400; potOdds = 50/450.
 check('decide-price','不完整全下后 决策只能跟或弃，底池正确',odds(g,400),[true,0]);
}
{const g=new Poker([2000,300,2000],{dealer:0,rng:rng(6)});
 g.act(0,'raise',100);g.act(1,'allin');// all-in to 300: increment 200 >= 80 -> full raise, lastRaise 200
 g.act(2,'call');
 // Dealer reopened; min = 300+200 = 500.
 check('legal','完整全下加注后 重新开放加注',pick(g.legal(),L),{call:200,owe:200,min:500,max:2000,canRaise:true,allIn:true});
}
{const g=new Poker([2000,300,2000],{dealer:0,rng:rng(7)});
 g.act(0,'raise',100);g.act(1,'allin');g.act(2,'fold');
 // Only opponent is all-in: nobody left to raise against.
 check('legal','唯一对手已全下时不能加注',pick(g.legal(),L),{call:200,owe:200,min:500,max:2000,canRaise:false,allIn:false});
}
// ---------- postflop minimum bet / raise ----------
{const g=new Poker([2000,2000],{dealer:0,rng:rng(8)});
 g.act(0,'call');g.act(1,'check');g.advance();// flop, pot 40, BB (seat 1) acts first
 // Bets reset each street: max = 0 + 1980 behind.
 check('legal','翻牌 无人下注 最小下注 = 大盲',[g.turn,pick(g.legal(),L)],[1,{call:0,owe:0,min:20,max:1980,canRaise:true,allIn:true}]);
 g.act(1,'raise',100);
 // owe 100, min raise = 100+100 = 200.
 check('legal','翻牌 面对下注 100 最小加注到 200',pick(g.legal(),L),{call:100,owe:100,min:200,max:1980,canRaise:true,allIn:true});
 // pot 40+100 = 140; potOdds = 100/240.
 check('decide-price','翻牌 面对下注 决策底池',odds(g,140),[true,0]);
 g.act(0,'raise',300);
 // owe 200, min = 300+200 = 500.
 check('legal','翻牌 面对加注到 300 最小再加注到 500',pick(g.legal(),L),{call:200,owe:200,min:500,max:1980,canRaise:true,allIn:true});
 let threw=false;try{g.act(1,'raise',450)}catch{threw=true}
 check('legal','低于最小加注且非全下的额度被拒绝',threw,true);
}
// ---------- side pots and returned chips ----------
function rig(g,holes,board){holes.forEach((h,i)=>g.players[i].cards=cards(h));const b=cards(board),burn=card('2c');g.deck=[b[4],burn,b[3],burn,b[2],b[1],b[0],burn];}
// Plays the rest of the hand: everyone checks when betting is still open, otherwise deal.
function runout(g){let n=0;while(!g.done&&n++<40){if(g.pending.size){if(g.legal().owe)throw Error('unexpected bet pending');g.act(g.turn,'check')}else g.advance()}}
{const g=new Poker([100,300,500],{dealer:0,rng:rng(9)});
 rig(g,['As Ad','Ks Kd','Qs Qd'],'2h 7d 9h Js 3s');
 g.act(0,'allin');g.act(1,'allin');g.act(2,'call');runout(g);
 // Main pot 100x3 = 300 -> AA. Side pot (300-100)x2 = 400 -> KK. QQ called 300, keeps 200.
 check('side-pot','三人不同筹码全下 主池/边池分配',g.players.map(p=>p.chips),[300,400,200]);
}
{const g=new Poker([100,300,500],{dealer:0,rng:rng(10)});
 rig(g,['As Ad','Ks Kd','Qs Qd'],'2h 7d 9h Js 3s');
 g.act(0,'allin');g.act(1,'call');g.act(2,'raise',500);g.act(1,'call');// SB re-calls to 300 all-in
 runout(g);
 // Totals 100/300/500: QQ's uncalled 200 returned -> totals 100/300/300; same split as above.
 check('side-pot','超额未被跟注部分退回',g.players.map(p=>p.chips),[300,400,200]);
}
{const g=new Poker([1000,1000,1000],{dealer:0,smallBlind:5,rng:rng(11)});
 rig(g,['2c 3d','4c 5d','6c 7d'],'As Ks Qs Js 10s');
 g.act(0,'call');g.act(1,'fold');g.act(2,'check');runout(g);
 // Pot 10+5+10 = 25, board plays for both -> 13/12; odd chip to the first winner left of the dealer (seat 2).
 check('side-pot','平分底池 奇数筹码给庄位左侧第一位',[g.players[0].chips,g.players[2].chips],[1002,1003]);
}
// ---------- decide(): price consistency findings ----------
// (a) Solo-practice skill pot: Poker.pot includes skillPot, decide()'s pot does not.
{const g=new Poker([2000,2000],{dealer:0,rng:rng(12)});g.act(0,'raise',60);g.skillPot=200;
 const s=g.snapshot(1),d=decide(s,0,{samples:60,rng:rng(1)});
 // With the skill pot the true price is 40/(80+200+40) = 0.125; decide uses 40/(80+40) = 0.3333.
 check('decide-price-finding','单人练习技能底池（skillPot）未计入决策底池',+d.potOdds.toFixed(4),0.125,'仅单人练习模式使用技能时出现；线上好友房无 skillPot');
}
// (b) Raise valuation when facing a bet. Restated from dist/strategy.mjs decide():
//   value = allFold*pot + (1-allFold)*(calledEq*(pot+effective*2)-effective), effective≈cost=to-myBet.
// Hand case, heads-up flop: pot 200 from preflop, opponent bets 100, we have 0 in. Raise to 300.
// If called, the final pot is 200+100(bet)+300(our raise)+200(their call) = 800.
// decide's pot = 300 (includes their 100), so pot+2*effective = 300+600 = 900: the bettor's 100
// already in the pot is counted twice. Overcount = owe.
{const pot=300,cost=300,effective=cost,trueFinal=200+100+300+200;
 check('decide-price-finding','面对下注时加注的被跟注后底池（公式重述）',pot+2*effective,trueFinal,'被跟注分支把对手已下的注重复计算一次，多算的额度 = 需跟注额');
}
// Frequency and size of (b) in play: v127 self-play, decisions with a raise option while facing a bet.
{let decisions=0,facing=0,overSum=0,maxOver=0;
 for(const players of [2,3,4])for(let h=1;h<=150;h++){const g=new Poker(Array(players).fill(2000),{dealer:h%players,rng:rng(h*13+players)});let k=0;
  while(!g.done&&k++<200){if(!g.pending.size){g.advance();continue}const i=g.turn,s=g.snapshot(i),l=s.legal,p=s.players[i];
   const pot=Math.max(s.bigBlind,s.players.reduce((n,q)=>n+Math.min(q.total,p.total+l.call),0));
   if(s.street>0&&l.canRaise){decisions++;if(l.owe>0){facing++;const over=l.call/(pot+l.call);overSum+=over;maxOver=Math.max(maxOver,over)}}
   const d=decide(s,(h+i)%9,{samples:60,rng:rng(h*1000+k)});g.act(i,d.action,d.target)}}
 results.push({group:'decide-price-finding',name:'翻后可加注决策中面对下注的比例与重复计算幅度（自对局统计，信息项）',ok:true,info:{postflopRaiseOptions:decisions,facingBet:facing,share:+(facing/decisions).toFixed(3),meanOvercountAsShareOfPotAfterCall:+(overSum/facing).toFixed(3),maxOvercountShare:+maxOver.toFixed(3)}});
}
const summary={generated:new Date().toISOString(),checks:results.length,failed,results};
fs.mkdirSync('.build/poker-validation',{recursive:true});fs.writeFileSync('.build/poker-validation/pot-odds.json',JSON.stringify(summary,null,1));
for(const r of results)console.log((r.ok?'PASS ':'FAIL ')+r.group.padEnd(22)+r.name+(r.info?' '+JSON.stringify(r.info):''));
console.log(JSON.stringify({checks:results.length,failed}));
process.exit(failed?1:0);
