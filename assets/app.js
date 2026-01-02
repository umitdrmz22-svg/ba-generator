
// assets/app.js
// Index + Editor tek dosyada; hata toleranslı.

// Basit yardımcılar
const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;
try { isIndex = !!qs('#continue'); } catch {}
try { isEditor = !!qs('#baRoot');  } catch {}

// 1) Supabase (isteğe bağlı)
let supabase = null, cfg = {};
try {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  try { cfg = await fetch('/env.json', {cache:'no-store'}).then(r=>r.json()); } catch {}
  const SUPABASE_KEY = (cfg?.key || '').trim();
  if (cfg?.url && SUPABASE_KEY) { supabase = createClient(cfg.url, SUPABASE_KEY); }
} catch(e) { console.warn('Supabase init skipped:', e); }

// 2) Ortak veriler (piktogram dizini + öneriler)
let PICTO = null, SUG = {};
try { PICTO = await fetch('/assets/pictos_index.json', {cache:'no-store'}).then(r=>r.json()); } catch {}
try { SUG   = await fetch('/assets/suggestions.json', {cache:'no-store'}).then(r=>r.json()); } catch { SUG={}; }

// 3) INDEX sayfası
try {
  if (isIndex) {
    const btn     = qs('#continue');
    const firm    = qs('#firm');
    const dept    = qs('#dept');
    const author  = qs('#author');
    const dateEl  = qs('#date');
    const logoInp = qs('#logoFile');
    const logoPrev= qs('#logoPreview');

    // Logo upload (opsiyonel)
    window.__uploadedLogoUrl = '';
    if (logoInp) {
      logoInp.addEventListener('change', async (e)=>{
        const file = e.target.files?.[0];
        if (!file) return;
        if (!supabase) { logoPrev.textContent = '(Upload übersprungen: keine Cloud-Umgebung)'; return; }
        const path = `logo_${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('logos').upload(path, file, { upsert:true });
        if (error) { logoPrev.textContent = 'Upload-Fehler: '+error.message; return; }
        const { data } = supabase.storage.from('logos').getPublicUrl(path);
        window.__uploadedLogoUrl = data?.publicUrl || '';
        logoPrev.innerHTML = window.__uploadedLogoUrl ? `${window.__uploadedLogoUrl}` : 'Nicht verfügbar';
      });
    }

    // Devam butonu (tümü opsiyonel)
    if (btn) {
      btn.dataset.bound = '1';
      btn.addEventListener('click',(e)=>{
        e.preventDefault();
        const typeVal = qsa('input[name="type"]').find(r=>r.checked)?.value || 'Maschine';
        const head = {
          type   : typeVal,
          firm   : firm?.value?.trim()   || '',
          dept   : dept?.value?.trim()   || '',
          author : author?.value?.trim() || '',
          date   : dateEl?.value         || '',
          logoUrl: window.__uploadedLogoUrl || '',
          title: {
            assetName   : qs('#assetName')?.value?.trim() || '',
            subtitleText: qs('#subtitleText')?.value?.trim() || 'Betriebsanweisung',
            bold        : !!qs('#subtitleBold')?.checked,
            center      : !!qs('#subtitleCenter')?.checked,
            fontFamily  : qs('#fontFamily')?.value || 'Arial',
            fontSize    : parseInt(qs('#fontSize')?.value||'14',10)
          }
        };
        try { localStorage.setItem('BA_HEAD', JSON.stringify(head)); } catch {}
        location.href = 'editor.html';
      });
    }

    // Tema sınıfı
    const indexRoot = qs('#indexRoot');
    const typeRow   = qs('#typeRow');
    typeRow?.addEventListener('change',(e)=>{
      const val = e.target?.value;
      if (!val) return;
      indexRoot.classList.remove('t-Gefahrstoff','t-Biostoff','t-Maschine','t-PSA');
      indexRoot.classList.add('t-'+val);
    });
  }
} catch(e){ console.error('Index error:', e); }


// 4) EDITOR sayfası
try {
  if (isEditor) {
    const HEAD = JSON.parse(localStorage.getItem('BA_HEAD') || '{}');

    // Başlık bloğu (profesyonel görünüm)
    const headDiv = qs('#head');
    if (headDiv) {
      const logoHtml = HEAD.logoUrl ? `<img class="logo" src="${HEAD.logoUrl}" alt="Logo">` : '';
      const subtitleStyle = `
        font-family:${HEAD.title?.fontFamily || 'Arial'};
        font-size:${(HEAD.title?.fontSize || 14)}px;
        ${HEAD.title?.bold ? 'font-weight:700;' : 'font-weight:400;'}
        ${HEAD.title?.center ? 'text-align:center;' : ''}
      `;
      headDiv.innerHTML = `
        <div class="box headblock">
          ${logoHtml}
          <div class="titlearea">
            <div class="asset">${HEAD.title?.assetName || ''}</div>
            <div class="subtitle" style="${subtitleStyle}">${HEAD.title?.subtitleText || 'Betriebsanweisung'}</div>
            <div class="small">Typ: ${HEAD.type || '-'} • Unternehmen: ${HEAD.firm || '-'} • Abteilung: ${HEAD.dept || '-'} • Ersteller: ${HEAD.author || '-'} • Datum: ${HEAD.date || '-'}</div>
          </div>
        </div>
      `;
    }

    // Piktogram seçici (img tabanlı)
    const selectedPics = new Set();
    const picChooser   = qs('#picChooser');

    async function checkUrlAlive(url){ try{ const r=await fetch(url,{method:'HEAD'}); return r?.ok; } catch { return false; } }

    async function healPictoIndex(){
      if (!PICTO) return;
      for (const [group, entries] of Object.entries(PICTO)) {
        if (!entries || typeof entries!=='object') continue;
        for (const [code, item] of Object.entries(entries)) {
          if (code==='authoritative_pages') continue;
          if (!item?.url) continue;
          const ok = await checkUrlAlive(item.url);
          if (!ok) {
            // Alternatif kaynak: BG RCI Symbib (GHS/ISO) ve BGHM’deki GHS sayfası
            item.alt = Object.assign({}, entries.authoritative_pages || {}, {
              'BG RCI – Symbib': 'https://symbib-light.bgrci.de/ghs_gefahrenpiktogramme',
              'BGHM – Kennzeichnung GHS': 'https://www.bghm.de/arbeitsschuetzer/praxishilfen/sicherheitszeichen/kennzeichnung-von-gefahrstoffen/'
            });
          }
        }
      }
    }
    await healPictoIndex();

    function renderPictoChooser(containerId, groupKeys){
      const cont = qs('#'+containerId);
      if (!cont) return; cont.innerHTML='';
      groupKeys.forEach(k=>{
        const entry = PICTO?.[k.group]?.[k.code];
        if (!entry) return;
        const div = document.createElement('div'); div.className='pic'; div.dataset.code=k.code;

        if (entry.img) {
          const img = document.createElement('img'); img.src = entry.img; img.alt = entry.name || k.code;
          div.appendChild(img);
        } else if (entry.url) {
          const img = document.createElement('img'); img.src = entry.url; img.alt = entry.name || k.code;
          div.appendChild(img);
        }

        const codeEl = document.createElement('div'); codeEl.className='code'; codeEl.textContent = k.code;
        div.appendChild(codeEl);

        if (entry.alt) {
          const alt = document.createElement('div'); alt.className='small'; alt.textContent='Alternative Quellen: ';
          Object.entries(entry.alt).forEach(([label,href],i)=>{
            const a=document.createElement('a'); a.href=href; a.target='_blank'; a.rel='noopener'; a.textContent=label;
            alt.appendChild(a);
            if (i < Object.keys(entry.alt).length-1) alt.appendChild(document.createTextNode(' • '));
          });
          div.appendChild(alt);
        }
        div.addEventListener('click', ()=>togglePicSelection(div));
        cont.appendChild(div);
      });
    }

    function togglePicSelection(el){
      const code = el.dataset.code;
      if (selectedPics.has(code)) { selectedPics.delete(code); el.classList.remove('selected'); }
      else { selectedPics.add(code); el.classList.add('selected'); }
      refreshPools(true);
    }

    // İlk set
    renderPictoChooser('picChooser', [
      {group:'iso', code:'W001'}, {group:'iso', code:'M001'},
      {group:'iso', code:'E003'}, {group:'iso', code:'F001'},
      {group:'ghs', code:'GHS02'}, {group:'ghs', code:'GHS05'},
      {group:'ghs', code:'GHS07'}, {group:'ghs', code:'GHS08'}
    ]);

    // Havuzlar
    function fillPool(divId, items){
      const div = qs('#'+divId); if (!div) return; div.innerHTML='';
      (items||[]).forEach(t=>{
        const b = document.createElement('button');
        b.textContent = '➕ ' + t; b.style.margin='4px';
        b.addEventListener('click', ()=>addToList(divId.replace('Pool','List'), t));
        div.appendChild(b);
      });
    }
    function addToList(listId, text){
      const list = qs('#'+listId); if (!list) return;
      const li = document.createElement('div'); li.textContent='• ' + text; li.style.margin='3px 0';
      list.appendChild(li); enforceTwoPages();
    }
    function addCustom(inputId, listId){
      const el = qs('#'+inputId); const val=el?.value?.trim(); if (!val) return;
      addToList(listId, val); el.value='';
    }

    // AI destekli öneri (opsiyonel Cloudflare Workers)
    async function aiSuggest(section, pics, head){
      try {
        // Örnek endpoint: /functions/ai-suggest (Cloudflare Workers)
        const resp = await fetch(`/functions/ai-suggest?section=${encodeURIComponent(section)}&type=${encodeURIComponent(head.type||'')}&asset=${encodeURIComponent(head.title?.assetName||'')}&pics=${encodeURIComponent(pics.join(','))}`, {cache:'no-store'});
        if (!resp.ok) return [];
        const data = await resp.json();
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    }

    async function refreshPools(withAI=false){
      const type = HEAD.type || 'Maschine';
      const pics = [...selectedPics];
      const pick = (section)=>{
        const out = new Set();
        pics.forEach(p=> (SUG?.[type]?.[section]?.[p] || []).forEach(x=>out.add(x)));
        return [...out];
      };

      // Yerel öneri
      const hazards = pick('hazards');
      const tech    = pick('tech');
      const org     = pick('org');
      const ppe     = pick('ppe');
      const em      = pick('em');
      const eh      = pick('eh');
      const dis     = pick('dis');

      // AI eklemesi (min 5 öneri hedefi)
      if (withAI) {
        const aiHz = await aiSuggest('hazards', pics, HEAD);
        while (hazards.length < 5 && aiHz.length) hazards.push(aiHz.shift());
        const aiT  = await aiSuggest('tech', pics, HEAD);
        while (tech.length    < 5 && aiT.length)  tech.push(aiT.shift());
        const aiO  = await aiSuggest('org',  pics, HEAD);
        while (org.length     < 5 && aiO.length)  org.push(aiO.shift());
        const aiP  = await aiSuggest('ppe',  pics, HEAD);
        while (ppe.length     < 5 && aiP.length)  ppe.push(aiP.shift());
        const aiEm = await aiSuggest('em',   pics, HEAD);
        while (em.length      < 5 && aiEm.length) em.push(aiEm.shift());
        const aiEh = await aiSuggest('eh',   pics, HEAD);
        while (eh.length      < 5 && aiEh.length) eh.push(aiEh.shift());
        const aiDis= await aiSuggest('dis',  pics, HEAD);
        while (dis.length     < 5 && aiDis.length)dis.push(aiDis.shift());
      }

      fillPool('hazardPool', hazards);
      fillPool('techPool',   tech);
      fillPool('orgPool',    org);
      fillPool('ppePool',    ppe);
      fillPool('emPool',     em);
      fillPool('ehPool',     eh);
      fillPool('disPool',    dis);
      enforceTwoPages();
    }

    qs('#hazardAdd')?.addEventListener('click', ()=>addCustom('hazardCustom','hazardList'));
    qs('#techAdd')  ?.addEventListener('click', ()=>addCustom('techCustom','techList'));
    qs('#orgAdd')   ?.addEventListener('click', ()=>addCustom('orgCustom','orgList'));
    qs('#ppeAdd')   ?.addEventListener('click', ()=>addCustom('ppeCustom','ppeList'));
    qs('#emAdd')    ?.addEventListener('click', ()=>addCustom('emCustom','emList'));
    qs('#ehAdd')    ?.addEventListener('click', ()=>addCustom('ehCustom','ehList'));
    qs('#disAdd')   ?.addEventListener('click', ()=>addCustom('disCustom','disList'));

    // 2 sayfa denetimi
    const root = qs('#baRoot'), fontHint = qs('#fontHint');
    function enforceTwoPages(){
      const a4px=1123, margin=40;
      let fs=parseInt(getComputedStyle(root).fontSize,10);
      const tooHigh = root.scrollHeight > (2*a4px - margin);
      if (tooHigh && fs>10){
        root.style.fontSize = (fs-1) + 'px';
        if (fontHint) fontHint.style.display='block';
        setTimeout(enforceTwoPages,0);
      } else if (tooHigh && fs<=10){
        if (fontHint) fontHint.style.display='block';
        if (!qs('#limitWarn')){
          const w=document.createElement('div'); w.id='limitWarn'; w.className='warn';
          w.textContent='Hinweis: Inhalt überschreitet 2 Seiten. Bitte kürzen.';
          root.prepend(w);
        }
      } else {
        if (fontHint) fontHint.style.display='none';
        qs('#limitWarn')?.remove();
      }
    }
    enforceTwoPages();

    // DOCX export (profesyonel düzen) — docx.js
    async function exportDocx(){
      // Dinamik import (CDN)
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } =
        await import('https://cdn.jsdelivr.net/npm/docx@9.1.1/+esm');

      const titleRuns = [];
      if (HEAD.title?.assetName) {
        titleRuns.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [ new TextRun({ text: HEAD.title.assetName, bold:true, size:28 }) ]
        }));
      }
      titleRuns.push(new Paragraph({
        alignment: (HEAD.title?.center ? AlignmentType.CENTER : AlignmentType.LEFT),
        children: [ new TextRun({
          text: (HEAD.title?.subtitleText || 'Betriebsanweisung'),
          bold: !!HEAD.title?.bold,
          size: (HEAD.title?.fontSize ? HEAD.title.fontSize*2 : 28),
          font: (HEAD.title?.fontFamily || 'Arial')
        }) ]
      }));

      const meta = new Paragraph({
        children: [ new TextRun({
          text: `Typ: ${HEAD.type||'-'} • Unternehmen: ${HEAD.firm||'-'} • Abteilung: ${HEAD.dept||'-'} • Ersteller: ${HEAD.author||'-'} • Datum: ${HEAD.date||'-'}`,
          size: 22, font: 'Arial'
        }) ]
      });

      // Bölüm yardımcıları
      const h2 = (t)=> new Paragraph({ text:t, heading: HeadingLevel.HEADING_2 });
      const bulletsFrom = (containerId)=>{
        return qsa(`#${containerId} div`).map(x=> new Paragraph({
          text: x.textContent.replace(/^\u2022\s*/,''),
          bullet:{ level:0 }
        }));
      };

      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
          children: [
            ...titleRuns,
            meta,
            h2('Anwendungsbereich'),
            new Paragraph({ text: (qs('#scope')?.value || '').trim() }),
            h2('Gefährdungen für Mensch und Umwelt'),
            ...bulletsFrom('hazardList'),
            h2('Schutzmaßnahmen und Verhaltensregeln – Technisch (S)'),
            ...bulletsFrom('techList'),
            h2('Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)'),
            ...bulletsFrom('orgList'),
            h2('Persönliche Schutzausrüstung (P)'),
            ...bulletsFrom('ppeList'),
            h2('Verhalten im Gefahrfall'),
            ...bulletsFrom('emList'),
            h2('Erste Hilfe'),
            ...bulletsFrom('ehList'),
            h2('Sachgerechte Entsorgung / Inaktivierung'),
            ...bulletsFrom('disList')
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const fname = (HEAD.title?.assetName ? HEAD.title.assetName+'_BA' : 'Betriebsanweisung') + '.docx';
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
      a.click(); URL.revokeObjectURL(a.href);
    }

    qs('#saveDocx')?.addEventListener('click', exportDocx);

    // Cloud kaydet (opsiyonel Supabase varsa)
    qs('#saveCloud')?.addEventListener('click', async ()=>{
      if (!supabase) { alert('Keine Cloud-Umgebung gesetzt.'); return; }
      const { data: ses, error: uerr } = await supabase.auth.getUser();
      if (uerr) { alert('Auth error: '+uerr.message); return; }
      const userId = ses?.user?.id || null;
      if (!userId) { alert('Bitte anmelden (Magic Link).'); return; }
      const doc = {
        user_id: userId,
        type: HEAD.type,
        head: HEAD,
        scope: qs('#scope')?.value || '',
        pictos: [...selectedPics],
        hazards: listToArr('hazardList'),
        tech   : listToArr('techList'),
        org    : listToArr('orgList'),
        ppe    : listToArr('ppeList'),
        em     : listToArr('emList'),
        eh     : listToArr('ehList'),
        dis    : listToArr('disList'),
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('ba_documents').insert(doc);
      alert(error ? ('Fehler: ' + error.message) : 'In Cloud gespeichert.');
    });

    function listToArr(id){ return qsa(`#${id} div`).map(x=>x.textContent.replace(/^\u2022\s*/,'')); }

    // Sayfa yüklenirken: öneri havuzlarını bir defa doldur
    refreshPools();
  }
} catch(e){ console.error('Editor error:', e); }
