import {staticResponse} from './static-response.mjs';
import assets from '../.build/assets.mjs';
import {Club} from './club.mjs';
import {isAdmin,adminLogin} from './admin-auth.mjs';

// Platform authentication remains intact; device approval is an additional scope.
async function deviceScope(req,who){if(!who.auth.startsWith('platform:'))return who;const saved=req.headers.get('cookie')?.match(/(?:^|;\s*)bb_session=([a-f0-9]{64})(?:;|$)/)?.[1],token=saved||crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return{auth:who.auth+':device:'+Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join(''),cookie:saved?null:'bb_session='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000'}}
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
async function identity(req){const platform=req.headers.get('oai-authenticated-user-id');if(platform)return{auth:'platform:'+platform,cookie:null};const cookie=req.headers.get('cookie')?.match(/(?:^|;\s*)bb_session=([a-f0-9]{64})(?:;|$)/)?.[1],token=cookie||crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return{auth:'guest:'+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join(''),cookie:cookie?null:'bb_session='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000'}}
export default{async fetch(req,env){const url=new URL(req.url);if(url.pathname.startsWith('/access/'))return new Response(null,{status:303,headers:{Location:'/', 'Cache-Control':'no-store'}});if(url.pathname.startsWith('/api/')){try{if(!env.DB)return json({error:'房间服务尚未就绪'},503);const who=await deviceScope(req,await identity(req)),headers=who.cookie?{'Set-Cookie':who.cookie}:{};if(!['GET','POST'].includes(req.method))return json({error:'不支持的请求'},405);let body=null;if(req.method==='POST'){if(req.headers.get('origin')!==url.origin)return json({error:'请求来源不正确'},403);if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'请求格式错误'},415);const raw=await req.text();if(raw.length>8192)return json({error:'请求过大'},413);body=JSON.parse(raw)}const store=new Club(env.DB),now=Date.now(),admin=await isAdmin(req,env,who.auth,now);
if(req.method==='GET'&&url.pathname==='/api/session'){const result=await store.session(who.auth,req.headers.get('user-agent'),now);result.admin=admin;return json(result,200,headers)}
if(req.method==='POST'&&url.pathname==='/api/profile')return json(await store.profile(who.auth,body,now),200,headers);
if(req.method==='POST'&&url.pathname==='/api/admin/login'){headers['Set-Cookie']=await adminLogin(req,env,who.auth,body.password,now);return json({ok:true},200,headers)}
if(req.method==='POST'&&url.pathname==='/api/admin/logout'){headers['Set-Cookie']='__Host-bb_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';return json({ok:true},200,headers)}
if(url.pathname==='/api/admin'){if(!admin)return json({error:'Administrator login required'},403,headers);return json(await store.admin(who.auth,body,now),200,headers)}
if(req.method==='GET'&&url.pathname==='/api/rooms')return json(await store.list(who.auth,now),200,headers);
if(req.method==='POST'&&url.pathname==='/api/rooms')return json(await store.create(who.auth,body,now),200,headers);
const match=url.pathname.match(/^\/api\/rooms\/([a-f0-9]{32})$/);if(match)return json(await store.room(match[1],who.auth,body,now,url.searchParams.get('since')),200,headers);return json({error:'接口不存在'},404)}catch(e){return json({error:e instanceof SyntaxError?'请求格式错误':e.message},400)}}
 if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405});return staticResponse(req,assets)
}};
