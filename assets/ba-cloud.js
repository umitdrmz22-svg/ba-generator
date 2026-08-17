'use strict';
(function(){
  const STORE='ba-studio-draft-v3';
  const CLOUD_ID='ba-studio-cloud-id';
  const client=globalThis.BAAuth?.state?.client;
  const session=globalThis.BAAuth?.state?.session;
  if(!client||!session)return;

  let organization=null;
  let originWerkId='';
  let originWerkName='';
  let saveTimer=null;
  let saving=false;

  const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const parseState=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null');}catch{return null;}};
  const waitForEhsAccess=async()=>{
    if(globalThis.DefiDevEHSAccess)return globalThis.DefiDevEHSAccess;
    if(!document.querySelector('script[src*="ehs-entitlement-gate.js"]'))return null;
    return await new Promise(resolve=>window.addEventListener('defidev-ehs-entitlement-ready',event=>resolve(globalThis.DefiDevEHSAccess||event.detail||null),{once:true}));
  };
  const setSaveState=(text,type='')=>{
    let node=document.querySelector('#cloudSaveState');
    if(!node&&document.querySelector('#saveDraft')){
      node=document.createElement('span');node.id='cloudSaveState';node.className='cloud-save-state';document.querySelector('#saveDraft').insertAdjacentElement('afterend',node);
    }
    if(node){node.textContent=text;node.className=`cloud-save-state ${type}`.trim();}
  };
  const loadOrganization=async()=>{
    const ehsAccess=await waitForEhsAccess();
    const selectedWerk=ehsAccess?.selectedWerk||(Array.isArray(ehsAccess?.works)&&ehsAccess.works.length===1?ehsAccess.works[0]:null);
    originWerkId=String(selectedWerk?.id||'');
    originWerkName=String(selectedWerk?.name||selectedWerk?.code||'Werk');
    if(!originWerkId)throw new Error('Bitte BA Studio über das EHS-Dashboard öffnen und ein Werk auswählen.');
    let query=client.from('organization_members').select('organization_id,role,organizations(name)').eq('user_id',session.user.id).eq('status','active');
    if(selectedWerk?.organizationId)query=query.eq('organization_id',selectedWerk.organizationId);
    else if(ehsAccess?.organizationId)query=query.eq('organization_id',ehsAccess.organizationId);
    else query=query.limit(1);
    const {data,error}=await query.maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Für dieses Benutzerkonto wurde kein aktiver Firmenbereich gefunden.');
    organization=data;
    return data;
  };
  const upsertDraft=async(force=false)=>{
    if(saving&&!force)return;
    const state=parseState();
    if(!state?.type||!state?.asset)return;
    if(!organization)await loadOrganization();
    if(!originWerkId)return;
    saving=true;setSaveState('Wird online gespeichert …');
    try{
      const payload={
        organization_id:organization.organization_id,
        title:String(state.asset||'Unbenannte Betriebsanweisung').trim(),
        ba_number:String(state.baNumber||'').trim(),
        ba_type:String(state.type||'').trim(),
        department:String(state.dept||'').trim(),
        workplace:String(state.workplace||'').trim(),
        revision_label:String(state.revision||'').trim(),
        status:'draft',
        payload:state,
        updated_by:session.user.id
      };
      const id=localStorage.getItem(CLOUD_ID);
      if(id){
        const {data,error}=await client.from('operating_instructions').update(payload).eq('id',id).eq('organization_id',organization.organization_id).eq('origin_werk_id',originWerkId).select('id').maybeSingle();
        if(error)throw error;
        if(!data)localStorage.removeItem(CLOUD_ID);
      }
      if(!localStorage.getItem(CLOUD_ID)){
        const {data,error}=await client.from('operating_instructions').insert({...payload,origin_werk_id:originWerkId,created_by:session.user.id}).select('id').single();
        if(error)throw error;
        localStorage.setItem(CLOUD_ID,data.id);
      }
      setSaveState(`Online gespeichert · ${originWerkName} ✓`,'ok');
    }catch(error){console.error(error);const message=String(error?.message||'');setSaveState(message.includes('EHS_ORIGIN')?'Werk-Kontext ungültig. Bitte über das EHS-Dashboard erneut öffnen.':'Online-Speicherung fehlgeschlagen','error');}
    finally{saving=false;}
  };
  const scheduleSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>upsertDraft(false),900);};
  const hookLocalStorage=()=>{
    const original=Storage.prototype.setItem;
    if(original.__baCloudWrapped)return;
    function wrapped(key,value){original.call(this,key,value);if(this===localStorage&&key===STORE)scheduleSave();}
    wrapped.__baCloudWrapped=true;
    Storage.prototype.setItem=wrapped;
  };
  const openRecord=record=>{
    localStorage.setItem(STORE,JSON.stringify(record.payload||{}));
    localStorage.setItem(CLOUD_ID,record.id);
    location.href='editor.html';
  };
  const duplicateRecord=async record=>{
    const copy=structuredClone(record.payload||{});
    copy.asset=`${copy.asset||record.title} – Kopie`;
    copy.baNumber='';copy.revision='0';copy.date=new Date().toISOString().slice(0,10);
    const {data,error}=await client.from('operating_instructions').insert({
      organization_id:organization.organization_id,origin_werk_id:originWerkId,title:copy.asset,ba_number:'',ba_type:copy.type||record.ba_type,department:copy.dept||'',workplace:copy.workplace||'',revision_label:'0',status:'draft',payload:copy,created_by:session.user.id,updated_by:session.user.id
    }).select('id').single();
    if(error)throw error;
    localStorage.setItem(STORE,JSON.stringify(copy));localStorage.setItem(CLOUD_ID,data.id);location.href='editor.html';
  };
  const archiveRecord=async id=>{
    const {error}=await client.from('operating_instructions').update({status:'archived',updated_by:session.user.id}).eq('id',id).eq('organization_id',organization.organization_id).eq('origin_werk_id',originWerkId);
    if(error)throw error;
    await renderLibrary();
  };
  const formatDate=value=>value?new Intl.DateTimeFormat('de-DE',{dateStyle:'short'}).format(new Date(value)):'—';
  const renderLibrary=async()=>{
    const host=document.querySelector('#savedBaList');if(!host)return;
    const message=document.querySelector('#savedBaMessage');
    host.innerHTML='<div class="ba-library-empty"><strong>Wird geladen …</strong></div>';
    try{
      if(!organization)await loadOrganization();
      const {data,error}=await client.from('operating_instructions').select('id,title,ba_number,ba_type,department,workplace,revision_label,status,updated_at,payload,origin_werk_id').eq('organization_id',organization.organization_id).eq('origin_werk_id',originWerkId).neq('status','archived').order('title',{ascending:true});
      if(error)throw error;
      const query=(document.querySelector('#savedBaSearch')?.value||'').trim().toLocaleLowerCase('de-DE');
      const rows=(data||[]).filter(row=>!query||[row.title,row.ba_number,row.ba_type,row.department,row.workplace].join(' ').toLocaleLowerCase('de-DE').includes(query));
      if(!rows.length){host.innerHTML=`<div class="ba-library-empty"><strong>Noch keine gespeicherten BA in ${escapeHtml(originWerkName)}</strong><span>Eine neue BA wird nach dem Öffnen des Editors automatisch diesem Werk zugeordnet.</span></div>`;if(message)message.textContent='';return;}
      host.innerHTML=rows.map(row=>`<article class="ba-library-item" data-id="${escapeHtml(row.id)}"><div class="ba-library-title"><strong>${escapeHtml(row.title)}</strong><span class="ba-library-type">${escapeHtml(row.ba_type)}</span></div><div class="ba-library-meta"><span>${escapeHtml(row.ba_number||'ohne BA-Nr.')}</span><span>${escapeHtml(row.department||'ohne Bereich')}</span><span>Rev. ${escapeHtml(row.revision_label||'—')}</span><span>${escapeHtml(formatDate(row.updated_at))}</span></div><div class="ba-library-actions"><button class="open" data-action="open">Öffnen</button><button data-action="duplicate">Kopieren</button><button class="archive" data-action="archive">Archivieren</button></div></article>`).join('');
      host.querySelectorAll('[data-id]').forEach(card=>card.addEventListener('click',async event=>{
        const button=event.target.closest('button[data-action]');if(!button)return;
        const row=rows.find(x=>x.id===card.dataset.id);if(!row)return;
        try{if(button.dataset.action==='open')openRecord(row);if(button.dataset.action==='duplicate')await duplicateRecord(row);if(button.dataset.action==='archive'&&confirm('Diese Betriebsanweisung archivieren?'))await archiveRecord(row.id);}catch(error){console.error(error);if(message)message.textContent=error.message;}
      }));
      if(message)message.textContent=`${rows.length} Betriebsanweisung(en) · ${originWerkName} · alphabetisch A–Z`;
    }catch(error){console.error(error);host.innerHTML='<div class="ba-library-empty"><strong>Gespeicherte BA konnten nicht geladen werden.</strong><span>Bitte Werkzugriff und Verbindung prüfen.</span></div>';if(message)message.textContent=error.message;}
  };
  const init=async()=>{
    hookLocalStorage();
    try{await loadOrganization();}catch(error){console.error(error);setSaveState(error.message,'error');return;}
    document.querySelector('#savedBaSearch')?.addEventListener('input',renderLibrary);
    document.querySelector('#continue')?.addEventListener('click',()=>localStorage.removeItem(CLOUD_ID),{capture:true});
    document.querySelector('#loadDemo')?.addEventListener('click',()=>localStorage.removeItem(CLOUD_ID),{capture:true});
    document.querySelector('#saveDraft')?.addEventListener('click',()=>setTimeout(()=>upsertDraft(true),0));
    if(document.querySelector('#savedBaList'))await renderLibrary();
    if(document.querySelector('#baRoot'))await upsertDraft(false);
  };
  init().catch(error=>console.error(error));
})();
