import test from 'node:test';import assert from 'node:assert/strict';import {chipStacks} from '../dist/poker-chips.mjs';import {beginPokerProfit,recordPokerProfit,pokerProfitView} from '../server/poker-table-profits.mjs';import {pack,unpack} from '../server/rooms.mjs';
test('physical chip denominations sum exactly to balance, including small remainders',()=>{for(const amount of [0,1,20,99,1225,2840,6450,100000,999999999,1000000000]){const rows=chipStacks(amount);assert.equal(rows.reduce((n,r)=>n+r.value*r.count,0),amount);assert(rows.reduce((n,r)=>n+r.count,0)<=100)}});
test('table profit includes bots, persists, avoids double settlement and excludes refills',()=>{let r={mode:'poker',round:1,status:'playing',seats:[{id:'a',name:'甲',bank:2000},{id:'b',name:'电脑',bank:2000,bot:true}]};beginPokerProfit(r);recordPokerProfit(r,r.seats[0],2500);recordPokerProfit(r,r.seats[1],1500);recordPokerProfit(r,r.seats[0],2500);assert.equal(r.pokerProfits.a.net,500);assert.equal(r.pokerProfits.b.net,-500);r=unpack(pack(r));r.round++;r.seats[0].bank=4500;r.seats[1].bank=1500;beginPokerProfit(r);recordPokerProfit(r,r.seats[0],4300);recordPokerProfit(r,r.seats[1],1700);assert.equal(r.pokerProfits.a.net,300);assert.equal(r.pokerProfits.b.net,-300);assert.equal(r.pokerProfits.a.rounds,2)});
test('pending bets are separate; departed player retains realized ranking',()=>{const r={mode:'poker',round:1,status:'playing',seats:[{id:'a',name:'甲',bank:2000}],game:{done:false,players:[{total:120}]}};beginPokerProfit(r);let v=pokerProfitView(r);assert.equal(v.rows[0].net,0);assert.equal(v.rows[0].pending,120);recordPokerProfit(r,r.seats[0],1880);r.seats[0].departed=true;v=pokerProfitView(r);assert.equal(v.rows[0].net,-120);assert.equal(v.rows[0].departed,true)});

test('pot chips fit inside the bowl and rest above its floor at both screen sizes',async()=>{const {chipSlots,potLayout}=await import('../dist/poker-chips.mjs');const slots=chipSlots(Array.from({length:12},(_,i)=>({value:i+1,count:9})),true);for(const narrow of [false,true]){const layout=potLayout(narrow),floorTop=1.34+.045*layout.scale,chipBottom=1.34+.045*layout.scale+.004;assert(chipBottom>floorTop);for(const slot of slots)for(const dx of[-.095,.095])for(const dz of[-.095,.095])assert(Math.hypot((slot.x+dx)*layout.chipScale,(slot.z+dz)*layout.chipScale)<.425*layout.scale,'chip penetrates inner bowl edge');for(let seat=0;seat<10;seat++)for(let i=0;i<10;i++)assert(Math.abs((i%3-1)*.11*layout.chipScale/.55)+Math.SQRT2*.095*layout.chipScale<.425*layout.scale,'animated chip outside bowl')}});


test('balanced banks use blind-scaled values, bounded heights and stable varied mixes',async()=>{
 const {balancedChipStacks,tableChipValues}=await import('../dist/poker-chips.mjs');
 assert.deepEqual(tableChipValues(1000).slice(0,5),[50,250,1250,5000,25000]);
 const banks=[];
 for(let seed=1;seed<=12;seed++){
  const rows=balancedChipStacks(100000,{bigBlind:1000,seed});banks.push(rows);
  assert.deepEqual(rows,balancedChipStacks(100000,{bigBlind:1000,seed}));
  assert.equal(rows.reduce((n,r)=>n+r.count*r.value,0),100000);
  const count=rows.reduce((n,r)=>n+r.count,0);assert(count>=26&&count<=32);
 }
 assert(new Set(banks.map(JSON.stringify)).size>1,'identical stacks for all players');
 for(const bigBlind of [20,100,1000])for(const amount of [1,20,2000,99500,100000,201500,162286,999999999,1000000000])for(let seed=0;seed<30;seed++)for(const pot of [false,true]){
  const rows=balancedChipStacks(amount,{bigBlind,seed,pot});assert(rows.every(r=>r.count<=6));assert(rows.length<=12);
  assert(rows.reduce((n,r)=>n+r.count,0)<=40);
  const rendered=rows.reduce((n,r)=>n+r.count*r.value,0),smallest=tableChipValues(bigBlind).find(v=>v>=amount/5000);
  assert(Math.abs(rendered-amount)<=smallest,'display approximation excessive');
 }
 const counts=[99000,99500,100000].map(amount=>balancedChipStacks(amount,{bigBlind:1000,seed:12}).reduce((n,r)=>n+r.count,0));
 assert(Math.max(...counts)-Math.min(...counts)<=6,'remainders distort visible bank size');
});


test('table profit ranking shows full names, including departed players',()=>{
 const r={mode:'poker',round:1,status:'roundEnd',seats:[{id:'a',name:'我的完整昵称',bank:2000},{id:'b',name:'朋友完整昵称',bank:2000}],pokerProfits:{a:{id:'a',name:'我的完整昵称',net:200},b:{id:'b',name:'朋友完整昵称',net:0},c:{id:'c',name:'离桌玩家姓名',net:-200}}};
 const view=pokerProfitView(r);
 for(const row of view.rows)assert.equal(row.name,r.pokerProfits[row.id].name);
 assert(view.rows.find(p=>p.id==='c').departed);
});
