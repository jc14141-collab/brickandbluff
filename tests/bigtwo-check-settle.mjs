import {BigTwo, settle, settleWithBanks, normalizeValue, bracketMultiplier, twoMultiplier, BigTwoMatch} from '../dist/bigtwo.mjs';

const mk = (n, twos = 0) => {
  const h = [];
  for (let i = 0; i < n - twos; i++) h.push({id: h.length, r: 5, s: '♠'});
  for (let i = 0; i < twos; i++) h.push({id: h.length, r: 2, s: '♠'});
  return h;
};
const game = (counts, twos = [], finishType = 'pair') => ({
  done: true, finish: [0], finishType,
  hands: counts.map((n, i) => mk(n, twos[i] ?? 0)),
});

let ok = 0, bad = [];
const check = (c, label) => { if (c) ok++; else bad.push(label); };

// ── 1. 两两差额：手算核对 ──
// 座位0=0张(赢) 1=3张 2=8张 3=13张且手上两张2，牌值 10
const g1 = game([0, 3, 8, 13], [0, 0, 0, 2]);
const r1 = settle(g1, 10);
const expect1 = [2190, 1620, 670, -4480];
check(JSON.stringify(r1.scores) === JSON.stringify(expect1),
  `两两差额手算: 期望 ${expect1} 实得 ${r1.scores}`);
check(r1.scores.reduce((a, b) => a + b, 0) === 0, '零和: ' + r1.scores.reduce((a, b) => a + b, 0));
check(r1.pairs.length === 6, '四家两两组合共 6 笔，实得 ' + r1.pairs.length);

// 逐笔核对
const p = (from, to) => r1.pairs.find((x) => x.from === from && x.to === to);
check(p(1, 0).amount === 30, '1→0 差额3×10 = 30');
check(p(2, 0).amount === 80, '2→0 差额8×10 = 80');
check(p(2, 1).amount === 50, '2→1 差额5×10 = 50');
check(p(3, 0).amount === 2080, '3→0 差额13×10×4(区间)×4(两张2) = 2080');
check(p(3, 3) === undefined, '没有自己付给自己');
check(!r1.pairs.some((x) => x.from < x.to && x.amount < 0), '所有支付额为正');

// ── 2. 区间倍数 ──
check(bracketMultiplier(1) === 1 && bracketMultiplier(9) === 1, '1–9 张 = 1 倍');
check(bracketMultiplier(10) === 2 && bracketMultiplier(12) === 2, '10–12 张 = 2 倍');
check(bracketMultiplier(13) === 4, '13 张 = 4 倍');
// 三家等牌时，每家只与赢家结算，金额 = 张数 × 牌值 × 区间倍数
check(settle(game([0, 9, 9, 9]), 10).scores[0] === 3 * (9 * 10 * 1), '9 张档：3 家 × 9×10×1 = 270');
check(settle(game([0, 10, 10, 10]), 10).scores[0] === 3 * (10 * 10 * 2), '10 张档：3 家 × 10×10×2 = 600');
check(settle(game([0, 13, 13, 13]), 10).scores[0] === 3 * (13 * 10 * 4), '13 张档：3 家 × 13×10×4 = 1560');

// ── 3. 手上每张 2 翻倍（可叠加）──
check(twoMultiplier(mk(5, 0)) === 1, '0 张 2 = ×1');
check(twoMultiplier(mk(5, 1)) === 2, '1 张 2 = ×2');
check(twoMultiplier(mk(5, 2)) === 4, '2 张 2 = ×4');
check(twoMultiplier(mk(5, 3)) === 8, '3 张 2 = ×8');
check(twoMultiplier(mk(5, 4)) === 16, '4 张 2 = ×16');
const oneTwo = settle(game([0, 5, 5, 5], [0, 1, 0, 0]), 10).scores;
const twoTwos = settle(game([0, 5, 5, 5], [0, 2, 0, 0]), 10).scores;
check(oneTwo[1] === -(5 * 10 * 1 * 2), '手上 1 张 2：付 5×10×1×2 = -100');
check(twoTwos[1] === -(5 * 10 * 1 * 4), '手上 2 张 2：付 5×10×1×4 = -200，刚好翻倍');
check(twoTwos[1] === oneTwo[1] * 2, '两张 2 的支出是单张的 2 倍');

// ── 4. 赢家最后一手四条/同花顺 → 全体翻倍 ──
const normal = settle(game([0, 4, 6, 9]), 10);
const bonusFour = settle(game([0, 4, 6, 9], [], 'four'), 10);
const bonusSF = settle(game([0, 4, 6, 9], [], 'straightflush'), 10);
check(bonusFour.scores[0] === normal.scores[0] * 2, '四条收尾：赢家收入翻倍');
check(bonusFour.scores[3] === normal.scores[3] * 2, '四条收尾：输家支出翻倍');
check(JSON.stringify(bonusFour.scores.map((x) => x * 2)) !== '[]' && bonusFour.scores.reduce((a, b) => a + b, 0) === 0, '四条收尾后仍然零和');
check(JSON.stringify(bonusSF.scores) === JSON.stringify(bonusFour.scores), '同花顺与四条同样翻倍');
check(settle(game([0, 4, 6, 9], [], 'full'), 10).scores[0] === normal.scores[0], '葫芦收尾不翻倍');

// ── 5. 牌值区间与归一化 ──
check(normalizeValue(10) === 10 && normalizeValue(100) === 100, '10 与 100 合法');
check(normalizeValue(55) === 60, '55 吸附到 60');
check(normalizeValue(0) === 10 && normalizeValue(999) === 100, '越界夹到 10–100');
check(normalizeValue('abc') === 10, '非法值回落默认 10');
check(normalizeValue(-30) === 10, '负数夹到 10');
const v100 = settle(game([0, 5, 5, 5]), 100).scores;
const v10 = settle(game([0, 5, 5, 5]), 10).scores;
check(Math.abs(v100[0]) === Math.abs(v10[0]) * 10, '牌值 100 是 10 的 10 倍');

// ── 6. 全下上限 ──
const gBig = game([0, 3, 8, 13], [0, 0, 0, 4]);
const raw = settle(gBig, 100);
const banks = [2000, 2000, 2000, 2000];
const capped = settleWithBanks(gBig, 100, banks);
check(capped.capped === true, '超出桌面筹码时触发全下');
check(capped.scores.reduce((a, b) => a + b, 0) === 0, '全下后仍然零和');
check(capped.scores.every((s, i) => banks[i] + s >= 0), '没人被打成负筹码: ' + capped.scores.map((s, i) => banks[i] + s).join('/'));
check(capped.scores[3] === -2000, '支出方最多赔光桌面筹码（-2000）');
check(Math.abs(capped.scores[3]) < Math.abs(raw.scores[3]), '全下金额小于理论金额');
// 四家之间还有内部转账，所以正确的不变量是「正数之和 = 负数绝对值之和」
const pos = capped.scores.filter((s) => s > 0).reduce((a, b) => a + b, 0);
const neg = -capped.scores.filter((s) => s < 0).reduce((a, b) => a + b, 0);
check(pos === neg, '正数之和 = 负数绝对值之和 (' + pos + ' = ' + neg + ')');
// 座位 3 付给 0/1/2 的实际金额之和必须正好等于它赔光的 2000
const paidBy3 = capped.pairs.filter((x) => x.from === 3).reduce((a, b) => a + b.amount, 0);
check(paidBy3 === 2000, '座位 3 实际付出 2000，实得 ' + paidBy3);
check(capped.pairs.filter((x) => x.from === 3).every((x) => x.reduced), '被缩减的支付项都标了 reduced');
// 筹码充足时不触发
check(settleWithBanks(gBig, 100, [1e9, 1e9, 1e9, 1e9]).capped === false, '筹码充足时不触发全下');

// ── 7. BigTwoMatch 累计与牌值 ──
const match = new BigTwoMatch();
check(match.value === 10, '默认牌值 10');
match.setValue(50);
check(match.value === 50, 'setValue(50) 生效');
check(match.setValue(55) === 60, 'setValue 吸附到 60');
const g = match.start();
check(g.hands.every((h) => h.length === 13), 'start() 正常发牌');

// ── 8. 全下取整回归：不能因逐笔四舍五入而超支 ──
// 座位 0 与 3 各欠 2 笔 10（共 20），桌面只有 1 筹码 → 比例 0.05 → 每笔恰好 0.5。
// 旧实现用 Math.round 逐笔进位，0.5+0.5 会变成 1+1=2，超支并把座位打成 -1。
const gRound = game([4, 3, 3, 4]);
const rRound = settleWithBanks(gRound, 10, [1, 0, 0, 1]);
check(rRound.capped === true, '极低筹码触发全下');
const paidR0 = rRound.pairs.filter((x) => x.from === 0).reduce((a, b) => a + b.amount, 0);
const paidR3 = rRound.pairs.filter((x) => x.from === 3).reduce((a, b) => a + b.amount, 0);
check(paidR0 === 1, '座位 0 只付出桌面上的 1 筹码，实得 ' + paidR0);
check(paidR3 === 1, '座位 3 只付出桌面上的 1 筹码，实得 ' + paidR3);
check(rRound.scores.every((s, i) => [1, 0, 0, 1][i] + s >= 0), '无人被打成负筹码: ' + rRound.scores);
check(rRound.scores.reduce((a, b) => a + b, 0) === 0, '取整后依然零和');

// 随机扫描：桌面筹码 0–4 的极端情形，验证「不超支 + 零和 + 整数」恒成立
let tinyBad = 0, tinyRuns = 0;
for (let n = 0; n < 300; n++) {
  const gg = new BigTwo({ random: Math.random });
  let guard = 0;
  while (!gg.done && guard++ < 4000) {
    const i = gg.turn, legal = gg.legal(i);
    if (!legal.length) { gg.act(i, []); continue; }
    gg.act(i, legal[Math.floor(Math.random() * legal.length)].cards.map((c) => c.id));
  }
  const b = Array.from({ length: 4 }, () => Math.floor(Math.random() * 5));
  const res = settleWithBanks(gg, 100, b);
  tinyRuns++;
  const sum = res.scores.reduce((a, c) => a + c, 0);
  const overspent = res.pairs.some((x) => !Number.isInteger(x.amount));
  const neg = res.scores.some((s, i) => b[i] + s < 0);
  const perPayer = [0, 1, 2, 3].map((i) => res.pairs.filter((x) => x.from === i).reduce((a, c) => a + c.amount, 0));
  const over = perPayer.some((v, i) => v > b[i]);
  if (sum !== 0 || overspent || neg || over) tinyBad++;
}
check(tinyBad === 0, `${tinyRuns} 局极低筹码结算全部不超支、零和、整数（失败 ${tinyBad}）`);

// ── 9. 两两差额穷举：每一种残局都要比满所有对位 ──
// 用户反馈过「看起来只和第一名结算」。这里把赢家 0 张、其余三家 1–13 张的
// 全部合法残局（13³ = 2197 种）跑一遍，逐种核对笔数等于所有 counts[i] > counts[j] 的有序对数。
let comboBad = 0, combos = 0, onlyWinnerCases = 0;
const threePairCases = [];
for (let a = 1; a <= 13; a++) {
  for (let b = 1; b <= 13; b++) {
    for (let c = 1; c <= 13; c++) {
      const counts = [0, a, b, c];
      const res = settle(game(counts), 10);
      const expected = counts.reduce((n, ci) => n + counts.filter((cj) => ci > cj).length, 0);
      combos++;
      if (res.pairs.length !== expected) comboBad++;
      // 每一笔都必须是「牌多的付给牌少的」，且差额正好等于张数差
      if (!res.pairs.every((p) => counts[p.from] > counts[p.to] && p.diff === counts[p.from] - counts[p.to])) comboBad++;
      if (res.pairs.length === 3) threePairCases.push(counts.join('/'));
      // 三家和与赢家之差：非赢家之间也可能有笔数
      const nonWinner = res.pairs.filter((p) => p.from !== res.winner && p.to !== res.winner).length;
      if (nonWinner === 0) onlyWinnerCases++;
    }
  }
}
check(combos === 2197, '穷举覆盖 2197 种合法残局，实得 ' + combos);
check(comboBad === 0, '每种残局的两两差额笔数都等于全部对位（失败 ' + comboBad + '）');
check(onlyWinnerCases === 13, '只有三家剩牌完全相同时才会出现「只与赢家结算」（' + onlyWinnerCases + ' 种，如 ' + threePairCases.slice(0, 3).join('、') + '）');

// 抽一个三方互不相同的残局，手算核对输家之间也有支付
// [0,4,2,5] 牌值 10，各家倍数均为 1：
//   1→0 差4=40   1→2 差2=20   2→0 差2=20
//   3→0 差5=50   3→1 差1=10   3→2 差3=30   （共 6 笔，其中 3 笔发生在输家之间）
//   seat0 = +40+20+50 = 110 ；seat1 = -40-20+10 = -50
//   seat2 = +20+30-20 = +30 ；seat3 = -50-10-30 = -90
const r3 = settle(game([0, 4, 2, 5]), 10);
const cross = r3.pairs.filter((p) => p.from !== r3.winner && p.to !== r3.winner);
check(r3.pairs.length === 6, '三方剩牌各不相同时共 6 笔，实得 ' + r3.pairs.length);
check(cross.length === 3, '其中 3 笔发生在输家之间（实得 ' + cross.length + '）');
check(cross.some((p) => p.from === 3 && p.to === 1) && cross.some((p) => p.from === 1 && p.to === 2) && cross.some((p) => p.from === 3 && p.to === 2),
  '输家之间的支付方向正确（3→1、1→2、3→2）');
check(JSON.stringify(r3.scores) === JSON.stringify([110, -50, 30, -90]),
  '手算核对 [0,4,2,5] 牌值 10：期望 [110,-50,30,-90] 实得 ' + JSON.stringify(r3.scores));

console.log('通过 ' + ok + ' · 失败 ' + bad.length);
if (bad.length) { console.log('失败项:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('结算引擎全部通过');
