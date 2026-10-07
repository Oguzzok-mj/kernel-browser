(() => {
  const hexToRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const mix=(a,b,t)=>'#'+hexToRGB(a).map((v,i)=>Math.round(v*t+hexToRGB(b)[i]*(1-t)).toString(16).padStart(2,'0')).join('');
  const light=h=>{const c=hexToRGB(h);return c[0]*.2126+c[1]*.7152+c[2]*.0722>150;};
  window.kernelTheme={apply(state){
    const s=state.settings;const root=document.documentElement;const style=root.style;
    const bright=s.theme==='light'||(s.theme==='system'&&!state.darkSystem);
    const bg=s.theme==='custom'?s.background:bright?'#f7f7f7':'#101112';
    const surface=s.theme==='custom'?s.surface:bright?'#ffffff':'#1a1c1e';
    const fg=s.theme==='custom'?s.foreground:bright?'#202124':'#e8e8e8';
    const values={'--bg':bg,'--shell':mix(surface,bg,.3),'--surface':surface,'--hover':mix(fg,surface,.035),'--active':mix(s.accent,surface,.075),'--line':mix(fg,surface,.09),'--text':fg,'--text-secondary':mix(fg,surface,.85),'--muted':mix(fg,surface,.60),'--faint':mix(fg,surface,.40),'--accent':s.accent,'--on-accent':light(s.accent)?'#161616':'#ffffff','--font-scale':s.fontSize/13,'--ui-radius':s.radius+'px','--tab-height':({compact:28,standard:32,comfortable:38}[s.density])+'px'};
    for(const [k,v]of Object.entries(values))style.setProperty(k,String(v));
    style.setProperty('--font-family','"'+s.fontFamily+'", "Segoe UI", Arial, sans-serif');
    const left=s.collapsed?72:s.sidebarWidth,rail=s.showRail?38:0;
    const panel=Math.min(s.panelWidth,Math.max(260,window.innerWidth-left-rail-320));
    style.setProperty('--sidebar',left+'px');style.setProperty('--rail',rail+'px');style.setProperty('--panel',state.panel?panel+'px':'0px');style.setProperty('--panel-width',panel+'px');
    root.style.colorScheme=light(bg)?'light':'dark';
    document.body.classList.toggle('collapsed',s.collapsed);document.body.classList.toggle('hide-rail',!s.showRail);document.body.dataset.density=s.density;
    for(const [selector,shown]of [['.home-brand',s.showHomeLogo],['#shortcuts',s.showShortcuts],['#today',s.showDate],['.home-footer',s.showHints],['.toolbar-assistant',s.showToolbarChat],['#home-button',s.showHomeButton]])document.querySelector(selector)?.classList.toggle('hidden',!shown);
    document.querySelector('.custom-colors')?.classList.toggle('hidden',s.theme!=='custom');
  }};
})();
