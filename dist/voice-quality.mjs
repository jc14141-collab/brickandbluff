// Mono speech keeps mobile bandwidth moderate while allowing full-band Opus audio.
export const VOICE_BITRATE=64000;
export const voiceCapture={audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:{ideal:1},sampleRate:{ideal:48000},latency:{ideal:.02}},video:false};
export function preferVoiceCodec(transceiver){try{const codecs=globalThis.RTCRtpSender?.getCapabilities?.('audio')?.codecs;if(codecs?.some(c=>c.mimeType.toLowerCase()==='audio/opus'))transceiver?.setCodecPreferences?.([...codecs.filter(c=>c.mimeType.toLowerCase()==='audio/opus'),...codecs.filter(c=>c.mimeType.toLowerCase()!=='audio/opus')])}catch{ /* Older Safari versions keep their supported default codecs. */ }}
export function voiceDescription(description){
 const lines=description.sdp.split(/\r?\n/);let audio=false,start=0;
 for(let i=0;i<=lines.length;i++){
  if(i===lines.length||lines[i].startsWith('m=')){
   if(audio){const block=lines.slice(start,i),opus=block.find(l=>/^a=rtpmap:\d+ opus\/48000/i.test(l));if(opus){const payload=opus.match(/^a=rtpmap:(\d+)/)[1],prefix='a=fmtp:'+payload+' ',index=block.findIndex(l=>l.startsWith(prefix)),params=new Map((index<0?'':block[index].slice(prefix.length)).split(';').filter(Boolean).map(p=>p.trim().split('=')));
    for(const [k,v]of Object.entries({maxaveragebitrate:VOICE_BITRATE,maxplaybackrate:48000,'sprop-maxcapturerate':48000,stereo:0,'sprop-stereo':0,useinbandfec:1,usedtx:0}))params.set(k,String(v));
    const fmtp=prefix+[...params].map(([k,v])=>k+'='+v).join(';');if(index>=0)lines[start+index]=fmtp;else{lines.splice(start+block.indexOf(opus)+1,0,fmtp);i++}
   }}
   if(i<lines.length){audio=lines[i].startsWith('m=audio ');start=i+1}
  }
 }
 return{type:description.type,sdp:lines.join('\r\n')};
}
export async function tuneVoiceSender(sender){if(!sender?.track)return;try{const params=sender.getParameters();if(!params.encodings?.length)return;for(const encoding of params.encodings)encoding.maxBitrate=VOICE_BITRATE;await sender.setParameters(params)}catch{ /* Unsupported tuning must never prevent a call or microphone toggle. */ }}
