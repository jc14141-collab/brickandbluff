import test from 'node:test';import assert from 'node:assert/strict';
import {pokerDisplay,pokerRaiseBounds} from '../dist/poker-display.mjs';
import {Poker} from '../dist/poker.mjs';
import {RoomGame} from '../dist/room-game.mjs';
const end=10000;
const settled=()=>({done:true,showdown:true,board:Array(5).fill({r:14,s:'♠'}),pot:400,paid:[400,0],players:[{chips:400},{chips:0}]});
test('all-in chips remain unawarded through runout, river animation and best-five highlighting',()=>{
 const g=settled();for(const t of [0,2199,2200,3299]){const v=pokerDisplay(g,end,end+t);assert.equal(v.players[0].chips,0);assert.equal(v.pot,400);assert.equal(v.payout,false);assert.equal(v.highlight,t>=2200)}
 const v=pokerDisplay(g,end,end+3300);assert.equal(v.players[0].chips,400);assert.equal(v.pot,0);assert(v.payout);assert.equal(g.players[0].chips,400,'presentation must not mutate settlement');
 g.board.pop();assert(!pokerDisplay(g,end,end+10000).payout);
});
test('split pots credit each winner only after highlighting; folding winner needs no five-card board',()=>{
 const g=settled();g.paid=[200,200];g.players=[{chips:250},{chips:300}];assert.deepEqual(pokerDisplay(g,end,end+2200).players.map(p=>p.chips),[50,100]);assert.deepEqual(pokerDisplay(g,end,end+3300).players.map(p=>p.chips),[250,300]);g.showdown=false;g.board=[];assert(pokerDisplay(g,end,end+3300).payout);
});
test('slider begins at current table bet, while confirmation preserves legal minimum and short all-in',()=>{
 const g=new Poker([2000,2000,2000,2000]);const l=g.legal(3);assert.equal(pokerRaiseBounds(g,l).min,20);assert.equal(pokerRaiseBounds(g,l).value,40);assert(!pokerRaiseBounds(g,l,20).valid);assert(!pokerRaiseBounds(g,l,39).valid);assert(pokerRaiseBounds(g,l,40).valid);g.act(3,'raise',100);assert.equal(pokerRaiseBounds(g,g.legal(0)).min,100);assert(!pokerRaiseBounds(g,g.legal(0),100).valid);
 const short={max:130,min:180,canRaise:true};assert(pokerRaiseBounds(g,short,130).valid);assert(!pokerRaiseBounds(g,short,129).valid);
});
test('runout refund animation is deferred until the settlement display releases it',()=>{
 const calls=[],ui=Object.assign(Object.create(RoomGame.prototype),{eventCursor:0,order:[0,1],now:()=>end,scene:{moveChips:(...args)=>calls.push(args),react(){},onSound:true},beep(){}});
 const r={endedAt:end,game:{...settled(),done:false,runout:true,events:[{id:1,kind:'return',seat:0,amount:50}]}};ui.pokerEvents(r);assert.deepEqual(calls,[]);assert.equal(ui.pendingPokerReturns.length,1);
});

test('room UI keeps paid chips in the pot until highlighted cards settle and animates each split winner once',()=>{
 const g=new Poker([100,100],{dealer:0});g.act(0,'allin');g.act(1,'call');while(!g.done)g.advance();
 // Force a split presentation to cover both winners without depending on the random deck.
 g.paid=[100,100];g.players.forEach(p=>p.chips=100);
 const r={mode:'poker',status:'roundEnd',you:0,smallBlind:10,endedAt:end,reviewUntil:end+10000,seats:[{name:'甲',seed:1,totalChips:200},{name:'乙',seed:2,totalChips:200}],game:{...g,pot:g.pot,legal:g.legal(0)}};
 const nodes=new Map(),calls=[];let now=end,view;
 const ui=Object.assign(Object.create(RoomGame.prototype),{order:[0,1],now:()=>now,q:s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',classList:{toggle(){},add(){}}});return nodes.get(s)},host:{querySelectorAll:()=>[]},rooms:{voice:null},scene:{sync:v=>view=v,moveChips:(...args)=>calls.push(args)},beep(){}});
 ui.renderTable(r);assert.equal(view.players[0].chips,0);assert.equal(view.pot,200);assert.deepEqual(calls,[]);assert.match(nodes.get('.mp-labels').innerHTML,/◉ 0/);
 now=end+2200;ui.renderTable(r);assert(view.winningCards.length);assert.equal(view.players[0].chips,0);assert.deepEqual(calls,[]);
 now=end+3300;ui.renderTable(r);assert.equal(view.players[0].chips,100);assert.equal(view.pot,0);assert.deepEqual(calls,[[0,100,true],[1,100,true]]);ui.renderTable(r);assert.equal(calls.length,2);
});
