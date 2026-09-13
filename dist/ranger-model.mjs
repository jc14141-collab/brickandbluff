import * as T from './vendor/three.module.min.js';
import {installWitchFace} from './witch-face.mjs';

export function refineRanger(table,rig){
 const {group:g,head,arms}=rig,green=0x365d39,moss=0x62824a,deep=0x233f30,leather=0x62432e,gold=0xc2a45a;
 const b=(p,w,h,d,x,y,z,c)=>table.box(p,w,h,d,x,y,z,c);
 head.clear();
 const skin=b(head,.78,.73,.69,0,0,0,0xe0b77c);skin.material=table.mat(0xe0b77c).clone();skin.material.emissive.setHex(0xe0b77c);skin.material.emissiveIntensity=.20;skin.receiveShadow=false;
 installWitchFace(table,rig);updateRangerFace(rig,false,0,0);
 // A hollow hood follows the head; its front opening never intersects the expression plane.
 const hood=new T.Group();head.add(hood);
 for(let n=0;n<5;n++){
  b(hood,.98-n*.105,.105,.85-n*.075,0,.37+n*.077,-.055-n*.034,n%2?green:moss);
  for(const side of [-1,1])b(hood,.135,.15,.73,side*(.445-n*.009),.24-n*.135,-.075,n%2?green:deep);
 }
 b(hood,.80,.67,.13,0,.01,-.40,green);
 for(const side of [-1,1]){
  for(let n=0;n<4;n++)b(hood,.055,.125,.075,side*(.416-n*.005),.20-n*.125,.317,moss);
  const edge=b(hood,.31,.06,.09,side*.25,.345,.34,moss);edge.rotation.z=side*.21;
  for(let n=0;n<3;n++)b(hood,.105,.20,.12,side*.365,.15-n*.12,.29,n%2?0x67472d:0x89603a);
 }
 for(let n=0;n<5;n++)b(hood,.13,.095+(n%2)*.035,.09,-.27+n*.135,.29-(n%2)*.016,.328,0x765031);
 table.batchBoxes(hood);
 const chair=g.children.find(o=>o.isGroup&&o!==head&&!arms.includes(o));
 if(chair){chair.clear();b(chair,1.4,.16,1.3,0,-.08,-.12,0x293b32);b(chair,1.34,.66,.13,0,.29,-.91,0x344638);b(chair,1.44,.09,.17,0,.67,-.91,0xb5a875);
 for(const side of [-1,1]){for(const z of[-.80,.40])b(chair,.12,1.08,.13,side*.62,-.6,z,0x29382f);b(chair,.18,.10,.96,side*.72,.40,-.05,0x899268)}table.batchBoxes(chair)}
 const outfit=new T.Group();g.add(outfit);
 b(outfit,1.055,.73,.63,0,.43,-.025,green);
 // Layered shoulders, diagonal leather harness and brass leaf clasp.
 for(const side of [-1,1]){
  for(let n=0;n<3;n++)b(outfit,.24+n*.05,.085,.65,side*(.37+n*.02),.80-n*.065,-.025,n%2?deep:moss);
  const collar=b(outfit,.28,.14,.07,side*.16,.76,.33,moss);collar.rotation.z=side*.37;
 }
 const strap=b(outfit,.12,.73,.058,.04,.44,.343,leather);strap.rotation.z=-.60;
 for(const y of [.30,.58]){const clasp=b(outfit,.155,.09,.035,.04+(y-.44)*.68,y,.381,gold);clasp.rotation.z=-.60}
 const leaf=b(outfit,.11,.17,.035,-.25,.68,.39,gold);leaf.rotation.z=-.6;b(outfit,.035,.11,.015,-.25,.68,.414,deep);
 b(outfit,1.04,.12,.66,0,.09,-.01,leather);b(outfit,.22,.14,.06,0,.09,.35,gold);b(outfit,.135,.075,.025,0,.09,.39,deep);
 for(const side of [-1,1]){
  b(outfit,.23,.25,.12,side*.36,.01,.35,leather);b(outfit,.245,.075,.13,side*.36,.12,.36,0x89613b);b(outfit,.045,.045,.025,side*.36,.07,.44,gold);
  b(outfit,.37,.28,.64,side*.25,.025,.32,deep);b(outfit,.39,.36,.35,side*.25,-.41,.59,leather);b(outfit,.42,.17,.54,side*.25,-.65,.73,0x3e3025);
  for(let n=0;n<2;n++)b(outfit,.405,.035,.365,side*.25,-.29-n*.17,.59,0x956c43);
 }
 // Cape lies in front of the chair back, with narrow folds beside the torso.
 for(let n=0;n<8;n++)b(outfit,.14,.89+(n%3)*.025,.08,-.49+n*.14,.34,-.405,n%2?green:deep);
 for(const side of [-1,1])for(let n=0;n<3;n++)b(outfit,.10,.58,.13,side*(.49+n*.035),.24,-.24+n*.105,n%2?green:deep);
 table.batchBoxes(outfit);
 for(const [i,arm] of arms.entries()){
  arm.clear();b(arm,.35,.33,.39,0,-.10,.01,green);
  for(let n=0;n<3;n++)b(arm,.38,.055,.405,0,.01-n*.09,.01,n%2?deep:moss);
  b(arm,.30,.20,.24,0,-.27,.21,0xd8ac72);b(arm,.35,.25,.28,0,-.29,.46,leather);
  for(const z of [.34,.54]){b(arm,.37,.045,.055,0,-.17,z,gold);b(arm,.035,.25,.05,-.19,-.29,z,0x9d7845)}
  b(arm,.36,.23,.20,0,-.29,.705,0x403a28);
  for(let f=0;f<4;f++){b(arm,.079,.20,.085,-.133+f*.09,-.285,.8575,0xd8ac72);b(arm,.079,.215,.04,-.133+f*.09,-.285,.82,0x403a28)}
  b(arm,.10,.17,.19,i?-.24:.24,-.32,.70,0xd8ac72);
  arm.traverse(o=>{if(o.isMesh)o.receiveShadow=false});
 }
 // Equipment is secured outside the chair and behind the shoulders, away from the felt.
 const gear=new T.Group();gear.position.set(.49,.63,-.62);gear.rotation.z=-.13;g.add(gear);
 b(gear,.27,.72,.26,0,0,0,leather);b(gear,.30,.07,.29,0,.34,0,gold);
 for(let n=0;n<3;n++){
  const x=-.085+n*.085,y=.65+(n%2)*.065;b(gear,.025,.63,.025,x,.43,-.02,0xb99865);
  b(gear,.055,.12,.025,x,y,.014,n%2?moss:0xd6c696);
 }
 const bow=new T.Group();bow.position.set(-.58,.61,-.62);g.add(bow);
 const points=[[-.03,-.70],[.09,-.52],[.17,-.27],[.18,0],[.17,.27],[.09,.52],[-.03,.70]];
 // One continuous bow ribbon replaces overlapping limb boxes with coplanar fronts.
 const outline=new T.Shape();points.forEach(([x,y],i)=>i?outline.lineTo(x-.028,y):outline.moveTo(x-.028,y));
 for(const [x,y] of [...points].reverse())outline.lineTo(x+.028,y);outline.closePath();
 const limb=new T.Mesh(new T.ExtrudeGeometry(outline,{depth:.065,bevelEnabled:false,steps:1}),table.mat(0xad7b43));limb.position.z=-.0325;bow.add(limb);
 b(bow,.018,1.34,.018,-.03,0,0,0xd5c49b);
 table.batchBoxes(gear);table.batchBoxes(bow);for(const part of [gear,bow])part.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});rig.ranger=true;return rig;
}

export function updateRangerFace(rig,blink,kind,strength){
 const a=rig.faceArt,mood=strength>.35?kind:-1,state='ranger:'+blink+':'+mood;if(a.state===state)return;a.state=state;
 const c=a.canvas.getContext('2d');c.clearRect(0,0,256,256);const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
 for(const x of [60,158]){const dy=mood===2?-3:0;r(x-2,66+dy,37,6,'#57402a');r(x+5,63+dy,26,4,'#57402a');
  if(blink)r(x,110,36,5,'#243226');else{r(x,86,37,44,'#293429');r(x+5,94,27,34,'#31543a');r(x+10,94,17,29,'#18251d');r(x+4,88,12,13,'#fff7db');r(x+26,117,6,6,'#b1c585')}
 }
 r(104,178,48,5,'#745038');r(99,173,7,6,'#745038');r(150,172,7,7,'#745038');a.texture.needsUpdate=true;
}
