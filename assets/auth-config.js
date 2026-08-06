'use strict';
(function(){
  const shared=window.EHS_PLATFORM_CONFIG||{};
  const current=window.BA_AUTH_CONFIG||{};
  window.BA_AUTH_CONFIG={
    url:shared.supabaseUrl||current.url||'',
    publishableKey:shared.supabasePublishableKey||shared.supabaseAnonKey||current.publishableKey||''
  };
  const removeExamples=()=>{
    document.querySelector('#loadDemo')?.remove();
    document.querySelectorAll('[data-demo],.demo-only').forEach(node=>node.remove());
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeExamples,{once:true});else removeExamples();
})();
