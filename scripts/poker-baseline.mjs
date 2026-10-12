// Production baseline manifest for the poker bots. Re-run before any strategy change:
//   node scripts/poker-baseline.mjs            -> prints the manifest and exits 1 on any violation
//   node scripts/poker-baseline.mjs --write    -> also writes docs/poker-baseline.json
// It records file hashes, every production call site of decide() with its options, checks
// that no production entry imports the lab code, and checks that the production strategy
// still makes exactly the same decisions as the frozen v127 control on fixed seeds.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Poker} from '../dist/poker.mjs';
import {decide} from '../dist/strategy.mjs';
import {decide as v127} from '../tests/fixtures/poker-strategy-v127.mjs';
const root=new URL('..',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex').slice(0,16);
const files=['dist/strategy.mjs','dist/engine.mjs','dist/poker.mjs','dist/ai-worker.mjs','dist/app.mjs','server/rooms.mjs','server/poker-adaptation.mjs','tests/fixtures/poker-strategy-v127.mjs'];
const violations=[];
// 1. Production entries: which strategy module, which options.
const entries=[
 {entry:'server bots (friend / hosted rooms)',file:'server/rooms.mjs'},
 {entry:'solo practice, Web Worker',file:'dist/ai-worker.mjs'},
 {entry:'solo practice, main thread fallbacks',file:'dist/app.mjs'}
].map(e=>{const src=read(e.file);
 const imports=[...src.matchAll(/import\s*\{[^}]*\bdecide\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
 const calls=[...src.matchAll(/\bdecide\(([^;]*?\{[^{}]*\})\)/g)].map(m=>m[1].replace(/\s+/g,' ').slice(0,200));
 const lab=/strategy-lab|poker-fold-model|poker-planning|poker-river-value|poker-multiway-value/.test(src);
 if(lab)violations.push(e.file+' imports experimental strategy code');
 if(!imports.every(p=>/(^|\/)strategy\.mjs$/.test(p)))violations.push(e.file+' imports decide from '+imports.join(','));
 return{...e,decideImportedFrom:imports,calls,importsLabCode:lab};
});
const strategy=read('dist/strategy.mjs');
if(/^import[^\n]*(strategy-lab|poker-(range|planning|river-value|multiway|response|behavior|fold-model))/m.test(strategy))violations.push('dist/strategy.mjs imports a lab module');
const samples=read('server/rooms.mjs').match(/SERVER_POKER_SAMPLES=(\d+)/)?.[1];
// 2. Behavioural identity with the frozen control.
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
let compared=0,different=0;
for(const players of [2,3,4,6])for(let s=1;s<=50;s++){const g=new Poker(Array(players).fill(2000),{dealer:s%players,rng:rng(s*31+players*7)});let k=0;
 while(!g.done&&k<200){if(!g.pending.size){g.advance();continue}const i=g.turn,snap=g.snapshot(i),seed=s*1000+k,profile=(s+i)%9;
  const adaptation=k%3===0?{entryBias:.02,callBias:.02,aggressionBias:.05,bluffBias:-.05,sizeBias:.04,foldBias:.06,valueBias:.03}:null;
  const a=decide(snap,profile,{samples:100,rng:rng(seed),adaptation}),b=v127(snap,profile,{samples:100,rng:rng(seed),adaptation});compared++;
  if(a.action!==b.action||a.target!==b.target||a.equity!==b.equity)different++;g.act(i,b.action,b.target);k++}}
if(different)violations.push(`production strategy differs from v127 in ${different}/${compared} decisions`);
const manifest={
 generated:new Date().toISOString(),
 productionStrategy:'dist/strategy.mjs, decide() without lab hooks (behaviourally identical to the frozen v127 control)',
 control:'tests/fixtures/poker-strategy-v127.mjs (frozen, never edited)',
 serverSamples:Number(samples),
 entries,
 experimentalModelsInProduction:false,
 v127Identity:{decisionsCompared:compared,different,tables:[2,3,4,6],note:'samples 100, fixed seeds, every third decision with a non-zero adaptation'},
 hashes:Object.fromEntries(files.map(f=>[f,hash(f)])),
 seedRegistry:{
  note:'Seed offsets already used by experiments. New confirmatory tests must use an unused range.',
  used:[0,50000,130000,500000,550000,700000,800000,900000,5000000,6000000,6100000,9100000,9200000,31000000,41000000,52000000,61000000,62000000,63000000,64000000],
  validation2026_10:{debug:[9100000,9200000],calibration:'61000000 + players*100000 (+50000 human pool)',matchesTwoPlayer:[62000000,62500000],matchesThreePlayer:[63000000,63500000],matchesFourPlayer:[64000000,64500000],note:'used; pick new ranges for the next confirmation'}
 },
 violations
};
console.log(JSON.stringify(manifest,null,1));
if(process.argv.includes('--write'))fs.writeFileSync(new URL('docs/poker-baseline.json',root),JSON.stringify(manifest,null,1)+'\n');
if(violations.length)process.exit(1);
