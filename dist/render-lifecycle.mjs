// GPU resources belong to one table. Rebuild generated targets after context loss.
export function renderLifecycle(renderer,{restore=()=>{},resume=()=>{}}={}){
 const canvas=renderer.domElement;let lost=false,closed=false,last=-Infinity;
 const interval=(globalThis.navigator?.maxTouchPoints>0?1000/30:1000/60);
 const onLost=e=>{e.preventDefault();lost=true};
 const onRestored=()=>{if(closed)return;restore();lost=false;last=-Infinity;resume()};
 const visibility=()=>{last=-Infinity;if(!document.hidden&&!lost)resume()};
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);document.addEventListener('visibilitychange',visibility);
 return {ready(now=performance.now()){if(closed||lost||document.hidden||now-last<interval-.5)return false;last=now;return true},dispose(){if(closed)return;closed=true;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);document.removeEventListener('visibilitychange',visibility)}};
}
// Deduplicate resources, including material arrays, instancing buffers and shadow targets.
export function disposeScene(root,{materials=[],textures=[],geometries=[]}={}){
 const gs=new Set(geometries),ms=new Set(materials),ts=new Set(textures);
 root.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.shadow?.dispose();if(o.geometry)gs.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])ms.add(m)});
 for(const m of ms){for(const v of Object.values(m))if(v?.isTexture)ts.add(v);m.dispose()}
 for(const g of gs)g.dispose();for(const t of ts)t.dispose();
}
export function releaseRenderer(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}
