import {bindHandSwipe} from './hand-swipe.mjs';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {handCard} from './hand-card.mjs';
// 大老二界面。沿用掼蛋牌桌的 gd-* 样式类与布局，避免重复一整套 CSS。
import {BigTwoMatch,classify,beats,sortHand,rankText,moveLabel,TYPE_NAMES,BIGTWO_RULES,isLeadCard,CARD_VALUES,DEFAULT_CARD_VALUE,normalizeValue,bracketMultiplier,twoCount,finishBonus,storedValue} from './bigtwo.mjs';
import {chooseMove} from './bigtwo-strategy.mjs';
import {BigTwo3D} from './bigtwo3d.mjs';

const NAMES=['你','下家','对家','上家'];
const chips=n=>Math.round(n).toLocaleString('en-US');
const signed=n=>{const v=Math.round(n);return (v>0?'+':'')+v.toLocaleString('en-US')};
export {BIGTWO_RULES};

// 复用 .gd-card 的既有样式；大老二没有逢人配与级牌，因此不需要角标。
export function bigtwoCard(c,{selected=false,disabled=false,small=false}={}){
  return handCard(c,0,{selected,disabled,small,gilded:!small});
}

export class BigTwoUI{
  constructor(host,{onExit,onRules,toast,beep,role=0,reduced=false,network=null,roster=null,value=DEFAULT_CARD_VALUE,bank=0,onBank=null}={}){
    Object.assign(this,{host,onExit,onRules,toast,beep,reduced,network});
    this.match=new BigTwoMatch(undefined,normalizeValue(value));
    this.value=this.match.value;
    this.bank=Number(bank)||0;this.onBank=onBank;
    // 单人模式也走真实钱包：四家各自有一份桌面筹码，结算时按全下上限两两划转。
    // 电脑的筹码由系统补足，玩家这一份就是钱包余额。
    this.stacks=null;
    this.game=null;
    this.selected=new Set();this.choice=null;this.alive=true;this.busy=false;this.hintIndex=0;
    this.q=s=>host.querySelector(s);
    document.body.classList.add('in-game','guandan-game','bigtwo-game');
    host.innerHTML=`<section class="gd-room bt-room"><div class="gd-stage"><div class="gd-seat-labels"></div></div><header class="gd-heading"><div><small>THE BRICK CLUB / FIRST PERSON</small><h1>大老二 <span>四人各自为战</span></h1></div><button data-gfull>⛶ 全屏</button><button data-grules>玩法</button><button data-gexit>离开牌桌 ↗</button></header><div class="gd-score"></div><div class="gd-tableplay"></div><div class="gd-seat-plays gd-play-feed" aria-label="全桌出牌记录"></div><div class="gd-hand-area"></div><div class="gd-controls"></div><div class="gd-end"></div></section>`;
    this.q('[data-gexit]').onclick=()=>this.exit();
    this.q('[data-grules]').onclick=onRules;
    this.q('[data-gfull]').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('可使用浏览器全屏功能')}};
    try{this.scene=new BigTwo3D(this.q('.gd-stage'),{role,mode:'poker',roster:roster??[{seed:1512},{seed:4233},{seed:8215}],reduced,onSound:beep});this.scene.foreground.visible=false}catch(e){console.warn('Big Two WebGL unavailable',e);this.toast('此设备无法显示 3D，仍可使用完整选牌界面')}
    // 单人模式先停在开局设置，让玩家选好每张牌的价值再发牌；联机模式由服务端房间驱动。
    if(!network)this.render();
  }

  // 钱包余额由外部（大厅）同步进来，单人结算后回写。
  syncBank(n){this.bank=Number(n)||0;return this.bank}

  // 一副结束只结算一次。必须缓存结果：BigTwoMatch.settle 每次都会用「当前」桌面筹码重算，
  // 若回写筹码后再调一次，得到的数字会与已经入账的那份不一致。
  settleRound(){
    if(this.network)return this.match.settle();
    if(this.settledResult)return this.settledResult;
    const r=this.match.settle(this.stacks);
    if(!r)return null;
    this.settledResult=r;
    this.stacks=this.stacks.map((b,i)=>Math.max(0,Math.round(b+r.scores[i])));
    this.bank=this.stacks[0];
    this.onBank?.(this.bank);
    return r;
  }

  // 每张牌的价值只在开局前设定一次。一旦本桌开打（round>0），中途结算也不再允许改动，
  // 否则同一桌的前后两副会用不同口径结算，累计筹码就失去了可比性。
  // 联机时牌值是房间设置：只有房主能改，改动经服务端广播回来后才算数（这里先乐观更新）。
  setValue(v){
    const next=normalizeValue(v);
    if(this.match.round>0)return this.value;
    if(this.network){
      if(!this.network.host)return this.value;
      if(this.network.canSend&&!this.network.canSend())return this.value;
      this.value=next;
      this.network.send({kind:'value',value:next});
      return this.value;
    }
    this.value=this.match.setValue(next);
    return this.value;
  }

  // 联机时牌值由服务端权威下发，每收到一次快照就同步一次显示。
  syncValue(v){const n=storedValue(v);if(n!==this.value)this.value=n;return this.value}

  // 只有「开局前」且是单人模式或房主，才可以改牌值；开局后一律只读。
  canPickValue(){return this.match.round===0&&(!this.network||!!this.network.host)}

  start(){
    if(this.network){this.network.next();return}
    // 钱包见底就不能再上桌，和服务端的准入条件保持一致。
    if(this.bank<=0){this.toast?.('筹码不足，请联系管理员。');return}
    this.selected.clear();this.choice=null;this.hintIndex=0;this.playSignature=null;
    this.settledResult=null;
    // 每副重新摆筹码：玩家带入钱包余额，三位电脑按牌值补足到不会一局就被打穿的深度。
    const botStack=Math.max(2000,this.value*200);
    this.stacks=[this.bank,botStack,botStack,botStack];
    this.game=this.match.start();
    this.message='持方块 3 者先出，首手必须包含方块 3。';
    this.busy=false;this.render();this.run();
  }

  // 选中的牌若能组成牌型、且能压过桌面，返回唯一解；大老二不存在多种解释。
  options(){
    const g=this.game,cards=g.hands[0].filter(c=>this.selected.has(c.id));
    if(!cards.length)return[];
    const m=classify(cards);
    if(!m)return[];
    if(g.opening&&!cards.some(isLeadCard))return[];
    return beats(m,g.target,g.opts)?[m]:[];
  }

  // 选牌非法时给出具体原因，而不是笼统一句「无法出牌」。
  badPickText(cards){
    if(cards.length===3)return'三条不可出 · 只能出 1、2 或 5 张';
    if(cards.length===4)return'只能出 1、2 或 5 张';
    if(cards.length>5)return'一次最多出 5 张';
    return'当前选牌无法出牌';
  }

  valuePicker(compact=false){
    return`<label class="bt-value-picker">每张牌价值 <select data-btvalue aria-label="每张牌价值">${CARD_VALUES.map(v=>`<option value="${v}" ${v===this.value?'selected':''}>${v} 筹码 / 张</option>`).join('')}</select></label>`;
  }

  // 单人开局设置：选牌值 → 发牌。结算规则在这里先说清楚。
  setupMarkup(){
    return`<div class="gd-result bt-setup"><h2>开局设置</h2>
      <p>先选好<strong>每张牌的价值</strong>（开局后本桌不再变更）。结算按两两差额支付：牌多的一方向牌少的支付「张数差 × 牌值」，再乘上你自己的倍数 —— 剩 1–9 张 ×1、10–12 张 ×2、13 张（一张没出）×4，手上每保留一张 2 再翻一倍。赢家最后一手若是<strong>四条</strong>或<strong>同花顺</strong>，所有输家本局结算额整体再翻一倍。</p>
      ${this.valuePicker()}
      <p class="bt-hint">当前：每张 <strong>${this.value}</strong> 筹码 · 开局后不再变更 · 最坏情况（13 张 + 四张 2 + 对手四条收尾）单家支出可达 ${chips(13*this.value*4*16*2)} 筹码</p>
      <div><button class="gd-play-button" data-btstart>入座，发牌 ↗</button></div></div>`;
  }

  render(){
    if(!this.alive)return;
    if(!this.game){this.network?this.renderWaiting():this.renderSetup();return}
    const g=this.game,canSelect=!g.done&&!this.busy&&!this.autoplay&&g.turn===0;
    const opts=this.options(),chosen=opts[0]??null;
    this.choice=chosen?.key??null;
    if(this.dealRound!==this.match.round){this.dealRound=this.match.round;if(!g.actions.length)this.beep?.('deal')}

    this.q('.gd-score').innerHTML=`<div><span class="gd-level">大老二</span><b>第 ${this.match.round} 副 · 各自为战</b><small>♠&gt;♥&gt;♣&gt;♦ · 2 最大 · 同花压顺子 · 禁三条 · 每张 ${this.value} 筹码</small></div><details><summary>本副记录</summary><div>${g.actions.slice(-18).map(a=>`<p>${(this.names??NAMES)[a.seat]}：${a.pass?'不出':a.move+' '+a.cards.map(c=>c.s+rankText(c.r)).join(' ')}</p>`).join('')||'<p>等待首家出牌</p>'}</div></details>`;

    this.q('.gd-seat-labels').innerHTML=[1,2,3].map(i=>`<div data-seat-label="${i}" data-at-head="true" class="gd-seat ${!g.done&&g.turn===i?'active':''}"><strong>${(this.names??NAMES)[i]}</strong><span>${this.autoplaySeats?.[i]?'托管 · ':''}${g.hands[i].length?'余 '+g.hands[i].length+' 张':'已出完'}</span><small>◉ ${chips(this.stacks?.[i]??0)}</small></div>`).join('');

    const target=g.target;
    this.scene?.showPlays(g.last,g.trick);
    this.scene?.showTurn(g.turn,g.done);
    const hint=g.opening&&g.turn===0?'首手必须包含方块 3':target?'轮到你接牌':'轮到你领出新一轮';
    this.q('.gd-tableplay').innerHTML=`<div class="gd-turn-message" role="status" aria-live="polite">${g.done?'本副结束':this.busy?(this.names??NAMES)[g.turn]+'正在思考…':g.turn===0?(this.autoplay?'托管中 · 电脑代为出牌':hint):(this.names??NAMES)[g.turn]+'出牌'}</div>`;

    this.renderPlays();

    const hand=sortHand(g.hands[0]);
    const scroll=this.q('.gd-hand-scroll')?.scrollLeft??0;
    this.q('.gd-hand-area').innerHTML=`<div class="gd-hand-heading"><b>你的手牌 <span>${hand.length} 张</span></b><span>${canSelect?'点击选牌 · 长按滑动多选':'等待行动'}</span><span class="gd-team-note">◉ ${chips(this.stacks?.[0]??this.bank)} · 各自为战</span></div><div class="gd-hand-scroll"><div class="gd-hand-row" style="--count:${Math.max(1,hand.length)}">${hand.map(c=>bigtwoCard(c,{selected:this.selected.has(c.id),disabled:!canSelect})).join('')}</div></div>`;
    this.q('.gd-hand-scroll').scrollLeft=scroll;

    this.q('.gd-controls').innerHTML=`<div class="gd-selection"><strong>${chosen?moveLabel(chosen):this.selected.size?this.badPickText(g.hands[0].filter(c=>this.selected.has(c.id))):'已选 0 张'}</strong><small>${this.message}</small></div><div class="gd-actions"><button data-btauto aria-pressed="${!!this.autoplay}" ${g.done||this.autoPending?'disabled':''}>${this.autoplay?'取消托管':'托管'}</button><button data-gclear ${!canSelect?'disabled':''}>取消</button><button data-ghint ${!canSelect?'disabled':''}>提示</button><button data-gpass ${!canSelect||!target?'disabled':''}>不出</button><button class="gd-play-button" data-gplay ${!canSelect||!chosen?'disabled':''}>出牌 ↗</button></div>`;
    this.swipeCleanup??=bindHandSwipe(this);this.host.querySelectorAll('[data-gcard]').forEach(b=>b.onclick=()=>{const id=+b.dataset.gcard;this.selected.has(id)?this.selected.delete(id):this.selected.add(id);this.render()});
    this.q('[data-btauto]').onclick=()=>this.toggleAutoplay();
    this.q('[data-gclear]').onclick=()=>{this.selected.clear();this.render()};
    this.q('[data-ghint]').onclick=()=>this.hint();
    this.q('[data-gpass]').onclick=()=>this.play(true);
    this.q('[data-gplay]').onclick=()=>this.play(false);

    this.q('.gd-end').innerHTML=g.done?this.resultMarkup():'';
    if(g.done){
      this.q('[data-gnext]').onclick=()=>this.start();
      this.q('[data-gback]').onclick=()=>this.onExit();
      // 结算面板不再提供牌值选择器：每张牌的价值只在开局前设定一次。
    }
  }

  // 联机模式还没收到开局数据时的占位：牌值由房主在房间里设定，这里不给本地选择器。
  renderWaiting(){
    this.q('.gd-score').innerHTML=`<div><span class="gd-level">大老二</span><b>等待开局</b><small>♠&gt;♥&gt;♣&gt;♦ · 2 最大 · 同花压顺子 · 禁三条</small></div>`;
    this.q('.gd-seat-labels').innerHTML='';
    this.q('.gd-tableplay').innerHTML='<div class="gd-turn-message">等待房主开始本局…</div>';
    this.q('.gd-seat-plays').innerHTML='';
    this.q('.gd-hand-area').innerHTML='';
    this.q('.gd-controls').innerHTML='';
    this.q('.gd-end').innerHTML='';
  }

  // 未开局时的空牌桌：只渲染设置面板。
  renderSetup(){
    this.q('.gd-score').innerHTML=`<div><span class="gd-level">大老二</span><b>等待开局</b><small>♠&gt;♥&gt;♣&gt;♦ · 2 最大 · 同花压顺子 · 禁三条</small></div>`;
    this.q('.gd-seat-labels').innerHTML='';
    this.q('.gd-tableplay').innerHTML='<div class="gd-turn-message">选好每张牌的价值，然后发牌。</div>';
    this.q('.gd-seat-plays').innerHTML='';
    this.q('.gd-hand-area').innerHTML='<div class="gd-hand-heading"><b>你的手牌 <span>未发牌</span></b><span>开局后显示</span><span class="gd-team-note">无队友 · 各自为战</span></div>';
    this.q('.gd-controls').innerHTML='';
    this.q('.gd-end').innerHTML=this.setupMarkup();
    this.q('[data-btstart]').onclick=()=>this.start();
    this.host.querySelectorAll('[data-btvalue]').forEach(b=>b.onchange=()=>{this.setValue(+b.value);this.render()});
  }

 renderPlays(){const g=this.game,m=g.target,signature=JSON.stringify([g.owner,m,g.trick,g.actions.length,g.tributeLog]);if(signature===this.playSignature)return;this.playSignature=signature;
 const previousScroll=this.q('.gd-round-log')?.scrollTop??0;
 const current=m&&g.owner>=0?`<div class="gd-feed-entry latest"><strong> ${(this.names??NAMES)[g.owner]}</strong><span>当前最大 · ${moveLabel(m)}</span><div class="gd-feed-cards">${m.cards.map(c=>'<span class="gd-feed-card '+(['♥','♦'].includes(c.s)||c.r===16?'red':'')+'" aria-label="'+(c.r>14?'':c.s)+rankText(c.r)+'"><b>'+rankText(c.r)+'</b><i>'+(c.r>14?'★':c.s)+'</i></span>').join('')}</div></div>`:'<span class="gd-feed-empty">等待领出新一轮</span>';
 const history=[...(g.actions??[])].reverse().map(a=>'<p><strong>'+(this.names??NAMES)[a.seat]+'</strong> · '+(a.pass?'不出':escapeHtml(a.move)+' <span>'+a.cards.map(c=>escapeHtml((c.r>14?'':c.s)+rankText(c.r))).join(' ')+'</span>')+'</p>').join('');
 this.q('.gd-seat-plays').innerHTML='<section class="gd-log-half"><strong class="gd-panel-title">牌局记录</strong><div class="gd-round-log" tabindex="0" aria-label="滚动查看牌局记录">'+(history||'<p>等待首家出牌</p>')+(g.tributeLog??[]).map(t=>'<p>'+escapeHtml(t)+'</p>').join('')+'</div></section><section class="gd-current-half" aria-label="当前最大出牌">'+current+'</section>';
 const log=this.q('.gd-round-log');if(log)log.scrollTop=previousScroll;

 }

  // 结算面板：显示每家的筹码输赢、累计筹码，以及翻倍与全下的说明。
  resultMarkup(){
    const r=this.settleRound(),g=this.game,names=this.names??NAMES;
    if(!r)return'';
    const won=r.winner===0;
    const notes=[];
    if(r.bonus&&r.bonus!==1)notes.push(`${names[r.winner]}最后一手是<strong>${TYPE_NAMES[g.finishType]??''}</strong>，所有输家本局结算额整体翻倍`);
    if(r.capped)notes.push('有玩家桌面筹码不足，已按<strong>全下</strong>结算（最多赔光桌面筹码）');
    const rows=names.map((n,i)=>{
      const d=r.scores[i],t=r.total[i],m=r.mults?.[i];
      return`<div class="bt-settle-row ${i===r.winner?'winner':''}"><b>${n}</b><span class="bt-delta ${d>0?'up':d<0?'down':''}">${signed(d)}</span><small>累计 ${signed(t)}${m>1?` · ×${m}`:''}</small></div>`;
    }).join('');
    // 逐笔列出「谁付给谁」。默认折叠，让结算页保持简洁；
    // 摘要里点明这是「两两差额」，避免只看四个净额时误读成「只和赢家结算」。
    const pairs=(r.pairs??[]).slice().sort((a,b)=>b.amount-a.amount).map(p=>{
      const parts=[`差 ${p.diff} 张`,`× ${r.value}`];
      if(p.bracket>1)parts.push(`区间 ×${p.bracket}`);
      if(p.twos>0)parts.push(`2 ×${2**p.twos}`);
      if(r.bonus>1)parts.push(`收尾 ×${r.bonus}`);
      return`<p class="${p.reduced?'reduced':''}"><b>${names[p.from]}</b><i>→</i><b>${names[p.to]}</b><span>${parts.join(' · ')}${p.reduced?' · 全下缩减':''}</span><em>${chips(p.amount)}</em></p>`;
    }).join('');
    const withWinner=(r.pairs??[]).filter(p=>p.from===r.winner||p.to===r.winner).length;
    const crossLoser=(r.pairs??[]).length-withWinner;
    const breakdown=pairs?`<details class="bt-pairs"><summary>支付明细 · ${r.pairs.length} 笔两两差额${crossLoser?`（${crossLoser} 笔发生在输家之间）`:''}</summary><div>${pairs}</div></details>`:'';
    // 每张牌的价值在开局前定好，本桌中途结算不再提供修改入口。
    const next=`<div class="bt-next"><span>每张牌价值</span><b>${r.value} 筹码 · 开局已定${this.network?' · 由房主设定':''}</b></div>`;
    return`<div class="gd-result gd-review"><div class="gd-review-hands">${g.hands.map((hand,i)=>`<section><b>${names[i]} · 剩余 ${hand.length} 张${twoCount(hand)?` · 手上 ${twoCount(hand)} 张 2（×${2**twoCount(hand)}）`:''}</b><div>${sortHand(hand).map(c=>bigtwoCard(c,{small:true})).join('')||'<span>已出完</span>'}</div></section>`).join('')}</div><small>本副结束 · 剩余手牌公开 · 每张牌 ${r.value} 筹码</small><h2>${won?'你赢了这一副':names[r.winner]+' 先出完'}</h2><div class="bt-settle">${rows}</div>${breakdown}${notes.length?`<p class="bt-note">${notes.join('<br>')}</p>`:''}${next}<div><button data-gback>返回大厅</button><button class="gd-play-button" data-gnext>下一副 ↗</button></div></div>`;
  }

  async toggleAutoplay(){
    if(this.autoPending||this.game?.done)return;
    const enabled=!this.autoplay;this.autoPending=true;this.render();
    try{if(this.network)await this.network.send({kind:'autoplay',enabled});else this.autoplay=enabled;this.selected.clear()}
    catch{}finally{this.autoPending=false;if(this.alive)this.render()}
    if(!this.network&&this.autoplay&&!this.busy)this.run();
  }

  async hint(){
    if(this.busy||!this.game)return;
    const g=this.game;this.busy=true;this.render();
    let recommended=null;
    try{recommended=chooseMove(g.snapshot(0))}catch{}
    if(!this.alive||this.game!==g)return;
    this.busy=false;
    const all=g.legal(0);
    if(!all.length){this.message='没有能压过的牌，可以选择不出。';this.selected.clear();this.render();return}
    const ordered=recommended?[recommended,...all.filter(m=>m.key!==recommended.key)]:all;
    const m=ordered[this.hintIndex++%ordered.length];
    this.selected=new Set(m.cards.map(c=>c.id));
    this.render();
  }

  async play(pass){
    if(this.busy||!this.game||this.game.done)return;
    if(this.network){
      this.busy=true;
      try{await this.network.send({ids:pass?[]:[...this.selected],key:pass?null:this.choice});this.selected.clear();this.choice=null;this.hintIndex=0}
      catch{}
      finally{this.busy=false;if(this.alive)this.render()}
      return;
    }
    try{
      if(this.game.turn!==0)return;
      const m=this.game.act(0,pass?[]:[...this.selected]);
      this.scene?.react(0);
      this.beep(m&&m.tier?'win':'tap');
      this.message=m?moveLabel(m):'你选择不出';
      this.selected.clear();this.choice=null;this.hintIndex=0;
      if(this.game.done)this.settleRound();
      this.render();
      await this.run();
    }catch(e){this.toast(e.message)}
  }

  async pause(ms){await new Promise(r=>{this.waitResolve=r;this.timer=setTimeout(()=>{this.waitResolve=null;r()},this.reduced?80:ms)})}

  // 单人练习：驱动三家电脑直到本副结束或轮到你。
  async run(){
    if(this.network||this.busy||!this.game)return;
    const g=this.game;
    while(this.alive&&this.game===g&&!g.done){
      if(g.turn===0&&!this.autoplay){this.busy=false;this.render();return}
      this.busy=true;this.render();
      const i=g.turn,snapshot=g.snapshot(i);
      const [m]=await Promise.all([Promise.resolve().then(()=>chooseMove(snapshot)).catch(()=>null),this.pause(950)]);
      if(!this.alive||this.game!==g)return;
      if(i===0&&!this.autoplay){this.busy=false;this.render();return}
      g.act(i,m?m.cards.map(c=>c.id):[]);
      this.scene?.react(i);
      this.beep(m&&m.tier?'win':'tap');
      this.message=(this.names??NAMES)[i]+' · '+(m?moveLabel(m):'不出');
      if(g.done)this.settleRound();
      this.render();
      await this.pause(450);
    }
    if(this.alive&&this.game===g){this.busy=false;this.render()}
  }

  exit(){
    if(this.network){this.network.exit();return}
    if(this.game&&!this.game.done&&!confirm('本副尚未结算，离开将直接作废这一副，钱包金额不变。确定离开？'))return;
    this.onExit();
  }

  destroy(){this.swipeCleanup?.();
    this.alive=false;
    clearTimeout(this.timer);this.waitResolve?.();
    this.scene?.destroy();
    document.body.classList.remove('guandan-game','bigtwo-game');
  }
}
