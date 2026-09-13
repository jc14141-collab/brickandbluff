import test from 'node:test';import assert from 'node:assert/strict';
import {mediaResponse} from '../server/media-response.mjs';
const data=new Uint8Array([10,20,30,40,50]);
test('Safari range requests return the requested MP4 bytes and metadata',async()=>{
 for(const [range,expected,content]of[['bytes=1-2',[20,30],'bytes 1-2/5'],['bytes=3-',[40,50],'bytes 3-4/5'],['bytes=-2',[40,50],'bytes 3-4/5']]){
  const r=mediaResponse(new Request('https://game.test/media/witch.mp4',{headers:{range}}),data);assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),content);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],expected);
 }
});
test('invalid ranges are rejected; full video and HEAD requests retain correct length',async()=>{
 for(const range of ['bytes=7-9','bytes=4-1','bytes=-0','bytes=','bytes=0-1,3-4'])assert.equal(mediaResponse(new Request('https://game.test',{headers:{range}}),data).status,416);
 const head=mediaResponse(new Request('https://game.test',{method:'HEAD'}),data);assert.equal(head.headers.get('Content-Length'),'5');assert.equal((await head.arrayBuffer()).byteLength,0);
 const full=mediaResponse(new Request('https://game.test'),data);assert.equal(full.status,200);assert.equal(full.headers.get('Content-Type'),'video/mp4');assert.equal((await full.arrayBuffer()).byteLength,5);
});
