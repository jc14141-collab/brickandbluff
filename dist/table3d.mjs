import {refineRanger,updateRangerFace} from './ranger-model.mjs';
import {refineGuardian,updateGuardianFace} from './guardian-model.mjs';
import {refineEngineer,updateEngineerFace} from './engineer-model.mjs';
import {updateWitchFace} from './witch-face.mjs';
import {refineWitch,fitWitchSeat} from './witch-model.mjs';
import {drawCardFace} from './card-art.mjs';
import {tweenSound} from './sound-fx.mjs';
import {renderPixelRatio} from './voxel-art.mjs';
import {grainTexture} from './voxel-art.mjs';
import * as T from './vendor/three.module.min.js';
const COLORS=[0x7440ad,0xd68a2d,0xd3e4e4,0x3f7446];
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export class Table3D{
 constructor(container,{role=0,roster=[],mode='poker',reduced=false,onCard=()=>{},onSound=()=>{}}={}){
  this.seatCount=mode==='poker'?roster.length+1:2;this.effects=[];this.lastBoardCount=0;this.container=container;this.role=role;this.mode=mode;this.reduced=reduced;this.onCard=onCard;this.onSound=onSound;this.tweens=[];this.poseTweens=[];this.showdownBlend=0;this.cardObjects=new Map();this.materials=new Map();this.textures=new Map();this.rigs=[];this.elapsed=0;this.alive=true;this.motion={x:0,y:0};this.pickable=[];
  this.scene=new T.Scene();this.scene.background=new T.Color(0x101713);this.scene.fog=new T.Fog(0x101713,11,26);
  this.camera=new T.PerspectiveCamera(57,1,.07,40);this.camera.position.set(0,4.65,6.65);this.camera.lookAt(0,1.3,-.35);this.baseQuaternion=this.camera.quaternion.clone();this.scene.add(this.camera);
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(renderPixelRatio(window.devicePixelRatio||1,container.clientWidth||1280,container.clientHeight||720));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.domElement.setAttribute('aria-label','第一人称 3D 积木牌桌');this.renderer.domElement.style.imageRendering='auto';container.prepend(this.renderer.domElement);
  this.scene.add(new T.HemisphereLight(0xd7e9cb,0x1b241c,1.25));let key=new T.DirectionalLight(0xffefda,2.5);key.position.set(-3,9,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:25});key.shadow.bias=-.00015;key.shadow.normalBias=.012;key.shadow.radius=3;this.scene.add(key);let rim=new T.PointLight(0x62d9c0,45,14);rim.position.set(4,5,-4);this.scene.add(rim);let warm=new T.PointLight(0xd79a61,40,14);warm.position.set(-5,4,-1);this.scene.add(warm);
  this.boxGeo=new T.BoxGeometry(1,1,1);this.buildRoom();this.buildTable();this.batchBoxes(this.scene);this.buildHands();if(mode==='blackjack')this.foreground.visible=false;
  const spots=mode==='poker'?Array.from({length:this.seatCount-1},(_,n)=>this.avatarPoint(n+1).toArray()):[[0,.98,-4.5]];
  spots.forEach((pos,n)=>{let i=mode==='poker'?n+1:2,rig=this.avatar(roster[n]?.seed??100+n,roster[n]?.role);rig.group.position.set(...pos);rig.group.scale.setScalar(this.seatCount>4?Math.max(.62,.96-(this.seatCount-4)*.055):1);rig.group.rotation.y=Math.atan2(-pos[0],1.2-pos[2]);this.scene.add(rig.group);rig.seat=i;rig.baseY=pos[1];rig.rest=rig.group.rotation.y;fitWitchSeat(rig);this.rigs.push(rig)});
  this.chipPiles=new T.Group();this.scene.add(this.chipPiles);this.ray=new T.Raycaster();this.pointer=new T.Vector2();
  this.move=e=>{let r=container.getBoundingClientRect();this.motion.x=(e.clientX-r.left)/r.width-.5;this.motion.y=(e.clientY-r.top)/r.height-.5};this.leave=()=>{this.motion.x=0;this.motion.y=0};this.click=e=>{let r=container.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);let hit=this.ray.intersectObjects(this.pickable,true)[0];if(hit){let o=hit.object;while(o&&!Number.isInteger(o.userData.index))o=o.parent;if(o)this.onCard(o.userData.index)}};
  this.renderer.domElement.addEventListener('click',this.click);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();this.clock=new T.Clock();this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);
 }
 batchBoxes(root){root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.geometry===this.boxGeo){if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(o)}});const inverse=new T.Matrix4().copy(root.matrixWorld).invert();for(const[material,items]of groups){if(items.length<3)continue;const mesh=new T.InstancedMesh(this.boxGeo,material,items.length);mesh.castShadow=true;mesh.receiveShadow=true;items.forEach((o,i)=>{mesh.setMatrixAt(i,new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));o.removeFromParent()});mesh.instanceMatrix.needsUpdate=true;root.add(mesh)}}
 mat(color,metal=0){const k=color+':'+metal;if(!this.materials.has(k))this.materials.set(k,new T.MeshStandardMaterial({color,roughness:.62,metalness:metal,flatShading:true}));return this.materials.get(k)}
 box(parent,w,h,d,x,y,z,color){let m=new T.Mesh(this.boxGeo,this.mat(color));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 stud(parent,x,y,z,color,r=.07){const m=new T.Mesh(new T.CylinderGeometry(r,r,.04,8),this.mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
 buildRoom(){const s=this.scene;this.box(s,25,.1,25,0,-.4,0,0x131914);
  this.box(s,18,7,.6,0,2.9,-7,0x1c2b20);for(let x=-8;x<=8;x+=.8){this.box(s,.1,4,.18,x,2.3,-6.6,0x344335);this.box(s,.28,.18,.3,x,4.4,-6.4,0x7e794e)}
  for(let x of [-5.5,5.5]){this.box(s,1.4,4.8,.4,x,2,-6.35,0x253e32);for(let y=.1;y<4.1;y+=.38)this.box(s,1.12,.15,.13,x,y,-6.05,0x607856)}
  let sign=this.textTexture('BRICK & BLUFF','#d1ed91','#203329',768,128);let panel=new T.Mesh(new T.PlaneGeometry(5.3,.9),new T.MeshBasicMaterial({map:sign}));panel.position.set(0,3.7,-6.61);s.add(panel);this.box(s,5.5,.06,.3,0,3.15,-6.5,0xb2c478);
  for(let x of [-3,0,3]){this.box(s,.025,1.4,.025,x,5.7,-1.8,0x8f865b);this.box(s,1.4,.18,.75,x,4.95,-1.8,0x3d5140);let bulb=this.box(s,1.2,.04,.6,x,4.83,-1.8,0xeee1aa);bulb.material=new T.MeshBasicMaterial({color:0xffe5b4})}
 }
 feltTexture(){const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d"),r=seeded(83);x.fillStyle="#808080";x.fillRect(0,0,256,256);for(let y=0;y<256;y++)for(let n=0;n<256;n++){const v=110+Math.floor(r()*36);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(n,y,1,1);}const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(22,22);tex.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.set("felt",tex);return tex;}
 buildTable(){const g=new T.Group();this.tableSurface=g;g.scale.set(1.25,1,1.4);this.scene.add(g);let outer=new T.Mesh(new T.CylinderGeometry(1,1,.24,12),this.mat(0x4b543b));outer.scale.set(4.65,1,3.4);outer.position.y=1.16;outer.receiveShadow=true;outer.castShadow=true;g.add(outer);let felt=new T.Mesh(new T.CylinderGeometry(1,1,.06,12),this.mat(0x305444));felt.scale.set(4.31,1,3.07);felt.position.y=1.3;felt.material=new T.MeshStandardMaterial({color:0x245443,roughness:.96,bumpMap:this.feltTexture(),bumpScale:.012});felt.receiveShadow=true;g.add(felt);let trim=new T.Mesh(new T.CylinderGeometry(1,1,.04,12),this.mat(0xaca36e,.35));trim.scale.set(4.43,1,3.17);trim.position.y=1.267;g.add(trim);for(let i=0;i<44;i++){let a=i/44*Math.PI*2;this.stud(g,4.48*Math.sin(a),1.315,3.2*Math.cos(a),0x65714e,.085)}
  for(const x of [-2.7,2.7])this.box(g,.42,1.6,.42,x,.3,0,0x253426);
  const logo=new T.Mesh(new T.PlaneGeometry(2.2,.32),new T.MeshBasicMaterial({map:this.textTexture('THE BRICK CLUB','#75917a','#305444',512,96),transparent:true}));logo.rotation.x=-Math.PI/2;logo.position.set(0,1.335,1.05);g.add(logo);
  this.deckCards=[];this.deckAnchor=new T.Vector3(-1.625,1.52,-2.17);for(let i=0;i<9;i++){let c=this.makeCard(null,.43,.62);c.rotation.x=-Math.PI/2;c.position.set(-1.3,1.34+i*.018,-1.55);g.add(c);this.deckCards.push(c)}
 }
 textTexture(text,fg,bg,w=256,h=96){let c=document.createElement('canvas');c.width=w;c.height=h;let x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.font='bold '+Math.floor(h*.5)+'px monospace';x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2);let t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.set('text'+this.textures.size,t);return t}
 legacyFaceTexture(c,readable=false){const k=(c?c.r+c.s:'back')+(readable?'-phone-board':'');if(this.textures.has(k))return this.textures.get(k);let v=document.createElement('canvas');v.width=512;v.height=768;let x=v.getContext('2d');x.scale(2,2);x.fillStyle=c?'#faf9f2':'#203d36';x.fillRect(0,0,256,384);x.strokeStyle=c?'#c4c7bb':'#bfce83';x.lineWidth=2;x.strokeRect(9,9,238,366);if(c){let rank=({11:'J',12:'Q',13:'K',14:'A'})[c.r]||c.r;x.fillStyle=['♥','♦'].includes(c.s)?(readable?'#941b19':'#b64034'):(readable?'#070d0a':'#182a25');x.strokeStyle=x.fillStyle;x.lineWidth=readable?1.5:0;const ink=(text,a,b)=>{if(readable)x.strokeText(text,a,b);x.fillText(text,a,b)};x.textAlign='left';x.font=readable?'900 96px monospace':'bold 86px monospace';ink(rank,20,readable?100:94);x.textAlign='center';x.font=readable?'bold 152px serif':'144px serif';ink(c.s,135,287);x.save();x.translate(256,384);x.rotate(Math.PI);x.textAlign='left';x.font='bold 55px monospace';ink(rank,21,65);x.restore()}else{for(let yy=32;yy<350;yy+=25)for(let xx=30;xx<230;xx+=25){x.fillStyle=(xx+yy)%2?'#567254':'#72905d';x.fillRect(xx,yy,12,12)}x.fillStyle='#1e3930';x.fillRect(48,139,160,108);x.strokeStyle='#b8d28a';x.strokeRect(48,139,160,108);x.fillStyle='#d0e3a1';x.font='bold 45px monospace';x.textAlign='center';x.fillText('B&B',128,209)}let t=new T.CanvasTexture(v);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.set(k,t);return t}
 faceTexture(c,readable=false){if(this.mode!=='poker')return this.legacyFaceTexture(c,readable);const k=(c?c.r+c.s:'back')+(readable==='board'?'-board-index':readable?'-phone-board':'');if(this.textures.has(k))return this.textures.get(k);const v=drawCardFace(document.createElement('canvas'),c,readable),t=new T.CanvasTexture(v);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.set(k,t);return t}
 makeCard(c,w=.58,h=.82){let g=new T.Group();const shell=this.box(g,w,h,.018,0,0,0,0xe5e5ce);shell.castShadow=true;if(!this.textures.has('paper-edge'))this.textures.set('paper-edge',grainTexture('paper'));const paperKey='paper-edge-material';if(!this.materials.has(paperKey))this.materials.set(paperKey,new T.MeshStandardMaterial({color:this.mode==='poker'?0xd7b36a:0xf0ead8,map:this.textures.get('paper-edge'),roughness:this.mode==='poker'?.72:.94,metalness:this.mode==='poker'?.18:0}));shell.material=this.materials.get(paperKey);let face=new T.Mesh(new T.PlaneGeometry(w*.98,h*.98),new T.MeshStandardMaterial({map:this.faceTexture(c),roughness:.84,metalness:0,side:T.FrontSide}));face.position.z=.010;face.receiveShadow=true;g.add(face);g.userData.face=face;return g}
 avatar(seed,avatarRole=null){let rand=seeded(seed),g=new T.Group(),skin=[0xdbaa70,0xe0b681,0xb77e55,0x805340][Math.floor(rand()*4)],coat=[0x51765c,0x8c4d56,0x496682,0x7863a1,0xb27742][Math.floor(rand()*5)],hair=[0x372e29,0x84623e,0xc7a267,0x303a3d][Math.floor(rand()*4)],variant=Math.floor(rand()*5);if(Number.isInteger(avatarRole)&&avatarRole>=0&&avatarRole<4){coat=COLORS[avatarRole];skin=[0xe2bd7e,0x805340,0xcce2dc,0xe2bd7e][avatarRole];hair=[0x7856a1,0x49342a,0xd3e4e4,0x304b2d][avatarRole];variant=[0,1,2,3][avatarRole];}
  // Upholstered brick chair: the back and armrests frame a seated body.
  const chair=new T.Group();g.add(chair);
  this.box(chair,1.46,.17,1.22,0,-.08,-.08,0x262f29);
  this.box(chair,1.22,.13,1.03,0,.025,-.05,0x586b51);
  this.box(chair,1.43,1.42,.18,0,.62,-.63,0x293c32);
  this.box(chair,1.16,1.12,.12,0,.69,-.51,0x657854);
  this.box(chair,1.5,.12,.26,0,1.35,-.63,0xb5a875);
  for(const side of [-1,1]){
   this.box(chair,.12,1.08,.13,side*.61,-.6,-.48,0x29382f);
   this.box(chair,.12,1.08,.13,side*.61,-.6,.44,0x29382f);
   this.box(chair,.12,.46,.12,side*.72,.22,.26,0x334638);
   this.box(chair,.23,.12,.97,side*.72,.46,-.02,0x899268);
   this.stud(chair,side*.72,.54,.31,0xc2b67c,.06);
   // Horizontal thighs, bent knees, vertical shins and forward feet.
   this.box(g,.36,.3,.66,side*.25,.04,.32,0x283633);
   this.box(g,.36,.51,.32,side*.25,-.32,.58,0x283633);
   this.box(g,.39,.18,.55,side*.25,-.65,.72,0x172621);
  }
  this.batchBoxes(chair);
  this.box(g,1.03,.77,.61,0,.45,-.04,coat);
  this.box(g,.82,.12,.65,0,.07,0,0x26312e);
  this.box(g,.2,.1,.08,0,.48,.3,0xd5b563);
  let head=new T.Group();head.position.y=1.16;g.add(head);this.box(head,.78,.73,.69,0,0,0,skin);this.box(head,.14,.14,.11,-.18,.02,.36,0x161c19);this.box(head,.14,.14,.11,.18,.02,.36,0x161c19);this.box(head,.045,.045,.03,-.16,.05,.425,0xf1eddc);this.box(head,.045,.045,.03,.2,.05,.425,0xf1eddc);const mouth=this.box(head,.2,.045,.04,0,-.2,.44,0x704b3a);
  const brows=[-1,1].map(side=>this.box(head,.2,.04,.035,side*.18,.17,.445,hair));
  const lids=[-1,1].map(side=>{const lid=this.box(head,.17,.15,.025,side*.18,.02,.46,skin);lid.visible=false;return lid});
  if(variant===0){this.box(head,.95,.1,.85,0,.38,0,hair);this.box(head,.7,.28,.61,0,.55,0,coat);this.box(head,.72,.07,.63,0,.43,0,0xb8b079)}
  if(variant===1){this.box(head,.88,.2,.75,0,.43,-.05,hair);for(let n=0;n<5;n++)this.box(head,.14,.18,.17,-.34+n*.16,.27,.31,hair);this.box(head,.24,.13,.06,-.2,.04,.43,0x25484b);this.box(head,.24,.13,.06,.2,.04,.43,0x25484b);this.box(head,.18,.03,.05,0,.05,.43,0xb3ab79)}
  if(variant===2){this.box(head,.89,.15,.75,0,.43,0,0x526b67);this.box(head,.13,.75,.75,-.43,.05,0,coat);this.box(head,.13,.75,.75,.43,.05,0,coat);this.box(head,.58,.23,.08,0,-.23,.43,0x526b67);this.box(head,.14,.06,.03,0,-.22,.49,0x99ceba)}
  if(variant===3){for(let n=0;n<3;n++)this.box(head,.82-n*.1,.14,.74-n*.09,0,.4+n*.13,-.04,hair);this.box(head,.2,.18,.3,.32,.27,0,hair)}
  if(variant===4){this.box(head,.85,.45,.8,0,.38,-.08,coat);this.box(head,.13,.62,.76,-.41,.07,-.06,coat);this.box(head,.13,.62,.76,.41,.07,-.06,coat);this.box(head,.5,.08,.1,0,.45,.36,0xbc9d57)}
  let arms=[];for(let side of [-1,1]){
   let arm=new T.Group();arm.position.set(side*.64,.73,.02);
   this.box(arm,.3,.38,.34,0,-.15,0,coat);
   this.box(arm,.3,.24,.52,0,-.31,.22,coat);
   this.box(arm,.31,.25,.12,0,-.31,.48,0x2b3a30);
   this.box(arm,.29,.19,.3,0,-.31,.67,skin);
   for(let f=0;f<3;f++)this.box(arm,.065,.075,.17,-.085+f*.085,-.25,.77,skin);
   this.stud(arm,0,.06,0,coat);arm.rotation.z=side*.035;g.add(arm);arms.push(arm);
  }const rig={group:g,head,arms,mouth,brows,lids,phase:rand()*8,gesture:0,nextBlink:1+rand()*4,nextIdle:2+rand()*5,reactionAt:-10,reaction:0,reactionDuration:1.5};return avatarRole===0?refineWitch(this,rig):avatarRole===1?refineEngineer(this,rig):avatarRole===2?refineGuardian(this,rig):avatarRole===3?refineRanger(this,rig):rig;
 }
 buildHands(){this.hands=[];this.foreground=new T.Group();this.camera.add(this.foreground);this.held=new T.Group();this.foreground.add(this.held);for(let side of [-1,1]){let g=new T.Group(),color=COLORS[this.role];g.position.set(side*.61,-.66,-1.28);g.rotation.z=side*-.17;g.rotation.x=-.25;this.box(g,.32,.52,.33,0,-.19,0,color);this.box(g,.35,.14,.36,0,.07,.01,this.role===0?0xc5a358:this.role===2?0x56b1c5:0x2c3e32);const skin=this.role===2?0xcce2dc:this.role===1?0x454537:0xe2bd7e;this.box(g,.3,.26,.28,0,.24,.01,skin);for(let i=0;i<3;i++)this.box(g,.079,.1,.24,-.1+i*.1,.39,.01,skin);this.box(g,.1,.15,.2,side*-.18,.23,.04,skin);for(let i=0;i<2;i++)this.stud(g,-.08+i*.16,.0,.185,color,.04);if(this.role===0){this.box(g,.12,.13,.07,0,.11,.2,0xa28dcd);this.box(g,.06,.06,.08,0,.12,.245,0xe4c977)}if(this.role===1){this.box(g,.2,.17,.1,0,-.05,.2,0x373d32);this.box(g,.13,.1,.04,0,-.05,.27,0xc5dd96)}if(this.role===2){this.box(g,.23,.18,.06,0,-.12,.19,0x406b7c);this.box(g,.12,.04,.03,0,-.1,.23,0x9bddda)}if(this.role===3){for(let n=0;n<2;n++)this.box(g,.34,.045,.35,0,-.16+n*.16,0,0x8a673e)}this.foreground.add(g);this.hands.push(g)}
 }
 chip(parent,x,y,z,color=0xc6aa5e){let g=new T.Group();g.userData.sound='chips';this.box(g,.19,.055,.19,0,0,0,color);for(let side of [-1,1])this.box(g,.055,.058,.03,0,0,side*.083,0xe5deba);g.position.set(x,y,z);parent.add(g);return g}
 avatarPoint(i){if(this.seatCount<=4)return [new T.Vector3(0,.98,4.5),new T.Vector3(-4.85,.98,-1.65),new T.Vector3(0,.98,-4.5),new T.Vector3(4.85,.98,-1.65)][i];const a=-Math.PI/2+(i-1)/(this.seatCount-2)*Math.PI;return new T.Vector3(4.8*Math.sin(a)*Math.min(1,this.camera.aspect/1.6),.98,-.75-4*Math.cos(a));}
 seatPoint(i){if(i===0)return new T.Vector3(0,1.343,1.85);if(this.mode!=='poker')return new T.Vector3(0,1.343,-2.7);if(this.seatCount<=4)return [null,new T.Vector3(-3.48,1.343,.05),new T.Vector3(0,1.343,-2.7),new T.Vector3(3.48,1.343,.05)][i];const p=this.avatarPoint(i);return new T.Vector3(p.x*.77,1.343,p.z*.76);}
 chipPoint(i){if(this.seatCount>4&&this.mode==='poker'){if(i===0)return new T.Vector3(3.6,1.38,2.2);const p=this.avatarPoint(i);return new T.Vector3(p.x*.89+.27,1.38,p.z*.89+.12)}if(this.view?.done||this.view?.runout){if(i===0)return new T.Vector3(2.8,1.38,-2.8);if(i===1)return new T.Vector3(-4.2,1.38,-1.8);if(i===3)return new T.Vector3(3.65,1.38,-1.8);}return [new T.Vector3(2.65,1.38,2.18),new T.Vector3(-4.55,1.38,.95),new T.Vector3(1.35,1.38,-3.1),new T.Vector3(4.05,1.38,.95)][i]}
 showdownSeats(){return this.mode==='poker'?Array.from({length:this.view.players.length},(_,i)=>i).filter(i=>!this.view.players[i].fold&&(i===0||this.view.showdown||this.view.runout)):[0]}
 showdownScale(){const n=this.showdownSeats().length;return n>4?.62:n>3?.85:1;}
 showdownPoint(i){const seats=this.showdownSeats(),index=Math.max(0,seats.indexOf(i)),fit=this.cardFit(),many=seats.length>4,cols=many?Math.ceil(seats.length/2):seats.length,row=many?Math.floor(index/cols):0,rowCount=Math.min(cols,seats.length-row*cols),step=many?1.65:2.08*this.showdownScale();return new T.Vector3((index%cols-(rowCount-1)/2)*step*fit,1.343,many?1.22+row*1.13:1.92);}
 // Reactions use only independent randomness and public event timing, never card values.
 react(seat){if(this.reduced)return;for(const rig of this.rigs){if(rig.seat===seat||Math.random()<.38){rig.reaction=Math.floor(Math.random()*5);rig.reactionAt=this.elapsed+Math.random()*.45;rig.reactionDuration=1.3+Math.random()*1.2}}}
 animateRig(rig,time,dt){
  rig.gesture=Math.max(0,rig.gesture-dt*2);if(this.reduced)return;
  if(time>rig.nextBlink){rig.blinkAt=time;rig.nextBlink=time+2.5+Math.random()*5}const blink=time-(rig.blinkAt??-10)<.13;rig.lids.forEach(l=>l.visible=blink);
  if(time>rig.nextIdle){rig.reaction=Math.floor(Math.random()*5);rig.reactionAt=time;rig.reactionDuration=1.6+Math.random();rig.nextIdle=time+4+Math.random()*7}
  const p=(time-rig.reactionAt)/rig.reactionDuration,v=p>=0&&p<1?Math.sin(p*Math.PI):0,k=rig.reaction;
  rig.head.rotation.y=Math.sin(time*.4+rig.phase)*.035+(k===0?Math.sin(p*Math.PI*2)*.23*v:k===4?-.18*v:0);
  rig.head.rotation.x=Math.sin(time*.7+rig.phase)*.012+(k===1?Math.sin(p*Math.PI*3)*.12*v:k===4?.15*v:0);
  rig.head.rotation.z=(k===2?.1:k===3?-.07:0)*v;rig.head.position.y=1.16+Math.sin(time*1.2+rig.phase)*.008+(k===3?.035*v:0);
  if(rig.faceArt){rig.head.rotation.x*=.35;rig.head.rotation.y*=.4;rig.head.rotation.z*=.4;(rig.ranger?updateRangerFace:rig.guardian?updateGuardianFace:rig.engineer?updateEngineerFace:updateWitchFace)(rig,blink,k,v)}
  rig.group.rotation.x=(k===4?.025:0)*v;rig.group.position.y=rig.baseY+Math.sin(time*.8+rig.phase)*.006;
  rig.brows.forEach((b,i)=>{b.position.y=.17+(k===2?.08:k===3?-.025:0)*v;b.rotation.z=(i?1:-1)*(k===1?.2:k===2?-.15:0)*v});
  if(!rig.faceArt){rig.mouth.scale.y=.045+(k===2?.045:0)*v;rig.mouth.scale.x=.2+(k===3?.06:k===1?-.04:0)*v;rig.mouth.rotation.z=(k===3?.12:0)*v;}
  rig.arms[1].rotation.x=-Math.sin(rig.gesture/1.6*Math.PI)*.85-(k===4?.2*v:0);if(rig.engineer||rig.guardian||rig.ranger)rig.arms[1].rotation.x=Math.max(-.48,rig.arms[1].rotation.x);rig.arms[0].rotation.x=Math.sin(time*.7+rig.phase)*.015-(k===3?.12*v:0);
  rig.arms.forEach((arm,i)=>arm.position.y=.73+(k===3?.05*v:0)+(i?0:Math.sin(time*.6+rig.phase)*.007));
 }
 skillEffect(role,seat=0,index=0,label=null){
  if(!this.alive)return;const colors=[0xc697ff,0xffcc70,0x75dfff,0xb7ed72],g=new T.Group(),held=seat===0&&!this.view?.done&&this.mode==='poker';
  if(held){this.foreground.add(g);g.position.set(role===1?(index-.5)*.18:0,-.4,-1.14)}else{this.scene.add(g);g.position.copy(this.seatPoint(seat));g.position.y+=.04;g.rotation.x=-Math.PI/2}
  const radius=held?.36:.57,material=new T.MeshBasicMaterial({color:colors[role],transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide});
  const ring=new T.Mesh(new T.RingGeometry(radius,radius+.018,role===2?6:64),material);g.add(ring);
  for(let n=0;n<12;n++){const a=n*Math.PI/6,part=new T.Mesh(new T.PlaneGeometry(role===1?.05:.018,role===3?.085:.025),material.clone());part.position.set(Math.cos(a)*(radius+.05),Math.sin(a)*(radius+.05),.002);part.rotation.z=a;g.add(part)}
  if(role===0){for(const side of [-1,1]){const crystal=new T.Mesh(new T.OctahedronGeometry(held?.055:.09),material.clone());crystal.position.set(side*(radius+.09),0,.025);g.add(crystal)}}
  if(role===2){for(const scale of [1.15,1.3]){const layer=new T.Mesh(new T.RingGeometry(radius*scale,radius*scale+.012,6),material.clone());layer.rotation.z=Math.PI/6;g.add(layer)}}
  if(role===3){for(let n=0;n<4;n++){const a=n*Math.PI/2,mark=new T.Mesh(new T.PlaneGeometry(.12,.022),material.clone());mark.position.set(Math.cos(a)*(radius+.035),Math.sin(a)*(radius+.035),.01);mark.rotation.z=a;g.add(mark)}}
  this.effects.push({group:g,start:this.elapsed,duration:this.reduced?.8:2.1,role});this.react(seat);
  const node=document.createElement('div');node.className='skill-flash skill-'+role;node.textContent=label??['✧ 水晶透视','⚒ 精密重构','◇ 安全着陆','⌖ 悬赏契约'][role];this.container.append(node);setTimeout(()=>node.remove(),2200);
 }
 animateEffects(time){for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i],p=(time-e.start)/e.duration;if(p>=1){this.disposeGroup(e.group);this.effects.splice(i,1);continue}if(!this.reduced){e.group.rotation.z=(e.role===1?-1:1)*p*.8;e.group.scale.setScalar(1+Math.sin(p*Math.PI)*.13)}e.group.traverse(o=>{if(o.material)o.material.opacity=(this.reduced?.8:Math.sin(Math.min(1,p*3)*Math.PI/2))*(1-p)*.9})}}
 cardFit(){const aspect=this.camera?.aspect??2.4;return Math.min(1,Math.max(.42,aspect/(aspect<1.05?1.35:2.15)));}
 pose(obj,target,rotation,scale,duration=.8){
  this.tweens=this.tweens.filter(t=>t.obj!==obj);this.poseTweens=this.poseTweens.filter(t=>t.obj!==obj);
  const toQ=new T.Quaternion().setFromEuler(new T.Euler(...rotation));
  this.poseTweens.push({obj,from:obj.position.clone(),to:target.clone(),fromQ:obj.quaternion.clone(),toQ,fromS:obj.scale.clone(),toS:scale,start:this.elapsed,duration:this.reduced?.01:duration});
 }
 tween(obj,to,duration=.5,delay=0,arc=0,done){const from=obj.position.clone();this.tweens.push({obj,from,to:to.clone(),start:this.elapsed+delay,duration:this.reduced?.01:duration,arc,done})}
 async pause(ms){if(this.reduced)ms=Math.min(ms,50);return new Promise(r=>setTimeout(r,ms))}
 moveChips(seat,amount,reverse=false){let start=this.chipPoint(seat),end=new T.Vector3((seat-1.5)*.17,1.4,-1.45);if(reverse)[start,end]=[end,start];for(let n=0;n<Math.min(10,Math.max(2,Math.ceil(amount/60)));n++){let chip=this.chip(this.scene,start.x+(n%3)*.12,start.y+.04*Math.floor(n/3),start.z,seat===0?0xd3bf69:seat===1?0xb36d67:seat===2?0x76a798:0x8b88b8);this.tween(chip,new T.Vector3(end.x+(n%3)*.14,end.y+.05*Math.floor(n/3),end.z),.52,n*.024,.22,()=>this.disposeGroup(chip))}let rig=this.rigs.find(r=>r.seat===seat);if(rig)rig.gesture=1.6;else this.handGesture=1.6}
 disposeGroup(g){g.removeFromParent();g.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&o.geometry!==this.boxGeo)o.geometry.dispose();if(o.material&&!([...this.materials.values()].includes(o.material)))o.material.dispose?.()})}
 sync(view,{animate=true}={}){
  const laidOut=!!(view.done||view.runout),entering=laidOut&&!(this.view?.done||this.view?.runout);const boardCount=view.board?.length??0;if(boardCount>this.lastBoardCount)this.react(-1);this.lastBoardCount=boardCount;this.view=view;
  if(entering){this.showdownAt=this.elapsed;for(const rig of this.rigs)rig.gesture=1.6;}
  const winners=(view.winningSeats??[]).join(',');if(winners!==this.winnerSignature){this.winnerSignature=winners;if(this.winnerRings)this.disposeGroup(this.winnerRings);this.winnerRings=new T.Group();this.scene.add(this.winnerRings);for(const seat of view.winningSeats??[]){const p=this.showdownPoint(seat),ring=new T.Mesh(new T.RingGeometry(.92,1.0,64),new T.MeshBasicMaterial({color:0xffdb6c,transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(p);ring.position.y=1.355;ring.scale.set(1,.8,1);this.winnerRings.add(ring)}}
  let wanted=new Set();
  const highlighted=new Set((view.winningCards??[]).map(c=>c.r+c.s));
  const ensure=(id,c,parent,target,rotation,w,h,index)=>{
   wanted.add(id);let entry=this.cardObjects.get(id);const sig=c?c.r+c.s:'back';
   const poseKey=[parent.uuid,...target.toArray(),...rotation,w,h].join(',');
   if(!entry){
    const obj=this.makeCard(c,w,h);obj.rotation.set(...rotation);parent.add(obj);obj.userData.index=index;obj.position.copy(target);
    entry={obj,sig,w,h,poseKey};this.cardObjects.set(id,entry);
    if(animate){if(parent===this.held)obj.position.set((index-.5)*.08,.25,-2.9);else{obj.position.copy(this.deckAnchor);if(parent!==this.scene){parent.updateWorldMatrix(true,false);parent.worldToLocal(obj.position)}}if(this.mode==='blackjack'){const toQ=obj.quaternion.clone();obj.rotateZ(.22);const fromQ=obj.quaternion.clone();this.tween(obj,target,.6,0,.09);Object.assign(this.tweens.at(-1),{fromQ,toQ})}else this.tween(obj,target,.55,(id.startsWith('seat')?.1+.15*(Number(id[4])-1)+(index??0)*.6:id.startsWith('own')?.55+(index??0)*.6:.12*(index??0)),parent===this.held?.15:.25);}
   }else{
    const changed=entry.sig!==sig;
    if(changed){entry.sig=sig;if(this.mode==='blackjack'&&animate){this.flips??=[];this.flips=this.flips.filter(f=>f.obj!==entry.obj);this.flips.push({obj:entry.obj,start:this.elapsed,texture:this.faceTexture(c),baseY:target.y,lift:entry.w*.5,rotation:[...rotation],swapped:false})}else{entry.obj.userData.face.material.map=this.faceTexture(c);entry.obj.userData.face.material.needsUpdate=true;}}
    if(entry.poseKey!==poseKey){
     if(entry.obj.parent!==parent){this.scene.updateMatrixWorld(true);parent.attach(entry.obj);}
     this.pose(entry.obj,target,rotation,new T.Vector3(w/entry.w,h/entry.h,1),animate?.85:.01);entry.poseKey=poseKey;
    }else if(changed&&animate&&this.mode!=='blackjack'){entry.obj.rotation.x=-Math.PI/2+.8;this.pose(entry.obj,target,rotation,entry.obj.scale.clone(),.55);}
   }
   const obj=entry.obj;obj.visible=true;
   const winner=!!(view.done&&c&&highlighted.has(sig));
   obj.userData.winner=winner;
   if(winner&&!obj.userData.outline){
    const outline=new T.Group(),gold=new T.MeshBasicMaterial({color:0xffd46b,transparent:true,opacity:.95,depthWrite:false});
    for(const [w,h,x,y] of [[entry.w,.018,0,entry.h/2-.009],[entry.w,.018,0,-entry.h/2+.009],[.018,entry.h,entry.w/2-.009,0],[.018,entry.h,-entry.w/2+.009,0]]){const edge=new T.Mesh(new T.PlaneGeometry(w,h),gold.clone());edge.position.set(x,y,.027);outline.add(edge)}obj.add(outline);obj.userData.outline=outline;
   }
   if(obj.userData.outline)obj.userData.outline.visible=winner;
   return obj;
  };
  this.pickable=[];
  const fit=this.cardFit(),showScale=this.showdownScale(),angle=-Math.PI/2;
  const own=view.hand??[];own.forEach((c,n)=>{
   if(this.mode==='blackjack'){const count=own.length,offset=n-(count-1)/2;const obj=ensure('own'+n,c,this.scene,new T.Vector3(offset*Math.min(.88,4.2/count)*fit,1.343,1.15),[angle,0,0],Math.min(.8,3.8/count)*fit,1.12,n);if(!view.done)this.pickable.push(obj);return}const count=own.length,offset=n-(count-1)/2,spread=Math.min(.36,1/Math.max(count,2));
   const pos=this.showdownPoint(0),step=Math.min(.94,4/count)*fit*showScale;
   const target=laidOut?new T.Vector3(pos.x+offset*step,pos.y,pos.z):new T.Vector3(offset*spread,-.39-Math.abs(offset)*.018,-1.18-Math.abs(offset)*.012+n*.045);
   const obj=ensure('own'+n,c,laidOut?this.scene:this.held,target,laidOut?[angle,0,0]:[-.08,0,offset*-.065],laidOut?Math.min(.85,3.6/count)*fit*showScale:.39,laidOut?1.2*showScale:.57,n);
   obj.visible=!view.ownFold;if(!view.done)this.pickable.push(obj);
  });
  if(this.mode==='poker'){
   const phoneBoard=this.container.clientWidth<=600||(globalThis.matchMedia?.('(pointer: coarse)').matches&&Math.min(globalThis.innerWidth??10000,globalThis.innerHeight??10000)<=500),tilt=phoneBoard?Math.PI/15:0;
   view.board.forEach((c,n)=>{const obj=ensure('board'+n,c,this.scene,new T.Vector3((n-2)*1.29*fit,1.343+.83*Math.sin(tilt),-.27),[angle+tilt,0,0],1.19*fit,1.66,n),face=obj.userData.face,texture=this.faceTexture(c,'board');if(face.material.map!==texture){face.material.map=texture;face.material.needsUpdate=true}face.receiveShadow=!phoneBoard;});
   for(let i=1;i<view.players.length;i++){
    const p=view.players[i],open=(view.runout||view.done&&view.showdown)&&!p.fold,pos=open?this.showdownPoint(i):this.seatPoint(i);
    p.cards.forEach((c,n)=>{
     const shown=(!view.done&&view.reveal||open)&&!p.fold||!view.done&&view.peek===i&&n===0;
     const rig=this.rigs.find(r=>r.seat===i),heldByEngineer=(rig?.engineer||rig?.guardian||rig?.ranger)&&!open&&!shown&&!p.fold;
     if(heldByEngineer&&!rig.cardGrip){rig.cardGrip=new T.Group();rig.cardGrip.position.set(.12,-.14,.77);rig.cardGrip.rotation.x=-.22;rig.arms[0].add(rig.cardGrip)}
     const obj=heldByEngineer?ensure('seat'+i+'-'+n,null,rig.cardGrip,new T.Vector3(n*.12,.12,.025*n),[0,0,(n-.5)*-.22],.26,.37,n):ensure('seat'+i+'-'+n,shown?c:null,this.scene,new T.Vector3(pos.x+(n-.5)*(open?.94*fit*showScale:(this.seatCount>6?.38:.48)*Math.min(1,this.camera.aspect/1.3)),open?pos.y:1.343,pos.z),[open?angle:-Math.PI/2,0,0],open?.85*fit*showScale:(this.seatCount>6?.35:.45)*Math.min(1,this.camera.aspect/1.3),open?1.2*showScale:(this.seatCount>6?.50:.64)*Math.min(1,this.camera.aspect/1.3),n);
     obj.visible=!p.fold;
    });
   }
  }else view.dealerCards.forEach((c,n)=>ensure('dealer'+n,n===1&&!view.reveal&&!view.peek?null:c,this.scene,new T.Vector3((n-(view.dealerCards.length-1)/2)*Math.min(1.15,5.6/view.dealerCards.length)*fit,1.343,-1.55),[angle,0,0],Math.min(1.06,5.1/view.dealerCards.length)*fit,1.48,n));
  for(const[id,e]of this.cardObjects)if(!wanted.has(id)){this.disposeGroup(e.obj);this.cardObjects.delete(id)}
  while(this.chipPiles.children.length)this.disposeGroup(this.chipPiles.children[0]);
  const piles=this.mode==='poker'?view.players.map(p=>p.chips):[view.bank,0,2000,0];for(let i=0;i<piles.length;i++){if(this.mode!=='poker'&&i!==0&&i!==2)continue;let pos=this.chipPoint(i);let n=Math.min(this.seatCount>6?12:24,Math.max(0,Math.ceil(piles[i]/100)));for(let k=0;k<n;k++)this.chip(this.chipPiles,pos.x+Math.floor(k/6)*.23,1.38+(k%6)*.055,pos.z,[0xc2b46c,0xb67470,0x73a390,0x9183ad][i%4])}
  if(view.pot>0)for(let n=0;n<Math.min(22,Math.ceil(view.pot/40));n++)this.chip(this.chipPiles,(n%5-2)*.2,1.38+Math.floor(n/5)*.06,-1.6,0xc0aa66);
  this.batchBoxes(this.chipPiles);
 }
 async action(event){if(!this.alive)return;this.react(event.seat??-1);if(event.kind==='bet'||event.kind==='return'){this.moveChips(event.seat,event.amount,event.kind==='return');await this.pause(620)}else if(event.kind==='check'){const rig=this.rigs.find(r=>r.seat===event.seat);if(rig)rig.gesture=.8;else this.handGesture=.7;await this.pause(400)}else if(event.kind==='fold'){for(const[id,e]of this.cardObjects)if(id.startsWith(event.seat===0?'own':'seat'+event.seat+'-')){let target=e.obj.position.clone();target.x+=event.seat===0?1.2:-.5;target.z-=event.seat===0?1:0;this.tween(e.obj,target,.4,0,.13)}await this.pause(450)}else if(event.kind==='win'){await this.pause(900);if(!this.alive)return;for(const i of event.winners)this.moveChips(i,300,true);await this.pause(800)}}
 resize(){if(!this.alive)return;let w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;for(const rig of this.rigs??[]){if(this.seatCount>4){rig.group.position.copy(this.avatarPoint(rig.seat));rig.group.rotation.y=Math.atan2(-rig.group.position.x,1.2-rig.group.position.z);rig.group.scale.setScalar(Math.max(.62,.96-(this.seatCount-4)*.055)*Math.min(1,Math.max(.62,this.camera.aspect/1.3)))}}for(const rig of this.rigs??[])fitWitchSeat(rig);this.camera.fov=w/h<1.05?66:49;if(w<=600)this.camera.fov=Math.min(95,Math.max(this.camera.fov,2*Math.atan(Math.tan(49*Math.PI/360)*1.65/this.camera.aspect)*180/Math.PI));const foregroundScale=Math.tan(T.MathUtils.degToRad(this.camera.fov/2))/Math.tan(T.MathUtils.degToRad(57/2))*.58;this.foreground.scale.set(foregroundScale,foregroundScale,1);this.foreground.position.y=-.04;this.camera.setViewOffset(w,h,0,h*.075,w,h);this.camera.updateProjectionMatrix();if(this.view)this.sync(this.view,{animate:false})}
 frame(){if(!this.alive)return;let dt=Math.min(this.clock.getDelta(),.05);this.elapsed+=dt;const time=this.elapsed;this.camera.quaternion.copy(this.baseQuaternion);
  for(let n=this.tweens.length-1;n>=0;n--){let tw=this.tweens[n],p=Math.max(0,Math.min(1,(time-tw.start)/tw.duration));if(time<tw.start)continue;const cue=tweenSound(tw,time);if(cue)this.onSound?.(cue);let e=1-Math.pow(1-p,3);tw.obj.position.lerpVectors(tw.from,tw.to,e);tw.obj.position.y+=Math.sin(p*Math.PI)*tw.arc;if(tw.fromQ)tw.obj.quaternion.slerpQuaternions(tw.fromQ,tw.toQ,e);if(p===1){this.tweens.splice(n,1);tw.done?.()}}
  for(let i=(this.flips?.length??0)-1;i>=0;i--){const f=this.flips[i],p=Math.min(1,(time-f.start)/(this.reduced?.01:.58));if(p>=.5&&!f.swapped){f.obj.userData.face.material.map=f.texture;f.obj.userData.face.material.needsUpdate=true;f.swapped=true;this.onSound?.('deal')}f.obj.rotation.set(...f.rotation);f.obj.rotateY(Math.sin(p*Math.PI)*Math.PI/2);f.obj.position.y=f.baseY+Math.sin(p*Math.PI)*f.lift;if(p===1)this.flips.splice(i,1)}
  for(const rig of this.rigs)this.animateRig(rig,time,dt);this.animateEffects(time);
  for(let n=this.poseTweens.length-1;n>=0;n--){const tw=this.poseTweens[n],p=Math.min(1,(time-tw.start)/tw.duration),e=p*p*(3-2*p);tw.obj.position.lerpVectors(tw.from,tw.to,e);tw.obj.position.y+=Math.sin(p*Math.PI)*.17;tw.obj.quaternion.slerpQuaternions(tw.fromQ,tw.toQ,e);tw.obj.scale.lerpVectors(tw.fromS,tw.toS,e);if(p===1)this.poseTweens.splice(n,1);}
  for(const {obj}of this.cardObjects.values()){const pulse=this.reduced?.18:.16+Math.sin(time*2.1)*.045;obj.userData.face.material.color.setRGB(1,1,obj.userData.winner?1-pulse*.4:1);obj.userData.face.material.emissive.setHex(obj.userData.winner?0x8b620f:0);obj.userData.face.material.emissiveIntensity=obj.userData.winner?.12+pulse*.45:0;if(obj.userData.outline)obj.userData.outline.traverse(o=>{if(o.material)o.material.opacity=.78+pulse});}
  this.showdownBlend=T.MathUtils.damp(this.showdownBlend,(this.view?.done||this.view?.runout)?1:0,5,dt);
  this.handGesture=Math.max(0,(this.handGesture||0)-dt*2);this.hands.forEach((h,i)=>{h.position.y=-.66-this.showdownBlend*.65+(this.reduced?0:Math.sin(time*1.2+i)*.006)+Math.sin(this.handGesture/1.6*Math.PI)*.13;h.position.z=-1.28-Math.sin(this.handGesture/1.6*Math.PI)*.22});
  this.scene.updateMatrixWorld();this.camera.updateMatrixWorld();
  const labelBoxes=[];for(const seat of [0,...this.rigs.map(r=>r.seat)]){
   const node=this.container.querySelector('[data-seat-label="'+seat+'"]');if(!node)continue;
   const peek=this.container.querySelector('[data-peek-seat="'+seat+'"]'),peekRig=this.rigs.find(r=>r.seat===seat);
   if(peek&&peekRig){const headTop=new T.Vector3(0,.83,0);peekRig.head.localToWorld(headTop);headTop.project(this.camera);const pw=peek.offsetWidth||44,ph=peek.offsetHeight||62;peek.style.left=Math.max(pw/2+8,Math.min(this.container.clientWidth-pw/2-8,(headTop.x*.5+.5)*this.container.clientWidth))+'px';peek.style.top=Math.max(ph+8,(-headTop.y*.5+.5)*this.container.clientHeight-8)+'px';}
   const atHead=node.dataset?.atHead==='true';const onCards=!atHead&&(this.view?.done||this.view?.runout)&&(seat===0||this.mode==='poker'&&(this.view.showdown||this.view.runout)&&!this.view.players[seat].fold);
   let p;if(onCards){p=this.showdownPoint(seat);p.y=1.36;p.z+=.68*this.showdownScale();}else{const rig=this.rigs.find(r=>r.seat===seat);if(!rig)continue;p=new T.Vector3(0,atHead?(rig.witch?1.5:.96):.55,atHead?0:.35);if(atHead)rig.head.localToWorld(p);else rig.group.localToWorld(p);}
   p.project(this.camera);node.classList.toggle('at-cards',onCards);
   if(onCards&&this.showdownSeats().length>4){const neighbor=this.showdownPoint(seat);neighbor.x+=1.65*this.cardFit();neighbor.z+=.68*this.showdownScale();neighbor.project(this.camera);node.style.maxWidth=Math.max(35,Math.abs(neighbor.x-p.x)*.5*this.container.clientWidth*.86)+'px'}else node.style.maxWidth='';
   const width=node.offsetWidth,height=node.offsetHeight||30,left=Math.max(8+width/2,Math.min(this.container.clientWidth-8-width/2,(p.x*.5+.5)*this.container.clientWidth));let top=(-p.y*.5+.5)*this.container.clientHeight;
   if(!onCards&&!atHead&&this.seatCount>4){for(let n=0;n<8;n++){if(!labelBoxes.some(b=>Math.abs(b.x-left)<(b.w+width)/2+4&&top<b.y+b.h+3&&top+height>b.y-3))break;top-=height+4}top=Math.max(90,top)}
   if(atHead)top=Math.max(height+8,Math.min(this.container.clientHeight-8,top));
   labelBoxes.push({x:left,y:top,w:width,h:height});node.style.left=left+'px';node.style.top=top+'px';
  }

  this.renderer.render(this.scene,this.camera);this.raf=requestAnimationFrame(this.frame);
 }
 destroy(){this.alive=false;cancelAnimationFrame(this.raf);this.observer.disconnect();this.container.removeEventListener('pointermove',this.move);this.container.removeEventListener('pointerleave',this.leave);this.renderer.domElement.removeEventListener('click',this.click);this.scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&o.geometry!==this.boxGeo)o.geometry.dispose();if(o.material&&!([...this.materials.values()].includes(o.material)))o.material.dispose?.()});this.boxGeo.dispose();for(let m of this.materials.values())m.dispose();for(let t of this.textures.values())t.dispose();this.renderer.dispose();this.renderer.domElement.remove()}
}
