import {fastRank,compare} from './engine.mjs';
import {opponentRange,handFeatures} from './poker-range.mjs';
import {responseRates,raiseSizeRates} from './poker-response.mjs';
// Experimental exact river integration over the entire public opponent range.
// Hero decisions after a visible bet optimize the whole branch posterior,
// never the individual hypothetical opponent hand. No future cards are sampled.
export function riverActionValue(s,model,{rng=Math.random,budgetMs=24,nowFn=()=>performance.now()}={}){
 const started=nowFn(),deadline=started+budgetMs,hero=s.players[s.seat],j=1-s.seat,v=s.players[j],l=s.legal,bb=s.bigBlind??20;
 if(s.players.length!==2||s.street!==3||s.board.length!==5||s.players.some(p=>p.fold||p.chips<=0)||hero.total-hero.bet!==v.total-v.bet||s.skillsEnabled||s.skillEnabled||(l.owe??Math.max(0,s.current-hero.bet))>hero.chips)return null;
 const expired=()=>{if(nowFn()>=deadline)throw Error('river-budget')};
 try{expired();const call=l.call,pot=s.pot,opts=[];
  if(fastRank(s.board)[0]===8&&fastRank(s.board)[1]===14)return{action:call?'call':'check',ev:(pot-call)/2,riverValue:{publicTie:true,candidates:[],elapsedMs:nowFn()-started}};
  const range=opponentRange(s,j),rank=fastRank([...s.hole,...s.board]),worlds=[];
  for(let k=0;k<range.entries.length;k++){if(k%32===0)expired();const e=range.entries[k],opponentRank=fastRank([...e.hand,...s.board]),cmp=compare(rank,opponentRank);worlds.push({weight:e.weight/range.total,share:cmp>0?1:cmp<0?0:.5,bucket:Math.min(7,Math.floor(handFeatures(e.hand,s.board,opponentRank).strength*8))})}
  const share=Math.max(0,Math.min(1,worlds.reduce((n,w)=>n+w.weight*w.share,0))),pay=(q,hc,vc)=>q*(pot+hc+vc)-hc,heroLast=s.seat===s.dealer;
  const table=(price,beforePot,raises)=>Array.from({length:8},(_,b)=>{const f={street:3,strength:(b+.5)/8,draw:0,price,pot:beforePot,inPosition:!heroLast,facingRaises:raises,publicStyle:v.publicStyle,styleBelief:v.styleBelief};return{p:responseRates(f),sizes:raiseSizeRates(f)}});
  // Branch records aggregate probabilities before making a single call/fold choice.
  function reaction(hc,vc,price,raises){const probs=table(price,pot+hc,raises),groups=new Map();let ev=0;
   const hLeft=hero.chips-hc,vLeft=v.chips-vc,minExtra=Math.max(bb,hero.bet+hc-s.current);
   for(let k=0;k<worlds.length;k++){if(k%64===0)expired();const w=worlds[k],r=probs[w.bucket],canRaise=hLeft>0&&vLeft>0;
    ev+=w.weight*(r.p[0]*pot+(r.p[1]+(canRaise?0:r.p[2]))*pay(w.share,hc,vc));
    if(canRaise)for(let b=0;b<3;b++){const raw=Math.min(vLeft,Math.max(minExtra,Math.round((pot+hc+vc)*[.5,1,1.5][b]))),matched=Math.min(raw,hLeft),mass=w.weight*r.p[2]*r.sizes[b];const g=groups.get(raw)??{fold:0,call:0};g.fold+=mass*(-hc);g.call+=mass*pay(w.share,hc+matched,vc+matched);groups.set(raw,g)}
   }for(const g of groups.values())ev+=Math.max(g.fold,g.call);return ev;
  }
  function checked(){if(heroLast)return share*pot;const probs=table(0,pot,0),groups=new Map();let ev=0;
   for(let k=0;k<worlds.length;k++){if(k%64===0)expired();const w=worlds[k],r=probs[w.bucket];ev+=w.weight*r.p[1]*pay(w.share,0,0);
    for(let b=0;b<3;b++){const raw=Math.min(v.chips,Math.max(bb,Math.round(pot*[.5,1,1.5][b]))),matched=Math.min(raw,hero.chips),mass=w.weight*r.p[2]*r.sizes[b];const g=groups.get(raw)??{call:0};g.call+=mass*pay(w.share,matched,matched);groups.set(raw,g)}
   }for(const g of groups.values())ev+=Math.max(0,g.call);return ev;
  }
  if(call)opts.push({action:'fold',ev:0});opts.push({action:call?'call':'check',ev:call?pay(share,call,0):checked()});
  if(l.canRaise){const max=Math.min(l.max,v.bet+v.chips),targets=[l.min,...model.sizes.map(f=>Math.round(s.current+f*(pot+call))),max],unique=[...new Set(targets.map(t=>Math.min(max,Math.max(l.min,t))))];
   for(const target of unique){expired();if(target<=s.current||target>max||(target<l.min&&target!==l.max))continue;const hc=target-hero.bet,vc=target-v.bet,raises=s.actions.filter(a=>a.street===3&&a.kind==='raise').length+1;opts.push({action:'raise',target,ev:reaction(hc,vc,vc,raises)})}
  }
  expired();const temp=Math.max(.75,pot*model.temperature),best=Math.max(...opts.map(o=>o.ev)),weights=opts.map(o=>Math.exp(Math.max(-35,(o.ev-best)/temp)));let draw=rng()*weights.reduce((n,x)=>n+x,0),pick=0;while(pick<weights.length-1&&(draw-=weights[pick])>0)pick++;
  return{...opts[pick],riverValue:{worlds:worlds.length,rangeEquity:share,candidates:opts,elapsedMs:nowFn()-started}};
 }catch(e){if(e.message==='river-budget')return null;throw e}
}
