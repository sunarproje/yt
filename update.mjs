import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,readdir,unlink,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const exec=promisify(execFile);
const OUT=resolve('streams');
export function diagnose(error,stage){
 // Classify subprocess output without publishing URLs, signatures or account data.
 const details=String(error.stderr||'');
 let reason;
 if(/not a bot|confirm you.re not|sign in to confirm/i.test(details))reason='YouTube bot doğrulaması veya oturum açma istiyor.';
 else if(/requested format is not available/i.test(details))reason='İstenen HLS ses/görüntü formatı bulunamadı.';
 else if(/private video|members.only|login required/i.test(details))reason='Yayın için hesap erişimi gerekiyor.';
 else if(/not available in your country|geo.restrict/i.test(details))reason='Yayın bu sunucunun bulunduğu ülkeden erişilemiyor.';
 else if(/video unavailable|not currently live|live event will begin/i.test(details))reason='Yayın erişilemiyor veya henüz canlı değil.';
 else if(/429|too many requests/i.test(details))reason='YouTube istek sınırı (HTTP 429).';
 else if(/403|forbidden/i.test(details))reason='YouTube erişimi reddetti (HTTP 403).';
 else if(error.killed||/timed? ?out/i.test(details))reason='İşlem zaman aşımına uğradı.';
 else if(stage==='YouTube çözümleme')reason='Çözücü başarısız oldu; bilinen bir hata sınıfıyla eşleşmedi.';
 else reason=String(error.message||'Bilinmeyen hata').replace(/https?:\/\/\S+/g,'[URL]').replace(/[\r\n]+/g,' ').slice(0,180);
 return `${stage}: ${reason}`;
}
export function validateChannels(channels){
 if(!Array.isArray(channels)||!channels.length)throw Error('channels.json boş: önce deneme kanalını ekleyin.');
 const ids=new Set();
 for(const c of channels){
  if(!/^[a-z0-9][a-z0-9-]{0,49}$/.test(c.id)||ids.has(c.id))throw Error('Kanal kimliği geçersiz veya tekrarlı.');
  if(typeof c.name!=='string'||!c.name.trim()||/[\r\n]/.test(c.name))throw Error('Kanal adı geçersiz.');
  const u=new URL(c.url);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(u.hostname)||u.username||u.password)throw Error('HTTPS YouTube bağlantısı gerekli.');
  ids.add(c.id);
 }
 return channels;
}
export function selectStream(info,now=Date.now()){
 if(info.is_live!==true)throw Error('Yayın şu anda canlı değil.');
 const formats=info.requested_formats;
 const f=formats?formats.find(f=>f.vcodec&&f.vcodec!=='none'):info;
 const audio=formats?.find(f=>f.vcodec==='none'&&f.acodec!=='none');
 if(formats){
  if(!f||!audio)throw Error('Ses veya görüntü formatı eksik.');
  const video=selectStream({...f,is_live:true,acodec:'separate'},now);
  const sound=selectStream({...audio,is_live:true,acodec:audio.acodec||'unknown',vcodec:'separate',tbr:audio.tbr||192},now);
  return {...video,audioUrl:sound.url,expires:Math.min(video.expires,sound.expires),bandwidth:video.bandwidth+sound.bandwidth};
 }
 if(!['m3u8','m3u8_native'].includes(f.protocol)||!f.acodec||f.acodec==='none'||!f.vcodec||f.vcodec==='none')throw Error('Ses ve görüntü içeren HLS formatı bulunamadı.');
 const u=new URL(f.url);
 if(u.protocol!=='https:'||!(u.hostname==='googlevideo.com'||u.hostname.endsWith('.googlevideo.com')))throw Error('Beklenmeyen yayın sunucusu.');
 const expiration=Number(u.pathname.match(/\/expire\/(\d+)/)?.[1]||u.searchParams.get('expire'));
 if(!expiration||expiration*1000<now+90*60*1000)throw Error('Yayın adresinin kalan süresi 90 dakikadan az veya bilinmiyor.');
 if(!Number.isFinite(f.tbr)||f.tbr<=0)throw Error('Bant genişliği bilgisi bulunamadı.');
 return {url:u.href,expires:expiration,bandwidth:Math.ceil(f.tbr*1000),width:f.width,height:f.height};
}
export function manifest(s){
 const resolution=Number.isInteger(s.width)&&Number.isInteger(s.height)&&s.width>0&&s.height>0?`,RESOLUTION=${s.width}x${s.height}`:'';
 const audio=s.audioUrl?`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Ses",DEFAULT=YES,AUTOSELECT=YES,URI="${s.audioUrl}"\n`:'';
 return `#EXTM3U\n#EXT-X-VERSION:3\n${audio}#EXT-X-STREAM-INF:BANDWIDTH=${s.bandwidth}${resolution}${s.audioUrl?',AUDIO="audio"':''}\n${s.url}\n`;
}
async function atomic(file,text){await writeFile(file+'.tmp',text);await rename(file+'.tmp',file);}
async function probe(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Manifest erişilemedi (HTTP ${response.status}).`);
 const text=await response.text();
 if(!text.startsWith('#EXTM3U'))throw Error('Geçersiz manifest.');
 const recent=text.split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')).slice(-3);
 if(recent.length<3)throw Error('Yeterli güncel medya parçası bulunamadı.');
 for(const item of recent){
 const media=new URL(item,url);
 if(media.protocol!=='https:'||!media.hostname.endsWith('.googlevideo.com'))throw Error('Beklenmeyen medya sunucusu.');
 const part=await fetch(media,{signal:AbortSignal.timeout(15000)});
 try {if(!part.ok)throw Error(`Medya parçası erişilemedi (HTTP ${part.status}).`);const reader=part.body.getReader();const chunk=await reader.read();await reader.cancel();if(chunk.done||!chunk.value.length)throw Error('Boş medya parçası.');}
 finally{if(!part.body.locked)await part.body.cancel().catch(()=>{});}
 }
}

export async function main(){
 const channels=validateChannels(JSON.parse(await readFile('channels.json','utf8')));
 await mkdir(OUT,{recursive:true});const entries=[],status=[];let failed=0;
 const allowed=new Set(channels.map(c=>c.id+'.m3u8'));
 for(const file of await readdir(OUT)){if(/^[a-z0-9-]+\.m3u8$/.test(file)&&!allowed.has(file))await unlink(resolve(OUT,file));}
 for(const c of channels){
  const file=resolve(OUT,c.id+'.m3u8');
  let stage='YouTube çözümleme';
  try{
   const {stdout}=await exec(process.env.PYTHON||'python',['-m','yt_dlp','--ignore-config','--no-playlist','--no-warnings','--socket-timeout','20','--retries','2','--extractor-retries','2','--js-runtimes','node','--dump-single-json','--skip-download','-f','bestvideo[protocol^=m3u8]+bestaudio[protocol^=m3u8]/best[protocol^=m3u8][acodec!=none][vcodec!=none]',c.url],{timeout:120000,maxBuffer:8*1024*1024});
   stage='Format seçimi';const stream=selectStream(JSON.parse(stdout));
   stage='Görüntü erişim kontrolü';await probe(stream.url);
   if(stream.audioUrl){stage='Ses erişim kontrolü';await probe(stream.audioUrl);}
   stage='Dosya kaydı';
   await atomic(file,manifest(stream));entries.push(`#EXTINF:-1,${c.name}\n${c.id}.m3u8`);
   status.push({id:c.id,name:c.name,ok:true,expiresAt:new Date(stream.expires*1000).toISOString()});
   console.log(`${c.id}: güncel manifest alındı (oynatma henüz doğrulanmadı).`);
  }catch(error){
   // Avoid logging signed URLs, cookies or subprocess output. Remove stale output.
   await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e});
   const reason=diagnose(error,stage);
   status.push({id:c.id,name:c.name,ok:false,reason});failed++;console.log(`${c.id}: ${reason} Eski bağlantı listeden çıkarıldı.`);
  }
 }
 await atomic(resolve(OUT,'channels.m3u'),'#EXTM3U\n'+entries.join('\n')+'\n');
 await atomic(resolve(OUT,'status.json'),JSON.stringify({checkedAt:new Date().toISOString(),results:status},null,2)+'\n');
 if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
