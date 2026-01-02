
// assets/app.js

const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;
try { isIndex = !!qs('#continue'); } catch {}
try { isEditor = !!qs('#baRoot');  } catch {}

// 1) Supabase (opsiyonel)
let supabase = null, ENV = {};
try {
  ENV = await fetch('/env.json',{cache:'no-store'}).then(r=>r.json());
  const hasClientKey = false; // anon key'i yayınlamıyoruz (güvenlik tercihi)
  if (ENV?.url && hasClientKey) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    supabase = createClient(ENV.url, ENV.key);
  }
} catch(e){ console.warn('Env read skipped', e); }

// 2) Ortak veriler
let PICTO=null, SUG={};
try { PICTO = await fetch('/assets/pictos_index.json',{cache:'no-store'}).then(r=>r.json()); } catch {}
try { SUG   = await fetch('/assets/suggestions.json',{cache:'no-store'}).then(r=>r.json()); } catch {}

// 3) INDEX
try {
  if (isIndex) {
    const btn = qs('#continue'), firm=qs('#firm'), dept=qs('#dept'), author=qs('#author'), dateEl=qs('#date');
    const logoInp=qs('#logoFile'), logoPrev=qs('#logoPreview');
    window.__uploadedLogoUrl = '';

    if (logoInp) {
      logoInp.addEventListener('change', async (e)=>{
        const file=e.target.files?.[0]; if(!file) return;
        if(!supabase){ logoPrev.textContent='(Upload übersprungen: keine Cloud-Umgebung)'; return; }
        const path=`logo_${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('logos').upload(path,file,{upsert:true});
        if(error){ logoPrev.textContent='Upload-Fehler: '+error.message; return; }
        const { data } = supabase.storage.from('logos').getPublicUrl(path);
        window.__uploadedLogoUrl = data?.publicUrl || '';
        logoPrev.innerHTML = window.__uploadedLogoUrl || 'Nicht verfügbar';
      });
    }

    if (btn) {
      btn.dataset.bound='1';
      btn.addEventListener('click',(e)=>{
        e.preventDefault();
        const type = qsa('input[name="type"]').find(r=>r.checked)?.value || 'Maschine';
        const head = {
          type, firm:firm?.value?.trim()||'', dept:dept?.value?.trim()||'',
          author:author?.value?.trim()||'', date:dateEl?.value||'',
          logoUrl: window.__uploadedLogoUrl || '',
          title: {
            assetName: qs('#assetName')?.value?.trim()||'',
            subtitleText: qs('#subtitleText')?.value?.trim()||'Betriebsanweisung',
            bold: !!qs('#subtitleBold')?.checked,
            center: !!qs('#subtitleCenter')?.checked,
            fontFamily: qs('#fontFamily')?.value||'Arial',
            fontSize: parseInt(qs('#fontSize')?.value||'14',10)
          }
        };
        try { localStorage.setItem('BA_HEAD', JSON.stringify(head)); } catch {}
        location.href='editor.html';
      });
    }

    const indexRoot=qs('#indexRoot'), typeRow=qs('#typeRow');
    typeRow?.addEventListener('change',(e)=>{
      const val=e.target?.value; if(!val) return;
      indexRoot.classList.remove('t-Gefahrstoff','t-Biostoff','t-Maschine','t-PSA');
      indexRoot.classList.add('t-'+val);
    });
  }
} catch(e){ console.error('Index error:', e); }


// 4) EDITOR
try {
  if (isEditor) {
    const HEAD = JSON.parse(localStorage.getItem('BA_HEAD') || '{}');

    // Başlık bloğu
    const headDiv=qs('#head');
    if (headDiv) {
      const subtitleStyle = `
        font-family:${HEAD.title?.fontFamily || 'Arial'};
        font-size:${(HEAD.title?.fontSize || 14)}px;
        ${HEAD.title?.bold ? 'font-weight:700;' : 'font-weight:400;'}
        ${HEAD.title?.center ? 'text-align:center;' : ''}
      `;
      headDiv.innerHTML = `
        <div class="box headblock" style="display:flex;gap:12px;align-items:center">
          ${HEAD.logoUrl ? `<img class="logo" src="${HEAD.logoUrl}" alt="Logo" style="width:80px;height:80px;object-fit:contain;border:1px solid #eee">` : ''}
          <div class="titlearea" style="flex:1">
            <div class="asset" style="font-size:16px;font-weight:600">${HEAD.title?.assetName || ''}</div>
            <div class="subtitle" style="${subtitleStyle}">${HEAD.title?.subtitleText || 'Betriebsanweisung'}</div>
            <div class="small">Typ: ${HEAD.type||'-'} • Unternehmen: ${HEAD.firm||'-'} • Abteilung: ${HEAD.dept||'-'} • Ersteller: ${HEAD.author||'-'} • Datum: ${HEAD.date||'-'}</div>
          </div>
        </div>
      `;
    }

    // Piktogram seçici
    const selectedPics=new Set();
    function picImage(entry){
      return entry?.img || entry?.url || '';
    }
    function renderPictoChooser(containerId, groupKeys){
      const cont=qs('#'+containerId); if(!cont) return; cont.innerHTML='';
      groupKeys.forEach(k=>{
        const entry = PICTO?.[k.group]?.[k.code];
        if(!entry) return;
        const div=document.createElement('div'); div.className='pic'; div.dataset.code=k.code;
        const img=document.createElement('img'); img.src=picImage(entry); img.alt=entry.name||k.code;
        div.appendChild(img);
        const codeEl=document.createElement('div'); codeEl.className='code'; codeEl.textContent=k.code;
        div.appendChild(codeEl);
        div.addEventListener('click',()=>togglePicSelection(div));
        cont.appendChild(div);
      });
    }
    function togglePicSelection(el){
      const code=el.dataset.code;
      if(selectedPics.has(code)){ selectedPics.delete(code); el.classList.remove('selected'); }
      else { selectedPics.add(code); el.classList.add('selected'); }
      refreshPools(true);
    }
    renderPictoChooser('picChooser', [
      {group:'iso', code:'W001'}, {group:'iso', code:'M001'},
      {group:'iso', code:'E003'}, {group:'iso', code:'F001'},
      {group:'ghs', code:'GHS02'}, {group:'ghs', code:'GHS05'},
      {group:'ghs', code:'GHS07'}, {group:'ghs', code:'GHS08'}
    ]);

    // Öneri havuzları
    function fillPool(divId, items){
      const div=qs('#'+divId); if(!div) return; div.innerHTML='';
      (items||[]).forEach(t=>{
        const b=document.createElement('button'); b.textContent='➕ '+t; b.style.margin='4px';
        b.addEventListener('click',()=>addToList(divId.replace('Pool','List'), t));
        div.appendChild(b);
      });
    }
    function addToList(listId, text){
      const list=qs('#'+listId); if(!list) return;
      const li=document.createElement('div'); li.textContent='• '+text; li.style.margin='3px 0';
      list.appendChild(li); enforceTwoPages();
    }
    function addCustom(inputId, listId){
      const el=qs('#'+inputId); const val=el?.value?.trim(); if(!val) return;
      addToList(listId, val); el.value='';
    }
    qs('#hazardAdd')?.addEventListener('click',()=>addCustom('hazardCustom','hazardList'));
    qs('#techAdd')  ?.addEventListener('click',()=>addCustom('techCustom','techList'));
    qs('#orgAdd')   ?.addEventListener('click',()=>addCustom('orgCustom','orgList'));
    qs('#ppeAdd')   ?.addEventListener('click',()=>addCustom('ppeCustom','ppeList'));
    qs('#emAdd')    ?.addEventListener('click',()=>addCustom('emCustom','emList'));
    qs('#ehAdd')    ?.addEventListener('click',()=>addCustom('ehCustom','ehList'));
    qs('#disAdd')   ?.addEventListener('click',()=>addCustom('disCustom','disList'));

    // AI destekli öneri (Cloudflare Workers opsiyonel)
    async function aiSuggest(section, pics, head){
      try {
        const resp = await fetch(`/functions/ai-suggest?section=${encodeURIComponent(section)}&type=${encodeURIComponent(head.type||'')}&asset=${encodeURIComponent(head.title?.assetName||'')}&pics=${encodeURIComponent(pics.join(','))}`, {cache:'no-store'});
        if(!resp.ok) return [];
        const data = await resp.json();
        return Array.isArray(data)?data:[];
      } catch { return []; }
    }

    async function refreshPools(withAI=false){
      const type=HEAD.type||'Maschine';
      const pics=[...selectedPics];
      const pick=(section)=>{
        const out=new Set();
        pics.forEach(p=> (SUG?.[type]?.[section]?.[p] || []).forEach(x=>out.add(x)));
        return [...out];
      };
      let hazards = pick('hazards'), tech=pick('tech'), org=pick('org'), ppe=pick('ppe'), em=pick('em'), eh=pick('eh'), dis=pick('dis');

      if(withAI){
        const addMin5 = async (arr, sec) => {
          const ai = await aiSuggest(sec, pics, HEAD);
          while(arr.length<5 && ai.length) arr.push(ai.shift());
          return arr;
        };
        hazards = await addMin5(hazards,'hazards');
        tech    = await addMin5(tech,'tech');
        org     = await addMin5(org,'org');
        ppe     = await addMin5(ppe,'ppe');
        em      = await addMin5(em,'em');
        eh      = await addMin5(eh,'eh');
        dis     = await addMin5(dis,'dis');
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
    refreshPools();

    // 2 sayfa denetimi
    const root = qs('#baRoot'), fontHint = qs('#fontHint');
    function enforceTwoPages(){
      const a4px=1123, margin=40;
      let fs=parseInt(getComputedStyle(root).fontSize,10);
      const tooHigh = root.scrollHeight > (2*a4px - margin);
      if (tooHigh && fs>10){
        root.style.fontSize = (fs-1)+'px';
        fontHint.style.display='block';
        setTimeout(enforceTwoPages,0);
      } else if (tooHigh && fs<=10){
        fontHint.style.display='block';
        if(!qs('#limitWarn')){
          const w=document.createElement('div'); w.id='limitWarn'; w.className='warn';
          w.textContent='Hinweis: Inhalt überschreitet 2 Seiten. Bitte kürzen.';
          root.prepend(w);
        }
      } else {
        fontHint.style.display='none';
        qs('#limitWarn')?.remove();
      }
    }

    // ---------- DOCX export (Muster görünümü, piktogramlar sol sütunda "tam otursun") ----------
    async function fetchAsPngDataURL(url,width=96,height=96){
      // SVG ise canvas'a çizip PNG üret, değilse direkt blob->dataURL
      try {
        const res = await fetch(url,{cache:'no-store'}); if(!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        const blob = await res.blob();
        if (ct.includes('svg')){
          const svgText = await blob.text();
          const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
          const ctx = canvas.getContext('2d');
          const img = new Image(); const svg64='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgText);
          await new Promise((ok,err)=>{ img.onload=ok; img.onerror=err; img.src=svg64; });
          ctx.clearRect(0,0,width,height); ctx.drawImage(img,0,0,width,height);
          return canvas.toDataURL('image/png');
        } else {
          const b = await blob.arrayBuffer();
          const u8 = new Uint8Array(b);
          const b64 = btoa(String.fromCharCode(...u8));
          const mime = ct.split(';')[0]||'image/png';
          return `data:${mime};base64,${b64}`;
        }
      } catch { return null; }
    }

    function listToArr(id){ return qsa(`#${id} div`).map(x=>x.textContent.replace(/^\u2022\s*/,'').replace(/^•\s*/,'')); }

    async function exportDocx(){
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, VerticalAlign, BorderStyle, ShadingType, ImageRun } =
        await import('https://cdn.jsdelivr.net/npm/docx@9.1.1/+esm');

      const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#005aa3';

      // Başlık bloğu
      const titleParas = [];
      if (HEAD.title?.assetName){
        titleParas.push(new Paragraph({ children:[ new TextRun({ text: HEAD.title.assetName, bold:true, size:28 }) ] }));
      }
      titleParas.push(new Paragraph({
        alignment: (HEAD.title?.center ? AlignmentType.CENTER : AlignmentType.LEFT),
        children:[ new TextRun({
          text: (HEAD.title?.subtitleText || 'Betriebsanweisung'),
          bold: !!HEAD.title?.bold,
          size: (HEAD.title?.fontSize ? HEAD.title.fontSize*2 : 28),
          font: (HEAD.title?.fontFamily || 'Arial'),
          color: '000000'
        }) ]
      }));
      titleParas.push(new Paragraph({
        children:[ new TextRun({
          text: `Typ: ${HEAD.type||'-'} • Unternehmen: ${HEAD.firm||'-'} • Abteilung: ${HEAD.dept||'-'} • Ersteller: ${HEAD.author||'-'} • Datum: ${HEAD.date||'-'}`,
          size:22, font:'Arial'
        }) ]
      }));

      // Bant başlık yardımcıları (Word’de renkli şerit için bir satırlık tablo)
      const sectionTitle = (text)=> new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [ new TableRow({
          children: [ new TableCell({
            shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: themeColor.replace('#','') },
            verticalAlign: VerticalAlign.CENTER,
            children: [ new Paragraph({ children:[ new TextRun({ text, bold:true, color:'FFFFFF' }) ] }) ],
            borders: { top:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'} }
          }) ]
        }) ]
      });

      // Sol ikon – sağ madde yapısı
      async function iconBulletBlock(iconCodes, bullets){
        // Birden fazla ikon varsa üst üste yerleştir
        const icons = [];
        for (const c of iconCodes){
          const entry = (PICTO?.iso?.[c] || PICTO?.ghs?.[c]);
          const src = picImage(entry);
          const dataUrl = await fetchAsPngDataURL(src,96,96);
          if (dataUrl){
            icons.push(new ImageRun({ data: await (await fetch(dataUrl)).arrayBuffer(), transformation: { width: 80, height: 80 } }));
          }
        }
