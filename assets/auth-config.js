'use strict';
(function(){
  const shared=window.EHS_PLATFORM_CONFIG||{};
  const current=window.BA_AUTH_CONFIG||{};
  const defaultSupabaseUrl='https://rqvcbjomrjccyuchxpuh.supabase.co';
  const defaultPublishableKey='sb_publishable_iKh-ZfqV3iJpr_9b7SErEA_XhrqnSsY';
  window.BA_AUTH_CONFIG={
    url:shared.supabaseUrl||current.url||defaultSupabaseUrl,
    publishableKey:shared.supabasePublishableKey||shared.supabaseAnonKey||current.publishableKey||defaultPublishableKey
  };
  const removeExamples=()=>{
    document.querySelector('#loadDemo')?.remove();
    document.querySelectorAll('[data-demo],.demo-only').forEach(node=>node.remove());
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',removeExamples,{once:true});else removeExamples();
})();
