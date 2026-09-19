// 大老二电脑策略 · 启发式
//
// 只读取自己的手牌与公开信息（各家剩牌数、桌面牌、谁在领出），不窥视暗牌。
// 核心取舍：出得多优于出得大；2 与炸弹（四条+1 / 同花顺）是稀缺资源，非必要不拆。
import {moves,power} from './bigtwo.mjs';

const BOMB=m=>m.type==='four'||m.type==='straightflush';
const twos=m=>m.cards.filter(c=>c.r===2).length;

// 出牌代价：越小越愿意出。张数多则便宜（脱手快），点数大、含 2、炸弹则昂贵。
function cost(m){
  let c=-m.cards.length*2.2+power(m.rank)*0.35+twos(m)*11;
  if(BOMB(m))c+=30;
  else if(m.size===5)c+=4;
  return c;
}

export function chooseMove(s){
  const legal=moves(s.hand,s.target,s.opts,s.opening);
  if(!legal.length)return null;

  // 能一把走完就直接走完。
  const finish=legal.find(m=>m.cards.length===s.hand.length);
  if(finish)return finish;

  const threats=s.counts.map((n,i)=>i===s.seat||!n?99:n);
  const closest=Math.min(...threats);
  // 领出者（或上家）快出完时必须拦牌，不能继续攒牌。
  const ownerDanger=s.owner>=0&&s.counts[s.owner]>0&&s.counts[s.owner]<=2;

  if(s.target){
    // 领出者即将走完，目标从“省牌”切换为“压死”：在非炸弹里挑最强的一手，
    // 只有炸弹可压时才动用炸弹。挑最便宜的一手会放对手直接走完。
    if(ownerDanger){
      const safe=legal.filter(m=>!BOMB(m));
      const pool=safe.length?safe:legal;
      return [...pool].sort((a,b)=>b.tier-a.tier||b.power-a.power||cost(a)-cost(b))[0];
    }
    const ranked=[...legal].sort((a,b)=>cost(a)-cost(b));
    const pick=ranked[0];
    // 无人逼近终点时，宁可不出，也不要为了压一手小牌交出 2 或炸弹。
    if((twos(pick)>0||BOMB(pick))&&closest>3)return null;
    return pick;
  }

  // 领出：按代价升序，同代价优先张数多的牌型。
  const ranked=[...legal].sort((a,b)=>cost(a)-cost(b)||b.cards.length-a.cards.length);
  return ranked[0];
}
