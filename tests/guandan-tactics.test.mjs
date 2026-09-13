import assert from 'node:assert/strict';
import {Guandan,interpretations} from '../dist/guandan.mjs';
import {chooseCompetitive} from '../dist/guandan-strategy.mjs';
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
let id=200;const cards=ranks=>ranks.map((r,n)=>({id:id++,r,s:['♠','♣','♦','♥'][n%4]}));
const state=(hand,extra={})=>({seat:0,hand,level:2,counts:[hand.length,27,27,27],target:null,owner:-1,actions:[],finish:[],...extra});
for(let seed=1;seed<=100;seed++){
 const g=new Guandan({random:rng(seed),level:2+seed%13});
 for(let seat=0;seat<4;seat++){const s=g.snapshot(seat),m=chooseCompetitive(s);assert(m);assert.equal(m.tier,0,'full opening hands should use ordinary combinations');assert(interpretations(m.cards,g.level).some(x=>x.key===m.key))}
}
const h=cards([3,3,3,3,5]);
const high=interpretations(cards([16]),2)[0];
assert.equal(chooseCompetitive(state(h,{target:high,owner:1,counts:[5,1,10,12]})).type,'bomb','block an opponent who is about to finish');
assert.equal(chooseCompetitive(state(cards([3,3,3,3]))).type,'bomb','do not suppress a winning final bomb');
assert.equal(chooseCompetitive(state(h,{target:high,owner:2})),null,'keep the teammate in control');
const opening=cards([3,3,3,3,4,4,5,5,7,7,9,9,11,11,13,13]);
assert.equal(chooseCompetitive(state(opening,{target:high,owner:1})),null,'do not bomb a high single early merely because no ordinary response exists');
assert.deepEqual(opening,state(opening).hand);
console.log('400 full-hand openings, legal choices, early bomb conservation, teammate control and required finishing/blocking bombs passed.');
