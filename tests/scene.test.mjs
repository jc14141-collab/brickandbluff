import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.min.js';
import {Table3D} from '../dist/table3d.mjs';
import {Poker} from '../dist/poker.mjs';
import {Guandan3D} from '../dist/guandan3d.mjs';
const rect=o=>new T.Box3().setFromObject(o);
function makeTable(count,width=1485,height=1023){
 const t=Object.create(Table3D.prototype);Object.assign(t,{seatCount:count,mode:'poker',role:0,alive:true,reduced:false,elapsed:0,tweens:[],poseTweens:[],effects:[],rigs:[],materials:new Map(),textures:new Map(),cardObjects:new Map(),lastBoardCount:0,boxGeo:new T.BoxGeometry(1,1,1),scene:new T.Scene(),container:{clientWidth:width,clientHeight:height,querySelector(){return null}},renderer:{setSize(){},render(){}},clock:{getDelta(){return .05}}});
 t.faceTexture=()=>new T.Texture();t.camera=new T.PerspectiveCamera(49,width/height,.07,40);t.camera.position.set(0,4.65,6.65);t.camera.lookAt(0,1.3,-.35);t.baseQuaternion=t.camera.quaternion.clone();t.scene.add(t.camera);t.buildHands();t.chipPiles=new T.Group();t.scene.add(t.chipPiles);
 for(let i=1;i<count;i++){const r=t.avatar(i*98);r.seat=i;r.baseY=.98;r.group.position.copy(t.avatarPoint(i));r.group.scale.setScalar(count>4?Math.max(.62,.96-(count-4)*.055):1);t.rigs.push(r);t.scene.add(r.group)}t.resize();return t;
}
const projectRect=(o,camera)=>{o.updateWorldMatrix(true,true);let points=[];o.traverse(m=>{if(!m.geometry||!m.visible)return;const a=m.geometry.attributes.position;for(let n=0;n<a.count;n++)points.push(new T.Vector3().fromBufferAttribute(a,n).applyMatrix4(m.matrixWorld).project(camera))});return{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.max(...points.map(p=>p.y)),bottom:Math.min(...points.map(p=>p.y))}};
globalThis.requestAnimationFrame=()=>0;
let layouts=0;
for(let count=4;count<=10;count++)for(const [w,h]of [[1485,1023],[1920,1080],[390,844]]){
 const t=makeTable(count,w,h),g=new Poker(Array(count).fill(1000));g.board=g.deck.splice(0,5);
 const view={players:g.players,hand:g.players[0].cards,board:g.board,pot:30,bank:1000,done:false};t.sync(view,{animate:false});t.camera.updateMatrixWorld(true);
 assert.equal(t.cardObjects.size,count*2+5);
 const board=projectRect(t.cardObjects.get('board2').obj,t.camera),own=projectRect(t.cardObjects.get('own0').obj,t.camera);assert(own.top<board.bottom,'held cards cover public cards');
 view.done=true;view.showdown=true;view.winningCards=[...view.hand,...g.board.slice(0,3)];t.sync(view,{animate:false});
 for(let n=0;n<25;n++)t.frame();
 const cards=[...t.cardObjects.values()].filter(e=>e.obj.visible);
 for(const e of cards){const b=rect(e.obj);assert(Math.abs(b.min.y-1.334)<.003,'card does not rest on felt');}
 for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
  const a=rect(cards[i].obj),b=rect(cards[j].obj);assert(!(Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x)>.01&&Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z)>.01),'showdown card overlap '+count+' '+w+' '+i+' '+j+' '+JSON.stringify({a,b}));
 }
 assert.equal(cards.filter(e=>e.obj.userData.winner).length,5);for(const r of t.rigs){t.react(r.seat);t.animateRig(r,t.elapsed+.6,.05);assert(Number.isFinite(r.head.rotation.y))}
 layouts++;
}
const fx=makeTable(10);fx.view={done:false};fx.container.append=()=>{};
for(const[w,h]of [[1485,1023],[1024,768],[768,1024],[390,844]])for(const count of[2,5,8]){const bj=makeTable(2,w,h);bj.mode='blackjack';bj.foreground.visible=false;const hand=Array.from({length:count},(_,i)=>({r:2+i,s:'♠'})),dealerCards=Array.from({length:count},(_,i)=>({r:2+i,s:'♥'}));bj.sync({hand,dealerCards,reveal:false,done:false,bank:1000,pot:100},{animate:false});bj.camera.updateMatrixWorld(true);const own=projectRect(bj.cardObjects.get('own0').obj,bj.camera),dealer=projectRect(bj.cardObjects.get('dealer0').obj,bj.camera);assert(own.top<dealer.bottom,'blackjack own cards cover dealer');assert.equal(bj.cardObjects.get('dealer1').sig,'back');const oldMap=bj.cardObjects.get('dealer1').obj.userData.face.material.map;bj.sync({hand,dealerCards,reveal:true,done:false,bank:1000,pot:100});assert.equal(bj.cardObjects.get('dealer1').obj.userData.face.material.map,oldMap,'hole card revealed before flip midpoint');for(let n=0;n<18;n++)bj.frame();assert.notEqual(bj.cardObjects.get('dealer1').obj.userData.face.material.map,oldMap);assert.equal(bj.flips.length,0)}
for(const [w,h]of [[1366,1024],[1024,768],[768,1024]]){const gd=makeTable(4,w,h);Object.setPrototypeOf(gd,Guandan3D.prototype);gd.foreground.visible=false;const m={tier:10,cards:Array.from({length:10},(_,i)=>({r:9,s:'♠',id:i}))};gd.showMove(m,1);for(let n=0;n<22;n++)gd.frame();assert.equal(gd.gdCards.children.length,10);for(const o of gd.gdCards.children)assert(Math.abs(rect(o).min.y-1.334)<.003);const projected=projectRect(gd.gdCards,gd.camera);assert(projected.left>=-1&&projected.right<=1,'played cards clipped');assert((1-projected.bottom)/2*h<h-308,'3D played cards overlap hand panel');gd.showMove(null,-1);assert.equal(gd.gdCards,null);assert.equal(gd.tweens.length,0)}
globalThis.document={createElement(){return{remove(){}}}};globalThis.setTimeout=()=>0;
for(let role=0;role<4;role++)fx.skillEffect(role,role===0||role===3?9:0);
assert.equal(fx.effects.length,4);fx.animateEffects(1);assert(fx.effects.every(e=>e.group.children.length>=13));fx.animateEffects(3);assert.equal(fx.effects.length,0);
console.log(JSON.stringify({layouts,result:'passed',checks:'live card separation, 4–10-player showdown overlap, card contact, gold winner markers, animation transforms, four effects and cleanup'}));
