export const WHEEL=['0','28','9','26','30','11','7','20','32','17','5','22','34','15','3','24','36','13','1','00','27','10','25','29','12','8','19','31','18','6','21','33','16','4','23','35','14','2'];
export const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].map(String));
export const color=n=>n==='0'||n==='00'?'green':RED.has(String(n))?'red':'black';
export const BETS={};
const add=(key,label,numbers,pay,type)=>BETS[key]={key,label,numbers:numbers.map(String),pay,type};
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
for(const n of WHEEL)add('n'+n,n,[n],35,'straight');
for(let n=1;n<=36;n++){if(n%3)add('s'+n+'-'+(n+1),n+' / '+(n+1),[n,n+1],17,'split');if(n<=33)add('s'+n+'-'+(n+3),n+' / '+(n+3),[n,n+3],17,'split');if(n%3&&n<=32)add('c'+n,n+'–'+(n+4),[n,n+1,n+3,n+4],8,'corner')}
for(const ns of [['0','00'],['0','1'],['0','2'],['00','2'],['00','3']])add('s'+ns.join('-'),ns.join(' / '),ns,17,'split');
for(const ns of [['0','1','2'],['0','2','00'],['00','2','3']])add('t'+ns.join('-'),ns.join(' / '),ns,11,'street');
for(let n=1;n<=34;n+=3){add('t'+n,n+'–'+(n+2),range(n,n+2),11,'street');if(n<=31)add('l'+n,n+'–'+(n+5),range(n,n+5),5,'six')}
for(let i=0;i<3;i++){add('d'+i,'第 '+(i+1)+' 打',range(i*12+1,i*12+12),2,'outside');add('col'+i,'第 '+(i+1)+' 列',range(0,11).map(n=>n*3+i+1),2,'outside')}
add('red','红',range(1,36).filter(n=>RED.has(String(n))),1,'outside');add('black','黑',range(1,36).filter(n=>!RED.has(String(n))),1,'outside');
add('even','双',range(1,36).filter(n=>n%2===0),1,'outside');add('odd','单',range(1,36).filter(n=>n%2),1,'outside');add('low','1–18',range(1,18),1,'outside');add('high','19–36',range(19,36),1,'outside');add('top','0 / 00 / 1 / 2 / 3',['0','00','1','2','3'],6,'top');
export function drawPocket(){const a=new Uint32Array(1),limit=Math.floor(4294967296/38)*38;do{crypto.getRandomValues(a)}while(a[0]>=limit);return WHEEL[a[0]%38]}
export function newRoulette(banks,now=Date.now(),roller=0){return{players:banks.map(bank=>({bank,bets:{},staked:0,paid:0,delta:0})),roller,startAt:now,launchAt:null,closeAt:null,landAt:null,endAt:null,phase:'bets',pocket:null,done:false}}
export function rouletteAct(g,i,action,key,amount,now=Date.now()){if(action==='launch'){if(g.done||g.launchAt!==null)throw Error('本轮已经发球');if(i!==g.roller)throw Error('请等待轮到你发球');g.launchAt=now;g.closeAt=now+7000;g.landAt=now+15000;g.endAt=now+18500;g.phase='open';return}if(g.done||g.closeAt!==null&&now>=g.closeAt)throw Error('已经封盘，请等待下一局');const p=g.players[i];if(!p)throw Error('座位无效');if(action==='clear'){for(const v of Object.values(p.bets))p.bank+=v;p.bets={};return}if(!Object.hasOwn(BETS,key))throw Error('请选择有效下注区域');if(action==='remove'){p.bank+=p.bets[key]??0;delete p.bets[key];return}if(action!=='bet'||!Number.isSafeInteger(amount)||amount<1||amount>p.bank)throw Error('下注金额需为正整数，且不能超过可用筹码');p.bank-=amount;p.bets[key]=(p.bets[key]??0)+amount}
export function rouletteTick(g,now=Date.now(),draw=drawPocket){if(g.done||g.launchAt===null)return false;const before=g.phase;if(now>=g.closeAt&&g.pocket===null){const n=String(draw());if(!WHEEL.includes(n))throw Error('Invalid pocket');g.pocket=n}g.phase=now<g.launchAt?'bets':now<g.closeAt?'open':now<g.landAt?'locked':'landed';if(now>=g.endAt){for(const p of g.players){p.staked=Object.values(p.bets).reduce((a,b)=>a+b,0);p.paid=Object.entries(p.bets).reduce((sum,[k,v])=>sum+(BETS[k].numbers.includes(g.pocket)?v*(BETS[k].pay+1):0),0);p.delta=p.paid-p.staked;p.bank+=p.paid}g.done=true;g.phase='done'}return before!==g.phase}
export function rouletteView(g){return JSON.parse(JSON.stringify(g))}
export function rouletteBots(g,seats,rng=Math.random){seats.forEach((s,i)=>{if(!s.bot)return;const keys=['red','black','low','high','d0','d1','d2'],p=g.players[i];if(p.bank>=25)rouletteAct(g,i,'bet',keys[Math.floor(rng()*keys.length)],25,g.startAt);if(p.bank>=5)rouletteAct(g,i,'bet','n'+WHEEL[Math.floor(rng()*38)],5,g.startAt)})}
