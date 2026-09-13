// Posted stakes remain visible until settlement; never count settled bets twice.
export function chipBalance(room,index){
 const seat=room.seats[index],g=room.game,p=g?.players?.[index];
 if(seat?.waiting)return{available:seat.bank,committed:0,totalChips:seat.bank};
 let available=seat?.bank??0,committed=0;
 if(g&&room.mode==='poker'){available=p.chips;if(!g.done)committed=p.total??0}
 if(g&&room.mode==='blackjack'){available=p.bank;if(!g.done)committed=p.hands.reduce((n,h)=>n+h.bet,0)+(p.riskReserve??0)}
 if(g&&room.mode==='roulette'){available=p.bank;if(!g.done)committed=Object.values(p.bets).reduce((n,v)=>n+v,0)}
 if(g&&room.mode==='craps'){const t=g.tables[index];available=t.bank;committed=[...Object.values(t.bets),...Object.values(t.travel??{})].reduce((n,v)=>n+v,0)}
 return {available,committed,totalChips:Math.round((available+committed)*100)/100};
}
