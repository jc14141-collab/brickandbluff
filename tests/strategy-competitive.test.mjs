import assert from 'node:assert/strict';
import {Guandan,chooseMove,interpretations} from '../dist/guandan.mjs';
import {chooseCompetitive,planCost} from '../dist/guandan-strategy.mjs';
let id=1000;const cs=rs=>rs.map(r=>({id:id++,r,s:'♠'}));
const snapshot=(hand,counts=[10,10,10,10])=>({seat:0,hand,level:2,counts,target:null,owner:-1,actions:[],finish:[]});
const s=snapshot(cs([3,3,4,5,6,7,8,9,10]),[9,1,10,8]);assert.notEqual(chooseCompetitive(s).type,'single');
const one=snapshot(cs([3,14,16]),[3,1,8,1]);assert.equal(chooseCompetitive(one).rank,16);
assert.equal(planCost(cs([3,3,3,4,4]),2),1);assert.equal(planCost(cs([3,4,5,6,7]),2),1);
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
let wins=0,games=0,decisions=0,elapsed=0,max=0;
for(let seed=1;seed<=12;seed++)for(const team of[0,1]){const g=new Guandan({random:rng(seed),first:seed%4});let steps=0;while(!g.done){assert(++steps<700);const snap=g.snapshot(g.turn),advanced=g.turn%2===team,t=performance.now(),m=advanced?chooseCompetitive(snap):chooseMove(snap);if(advanced){const ms=performance.now()-t;elapsed+=ms;max=Math.max(max,ms);decisions++}if(m)assert(interpretations(m.cards,g.level,g.target).some(x=>x.key===m.key));g.act(g.turn,m?.cards.map(c=>c.id)||[],m?.key)}games++;if(g.finish[0]%2===team)wins++}
console.log({games,competitiveTeamWins:wins,decisions,averageMs:+(elapsed/decisions).toFixed(1),maxMs:+max.toFixed(1),note:'paired seeded comparison with former strategy, not a certified rating'});
