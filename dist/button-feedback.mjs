// Capture feedback before game handlers or network requests; never dispatch an action here.
export function installButtonFeedback(play,root=document){
 const pressed=new Map(),recent=new WeakMap();
 const button=e=>{const b=e.target?.closest?.('button,[role="button"],input[type="submit"],input[type="button"]');return b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'?b:null};
 const down=(b,key)=>{b.classList.add('button-pressed');pressed.set(key,b);recent.set(b,performance.now());play('press')};
 const release=key=>{const b=pressed.get(key);if(!b)return;pressed.delete(key);setTimeout(()=>{if(![...pressed.values()].includes(b))b.classList.remove('button-pressed')},70)};
 root.addEventListener('pointerdown',e=>{if(e.button!==0)return;const b=button(e);if(b)down(b,e.pointerId)},{capture:true,passive:true});
 for(const type of ['pointerup','pointercancel'])root.addEventListener(type,e=>release(e.pointerId),{capture:true,passive:true});
 root.addEventListener('keydown',e=>{if(e.repeat||!['Enter',' '].includes(e.key))return;const b=button(e);if(b)down(b,'keyboard')},true);
 root.addEventListener('keyup',()=>release('keyboard'),true);
 root.addEventListener('click',e=>{const b=button(e);if(b&&performance.now()-(recent.get(b)??-1000)>400){down(b,'activation');release('activation')}},true);
 globalThis.addEventListener?.('blur',()=>{for(const b of pressed.values())b.classList.remove('button-pressed');pressed.clear()});
}
