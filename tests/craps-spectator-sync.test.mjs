import test from 'node:test';
import assert from 'node:assert/strict';
import {Craps3D,CATCH_UP_LAG_MS} from '../dist/craps-tavern.mjs';
import {RoomGame} from '../dist/room-game.mjs';
import {Rooms} from '../dist/multiplayer.mjs';
import {Craps} from '../dist/craps.mjs';

const stubScene=()=>{const poses=[];return{poses,scene:Object.assign(Object.create(Craps3D.prototype),{reduced:true,motionSeed:0,factory:{torchFlames:[]},pose:t=>poses.push(t),render(){},onImpact(){}})}};

test('a late spectator replays the whole throw instead of jumping into the middle',async()=>{
 const {poses,scene}=stubScene(),duration=4600,late=1500;
 const done=scene.throw([3,4],{seed:7,durationMs:duration,elapsedMs:late,catchUp:true});
 assert.equal(poses.at(-1),0,'starts from the hand, not mid-air');
 const play=scene.animation.duration;assert.equal(play,duration-late+CATCH_UP_LAG_MS);
 for(const f of [.25,.5,.9]){scene.animate(scene.animation.start+play*f);assert(Math.abs(poses.at(-1)-f)<1e-9)}
 scene.animate(scene.animation.start+play);assert.equal(poses.at(-1),1);assert.equal(scene.animation,null);await done;
});

test('catch-up speed is bounded, and a throw that is almost over goes straight to the landing',async()=>{
 const {scene}=stubScene();scene.throw([1,1],{seed:1,durationMs:4600,elapsedMs:3900,catchUp:true});
 assert.equal(scene.animation.duration,4600*.65,'never faster than 1/0.65x');
 const {poses,scene:s2}=stubScene();await s2.throw([6,6],{seed:2,durationMs:4600,elapsedMs:4300,catchUp:true});
 assert.equal(poses.at(-1),1);assert(!s2.animation);
 const {poses:p3,scene:s3}=stubScene();s3.throw([2,5],{seed:3,durationMs:6000,elapsedMs:1500});assert.equal(p3.at(-1),.25,'solo and default calls keep the old behaviour');
});

function crapsRoom({phase,started,now,id='roll-1'}){
 const table=JSON.parse(JSON.stringify(new Craps(1000)));
 return{mode:'craps',status:'playing',round:1,you:1,serverNow:now,deadline:0,host:false,seats:[{name:'Roller',bank:1000},{name:'Me',bank:1000}],
  game:{table,point:0,phase,roller:0,roll:{dice:[3,4],started,ends:started+4600,holdEnds:started+7600,id},others:[]}};
}
function spectator(){
 let resolveThrow;const calls=[];const ui={network:{},render(){calls.push(['render',ui.network.phase])},replayPending(){},
  scene:{animation:null,throw(dice,o){calls.push(['throw',o]);ui.scene.animation={};return new Promise(r=>resolveThrow=()=>{ui.scene.animation=null;r()})},showResult(){calls.push(['showResult'])},setGuests(){}}};
 const node={append(){},innerHTML:'',querySelector:()=>null};
 const view=Object.assign(Object.create(RoomGame.prototype),{round:1,avatarKey:undefined,controller:ui,q:s=>s==='[data-end-craps]'?null:node,rooms:{send:async()=>{}}});
 return{view,ui,calls,finish:()=>resolveThrow()};
}

test('the result is not shown while the spectator is still replaying the throw',async()=>{
 const prev=globalThis.document;globalThis.document={querySelector:()=>null};
 try{
  const t0=1_000_000,{view,ui,calls,finish}=spectator();view.avatarKey=undefined;
  view.apply(crapsRoom({phase:'rolling',started:t0,now:t0+1200}));
  const thrown=calls.find(c=>c[0]==='throw');assert(thrown);assert.equal(thrown[1].catchUp,true);assert(thrown[1].elapsedMs>=1100&&thrown[1].elapsedMs<=1300);
  view.apply(crapsRoom({phase:'landed',started:t0,now:t0+4700}));
  assert.equal(ui.network.phase,'rolling','landing arrived but local dice are still moving');assert(!calls.some(c=>c[0]==='showResult'));
  finish();await new Promise(r=>setTimeout(r,0));
  assert.equal(ui.network.phase,'landed');assert(calls.some(c=>c[0]==='showResult'));
 }finally{globalThis.document=prev}
});

test('other players poll faster only while a craps throw can start',()=>{
 const c=Object.create(Rooms.prototype);
 c.state={mode:'craps',status:'playing',you:1,game:{phase:'bets',roller:0}};assert.equal(c.pollDelay(),450);
 c.state.you=0;assert.equal(c.pollDelay(),900,'the roller gets the throw from its own request');
 c.state={mode:'craps',status:'playing',you:1,game:{phase:'result',roller:0}};assert.equal(c.pollDelay(),900);
 c.state={mode:'poker',status:'playing',you:1,game:{}};assert.equal(c.pollDelay(),900);
});
