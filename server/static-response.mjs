import {mediaResponse} from './media-response.mjs';
const cache=new Map();
let retained=0;
const LIMIT=2*1024*1024;
function bytesFor(key,asset){
 if(cache.has(key)){const bytes=cache.get(key);cache.delete(key);cache.set(key,bytes);return bytes}
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 // Large assets (particularly video) must not accumulate in isolate memory.
 if(bytes.length<=256*1024){while(retained+bytes.length>LIMIT&&cache.size){const oldest=cache.keys().next().value;retained-=cache.get(oldest).length;cache.delete(oldest)}cache.set(key,bytes);retained+=bytes.length}
 return bytes;
}
export function staticResponse(req,assets){
 const url=new URL(req.url),key=url.pathname==='/'?'/index.html':url.pathname,asset=assets[key]??(key.endsWith('.png')?assets[key.replace(/\.png$/,'.webp')]:null);
 if(!asset)return new Response('Not found',{status:404});
 const etag='"'+asset.hash+'"';
 const immutable=/^\/built\/.+-[A-Z0-9]+\.(js|css)$/.test(key);
 const headers={'Content-Type':asset.type,'Cache-Control':immutable?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate',ETag:etag,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
 if(asset.gzip)headers.Vary='Accept-Encoding';
 if(req.headers.get('if-none-match')?.split(',').some(v=>v.trim()===etag||v.trim()==='W/'+etag||v.trim()==='*'))return new Response(null,{status:304,headers});
 if(req.method==='HEAD'&&!key.endsWith('.mp4')){if(!asset.gzip)headers['Content-Length']=String(asset.size);return new Response(null,{headers})}
 const bytes=bytesFor(key+':'+asset.hash,asset);
 if(key.endsWith('.mp4')){const response=mediaResponse(req,bytes);for(const [name,value] of Object.entries(headers))response.headers.set(name,value);return response}
 if(asset.gzip){
  if(/(?:^|,)\s*gzip\s*(?:,|$)/i.test(req.headers.get('accept-encoding')??'')){headers['Content-Encoding']='gzip';return new Response(bytes,{headers,encodeBody:'manual'})}
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),{headers});
 }
 return new Response(bytes,{headers});
}
