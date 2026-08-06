'use strict';
(function(){
  const shared=window.EHS_PLATFORM_CONFIG||{};
  window.BA_AUTH_CONFIG={
    url:shared.supabaseUrl||'',
    publishableKey:shared.supabasePublishableKey||shared.supabaseAnonKey||''
  };
  const removeExamples=()=>{
    document.querySelector('#loadDemo')?.remove();
    document.querySelectorAll('[data-demo],.demo-only').forEach(node=>node.remove());
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeExamples,{once:true});else removeExamples();
})();
