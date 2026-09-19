import test from 'node:test';
import assert from 'node:assert/strict';
import {newBlackjack,blackjackAct,blackjackTick,blackjackView} from '../dist/blackjack.mjs';
import {skillAction,startSkills} from '../server/solo-skills.mjs';
import {renderRoomSkills} from '../dist/room-skills.mjs';
const card=r=>({r,s:'♠'});
function setup(role){
 const game=newBlackjack([2000],Math.random,0);
 blackjackAct(game,0,'bet',100,0);
 const p=game.players[0];p.hands[0].cards=[card(5),card(5)];
 game.dealer=[card(10),card(7)];game.phase='players';game.turn=0;game.deck.push(card(2));
 const r={mode:'blackjack',game,seats:[{role,bank:2000,name:'Player'}],skill:{enabled:true},seq:0};
 startSkills(r);return r;
}
for(const role of [0,1,2]){
 test('role '+role+' can activate before first action and only once',()=>{
  const r=setup(role);skillAction(r,0,{index:0,choice:'dealer'},0);
  assert.equal(r.skill.players[0].used,true);assert.equal(r.skill.events.length,1);
  assert.throws(()=>skillAction(r,0,{index:0,choice:'dealer'},0));
 });
 for(const action of ['hit','stand','double','split'])test('role '+role+' blocked after '+action+' including restored state and UI',()=>{
  let r=setup(role);blackjackAct(r.game,0,action,0,0);
  if(action==='hit')blackjackTick(r.game,[false],1201);
  r=JSON.parse(JSON.stringify(r));
  const before=JSON.stringify(r);
  assert.throws(()=>skillAction(r,0,{index:0,choice:'dealer'},2000),/已行动/);
  assert.equal(JSON.stringify(r),before,'rejection must not charge or mutate');
  const viewGame=blackjackView(r.game);assert.equal(viewGame.players[0].acted,true);
  let html='';const node={insertAdjacentHTML:(_,s)=>html+=s};
  renderRoomSkills({q:sel=>sel==='.mp-own'?node:null,skillRound:'r:1',skillCursor:-1},
   {...r,id:'r',round:1,you:0,game:viewGame,skill:{...r.skill,...r.skill.players[0]}});
  assert.match(html,/data-solo-skill disabled/);assert.match(html,/已行动/);
 });
 test('role '+role+' cannot activate during dealer or another turn',()=>{
  const r=setup(role);r.game.turn=1;
  assert.throws(()=>skillAction(r,0,{index:0,choice:'dealer'},0));
  r.game.turn=0;r.game.phase='dealer';
  assert.throws(()=>skillAction(r,0,{index:0,choice:'dealer'},0));
 });
}
test('invalid action leaves skill available, new round resets, legacy drawn hand blocks',()=>{
 const r=setup(0);
 assert.throws(()=>blackjackAct(r.game,0,'unknown',0,0));
 assert.equal(blackjackView(r.game).players[0].acted,false);
 r.game.players[0].hands[0].cards.push(card(2));
 assert.throws(()=>skillAction(r,0,{},0),/已行动/);
 assert.equal(blackjackView(newBlackjack([2000])).players[0].acted,false);
});