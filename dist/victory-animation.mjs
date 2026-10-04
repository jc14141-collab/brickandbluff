import * as T from './vendor/three.module.min.js';
const colors=[0xc884ff,0xdde5e7,0x6fe8ff,0xa4ed74];
function glowTexture(table){if(!table.textures.has('victory-soft-glow')){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.7)');g.addColorStop(.6,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,128,128);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;table.textures.set('victory-soft-glow',texture);}return table.textures.get('victory-soft-glow');}
function sprite(table,color){return new T.Sprite(new T.SpriteMaterial({map:glowTexture(table),color,transparent:true,depthWrite:false,toneMapped:false}));}
export function startVictory(table,rig){
 if(rig.victory)return;const role=rig.witch?0:rig.engineer?1:rig.guardian?2:3;
 const weapon=rig.weapon??new T.Group();
 if(!rig.weapon){
  // Collapsible brass spyglass with blue optical glass, held as a celebration prop.
  table.box(weapon,.22,.64,.22,0,.03,0,0x345b6a);table.box(weapon,.18,.25,.18,0,-.36,0,0x728d8e);
  for(const y of [-.26,.28,.38])table.box(weapon,.28,.065,.28,0,y,0,0xd1b56d);
  const lens=new T.Mesh(new T.CylinderGeometry(.105,.105,.028,12),new T.MeshBasicMaterial({color:0x7be9ff,toneMapped:false}));lens.position.y=.421;weapon.add(lens);rig.group.add(weapon);weapon.visible=false;rig.weapon=weapon;
 }
 const original={parent:weapon.parent,position:weapon.position.clone(),rotation:weapon.rotation.clone(),scale:weapon.scale.clone(),visible:weapon.visible};rig.arms[0].add(weapon);weapon.visible=true;
 weapon.position.set(0,role===0?-.62:role===1?-.45:-.16,.70);if(role===0)weapon.scale.multiply(new T.Vector3(.85,.55,.85));weapon.rotation.set(.95,0,role===3?-.22:-.1);
 const glow=new T.Group();rig.group.add(glow);let halo,particles,steam=[];
 const light=new T.PointLight(role===1?0xffbd72:colors[role],0,4.8,2);light.castShadow=false;
 const aura=sprite(table,role===1?0xffc17a:colors[role]);aura.position.set(0,1.35,-.38);aura.scale.set(2.5,2.9,1);glow.add(aura);
 if(role===0||role===2){light.position.set(0,role===0?2.43:.44,.14);weapon.add(light)}else{light.position.set(0,1.6,.42);glow.add(light)}
 if(role===0||role===2){halo=sprite(table,colors[role]);halo.position.set(0,role===0?2.43:.44,0);halo.scale.setScalar(role===0?.85:.55);weapon.add(halo);}
 if(role===1){for(let n=0;n<14;n++){const cloud=sprite(table,0xd5dfe1);glow.add(cloud);steam.push(cloud)}}else{
  const material=new T.MeshBasicMaterial({color:colors[role],transparent:true,opacity:.8,depthWrite:false,toneMapped:false});particles=new T.InstancedMesh(table.boxGeo,material,role===3?36:20);particles.frustumCulled=false;weapon.add(particles);
 }
 rig.victory={start:table.elapsed,role,original,weapon,glow,halo,particles,steam,light,aura,baseY:rig.baseY,arm0:rig.arms[0].rotation.clone(),arm1:rig.arms[1].rotation.clone()};
}
export function updateVictory(table,rig,time){
 const v=rig.victory;if(!v)return false;const p=(time-v.start)/3.8;
 if(p>=1){v.light.removeFromParent();v.halo&&table.disposeGroup(v.halo);v.particles&&table.disposeGroup(v.particles);v.original.parent.add(v.weapon);v.weapon.position.copy(v.original.position);v.weapon.rotation.copy(v.original.rotation);v.weapon.scale.copy(v.original.scale);v.weapon.visible=v.original.visible;rig.group.position.y=v.baseY;rig.group.rotation.x=0;rig.chair.position.y=0;rig.arms[0].rotation.copy(v.arm0);rig.arms[1].rotation.copy(v.arm1);table.disposeGroup(v.glow);rig.victory=null;return false;}
 const lift=T.MathUtils.smoothstep(p,0,.22)*(1-T.MathUtils.smoothstep(p,.80,1)),wave=Math.sin(Math.max(0,p-.2)*Math.PI*5)*lift;
 // The torso, chair and seated legs stay in their existing positions throughout.
 rig.group.position.y=v.baseY;rig.group.rotation.x=0;rig.chair.position.y=0;
 rig.head.rotation.set(-.015*lift,.035*wave,-.025*wave);rig.head.position.y=1.16;rig.lids.forEach(l=>l.visible=false);
 rig.arms[0].rotation.set(-1.12*lift,0,.20*lift+.13*wave);rig.arms[1].rotation.set(-1.02*lift,0,-.27*lift-.12*wave);
 v.weapon.rotation.x=1.04*lift;v.weapon.rotation.z=-.12+.23*wave;
 v.light.intensity=lift*(v.role===1?3.0:4.5)*(1+Math.sin(p*12)*.06);v.aura.material.opacity=lift*(v.role===1?.22:.30);
 if(v.halo){v.halo.material.opacity=lift*(.94+Math.sin(p*18)*.06);v.halo.scale.setScalar((v.role===0?1.65:1.22)*(1+Math.sin(p*12)*.06));}
 for(let n=0;n<v.steam.length;n++){const cloud=v.steam[n],q=(p*2.3+n/v.steam.length)%1;cloud.position.set((n%2?1:-1)*(.58+q*.23)+Math.sin(n+p*4)*.06,1.04+q*1.65,-.57);cloud.scale.setScalar(.36+q*.68);cloud.material.opacity=lift*(1-q)*.90;}
 if(v.particles){const temp=new T.Object3D();for(let n=0;n<v.particles.count;n++){const a=n/v.particles.count*Math.PI*2+p*2.4,r=.24+(n%3)*.10;temp.position.set(Math.cos(a)*r,(v.role===0?2.43:v.role===2?.44:.18)+Math.sin(a)*.34,Math.sin(a*.8)*.28);temp.rotation.set(a,p*2,a);temp.scale.setScalar((.034+(n%3)*.012)*lift);temp.updateMatrix();v.particles.setMatrixAt(n,temp.matrix);}v.particles.instanceMatrix.needsUpdate=true;v.particles.material.opacity=lift*.96;}
 return true;
}
