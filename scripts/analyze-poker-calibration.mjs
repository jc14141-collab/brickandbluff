// Summarises calibrate-poker-ranges.mjs output files and applies the pre-registered gates
// (docs/poker-ai-validation.md, step 4).
//   node scripts/analyze-poker-calibration.mjs <file>... [--write out.json]
// Confidence intervals are 95%, clustered by hand (rows from the same hand are not independent).
import fs from 'node:fs';
const args=process.argv.slice(2),wi=args.indexOf('--write'),outFile=wi>=0?args[wi+1]:null,files=args.filter((a,i)=>a!=='--write'&&i!==wi+1);
const data=files.map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
// Cluster-robust mean and CI: rows carry .hand; value fn per row.
function cmean(rows,f){const by=new Map();let N=0,S=0;for(const r of rows){const v=f(r);if(v===null||!Number.isFinite(v))continue;N++;S+=v;const c=by.get(r.hand)??[0,0];c[0]+=v;c[1]++;by.set(r.hand,c)}
 if(!N)return{n:0};const m=S/N;let q=0;for(const [s,n] of by.values())q+=(s-n*m)**2;const G=by.size,se=Math.sqrt(q*G/Math.max(1,G-1))/N;return{n:N,mean:+m.toFixed(4),ci:[+(m-1.96*se).toFixed(4),+(m+1.96*se).toFixed(4)]}}
const r4=x=>+x.toFixed(4);
function rangeSummary(rows){
 const gl=cmean(rows,r=>r.legacyLogp-r.uniformLogp),gb=cmean(rows,r=>r.labLogp-r.uniformLogp),d=cmean(rows,r=>r.labLogp-r.legacyLogp);
 const emp=Array(8).fill(0),pl=Array(8).fill(0),pb=Array(8).fill(0);for(const r of rows){emp[r.bucket]++;for(let b=0;b<8;b++){pl[b]+=r.legacyMass[b];pb[b]+=r.labMass[b]}}
 const n=rows.length||1,tv=p=>r4(p.reduce((s,x,b)=>s+Math.abs(x/n-emp[b]/n),0)/2);
 return{rows:rows.length,logLikelihoodGainOverUniformNats:{legacy:gl,lab:gb,labMinusLegacy:d},bucketTotalVariation:{legacy:tv(pl),lab:tv(pb)},
  bucketDistribution:{actual:emp.map(x=>r4(x/n)),legacy:pl.map(x=>r4(x/n)),lab:pb.map(x=>r4(x/n))}}}
function reliability(rows,key){const bins=Array.from({length:10},()=>({n:0,pred:0,obs:0}));for(const r of rows){const p=r[key];if(p===null)continue;const b=bins[Math.min(9,Math.floor(p*10))];b.n++;b.pred+=p;b.obs+=r.fold}
 return bins.map((b,i)=>({bin:`${i/10}-${(i+1)/10}`,n:b.n,predicted:b.n?r4(b.pred/b.n):null,observed:b.n?r4(b.obs/b.n):null}))}
function foldSummary(resp){
 const both=resp.filter(r=>r.legacy!==null&&r.model!==null);
 return{responses:resp.length,withBothPredictions:both.length,
  observedFoldRate:cmean(resp,r=>r.fold),
  model:{meanPredicted:cmean(resp.filter(r=>r.model!==null),r=>r.model),brier:cmean(resp.filter(r=>r.model!==null),r=>(r.model-r.fold)**2)},
  legacy:{meanPredicted:cmean(resp.filter(r=>r.legacy!==null),r=>r.legacy),brier:cmean(resp.filter(r=>r.legacy!==null),r=>(r.legacy-r.fold)**2)},
  onBoth:{observed:cmean(both,r=>r.fold),legacyPredicted:cmean(both,r=>r.legacy),modelPredicted:cmean(both,r=>r.model),brierLegacyMinusModel:cmean(both,r=>(r.legacy-r.fold)**2-(r.model-r.fold)**2)}}}
function allFoldSummary(raises){const rows=raises.filter(r=>!r.anyAllIn);
 return{raises:rows.length,observed:cmean(rows,r=>r.allFold),modelPredicted:cmean(rows,r=>r.modelAll),legacyPredicted:cmean(rows.filter(r=>r.legacyAll!==null),r=>r.legacyAll),
  legacyRaisesObserved:cmean(rows.filter(r=>r.legacyAll!==null),r=>r.allFold),modelError:cmean(rows,r=>r.modelAll-r.allFold),legacyError:cmean(rows.filter(r=>r.legacyAll!==null),r=>r.legacyAll-r.allFold)}}
const groupBy=(rows,f)=>{const m=new Map();for(const r of rows){const k=f(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return[...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))};
const STREET=['preflop','flop','turn','river'];
const cells=[],gates=[];
const gate=(id,description,cell,detail)=>gates.push({id,description,cell,...detail});
for(const d of data){
 const cell=`${d.players}p-${d.pool}`,clean=d.respRows.filter(r=>!r.afterReRaise);
 const range=rangeSummary(d.rangeRows),fold=foldSummary(clean),all=allFoldSummary(d.raiseRows.filter(r=>r.opponents>=2));
 const c={cell,hands:d.hands,offset:d.offset,range,
  rangeByStreet:Object.fromEntries(groupBy(d.rangeRows,r=>STREET[r.street]).map(([k,v])=>[k,rangeSummary(v)])),
  rangeByLine:Object.fromEntries(groupBy(d.rangeRows,r=>r.line).filter(([,v])=>v.length>=100).map(([k,v])=>[k,{rows:v.length,...rangeSummary(v).logLikelihoodGainOverUniformNats}])),
  fold,foldAllResponsesInclAfterReRaise:{responses:d.respRows.length,observed:cmean(d.respRows,r=>r.fold)},
  foldByStreet:Object.fromEntries(groupBy(clean,r=>r.street===0?'preflop':'postflop').map(([k,v])=>[k,foldSummary(v)])),
  foldBySequence:Object.fromEntries(groupBy(clean,r=>STREET[r.street]+':'+r.seq).map(([k,v])=>[k,{responses:v.length,observed:cmean(v,r=>r.fold).mean,model:cmean(v.filter(r=>r.model!==null),r=>r.model).mean??null,legacy:cmean(v.filter(r=>r.legacy!==null),r=>r.legacy).mean??null}])),
  foldByOpponentLine:Object.fromEntries(groupBy(clean,r=>r.line).filter(([,v])=>v.length>=50).map(([k,v])=>[k,{responses:v.length,observed:cmean(v,r=>r.fold).mean,model:cmean(v.filter(r=>r.model!==null),r=>r.model).mean??null,legacy:cmean(v.filter(r=>r.legacy!==null),r=>r.legacy).mean??null}])),
  ...(d.pool==='human'?{foldByOpponentTypeExploratory:Object.fromEntries(groupBy(clean,r=>r.type).map(([k,v])=>[k,{responses:v.length,observed:cmean(v,r=>r.fold).mean,model:cmean(v.filter(r=>r.model!==null),r=>r.model).mean??null,legacy:cmean(v.filter(r=>r.legacy!==null),r=>r.legacy).mean??null}]))}:{}),
  reliability:{model:reliability(clean,'model'),legacy:reliability(clean,'legacy')},
  allFoldMultiway:all};
 cells.push(c);
 // ---- pre-registered gates ----
 const g1=range.logLikelihoodGainOverUniformNats;
 gate('R1','range: lab range more informative than uniform and than legacy',cell,{pass:g1.lab.ci[0]>0&&g1.labMinusLegacy.ci[0]>0,labGain:g1.lab,labMinusLegacy:g1.labMinusLegacy});
 const bd=fold.onBoth.brierLegacyMinusModel;
 gate('F1','fold: model Brier below legacy on raises where both predict',cell,{pass:bd.n>0&&bd.ci[0]>0,brierLegacyMinusModel:bd});
 for(const [k,v] of Object.entries(c.foldByStreet)){const n=v.model.meanPredicted.n;if(n<200){gate('F2','fold: calibration in the large, '+k+' (n<200, not assessed)',cell,{pass:null,n});continue}
  const err=v.model.meanPredicted.mean-v.observedFoldRate.mean;gate('F2','fold: |mean predicted - observed| <= 0.05, '+k,cell,{pass:Math.abs(err)<=.05,n,error:r4(err)})}
 if(d.players>=3){if(all.raises<200)gate('F3','all-fold multiway (n<200, not assessed)',cell,{pass:null,n:all.raises});else{const err=all.modelPredicted.mean-all.observed.mean;gate('F3','all-fold multiway: |mean predicted - observed| <= 0.05',cell,{pass:Math.abs(err)<=.05,n:all.raises,error:r4(err),legacyError:all.legacyError.mean})}}
}
const assessed=gates.filter(g=>g.pass!==null);
const report={generated:new Date().toISOString(),files,verdict:assessed.every(g=>g.pass)?'PASS':'FAIL',gates,cells};
if(outFile)fs.writeFileSync(outFile,JSON.stringify(report,null,1));
console.log('verdict',report.verdict);
for(const g of gates)console.log((g.pass===null?'n/a ':g.pass?'PASS':'FAIL'),g.id,g.cell.padEnd(10),JSON.stringify(Object.fromEntries(Object.entries(g).filter(([k])=>!['id','cell','pass'].includes(k)))).slice(0,300));
