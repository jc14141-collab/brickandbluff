import assert from 'node:assert/strict';
import {GuandanUI,handCard} from '../dist/guandan-ui.mjs';
import {GuandanMatch,chooseMove} from '../dist/guandan.mjs';
const nodes=new Map();const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',onclick:null});return nodes.get(s)};
let seed=12;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const ui=Object.create(GuandanUI.prototype);Object.assign(ui,{match:new GuandanMatch(random),selected:new Set(),choice:null,alive:true,busy:false,hintIndex:0,message:'',q:node,host:{querySelectorAll(){return[]}},toast(s){throw Error(s)},beep(){},async pause(){}});ui.game=ui.match.start();ui.game.turn=0;ui.render();
assert.equal((node('.gd-hand-area').innerHTML.match(/data-gcard=/g)||[]).length,27);assert.match(node('.gd-seat-labels').innerHTML,/对家 · 队友/);assert.equal((node('.gd-hand-area').innerHTML.match(/gd-hand-row/g)||[]).length,2);
assert.equal((node('.gd-seat-plays').innerHTML.match(/class="gd-seat-play /g)||[]).length,4);
await ui.hint();assert(ui.selected.size>0);assert(ui.options().some(m=>m.key===ui.choice));node('[data-gclear]').onclick();assert.equal(ui.selected.size,0);
let turns=0;while(!ui.game.done){assert(++turns<200);if(ui.game.turn!==0)await ui.run();if(ui.game.done)break;const m=chooseMove(ui.game.snapshot(0));ui.selected=new Set(m?.cards.map(c=>c.id)||[]);ui.choice=m?.key??null;await ui.play(!m)}assert(ui.game.done);assert.match(node('.gd-end').innerHTML,/剩余手牌公开/);assert.match(node('.gd-end').innerHTML,/下一副/);assert.equal(ui.selected.size,0);
assert.match(handCard({id:1,r:2,s:'♥'},2),/逢人配/);assert.match(handCard({id:2,r:16,s:'♥'},2),/大王/);
// The CPU runner retains its lock during its post-play animation pause.
ui.game=ui.match.start();while(ui.game.returns.length)ui.match.autoReturn();ui.game.turn=1;ui.busy=false;let pauses=0;ui.pause=async()=>{if(++pauses===2){assert(ui.busy);ui.alive=false}};await ui.run();
console.log('Guandan UI: 27 unique buttons in two rows, hint/clear, full human/CPU game, results, and animation turn lock passed.');
ui.alive=true;ui.game.last=[null,null,null,null];const sample={key:'bomb:9:4:',type:'bomb',rank:9,tier:4,size:4,cards:Array.from({length:4},(_,i)=>({id:200+i,r:9,s:'♠'})),assignments:Array.from({length:4},(_,i)=>({id:200+i,r:9,s:'♠'}))};ui.game.last[1]=sample;ui.game.last[2]={...sample,key:'bomb:10:4:',rank:10};ui.game.owner=2;ui.game.actions=[{seat:2,cards:sample.cards}];ui.playSignature=null;ui.renderPlays();const markup=node('.gd-seat-plays').innerHTML;assert.equal((markup.match(/gd-seat-cards/g)||[]).length,2);assert.match(markup,/fx-bomb/);assert.match(markup,/当前最大/);ui.renderPlays();assert.equal(node('.gd-seat-plays').innerHTML,markup);ui.game.last=Array(4).fill(null);ui.game.status=Array(4).fill('');ui.game.trick++;ui.renderPlays();assert(!node('.gd-seat-plays').innerHTML.includes('gd-seat-cards'));
console.log('Per-seat cards retained, current leader, bomb effect emitted once and trick cleanup passed');
