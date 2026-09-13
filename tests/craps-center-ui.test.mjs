import test from 'node:test';
import assert from 'node:assert/strict';
import {CrapsUI} from '../dist/craps-ui.mjs';
import {Craps,LABELS} from '../dist/craps.mjs';
import {MAIN_CELLS as BET_CELLS,BET_GROUPS,cellsForGroup} from '../dist/craps-single-layout.mjs';
globalThis.document??={querySelector(){return null}};
function setup(){globalThis.document.querySelector??=()=>null;const nodes=new Map();const node=s=>{if(!nodes.has(s))nodes.set(s,{querySelectorAll(){return[]},innerHTML:'',dataset:{},classList:{toggle(){}}});return nodes.get(s)};const ui=Object.create(CrapsUI.prototype);Object.assign(ui,{engine:new Craps(1000),wagerQueue:[],wagerFlight:[],beep(){},toast:assert.fail,chip:10,selected:'h6',betDeadline:Date.now()+15000,message:'',q:node,host:{querySelectorAll(){return[]}}});return{ui,node}}
test('solo practice throws immediately and returns to unlimited betting',async()=>{
 const {ui,node}=setup();let throws=0;Object.assign(ui,{alive:true,betDeadline:0,onBank(){},beep(){},toast:assert.fail,wait:async()=>{},scene:{setPhase(){},setWagers(){},throw:async()=>{throws++}}});ui.render();assert.equal(ui.phase,'bets');assert(!node('.craps-dock').innerHTML.includes('data-roll disabled'));await ui.roll();assert.equal(throws,1);assert.equal(ui.engine.history.length,1);assert.equal(ui.phase,'bets');
});
test('single enlarged board shows hardways and propositions together with actual amounts',()=>{
 const {ui,node}=setup();ui.engine.add('h6',10);ui.engine.add('any7',25);ui.render();const html=node('.craps-board').innerHTML;
 for(const k of BET_CELLS.map(c=>c.key))assert(html.includes(`data-bet="${k}"`),k);assert.equal((html.match(/data-bet=/g)||[]).length,BET_CELLS.length);assert(!html.includes('data-area='));assert.match(html,/3 \+ 3 · 9:1/);assert.match(html,/30:1/);assert.match(html,/title="你：10"/);assert.equal(ui.engine.escrow,35);
});
test('all cells lock during ready, rolling and the three-second landing hold',()=>{
 const {ui,node}=setup();for(const phase of ['ready','rolling','landed','result']){ui.localPhase=phase;ui.render();assert.equal((node('.craps-board').innerHTML.match(/data-bet="[^"]+" disabled/g)||[]).length,BET_CELLS.length);assert.equal(node('.craps-room').dataset.phase,phase)}
});
test('landing shows dice without leaking settlement; wager names are escaped in every view',()=>{
 const {ui,node}=setup();ui.network={phase:'landed',roll:{dice:[2,5]},others:[{name:'<img onerror=x>',bets:{h6:25},travel:{c6:10}}]};ui.render();assert.match(node('.craps-readout').innerHTML,/= 7/);assert.equal(ui.engine.history.length,0);assert.match(node('.craps-ledger').innerHTML,/&lt;img onerror=x&gt;/);assert(!node('.craps-board').innerHTML.includes('<img'));
 ui.network.phase='bets';ui.network.deadline=Date.now()+15000;ui.network.send=()=>Promise.resolve();ui.network.canSend=()=>true;ui.act('bet','pass');clearTimeout(ui.wagerTimer);assert.equal(ui.engine.bank,990,'pending wager is shown immediately');assert.deepEqual(ui.wagerQueue,[{action:'bet',key:'pass',amount:10}]);
});

test('each additional betting group displays every player exact stake',()=>{
 const {ui,node}=setup();for(const [group]of BET_GROUPS){ui.betGroup=group;const cells=cellsForGroup(group);ui.network={phase:'bets',deadline:Date.now()+15000,others:Array.from({length:8},(_,i)=>({name:'Player'+i,bets:Object.fromEntries(cells.map(c=>[c.key,5+i])),travel:{}}))};ui.render();const html=node('.craps-board').innerHTML;for(const c of cells){assert(html.includes(`data-bet="${c.key}"`))}for(let i=0;i<8;i++)assert(html.includes(`<span>Player${i}</span><em>${5+i}</em>`));assert.equal((html.match(/data-bet=/g)||[]).length,cells.length)}
});
