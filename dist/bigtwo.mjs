// 香港大老二（鋤大D）· 经典港式规则
//
// 点数顺序（小→大）：3 4 5 6 7 8 9 10 J Q K A 2 —— 2 最大，3 最小。
// 花色顺序（小→大）：♦ < ♣ < ♥ < ♠ —— 黑桃最大，所以 ♠2 是全场最大的单张。
// 五张牌型（弱→强）：顺子 < 同花 < 葫芦 < 四条+1 < 同花顺 —— 最小的同花也压得过最大的顺子。
// 出牌张数只有三种：1 张（单张）、2 张（对子）、5 张（五张牌型）。
// 三条（三张同点数）本桌禁用 —— 选三张牌一律不合法，classify 与 allMoves 都不产出该牌型。
// 顺子必须落在 3→2 这个阶梯上连续五级，不能绕环：A-2-3-4-5 与 2-3-4-5-6 均非法，
// 因此 2 完全不参与顺子；最小顺子是 3-4-5-6-7，最大顺子是 10-J-Q-K-A。
// 持方块 3（全副牌最小的一张）的玩家先出，且首手必须包含方块 3。
//
// 规则开关集中在 RULES，便于按桌调整；默认值即上面的港式经典约定。
export const RULES={suitOrder:'hk',bombBeatsTwo:false,flushSuitFirst:true};

export const SUITS=['♠','♥','♣','♦'];
const SUIT_POWER={'♠':4,'♥':3,'♣':2,'♦':1};

// 五张牌型的层级。单张/对子为 0，只与同张数的同类牌互比。
export const TIER={straight:1,flush:2,full:3,four:4,straightflush:5};
// 牌型表只有 1 张 / 2 张 / 5 张三类；三条已按规则禁用，故不在此登记。
export const TYPE_NAMES={single:'单张',pair:'对子',straight:'顺子',flush:'同花',full:'葫芦',four:'四条',straightflush:'同花顺'};
export const BOMB_TYPES=['four','straightflush'];

// ── 结算参数 ────────────────────────────────────────────────────────────────
// 每张牌的价值（筹码）。开局前由房主/玩家在 50–500 之间以 50 为步进选择。
export const CARD_VALUES=[50,100,150,200,250,300,350,400,450,500];
export const DEFAULT_CARD_VALUE=50;
export function normalizeValue(v){
  const n=Number(v);
  if(!Number.isFinite(n))return DEFAULT_CARD_VALUE;
  return Math.min(500,Math.max(50,Math.round(n/50)*50));
}
// Keep the agreed stake for tables already open before the new selector was released.
export function storedValue(v){const n=Number(v);return CARD_VALUES.includes(n)||(Number.isInteger(n)&&n>=10&&n<=100&&n%10===0)?n:normalizeValue(v)}
// 剩牌区间倍数：1–9 张 1 倍，10–12 张 2 倍，13 张（一张未出）4 倍。
export function bracketMultiplier(count){return count>=13?4:count>=10?2:1}
// 手上每保留一张 2，结算金额翻一倍；两张即 4 倍，四张即 16 倍。
export function twoCount(hand){let n=0;for(const c of hand)if(c.r===2)n++;return n}
export function twoMultiplier(hand){return 2**twoCount(hand)}
// 赢家最后一手用四条或同花顺走出 → 所有输家本局结算额整体翻倍。
export const FINISH_BONUS_TYPES=['four','straightflush'];
export function finishBonus(type){return FINISH_BONUS_TYPES.includes(type)?2:1}

export const rankText=r=>({11:'J',12:'Q',13:'K',14:'A'})[r]||String(r);
// 大老二点数强度：2 记 15 分（最大），其余按面值，A 为 14。
export const power=r=>r===2?15:r;
export const suitPower=s=>SUIT_POWER[s];

export function newDeck(random=Math.random){
  const cards=[];
  for(const s of SUITS)for(let r=2;r<=14;r++)cards.push({id:cards.length,r,s});
  for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}
  return cards;
}

// 手牌默认按“点数降序、同点数花色降序”排列，方便玩家看清大小。
export function sortHand(hand){
  return [...hand].sort((a,b)=>power(b.r)-power(a.r)||suitPower(b.s)-suitPower(a.s)||a.id-b.id);
}

function rankCounts(cards){const m=new Map();for(const c of cards)m.set(c.r,(m.get(c.r)||0)+1);return m}

// 识别一组牌的牌型；不合法返回 null。五张牌型至多只有一种解释，无需歧义消解。
export function classify(cards){
  const n=cards.length;
  if(!n)return null;
  if(n===1){const c=cards[0];return{type:'single',size:1,tier:0,power:power(c.r),suit:suitPower(c.s),rank:c.r,cards}}
  if(n===2){
    if(cards[0].r!==cards[1].r)return null;
    return{type:'pair',size:2,tier:0,power:power(cards[0].r),suit:Math.max(suitPower(cards[0].s),suitPower(cards[1].s)),rank:cards[0].r,cards}
  }
  // 三条已按规则禁用：3 张牌不存在任何合法牌型，直接落到下面的 n!==5 兜底返回 null。
  if(n!==5)return null;
  const values=cards.map(c=>power(c.r)).sort((a,b)=>b-a);
  const sameSuit=cards.every(c=>c.s===cards[0].s);
  const noTwo=cards.every(c=>c.r!==2);          // 2 位于阶梯顶端，不参与顺子
  const distinct=new Set(cards.map(c=>c.r)).size===5;
  const run=noTwo&&distinct&&values[0]-values[4]===4;
  // 顺子/同花/同花顺以最大那张定强弱，同点再比该张花色。
  const top=cards.reduce((a,b)=>power(b.r)>power(a.r)||power(b.r)===power(a.r)&&suitPower(b.s)>suitPower(a.s)?b:a);
  if(run&&sameSuit)return{type:'straightflush',size:5,tier:TIER.straightflush,power:power(top.r),suit:suitPower(top.s),rank:top.r,cards};
  const groups=[...rankCounts(cards).entries()];
  const quad=groups.find(([,n])=>n===4);
  if(quad)return{type:'four',size:5,tier:TIER.four,power:power(quad[0]),suit:0,rank:quad[0],cards};
  const trip=groups.find(([,n])=>n===3);
  if(trip&&groups.some(([,n])=>n===2))return{type:'full',size:5,tier:TIER.full,power:power(trip[0]),suit:0,rank:trip[0],cards};
  if(sameSuit)return{type:'flush',size:5,tier:TIER.flush,power:power(top.r),suit:suitPower(cards[0].s),rank:top.r,cards};
  if(run)return{type:'straight',size:5,tier:TIER.straight,power:power(top.r),suit:suitPower(top.s),rank:top.r,cards};
  return null;
}

const compare=(a,b,opts)=>{
  // 港式默认：同花先比花色，再比其中最大的牌。
  if(a.type==='flush'&&b.type==='flush'&&opts.flushSuitFirst)return(a.suit-b.suit)||(a.power-b.power);
  return(a.power-b.power)||(a.suit-b.suit);
};

// 出牌张数必须一致；五张牌型先比牌型层级，同层级再比点数与花色。
export function beats(a,b,opts=RULES){
  if(!b)return true;
  // 可选规则：炸弹（四条+1 / 同花顺）可强压单张 2。默认关闭。
  // 必须在张数检查之前判断，否则 5 张对 1 张会先被张数拦下。
  if(opts.bombBeatsTwo&&b.size===1&&b.rank===2&&BOMB_TYPES.includes(a.type))return true;
  if(a.size!==b.size)return false;
  if(a.size===5)return a.tier!==b.tier?a.tier>b.tier:compare(a,b,opts)>0;
  return compare(a,b,opts)>0;
}

export const moveLabel=m=>m?`${TYPE_NAMES[m.type]} · ${rankText(m.rank)}`:'';
export const keyOf=m=>[m.type,m.rank,m.suit,m.cards.map(c=>c.id).sort((a,b)=>a-b).join(',')].join(':');

// 枚举一手牌的全部合法牌型。按牌型直接生成，而不是穷举 C(13,5) 组合 ——
// 后者每次要跑 1287 次识别，AI 反复调用会明显拖慢出牌。
const LADDER=[3,4,5,6,7,8,9,10,11,12,13,14];   // 顺子阶梯，2 不参与

export function allMoves(hand){
  const out=[],add=m=>{if(m){m.key=keyOf(m);out.push(m)}};
  const byRank=new Map(),bySuit=new Map();
  for(const c of hand){
    if(!byRank.has(c.r))byRank.set(c.r,[]);
    byRank.get(c.r).push(c);
    if(!bySuit.has(c.s))bySuit.set(c.s,[]);
    bySuit.get(c.s).push(c);
  }
  // 单张 / 对子（三条已禁用，3 张出牌一律不合法，故不生成）
  for(const g of byRank.values()){
    for(const c of g)add(classify([c]));
    for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++)add(classify([g[i],g[j]]));
  }
  // 顺子与同花顺：每个点数取一张做笛卡尔积；五张同花时 classify 自然升级为同花顺。
  for(let i=0;i+4<LADDER.length;i++){
    const ranks=LADDER.slice(i,i+5);
    if(!ranks.every(r=>byRank.has(r)))continue;
    let picks=[[]];
    for(const r of ranks){
      const next=[];
      for(const combo of picks)for(const c of byRank.get(r))next.push([...combo,c]);
      picks=next;
    }
    for(const combo of picks)add(classify(combo));
  }
  // 同花：每种花色取五张
  for(const g of bySuit.values()){
    if(g.length<5)continue;
    for(let a=0;a<g.length;a++)for(let b=a+1;b<g.length;b++)for(let c=b+1;c<g.length;c++)for(let d=c+1;d<g.length;d++)for(let e=d+1;e<g.length;e++)add(classify([g[a],g[b],g[c],g[d],g[e]]));
  }
  // 葫芦：三条 + 对子
  const trips=[...byRank.values()].filter(g=>g.length>=3);
  const pairs=[...byRank.values()].filter(g=>g.length>=2);
  for(const t of trips)for(const p of pairs){
    if(t[0].r===p[0].r)continue;
    for(let i=0;i<t.length;i++)for(let j=i+1;j<t.length;j++)for(let k=j+1;k<t.length;k++)for(let x=0;x<p.length;x++)for(let y=x+1;y<p.length;y++)add(classify([t[i],t[j],t[k],p[x],p[y]]));
  }
  // 四条 + 1
  for(const g of byRank.values()){
    if(g.length<4)continue;
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)for(let k=j+1;k<4;k++)for(let l=k+1;l<4;l++)for(const kicker of hand){
      if(g.slice(0,4).includes(kicker))continue;
      add(classify([g[i],g[j],g[k],g[l],kicker]));
    }
  }
  return out;
}

// 首手约束：持方块 3 者领出，且该手牌必须包含方块 3。
const LEAD={r:3,s:'♦'};
export const isLeadCard=c=>c.r===LEAD.r&&c.s===LEAD.s;

// 当前可压过桌面牌的所有出法。target 为 null 表示由你领出新一轮。
// opening 为 true 时只返回含方块 3 的牌型，保证首手约束在 UI 与 AI 侧同样生效。
export function moves(hand,target=null,opts=RULES,opening=false){
  const list=allMoves(hand).filter(m=>beats(m,target,opts));
  return opening?list.filter(m=>m.cards.some(isLeadCard)):list;
}

export class BigTwo{
  constructor({random=Math.random,hands,first,opening,actions,trick,status,last,opts}={}){
    const deck=hands?null:newDeck(random);
    this.hands=hands?hands.map(h=>[...h]):Array.from({length:4},(_,i)=>sortHand(deck.slice(i*13,(i+1)*13)));
    this.turn=Number.isInteger(first)?first:this.leadSeat();
    // 已开局的对局必须从存档恢复首手状态，否则会要求重打方块 3。
    this.opening=opening??!hands;
    // 规则开关随对局保存，保证服务端判定与客户端提示使用同一套约定。
    this.opts={...RULES,...(opts??{})};
    this.target=null;this.owner=-1;this.pending=new Set();this.finish=[];
    this.done=false;this.actions=actions??[];this.trick=trick??0;
    this.status=status??Array(4).fill('');this.last=last??[null,null,null,null];
  }
  leadSeat(){for(let i=0;i<4;i++)if(this.hands[i].some(isLeadCard))return i;return 0}
  alive(){return[0,1,2,3].filter(i=>this.hands[i].length>0)}
  next(i){for(let n=1;n<=4;n++){const k=(i+n)%4;if(this.hands[k].length)return k}return i}
  legal(i=this.turn){return moves(this.hands[i],this.target,this.opts,this.opening)}
  snapshot(i){
    return{
      seat:i,
      hand:this.hands[i].map(c=>({...c})),
      counts:this.hands.map(h=>h.length),
      target:this.target?{...this.target,cards:this.target.cards.map(c=>({...c}))}:null,
      owner:this.owner,
      opening:this.opening,
      opts:{...this.opts},
      finish:[...this.finish],
      actions:this.actions.map(a=>({...a,cards:a.cards.map(c=>({...c}))})),
    };
  }
  act(i,ids=[],opts=this.opts){
    if(this.done||i!==this.turn)throw Error('请等待轮到你');
    if(!ids.length){
      if(!this.target)throw Error('本轮由你领出，不能不出');
      this.status[i]='不出';this.last[i]=null;
      // 必须把本家移出待响应集合，否则一圈过后 pending 永不清空，牌权无法回到领出者。
      this.pending.delete(i);
      this.actions.push({seat:i,cards:[],pass:true,trick:this.trick});
      this.advance();return null;
    }
    const cards=ids.map(id=>this.hands[i].find(c=>c.id===id));
    if(cards.some(c=>!c)||new Set(ids).size!==ids.length)throw Error('选牌无效');
    const m=classify(cards);
    if(!m)throw Error('这些牌不构成合法牌型');
    if(this.opening&&!cards.some(isLeadCard))throw Error('首手必须包含方块 3');
    if(!beats(m,this.target,opts))throw Error('无法压过桌面上的牌');
    this.hands[i]=this.hands[i].filter(c=>!ids.includes(c.id));
    this.target=m;this.owner=i;this.opening=false;
    m.key=keyOf(m);
    this.status[i]=moveLabel(m);this.last[i]=m;
    this.actions.push({seat:i,cards:m.cards,move:moveLabel(m),trick:this.trick});
    if(!this.hands[i].length){
      // 大老二以“第一个出完手牌”直接结束本局，其余玩家按两两差额结算筹码。
      this.finish.push(i);this.done=true;this.status[i]='出完';
      this.finishType=m.type;   // 最后一手牌型：四条/同花顺会触发全体翻倍
      return m;
    }
    this.pending=new Set(this.alive().filter(k=>k!==i));
    this.advance();return m;
  }
  advance(){
    if(!this.pending.size){
      const leader=this.hands[this.owner].length?this.owner:this.next(this.owner);
      this.turn=leader;this.target=null;this.owner=-1;this.trick++;
      this.last=Array(4).fill(null);
      this.status=this.status.map((s,i)=>this.hands[i].length?'':s);
    }else this.turn=this.next(this.turn);
  }
}

// 港式真实结算：两两差额支付，而不是「只算罚分」。
//
// 对每一对玩家：牌多的那一方向牌少的支付「张数差 × 每张牌价值」，再乘上支付方自己的倍数：
//   · 剩牌区间倍数 —— 1–9 张 1 倍、10–12 张 2 倍、13 张（一张没出）4 倍
//   · 手上每保留一张 2 翻一倍 —— 两张 2 即 4 倍，四张即 16 倍
// 若赢家最后一手是四条或同花顺，所有输家的本局结算额再整体翻一倍。
//
// 结果天然零和：每一笔支出都恰好对应一笔收入，四家之和恒为 0。
export function settle(game,value=DEFAULT_CARD_VALUE){
  if(!game.done)throw Error('本局尚未结束');
  const v=storedValue(value);
  const winner=game.finish[0];
  const counts=game.hands.map(h=>h.length);
  const mults=game.hands.map(h=>bracketMultiplier(h.length)*twoMultiplier(h));
  const bonus=finishBonus(game.finishType);
  const pairs=[];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    if(i===j||counts[i]<=counts[j])continue;
    const diff=counts[i]-counts[j];
    pairs.push({
      from:i,to:j,diff,
      bracket:bracketMultiplier(counts[i]),
      twos:twoCount(game.hands[i]),
      base:diff*v,                    // 未计倍数的差额
      amount:diff*v*mults[i]*bonus,   // 实际支付（含区间、2、最后一手三重倍数）
    });
  }
  const scores=Array(4).fill(0);
  for(const p of pairs){scores[p.from]-=p.amount;scores[p.to]+=p.amount}
  return{winner,scores,pairs,counts,mults,bonus,value:v};
}

// 全下上限：任何一方的总支出不得超过他在桌面上的筹码，超出则按比例缩减。
// 收款方只收实际流入的筹码，所以零和性依然成立，且没人会被打成负筹码。
//
// 缩减必须按「支出方」整体分摊，不能对每一笔单独四舍五入：
// 例如应付两笔各 0.5，Math.round 会把两笔都进位成 1，支出 2 > 桌面 1。
// 这里改用最大余数法（先取整、再把余数按小数部分从大到小补足），
// 使每位支出方的支出恰好等于 min(桌面筹码, 应付总额)，既不多付也不会被算成负筹码。
export function settleWithBanks(game,value,banks){
  const raw=settle(game,value);
  if(!banks){
    const pairs=raw.pairs.map(p=>({...p,amount:Math.round(p.amount)}));
    const scores=Array(4).fill(0);
    for(const p of pairs){scores[p.from]-=p.amount;scores[p.to]+=p.amount}
    return{...raw,pairs,scores,capped:false,scale:null};
  }
  const owed=Array(4).fill(0);
  for(const p of raw.pairs)owed[p.from]+=p.amount;
  const stack=banks.map(b=>Math.max(0,Math.floor(b)));
  const scale=owed.map((o,i)=>(o>0&&o>stack[i])?stack[i]/o:1);
  const capped=scale.some(s=>s<1);
  const amounts=new Array(raw.pairs.length).fill(0);
  for(let i=0;i<4;i++){
    const idx=[];
    for(let k=0;k<raw.pairs.length;k++)if(raw.pairs[k].from===i)idx.push(k);
    if(!idx.length)continue;
    const budget=Math.min(stack[i],Math.round(owed[i]));
    const exact=idx.map(k=>raw.pairs[k].amount*scale[i]);
    const base=exact.map(x=>Math.floor(x));
    let left=budget-base.reduce((a,b)=>a+b,0);
    const byFrac=exact.map((x,k)=>({k,frac:x-Math.floor(x)})).sort((a,b)=>b.frac-a.frac||a.k-b.k);
    for(const{k}of byFrac){if(left<=0)break;base[k]++;left--}
    for(const{k}of byFrac.slice().reverse()){while(left<0&&base[k]>0){base[k]--;left++}}
    idx.forEach((k,pos)=>amounts[k]=base[pos]);
  }
  const pairs=raw.pairs.map((p,k)=>({...p,amount:amounts[k],...(scale[p.from]<1?{reduced:true}:{})}));
  const scores=Array(4).fill(0);
  for(const p of pairs){scores[p.from]-=p.amount;scores[p.to]+=p.amount}
  return{...raw,pairs,scores,rawScores:raw.scores,scale,capped};
}

// 连续对局包装：每副累计各座位的筹码输赢。大老二固定由持方块 3 者先出，因此无需轮换庄位。
export class BigTwoMatch{
  constructor(random=Math.random,value=DEFAULT_CARD_VALUE){
    this.random=random;this.round=0;this.total=[0,0,0,0];this.settled=false;this.result=null;
    this.value=normalizeValue(value);
  }
  // 开局前或两副之间可以改牌值；一副进行中不允许改动，避免结算口径前后不一致。
  setValue(v){
    if(this.round>0&&!this.settled)throw Error('本副进行中，不能修改每张牌的价值');
    this.value=normalizeValue(v);return this.value;
  }
  start(){this.result=null;this.settled=false;this.round++;this.game=new BigTwo({random:this.random});return this.game}
  // banks 传入桌面筹码时套用全下上限；累计筹码按实际结算额累加。
  settle(banks=null){
    const r=settleWithBanks(this.game,this.value,banks);
    if(!this.settled){for(let i=0;i<4;i++)this.total[i]+=r.scores[i];this.settled=true}
    return this.result={...r,total:[...this.total],round:this.round};
  }
}

// 供 UI 复用的规则文本。
export const BIGTWO_RULES=`<p>四人对局，各自为战，一副牌 52 张，每人 13 张。开局前先选定<strong>每张牌的价值</strong>（50–500 筹码，步进 50），本桌不启用角色技能。</p><ol><li>点数由小到大为 3 4 5 6 7 8 9 10 J Q K A 2 —— 2 最大，3 最小；同点数时比花色，由小到大为 ♦ &lt; ♣ &lt; ♥ &lt; ♠，所以 ♠2 是全场最大的单张。</li><li>牌型只有三种张数：单张、对子、五张 —— <strong>三条（三张同点数）不可出</strong>，任何三张牌的出法都不合法。五张牌型由弱到强为 顺子 &lt; 同花 &lt; 葫芦（三带二）&lt; 四条 + 1 &lt; 同花顺；高一层级永远压过低一层级，最小的同花也压得过最大的顺子。</li><li>接牌必须张数相同，且只能同张数互比 —— 对子压不过顺子，单张与对子也压不过任何五张牌型。</li><li>顺子必须连续五级且不能绕环，2 不参与顺子：A-2-3-4-5 与 2-3-4-5-6 都不合法。最小顺子是 3-4-5-6-7，最大顺子是 10-J-Q-K-A。</li><li>比较规则：单张比点数再比花色；对子比点数，同点则由含较大花色的一组胜出；顺子与同花顺由最大的那张定强弱，同点再比该张花色；葫芦只看其中三张的点数；四条只看四张的点数；同花默认先比花色再比最大牌。</li><li>持方块 3 的玩家先出，且首手必须包含方块 3。轮到你时，只能打出比桌面更大且张数相同的牌，也可以选择不出。</li><li>当其他玩家都不出时，最后出牌者以任意牌型领出新一轮。第一个出完 13 张牌的玩家赢得本局。</li></ol><p><strong>结算 · 两两差额支付</strong>：每一对玩家之间，牌多的那一方向牌少的支付「张数差 × 每张牌价值」。支付方还要乘上自己的倍数 —— 剩 1–9 张 ×1、10–12 张 ×2、13 张（一张没出）×4；手上每保留一张 2 再翻一倍（两张 2 即 ×4，四张 ×16）。若赢家最后一手是用<strong>四条</strong>或<strong>同花顺</strong>走完的，所有输家的本局结算额整体再翻一倍。四家输赢之和恒为 0，筹码从输家手中直接进入赢家手中。</p><p>桌面筹码不足时按<strong>全下</strong>结算：支出方最多赔光自己在桌面上的筹码，收款方只收实际流入的部分，因此没人会被打成负筹码。</p><p>可选规则“炸弹压 2”默认关闭：开启后，四条 + 1 与同花顺可以强压单张的 2，这是港式玩法中唯一允许五张牌型回应单张的情况。规则参考 <a href="https://bigtwo.online/zh-HK/game-guide/hand-rankings" target="_blank" rel="noopener">鋤大D 牌型大細</a>。</p>`;
