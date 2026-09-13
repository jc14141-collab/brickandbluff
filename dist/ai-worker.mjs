import {decide} from './strategy.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:decide(data.snapshot,data.profile,{samples:data.snapshot.street>=2?1800:1200})})}catch(e){self.postMessage({id:data.id,error:String(e)})}};
