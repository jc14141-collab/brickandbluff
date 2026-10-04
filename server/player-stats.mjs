import {beginPokerProfit,recordPokerProfit} from './poker-table-profits.mjs';
import {rankingName} from '../dist/ranking-name.mjs';
export const STAT_MODES=['poker','blackjack','roulette','craps','guandan','bigtwo'];
// Baselines precede blinds, wagers and skill fees. Transfers and grants are not profit.
export function beginStats(r){beginPokerProfit(r);r.statBasis=Object.fromEntries(r.seats.filter(s=>s.auth&&!s.bot&&!s.waiting).map(s=>[s.id,{auth:s.auth,bank:s.bank}]))}
export function queueProfit(r,auth,net,at){if(!auth)return;(r.pendingStats??=[]).push({auth,mode:r.mode,net:Math.round(net),at})}
export function finishStats(r,at){if(r.mode==='craps')return;for(const seat of r.seats)recordPokerProfit(r,seat,seat.bank);for(const seat of r.seats){const base=r.statBasis?.[seat.id];if(base){queueProfit(r,base.auth,seat.bank-base.bank,at);delete r.statBasis[seat.id]}}}
export function leaveStats(r,seat,available,committed,at){recordPokerProfit(r,seat,available);if(r.mode==='craps'){if(committed)queueProfit(r,seat.auth,-committed,at);return}const base=r.statBasis?.[seat.id];if(base){queueProfit(r,base.auth,available-base.bank,at);delete r.statBasis[seat.id]}}
export function collectStats(state,r){for(const e of r.pendingStats??[]){const p=state.players.find(p=>p.auth===e.auth);if(!p)continue;p.gameStats??={};const a=p.gameStats[e.mode]??={net:0,rounds:0,best:0};a.net+=e.net;a.rounds++;if(e.net>a.best){a.best=e.net;a.bestAt=e.at}if(e.net<(a.worst??0)){a.worst=e.net;a.worstAt=e.at}state.statsSince??=e.at}delete r.pendingStats}
export function statsView(state,player,tableTotal,now){
 const publicPlayer=p=>({id:p.id,name:rankingName(p.name,p.id===player.id),online:now-p.seen<45000});
 const named=state.players.filter(p=>p.name);
 const sort=(a,b)=>b.value-a.value||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
 const rank=rows=>{let previous,position=0;return rows.sort(sort).map((p,i)=>{if(p.value!==previous)position=i+1;previous=p.value;return{...p,rank:position}})};
 const best={};
 for(const mode of STAT_MODES)best[mode]=rank(named.filter(p=>(p.gameStats?.[mode]?.best??0)>0).map(p=>({...publicPlayer(p),value:p.gameStats[mode].best,at:p.gameStats[mode].bestAt})));
 const profitRanks=rank(STAT_MODES.flatMap(mode=>best[mode].map(p=>({...p,mode}))));
 const lossRanks=rank(STAT_MODES.flatMap(mode=>named.filter(p=>(p.gameStats?.[mode]?.worst??0)<0).map(p=>({...publicPlayer(p),mode,value:-p.gameStats[mode].worst,at:p.gameStats[mode].worstAt}))));
 return {profitRanks,lossRanks,since:state.statsSince??null,
  games:STAT_MODES.map(mode=>({mode,...(player.gameStats?.[mode]??{net:0,rounds:0,best:0})})),
  chips:rank(named.map(p=>({...publicPlayer(p),value:Math.round(p.bank+tableTotal(p))}))).map(p=>({...p,name:rankingName(p.name,p.id===player.id)})),best};
}
