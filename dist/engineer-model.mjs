import * as T from './vendor/three.module.min.js';
import {installWitchFace} from './witch-face.mjs';
export function refineEngineer(table,rig){
 const {group:g,head,arms}=rig,orange=0xce6c21,leather=0x553b2c,brass=0xc49950;
 const b=(p,w,h,d,x,y,z,c)=>table.box(p,w,h,d,x,y,z,c);
 for(const o of [...head.children])if(o.position.y>.26||o.isMesh&&o.position.z>.30)head.remove(o);
 const skin=head.children.find(o=>o.isMesh&&o.scale.x===.78);if(skin){skin.material=table.mat(0xe2bd7e).clone();skin.material.emissive.setHex(0xe2bd7e);skin.material.emissiveIntensity=.25;skin.receiveShadow=false}
 installWitchFace(table,rig);
 // Dense staggered hair plates wrap the crown instead of a flat rectangular cap.
 const hairGroup=new T.Group();head.add(hairGroup);
 for(let layer=0;layer<5;layer++)for(let row=0;row<4;row++){
 const w=.87-layer*.07,y=.31+layer*.057,z=-.30+row*.18;
 b(hairGroup,w,.073,.20,-.025+layer*.009,y,z,layer%2?0x87502c:0x744020);
 }
 for(const side of[-1,1])for(let n=0;n<5;n++)b(hairGroup,.16,.14,.22,side*(.415+(n%2)*.02),.26-n*.11,-.16+(n%2)*.11,n%2?0x663b24:0x87502c);
 for(let n=0;n<7;n++){const fringe=b(hairGroup,.137,.16+(n%3)*.025,.17,-.39+n*.13,.30-(n%3)*.024,.365,n%2?0x744020:0x955b32);fringe.rotation.z=(n-3)*.035}
 for(const side of[-1,1]){b(head,.085,.14,.12,side*.433,-.085,.09,0xd6aa73);b(head,.08,.035,.07,side*.438,-.055,.16,0xbc8656)}
 // Thick cylindrical goggle housings and inset lenses, raised above the fringe.
 const optics=new T.Group();optics.position.set(0,.49,.425);optics.rotation.x=-.10;head.add(optics);
 b(head,.93,.125,.08,0,.41,.25,leather);
 for(const side of[-1,1]){
 b(head,.09,.135,.66,side*.45,.40,-.06,leather);
 for(let n=0;n<5;n++)b(head,.025,.11,.05,side*.50,.4,-.30+n*.12,0x372d27);
 const housing=new T.Mesh(new T.CylinderGeometry(.186,.186,.10,12),table.mat(0x3d3b35,.3));housing.rotation.x=Math.PI/2;housing.position.set(side*.225,0,0);optics.add(housing);
 const ring=new T.Mesh(new T.TorusGeometry(.155,.027,4,16),table.mat(brass,.55));ring.position.set(side*.225,0,.062);optics.add(ring);
 const lens=new T.Mesh(new T.CircleGeometry(.131,16),new T.MeshStandardMaterial({color:0x586874,metalness:.55,roughness:.18,emissive:0x26333f,emissiveIntensity:.4}));lens.position.set(side*.225,0,.065);optics.add(lens);
 const glint=b(optics,.043,.096,.009,side*.225+.037,.012,.075,0xdbe8de);glint.rotation.z=.3;
 }b(optics,.125,.055,.08,0,0,.01,brass);
 // Friendly male expression with dark curved brows and a small connected tooth smile.
 updateEngineerFace(rig,false,0,0);
 // Work apron, double straps, reinforced sleeves and tool belt.
 const detail=new T.Group();g.add(detail);
 b(detail,.65,.65,.045,0,.43,.287,orange);
 b(detail,.26,.17,.05,0,.755,.30,0xe6bb79);
 for(const side of[-1,1]){const collar=b(detail,.16,.13,.06,side*.14,.75,.33,0xe88a36);collar.rotation.z=side*-.35;}
 for(let n=0;n<3;n++)b(detail,.033,.033,.03,0,.55+n*.08,.32,brass);
 for(const side of[-1,1]){b(detail,.115,.70,.055,side*.31,.45,.31,leather);b(detail,.16,.13,.06,side*.31,.61,.345,brass);b(detail,.085,.08,.065,side*.31,.61,.38,0x322b26);b(detail,.12,.13,.06,side*.31,.25,.36,0x8b6744)}
 b(detail,.31,.23,.055,0,.37,.33,0xb96026);b(detail,.3,.025,.058,0,.48,.365,0xe69b4d);
 b(detail,1.05,.12,.65,0,.08,-.02,leather);b(detail,.23,.15,.06,0,.08,.345,brass);b(detail,.125,.075,.065,0,.08,.385,0x675039);
 for(const side of[-1,1])b(detail,.24,.28,.14,side*.43,.04,.32,0x93643c);
 for(const [i,arm] of arms.entries()){
 for(const o of [...arm.children])o.removeFromParent();
 b(arm,.34,.32,.37,0,-.10,.01,orange);
 for(let n=0;n<4;n++)b(arm,.35,.014,.38,0,-.20+n*.065,.01,0xb55b21);
 b(arm,.31,.20,.31,0,-.27,.25,0xe0b077);
 b(arm,.39,.25,.14,0,-.29,.43,0x35302a);b(arm,.30,.18,.025,0,-.285,.511,0x6c5c46);
 b(arm,.37,.255,.32,0,-.29,.65,0x3c352c);
 for(let f=0;f<4;f++){b(arm,.081,.24,.15,-.137+f*.091,-.28,.82,0x4b4133);b(arm,.08,.027,.155,-.137+f*.091,-.245,.825,0x77674e)}
 b(arm,.105,.19,.22,i?-.22:.22,-.32,.65,0x3c352c);
 }
 const pack=new T.Group();pack.position.set(0,.45,-.90);g.add(pack);
 b(pack,.74,.77,.32,0,0,0,0x4d3829);b(pack,.77,.17,.35,0,.29,.02,0x755238);
 for(const side of[-1,1]){b(pack,.09,.70,.04,side*.22,0,-.19,leather);b(pack,.13,.13,.06,side*.22,-.05,-.22,brass);b(pack,.19,.37,.32,side*.44,-.12,0,0x654630)}
 b(pack,.49,.23,.05,0,-.12,-.19,0x93633d);
 table.batchBoxes(pack);table.batchBoxes(hairGroup);
 // Steel wrench is secured outside the chair, away from cards and bets.
 const tool=new T.Group();tool.position.set(-.84,-.55,.04);tool.rotation.z=.15;tool.scale.setScalar(.62);g.add(tool);
 b(tool,.11,1.52,.09,0,.73,0,0x8d9697);b(tool,.17,.75,.13,0,.38,0,leather);
 b(tool,.39,.14,.12,0,1.50,0,0xb3b7ae);
 for(const side of[-1,1]){const jaw=b(tool,.13,.29,.12,side*.18,1.68,0,0xb3b7ae);jaw.rotation.z=side*-.24}
 table.batchBoxes(detail);table.batchBoxes(tool);
 rig.engineer=true;return rig;
}

export function updateEngineerFace(rig,blink,kind,strength){
 const art=rig.faceArt,mood=strength>.35?kind:-1,state='engineer:'+blink+':'+mood;
 if(art.state===state)return;art.state=state;
 const c=art.canvas.getContext('2d');c.clearRect(0,0,256,256);
 const ink=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
 for(const x of[63,163]){
 const lift=mood===2?-3:mood===3?2:0;
 ink(x-3,73+lift,33,5,'#4b2b1c');ink(x+3,69+lift,21,5,'#4b2b1c');
 if(blink){ink(x,110,29,5,'#32241e');ink(x-3,107,5,5,'#32241e')}
 else{ink(x,88,29,42,'#32241e');ink(x+4,87,11,12,'#fff7dc');ink(x+21,116,4,6,'#a98250')}
 }
 ink(98,175,63,5,'#653d24');ink(101,180,57,11,'#653d24');ink(107,191,45,5,'#653d24');ink(105,180,49,5,'#fff0ca');
 art.texture.needsUpdate=true;
}
