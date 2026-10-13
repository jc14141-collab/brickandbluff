import {color} from './roulette.mjs';

// Physical composition only; authoritative launch, cutoff and settlement remain unchanged.
// Wide enough that the wheel's bowl clears the padded rail on every side (bowl radius ~3.35).
export const ROULETTE_TABLE={left:-4.4,right:14.45,depth:8,center:5.025,clothX:8.9,clothWidth:10.7,clothDepth:6.6};
// Seats sit back from the rail so each player's forearms rest flat on the padded armrest.
export const ROULETTE_SEATS=[
 {x:4.8,z:-4.96,rotation:0},{x:7.7,z:-4.96,rotation:0},
 {x:10.6,z:-4.96,rotation:0},{x:13.35,z:-4.96,rotation:0},
 {x:13.35,z:4.96,rotation:Math.PI},{x:10.4,z:4.96,rotation:Math.PI},
 {x:7.45,z:4.96,rotation:Math.PI}
];
// Betting view from behind the wheel (the dealer's end), high above the table, looking down its
// length: the wheel in the foreground, the cloth and the players beyond, the foot wall at the back.
// Wide strips (tablet portrait) cannot fit the length, so they come lower and closer to the wheel.
export function bettingView(aspect){
 const t=Math.max(0,Math.min(1,(Math.max(.3,aspect)-1.8)/1.1)),mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*t);
 return{position:mix([-8.4,11.2,-.25],[-6.2,6.4,-.2]),target:mix([5.8,-.6,-.05],[4.2,-.6,-.05])};
}
// Spin: the camera moves from the betting view to the wheel close-up for the close-up and returns afterwards.
export function rouletteCameraPose(g,now,aspect=16/9){
 const entering=g.closeAt===null?0:Math.max(0,Math.min(1,(now-g.closeAt)/2400));
 const returning=now<g.endAt?1:Math.max(0,1-(now-g.endAt)/1000);
 const blend=entering*returning,ease=blend*blend*(3-2*blend);
 const fit=Math.min(2.5,Math.max(1,1.9/Math.max(.3,aspect))),seat=bettingView(aspect);
 const near=[0,Math.sin(.94)*9.2*fit,Math.cos(.94)*9.2*fit],nearTarget=[0,0,0];
 return {position:seat.position.map((v,i)=>v+(near[i]-v)*ease),target:seat.target.map((v,i)=>v+(nearTarget[i]-v)*ease),close:ease};
}
// The cloth uses the game's pixel face once it has loaded (callers redraw then); until then a
// bold monospace keeps the same blocky look. Red / black are printed as diamonds, as on a real layout.
export const CLOTH_FONT='"Fusion Pixel", ui-monospace, "Courier New", monospace';
export function drawRouletteCloth(canvas,{font=CLOTH_FONT}={}){
 canvas.width=1792;canvas.height=1024;const x=canvas.getContext('2d');
 x.fillStyle='#174b34';x.fillRect(0,0,1792,1024);
 // Woven texture is deliberately subtle so the numbers remain legible at grazing angles.
 for(let y=0;y<1024;y+=4){x.fillStyle=y%8?'#ffffff03':'#00000008';x.fillRect(0,y,1792,1)}
 const glow=x.createRadialGradient?.(896,470,80,896,470,900);if(glow){glow.addColorStop(0,'#ffffff10');glow.addColorStop(1,'#00000030');x.fillStyle=glow;x.fillRect(0,0,1792,1024)}
 x.strokeStyle='#c9aa62';x.lineWidth=5;x.strokeRect(22,22,1748,980);x.lineWidth=2;x.strokeRect(34,34,1724,956);
 const text=(label,px,py,size,color='#fff0c8')=>{x.fillStyle=color;x.font=size+'px '+font;x.fillText(label,px,py)};
 x.textAlign='center';x.textBaseline='middle';text('AMERICAN  ROULETTE  ·  0 / 00',896,96,34,'#dbc27f');
 const gx=192,gy=174,cw=119,ch=158;
 const cell=(px,py,w,h,label,fill='#174b34',size=60,color)=>{x.fillStyle=fill;x.fillRect(px,py,w,h);
  if(fill!=='#174b34'){x.fillStyle='#ffffff14';x.fillRect(px+6,py+6,w-12,6);x.fillStyle='#00000030';x.fillRect(px+6,py+h-12,w-12,6)}
  x.strokeStyle='#d4b566';x.lineWidth=4;x.strokeRect(px,py,w,h);if(label)text(label,px+w/2,py+h/2+2,size,color)};
 const diamond=(cx,cy,r,fill)=>{x.beginPath();x.moveTo(cx,cy-r);x.lineTo(cx+r*1.5,cy);x.lineTo(cx,cy+r);x.lineTo(cx-r*1.5,cy);x.closePath();x.fillStyle=fill;x.fill();x.strokeStyle='#e8d29a';x.lineWidth=4;x.stroke()};
 cell(54,gy,138,ch*1.5,'00','#1e6c43',62);cell(54,gy+ch*1.5,138,ch*1.5,'0','#1e6c43',66);
 for(let col=0;col<12;col++)for(let row=0;row<3;row++){const n=col*3+3-row;cell(gx+col*cw,gy+row*ch,cw,ch,String(n),color(String(n))==='red'?'#a6322d':'#17251e',64)}
 for(let row=0;row<3;row++)cell(gx+12*cw,gy+row*ch,108,ch,'2 TO 1','#174b34',26,'#dbc27f');
 for(let i=0;i<3;i++)cell(gx+i*cw*4,gy+3*ch,cw*4,130,['1ST 12','2ND 12','3RD 12'][i],'#174b34',44,'#dbc27f');
 const labels=['1 - 18','EVEN','','','ODD','19 - 36'];
 for(let i=0;i<6;i++){const px=gx+i*cw*2,py=gy+3*ch+130;cell(px,py,cw*2,132,labels[i],'#174b34',38,'#dbc27f');if(i===2||i===3)diamond(px+cw,py+66,34,i===2?'#b8332e':'#121a15')}
 // Small stepped corner ornaments frame the cloth without introducing dead table space.
 for(const px of [60,1732])for(const py of [60,964]){x.save();x.translate(px,py);x.rotate(Math.PI/4);x.strokeStyle='#c9aa62';x.lineWidth=3;x.strokeRect(-9,-9,18,18);x.restore()}
 return canvas;
}
