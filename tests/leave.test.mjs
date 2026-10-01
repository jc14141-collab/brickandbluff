import test from 'node:test';
import assert from 'node:assert/strict';
import {newBlackjack,blackjackTick} from '../dist/blackjack.mjs';
test('blackjack continues when an unbet seat leaves',()=>{const g=newBlackjack([0,1000],Math.random,0);g.players[0].departed=true;for(let now=1000;now<200000&&!g.done;now+=5000)blackjackTick(g,[true,true],now);assert.equal(g.done,true);assert.equal(g.players[0].bet,0)});

import {Poker} from '../dist/poker.mjs';
import {createRoom,command} from '../server/rooms.mjs';
test('poker can leave out of turn, or while all-in, without leaving a pending action',()=>{
 for(const allin of [false,true]){const g=new Poker([2000,2000,2000,2000]);const i=(g.turn+1)%4;if(allin)g.pay(i,g.players[i].chips);g.depart(i);assert(g.players[i].fold);assert(g.players[i].departed);assert(!g.pending.has(i));for(let n=0;n<100&&!g.done;n++){if(g.pending.size)g.act(g.turn,'call');else g.advance()}assert(g.done);assert.equal(g.paid[i],0);assert.equal(g.players.reduce((sum,p)=>sum+p.chips,0),8000)}
});
test('departed uncalled chips remain forfeited instead of being returned',()=>{
 const g=new Poker([2000,2000,2000]);g.pay(0,2000);g.depart(0);while(!g.done){if(g.pending.size)g.act(g.turn,'call');else g.advance()}assert.equal(g.players[0].chips,0);assert.equal(g.paid[0],0);assert.equal(g.players.reduce((sum,p)=>sum+p.chips,0),6000)
});
test('poker room leave accepts a stale snapshot and immediately folds the departing seat',()=>{
 const r=createRoom('me',{mode:'poker',capacity:4,role:0},0);command(r,'other',{kind:'join',role:1},0);command(r,'other',{kind:'ready',ready:true},0);command(r,'me',{kind:'start'},0);command(r,'other',{kind:'leave',seq:-100},1);assert(r.game.players[1].fold);assert(r.game.done);assert.equal(r.seats[1].auth,null)
});
