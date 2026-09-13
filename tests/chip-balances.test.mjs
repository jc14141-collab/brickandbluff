import test from 'node:test';
import assert from 'node:assert/strict';
import {chipBalance} from '../server/chip-balances.mjs';
test('posted chips and risk reserves count once, then disappear from the total after settlement',()=>{
 for(const [mode,p,expected] of [
  ['poker',{chips:1750,total:250},2000],
  ['blackjack',{bank:1400,hands:[{bet:150},{bet:150}],riskReserve:300},2000],
  ['roulette',{bank:1700,bets:{n0:100,n8:200}},2000]
 ]){const r={mode,seats:[{bank:2000}],game:{players:[p],done:false}};assert.equal(chipBalance(r,0).totalChips,expected);r.game.done=true;assert.equal(chipBalance(r,0).totalChips,p.chips??p.bank)}
});
test('craps totals include travelling bets and waiting tables use their seat balance',()=>{
 const r={mode:'craps',seats:[{bank:2000}],game:{tables:[{bank:1825,bets:{pass:100},travel:{c6:75}}]}};
 assert.deepEqual(chipBalance(r,0),{available:1825,committed:175,totalChips:2000});
 r.game=null;assert.equal(chipBalance(r,0).totalChips,2000);
});
