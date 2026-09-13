const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
document.documentElement.classList.toggle('installed-app',standalone);
if(!standalone){
 const button=document.createElement('button');button.className='navlink app-install';button.textContent='添加到主屏幕';
 document.querySelector('.topbar nav')?.append(button);
 const dialog=document.createElement('dialog');dialog.className='app-install-help';
 dialog.innerHTML='<h2>把牌局放到主屏幕</h2><ol><li>在 iPhone / iPad 的 Safari 中打开本网站；安卓手机可使用浏览器的“安装应用”或“添加到主屏幕”。</li><li>点分享按钮，选择“添加到主屏幕”。</li><li>如果出现“作为 Web App 打开”，保持开启，再点“添加”。</li></ol><p>从“积木牌局”图标进入即可独立游玩。需要联网，横屏更舒适。首次打开若提示设备待批准，请联系管理员。</p><form method="dialog"><button>知道了</button></form>';
 document.body.append(dialog);button.onclick=()=>dialog.showModal();
}
// Resize only when viewport geometry changes; no extra work in the render loop.
const root=document.documentElement;
let frame;
function fit(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
 root.style.setProperty('--app-height',(window.visualViewport?.height??innerHeight)+'px');
})}
window.visualViewport?.addEventListener('resize',fit);window.addEventListener('resize',fit);fit();
const phoneScreen=()=>matchMedia('(pointer: coarse)').matches&&Math.min(screen.width,screen.height)<600;
const rotate=document.createElement('div');rotate.id='phoneRotate';rotate.innerHTML='<div><b>请横屏游玩</b><p>将手机横过来，完整显示牌桌和操作按钮。<br>若未旋转，请关闭手机的竖屏锁定。</p><button>进入横屏</button></div>';document.body.append(rotate);
rotate.querySelector('button').onclick=async()=>{try{await document.documentElement.requestFullscreen?.();await screen.orientation?.lock?.('landscape')}catch{}};
function phoneLayout(){document.documentElement.classList.toggle('phone-device',phoneScreen())}phoneLayout();window.addEventListener('resize',phoneLayout);
