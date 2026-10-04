// Exact denomination accounting; a stack is money, not a capped decorative counter.
export const CHIP_VALUES=[1000000000,100000000,10000000,1000000,100000,10000,1000,500,100,25,5,1];
export const chipColor=value=>value>=10000?0x8860ba:value>=1000?0xdfb85c:value>=500?0x937957:value>=100?0x335e93:value>=25?0x3d906a:value>=5?0xb84442:0xe1d7b6;
export function chipStacks(amount){let left=Math.max(0,Math.round(Number(amount)||0));const stacks=[];for(const value of CHIP_VALUES){const count=Math.floor(left/value);left-=count*value;if(count)stacks.push({value,count,color:chipColor(value)})}return stacks}

export function potLayout(narrow=false){return{x:narrow?3.25:0,z:narrow?1.65:-1.72,scale:narrow?.64:.85,chipScale:narrow?.40:.55}}
export function chipSlots(stacks,pot=false){const columns=Math.min(pot?3:4,stacks.length),rows=Math.ceil(stacks.length/columns);return stacks.map((s,i)=>({...s,x:(i%columns-(columns-1)/2)*.225,z:(Math.floor(i/columns)-(pot?(rows-1)/2:0))*.24}))}
