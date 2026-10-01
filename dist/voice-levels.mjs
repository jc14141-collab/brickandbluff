// Audio analysis is disconnected from speakers; remote playback remains on the audio element.
export class VoiceLevels{
 constructor(){this.sources=new Map()}
 context(){if(!this.ctx){const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;if(Audio)this.ctx=new Audio()}return this.ctx}
 resume(){try{this.context()?.resume().catch(()=>{})}catch{}}
 bind(id,stream){this.remove(id);try{const ctx=this.context();if(!ctx)return;const source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser();analyser.fftSize=256;source.connect(analyser);this.sources.set(id,{source,analyser,values:new Float32Array(256),volume:0})}catch{}}
 level(id){const s=this.sources.get(id);if(!s||this.ctx?.state!=='running')return 0;s.analyser.getFloatTimeDomainData(s.values);let sum=0;for(const v of s.values)sum+=v*v;const rms=Math.sqrt(sum/s.values.length);return s.volume=Math.max(rms,s.volume*.7)}
 remove(id){const s=this.sources.get(id);if(s){s.source.disconnect();s.analyser.disconnect();this.sources.delete(id)}}
 destroy(){for(const id of this.sources.keys())this.remove(id);this.ctx?.close().catch(()=>{});this.ctx=null}
}
