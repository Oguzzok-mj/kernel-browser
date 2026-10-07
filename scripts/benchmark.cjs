const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const crypto=require('node:crypto');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(mode){
  const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  const key=crypto.randomBytes(24).toString('hex');
  const exe=path.resolve(__dirname,'../vendor',mode==='cpu'?'llama':'llama-vulkan','llama-server.exe');
  const args=['-m',path.resolve(__dirname,'../../models/Qwen3-4B-Q4_K_M.gguf'),'--host','127.0.0.1','--port',String(port),'--api-key',key,'-c',mode==='cpu'?'8192':'4096','-t',mode==='cpu'?'8':'6','-ngl',mode==='cpu'?'0':'99','--jinja','--no-webui'];
  const child=spawn(exe,args,{cwd:path.dirname(exe),windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',d=>stderr=(stderr+d).slice(-18000));
  const start=Date.now();
  try{
    while(true){if(child.exitCode!==null)throw new Error(stderr);try{const r=await fetch(`http://127.0.0.1:${port}/health`,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}if(Date.now()-start>180000)throw new Error('Loading timed out: '+stderr);await delay(250);}
    const loaded=Date.now()-start;
    const body={messages:[{role:'user',content:'Объясни, как работает операционная система. Напиши восемь предложений. /no_think'}],max_tokens:96,stream:false,temperature:0,seed:42,chat_template_kwargs:{enable_thinking:false}};
    const req=async()=>{const s=Date.now();const r=await fetch(`http://127.0.0.1:${port}/v1/chat/completions`,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});const data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));return {ms:Date.now()-s,timings:data.timings,tokens:data.usage?.completion_tokens,text:data.choices?.[0]?.message?.content};};
    await req();const measured=await req();const result={mode,loadMs:loaded,...measured};
    fs.writeFileSync(path.resolve(__dirname,'../../benchmark-'+mode+'.log'),stderr);console.log(JSON.stringify(result));return result;
  }finally{child.kill();}
}
(async()=>{const cpu=await run('cpu');const vulkan=await run('vulkan');fs.writeFileSync(path.resolve(__dirname,'../../../outputs/performance.json'),JSON.stringify({cpu,vulkan,at:new Date().toISOString()},null,2));})().catch(e=>{console.error(e.message);process.exitCode=1;});
