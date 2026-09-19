// 大老二 3D 桌面。复用掼蛋的四人牌桌与出牌动画，只把四条 / 同花顺映射到掼蛋的炸弹特效。
import {Guandan3D} from './guandan3d.mjs';

// 掼蛋的爆炸光环只认它自己的牌型名，这里把大老二的炸弹改写成对应名称。
const EFFECT={four:'bomb',straightflush:'kings'};

export class BigTwo3D extends Guandan3D{
  showPlays(plays,trick=0){
    return super.showPlays(plays.map(m=>m&&EFFECT[m.type]?{...m,type:EFFECT[m.type]}:m),trick);
  }
}
