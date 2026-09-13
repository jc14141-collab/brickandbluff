const portraits=[
 ['witch-room-portrait.jpg','星语法师与魔法书房'],
 ['engineer-room-portrait.webp','齿轮工匠与暖光工坊'],
 ['guardian-room-portrait.webp','星际守护与星空观测站'],
 ['ranger-room-portrait.webp','森林游侠与林间小屋']
];
export function mountCharacterMotion(host,role){
 const entry=portraits[role];if(!entry)return;
 host.classList.add('has-motion');host.removeAttribute('role');host.setAttribute('aria-label',entry[1]);
 const portrait=document.createElement('img');portrait.src='/media/'+entry[0];portrait.alt=entry[1];portrait.className='character-still';
 host.append(portrait);
}
