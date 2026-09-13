import test from 'node:test';
import assert from 'node:assert/strict';
import {newBlackjack,blackjackTick} from '../dist/blackjack.mjs';
test('blackjack continues when an unbet seat leaves',()=>{const g=newBlackjack([0,1000],Math.random,0);g.players[0].departed=true;for(let now=1000;now<200000&&!g.done;now+=5000)blackjackTick(g,[true,true],now);assert.equal(g.done,true);assert.equal(g.players[0].bet,0)});
