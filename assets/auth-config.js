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

  const applyIncomingKatasterData=()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('source')!=='gefahrstoffkataster')return;
    const product=params.get('produkt')||'';
    const inventory=params.get('kataster')||'';
    const dangerRadio=document.querySelector('input[name="type"][value="Gefahrstoff"]');
    if(dangerRadio){
      dangerRadio.checked=true;
      dangerRadio.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const asset=document.querySelector('#assetName');
    if(asset&&product&&!asset.value)asset.value=product;
    const baNumber=document.querySelector('#baNumber');
    if(baNumber&&inventory&&!baNumber.value)baNumber.value=`BA-${inventory}`;
    const purpose=document.querySelector('#purpose');
    if(purpose&&!purpose.value)purpose.placeholder='Konkrete Tätigkeit für diesen Gefahrstoff ergänzen';
    const setup=document.querySelector('.setup-card');
    if(setup){
      const note=document.createElement('p');
      note.className='privacy';
      note.textContent='Aus dem Gefahrstoffkataster übernommen. Tätigkeit und betriebliche Angaben vor dem Öffnen des Editors fachlich ergänzen.';
      setup.querySelector('.actions')?.before(note);
    }
  };

  const init=()=>{removeExamples();applyIncomingKatasterData();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
