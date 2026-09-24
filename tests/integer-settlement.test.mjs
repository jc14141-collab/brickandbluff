import test from 'node:test';import assert from 'node:assert/strict';
import {roundChips} from '../dist/chips.mjs';
import {newBlackjack,blackjackTick} from '../dist/blackjack.mjs';
import {Craps} from '../dist/craps.mjs';
import {cents} from '../dist/skill-rules.mjs';
test('chip rounding is symmetric for wins and losses',()=>{for(const [n,want] of [[1.49,1],[1.5,2],[-1.5,-2],[2.5,3],[-2.5,-3],[0,0]])assert.equal(roundChips(n),want);assert.equal(cents(15*.1),2)});
test('odd blackjack stakes round net payout before updating bank',()=>{const card=r=>({r,s:0});for(const [bounty,cards,delta] of [[false,[14,13],8],[true,[14,13],13],[true,[10,10],8],[true,[10,7],-8],[true,[10,10,5],-10]]){const g=newBlackjack([100]);const p=g.players[0];p.bounty=bounty;p.bank=100-5*(bounty?2:1);p.riskReserve=bounty?5:0;p.hands=[{cards:cards.map(card),bet:5,done:true}];g.dealer=[card(10),card(8)];g.phase='dealer';g.nextAt=0;blackjackTick(g,[false],1);assert.equal(p.delta,delta);assert.equal(p.bank,100+delta);assert.equal(p.hands[0].delta,delta)}});
test('all craps contracts settle to whole chips with exact odd stakes',()=>{for(const key of Object.keys(new Craps(0).bets))for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){const g=new Craps(1000);g.point=5;g.bets.pass=5;g.bets.dont=5;for(const n of [4,5,6,8,9,10]){g.travel['c'+n]=5;g.travel['d'+n]=5}g.bets[key]=7;g.rolling=true;const r=g.settle([a,b]);assert(Number.isInteger(g.bank),key);assert(Number.isInteger(r.net),key);for(const e of r.events)assert(Number.isInteger(e.profit),key)}});
