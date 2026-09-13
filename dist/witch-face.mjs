import * as T from './vendor/three.module.min.js';
// All expression pixels share one face surface: no intersecting eyelid, pupil or mouth boxes.
export function installWitchFace(table,rig){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const texture=new T.CanvasTexture(canvas);texture.magFilter=T.NearestFilter;texture.minFilter=T.NearestFilter;texture.colorSpace=T.SRGBColorSpace;
 table.textures.set('witch-face-'+table.textures.size,texture);
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:T.FrontSide,toneMapped:false});
 const face=new T.Mesh(new T.PlaneGeometry(.66,.66),material);face.position.set(0,-.015,.351);rig.head.add(face);
 rig.faceArt={canvas,texture,state:''};rig.lids=[];rig.brows=[];
 updateWitchFace(rig,false,0,0);
}
export function updateWitchFace(rig,blink,kind,strength){
 const art=rig.faceArt;if(!art)return;
 const mood=strength>.35?kind:-1,state=String(blink)+':'+mood;
 if(art.state===state)return;art.state=state;
 const c=art.canvas.getContext('2d');c.clearRect(0,0,256,256);
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)};
 for(const x of [64,160]){
 const brow=mood===2?-4:mood===3?2:0;
 rect(x-5,61+brow,41,5,'#8c7586');
 if(blink){rect(x-4,111,41,5,'#422a30');rect(x-9,106,6,6,'#422a30')}
 else{rect(x-5,83,42,47,'#62353d');rect(x+1,89,30,37,'#251a23');rect(x+1,87,13,14,'#fff8ed');rect(x+23,118,7,7,'#e1b8c9');rect(x+5,123,17,4,'#a06980');rect(x-10,83,6,8,'#422a30')}
 rect(x-5,142,24,6,'#d99b87');
 }
 // A small closed smile, with restrained variation and connected corners.
 rect(108,186,40,4,'#754535');rect(103,182,6,5,'#754535');rect(147,182,6,5,'#754535');
 if(mood===2)rect(119,190,18,3,'#754535');
 art.texture.needsUpdate=true;
}
