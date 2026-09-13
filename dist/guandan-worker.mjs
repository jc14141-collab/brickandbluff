import {chooseCompetitive} from './guandan-strategy.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,move:chooseCompetitive(data.snapshot)})}catch(e){self.postMessage({id:data.id,error:e.message})}};
