(function(){
  const el=id=>document.getElementById(id);
  function readPrefs(){try{return JSON.parse(localStorage.getItem('skyline:settings')||'{}')}catch{return {}}}
  function writePrefs(p){try{localStorage.setItem('skyline:settings',JSON.stringify(p))}catch{}}
  function applyTheme(theme){
    const light=theme==='light';
    document.body.classList.toggle('theme-light',light);
    const button=el('themeToggle');
    if(button){
      button.setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');
      button.title=light?'Switch to dark theme':'Switch to light theme';
      button.innerHTML=light
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l-1.42 1.42m11.3-11.3 1.42-1.42"/></svg>';
    }
    const meta=el('themeColorMeta');
    if(meta)meta.content=light?'#edf3f8':'#080f1c';
    const select=el('settingTheme');
    if(select)select.value=light?'light':'dark';
  }
  function syncHeader(){
    const install=el('installAppButton'),headerInstall=el('headerInstall');
    if(headerInstall){
      headerInstall.disabled=!install||install.disabled;
      headerInstall.title=install&&install.textContent==='Installed'?'Skyline is installed':'Install Skyline';
    }
    const notify=el('enableWeatherNotifications'),headerNotify=el('headerNotifications');
    if(headerNotify){
      headerNotify.disabled=!notify||notify.disabled;
      headerNotify.title=notify?notify.textContent:'Notifications unavailable';
      headerNotify.setAttribute('aria-label',headerNotify.title);
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const prefs=readPrefs();
    applyTheme(prefs.theme==='light'?'light':'dark');
    el('themeToggle')?.addEventListener('click',()=>{
      const next=document.body.classList.contains('theme-light')?'dark':'light';
      const p=Object.assign({},readPrefs(),{theme:next});
      window.SkylinePreferences=Object.assign({},window.SkylinePreferences||{},p);
      writePrefs(p);
      applyTheme(next);
      const feedback=el('settingsFeedback');
      if(feedback)feedback.textContent='Appearance updated.';
    });
    el('headerInstall')?.addEventListener('click',()=>el('installAppButton')?.click());
    el('headerNotifications')?.addEventListener('click',()=>el('enableWeatherNotifications')?.click());
    const panels=el('featurePanels');
    if(panels&&'MutationObserver'in window){
      new MutationObserver(syncHeader).observe(panels,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    }
    syncHeader();
  });
  window.addEventListener('beforeinstallprompt',syncHeader);
  window.addEventListener('appinstalled',syncHeader);
  window.addEventListener('skyline:notifications-updated',syncHeader);
})();