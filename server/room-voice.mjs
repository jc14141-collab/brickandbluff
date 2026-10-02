const check=(v,m)=>{if(!v)throw Error(m)};
export function voiceExchange(r,auth,data,now){
 const seat=r.seats.find(s=>s.auth===auth);check(['poker','blackjack','roulette','craps','guandan','bigtwo'].includes(r.mode)&&!r.solo,'语音仅用于多人房间');check(seat&&!seat.bot&&!seat.waiting,'请先入座再开启语音');check(data&&/^[a-f0-9]{32}$/.test(data.session??''),'语音会话无效');
 const v=r.voice??={members:{},messages:[]};const live=new Set(r.seats.filter(s=>s.auth&&!s.bot&&!s.waiting).map(s=>s.id));for(const [id,m]of Object.entries(v.members))if(!live.has(id)||now-m.seen>40000)delete v.members[id];v.messages=v.messages.filter(m=>now-m.at<60000&&Object.values(v.members).some(p=>p.session===m.to));
 if(data.leave){if(v.members[seat.id]?.session===data.session)delete v.members[seat.id];return{members:[],messages:[]}}
 const old=v.members[seat.id];if(!old||old.session!==data.session||now-old.seen>=10000||old.muted!==!!data.muted)v.members[seat.id]={session:data.session,muted:!!data.muted,seen:now};
 if(data.signal){const m=data.signal;check(/^[a-f0-9]{32}$/.test(m.id??''),'语音消息无效');check(Object.values(v.members).some(p=>p.session===m.to&&p.session!==data.session),'对方已离开语音');check(['offer','answer','candidate'].includes(m.payload?.type),'语音消息类型无效');check(JSON.stringify(m.payload).length<=6000,'语音消息过大');if(!v.messages.some(p=>p.id===m.id)){check(v.messages.length<400,'语音连接繁忙，请稍后重试');v.messages.push({id:m.id,from:data.session,to:m.to,payload:m.payload,at:now})}}
 return{members:Object.entries(v.members).map(([id,m])=>({id,...m})),messages:v.messages.filter(m=>m.to===data.session)};
}
