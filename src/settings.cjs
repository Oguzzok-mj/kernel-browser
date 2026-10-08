const DEFAULTS = Object.freeze({
  collapsed:false, search:'google', secureDns:true, dnsProvider:'google',
  startup:'restore', homepage:'kernel://newtab', newTab:'blank', saveHistory:true,
  defaultZoom:100, spellcheck:true, showHomeButton:true, askDownload:false, downloadDirectory:'',
  theme:'dark', background:'#101112', surface:'#1a1c1e', accent:'#aeb6c2', foreground:'#e8e8e8',
  fontFamily:'Segoe UI', fontSize:13, density:'standard', radius:6, sidebarWidth:232, panelWidth:360,
  showRail:true, showToolbarChat:true, showHomeLogo:true, showShortcuts:true, showDate:false, showHints:false,
  mediaPermission:'block', locationPermission:'block', notificationPermission:'block',clipboardPermission:'block', sitePermissions:{},
  aiBackend:'auto', aiWarmup:true, aiKeepAlive:15, aiContext:4096, aiMaxTokens:1024, aiTemperature:0.6,
  aiProvider:'local',aiModelFile:'',trackerBlocking:false,siteTrackerBlocking:{},autoSleep:false,sleepMinutes:30,ghostRoute:'direct',showWorkspaceButton:true
});
const enums={search:['google','duckduckgo','bing','yandex'],dnsProvider:['google','cloudflare'],startup:['restore','blank','home'],newTab:['blank','home'],theme:['dark','light','system','custom'],density:['compact','standard','comfortable'],mediaPermission:['allow','block'],locationPermission:['allow','block'],notificationPermission:['allow','block'],clipboardPermission:['allow','block'],aiBackend:['auto','gpu','cpu']};
enums.aiProvider=['local','compatible'];enums.ghostRoute=['direct','tor'];
const numbers={defaultZoom:[50,200],fontSize:[11,18],radius:[0,16],sidebarWidth:[180,320],panelWidth:[300,500],aiKeepAlive:[0,60],aiContext:[2048,32768],aiMaxTokens:[128,8192],aiTemperature:[0,1.5],sleepMinutes:[1,240]};
function sanitizeSettings(input={},base=DEFAULTS){
  const result={...DEFAULTS,...base,sitePermissions:{...(base.sitePermissions||{})}};
  for(const [key,value] of Object.entries(input||{})){
    if(!(key in DEFAULTS))continue;
    if(enums[key]){if(enums[key].includes(value))result[key]=value;}
    else if(numbers[key]){if(typeof value==='number'&&Number.isFinite(value))result[key]=Math.max(numbers[key][0],Math.min(numbers[key][1],value));}
    else if(typeof DEFAULTS[key]==='boolean'){if(typeof value==='boolean')result[key]=value;}
    else if(['background','surface','accent','foreground'].includes(key)){if(/^#[\da-f]{6}$/i.test(value))result[key]=value;}
    else if(key==='fontFamily'){if(typeof value==='string'&&/^[\p{L}\p{N} .,_-]{1,64}$/u.test(value))result[key]=value;}
    else if(key==='homepage'){try{if(value==='kernel://newtab'||['http:','https:'].includes(new URL(value).protocol))result[key]=String(value).slice(0,8192);}catch{}}
    else if(key==='downloadDirectory'){if(typeof value==='string'&&value.length<1024)result[key]=value;}
    else if(key==='aiModelFile'){if(typeof value==='string'&&value.length<1024&&(!value||/\.gguf$/i.test(value)))result[key]=value;}
    else if(key==='siteTrackerBlocking'&&value&&typeof value==='object'){result.siteTrackerBlocking={};for(const [origin,enabled]of Object.entries(value).slice(0,200)){try{const u=new URL(origin);if(['http:','https:'].includes(u.protocol)&&typeof enabled==='boolean')result.siteTrackerBlocking[u.origin]=enabled;}catch{}}}
    else if(key==='sitePermissions'&&value&&typeof value==='object'){
      result.sitePermissions={};for(const [origin,permissions]of Object.entries(value).slice(0,200)){
        try{if(!['http:','https:'].includes(new URL(origin).protocol))continue;}catch{continue;}
        const p={};for(const name of ['media','geolocation','notifications','clipboard-read'])if(['allow','block'].includes(permissions?.[name]))p[name]=permissions[name];
        if(Object.keys(p).length)result.sitePermissions[new URL(origin).origin]=p;
      }
    }
  }
  for(const key of ['fontSize','radius','sidebarWidth','panelWidth','aiKeepAlive','aiContext','aiMaxTokens','defaultZoom','sleepMinutes'])result[key]=Math.round(result[key]);
  return result;
}
function viewBounds(width,height,panel,settings,findVisible=false){
  const left=settings.collapsed?72:settings.sidebarWidth;
  const rail=settings.showRail?38:0;const panelWidth=Math.min(settings.panelWidth,Math.max(260,width-left-rail-320));const right=rail+(panel?panelWidth:0);const top=findVisible?84:48;
  return{x:left,y:top,width:Math.max(1,width-left-right),height:Math.max(1,height-top)};
}
function searchAddress(url,search){
  return url.replace('https://www.google.com/search?q=',{google:'https://www.google.com/search?q=',duckduckgo:'https://duckduckgo.com/?q=',bing:'https://www.bing.com/search?q=',yandex:'https://yandex.ru/search/?text='}[search]||'https://www.google.com/search?q=');
}
module.exports={DEFAULTS,sanitizeSettings,viewBounds,searchAddress};
