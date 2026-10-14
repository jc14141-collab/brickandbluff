// Presentation timing does not change authoritative balances or betting rules.
export const POKER_HIGHLIGHT_MS=2200,POKER_PAYOUT_MS=3300;
export function pokerDisplay(game,endedAt,now){
 const complete=!!game.done&&(!game.showdown||game.board.length===5),age=now-(endedAt??now);
 const highlight=complete&&age>=POKER_HIGHLIGHT_MS,payout=highlight&&age>=POKER_PAYOUT_MS;
 const players=game.players.map((p,i)=>({...p,chips:Math.max(0,p.chips-(game.done&&!payout?(game.paid?.[i]??0):0))}));
 return {highlight,payout,players,pot:payout?0:game.pot,stage:!highlight?0:payout?2:1};
}
export function pokerRaiseBounds(game,legal,value){
 const min=Math.min(Math.max(0,game.current??0),legal.max),initial=Math.min(legal.min,legal.max);
 value=Math.round(Math.max(min,Math.min(legal.max,value??initial)));
 return {min,max:legal.max,value,valid:legal.canRaise&&value>(game.current??0)&&(value>=legal.min||value===legal.max)};
}
