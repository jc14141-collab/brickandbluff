import {createRoom,pack,unpack,command,tick,snapshot,seatOf} from './rooms.mjs';
export class RoomStore{
 constructor(db){this.db=db}
 async list(auth,now){
 const rows=await this.db.prepare('SELECT state FROM game_rooms WHERE expires > ? ORDER BY created DESC LIMIT 200').bind(now).all();
 return {rooms:rows.results.map(row=>unpack(row.state)).filter(r=>r.seats.some(s=>!s.bot&&now-s.seen<120000)).map(r=>{const member=seatOf(r,auth)>=0,host=r.seats.find(s=>s.auth===r.host);return{id:r.id,mode:r.mode,name:host?.name??'朋友',count:r.seats.length,capacity:r.capacity,status:r.status,member,joinable:member||r.seats.length<r.capacity}})};
 }
 async create(auth,data,now){const count=await this.db.prepare('SELECT COUNT(*) AS n FROM game_rooms WHERE host = ? AND expires > ?').bind(auth,now).first();if((count?.n??0)>=20)throw Error('你创建的有效房间过多，请稍后再试');const r=createRoom(auth,data,now);await this.db.prepare('INSERT INTO game_rooms (id,host,version,state,expires,created) VALUES (?,?,0,?,?,?)').bind(r.id,auth,pack(r),r.expires,now).run();return snapshot(r,auth,now)}
 async room(id,auth,data,now){for(let attempt=0;attempt<8;attempt++){const row=await this.db.prepare('SELECT version,state,expires FROM game_rooms WHERE id = ?').bind(id).first();if(!row||row.expires<=now)throw Error('房间不存在或已过期');const r=unpack(row.state);let dirty=false;const i=seatOf(r,auth);if(i>=0&&now-r.seats[i].seen>10000){r.seats[i].seen=now;dirty=true}
 if(data){if(!/^[a-f0-9]{32}$/.test(data.requestId??''))throw Error('请求标识无效');const request=auth+':'+data.requestId;if(!r.requests.includes(request)){command(r,auth,data,now);r.requests.push(request);r.requests=r.requests.slice(-160);dirty=true}}
 if(i>=0||data?.kind==='join'){const host=r.seats.find(s=>s.auth===r.host);if(!host||now-host.seen>60000){const successor=r.seats.find(s=>!s.bot&&now-s.seen<25000);if(successor&&successor.auth!==r.host){r.host=successor.auth;r.seq++;dirty=true}}dirty=tick(r,now)||dirty}
 if(!dirty)return snapshot(r,auth,now);const result=await this.db.prepare('UPDATE game_rooms SET state = ?, host = ?, version = version + 1 WHERE id = ? AND version = ?').bind(pack(r),r.host??'',id,row.version).run();if(result.meta.changes)return snapshot(r,auth,now)}throw Error('牌桌正在同步，请重试')}
}
