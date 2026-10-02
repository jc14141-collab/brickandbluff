export function rankingName(name,isSelf=false){const chars=Array.from(String(name??''));return isSelf?chars.join(''):chars.slice(0,2).join('')+'*'.repeat(Math.max(0,chars.length-2))}
