import {warmSource} from './voxel-art.mjs';
import * as T from './vendor/three.module.min.js';
import {PokerTavern} from './poker-tavern.mjs';
import {ROULETTE_TABLE,drawRouletteCloth} from './roulette-table-scene.mjs';

// Scene decoration is separate from the authoritative wheel and ball trajectory.
export function decorateRouletteAtmosphere(scene,camera,wood){
 const root=new T.Group();scene.add(root);scene.add(camera);
 const geometries=new Map(),materials=new Map();
 const material=(c,timber=false)=>{const key=c+':'+timber;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color:c,map:timber?wood:null,bumpMap:timber?wood:null,bumpScale:.012,roughness:timber?.46:.8,metalness:0}));return materials.get(key)};
 const block=(parent,x,y,z,w,h,d,c,timber=false)=>{if(!geometries.has('box'))geometries.set('box',new T.BoxGeometry(1,1,1));const o=new T.Mesh(geometries.get('box'),material(c,timber));o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);return o};
 const clothCanvas=drawRouletteCloth(document.createElement('canvas')),bettingTexture=new T.CanvasTexture(clothCanvas);bettingTexture.colorSpace=T.SRGBColorSpace;bettingTexture.anisotropy=4;
 // Redraw once the pixel face is available so the cloth matches the rest of the interface.
 document.fonts?.load?.('48px "Fusion Pixel"').then(()=>{drawRouletteCloth(clothCanvas);bettingTexture.needsUpdate=true}).catch(()=>{});
 const panel=new T.Mesh(new T.PlaneGeometry(ROULETTE_TABLE.clothWidth,ROULETTE_TABLE.clothDepth),new T.MeshStandardMaterial({map:bettingTexture,roughness:.98,metalness:0}));panel.rotation.x=-Math.PI/2;panel.position.set(ROULETTE_TABLE.clothX,-.317,0);root.add(panel);
 const factory=Object.assign(Object.create(PokerTavern.prototype),{boxGeo:new T.BoxGeometry(1,1,1),materials:new Map(),textures:new Map(),renderer:{capabilities:{getMaxAnisotropy:()=>4}}});
 factory.castIndex=1;const dealer=factory.avatar(7789);dealer.group.position.set(-.25,-.42,-4.78);dealer.group.scale.setScalar(.92);standAtRail(dealer,factory);root.add(dealer.group);
 const patrons=[];for(let i=0;i<3;i++){const rig=factory.avatar(417+i*313);rig.group.position.set(1.8+i*3.2,.85,-7);rig.group.scale.setScalar(.58);root.add(rig.group);patrons.push(rig)}
 for(const side of[-1,1]){const barrel=new T.Group();barrel.position.set(side*6.6,-.9,-5.7);root.add(barrel);for(let i=0;i<12;i++){const a=i*Math.PI/6;const stave=block(barrel,Math.sin(a)*.48,.15,Math.cos(a)*.48,.24,1.1,.13,0x79522d,true);stave.rotation.y=a}for(const y of[-.24,.55]){const band=new T.Mesh(new T.CylinderGeometry(.55,.55,.10,12,1,true),material(0x33302a));band.position.y=y;barrel.add(band)}block(barrel,0,.72,0,.8,.06,.8,0x805b36,true)}
 const candles=[];for(let i=0;i<10;i++){const x=.5+i*1.25;block(root,x,1.11,-6.1,.065,.28,.065,0xe5cca0);const flame=block(root,x,1.32,-6.1,.06,.12,.06,0xffd885);flame.material=new T.MeshStandardMaterial({color:0xffefb8,emissive:0xffb740,emissiveIntensity:1.8});candles.push(flame);warmSource(root,flame.position,{power:0,range:1.5})}
 const hands=new T.Group();hands.position.set(-.73,-.66,-1.8);hands.scale.setScalar(.5);hands.visible=false;camera.add(hands);block(hands,0,0,.10,.47,.3,.65,0xd0a079);block(hands,0,-.11,.55,.51,.32,.55,0x378e92);for(let i=0;i<4;i++)block(hands,-.16+i*.105,.1,-.20,.095,.18,.3,0xdcb083);for(let i=0;i<5;i++){const chip=new T.Mesh(new T.CylinderGeometry(.17,.17,.065,12),material([0xae493d,0x446998,0x538451,0x785135][i%4]));chip.position.set(.02,.21+i*.065,-.1);hands.add(chip);for(const side of[-1,1])block(hands,.02+side*.12,.246+i*.065,-.1,.055,.008,.07,0xe6d3a6)}
 const dustPositions=new Float32Array(160*3);for(let i=0;i<160;i++){dustPositions[i*3]=Math.sin(i*127.1)*7;dustPositions[i*3+1]=1.7+(i%23)/7;dustPositions[i*3+2]=-4.5-Math.abs(Math.cos(i*31.7))*3}const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:0xffd693,size:.022,transparent:true,opacity:.28,depthWrite:false}));root.add(dust);
 root.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=true}});hands.traverse(o=>{o.castShadow=false;o.userData.noShadow=true});
 return {dealer,patrons,hands,update(now){dealer.head.rotation.y=Math.sin(now/3700)*.045;for(const [i,r]of patrons.entries())r.head.rotation.y=Math.sin(now/2900+i)*.08;for(const [i,f]of candles.entries())f.material.emissiveIntensity=1.7+Math.sin(now/350+i)*.15;dust.position.y=Math.sin(now/7000)*.12;hands.rotation.z=Math.sin(now/2700)*.025},dispose(){hands.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});for(const t of factory.textures.values())t.dispose();bettingTexture.dispose()}};
}

export function standAtRail(rig,factory){const g=rig.group,chair=g.children.find(o=>o.isGroup&&o!==rig.head&&!rig.arms.includes(o));chair?.removeFromParent();for(const o of [...g.children])if(o.isMesh&&o.position.y<.1)o.removeFromParent();for(const side of[-1,1])factory.box(g,.32,.95,.33,side*.25,-.45,-.1,0x283633);rig.head.rotation.x=.045;rig.arms.forEach(a=>{a.rotation.x=-.16});g.rotation.x=.045;g.userData.standing=true;return rig}
