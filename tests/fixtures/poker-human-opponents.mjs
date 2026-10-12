// Rule-based opponents imitating common human leaks, for evaluation only. They see only
// their own snapshot (own cards, board, public betting), like any seat. Each returns a
// legal {action,target}. They are deliberately simple and exploitable; the point is to
// measure how well a strategy punishes typical recreational mistakes, not to model a
// specific person.
import {handFeatures} from '../../dist/poker-range.mjs';
const clampTo=(l,t)=>l.max<l.min?l.max:Math.max(l.min,Math.min(l.max,Math.round(t)));
function ctx(s){
 const l=s.legal,f=handFeatures(s.hole,s.board),pot=Math.max(s.bigBlind,s.pot),owe=l.call,frac=owe/Math.max(1,pot);
 return{l,strength:f.strength,draw:f.draw,pot,owe,frac,bb:s.bigBlind,pre:s.street===0};
}
const raise=(c,t)=>c.l.canRaise?{action:'raise',target:clampTo(c.l,t)}:c.owe?{action:'call'}:{action:'check'};
const passive=c=>c.owe?{action:'call'}:{action:'check'};
const fold=c=>c.owe?{action:'fold'}:{action:'check'};
export const HUMAN_OPPONENTS={
 // 跟注站: plays most hands, almost never folds once involved, rarely bets.
 station(s,r){const c=ctx(s);
  if(c.pre){if(c.strength>.86&&r()<.5)return raise(c,s.current*3);return c.strength>.18||c.owe<=c.bb?passive(c):fold(c)}
  if(c.strength>.8&&!c.owe&&r()<.35)return raise(c,s.current+c.pot*.5);
  if(c.owe&&c.strength<.25&&!c.draw&&c.frac>.9&&r()<.6)return fold(c);
  return passive(c)},
 // 疯子: raises and barrels constantly with any two cards, oversized.
 maniac(s,r){const c=ctx(s);
  if(c.pre){if(r()<.6)return raise(c,Math.max(s.current*3,c.bb*4));return c.strength>.1?passive(c):fold(c)}
  if(r()<.55)return raise(c,s.current+c.pot*(.8+r()*.6));
  if(c.owe&&c.strength<.2&&!c.draw&&c.owe>=c.l.max*.9)return fold(c);
  return passive(c)},
 // 石头: only premium starting hands, continues only with strong made hands, bets for value.
 rock(s,r){const c=ctx(s);
  if(c.pre){if(c.strength>=.78)return raise(c,Math.max(s.current*3,c.bb*3));if(c.strength>=.66&&c.frac<.15)return passive(c);return fold(c)}
  if(c.strength>=.75)return raise(c,s.current+c.pot*.75);
  if(c.strength>=.6)return c.frac<=.6?passive(c):fold(c);
  return fold(c)},
 // 最小加注党: loves min-raises and min-bets with medium hands, calls loosely, gives up to big bets.
 minraiser(s,r){const c=ctx(s);
  if(c.pre){if(c.strength>.45&&r()<.7)return raise(c,c.l.min);return c.strength>.25?passive(c):fold(c)}
  if(c.strength>.5&&r()<.7)return raise(c,c.l.min);
  if(c.owe&&c.frac>.7&&c.strength<.55)return fold(c);
  return passive(c)},
 // 不中就弃: calls wide preflop, then folds to any bet without a pair or draw; bets when it hits.
 fitfold(s,r){const c=ctx(s);
  if(c.pre){if(c.strength>.8&&r()<.6)return raise(c,s.current*3);return c.strength>.2?passive(c):fold(c)}
  const hit=c.strength>=.42||c.draw>0;
  if(!hit)return fold(c);
  if(c.strength>=.6&&r()<.6)return raise(c,s.current+c.pot*.6);
  return passive(c)}
};
export const HUMAN_OPPONENT_NAMES=Object.keys(HUMAN_OPPONENTS);
// Normalizes rule actions to what the engine accepts.
export function humanDecide(name,snapshot,rng){
 const d=HUMAN_OPPONENTS[name](snapshot,rng),l=snapshot.legal;
 if(d.action==='raise'&&(!l.canRaise||!Number.isInteger(d.target)||d.target>l.max||d.target<=snapshot.current||(d.target<l.min&&d.target!==l.max)))return l.owe?{action:'call'}:{action:'check'};
 if(d.action==='check'&&l.owe)return{action:'call'};
 if(d.action==='fold'&&!l.owe)return{action:'check'};
 return d;
}
