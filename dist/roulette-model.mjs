import * as T from './vendor/three.module.min.js';
import {WHEEL,color} from './roulette.mjs';
const TAU=Math.PI*2,STEP=TAU/38;
// Fine voxel columns give the silhouette real steps, rather than a smooth cylinder with a pixel texture.
export function voxelAnnulus(inner,outer,cell,height,material,{bottom=-.36,seed=1}={}){
 const entries=[];for(let x=-outer;x<=outer;x+=cell)for(let z=-outer;z<=outer;z+=cell){const cx=x+cell/2,cz=z+cell/2,r=Math.hypot(cx,cz);if(r<inner||r>outer)continue;const top=height(r);entries.push({x:cx,z:cz,r,top})}
 const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,entries.length),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),tint=new T.Color();
 entries.forEach((p,i)=>{const h=p.top-bottom;position.set(p.x,bottom+h/2,p.z);scale.set(cell+.0005,h,cell+.0005);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);const grain=Math.sin(Math.floor(p.r/.12)*2.3+Math.floor(Math.atan2(p.z,p.x)*24)*.2)*.035;seed=(seed*1664525+1013904223)>>>0;const v=.84+(seed/4294967296)*.13+grain;tint.setRGB(v,v*.95,v*.86);mesh.setColorAt(i,tint)});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function numberTexture(n){const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff5d8';ctx.font='bold 55px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n,48,48);const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.NearestFilter;return t}
export function buildRouletteModel(scene,rotor,makeNumber=numberTexture,woodTexture=null){
 const wood=new T.MeshStandardMaterial({color:0x785033,map:woodTexture,bumpMap:woodTexture,bumpScale:.018,roughness:.36,metalness:0,flatShading:true}),darkWood=wood.clone();darkWood.color.setHex(0x392b22);const brass=new T.MeshStandardMaterial({color:0xd6ad54,roughness:.27,metalness:.72,flatShading:true}),ivory=new T.MeshStandardMaterial({color:0xe8d3a1,roughness:.4,metalness:.12});
 const add=(group,geometry,material,y=0)=>{const mesh=new T.Mesh(geometry,material);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh};
 const ring=(group,inner,outer,y,material)=>{const geo=new T.RingGeometry(inner,outer,152);geo.rotateX(-Math.PI/2);return add(group,geo,material,y)};
 // A gold foot, recessed dark skirt, thick carved shoulder and raised outer lip.
 scene.add(voxelAnnulus(2.86,3.34,.065,()=>-.27,brass,{bottom:-.39}));
 scene.add(voxelAnnulus(2.85,3.27,.065,r=>r>3.19?-.11:r>3.10?.02:r>3.02?.12:r>2.94?.20:.25,darkWood));
 scene.add(voxelAnnulus(2.91,3.18,.055,r=>r>3.12?.12:r>3.03?.21:r>2.97?.27:.29,wood,{bottom:.06}));
 ring(scene,2.88,2.915,.28,brass);ring(scene,2.50,2.88,.20,darkWood);
 // Pockets remain at the original height/radius so the existing ball motion stays exact.
 add(rotor,new T.CylinderGeometry(2.51,2.51,.11,76),darkWood,.035);
 rotor.add(voxelAnnulus(0,1.635,.057,r=>.12+Math.floor(Math.max(0,1-r/1.635)*15)*.034,wood,{bottom:.08}));
 for(let i=0;i<38;i++){
  const n=WHEEL[i],a=i*STEP;const enamel=new T.MeshStandardMaterial({color:{red:0xb22b24,black:0x151512,green:0x246c3a}[color(n)],roughness:.42,metalness:.06});
  const sector=new T.RingGeometry(1.65,2.48,4,1,a-Math.PI/2-STEP/2+.008,STEP-.016);sector.rotateX(-Math.PI/2);const face=add(rotor,sector,enamel,.10);face.userData.pocket=n;
  const wall=add(rotor,new T.BoxGeometry(.024,.11,.47),ivory,.154);wall.position.set(Math.sin(a+STEP/2)*1.90,.154,Math.cos(a+STEP/2)*1.90);wall.rotation.y=a+STEP/2;
  const numberDivider=add(rotor,new T.BoxGeometry(.019,.016,.33),ivory,.119);numberDivider.position.set(Math.sin(a+STEP/2)*2.305,.119,Math.cos(a+STEP/2)*2.305);numberDivider.rotation.y=a+STEP/2;
  const label=add(rotor,new T.PlaneGeometry(.31,.32),new T.MeshBasicMaterial({map:makeNumber(n),transparent:true,depthWrite:false}),.121);label.rotation.set(-Math.PI/2,0,-a);label.position.set(Math.sin(a)*2.305,.121,Math.cos(a)*2.305);label.castShadow=false;
 }
 for(const [a,b,y] of [[1.625,1.665,.143],[2.125,2.155,.133],[2.475,2.5,.13]])ring(rotor,a,b,y,ivory);
 // The central finial is built from square collars and a faceted stem.
 for(const [r,h,y,c] of [[.43,.10,.66,brass],[.31,.13,.775,darkWood],[.23,.16,.91,brass],[.14,.25,1.035,brass],[.22,.09,1.16,ivory],[.12,.10,1.25,brass]])add(rotor,new T.CylinderGeometry(r,r,h,8),c,y);
 for(const angle of [0,Math.PI/3,Math.PI*2/3]){const arm=add(rotor,new T.BoxGeometry(1.3,.065,.09),brass,.96);arm.rotation.y=angle;arm.userData.gantryArm=true;for(const side of [-1,1]){const end=add(rotor,new T.BoxGeometry(.13,.11,.13),brass,.96);end.position.set(Math.cos(angle)*side*.66,.96,Math.sin(angle)*side*.66)}}
 const ball=add(scene,new T.SphereGeometry(.075,8,6),new T.MeshStandardMaterial({color:0xfff4d6,roughness:.23,metalness:.02}));return {ball};
}
