import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SKILLS} from '../dist/skill-rules.mjs';
import * as engine from '../dist/engine.mjs';
import {Poker,BIG_BLIND} from '../dist/poker.mjs';
import {decide,PROFILES} from '../dist/strategy.mjs';
const nodes=new Map(),effects=[];
function node(key){if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},insertAdjacentHTML(){},showModal(){},close(){},getBoundingClientRect(){return{left:0,top:0,width:1485,height:1023}}});return nodes.get(key)}
class TableStub{constructor(){}destroy(){}sync(){}skillEffect(...args){effects.push(args)}async action(){}}
const context=vm.createContext({SKILLS,arrangeLobby(){},...engine,Poker,BIG_BLIND,decide,PROFILES,Table3D:TableStub,PokerTavern:TableStub,RoomDirectory:class{destroy(){}},ClubUI:class{constructor(){}},console,document:{querySelector:node,querySelectorAll(){return[]},body:node('body')},window:{matchMedia(){return{matches:false}},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},setTimeout(fn){return 1},clearTimeout(){},confirm(){return true},Math});
vm.runInContext(fs.readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),context);
vm.runInContext('renderLobby()',context);
assert.match(node('#app').innerHTML,/id="seatCount"/);
for(let count=4;count<=10;count++){
 vm.runInContext(`seatCount=${count};mode='poker';renderLobby();session();game=new Poker([2000,...tableSession.stacks]);Object.assign(game,{logs:[],reserve:0,startBank:2000});screen='game';mountGame();renderHud()`,context);
 assert.equal(vm.runInContext('tableSession.roster.length',context),count-1);
 assert.equal((node('#seatLabels').innerHTML.match(/data-seat-label=/g)||[]).length,count-1);
}
vm.runInContext("busy=false;role=0;skillsOn=true;game.turn=0",context);await vm.runInContext('skill()',context);assert.equal(effects.at(-1)[0],0);
vm.runInContext("game.used=false;role=1;game.picking=true",context);const replacement=vm.runInContext('game.deck.at(-1)',context);vm.runInContext('replaceCard(0)',context);assert.equal(effects.at(-1)[0],1);assert.deepEqual(vm.runInContext('game.players[0].cards[0]',context),replacement);
vm.runInContext("busy=false;game.used=false;role=3;game.picking=false",context);await vm.runInContext('skill()',context);assert.equal(effects.at(-1)[0],3);
vm.runInContext("mode='blackjack';role=2;bank=900;game={hand:[{r:10,s:'♠'},{r:9,s:'♥'},{r:5,s:'♦'}],dealer:[{r:10,s:'♣'},{r:8,s:'♦'}],naturalEligible:false,bet:100,startBank:1000,logs:[]};finishBJ()",context);assert.equal(effects.at(-1)[0],2);assert.equal(vm.runInContext('game.reward',context),50);
vm.runInContext("game={done:false,peek:2,players:[{}, {cards:[{r:7,s:'♠'}]}, {cards:[{r:12,s:'♥'},{r:14,s:'♠'}]}]}",context);
assert.equal(vm.runInContext('peekCardMarkup(game,1,true)',context),'');
const shown=vm.runInContext('peekCardMarkup(game,2,true)',context);assert.match(shown,/Q♥/);assert(!shown.includes('A♠'));
vm.runInContext('game.done=true',context);assert.equal(vm.runInContext('peekCardMarkup(game,2,true)',context),'');
assert.match(vm.runInContext("peekCardMarkup({done:false,peek:true,dealer:[{r:2,s:'♠'},{r:13,s:'♦'}]},2,false)",context),/K♦/);
console.log('Lobby, skill hooks and refund, target-only readable peek card, blackjack reveal and settlement cleanup: passed');
vm.runInContext("mode='craps';renderLobby()",context);
assert.match(node('#app').innerHTML,/入座，掷骰/);
assert.match(node('#app').innerHTML,/经典规则/);
assert(!node('#app').innerHTML.includes('undefined'));
let started=false,closed=false;
context.CrapsUI=class{constructor(host,options){started=true;options.onBank(1234);this.engine={escrow:0}}exit(){closed=true}destroy(){}};
await vm.runInContext('startGame()',context);assert(started);assert.equal(vm.runInContext('bank',context),1234);
vm.runInContext('exitGame()',context);assert(closed);
console.log('Craps lobby, launch, shared wallet and exit routing passed');
vm.runInContext("mode='guandan';renderLobby()",context);assert.match(node('#app').innerHTML,/GUANDAN/);assert.match(node('#app').innerHTML,/每人 27 张/);assert(!node('#app').innerHTML.includes('undefined'));
let guandanStarted=false,guandanExit=false;context.GuandanUI=class{constructor(){guandanStarted=true;this.game={done:false}}exit(){guandanExit=true}destroy(){}};const unchanged=vm.runInContext('bank',context);await vm.runInContext('startGame()',context);assert(guandanStarted);assert.equal(vm.runInContext('bank',context),unchanged);vm.runInContext('exitGame()',context);assert(guandanExit);
console.log('Guandan lobby, launch, unchanged wallet and exit routing passed');
const dealt=[],bets=[];context.setTimeout=fn=>{fn();return 1};context.Table3D=class extends TableStub{sync(v){dealt.push([v.hand.length,v.dealerCards.length])}async action(e){bets.push(e.kind)}};
vm.runInContext("mode='blackjack';renderLobby();bank=1000;stake=100;busy=false",context);await vm.runInContext('startGame()',context);assert.deepEqual(dealt.slice(0,5),[[0,0],[1,0],[1,1],[2,1],[2,2]]);assert.equal(bets.filter(k=>k==='bet').length,1);assert.equal(vm.runInContext('game.dealing',context),false);assert.equal(vm.runInContext('busy',context),false);
console.log('Blackjack sequential player/dealer dealing, single wager animation and turn release passed');

vm.runInContext("mode='roulette';renderLobby()",context);assert.match(node('#app').innerHTML,/AMERICAN ROULETTE/);assert.match(node('#app').innerHTML,/自由开始 · 抛球后 7 秒/);assert(!node('#app').innerHTML.includes('undefined'));

vm.runInContext("mode='poker';screen='game';busy=true;game=new Poker([100,100,100,100]);Object.assign(game,{logs:[],reserve:0,startBank:100});game.act(3,'fold');game.act(0,'allin');game.act(1,'fold');game.act(2,'call');renderHud()",context);
assert.equal(vm.runInContext('view().runout',context),true);
assert.equal(vm.runInContext('view().done',context),false);
assert.match(node('#streetTag').textContent,/全下摊牌/);
assert.match(node('#seatLabels').innerHTML,/data-seat-label="0"/);
assert.equal(node('#resultHud').innerHTML,'');
