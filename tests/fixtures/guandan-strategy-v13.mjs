import {moves,strength,wild} from '../../dist/guandan.mjs';
const without=(hand,m)=>{const ids=new Set(m.cards.map(c=>c.id));return hand.filter(c=>!ids.has(c.id))};
// Two greedy decompositions estimate the number of future leads, preserving combinations.
export function planCost(hand,level){if(!hand.length)return 0;let best=Infinity;for(const bias of[0,1]){let rest=hand,turns=0,weakSingles=0;while(rest.length){const candidates=moves(rest,level);let bestMove=null,score=-Infinity;for(const m of candidates){const value=m.size*2+(bias?m.tier?2:0:m.type==='straight'||m.type==='pairs'||m.type==='plate'?2:0)-m.cards.filter(c=>wild(c,level)).length*.15;if(value>score){score=value;bestMove=m}}turns++;if(bestMove.type==='single'&&bestMove.power<14)weakSingles++;rest=without(rest,bestMove)}best=Math.min(best,turns+weakSingles*.16)}return best}
function publicPool(s){const remaining=Array(17).fill(0);for(let r=2;r<=16;r++)remaining[r]=r>14?2:8;for(const c of [...s.hand,...s.actions.flatMap(a=>a.cards)])remaining[c.r]--;return remaining.map(n=>Math.max(0,n))}
function noHit(total,bigger,count){let p=1;for(let i=0;i<count&&i<total;i++)p*=Math.max(0,total-bigger-i)/(total-i);return p}
export function chooseCompetitive(s){const all=moves(s.hand,s.level,s.target);if(!all.length)return null;const finish=all.filter(m=>m.size===s.hand.length).sort((a,b)=>a.tier-b.tier||a.power-b.power)[0];if(finish)return finish;
 const partner=(s.seat+2)%4,enemies=[(s.seat+1)%4,(s.seat+3)%4].filter(i=>s.counts[i]>0),urgent=enemies.some(i=>s.counts[i]<=2),teamLeading=s.target&&s.owner%2===s.seat%2;
 if(teamLeading)return null;
 const pool=publicPool(s),total=pool.reduce((a,b)=>a+b,0);const safety=m=>{if(m.type==='single'){let bigger=0;for(let r=2;r<=16;r++)if(strength(r,s.level)>m.power)bigger+=pool[r];return enemies.reduce((p,i)=>p*noHit(total,bigger,s.counts[i]),1)}let risk=0;if(['pair','triple','bomb'].includes(m.type)){for(let r=2;r<=16;r++)if(strength(r,s.level)>m.power&&pool[r]>=m.size)for(const i of enemies)risk+=Math.min(1,(pool[r]*s.counts[i]/Math.max(1,total))**m.size/m.size)}else risk=.6;return Math.max(0,1-risk)};
 const groups=new Map();for(const c of s.hand)groups.set(c.r,(groups.get(c.r)||0)+1);
 const cheap=m=>{let split=0;for(const[r,n]of groups){const used=m.cards.filter(c=>c.r===r).length;if(used&&used<n)split+=n>=4?10:n===3?2:0}return-m.size*2+m.tier*.6+m.power*.08+split+m.cards.filter(c=>wild(c,s.level)).length*2};
 const sorted=[...all].sort((a,b)=>cheap(a)-cheap(b));const shortlist=sorted.slice(0,12);for(const type of['single','pair','triple','bomb','flush','kings']){const types=all.filter(m=>m.type===type);for(const m of[types[0],types.at(-1)])if(m&&!shortlist.includes(m))shortlist.push(m)}
 let best=null,bestScore=Infinity;for(const m of shortlist){const rest=without(s.hand,m),turns=planCost(rest,s.level),control=safety(m);let score=turns*10+cheap(m)*.16-control*(urgent?13:4);
 if(!s.target&&enemies.some(i=>s.counts[i]===1)&&m.type==='single')score+=18+(1-control)*20;
 if(!s.target&&s.counts[partner]>0&&s.counts[partner]<=2&&m.size===s.counts[partner]&&!urgent)score-=7-m.power*.12;
 if(m.tier&&turns>1&&!urgent)score+=7;
 if(score<bestScore){best=m;bestScore=score}}
 if(s.target&&!urgent&&best?.tier&&s.counts[s.owner]>6&&planCost(s.hand,s.level)>3)return null;
 return best
}
