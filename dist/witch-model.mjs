import {installWitchFace} from './witch-face.mjs';
import * as T from './vendor/three.module.min.js';
// Role-only mesh refinement; keeps the existing head/arm animation pivots.
export function refineWitch(table,rig){
 const {group:g,head,arms}=rig;
 const violet=0x7130a8,plum=0x482066,gold=0xd7ac4c,hair=0xe1dce9;
 const box=(p,w,h,d,x,y,z,c)=>table.box(p,w,h,d,x,y,z,c);
 const detail=new T.Group();g.add(detail);
 // Replace the old flat cap, with a broad stepped brim and a bent voxel crown.
 for(const o of [...head.children])if(o.position.y>.26||o.isMesh&&o.position.z>.30)head.remove(o);
 const hat=new T.Group();hat.position.y=.38;head.add(hat);
 const band=(r,h,y,c,x=0,z=0)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,h,12),table.mat(c));m.position.set(x,y,z);m.scale.z=.86;m.castShadow=true;hat.add(m);return m};
 band(.70,.065,.025,plum);band(.73,.06,.08,violet);band(.67,.04,.13,0x863eba);
 for(let n=0;n<12;n++){const t=n/11,r=.40*(1-t)+.07,x=-.30*Math.pow(t,2.6);band(r,.074,.17+n*.071,n%3===0?0x8039b0:violet,x,-.025);}
 for(let n=0;n<4;n++)box(hat,.12,.085,.13,-.32-n*.066,.99-n*.022,-.025,plum);
 band(.412,.095,.29,gold);
 const star=new T.Group();star.position.set(0,.34,.363);hat.add(star);
 for(let n=0;n<8;n++){const a=n*Math.PI/4,b=box(star,.074,.21,.042,Math.sin(a)*.091,Math.cos(a)*.091,0,gold);b.rotation.z=-a}
 const gemMat=new T.MeshStandardMaterial({color:0xa942dc,emissive:0x8b22d0,emissiveIntensity:.65,roughness:.24,metalness:.15});
 const gem=(parent,r,x,y,z)=>{const m=new T.Mesh(new T.OctahedronGeometry(r,0),gemMat);m.position.set(x,y,z);parent.add(m);return m};gem(star,.115,0,0,.049);
 box(star,.035,.037,.01,-.026,.037,.15,0xffe6ff);
 // Silver fringe and articulated stepped curls framing the face.
 for(let n=0;n<7;n++){const x=(n-3)*.115;box(head,.135,.17+Math.abs(n-3)*.015,.16,x,.30-Math.abs(n-3)*.025,.34,hair)}
 for(const side of [-1,1])for(let n=0;n<8;n++){
 const y=.20-n*.102,x=side*(.405+.035*Math.sin(n*1.7));
 box(head,.19,.145,.33,x,y,.02+n*.012,n%3?hair:0xc4bdd4);
 box(head,.11,.12,.16,x+side*.058,y-.015,.23,0xeee8f1);
 }
 installWitchFace(table,rig);
 // Layered seated robe, lap panels, cape behind the chair, gold piping.
 for(let n=0;n<6;n++){const y=.28-n*.13,w=.9+n*.055;box(detail,w,.14,.58,0,y,.16+n*.028,n%2?violet:0x64258e);for(const side of [-1,1])box(detail,.032,.14,.032,side*(.12+n*.047),y,.46+n*.028,gold)}
 box(detail,1.2,.038,.68,0,-.46,.30,gold);
 for(let n=0;n<7;n++){const w=.95+n*.042;box(detail,w,.16,.08,0,.67-n*.17,-.405-n*.01,n%2?plum:0x542577)}
 box(detail,1.04,.12,.635,0,.10,-.01,0x875226);box(detail,.21,.19,.035,0,.10,.324,gold);gem(detail,.10,0,.10,.36);
 for(const side of [-1,1]){const lapel=box(detail,.12,.35,.065,side*.12,.65,.29,0x9942bc);lapel.rotation.z=side*-.38;box(detail,.09,.095,.055,side*.29,.70,.295,0x927842);}
 const pendant=box(detail,.115,.115,.04,0,.52,.329,gold);pendant.rotation.z=Math.PI/4;
 dressWitch(table,rig,detail,hat,{violet,plum,gold,gem});
 // Staff rests beside the chair, never across the betting or card area.
 const staff=new T.Group();staff.position.set(-.99,-.65,-.08);staff.rotation.z=-.06;g.add(staff);
 box(staff,.067,2.22,.067,0,1.05,0,0x684021);box(staff,.18,.08,.18,0,2.17,0,gold);
 gem(staff,.17,0,2.42,0).scale.y=1.5;gem(staff,.085,0,2.43,0);
 ornamentStaff(table,staff,{violet,plum,gold});if(rig.staffAura)staff.add(rig.staffAura);
 for(const side of [-1,1])box(staff,.035,.19,.11,side*.10,2.27,0,gold);
 // Batch the non-moving details; no additional realtime light or bloom pass.
 table.batchBoxes(detail);table.batchBoxes(staff);table.batchBoxes(hat);
 hat.traverse(o=>{if(o.isMesh)o.castShadow=false});head.children.forEach(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial&&(o.position.z>=.30||o.scale.x===.78)){o.receiveShadow=false;o.material=o.material.clone();o.material.emissive.copy(o.material.color);o.material.emissiveIntensity=.32;}});
 rig.weapon=staff;rig.witch=true;return rig;
}
// Keep the seated costume outside the outer table rail at every relative seat.
export function fitWitchSeat(rig,rx=5.8125,rz=4.76){
 if(!rig.witch&&!rig.engineer&&!rig.guardian&&!rig.ranger)return;
 const p=rig.group.position,scale=rig.group.scale.x;
 // Body, chair and lap extend about 0.65 units from their pivot; arms reach over the rail.
 const margin=.68*scale+.04;
 const length=Math.hypot(p.x/(rx+margin),p.z/(rz+margin));
 if(length>0&&length<1){p.x/=length;p.z/=length}
 rig.rest=rig.group.rotation.y=Math.atan2(-p.x,1.2-p.z);
}

// Third-person costume: pieces placed where the seated body is actually visible
// (shoulders outside the hair, the chest under the chin, the sleeves over the rail).
function dressWitch(table,rig,detail,hat,{violet,plum,gold,gem}){
 const {group:g,arms}=rig;
 const box=(p,w,h,d,x,y,z,c)=>table.box(p,w,h,d,x,y,z,c);
 const deep=0x3a1652,lining=0xd9c3f2,star=0xfff1c4;
 // Chest: lighter stomacher with gold lacing and a star brooch at the throat.
 box(detail,.34,.36,.03,0,.55,.282,0x8b47c1);
 for(let n=0;n<3;n++){const y=.64-n*.1;for(const r of [.7,-.7]){const l=box(detail,.15,.022,.02,0,y,.3,gold);l.rotation.z=r}}
 for(const side of [-1,1])box(detail,.025,.38,.025,side*.17,.55,.3,gold);
 box(detail,.13,.13,.035,0,.79,.34,gold).rotation.z=Math.PI/4;gem(detail,.06,0,.79,.37);
 // Starry trim down both robe edges.
 for(const side of [-1,1])for(let n=0;n<3;n++)box(detail,.035,.035,.02,side*(.36+(n%2)*.04),.68-n*.14,.27,star);
 arms.forEach(a=>{
  const out=a.position.x>0?1:-1;
  // Puffed shoulder: stepped, with a gold band and a star stud on the outer face.
  box(a,.4,.2,.42,out*.02,.0,0,deep);box(a,.36,.1,.38,out*.02,.13,0,violet);box(a,.42,.045,.44,out*.02,-.1,0,gold);
  box(a,.03,.06,.06,out*.225,.02,0,star);
  // Bell sleeve: two widening steps, pale lining showing underneath, one gold rim.
  box(a,.34,.3,.14,0,-.3,.42,violet);
  box(a,.4,.34,.1,0,-.33,.52,0x64258e);
  box(a,.3,.08,.06,0,-.47,.56,lining);
  box(a,.41,.045,.105,0,-.505,.52,gold);
 });
 // Crescent-moon charm on the outer edge of the brim, clear of the face.
 const charm=new T.Group();charm.position.set(.7,.0,-.08);hat.add(charm);
 box(charm,.02,.1,.02,0,-.05,0,gold);
 for(const [x,y] of [[0,-.13],[-.035,-.15],[-.055,-.185],[-.055,-.225],[-.035,-.26],[0,-.275],[.035,-.27]])box(charm,.04,.04,.03,x,y,0,0xffe7a6);
 for(const [x,y,z] of [[.2,.42,.26],[-.12,.62,.17]])box(hat,.045,.045,.03,x,y,z,star).rotation.z=Math.PI/4;
 // Three slow motes circling the staff crystal; one shared emissive material, no lights.
 const moteMat=new T.MeshStandardMaterial({color:0xd9a8ff,emissive:0xb26bff,emissiveIntensity:1.4});
 const aura=new T.Group();aura.position.set(0,2.42,0);rig.staffAura=aura;
 const motes=[0,1,2].map(n=>{const m=new T.Mesh(new T.BoxGeometry(1,1,1),moteMat);m.scale.setScalar(.035+(n%2)*.012);m.userData.a=n/3*Math.PI*2;m.castShadow=false;aura.add(m);return m});
 motes[0].onBeforeRender=()=>{const t=(typeof performance!=='undefined'?performance.now():0)/1000;motes.forEach((m,i)=>{const a=m.userData.a+t*.6;m.position.set(Math.cos(a)*.32,Math.sin(t*1.1+i*2)*.12,Math.sin(a)*.32);m.rotation.set(t+i,t*.7,0)})};
 motes[0].onBeforeRender();
 rig.aura=aura;
}
function ornamentStaff(table,staff,{violet,plum,gold}){
 const box=(p,w,h,d,x,y,z,c)=>table.box(p,w,h,d,x,y,z,c);
 // Crescent cradle around the crystal.
 for(let n=0;n<9;n++){const a=-Math.PI*.15+n/8*Math.PI*1.3,x=Math.cos(a)*.21,y=2.42+Math.sin(a)*.24;if(Math.abs(x)<.06&&y>2.5)continue;const b=box(staff,.055,.055,.06,x,y,0,gold);b.rotation.z=a}
 // Ribbon wound around the upper shaft, with two tails.
 for(let n=0;n<6;n++){const b=box(staff,.11,.035,.11,0,1.6+n*.09,0,n%2?violet:plum);b.rotation.y=n*.5}
 box(staff,.03,.32,.03,.07,1.42,.02,violet);box(staff,.03,.26,.03,-.06,1.45,-.02,plum);
 for(const y of [1.2,.6])box(staff,.09,.04,.09,0,y,0,gold);
}
