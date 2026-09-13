import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {build,transform} from 'esbuild';
await fs.mkdir('.build',{recursive:true});
const client=await build({entryPoints:['dist/app.mjs','dist/app-shell.mjs'],outdir:'.build/client',entryNames:'[name]-[hash]',chunkNames:'chunks/[name]-[hash]',bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',minify:true,write:false,metafile:true});
await fs.writeFile('.build/client-meta.json',JSON.stringify(client.metafile));
const assets={};
const mime=key=>key.endsWith('.html')?'text/html; charset=utf-8':key.endsWith('.css')?'text/css; charset=utf-8':/\.(mjs|js)$/.test(key)?'text/javascript; charset=utf-8':key.endsWith('.woff2')?'font/woff2':key.endsWith('.webp')?'image/webp':key.endsWith('.png')?'image/png':/\.jpe?g$/.test(key)?'image/jpeg':key.endsWith('.mp4')?'video/mp4':key.endsWith('.webmanifest')?'application/manifest+json':'text/plain; charset=utf-8';
function add(key,input){const bytes=Buffer.from(input),hash=createHash('sha256').update(bytes).digest('hex').slice(0,24),gzip=/\.(html|css|mjs|js|txt|webmanifest)$/.test(key);assets[key]={hash,size:bytes.length,type:mime(key),gzip,data:(gzip?gzipSync(bytes,{level:9}):bytes).toString('base64')}}
for(const file of client.outputFiles)add('/built/'+path.relative(path.resolve('.build/client'),file.path).replaceAll('\\','/'),file.contents);
let html=await fs.readFile('dist/index.html','utf8'),css='';
for(const match of html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g))css+='\n'+await fs.readFile('dist/'+match[1].replace(/^\//,''),'utf8');
// Root-relative URLs survive relocation of the combined sheet into /built/.
css=css.replace(/url\(\s*(['"]?)(?!data:|https?:|\/|#)([^)'"\s]+)\1\s*\)/g,(_,q,url)=>'url('+q+'/'+url.replace(/^\.\//,'')+q+')');
css=(await transform(css,{loader:'css',minify:true})).code;
const cssName='/built/styles-'+createHash('sha256').update(css).digest('hex').slice(0,16).toUpperCase()+'.css';add(cssName,css);
let first=true;html=html.replace(/<link rel="stylesheet" href="[^"]+">/g,()=>{if(!first)return '';first=false;return '<link rel="stylesheet" href="'+cssName+'">'});
for(const [file,meta] of Object.entries(client.metafile.outputs)){if(!meta.entryPoint)continue;const source=path.basename(meta.entryPoint);html=html.replace('src="'+(source==='app-shell.mjs'?'/':'')+source+'"','src="/built/'+path.basename(file)+'"')}
add('/index.html',html);
async function collect(dir,prefix=''){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||['server','client'].includes(entry.name))continue;const filename=path.join(dir,entry.name),key=prefix+'/'+entry.name;if(entry.isDirectory())await collect(filename,key);else if(/\.(html|css|mjs|js|png|webp|jpg|jpeg|txt|woff2|webmanifest|mp4)$/.test(entry.name)){
 if(key==='/index.html')continue;
 if(key.endsWith('.png')&&await fs.access(filename.replace(/\.png$/,'.webp')).then(()=>true,()=>false))continue;
 add(key,await fs.readFile(filename));
}}}
await collect('dist');
// Stable URLs are retained for web workers and existing open tabs, with ETag revalidation.
await fs.writeFile('.build/assets.mjs','export default '+JSON.stringify(assets));
await build({entryPoints:['server/worker.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
console.log(JSON.stringify({assets:Object.keys(assets).length,workerBytes:(await fs.stat('dist/server/index.js')).size,clientChunks:client.outputFiles.length}));
