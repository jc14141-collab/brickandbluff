import test from 'node:test';
import assert from 'node:assert/strict';
import {newBlackjack,blackjackAct,blackjackTick} from '../dist/blackjack.mjs';
import {skillAction,startSkills} from '../server/solo-skills.mjs';
const cards=rs=>rs.map((r,i)=>({r,s:'♠',id:String(i)}));
function setup(afterBet=false){
 const game=newBlackjack([2000],Math.random,0);
 const r={mode:'blackjack',game,seats:[{role:3,bank:2000,name:'Ranger'}],skill:{enabled:true},seq:0};
 startSkills(r);
 if(afterBet)blackjackAct(game,0,'bet',100,0);
 skillAction(r,0,{},0);
 if(!afterBet)blackjackAct(game,0,'bet',100,0);
 assert.equal(game.players[0].bank,1800);
 assert.equal(r.skill.events.length,1);
 return game;
}
function finish(g,dealer=[10,8]){
 g.dealer=cards(dealer);g.phase='dealer';g.nextAt=0;
 blackjackTick(g,[false],1);
 assert.equal(g.done,true);
 const p=g.players[0],bank=p.bank;
 assert.equal(p.riskReserve,0);
 blackjackTick(g,[false],9999);
 assert.equal(p.bank,bank,'settlement must not repeat');
 return p;
}
for(const afterBet of [false,true]) for(const [name,hand,dealer,net] of [
 ['ordinary win',[10,10],[10,8],150],
 ['natural 21 win',[14,10],[10,8],250],
 ['drawn 21 win',[10,6,5],[10,8],150],
 ['ordinary loss',[10,6],[10,8],-150],
 ['bust',[10,10,5],[10,8],-200],
 ['push',[10,8],[10,8],0],
 ['21 push',[10,6,5],[10,6,5],0],
 ['natural push',[14,10],[14,10],0],
 ['dealer blackjack beats drawn 21',[10,6,5],[14,10],-150],
]){
 test(name+'; activate '+(afterBet?'after':'before')+' betting',()=>{
  const g=setup(afterBet);g.players[0].hands[0].cards=cards(hand);
  const p=finish(g,dealer);
  assert.equal(p.bank,2000+net);assert.equal(p.delta,net);
 });
}
test('double uses doubled stake for 21 reward',()=>{
 const g=setup(),p=g.players[0];p.hands[0].cards=cards([5,6]);g.phase='players';g.turn=0;g.deck.push(...cards([10]));
 blackjackAct(g,0,'double',0,0);
 assert.equal(p.bank,1600);assert.equal(p.riskReserve,200);
 finish(g);assert.equal(p.bank,2300);assert.equal(p.delta,300);
});
test('split settles each hand independently and returns full reserve',()=>{
 const g=setup(),p=g.players[0];p.hands[0].cards=cards([10,10]);g.phase='players';g.turn=0;
 blackjackAct(g,0,'split',0,0);
 p.hands[0].cards=cards([10,14]);p.hands[1].cards=cards([10,10,5]);
 finish(g);assert.equal(p.bank,1950);assert.equal(p.delta,-50);
 assert.deepEqual(p.hands.map(h=>h.delta),[150,-200]);
});
test('classic payouts are unchanged',()=>{
 for(const [rs,net] of [[[14,10],150],[[10,6,5],100],[[10,6],-100],[[10,10,5],-100]]){
  const g=newBlackjack([2000],Math.random,0);blackjackAct(g,0,'bet',100,0);
  g.players[0].hands[0].cards=cards(rs);finish(g);
  assert.equal(g.players[0].bank,2000+net);
 }
});