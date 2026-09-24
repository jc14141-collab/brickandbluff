import test from 'node:test';
import assert from 'node:assert/strict';
import {Craps} from '../dist/craps.mjs';
import {replayWagers} from '../dist/craps-wager-queue.mjs';
import {createRoom,command} from '../server/rooms.mjs';
import {newRoulette,rouletteAct} from '../dist/roulette.mjs';
test('custom craps stakes stay exact, shortcuts retain denomination rounding',()=>{const g=new Craps(1000);g.add('p6',10);assert.equal(g.bets.p6,12);const h=replayWagers(g,[{action:'bet',key:'p6',amount:37,exact:true}]);assert.equal(h.bets.p6,49);assert.equal(g.bets.p6,12);const t=new Craps(100);t.add('p6',1,true);t.point=6;t.rolling=true;const r=t.settle([3,3]);assert.equal(r.net,1);for(const n of [0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1,1000])assert.throws(()=>t.add('field',n,true))});
test('multiplayer craps batches preserve arbitrary amounts and validate funds',()=>{const r=createRoom('a',{mode:'craps',capacity:2,name:'A',role:0},0);command(r,'b',{kind:'join',name:'B',role:0},0);command(r,'b',{kind:'ready',ready:true},0);command(r,'a',{kind:'start'},0);command(r,'a',{kind:'act',action:'betBatch',bets:[{action:'bet',key:'pass',amount:37,exact:true},{action:'bet',key:'p6',amount:13,exact:true}]},1);assert.equal(r.game.tables[0].bets.pass,37);assert.equal(r.game.tables[0].bets.p6,13);assert.equal(r.game.tables[1].bets.pass,0);assert.throws(()=>command(r,'a',{kind:'act',action:'bet',key:'field',amount:1e6,exact:true},2))});
test('roulette accepts custom stakes and rejects invalid or unaffordable amounts',()=>{const g=newRoulette([100],0);rouletteAct(g,0,'bet','red',37,1);assert.equal(g.players[0].bets.red,37);assert.equal(g.players[0].bank,63);for(const n of [0,-1,1.5,64,Infinity])assert.throws(()=>rouletteAct(g,0,'bet','red',n,2))});
