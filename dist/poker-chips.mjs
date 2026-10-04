// Exact denomination accounting; a stack is money, not a capped decorative counter.
export const CHIP_VALUES=[1000000000,100000000,10000000,1000000,100000,10000,1000,500,100,25,5,1];
export const chipColor=value=>value>=10000?0x8860ba:value>=1000?0xdfb85c:value>=500?0x937957:value>=100?0x335e93:value>=25?0x3d906a:value>=5?0xb84442:0xe1d7b6;
export function chipStacks(amount){let left=Math.max(0,Math.round(Number(amount)||0));const stacks=[];for(const value of CHIP_VALUES){const count=Math.floor(left/value);left-=count*value;if(count)stacks.push({value,count,color:chipColor(value)})}return stacks}

export function potLayout(narrow=false){return{x:narrow?3.25:0,z:narrow?1.65:-1.72,scale:narrow?.64:.85,chipScale:narrow?.40:.55}}
export function chipSlots(stacks,pot=false){const columns=Math.min(pot?3:4,stacks.length),rows=Math.ceil(stacks.length/columns);return stacks.map((s,i)=>({...s,x:(i%columns-(columns-1)/2)*.225,z:(Math.floor(i/columns)-(pot?(rows-1)/2:0))*.24}))}

// Table denominations scale with the blinds. Rendering is an approximation only;
// the wallet and settlement always retain the authoritative balance.
const CHIP_FACTORS=[1,5,25,100,500,2500,10000,50000,250000,1000000,5000000,25000000,100000000,500000000,2500000000];
const CHIP_COLORS=[0xe1d7b6,0xb84442,0x3d906a,0x335e93,0xdfb85c,0x8860ba];
export function tableChipValues(bigBlind=20){const unit=Math.max(1,Math.round(Number(bigBlind)/20)||1);return CHIP_FACTORS.map(n=>n*unit)}
export function balancedChipStacks(amount,{bigBlind=20,seed=0,pot=false}={}){
 const balance=Math.max(0,Math.round(Number(amount)||0));if(!balance)return [];
 let random=(Number(seed)>>>0)||17;const next=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296};
 const values=tableChipValues(bigBlind),first=Math.max(0,values.findIndex(v=>v>=balance/5000));
 const unit=values[first],represented=Math.max(unit,Math.round(balance/unit)*unit),counts=values.map(()=>0);
 let left=represented;for(let i=values.length-1;i>=first;i--){counts[i]=Math.floor(left/values[i]);left-=counts[i]*values[i]}
 const ratio=balance/(Math.max(1,bigBlind)*100),target=pot?22:Math.max(12,Math.min(40,Math.round(30+6*Math.log2(Math.max(.125,ratio)))+Math.floor(next()*5)-2));
 let total=counts.reduce((a,b)=>a+b,0);
 // Change large chips into smaller ones until the table has a comfortable amount.
 // A deterministic seed keeps each player's mix stable during polling and camera changes.
 while(total<target){const choices=[];for(let i=counts.length-1;i>first;i--){const change=values[i]/values[i-1];if(counts[i]&&total+change-1<=target)choices.push(i)}if(!choices.length)break;const i=choices[Math.floor(next()*Math.min(2,choices.length))],change=values[i]/values[i-1];counts[i]--;counts[i-1]+=change;total+=change-1}
 const stacks=[];for(let i=counts.length-1;i>=first;i--){let remaining=counts[i],columns=Math.ceil(remaining/6);while(remaining){const count=Math.ceil(remaining/columns--);stacks.push({value:values[i],count,color:CHIP_COLORS[Math.min(5,i)],approximate:represented!==balance});remaining-=count}}
 return stacks
}
