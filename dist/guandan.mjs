const SUITS=['♠','♥','♣','♦'];
export const TYPE_NAMES={single:'单张',pair:'对子',triple:'三张',full:'三带二',straight:'顺子',pairs:'三连对',plate:'钢板',bomb:'炸弹',flush:'同花顺',kings:'四王炸'};
export const rankText=r=>({11:'J',12:'Q',13:'K',14:'A',15:'小王',16:'大王'})[r]||String(r);
export const wild=(c,level)=>c.r===level&&c.s==='♥';
export const strength=(r,level)=>r>=15?r+3:r===level?17:r;
export function newDeck(random=Math.random){const cards=[];for(let pack=0;pack<2;pack++){for(const s of SUITS)for(let r=2;r<=14;r++)cards.push({id:cards.length,r,s});for(const r of[15,16])cards.push({id:cards.length,r,s:r===16?'♥':'♠'})}for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}return cards}
export function sortHand(hand,level){return [...hand].sort((a,b)=>strength(b.r,level)-strength(a.r,level)||Number(wild(b,level))-Number(wild(a,level))||SUITS.indexOf(a.s)-SUITS.indexOf(b.s)||a.id-b.id)}
const cache=new Map();
function templates(level){if(cache.has(level))return cache.get(level);const out=[];const add=(type,rank,needs,suit=null)=>{const size=needs.reduce((n,x)=>n+x[1],0),tier=type==='kings'?100:type==='flush'?5.5:type==='bomb'?size:0;out.push({key:[type,rank,size,suit??''].join(':'),type,rank,size,tier,power:['straight','pairs','plate','flush'].includes(type)?rank:strength(rank,level),needs,suit})};
 for(let r=2;r<=16;r++){for(let n=1;n<=(r>14?2:3);n++)add(['','single','pair','triple'][n],r,[[r,n]]);if(r<=14)for(let n=4;n<=10;n++)add('bomb',r,[[r,n]])}
 for(let r=2;r<=14;r++)for(let p=2;p<=16;p++)if(r!==p)add('full',r,[[r,3],[p,2]]);
 for(const[type,width,count]of[['straight',5,1],['pairs',3,2],['plate',2,3]])for(let start=1;start<=15-width;start++){const needs=Array.from({length:width},(_,i)=>[start+i===1?14:start+i,count]);add(type,start+width-1,needs);if(type==='straight')for(const suit of SUITS)add('flush',start+width-1,needs,suit)}
 add('kings',16,[[15,2],[16,2]]);cache.set(level,out);return out
}
// Match real ranks first; red-heart level cards fill only non-joker deficits.
function fit(hand,t,level){if(t.size>hand.length)return null;if(t.type==='single'){const c=hand.find(c=>c.r===t.rank);return c?{...t,cards:[c],assignments:[{id:c.id,r:c.r,s:c.s}]}:null}const pool=hand.filter(c=>!wild(c,level)),w=hand.filter(c=>wild(c,level)),cards=[],assignments=[];for(const[r,n]of t.needs){const same=pool.filter(c=>c.r===r&&(!t.suit||c.s===t.suit));for(let i=0;i<n;i++){const c=same[i]||((r<=14&&t.type!=='kings')?w.shift():null);if(!c)return null;cards.push(c);assignments.push({id:c.id,r,s:t.suit||c.s})}}if(t.type==='pair'&&cards.every(c=>wild(c,level))&&t.rank!==level)return null;return{...t,cards,assignments}}
export function beats(a,b){if(!b)return true;if(a.tier||b.tier)return a.tier!==b.tier?a.tier>b.tier:a.tier>0&&a.power>b.power;return a.type===b.type&&a.size===b.size&&a.power>b.power}
export function interpretations(cards,level,target=null){if(new Set(cards.map(c=>c.id)).size!==cards.length)return[];return templates(level).filter(t=>t.size===cards.length).map(t=>fit(cards,t,level)).filter(m=>m&&beats(m,target)).sort((a,b)=>a.tier-b.tier||a.power-b.power||a.key.localeCompare(b.key))}
export function moves(hand,level,target=null){return templates(level).filter(t=>beats(t,target)).map(t=>fit(hand,t,level)).filter(Boolean)}
export function moveLabel(m){return m?`${TYPE_NAMES[m.type]} · ${m.type==='bomb'?m.size+' 张 · ':''}${rankText(m.rank)}`:''}
export class Guandan{
 constructor({level=2,random=Math.random,first=0,hands}={}){this.level=level;const d=hands?null:newDeck(random);this.hands=hands?hands.map(h=>[...h]):Array.from({length:4},(_,i)=>d.slice(i*27,(i+1)*27));this.turn=first;this.target=null;this.owner=-1;this.pending=new Set();this.finish=[];this.done=false;this.actions=[];this.trick=0;this.status=Array(4).fill('');this.last=[null,null,null,null]}
 alive(){return[0,1,2,3].filter(i=>this.hands[i].length>0)}
 next(i){for(let n=1;n<=4;n++){const k=(i+n)%4;if(this.hands[k].length)return k}return i}
 legal(i=this.turn){return moves(this.hands[i],this.level,this.target)}
 snapshot(i){return{seat:i,hand:this.hands[i].map(c=>({...c})),counts:this.hands.map(h=>h.length),level:this.level,target:this.target?{...this.target,cards:this.target.cards.map(c=>({...c}))}:null,owner:this.owner,finish:[...this.finish],actions:this.actions.map(a=>({...a,cards:a.cards.map(c=>({...c}))}))}}
 act(i,ids=[],key=null){if(this.done||this.returns?.length||i!==this.turn)throw Error('请等待轮到你');if(!ids.length){if(!this.target)throw Error('本轮由你领出，不能不出');this.status[i]='不出';this.last[i]=null;this.pending.delete(i);this.actions.push({seat:i,cards:[],pass:true,trick:this.trick});this.advance();return null}
 const cards=ids.map(id=>this.hands[i].find(c=>c.id===id));if(cards.some(c=>!c)||new Set(ids).size!==ids.length)throw Error('选牌无效');const options=interpretations(cards,this.level,this.target),m=key?options.find(m=>m.key===key):options[0];if(!m)throw Error('这些牌不能组成可出的牌型，或无法压过桌面牌');this.hands[i]=this.hands[i].filter(c=>!ids.includes(c.id));this.target=m;this.owner=i;this.status[i]=moveLabel(m);this.last[i]=m;this.actions.push({seat:i,cards:m.cards,move:moveLabel(m),trick:this.trick});if(!this.hands[i].length){this.finish.push(i);this.status[i]=['头游','二游','三游'][this.finish.length-1]||'末游';if(this.finish.length>=3||this.finish.length===2&&this.finish[0]%2===this.finish[1]%2){this.finish.push(...this.alive());this.done=true;return m}}
 this.pending=new Set(this.alive().filter(k=>k!==i));this.advance();return m
 }
 advance(){if(!this.pending.size){const leader=this.owner;this.turn=this.hands[leader].length?leader:this.hands[(leader+2)%4].length?(leader+2)%4:this.next(leader);this.target=null;this.owner=-1;this.trick++;this.last=Array(4).fill(null);this.status=this.status.map((s,i)=>this.hands[i].length?'':s)}else this.turn=this.next(this.turn)}
}
// Team-aware heuristic: uses only this player's hand, public plays and remaining counts.
export function chooseMove(s){const all=moves(s.hand,s.level,s.target);if(!all.length)return null;const finish=all.find(m=>m.cards.length===s.hand.length);if(finish)return finish;if(s.target&&s.owner%2===s.seat%2)return null;
 const danger=s.counts.some((n,i)=>i%2!==s.seat%2&&n>0&&n<=3),groups=new Map();for(const c of s.hand)groups.set(c.r,(groups.get(c.r)||0)+1);
 function cost(m){const used=new Set(m.cards.map(c=>c.id));let broken=0;for(const[r,n]of groups){const taken=m.cards.filter(c=>c.r===r).length;if(n>=4&&taken&&taken<n)broken+=18;if(n===3&&taken===1)broken+=4}const wildCost=m.cards.filter(c=>wild(c,s.level)).length*7;return(s.target?0:-m.size*4)+m.power*.3+m.tier*(danger?1:5)+broken+wildCost+(danger&&m.type==='single'?-m.power*.7:0)}
 return all.sort((a,b)=>cost(a)-cost(b)||a.key.localeCompare(b.key))[0]
}
export class GuandanMatch{
 constructor(random=Math.random){this.random=random;this.levels=[2,2];this.active=0;this.round=0;this.previous=null;this.champion=null}
 start(){const g=new Guandan({level:this.levels[this.active],random:this.random,first:this.round===0?Math.floor(this.random()*4):this.previous[0]});this.round++;g.tributeLog=[];g.returns=[];if(this.previous)this.tribute(g);this.game=g;return g}
 tribute(g){const f=this.previous,losers=f[0]%2===f[1]%2?f.slice(2):[f[3]],big=losers.reduce((n,i)=>n+g.hands[i].filter(c=>c.r===16).length,0);if(big===2){g.tributeLog.push('抗贡：贡方持有两张大王，头游先出');g.turn=f[0];return}
 const gifts=losers.map(i=>({from:i,card:sortHand(g.hands[i].filter(c=>!wild(c,g.level)),g.level)[0]})).sort((a,b)=>strength(b.card.r,g.level)-strength(a.card.r,g.level)||((a.from-f[0]+4)%4)-((b.from-f[0]+4)%4));
 gifts.forEach((gift,n)=>{const to=f[n];g.hands[gift.from]=g.hands[gift.from].filter(c=>c.id!==gift.card.id);g.hands[to].push(gift.card);g.returns.push({from:to,to:gift.from});g.tributeLog.push(`${['你','左家','队友','右家'][gift.from]} 向 ${['你','左家','队友','右家'][to]} 进贡 ${gift.card.s}${rankText(gift.card.r)}`)});g.turn=gifts.length===2&&strength(gifts[0].card.r,g.level)===strength(gifts[1].card.r,g.level)?(f[0]+3)%4:gifts[0].from;
 }
 returnOptions(from){return this.game.hands[from].filter(c=>c.r<=10&&!wild(c,this.game.level))}
 giveBack(id){const g=this.game,t=g.returns[0];if(!t)throw Error('无需还贡');const candidates=this.returnOptions(t.from),fallback=sortHand(g.hands[t.from].filter(c=>!wild(c,g.level)),g.level).reverse(),c=(candidates.length?candidates:fallback.slice(0,1)).find(c=>c.id===id);if(!c)throw Error('请选择 10 以下（含 10）的非逢人配牌');g.hands[t.from]=g.hands[t.from].filter(x=>x.id!==id);g.hands[t.to].push(c);g.tributeLog.push(`${['你','左家','队友','右家'][t.from]} 还贡 ${c.s}${rankText(c.r)}`);g.returns.shift()}
 autoReturn(){const t=this.game.returns[0];if(!t)return;const opts=this.returnOptions(t.from);const c=sortHand(opts.length?opts:this.game.hands[t.from].filter(c=>!wild(c,this.game.level)),this.game.level).at(-1);this.giveBack(c.id)}
 settle(){const g=this.game;if(!g.done)throw Error('本副尚未结束');if(g.result)return g.result;const team=g.finish[0]%2,partner=g.finish.indexOf((g.finish[0]+2)%4),gain=partner===1?3:partner===2?2:1;const before=this.levels[team];if(before===14&&g.level===14&&this.active===team&&partner<3)this.champion=team;this.levels[team]=Math.min(14,before+gain);this.active=team;this.previous=[...g.finish];return g.result={team,gain,before,after:this.levels[team],champion:this.champion}}
}
