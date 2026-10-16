// Free-play Guandan must never debit a wallet or create profit/loss.
// This bounded incident repair uses the recorded Guandan loss, never a guessed balance.
export const GUANDAN_REPAIR='guandanWalletTest2V1';
export function repairGuandanWallet(state,now=Date.now()){
 if(state.repairs?.[GUANDAN_REPAIR])return;
 const p=state.players.find(p=>p.name==='test2');if(!p)return;
 const previousBank=p.bank,old=p.gameStats?.guandan,previousNet=old?.net??0;
 let refund=Math.max(0,-previousNet),held=0;
 for(const [id,raw] of Object.entries(state.rooms)){
  const r=JSON.parse(raw);if(r.mode!=='guandan')continue;let changed=false;
  for(const seat of r.seats){if((seat.auth===p.auth||seat.cashOwner===p.auth)&&(p.room===r.id||seat.cashOwner===p.auth)){held+=seat.bank??0;seat.bank=0;changed=true;if(r.statBasis?.[seat.id])r.statBasis[seat.id].bank=0}}
  if(r.pendingStats){r.pendingStats=r.pendingStats.filter(e=>{if(e.auth===p.auth&&e.mode==='guandan'&&e.net<0){refund-=e.net;changed=true;return false}return true})}
  if(changed)state.rooms[id]=JSON.stringify(r);
 }
 refund=Math.round(refund+held);p.bank+=refund;
 if(old){old.net=0;old.best=0;old.worst=0;delete old.bestAt;delete old.worstAt}
 const receipt={id:GUANDAN_REPAIR,playerId:p.id,name:p.name,refunded:refund,previousBank,correctedBank:p.bank,previousNet,correctedNet:0,at:now};
 (state.repairs??={})[GUANDAN_REPAIR]=receipt;
 (state.audit??=[]).unshift({kind:'guandanWalletRepair',target:p.id,name:p.name,amount:refund,at:now,repair:GUANDAN_REPAIR});state.audit=state.audit.slice(0,1000);
 return receipt;
}
