import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Guandan3D} from '../dist/guandan3d.mjs';
import {GuandanUI} from '../dist/guandan-ui.mjs';
import {GuandanMatch} from '../dist/guandan.mjs';
test('turn pointer follows every relative seat and hides at settlement',()=>{
 const t=Object.assign(Object.create(Guandan3D.prototype),{scene:new T.Scene(),seatCount:4,reduced:true});
 for(let i=0;i<4;i++){t.showTurn(i);const p=t.seatPoint(i),forward=new T.Vector3(0,0,1).applyAxisAngle(new T.Vector3(0,1,0),t.turnPointer.rotation.y);assert.ok(forward.dot(new T.Vector3(p.x,0,p.z).normalize())>.999);assert.equal(t.turnPointer.visible,true)}
 t.showTurn(0,true);assert.equal(t.turnPointer.visible,false);assert.equal(t.scene.children.length,1);
});
test('27 cards render once in a single row and only the current winning play appears',()=>{
 const nodes=new Map(),q=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',scrollLeft:37});return nodes.get(k)};
 const match=new GuandanMatch(),game=match.start();game.turn=0;
 const ui=Object.assign(Object.create(GuandanUI.prototype),{alive:true,game,match,selected:new Set(),q,host:{querySelectorAll:()=>[]},message:'选牌',names:['你','左家','队友','右家']});
 game.actions=[{seat:1,pass:true},{seat:2,pass:false,move:'对子 A',cards:[{r:14,s:'♠'},{r:14,s:'♥'}]}];game.target=game.legal(0).find(m=>m.type==='pair')??game.legal(0)[0];game.owner=2;ui.render();
 const hand=q('.gd-hand-area').innerHTML;assert.equal((hand.match(/class="gd-hand-row"/g)||[]).length,1);assert.equal((hand.match(/data-gcard=/g)||[]).length,27);assert.equal(q('.gd-hand-scroll').scrollLeft,37);
 const feed=q('.gd-seat-plays').innerHTML;assert.ok(feed.includes('当前最大'));assert.ok(feed.includes('队友'));assert.ok(feed.includes('牌局记录'));assert.ok(feed.includes('左家'));assert.ok(feed.includes('不出'));assert.equal((feed.match(/class="gd-feed-entry /g)||[]).length,1);game.actions.push({seat:3,pass:true});ui.renderPlays();assert.equal((q('.gd-seat-plays').innerHTML.match(/class="gd-feed-card /g)||[]).length,game.target.cards.length);game.target=null;game.owner=-1;game.trick++;ui.renderPlays();assert.ok(q('.gd-seat-plays').innerHTML.includes('等待领出新一轮'));assert.ok(!feed.includes('gd-seat-play '));
});
