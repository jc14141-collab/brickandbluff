// 检查：整局中打出的每一张牌都必须是唯一的（牌堆不能出现重复牌）。
import {BigTwoMatch} from '../dist/bigtwo.mjs';
import {chooseMove} from '../dist/bigtwo-strategy.mjs';

let games = 0, plays = 0, bad = [];
for (let g = 0; g < 200; g++) {
  const match = new BigTwoMatch();
  const game = match.start();
  // 发牌阶段就要唯一
  const dealt = game.hands.flat().map((c) => c.id);
  if (new Set(dealt).size !== 52) bad.push('发牌重复: ' + new Set(dealt).size + ' 张唯一 / 52');

  let guard = 0;
  while (!game.done && guard++ < 400) {
    const i = game.turn;
    const m = chooseMove(game.snapshot(i));
    game.act(i, m ? m.cards.map((c) => c.id) : []);
    if (m) plays++;
  }
  if (!game.done) { bad.push('第 ' + g + ' 局未结束'); continue; }

  // 打出的牌 + 剩余手牌，合起来必须正好是 52 张唯一牌
  const played = game.actions.flatMap((a) => (a.cards || []).map((c) => c.id));
  const left = game.hands.flat().map((c) => c.id);
  const all = [...played, ...left];
  if (new Set(all).size !== 52) {
    bad.push('第 ' + g + ' 局牌数异常: 唯一 ' + new Set(all).size + ' 张，总计 ' + all.length + ' 张');
  }
  // 同一张牌不能被打出两次
  if (new Set(played).size !== played.length) {
    bad.push('第 ' + g + ' 局有牌被打出两次');
  }
  games++;
}

console.log('完整对局: ' + games + ' 局，总出牌次数: ' + plays);
console.log(bad.length ? 'FAIL:\n' + bad.slice(0, 5).join('\n') : 'OK 全部 52 张牌唯一，无重复出牌');

// 顺带打印一局的动作日志，肉眼核对出牌记录
const m2 = new BigTwoMatch();
const g2 = m2.start();
let n = 0;
while (!g2.done && n++ < 400) {
  const i = g2.turn;
  const mv = chooseMove(g2.snapshot(i));
  g2.act(i, mv ? mv.cards.map((c) => c.id) : []);
}
console.log('\n样例一局的动作日志（前 14 条）:');
for (const a of g2.actions.slice(0, 14)) {
  const cards = (a.cards || []).map((c) => c.s + c.r).join(' ');
  console.log('  座位' + a.seat + ' ' + (a.pass ? '不出' : (a.move || '') + '  [' + cards + ']'));
}
const ids = g2.actions.flatMap((a) => (a.cards || []).map((c) => c.id));
console.log('本局打出 ' + ids.length + ' 张，唯一 ' + new Set(ids).size + ' 张 -> ' + (ids.length === new Set(ids).size ? 'OK' : 'FAIL'));
