import {chooseMove} from './bigtwo-strategy.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,move:chooseMove(data.snapshot)})}catch(e){self.postMessage({id:data.id,error:e.message})}};
