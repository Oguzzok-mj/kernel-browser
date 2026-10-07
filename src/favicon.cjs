const {nativeImage}=require('electron');
// Keep website images out of the privileged renderer. Only decoded, small PNGs cross IPC.
async function loadFavicon(web,url){
  if(typeof url!=='string'||!/^https?:\/\//i.test(url))return '';
  try{
    const response=await web.fetch(url,{credentials:'omit',signal:AbortSignal.timeout(4000)});
    if(!response.ok||Number(response.headers.get('content-length'))>131072)return '';
    const reader=response.body.getReader(),parts=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();return '';}parts.push(Buffer.from(value));}}finally{reader.releaseLock();}
    const image=nativeImage.createFromBuffer(Buffer.concat(parts));
    return image.isEmpty()?'':image.resize({width:16,height:16,quality:'best'}).toDataURL();
  }catch{return '';}
}
const validFavicon=value=>typeof value==='string'&&value.length<32768&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';
module.exports={loadFavicon,validFavicon};
