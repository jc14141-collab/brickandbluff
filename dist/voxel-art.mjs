import * as T from './vendor/three.module.min.js';
export function warmSource(parent,position,{power=1.5,range=1.7,shaft=false}={}){
 const light=power>0?new T.PointLight(0xff9933,power,range,2):null;if(light){light.position.copy(position);light.userData.voxelSource=true;parent.add(light)}
 const glow=new T.Mesh(new T.PlaneGeometry(.3,.4),new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;void main(){float a=pow(max(0.,1.-length((v-.5)*2.)),2.)*.28;gl_FragColor=vec4(1.,.38,.08,a);}'}));glow.position.copy(position);glow.position.z+=.025;glow.userData.noShadow=true;parent.add(glow);
 if(shaft){const cone=new T.Mesh(new T.ConeGeometry(.65,2.1,8,1,true),new T.MeshBasicMaterial({color:0xffb75b,transparent:true,opacity:.025,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));cone.position.copy(position);cone.position.y-=1.08;cone.userData.noShadow=true;parent.add(cone)}
 return light;
}
// Distant bottles use opaque emissive shading: transmission would re-render the scene.
export function gemMaterial(color){return new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.48,roughness:.28,metalness:.12})}
export function finishSources(factory){const room=factory.roomArchitecture;
 // Existing four room lights provide illumination. All candle halos share one draw.
 const pixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const a=Math.max(0,1-Math.hypot((x-7.5)/8,(y-7.5)/8));pixels.set([255,153,51,Math.round(a*a*60)],(y*16+x)*4)}
 const map=new T.DataTexture(pixels,16,16);map.needsUpdate=true;map.colorSpace=T.SRGBColorSpace;factory.textures.set('candle-halo',map);
 const halos=new T.InstancedMesh(new T.PlaneGeometry(.3,.4),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}),factory.torchFlames.length);
 for(const [i,f]of factory.torchFlames.entries())halos.setMatrixAt(i,new T.Matrix4().makeTranslation(f.position.x,f.position.y,f.position.z+.025));halos.instanceMatrix.needsUpdate=true;halos.userData.noShadow=true;halos.userData.candleHalos=true;room.add(halos);
 const points=new Float32Array(90*3);for(let i=0;i<90;i++){points[i*3]=Math.sin(i*13.71)*6;points[i*3+1]=1.8+(i%17)*.16;points[i*3+2]=-5.8+Math.sin(i*5.13)*.55}const dust=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(points,3)),new T.PointsMaterial({color:0xffc677,size:.022,transparent:true,opacity:.3,depthWrite:false}));dust.userData.noShadow=true;room.add(dust);factory.voxelDust=dust;
}
export function grainTexture(kind,anisotropy=4){
 if(kind==='paper'){const pixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,v=y%3===0?202:238;pixels.set([v,v-3,v-12,255],i)}const t=new T.DataTexture(pixels,32,32);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;t.needsUpdate=true;return t}
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');let seed=419;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let y=0;y<32;y++)for(let n=0;n<32;n++){const plank=Math.floor(y/8),seam=y%8===0,grain=Math.sin(n*.7+Math.sin(y*.9)*2),v=kind==='wood'?(seam?70:145+plank*6+grain*20+rand()*22):kind==='felt'?172+rand()*32:kind==='paper'?218+rand()*22:196+rand()*28;x.fillStyle=`rgb(${v|0},${v|0},${v|0})`;x.fillRect(n*8,y*8,8,8)}
 if(kind==='wood'){for(let y=0;y<256;y+=64){x.fillStyle='#c7c7c7';x.fillRect(0,y+8,256,2);x.fillStyle='#636363';x.fillRect((y/64%2)*128,y,3,64)}for(let n=0;n<60;n++){x.fillStyle=n%2?'#797979':'#c0c0c0';x.fillRect((rand()*30|0)*8,(rand()*32|0)*8,16+(rand()*5|0)*8,2)}}
 if(kind==='felt'){for(let y=0;y<256;y+=3)for(let n=0;n<256;n+=3){x.fillStyle=(n+y)%2?'#bebebe':'#909090';x.fillRect(n,y,2,1)}}
 if(kind==='paper'){for(let y=0;y<256;y+=6){x.fillStyle=y%12?'#ccc6b2':'#efeada';x.fillRect(0,y,256,1)}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;t.anisotropy=anisotropy;return t;
}

export function renderPixelRatio(dpr=1,width=1280,height=720){return Math.min(dpr,1.5,Math.sqrt(1800000/Math.max(1,width*height)))}
