import {BET_CELLS,primaryCell} from './craps-layout.mjs';
import {EXTRA_BETS} from './craps-extra.mjs';
const order=['p4','p5','p6','p8','p9','p10','come','dcome','pass','dont','field','h4','h6','h8','h10','big6','big8','any7','craps','r2','r3','r11','r12'];
export const MAIN_CELLS=order.map(k=>({...primaryCell(k),span:['come','dcome'].includes(k)?3:['pass','dont','field'].includes(k)?2:1}));
export const BET_GROUPS=[['main','常用桌布'],['buy','Buy / Lay'],['odds','Odds 追加注'],['combo','组合下注'],['hop','Hop 指定骰面']];
export const cellsForGroup=group=>group==='main'?MAIN_CELLS:EXTRA_BETS.filter(c=>c.group===group);
export const ALL_UI_CELLS=[...MAIN_CELLS,...EXTRA_BETS];
// The physical table intentionally retains its full bilateral layout.
export const ANIMATION_CELLS=BET_CELLS;
