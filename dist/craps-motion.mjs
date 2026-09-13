import {physicalPose} from './craps-physics.mjs';
import {CRAPS_TIMING} from './craps-layout.mjs';
export const FELT_Y=1.205;
export const clamp=v=>Math.max(0,Math.min(1,v));
export const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
// Shared deterministic choreography: the random result controls only the final orientation.
// All dice positions remain inside the bumper wall, including the rail impact.
export function dicePose(progress,index,seed=0){const {p}=physicalPose(progress,index,seed);return{x:p.x,y:p.y,z:p.z,spin:0}}
export function shotCamera(progress,aspect=16/9,seed=0){
 const t=clamp(progress),a=dicePose(t,0,seed),b=dicePose(t,1,seed),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,cz=(a.z+b.z)/2;
 const follow=smooth((t-.17)/.25),close=smooth((t-.66)/.34),portrait=Math.max(1,1/Math.max(.45,aspect));
 const target={x:-1*(1-follow)+cx*follow,y:1.3*(1-follow)+cy*follow,z:.9*(1-follow)+cz*follow};
 const spread=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/2.2);
 const chase={x:Math.max(-6.1,Math.min(6.1,cx+(3.2-close*.9)*portrait*spread)),y:cy+(2.65+close*.25)*spread,z:Math.max(-2.5,Math.min(2.5,cz+(2.5-close*.4)*portrait*spread))};
 return{position:{x:(6.85+(portrait-1)*2)*(1-follow)+chase.x*follow,y:(3.85+(portrait-1)*.5)*(1-follow)+chase.y*follow,z:1.65*(1-follow)+chase.z*follow},target};
}
export const rollProgress=(now,roll)=>clamp((now-roll.started)/(roll.ends-roll.started||CRAPS_TIMING.throw));
