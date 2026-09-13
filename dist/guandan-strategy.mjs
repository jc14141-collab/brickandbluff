import {moves,strength,wild,newDeck,Guandan,chooseMove} from './guandan.mjs';
const without=(hand,m)=>{const ids=new Set(m.cards.map(c=>c.id));return hand.filter(c=>!ids.has(c.id))};
// Two greedy decompositions estimate the number of future leads, preserving combinations.
export function planCost(hand,level){if(!hand.length)return 0;let best=Infinity;for(const bias of[0,1]){let rest=hand,turns=0,weakSingles=0;while(rest.length){const candidates=moves(rest,level);let bestMove=null,score=-Infinity;for(const m of candidates){const value=m.size*2+(bias?m.tier?2:0:m.type==='straight'||m.type==='pairs'||m.type==='plate'?2:0)-m.cards.filter(c=>wild(c,level)).length*.15;if(value>score){score=value;bestMove=m}}turns++;if(bestMove.type==='single'&&bestMove.power<14)weakSingles++;rest=without(rest,bestMove)}best=Math.min(best,turns+weakSingles*.16)}return best}
function publicPool(s){const remaining=Array(17).fill(0);for(let r=2;r<=16;r++)remaining[r]=r>14?2:8;for(const c of [...s.hand,...s.actions.flatMap(a=>a.cards)])remaining[c.r]--;return remaining.map(n=>Math.max(0,n))}
function noHit(total,bigger,count){let p=1;for(let i=0;i<count&&i<total;i++)p*=Math.max(0,total-bigger-i)/(total-i);return p}
export function chooseCompetitive(s){let all=moves(s.hand,s.level,s.target);if(!all.length)return null;const finish=all.filter(m=>m.size===s.hand.length).sort((a,b)=>a.tier-b.tier||a.power-b.power)[0];if(finish)return finish;
 const partner=(s.seat+2)%4,enemies=[(s.seat+1)%4,(s.seat+3)%4].filter(i=>s.counts[i]>0),urgent=enemies.some(i=>s.counts[i]<=2),teamLeading=s.target&&s.owner%2===s.seat%2;
 if(teamLeading)return null;
 // Large opening hands should establish the ordinary combinations first.
 const early=s.hand.length>12&&enemies.every(i=>s.counts[i]>8),normal=all.filter(m=>!m.tier);
 if(!s.target&&early&&normal.length)all=normal;
 if(s.target&&!s.target.tier&&early){if(!normal.length)return null;all=normal}
 const pool=publicPool(s),total=pool.reduce((a,b)=>a+b,0);const safety=m=>{if(m.type==='single'){let bigger=0;for(let r=2;r<=16;r++)if(strength(r,s.level)>m.power)bigger+=pool[r];return enemies.reduce((p,i)=>p*noHit(total,bigger,s.counts[i]),1)}let risk=0;if(['pair','triple','bomb'].includes(m.type)){for(let r=2;r<=16;r++)if(strength(r,s.level)>m.power&&pool[r]>=m.size)for(const i of enemies)risk+=Math.min(1,(pool[r]*s.counts[i]/Math.max(1,total))**m.size/m.size)}else risk=.6;return Math.max(0,1-risk)};
 const groups=new Map();for(const c of s.hand)groups.set(c.r,(groups.get(c.r)||0)+1);
 const cheap=m=>{let split=0;for(const[r,n]of groups){const used=m.cards.filter(c=>c.r===r).length;if(used&&used<n)split+=n>=4?10:n===3?2:0}return-m.size*2+m.tier*.6+m.power*.08+split+m.cards.filter(c=>wild(c,s.level)).length*2};
 const sorted=[...all].sort((a,b)=>cheap(a)-cheap(b));const shortlist=sorted.slice(0,12);for(const type of['single','pair','triple','bomb','flush','kings']){const types=all.filter(m=>m.type===type);for(const m of[types[0],types.at(-1)])if(m&&!shortlist.includes(m))shortlist.push(m)}
 const costs=new Map(),cost=hand=>{const key=hand.map(c=>c.id).sort((a,b)=>a-b).join(',');if(!costs.has(key))costs.set(key,planCost(hand,s.level));return costs.get(key)};
 let best=null,bestScore=Infinity;const ranked=[];for(const m of shortlist){const rest=without(s.hand,m),turns=cost(rest),control=safety(m);let score=turns*10+cheap(m)*.16-control*(urgent?13:4);
 if(!s.target&&enemies.some(i=>s.counts[i]===1)&&m.type==='single')score+=18+(1-control)*20;
 if(!s.target&&s.counts[partner]>0&&s.counts[partner]<=2&&m.size===s.counts[partner]&&!urgent)score-=7-m.power*.12;
 if(m.tier&&turns>1&&!urgent)score+=7;
 ranked.push({m,score});if(score<bestScore){best=m;bestScore=score}}
 if(s.target&&!urgent&&best?.tier&&s.counts[s.owner]>6&&cost(s.hand)>3)return null;
 return s.hand.length<=12?endgameChoice(s,ranked.sort((a,b)=>a.score-b.score).slice(0,3).map(x=>x.m),best):best
}

// Sample only unseen cards: the AI never receives other players' private hands.
function endgameChoice(s,candidates,fallback){
 const known=new Set([...s.hand,...s.actions.flatMap(a=>a.cards)].map(c=>c.id));
 const unseen=newDeck(()=>.5).filter(c=>!known.has(c.id));
 if(unseen.length!==s.counts.reduce((n,x)=>n+x,0)-s.hand.length)return fallback;
 if(s.target)candidates=[...candidates,null];if(candidates.length<2)return fallback;
 let seed=(s.hand.reduce((n,c)=>(n*31+c.id+1)>>>0,17)+s.actions.length*7919+s.seat)>>>0;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const scores=candidates.map(()=>0);
 for(let sample=0;sample<4;sample++){
  const cards=[...unseen];for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}
  let cursor=0;const hands=s.counts.map((n,i)=>i===s.seat?s.hand:cards.slice(cursor,(cursor+=n)));
  for(let k=0;k<candidates.length;k++){
   const g=new Guandan({hands,level:s.level,first:s.seat});g.target=s.target;g.owner=s.owner;g.finish=[...s.finish];
   if(s.target){g.pending=new Set(g.alive().filter(i=>i!==s.owner));for(let i=s.actions.length-1;i>=0&&s.actions[i].pass;i--)g.pending.delete(s.actions[i].seat)}
   const m=candidates[k];g.act(s.seat,m?.cards.map(c=>c.id)||[],m?.key);
   for(let n=0;n<90&&!g.done;n++){const i=g.turn,view={seat:i,hand:g.hands[i],counts:g.hands.map(h=>h.length),level:g.level,target:g.target,owner:g.owner};const move=chooseMove(view);g.act(i,move?.cards.map(c=>c.id)||[],move?.key)}
   if(g.finish.length)scores[k]+=(g.finish[0]%2===s.seat%2?1:-1)+(g.finish.length>1?(g.finish[1]%2===s.seat%2?.2:-.2):0);
   else scores[k]+=(g.hands[(s.seat+1)%4].length+g.hands[(s.seat+3)%4].length-g.hands[s.seat].length-g.hands[(s.seat+2)%4].length)*.01;
  }
 }
 let best=0;for(let i=1;i<scores.length;i++)if(scores[i]>scores[best]+.1)best=i;
 return candidates[best];
}
