import fs from 'node:fs';import {Poker} from '../dist/poker.mjs';import {decide} from '../tests/fixtures/poker-strategy-v127.mjs';import {handFeatures} from '../dist/poker-range.mjs';
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
const exact={},coarse={},global={},sizes={},coarseSizes={},globalSizes={},contexts={},styleExact={},styleCoarse={},styleGlobal={},styleSizes={},styleCoarseSizes={},styleGlobalSizes={};const n=Number(process.argv[2]??6000),late=Number(process.argv[3]??18000);let observations=0;
function add(map,key,a){map[key]??=[0,0,0];map[key][a]++}
function record(g,random,profile){const s=g.snapshot(g.turn),d=decide(s,profile,{samples:60,rng:random}),a=d.action==='fold'?0:d.action==='raise'?2:1,f=handFeatures(s.hole,s.board),price=s.legal.call,pot=s.pot,order=i=>(i-s.dealer-1+s.players.length)%s.players.length,pos=s.street===0?s.seat===s.dealer:order(s.seat)>order(1-s.seat),raises=Math.min(2,s.actions.filter(x=>x.street===s.street&&x.kind==='raise').length);
 const bucket=Math.min(7,Math.floor(f.strength*8)),owed=price>0?1:0,odds=Math.min(4,Math.floor(price/Math.max(1,pot+price)*10)),draw=f.draw>0?1:0;
 const keys=[[s.street,owed,bucket,odds,pos?1:0,draw,raises].join(':'),[s.street,owed,bucket,raises].join(':'),[s.street,owed,raises].join(':')];
 [exact,coarse,global].forEach((m,i)=>add(m,keys[i],a));[styleExact,styleCoarse,styleGlobal].forEach((m,i)=>add(m,profile+':'+keys[i],a));if(a===2){const fraction=(d.target-s.current)/Math.max(1,pot+price),size=fraction<=.65?0:fraction<=1.2?1:2;[sizes,coarseSizes,globalSizes].forEach((m,i)=>add(m,keys[i],size));[styleSizes,styleCoarseSizes,styleGlobalSizes].forEach((m,i)=>add(m,profile+':'+keys[i],size))}
 contexts[s.street+':'+raises]??=0;contexts[s.street+':'+raises]++;observations++;return d;
}
for(let seed=1;seed<=n;seed++){const g=new Poker([2000,2000],{dealer:seed%2,rng:rng(seed*3571+911)}),random=rng(seed*13+57);while(!g.done){if(!g.pending.size){g.advance();continue}const d=record(g,random,seed%9);g.act(g.turn,d.action,d.target)}if(seed%2000===0)console.log(JSON.stringify({naturalHands:seed,observations}))}
// Supplemental decision positions are created by LEGAL forced actions, not
// conditional on future cards. Acting policy sees only its own normal snapshot.
for(let seed=1;seed<=late;seed++){const random=rng(seed*193+17011),stack=[400,1200,2000,4000][seed%4],g=new Poker([stack,stack],{dealer:seed%2,rng:rng(seed*1237+791117)}),targetStreet=seed%2?2:3;
 while(!g.done&&g.street<targetStreet){while(g.pending.size){const l=g.legal();if(g.street===0&&g.current===g.bigBlind&&l.canRaise)g.act(g.turn,'raise',Math.min(l.max,Math.max(l.min,60)));else if(g.street>0&&g.current===0&&seed%3!==0&&l.canRaise){const to=Math.min(l.max,Math.max(l.min,Math.round(g.pot*[.33,.75,1.25][seed%3])));g.act(g.turn,'raise',to)}else g.act(g.turn,l.owe?'call':'check')}g.advance()}
 if(g.done||!g.pending.size)continue;
 // Cover checks, facing bets, and facing reraises without selecting good cards.
 const pressure=seed%3;if(pressure>0&&g.legal().canRaise){const l=g.legal();g.act(g.turn,'raise',Math.min(l.max,Math.max(l.min,Math.round(g.pot*[.33,.66,1.25,1.75][Math.floor(seed/3)%4]))));if(pressure===2&&g.pending.size&&g.legal().canRaise){const q=g.legal();g.act(g.turn,'raise',Math.min(q.max,Math.max(q.min,Math.round(g.current*2.5))))}}
 for(let k=0;k<4&&!g.done&&g.pending.size;k++){const d=record(g,random,(seed+k)%9);g.act(g.turn,d.action,d.target)}if(seed%3000===0)console.log(JSON.stringify({supplementalPositions:seed,observations}))
}
const model={schema:2,trainedHands:n,supplementalPositions:late,observations,contexts,source:'v127 natural games plus legally constructed turn/river candidate positions; only acting bot own hand labels',exact,coarse,global,sizes,coarseSizes,globalSizes,styleExact,styleCoarse,styleGlobal,styleSizes,styleCoarseSizes,styleGlobalSizes};fs.writeFileSync('dist/poker-response-data.mjs','export default '+JSON.stringify(model)+';\n');console.log(JSON.stringify({naturalHands:n,supplementalPositions:late,observations,contexts,bytes:fs.statSync('dist/poker-response-data.mjs').size}));
