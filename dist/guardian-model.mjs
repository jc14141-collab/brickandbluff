import * as T from './vendor/three.module.min.js';
import {installWitchFace} from './witch-face.mjs';
export function refineGuardian(table,rig){
 const {group:g,head,arms}=rig,blue=0x328eb5,white=0xe4e5d9,dark=0x304857,gold=0xc5a257;
 const b=(p,w,h,d,x,y,z,color)=>{const m=table.box(p,w,h,d,x,y,z,color);m.material=table.mat(color,.12);return m};
 for(const o of [...head.children])head.remove(o);
 const skin=b(head,.78,.73,.69,0,0,0,0xe7be79);skin.material=skin.material.clone();skin.material.emissive.setHex(0xe7be79);skin.material.emissiveIntensity=.22;skin.receiveShadow=false;
 installWitchFace(table,rig);updateGuardianFace(rig,false,0,0);
 const chair=g.children.find(o=>o.isGroup&&o!==head&&!arms.includes(o));if(chair){chair.clear();
 b(chair,1.40,.16,1.3,0,-.08,-.12,0x293b32);b(chair,1.34,.72,.13,0,.32,-.91,0x344638);b(chair,1.44,.09,.17,0,.71,-.91,0xb5a875);
 for(const side of [-1,1]){for(const z of[-.80,.40])b(chair,.12,1.08,.13,side*.62,-.6,z,0x29382f);b(chair,.18,.10,.96,side*.72,.40,-.05,0x899268)}table.batchBoxes(chair)}
 const shell=new T.Group();head.add(shell);
 // Hollow stepped helmet: the front opening stays completely clear of the face.
 for(let iy=0;iy<6;iy++)for(let ix=-6;ix<=6;ix++)for(let iz=-5;iz<=5;iz++){
 const x=ix*.09,y=.35+iy*.075,z=iz*.09-.04;
 const outer=(x/.61)**2+((y-.25)/.55)**2+((z+.04)/.53)**2;
 const inner=(x/.51)**2+((y-.25)/.45)**2+((z+.04)/.43)**2;
 if(outer<=1.08&&inner>=.86)b(shell,.092,.077,.092,x,y,z,Math.abs(x)<.23?blue:white);
 }
 for(const side of[-1,1]){
 for(let row=0;row<5;row++)b(shell,.13,.13,.68,side*(.50+(row===2?.025:0)),.24-row*.13,-.06,row%3===0?white:blue);
 b(shell,.13,.48,.105,side*.48,-.02,.40,white);for(const vertical of [-1,1]){const corner=b(shell,.18,.13,.15,side*.438,vertical*.29-.015,.40,white);corner.rotation.z=side*vertical*-.65}b(shell,.075,.51,.04,side*.408,-.02,.445,0x2c6173);
 const ear=new T.Mesh(new T.CylinderGeometry(.235,.235,.12,12),table.mat(blue,.2));ear.rotation.z=Math.PI/2;ear.position.set(side*.60,.02,-.03);head.add(ear);
 const inset=new T.Mesh(new T.CylinderGeometry(.162,.162,.132,12),table.mat(dark,.2));inset.rotation.z=Math.PI/2;inset.position.copy(ear.position);head.add(inset);
 b(shell,.035,.115,.10,side*.68,.02,-.03,gold);
 }
 b(shell,.86,.105,.17,0,.34,.40,white);b(shell,.83,.044,.035,0,.267,.468,0x2c6173);
 b(shell,.84,.13,.20,0,-.365,.39,white);b(shell,.77,.055,.08,0,-.315,.462,blue);
 b(shell,.90,.16,.17,0,-.39,-.43,blue);b(shell,.93,.66,.10,0,-.005,-.43,white);
 // Brown fringe inside the helmet, above the eyebrows.
 for(let i=0;i<5;i++)b(shell,.15,.12+(i%2)*.035,.075,-.30+i*.15,.266-(i%2)*.01,.363,i%2?0x60442d:0x795335);
 const glass=new T.Mesh(new T.PlaneGeometry(.82,.54),new T.MeshStandardMaterial({color:0xbce8ef,transparent:true,opacity:.075,metalness:.05,roughness:.18,depthWrite:false}));glass.position.set(0,-.018,.492);head.add(glass);
 const shine=new T.Mesh(new T.PlaneGeometry(.035,.21),new T.MeshBasicMaterial({color:0xe9fbff,transparent:true,opacity:.23,depthWrite:false}));shine.position.set(-.345,.13,.494);shine.rotation.z=-.14;head.add(shine);
 table.batchBoxes(shell);
 const suit=new T.Group();g.add(suit);
 b(suit,1.08,.72,.66,0,.43,-.025,blue);b(suit,.83,.58,.05,0,.43,.325,white);
 for(const side of[-1,1]){b(suit,.115,.64,.085,side*.46,.43,.345,white);b(suit,.13,.11,.11,side*.31,.72,.36,dark);b(suit,.10,.065,.03,side*.31,.74,.422,gold)}
 b(suit,.68,.40,.15,0,.44,.405,white);b(suit,.09,.32,.14,-.39,.43,.39,dark);
 const dial=(x,y,r,color)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,.035,12),table.mat(color,.28));m.rotation.x=Math.PI/2;m.position.set(x,y,.51);suit.add(m)};
 dial(-.12,.44,.13,dark);dial(-.12,.44,.091,0x4ec0d0);dial(.21,.52,.066,0xba652b);dial(.21,.37,.051,0xe5ae3e);
 b(suit,.025,.045,.009,-.145,.48,.538,0xe6faf4);
 b(suit,.89,.12,.70,0,.10,0,white);b(suit,.20,.11,.055,0,.1,.383,dark);b(suit,.11,.05,.065,0,.1,.418,gold);
 for(const side of[-1,1]){b(suit,.40,.24,.67,side*.25,.0,.33,blue);b(suit,.37,.40,.34,side*.25,-.33,.59,white);b(suit,.43,.18,.54,side*.25,-.64,.74,dark);b(suit,.37,.065,.08,side*.25,-.53,.78,blue)}
 // Saturn badge is geometry so it stays crisp from every viewing angle.
 for(const [i,arm]of arms.entries()){
 for(const o of [...arm.children])arm.remove(o);
 b(arm,.40,.35,.40,0,-.09,.025,blue);b(arm,.35,.23,.43,0,-.27,.25,white);
 for(let n=0;n<3;n++)b(arm,.355,.012,.435,0,-.22+n*.045,.25,0xc8d6d2);
 b(arm,.40,.27,.16,0,-.29,.48,blue);b(arm,.40,.26,.28,0,-.29,.68,dark);
 b(arm,.37,.065,.29,0,-.14,.65,blue);
 for(let f=0;f<4;f++){b(arm,.082,.235,.145,-.137+f*.091,-.285,.84,0x344149);b(arm,.082,.014,.148,-.137+f*.091,-.23,.842,0x63737a)}
 b(arm,.105,.19,.23,i?-.23:.23,-.32,.67,dark);
 const logo=new T.Group();logo.position.set((i?1:-1)*.205,-.04,.025);logo.rotation.y=(i?1:-1)*Math.PI/2;arm.add(logo);
 const planet=new T.Mesh(new T.CircleGeometry(.105,16),table.mat(0xe9b943,.12));logo.add(planet);
 const ring=new T.Mesh(new T.RingGeometry(.137,.154,24),table.mat(white,.1));ring.scale.y=.40;ring.rotation.z=.50;ring.position.z=.004;logo.add(ring);
 }
 const pack=new T.Group();pack.position.set(0,.53,-.61);g.add(pack);
 b(pack,.91,.77,.36,0,0,0,blue);b(pack,.78,.16,.37,0,.36,0,white);b(pack,.77,.12,.38,0,-.33,0,white);
 for(const side of[-1,1]){b(pack,.16,.61,.39,side*.39,0,-.01,white);b(pack,.13,.08,.12,side*.28,.49,-.05,blue);b(pack,.13,.10,.055,side*.29,-.08,-.225,gold)}
 b(pack,.46,.42,.065,0,.02,-.225,dark);for(let n=0;n<4;n++)b(pack,.32,.035,.025,0,.14-n*.08,-.27,0x94bfc7);
 table.batchBoxes(pack);table.batchBoxes(suit);rig.guardian=true;return rig;
}

export function updateGuardianFace(rig,blink,kind,strength){
 const a=rig.faceArt,state='guardian:'+blink+':'+(strength>.35?kind:-1);if(a.state===state)return;a.state=state;
 const x=a.canvas.getContext('2d');x.clearRect(0,0,256,256);const r=(a,b,w,h,c)=>{x.fillStyle=c;x.fillRect(a,b,w,h)};
 for(const left of [58,156]){const lift=strength>.35&&kind===2?-3:0;r(left-1,64+lift,40,7,'#50382a');r(left+5,60+lift,25,5,'#50382a');
 if(blink)r(left,109,39,5,'#2a2221');else{r(left,84,40,47,'#342522');r(left+5,89,30,40,'#1c2024');r(left+5,88,13,14,'#fff9e8');r(left+27,119,6,6,'#a6cbd3')}}
 r(99,173,61,6,'#68452c');r(102,179,55,12,'#68452c');r(109,191,42,4,'#68452c');r(106,179,48,5,'#fff4d6');a.texture.needsUpdate=true;
}
