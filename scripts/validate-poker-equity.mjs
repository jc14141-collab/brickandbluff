// Independent validation of hand ranking and equity for the poker bots.
//   node scripts/validate-poker-equity.mjs [--quick]
// Writes .build/poker-validation/equity.json and exits 1 if any check fails.
//
// Reference evaluator: written here from scratch (bitmask straight/flush detection, numeric
// scores, best of 21 five-card subsets). It shares no code with dist/engine.mjs.
// Reference equity: exact enumeration with the reference evaluator where feasible, otherwise
// an independent Monte Carlo (own deck shuffling and dealing) with a stated standard error.
// Production equity(): dist/strategy.mjs, driven through its `rangeOf` hook for uniform or
// fixed-hand ranges, and through its default (legacy weighting) path for the production case.
// Tolerance: |estimate - reference| <= 4 * combined standard error (+1e-9).
import fs from 'node:fs';
import {fastRank,evaluate,compare} from '../dist/engine.mjs';
import {equity,preflop} from '../dist/strategy.mjs';
const QUICK=process.argv.includes('--quick');
const SUITS=['♠','♥','♣','♦'];
const card=t=>{const m=t.match(/^(10|[2-9TJQKA])([shcd])$/);if(!m)throw Error('bad card '+t);const r={T:10,J:11,Q:12,K:13,A:14}[m[1]]??Number(m[1]);return{r,s:SUITS['shcd'.indexOf(m[2])]}};
const cards=s=>s.trim()?s.trim().split(/\s+/).map(card):[];
const key=c=>c.r+c.s;
const FULL=[];for(const s of SUITS)for(let r=2;r<=14;r++)FULL.push({r,s});
// ---------- reference evaluator ----------
const STRAIGHTS=[];for(let hi=14;hi>=6;hi--)STRAIGHTS.push([hi,((1<<5)-1)<<(hi-4)]);STRAIGHTS.push([5,(1<<14)|(1<<2)|(1<<3)|(1<<4)|(1<<5)]);
function score5(h){
 let mask=0;const cnt=new Map();for(const c of h){mask|=1<<c.r;cnt.set(c.r,(cnt.get(c.r)??0)+1)}
 const flush=h.every(c=>c.s===h[0].s);let straight=0;for(const [hi,m] of STRAIGHTS)if((mask&m)===m&&cnt.size===5){straight=hi;break}
 const groups=[...cnt.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),shape=groups.map(g=>g[1]).join(''),ranks=groups.map(g=>g[0]);
 let cat;if(straight&&flush)cat=8;else if(shape==='41')cat=7;else if(shape==='32')cat=6;else if(flush)cat=5;else if(straight)cat=4;else if(shape==='311')cat=3;else if(shape==='221')cat=2;else if(shape==='2111')cat=1;else cat=0;
 const tie=straight?[straight]:ranks;let v=cat;for(let i=0;i<5;i++)v=v*16+(tie[i]??0);return v;
}
function score7(cs){let best=-1;const n=cs.length;for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){const h=cs.filter((_,i)=>i!==a&&i!==b);if(n===7){const v=score5(h);if(v>best)best=v}}
 if(n===5)return score5(cs);if(n===6){for(let a=0;a<6;a++){const v=score5(cs.filter((_,i)=>i!==a));if(v>best)best=v}}return best}
const category=v=>Math.floor(v/16**5);
// Second reference, bitmask based, for enumeration speed. It is itself checked against the
// 21-subset brute force (score7) below before any equity number relies on it.
const SI={'♠':0,'♥':1,'♣':2,'♦':3};
function topStraight(m){if(m&(1<<14))m|=2;for(let hi=14;hi>=5;hi--){const w=31<<(hi-4);if((m&w)===w)return hi}return 0}
function pack(cat,t){let v=cat;for(let i=0;i<5;i++)v=v*16+(t[i]??0);return v}
function ref7(cs){
 const cnt=new Int8Array(15),sm=[0,0,0,0],sc=[0,0,0,0];let m=0;
 for(const c of cs){cnt[c.r]++;m|=1<<c.r;const k=SI[c.s];sm[k]|=1<<c.r;sc[k]++}
 let fs=-1;for(let k=0;k<4;k++)if(sc[k]>=5)fs=k;
 if(fs>=0){const st=topStraight(sm[fs]);if(st)return pack(8,[st])}
 const q=[],t=[],p=[],single=[];for(let r=14;r>=2;r--){if(cnt[r]===4)q.push(r);else if(cnt[r]===3)t.push(r);else if(cnt[r]===2)p.push(r);else if(cnt[r]===1)single.push(r)}
 const desc=ex=>{const o=[];for(let r=14;r>=2;r--)if(cnt[r]&&!ex.includes(r))o.push(r);return o};
 if(q.length)return pack(7,[q[0],desc([q[0]])[0]]);
 if(t.length&&(t.length>1||p.length))return pack(6,[t[0],Math.max(t[1]??0,p[0]??0)]);
 if(fs>=0){const o=[];for(let r=14;r>=2&&o.length<5;r--)if(sm[fs]&(1<<r))o.push(r);return pack(5,o)}
 const st=topStraight(m);if(st)return pack(4,[st]);
 if(t.length)return pack(3,[t[0],...desc([t[0]]).slice(0,2)]);
 if(p.length>=2)return pack(2,[p[0],p[1],desc([p[0],p[1]])[0]]);
 if(p.length)return pack(1,[p[0],...desc([p[0]]).slice(0,3)]);
 return pack(0,single.slice(0,5));
}
// ---------- checks bookkeeping ----------
const results=[];let failed=0;
function check(group,name,ok,detail){results.push({group,name,ok,...detail});if(!ok){failed++;console.error('FAIL',group,name,JSON.stringify(detail))}}
const rng=seed=>()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
// ---------- 1. evaluator edge cases ----------
// Each case: two 7-card hands (or hole+board) and the expected winner / category.
const CATS=['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺'];
const edge=[
 ['皇家同花顺 vs 同花顺','As Ks','Qs Js 10s 2d 3c','9s 8s',1,8],
 ['同花顺 A-5（轮子）低于 7 高同花顺','As 2s','3s 4s 5s Kd Qc','6s 7s',-1,8],
 ['轮子顺 A-5 低于 2-6','Ah 2d','3c 4s 5h Kd Qc','6c 2h',-1,4],
 ['A 高顺（百老汇）','Ah Kd','Qc Js 10h 2d 3c','9c 8h',1,4],
 ['同花大于顺子','2h 7h','9h Jh Kh 10c Qd','Ac 8d',1,5],
 ['公共牌成顺，手牌接出更大顺','Kc 2d','8h 9s 10d Jc Qh','3c 4d',1,4],
 ['公共牌成顺，双方都用公共牌（平分）','2c 3d','8h 9s 10d Jc Qh','4c 5d',0,4],
 ['公共牌同花，手牌更大同花牌胜','Ah 2c','2h 5h 9h Jh Kh','Qh 3c',1,5],
 ['同花比到第五张','5h 3c','Ah Kh 9h 7h 2c','4h 3d',1,5],
 ['三对取最大两对，踢脚可来自第三对','Kc Qd','Kh Qs 9c 9d 2h','Kd Js',1,2],
 ['两个三条组成葫芦（取大三条）','9c 9d','9h 5s 5c 5d Ah','Ac Ad',-1,6],
 ['公共牌葫芦，口袋对改进葫芦','Kc Kd','7h 7s 7c 2d 2h','3c 3d',1,6],
 ['公共牌四条比踢脚','Ac 2d','9h 9s 9c 9d 3h','Kc Qd',1,7],
 ['公共牌四条带 A，双方平分','2c 3d','9h 9s 9c 9d Ah','4c 5d',0,7],
 ['公共牌皇家同花顺，平分','2c 3d','As Ks Qs Js 10s','4c 5d',0,8],
 ['一对比踢脚','Ac Kd','Ah 7s 5c 3d 2h','As Qd',1,1],
 ['两对比踢脚','Ac Kd','Jh Js 5c 5d 2h','Kc Qd',1,2],
 ['高牌比踢脚','Ac 9d','Kh 8s 6c 4d 2h','Ad 7c',1,0],
 ['葫芦 vs 同花','Kc Kd','Kh 5h 5s 9h 2h','Ah 3h',1,6],
 ['顺子 vs 公共对子成四条','6c 7d','8h 9s 10c 2d 2h','2c 2s',-1,7]
];
for(const [name,a,board,b,expect,cat] of edge){
 const A=[...cards(a),...cards(board)],B=[...cards(b),...cards(board)];
 const ref=Math.sign(score7(A)-score7(B)),fast=Math.sign(compare(fastRank(A),fastRank(B))),full=Math.sign(compare(evaluate(A),evaluate(B)));
 const winnerCat=Math.max(category(score7(A)),category(score7(B)));
 check('evaluator-edge',name,ref===expect&&fast===expect&&full===expect&&fastRank(expect>=0?A:B)[0]===cat&&winnerCat===cat,{expected:expect,reference:ref,fastRank:fast,evaluate:full,category:CATS[cat]});
}
// ---------- 2. evaluator agreement on random hands ----------
{const R=rng(20261011),N=QUICK?40000:400000;let catMismatch=0,orderMismatch=0,evalMismatch=0,refMismatch=0;
 for(let n=0;n<N;n++){const d=FULL.slice();for(let i=0;i<9;i++){const j=i+Math.floor(R()*(52-i));[d[i],d[j]]=[d[j],d[i]]}
  const board=d.slice(4,9),A=[d[0],d[1],...board],B=[d[2],d[3],...board],sa=score7(A),sb=score7(B),fa=fastRank(A),fb=fastRank(B);if(ref7(A)!==sa||ref7(B)!==sb)refMismatch++;
  if(fa[0]!==category(sa)||fb[0]!==category(sb))catMismatch++;
  if(Math.sign(compare(fa,fb))!==Math.sign(sa-sb))orderMismatch++;
  if(n<(QUICK?4000:40000)&&Math.sign(compare(evaluate(A),evaluate(B)))!==Math.sign(sa-sb))evalMismatch++}
 check('evaluator-random','fastRank / evaluate 与参考评估器在随机 7 张牌对上的类别与胜负一致；位掩码参考与 21 子集暴力参考逐值一致',catMismatch+orderMismatch+evalMismatch+refMismatch===0,{pairs:N,bitmaskVsBruteForceMismatch:refMismatch,evaluatePairs:QUICK?4000:40000,categoryMismatch:catMismatch,orderMismatchFastRank:orderMismatch,orderMismatchEvaluate:evalMismatch});
}
// ---------- reference equity ----------
// Opponent ranges: weight(hand) -> number. Exact enumeration over opponent hands and boards
// when the number of evaluations is manageable, else independent Monte Carlo.
function poolOf(hole,board){const known=new Set([...hole,...board].map(key));return FULL.filter(c=>!known.has(key(c)))}
function combos(n,k,start=0,acc=[],out=[]){if(acc.length===k){out.push(acc.slice());return out}for(let i=start;i<n;i++){acc.push(i);combos(n,k,i+1,acc,out);acc.pop()}return out}
function eachBoard(rest,need,fn,start=0,acc=[]){if(acc.length===need){fn(acc);return}for(let i=start;i<rest.length;i++){acc.push(rest[i]);eachBoard(rest,need,fn,i+1,acc);acc.pop()}}
function exactHeadsUp(hole,board,weight){
 const pool=poolOf(hole,board),need=5-board.length;let W=0,win=0,tie=0;
 for(let a=0;a<pool.length-1;a++)for(let b=a+1;b<pool.length;b++){const w=weight([pool[a],pool[b]]);if(!w)continue;
  const rest=pool.filter((_,i)=>i!==a&&i!==b);let n=0,wn=0,tn=0;const H=[...hole,...board],O=[pool[a],pool[b],...board];
  eachBoard(rest,need,run=>{const me=ref7(H.concat(run)),op=ref7(O.concat(run));n++;if(me>op)wn++;else if(me===op)tn++});
  W+=w;win+=w*wn/n;tie+=w*tn/n}
 return{win:win/W,tie:tie/W,equity:(win+tie/2)/W,se:0,method:'exact'};
}
function exactMultiwayRiver(hole,board,weights){// two opponents, river only
 const pool=poolOf(hole,board),hands=[];for(let a=0;a<pool.length-1;a++)for(let b=a+1;b<pool.length;b++)hands.push([a,b]);
 const me=ref7([...hole,...board]),sc=hands.map(([a,b])=>ref7([pool[a],pool[b],...board]));let W=0,share=0,win=0,tie=0;
 for(let i=0;i<hands.length;i++){const w1=weights[0]([pool[hands[i][0]],pool[hands[i][1]]]);if(!w1)continue;
  for(let j=0;j<hands.length;j++){const [c,d]=hands[j],[a,b]=hands[i];if(c===a||c===b||d===a||d===b)continue;const w=w1*weights[1]([pool[c],pool[d]]);if(!w)continue;
   W+=w;const best=Math.max(sc[i],sc[j]);if(me>best){win+=w;share+=w}else if(me===best){tie+=w;share+=w/(1+(sc[i]===me)+(sc[j]===me))}}}
 return{win:win/W,tie:tie/W,equity:share/W,se:0,method:'exact'};
}
function monteCarlo(hole,board,weights,N,seed){// independent sampler: rejection over uniform hands by weight
 const R=rng(seed),pool=poolOf(hole,board);const maxW=weights.map(()=>1);let share=0,win=0,tie=0,sq=0;
 for(let n=0;n<N;n++){let d,hands;
  for(;;){d=pool.slice();for(let i=0;i<d.length&&i<2*weights.length+5;i++){const j=i+Math.floor(R()*(d.length-i));[d[i],d[j]]=[d[j],d[i]]}
   hands=weights.map((_,k)=>[d[2*k],d[2*k+1]]);if(weights.every((w,k)=>R()*maxW[k]<w(hands[k])))break}
  const full=[...board,...d.slice(2*weights.length,2*weights.length+5-board.length)],me=ref7([...hole,...full]),ops=hands.map(h=>ref7([...h,...full])),best=Math.max(...ops);
  let s=0;if(me>best){s=1;win++}else if(me===best){s=1/(1+ops.filter(v=>v===me).length);tie++}share+=s;sq+=s*s}
 const m=share/N;return{win:win/N,tie:tie/N,equity:m,se:Math.sqrt(Math.max(0,sq/N-m*m)/N),method:'independent Monte Carlo',samples:N};
}
// Production equity() with a supplied range through the rangeOf hook (pool order a<b).
// Returns the production estimate plus its own win and tie rates, recomputed from the worlds
// it sampled (equity() exposes them through its `worlds` option; ranking uses fastRank there,
// which section 2 checked against the reference).
function productionEquity(hole,board,weights,samples,seed,detail=false){
 const players=[{fold:false,history:[]},...weights.map(()=>({fold:false,history:[]}))];
 const snapshot={hole,board,street:board.length===0?0:board.length-2,seat:0,players};
 const rangeOf=(snap,seat)=>{const pool=poolOf(hole,board),entries=[];for(let a=0;a<pool.length-1;a++)for(let b=a+1;b<pool.length;b++)entries.push({weight:weights[seat-1]([pool[a],pool[b]])});return{entries}};
 const worlds=detail?[]:null,eq=equity(snapshot,samples,rng(seed),{rangeOf,worlds});
 if(!detail)return eq;
 let win=0,tie=0;for(const w of worlds){const me=ref7([...hole,...w.board]),ops=w.hands.map(h=>ref7([...h,...w.board])),best=Math.max(...ops);if(me>best)win++;else if(me===best)tie++}
 return{equity:eq,win:win/samples,tie:tie/samples};
}
const uniform=()=>1;
const fixed=t=>{const k=new Set(cards(t).map(key));return h=>k.has(key(h[0]))&&k.has(key(h[1]))?1:0};
const tilted=h=>1+Math.max(h[0].r,h[1].r)/14+(h[0].r===h[1].r?1:0);// deterministic non-uniform range
function compareCase(group,name,hole,board,weights,ref,samples){
 const est=productionEquity(cards(hole),cards(board),weights,samples,7000+results.length,true);
 const tolOf=(p,refSe)=>4*Math.sqrt(Math.max(1e-6,p*(1-p))/samples+refSe*refSe)+1e-9;
 const refSeWin=ref.method==='exact'?0:Math.sqrt(ref.win*(1-ref.win)/ref.samples),refSeTie=ref.method==='exact'?0:Math.sqrt(ref.tie*(1-ref.tie)/ref.samples);
 const tE=tolOf(ref.equity,ref.se),tW=tolOf(ref.win,refSeWin),tT=tolOf(ref.tie,refSeTie);
 const ok=Math.abs(est.equity-ref.equity)<=tE&&Math.abs(est.win-ref.win)<=tW&&Math.abs(est.tie-ref.tie)<=tT;
 check(group,name,ok,{hole,board,opponents:weights.length,reference:+ref.equity.toFixed(5),referenceMethod:ref.method,referenceSE:+ref.se.toFixed(5),win:+ref.win.toFixed(5),tie:+ref.tie.toFixed(5),production:+est.equity.toFixed(5),productionWin:+est.win.toFixed(5),productionTie:+est.tie.toFixed(5),productionSamples:samples,diff:+(est.equity-ref.equity).toFixed(5),tolerance:{equity:+tE.toFixed(5),win:+tW.toFixed(5),tie:+tT.toFixed(5)}});
}
const S=QUICK?6000:20000;
// ---------- 3. heads-up, fixed opponent hand, exact (preflop through river) ----------
const huFixed=[
 ['翻前 AA vs KK','As Ah','','Ks Kh'],
 ['翻前 AKs vs QQ','As Ks','','Qh Qd'],
 ['翻前 72o vs 32s（劣势牌）','7c 2d','','3h 2h'],
 ['翻牌 同花听牌 vs 超对','Ah 5h','Kh 9h 2c','Qs Qd'],
 ['翻牌 两头顺听 vs 一对','9c 8d','10h 7s 2c','Ad 10c'],
 ['转牌 同花听牌 vs 已成葫芦（零胜率）','Ah Kh','Qh 7h 7c 2d','2s 2c'],
 ['河牌 公共牌成顺 平分','2c 3d','8h 9s 10d Jc Qh','4c 5d'],
 ['河牌 公共牌皇家同花顺 平分','2c 3d','As Ks Qs Js 10s','4c 5d']
].filter((_,i)=>!QUICK||i!==1&&i!==2);
for(const [name,hole,board,opp] of huFixed)compareCase('equity-headsup-fixed',name,hole,board,[fixed(opp)],exactHeadsUp(cards(hole),cards(board),fixed(opp)),S);
// ---------- 4. heads-up vs uniform and non-uniform ranges ----------
const huRange=[
 ['翻牌 顶对 vs 均匀范围','Ac Kd','Ah 7s 2c'],
 ['翻牌 单张同花牌面 vs 均匀范围','Ks Qs','Js 7s 2s'],
 ['转牌 对子牌面 vs 均匀范围','9c 9d','Kh Ks 4c 2d'],
 ['河牌 同花牌面无同花 vs 均匀范围','Ac Ad','Kh 9h 5h 2h 3c'],
 ['河牌 四张顺面 vs 均匀范围','Ac Kd','6h 7s 8c 9d 2h']
].filter((_,i)=>!QUICK||i!==1);
for(const [name,hole,board] of huRange){compareCase('equity-headsup-range',name,hole,board,[uniform],exactHeadsUp(cards(hole),cards(board),uniform),S);
 if(cards(board).length>=4)compareCase('equity-headsup-range',name+'（非均匀加权范围）',hole,board,[tilted],exactHeadsUp(cards(hole),cards(board),tilted),S)}
compareCase('equity-headsup-range','翻前 AKo vs 均匀范围（独立 MC 参考）','Ac Kd','',[uniform],monteCarlo(cards('Ac Kd'),[],[uniform],QUICK?100000:600000,11),S);
// ---------- 5. multiway ----------
compareCase('equity-multiway','三人 河牌 两对 vs 两个均匀范围（精确）','Kc 9d','Kh 9s 4c 2d 7h',[uniform,uniform],exactMultiwayRiver(cards('Kc 9d'),cards('Kh 9s 4c 2d 7h'),[uniform,uniform]),S);
compareCase('equity-multiway','三人 河牌 同花牌面（精确，含多人平分）','2c 3d','Ah Kh Qh Jh 10h',[uniform,uniform],exactMultiwayRiver(cards('2c 3d'),cards('Ah Kh Qh Jh 10h'),[uniform,uniform]),S);
compareCase('equity-multiway','三人 河牌 非均匀加权范围（精确，联合权重）','Qc Jd','Qh 10s 4c 2d 8h',[tilted,tilted],exactMultiwayRiver(cards('Qc Jd'),cards('Qh 10s 4c 2d 8h'),[tilted,tilted]),S);
for(const [name,hole,board,n] of [['三人 翻牌 同花听牌','Ah 5h','Kh 9h 2c',2],['三人 转牌 顺子','9c 8d','10h 7s 6c 2d',2],['四人 河牌 顶对顶踢脚','Ac Kd','Ah 7s 2c 9d 4h',3],['四人 翻前 口袋 QQ','Qs Qd','',3]].filter((_,i)=>!QUICK||i<2)){
 const w=Array(n).fill(uniform);compareCase('equity-multiway',name+'（独立 MC 参考）',hole,board,w,monteCarlo(cards(hole),cards(board),w,QUICK?60000:300000,31+n),S)}
// ---------- 6. sampler bias and spread at production sample counts ----------
for(const [name,hole,board,samples,reps] of [['单挑 河牌，100 次采样','Ac Kd','Ah 7s 2c 9d 4h',100,QUICK?300:1500],['单挑 翻牌，100 次采样','Ah 5h','Kh 9h 2c',100,QUICK?300:1500],['单挑 转牌，1200 次采样','9c 9d','Kh Ks 4c 2d',1200,QUICK?60:300]]){
 const ref=exactHeadsUp(cards(hole),cards(board),uniform),xs=[];for(let k=0;k<reps;k++)xs.push(productionEquity(cards(hole),cards(board),[uniform],samples,90000+k));
 const m=xs.reduce((a,b)=>a+b,0)/reps,sd=Math.sqrt(xs.reduce((a,x)=>a+(x-m)**2,0)/(reps-1)),expectSd=Math.sqrt(ref.equity*(1-ref.equity)/samples),seMean=sd/Math.sqrt(reps);
 check('equity-sampler',name+'：均值无偏、离散度与二项理论相符',Math.abs(m-ref.equity)<=4*seMean&&sd<=expectSd*1.25,{reference:+ref.equity.toFixed(5),meanOfEstimates:+m.toFixed(5),repetitions:reps,observedSD:+sd.toFixed(5),binomialSD:+expectSd.toFixed(5),biasTolerance:+(4*seMean).toFixed(5)});
}
// ---------- 7. production default path (legacy range weighting) ----------
// The legacy weight function is restated from dist/strategy.mjs (rangeWeight) to compute the
// exact weighted equity; this checks the default sampler path, not whether the weights are good.
function legacyWeight(h,history,board){let s=preflop(h),raises=history.filter(a=>a.kind==='raise'),pre=raises.filter(a=>a.street===0).length,w=.15+.85*s;if(pre)w*=Math.pow(.08+.92*s,1+pre);if(history.some(a=>a.kind==='call'&&a.street===0))w*=.35+.65*s;if(board.length>=3&&raises.some(a=>a.street>0)){let cat=fastRank([...h,...board])[0];w*=cat>=2?1:cat===1?.7:.28}return Math.max(.004,w)}
for(const [name,hole,board,history] of [['线上默认路径：河牌，对手无行动','Ac Kd','Ah 7s 2c 9d 4h',[]],['线上默认路径：转牌，对手翻前加注、翻牌加注','9c 9d','Kh Ks 4c 2d',[{kind:'raise',street:0},{kind:'raise',street:1}]],['线上默认路径：河牌，对手翻前跟注','Qc Jc','Qh 10s 4c 2d 8h',[{kind:'call',street:0}]]]){
 const H=cards(hole),B=cards(board),w=h=>legacyWeight(h,history,B),ref=exactHeadsUp(H,B,w);
 const snapshot={hole:H,board:B,street:B.length-2,seat:0,players:[{fold:false,history:[]},{fold:false,history}]};
 const est=equity(snapshot,S,rng(4242)),se=Math.sqrt(ref.equity*(1-ref.equity)/S);
 check('equity-production-path',name,Math.abs(est-ref.equity)<=4*se,{hole,board,reference:+ref.equity.toFixed(5),win:+ref.win.toFixed(5),tie:+ref.tie.toFixed(5),production:+est.toFixed(5),diff:+(est-ref.equity).toFixed(5),tolerance:+(4*se).toFixed(5)});
}
const summary={generated:new Date().toISOString(),quick:QUICK,checks:results.length,failed,results};
fs.mkdirSync('.build/poker-validation',{recursive:true});fs.writeFileSync('.build/poker-validation/equity.json',JSON.stringify(summary,null,1));
console.log(JSON.stringify({checks:results.length,failed},null,1));
for(const r of results)console.log((r.ok?'PASS ':'FAIL ')+r.group.padEnd(24)+r.name+(r.reference!==undefined?`  ref=${r.reference} prod=${r.production??r.meanOfEstimates}`+(r.productionWin!==undefined?` win ${r.win}/${r.productionWin} tie ${r.tie}/${r.productionTie}`:''):''));
process.exit(failed?1:0);
