import {rouletteAct} from './roulette.mjs';
export function replayRouletteWagers(game,seat,actions,now){const draft=structuredClone(game);if(!Array.isArray(actions)||!actions.length||actions.length>32)throw Error('下注队列无效');for(const a of actions){if(!a||!['bet','remove','clear'].includes(a.action))throw Error('下注操作无效');rouletteAct(draft,seat,a.action,a.key,a.amount,now)}return draft}
