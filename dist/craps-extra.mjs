import {roundChips} from './chips.mjs';
const numbers=[4,5,6,8,9,10];
const ratio=n=>[4,10].includes(n)?2:[5,9].includes(n)?1.5:1.2;
export const EXTRA_BETS=[];
const add=(key,label,detail,group)=>EXTRA_BETS.push({key,label,detail,kind:'extra',group});
for(const n of numbers){add('buy'+n,'BUY '+n,'真赔率 · 赢时收本金 5%','buy');add('lay'+n,'LAY '+n,'反买 · 赢时收利润 5%','buy')}
add('opass','PASS ODDS','目标建立后 · 最多 5 倍底注','odds');add('odont','DON’T PASS ODDS','目标建立后 · 最多 5 倍底注','odds');
for(const n of numbers){add('oc'+n,'COME '+n+' ODDS','需已有 COME → '+n+' 合约','odds');add('od'+n,'DON’T COME '+n+' ODDS','需已有 Don’t Come → '+n+' 合约','odds')}
add('horn','HORN','2 / 3 / 11 / 12 等额组合','combo');for(const n of [2,3,11,12])add('horn'+n,'HORN HIGH '+n,'五份：'+n+' 占两份，其余各一份','combo');add('world','WORLD / WHIRL','Horn 四项 + Any 7 各一份','combo');add('ce','C & E','Any Craps + Eleven 各一半','combo');
for(let a=1;a<=6;a++)for(let b=a;b<=6;b++)add('hop'+a+b,'HOP '+a+' + '+b,(a===b?'30:1':'15:1')+' · 下一掷指定骰面','hop');
export const EXTRA_LABELS=Object.fromEntries(EXTRA_BETS.map(c=>[c.key,c.label]));
export function oddsInfo(g,k){if(k==='opass'||k==='odont')return{point:g.point,base:g.bets[k==='opass'?'pass':'dont']??0,against:k==='odont',working:!!g.point};if(/^o[cd](4|5|6|8|9|10)$/.test(k))return{point:+k.slice(2),base:g.travel?.[k.slice(1)]??0,against:k[1]==='d',working:k[1]==='d'||!!g.point};return null}
export function extraUnit(g,k){const o=oddsInfo(g,k),n=o?.point??Number(k.replace(/^(buy|lay)/,''));if(o||/^(buy|lay)/.test(k))return(o?.against||k.startsWith('lay'))?([4,10].includes(n)?2:[5,9].includes(n)?3:6):([4,10].includes(n)?5:[5,9].includes(n)?2:5);if(k==='horn')return 4;if(k==='ce')return 2;return null}
export function extraError(g,k,amount){const o=oddsInfo(g,k);if(o){if(!o.point||!o.base)return'请先建立对应底注或 COME 移点合约';if((g.bets[k]??0)+amount>o.base*5)return'Odds 最多为对应底注的 5 倍'}return ''}
export function settleExtras(g,dice,oldPoint,events){const total=dice[0]+dice[1];
 const pay=(k,m,stay=false,fee=0)=>{const stake=g.bets[k]??0;if(!stake)return;const profit=m<0?-stake:roundChips(stake*m-fee);if(m>=0)g.bank+=profit+(stay?0:stake);if(!stay||m<0)g.bets[k]=0;events.push({key:k,profit,commission:fee})};
 for(const c of EXTRA_BETS){const k=c.key,stake=g.bets[k]??0;if(!stake)continue;const o=oddsInfo(g,k);
  if(o){if(o.working&&(total===7||total===o.point)){const win=o.against?total===7:total===o.point;pay(k,win?(o.against?1/ratio(o.point):ratio(o.point)):-1)}continue}
  if(k.startsWith('buy')){const n=+k.slice(3);if(oldPoint){if(total===7)pay(k,-1);else if(total===n)pay(k,ratio(n),true,roundChips(stake*.05))}continue}
  if(k.startsWith('lay')){const n=+k.slice(3);if(total===n)pay(k,-1);else if(total===7)pay(k,1/ratio(n),true,roundChips(stake/ratio(n)*.05));continue}
  if(k.startsWith('hop')){const a=+k[3],b=+k[4];pay(k,Math.min(...dice)===a&&Math.max(...dice)===b?(a===b?30:15):-1);continue}
  if(k==='ce'){pay(k,total===11?7:[2,3,12].includes(total)?3:-1);continue}
  const high=k.startsWith('horn')&&k!=='horn'?+k.slice(4):0,parts=k==='horn'?4:5;
  if(k==='world'&&total===7){pay(k,0);continue}
  const weight=total===high?2:1,m=[2,12].includes(total)?31*weight/parts-1:[3,11].includes(total)?16*weight/parts-1:-1;pay(k,m);
 }
 // COME odds are OFF on come-out. If its base resolves then, return those odds unchanged.
 if(!oldPoint)for(const n of numbers)if(total===7||total===n)pay('oc'+n,0);
}
