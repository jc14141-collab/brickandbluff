import {mountCharacterMotion} from './character-motion.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function arrangeLobby(root,roles,role,data){
 root.id='app';
 const surface=document.createElement('div');surface.id='lobbySurface';
 const head=root.querySelector('.lobbyhead'),setup=root.querySelector('.setup'),left=setup.firstElementChild,settings=setup.lastElementChild,rooms=root.querySelector('#friendRooms');
 surface.append(head);const grid=document.createElement('div');grid.className='lobby-grid';surface.append(grid);
 left.className='lobby-character';settings.className='lobby-settings';
 left.querySelector('.sectionlabel small').textContent='CHARACTERS';
 left.querySelector('.lobby-note')?.remove();
 const preview=document.createElement('div');preview.className='lobby-portrait';preview.style.setProperty('--pos',role*100/3+'%');preview.setAttribute('role','img');preview.setAttribute('aria-label',roles[role].name+'角色全身像');
 left.querySelector('.selected-panel').before(preview);
 const center=document.createElement('section');center.className='lobby-community';center.append(rooms);const players=document.createElement('section');players.id='lobbyPlayers';center.append(players);
 grid.append(left,center,settings);root.replaceChildren(surface);mountCharacterMotion(preview,role,root);renderOnline(data);
}
export function renderOnline(data){const host=document.querySelector('#lobbyPlayers');if(!host)return;const players=(data?.players??[]).filter(p=>p.online);host.innerHTML=`<div class="lobby-list-title"><h2>在线玩家</h2><span>${players.length} 人在线</span></div><div class="lobby-player-list">${players.map(p=>`<article><div class="lobby-player-avatar" style="--pos:${Math.max(0,Math.min(3,p.role))*100/3}%"></div><strong>${esc(p.name)}${p.id===data.player?.id?' <small>· 你</small>':''}</strong><span class="lobby-player-chips">◉ ${Number(p.totalChips??0).toLocaleString()}</span><span class="online-dot">在线</span></article>`).join('')||'<p>暂无在线玩家</p>'}</div>`}
