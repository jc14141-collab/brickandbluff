import {color} from './roulette.mjs';

// Physical composition only; authoritative launch, cutoff and settlement remain unchanged.
export const ROULETTE_TABLE={left:-3.75,right:14.45,depth:7.3,center:5.35,clothX:8.9,clothWidth:10.7,clothDepth:6.6};
export const ROULETTE_SEATS=[
 {x:4.8,z:-4.15,rotation:0},{x:7.7,z:-4.15,rotation:0},
 {x:10.6,z:-4.15,rotation:0},{x:13.35,z:-4.15,rotation:0},
 {x:13.35,z:4.15,rotation:Math.PI},{x:10.4,z:4.15,rotation:Math.PI},
 {x:7.45,z:4.15,rotation:Math.PI}
];
export function rouletteCameraPose(g,now,aspect=16/9){
 const entering=g.closeAt===null?0:Math.max(0,Math.min(1,(now-g.closeAt)/2400));
 const returning=now<g.endAt?1:Math.max(0,1-(now-g.endAt)/1000);
 const blend=entering*returning,ease=blend*blend*(3-2*blend);
 const fit=Math.min(2.5,Math.max(1,1.9/Math.max(.3,aspect)));
 const overview=[5.35,9.65*fit,12.8*fit],near=[0,Math.sin(.94)*9.2*fit,Math.cos(.94)*9.2*fit];
 return {position:overview.map((v,i)=>v+(near[i]-v)*ease),target:[5.35*(1-ease),.85*(1-ease),0],close:ease};
}
export function drawRouletteCloth(canvas){
 canvas.width=1792;canvas.height=1024;const x=canvas.getContext('2d');
 x.fillStyle='#174b34';x.fillRect(0,0,1792,1024);
 // Woven texture is deliberately subtle so the numbers remain legible at grazing angles.
 for(let y=0;y<1024;y+=4){x.fillStyle=y%8?'#ffffff03':'#00000008';x.fillRect(0,y,1792,1)}
 x.strokeStyle='#c9aa62';x.lineWidth=5;x.strokeRect(22,22,1748,980);x.lineWidth=2;x.strokeRect(34,34,1724,956);
 x.fillStyle='#dbc27f';x.textAlign='center';x.textBaseline='middle';x.font='bold 28px Georgia';x.fillText('AMERICAN ROULETTE',896,90);
 const gx=192,gy=174,cw=119,ch=158;
 const cell=(px,py,w,h,label,fill='#174b34',size=64)=>{x.fillStyle=fill;x.fillRect(px,py,w,h);x.strokeStyle='#d4b566';x.lineWidth=4;x.strokeRect(px,py,w,h);x.fillStyle='#fff0c8';x.font='bold '+size+'px Georgia';x.fillText(label,px+w/2,py+h/2)};
 cell(54,gy,138,ch*1.5,'00','#1e6c43',60);cell(54,gy+ch*1.5,138,ch*1.5,'0','#1e6c43',64);
 for(let col=0;col<12;col++)for(let row=0;row<3;row++){const n=col*3+3-row;cell(gx+col*cw,gy+row*ch,cw,ch,String(n),color(String(n))==='red'?'#a6322d':'#17251e',68)}
 for(let row=0;row<3;row++)cell(gx+12*cw,gy+row*ch,108,ch,'2:1','#174b34',35);
 for(let i=0;i<3;i++)cell(gx+i*cw*4,gy+3*ch,cw*4,130,['1st 12','2nd 12','3rd 12'][i],'#174b34',43);
 const labels=['1 to 18','EVEN','RED','BLACK','ODD','19 to 36'];
 for(let i=0;i<6;i++){const px=gx+i*cw*2,py=gy+3*ch+130;cell(px,py,cw*2,132,labels[i],i===2?'#a6322d':i===3?'#17251e':'#174b34',36)}
 // Small stepped corner ornaments frame the cloth without introducing dead table space.
 for(const px of [60,1732])for(const py of [60,964]){x.save();x.translate(px,py);x.rotate(Math.PI/4);x.strokeStyle='#c9aa62';x.lineWidth=3;x.strokeRect(-9,-9,18,18);x.restore()}
 return canvas;
}
