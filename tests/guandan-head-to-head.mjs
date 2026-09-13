import {Guandan} from '../dist/guandan.mjs';
import {chooseCompetitive as next} from '../dist/guandan-strategy.mjs';
import {chooseCompetitive as previous} from './fixtures/guandan-strategy-v13.mjs';
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
let wins=0,games=0,bombs=0,previousBombs=0;
for(let seed=Number(process.argv[3]||1001);seed<Number(process.argv[3]||1001)+Number(process.argv[2]||20);seed++)for(const team of[0,1]){const g=new Guandan({random:rng(seed),level:2+(seed%13),first:seed%4});let steps=0;while(!g.done){if(++steps>700)throw Error('stalled');const turn=g.turn,ours=turn%2===team,s=g.snapshot(turn),m=(ours?next:previous)(s);if(m?.tier&&s.hand.length===27&&!s.target){if(ours)bombs++;else previousBombs++}g.act(turn,m?.cards.map(c=>c.id)||[],m?.key)}games++;if(g.finish[0]%2===team)wins++}
console.log({games,wins,winRate:wins/games,openingBombs:bombs,previousOpeningBombs:previousBombs});
