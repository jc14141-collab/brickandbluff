export const BLINDS=Array.from({length:50},(_,i)=>(i+1)*10);
export function smallBlind(value=10){const n=Number(value);if(!BLINDS.includes(n))throw Error('小盲须为10至500之间、每10一档');return n}
export const entryChips=(small=10)=>smallBlind(small)*2*100;
export const blindOptions=value=>BLINDS.map(n=>`<option value="${n}" ${n===value?'selected':''}>${n} / ${n*2}</option>`).join('');
