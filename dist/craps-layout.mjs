// One coordinate system for the interactive overhead felt and the physical 3D table.
export const FELT_WIDTH=1000,FELT_HEIGHT=500;
export const CRAPS_TIMING=Object.freeze({bet:15000,throw:4600,hold:3000});
export const SEAT_COLORS=['#e85d4c','#568ddd','#74b976','#d4aa59','#a887d5','#5cc7bb','#da87ae','#ddd6ab'];
const cells=[];
const cell=(key,label,detail,x,y,w,h,kind='line')=>cells.push({key,label,detail,x,y,w,h,kind});
for(const side of [0,1]){
 const x=side?615:65;
 cell('dcome',"DON'T COME",'BAR 12 · 1:1',x,57,320,36);
 [4,5,6,8,9,10].forEach((n,i)=>cell('p'+n,n===6?'SIX':n===9?'NINE':String(n),[4,10].includes(n)?'9:5':[5,9].includes(n)?'7:5':'7:6',x+i*320/6,93,320/6,79,'point'));
 cell('come','COME','1:1',x,172,320,77,'come');
 cell('field','FIELD','2 · 3 · 4 · 9 · 10 · 11 · 12',x,249,320,84,'field');
 cell('dont',"DON'T PASS",'BAR 12 · 1:1',x,333,320,43);
 cell('pass','PASS LINE','1:1',x,376,320,49);
 cell('big6','BIG 6','1:1',x,425,160,38,'big');
 cell('big8','BIG 8','1:1',x+160,425,160,38,'big');
 cell('pass','PASS LINE','1:1',side?941:25,93,34,332,'vertical');
}
[4,6,8,10].forEach((n,i)=>cell('h'+n,'HARD '+n,`${n/2} + ${n/2} · ${[6,8].includes(n)?9:7}:1`,410+i%2*90,139+Math.floor(i/2)*59,90,59,'hard'));
[['any7','ANY 7','4:1'],['craps','ANY CRAPS','7:1'],['r2','2 · SNAKE EYES','30:1'],['r3','3 · ACE DEUCE','15:1'],['r11','11 · YO','15:1'],['r12','12 · BOXCARS','30:1']].forEach(([k,l,d],i)=>cell(k,l,d,410+i%2*90,291+Math.floor(i/2)*54,90,54,'prop'));
export const BET_CELLS=Object.freeze(cells.map(c=>Object.freeze(c)));
export const FELT_CAPTIONS=[{label:'THE EMBER TAVERN · CRAPS',x:500,y:32,size:12},{label:'HARDWAYS',x:500,y:124,size:13},{label:'PROPOSITION BETS',x:500,y:275,size:10}];
export const primaryCell=k=>BET_CELLS.find(c=>c.key===k&&c.kind!=='vertical');
export const feltToWorld=(x,y)=>({x:(x/1000-.5)*13.2,z:(y/500-.5)*6.6});
export function wagerTotal(player,key){return (player.bets?.[key]??0)+(key[0]==='p'?(player.travel?.['c'+key.slice(1)]??0)+(player.travel?.['d'+key.slice(1)]??0):0)}

// Text and dice symbols are generated, not baked illustrations, so every line matches the UI.
export function drawCrapsFelt(canvas){
 canvas.width=2000;canvas.height=1000;const x=canvas.getContext('2d');x.scale(2,2);
 x.fillStyle='#20512b';x.fillRect(0,0,1000,500);
 let seed=714;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let y=0;y<500;y+=3)for(let i=0;i<1000;i+=3){x.fillStyle=random()>.5?'#72974b16':'#061f1618';x.fillRect(i,y,3,3)}
 x.strokeStyle='#d4bf70';x.lineWidth=1.4;x.strokeRect(17,48,966,423);
 x.textAlign='center';x.textBaseline='middle';
 const text=(s,xx,yy,size,color='#ead186',maxWidth)=>{x.fillStyle=color;x.font=`bold ${size}px monospace`;x.fillText(s,xx,yy,maxWidth)};
 for(const c of BET_CELLS){x.strokeStyle='#d4bf70';x.strokeRect(c.x,c.y,c.w,c.h);x.save();
  let cx=c.x+c.w/2,cy=c.y+c.h/2;if(c.kind==='vertical'){x.translate(cx,cy);x.rotate(-Math.PI/2);cx=cy=0;text(c.label,0,0,15);x.restore();continue}
  const size=c.kind==='point'?23:c.kind==='come'?30:c.kind==='field'?21:c.kind==='hard'?13:c.kind==='prop'?9:c.kind==='big'?14:18;
  text(c.label,cx,cy-(c.kind==='hard'?17:6),size,c.kind==='come'||c.kind==='big'?'#c6432d':'#ead186',c.w-6);
  text(c.detail,cx,cy+(c.kind==='hard'?0:size*.7), c.kind==='prop'||c.kind==='hard'?9:c.kind==='point'?9:11,'#d7ca92',c.w-6);
  if(c.kind==='hard'){const n=Number(c.key.slice(1))/2,patterns={2:[[0,0],[2,2]],3:[[0,0],[1,1],[2,2]],4:[[0,0],[2,0],[0,2],[2,2]],5:[[0,0],[2,0],[1,1],[0,2],[2,2]]};for(const side of [-1,1]){const dx=cx+side*9-7,dy=cy+9;x.fillStyle='#a1251a';x.fillRect(dx,dy,14,14);x.fillStyle='#f6e1ae';for(const [a,b]of patterns[n])x.fillRect(dx+2+a*4,dy+2+b*4,2,2)}}
  x.restore();
 }
 for(const c of FELT_CAPTIONS)text(c.label,c.x,c.y,c.size);
 return canvas;
}
