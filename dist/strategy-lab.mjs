// Experimental poker strategy entry point, for scripts and tests only.
// Same decide()/equity() options as before the split (rangeModel, lookahead,
// riverValue, multiwayAllIn); it wires the lab models into the production
// strategy through its `lab` hooks. Do not import this from app, worker or server code.
import {decide as baseDecide,equity as baseEquity} from './strategy.mjs';
import {multiwayAllInValue} from './poker-multiway-value.mjs';
import {riverActionValue} from './poker-river-value.mjs';
import {opponentRange} from './poker-range.mjs';
import {planHeadsUp} from './poker-planning.mjs';
import {raiseFoldRate} from './poker-fold-model.mjs';
export {PROFILES,randomProfile,preflop} from './strategy.mjs';
function hooks({rangeModel='legacy',lookahead=false,riverValue=false,multiwayAllIn=false,foldModel=false}){
 if(rangeModel!=='public'&&!lookahead&&!riverValue&&!multiwayAllIn&&!foldModel)return null;
 return{
  rangeOf:rangeModel==='public'?opponentRange:null,
  collectWorlds:multiwayAllIn,
  // Same order as the pre-split code: river action value first, then heads-up search.
  before:riverValue||lookahead?(snapshot,model,options)=>(riverValue&&riverActionValue(snapshot,model,options))||(lookahead&&planHeadsUp(snapshot,model,options))||null:null,
  raiseValue:multiwayAllIn?multiwayAllInValue:null,
  // Round 8: fold probability of each raise from public ranges + response model.
  foldRate:foldModel?raiseFoldRate:null
 };
}
export function equity(snapshot,samples=1200,rng=Math.random,{rangeModel='legacy',worlds=null}={}){
 return baseEquity(snapshot,samples,rng,{rangeOf:rangeModel==='public'?opponentRange:null,worlds});
}
export function decide(snapshot,profile=0,{rangeModel='legacy',lookahead=false,riverValue=false,multiwayAllIn=false,foldModel=false,...options}={}){
 return baseDecide(snapshot,profile,{...options,lab:hooks({rangeModel,lookahead,riverValue,multiwayAllIn,foldModel})});
}
