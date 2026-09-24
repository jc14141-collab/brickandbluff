import {roundChips} from './chips.mjs';
import {EXTRA_LABELS,extraUnit,extraError,settleExtras} from './craps-extra.mjs';
export const NUMBERS=[4,5,6,8,9,10];
export const HARDWAYS=[4,6,8,10];
export const PROPS=[{key:'any7',label:'Any 7',totals:[7],pay:4},{key:'craps',label:'Any Craps',totals:[2,3,12],pay:7},{key:'r2',label:'2 · 蛇眼',totals:[2],pay:30},{key:'r3',label:'3 · Ace Deuce',totals:[3],pay:15},{key:'r11',label:'11 · Yo',totals:[11],pay:15},{key:'r12',label:'12 · Boxcars',totals:[12],pay:30}];
export const LABELS={...EXTRA_LABELS,pass:'Pass Line',dont:'Don’t Pass',come:'Come',dcome:'Don’t Come',field:'Field',big6:'Big 6',big8:'Big 8',...Object.fromEntries(NUMBERS.map(n=>['p'+n,'Place '+n])),...Object.fromEntries(HARDWAYS.map(n=>['h'+n,'Hard '+n])),...Object.fromEntries(PROPS.map(p=>[p.key,p.label]))};
export function restoreCraps(data){return Object.assign(new Craps(data.bank),data,{bets:{...new Craps(0).bets,...data.bets},travel:{...data.travel}})}
export function die(random=globalThis.crypto){const a=new Uint32Array(1);do{random.getRandomValues(a)}while(a[0]>=4294967292);return a[0]%6+1}
export class Craps{
 constructor(bank){this.bank=bank;this.point=0;this.bets=Object.fromEntries(Object.keys(LABELS).map(k=>[k,0]));this.travel={};this.rolling=false;this.history=[]}
 get escrow(){return [...Object.values(this.bets),...Object.values(this.travel??{})].reduce((a,b)=>a+b,0)}
 unit(k){return extraUnit(this,k)??(k==='p6'||k==='p8'?6:5)}
 amount(k,chip,exact=false){if(exact)return chip;return Math.ceil(chip/this.unit(k))*this.unit(k)}
 add(k,chip,exact=false){if(this.rolling)throw Error('骰子停稳后再下注');if(!Object.hasOwn(this.bets,k))throw Error('未知下注区');if(!Number.isSafeInteger(chip)||chip<=0)throw Error('下注金额无效');if(this.point&&['pass','dont'].includes(k))throw Error('点数已建立，下一轮开局再下底线注');if(!this.point&&['come','dcome'].includes(k))throw Error('COME 注在目标点数建立后开放');const n=this.amount(k,chip,exact),error=extraError(this,k,n);if(error)throw Error(error);if(this.bank<n)throw Error('可用筹码不足');this.bank-=n;this.bets[k]+=n}
 remove(k){if(this.rolling)return 0;if(k==='pass'&&this.point)return 0;const n=this.bets[k]||0;this.bank+=n;this.bets[k]=0;if(k==='dont')this.remove('odont');return n}
 removeTravel(k){if(this.rolling||!/^d(4|5|6|8|9|10)$/.test(k))return 0;const n=this.travel?.[k]??0;this.bank+=n;this.travel[k]=0;this.remove('o'+k);return n}
 clear(){for(const k in this.bets)this.remove(k);for(const k in this.travel??{})this.removeTravel(k)}
 begin(){if(this.rolling)throw Error('正在掷骰');const dice=[die(),die()];this.rolling=true;return dice}
 settle(dice){if(!this.rolling)throw Error('没有待结算的掷骰');if(dice.length!==2||dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('无效骰子');const before=this.bank+this.escrow,total=dice[0]+dice[1],oldPoint=this.point,events=[];
 const resolve=(k,m,stay=false)=>{const stake=this.bets[k];if(!stake)return;const profit=roundChips(stake*m);this.bank+=m>=0?(stay?profit:stake+profit):0;if(!stay||m<0)this.bets[k]=0;events.push({key:k,profit:m<0?-stake:profit})};
 settleExtras(this,dice,oldPoint,events);
 resolve('field',[2,12].includes(total)?2:[3,4,9,10,11].includes(total)?1:-1);
 for(const p of PROPS)resolve(p.key,p.totals.includes(total)?p.pay:-1);
 for(const n of [6,8]){if(total===7)resolve('big'+n,-1);else if(total===n)resolve('big'+n,1,true)}
 // Existing COME contracts resolve first; fresh COME wagers travel only after that roll.
 this.travel??={};
 for(const n of NUMBERS)for(const prefix of ['c','d']){const k=prefix+n,stake=this.travel[k]??0;if(stake&&(total===7||total===n)){const win=prefix==='c'?total===n:total===7;this.bank+=win?stake*2:0;this.travel[k]=0;events.push({key:k,profit:win?stake:-stake})}}
 for(const [k,prefix]of [['come','c'],['dcome','d']]){if(NUMBERS.includes(total)){const stake=this.bets[k];if(stake){this.travel[prefix+total]=(this.travel[prefix+total]??0)+stake;this.bets[k]=0;events.push({key:k,profit:0,travel:total})}}else if([7,11].includes(total))resolve(k,prefix==='c'?1:-1);else resolve(k,prefix==='c'?-1:total===12?0:1)}
 // Hardways work on every roll, including come-out; wins leave the original stake up.
 for(const n of HARDWAYS){if(total===7||(total===n&&dice[0]!==dice[1]))resolve('h'+n,-1);else if(total===n)resolve('h'+n,[6,8].includes(n)?9:7,true)}
 if(!oldPoint){if([7,11].includes(total)){resolve('pass',1);resolve('dont',-1)}else if([2,3,12].includes(total)){resolve('pass',-1);resolve('dont',total===12?0:1)}else this.point=total}
 else{if(total===7){resolve('pass',-1);resolve('dont',1);for(const n of NUMBERS)resolve('p'+n,-1);this.point=0}else{if(NUMBERS.includes(total))resolve('p'+total,[4,10].includes(total)?9/5:[5,9].includes(total)?7/5:7/6,true);if(total===oldPoint){resolve('pass',1);resolve('dont',-1);this.point=0}}}
 this.rolling=false;const result={dice,total,oldPoint,point:this.point,events,net:roundChips(this.bank+this.escrow-before)};this.history.unshift(result);this.history.length=Math.min(12,this.history.length);return result
 }
}
