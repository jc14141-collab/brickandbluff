// Safari uses byte ranges to seek and start MP4 playback efficiently.
export function mediaResponse(req,bytes){
 const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 const range=req.headers.get('range');let start=0,end=bytes.length-1,status=200;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});
  start=m[1]?Number(m[1]):Math.max(0,bytes.length-Number(m[2]));end=m[1]?(m[2]?Math.min(Number(m[2]),end):end):end;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;
 }
 headers['Content-Length']=String(end-start+1);
 return new Response(req.method==='HEAD'?null:bytes.subarray(start,end+1),{status,headers});
}
