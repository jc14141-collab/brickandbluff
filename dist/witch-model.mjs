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
 arms.forEach(a=>{box(a,.315,.27,.04,0,-.31,.49,gold);box(a,.265,.21,.044,0,-.31,.513,violet);for(const side of [-1,1])box(a,.028,.19,.05,side*.11,-.31,.53,gold)});
 // Staff rests beside the chair, never across the betting or card area.
 const staff=new T.Group();staff.position.set(-.99,-.65,-.08);staff.rotation.z=-.06;g.add(staff);
 box(staff,.067,2.22,.067,0,1.05,0,0x684021);box(staff,.18,.08,.18,0,2.17,0,gold);
 gem(staff,.17,0,2.42,0).scale.y=1.5;gem(staff,.085,0,2.43,0);
 for(const side of [-1,1])box(staff,.035,.19,.11,side*.10,2.27,0,gold);
 // Batch the non-moving details; no additional realtime light or bloom pass.
 table.batchBoxes(detail);table.batchBoxes(staff);table.batchBoxes(hat);
 hat.traverse(o=>{if(o.isMesh)o.castShadow=false});head.children.forEach(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial&&(o.position.z>=.30||o.scale.x===.78)){o.receiveShadow=false;o.material=o.material.clone();o.material.emissive.copy(o.material.color);o.material.emissiveIntensity=.32;}});
 rig.witch=true;return rig;
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
