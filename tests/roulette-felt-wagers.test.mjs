import test from 'node:test';
import assert from 'node:assert/strict';
import {RouletteUI} from '../dist/roulette-ui.mjs';
import {newRoulette} from '../dist/roulette.mjs';

// Felt boxes show each seat's stake as a seat-coloured amount; crowded boxes collapse into one
// stack with the box total, and the full split stays in the title.
function view(bets){
 const g=newRoulette([2000,2000,2000,2000],0);bets.forEach(([seat,key,n])=>g.players[seat].bets[key]=n);
 const ui=Object.create(RouletteUI.prototype);
 Object.assign(ui,{r:{you:0,seats:['你','Luna','<b>Max</b>','Kite'].map(name=>({name})),game:g},selected:'red'});
 return key=>ui.cell(key);
}

test('one or two players on a box show their own seat-coloured amounts',()=>{
 const cell=view([[0,'red',25],[1,'red',30],[0,'n17',10]]);
 const red=cell('red');
 assert.match(red,/--player:#d9f080[^>]*title="你：25">25</);
 assert.match(red,/title="Luna：30">30</);
 assert(!red.includes('rl-stack'));
 assert.match(cell('n17'),/title="你：10">10</);
});

test('crowded boxes collapse into one stack with the total and an escaped breakdown',()=>{
 const cell=view([[0,'red',25],[1,'red',30],[2,'red',35],[0,'n17',10],[3,'n17',5]]);
 const red=cell('red');
 assert.match(red,/class="rl-stack"/);assert.match(red,/>90<\/span>/);
 assert.match(red,/title="你：25 · Luna：30 · &lt;b&gt;Max&lt;\/b&gt;：35"/);
 assert.equal((red.match(/<i style="--player:/g)||[]).length,3);
 const n17=cell('n17');assert.match(n17,/class="rl-stack"/,'two players already crowd a single number');assert.match(n17,/>15<\/span>/);
});
