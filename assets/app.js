
// assets/app.js
// Index + Editor tek dosyada; hata toleranslı; Supabase/Cloud opsiyonel.

// ---------- Yardımcılar ----------
const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;
try { isIndex = !!qs('#continue'); } catch {}
try { isEditor = !!qs('#baRoot');  } catch {}

function commonsRaw(url){
  if(!url?.includes('commons.wikimedia.org/wiki/File:')) return null;
  const fname = url.split('/wiki/File:')[1];
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${fname}`;
}
function getHEAD(){ try{ return JSON.parse(localStorage.getItem('BA_HEAD')||'{}'); } catch { return {}; } }
let HEAD = getHEAD();

// ---------- Env / Cloud (opsiyonel) ----------
let envCfg = {};
try { envCfg = await fetch('/env.json', {cache:'no-store'}).then(r=>r.json()); } catch {}

// ---------- Ortak veriler ----------
let PICTO=null, SUG={};
try { PICTO = await fetch('/assets/pictos_index.json',{cache:'no-store'}).then(r=>r.json()); } catch {}
try { SUG   = await fetch('/assets/suggestions.json',{cache:'no-store'}).then(r=>r.json()); } catch { SUG={}; }

// ---------- INDEX ----------
try {
  if (isIndex) {
    const btn = qs('#continue');
    const logoInp = qs('#logoFile'), logoPrev = qs('#logoPreview');
    window.__uploadedLogoUrl = '';

    // Cloud yoksa kullanıcıyı bilgilendir
    if (logoInp) {
      logoInp.addEventListener('change', (e)=>{
        const file = e.target.files?.[0];
        if (!file) return;
        logoPrev.textContent = '(Upload übersprungen: keine Cloud-Umgebung)';
        // İleride Supabase/Worker bağlanırsa buraya upload eklenebilir.
      });
    }

    if (btn) {
      btn.dataset.bound='1';
      btn.addEventListener('click',(e)=>{
        e.preventDefault();
        const type = qsa('input[name="type"]').find(r=>r.checked)?.value || 'Maschine';
        const head = {
          type,
          firm   : qs('#firm')?.value?.trim() || '',
          dept   : qs('#dept')?.value?.trim() || '',
          author : qs('#author')?.value?.trim() || '',
          date   : qs('#date')?.value || '',
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

      const indexRoot = qs('#indexRoot');
      const typeRow   = qs('#typeRow');
      typeRow?.addEventListener('change',(e)=>{
        const val = e.target?.value;
        if (!val) return;
        indexRoot.classList.remove('t-Gefahrstoff','t-Biostoff','t-Maschine','t-PSA');
        indexRoot.classList.add('t-'+val);
      });
    }
  }
} catch(e){ console.error('Index error:', e); }

// ---------- EDITOR ----------
try {
  if (isEditor) {
    HEAD = getHEAD();

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
          ${HEAD.logoUrl ? `<img class="logo" src="${HEAD.logoUrl}" alt="Logo">` : ''}
          <div class="titlearea" style="flex:1">
            <div class="asset" style="font-size:16px;font-weight:600">${HEAD.title?.assetName || ''}</div>
            <div class="subtitle" style="${subtitleStyle}">${HEAD.title?.subtitleText || 'Betriebsanweisung'}</div>
            <div class="small">Typ: ${HEAD.type||'-'} • Unternehmen: ${HEAD.firm||'-'} • Abteilung: ${HEAD.dept||'-'} • Ersteller: ${HEAD.author||'-'} • Datum: ${HEAD.date||'-'}</div>
          </div>
        </div>
      `;
    }

    // Piktogram seçici
    const selectedPics = new Set();
    function picImage(entry){ return entry?.img || commonsRaw(entry?.url) || entry?.url || ''; }

    function renderPictoChooser(containerId, groupKeys){
      const cont = qs('#'+containerId); if (!cont) return; cont.innerHTML='';
      groupKeys.forEach(k=>{
        const entry = PICTO?.[k.group]?.[k.code];
        if (!entry) return;
        const div = document.createElement('div'); div.className='pic'; div.dataset.code=k.code;
        const img = document.createElement('img'); img.src = picImage(entry); img.alt = entry.name || k.code;
        div.appendChild(img);
        const codeEl = document.createElement('div'); codeEl.className='code'; codeEl.textContent=k.code;
        div.appendChild(codeEl);
        div.addEventListener('click', ()=>togglePicSelection(div));
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
      const div = qs('#'+divId); if (!div) return; div.innerHTML='';
      (items||[]).forEach(t=>{
        const b=document.createElement('button'); b.textContent='➕ '+t; b.style.margin='4px';
        b.addEventListener('click', ()=>addToList(divId.replace('Pool','List'), t));
        div.appendChild(b);
      });
    }
    function addToList(listId, text){
      const list=qs('#'+listId); if(!list) return;
      const li=document.createElement('div'); li.textContent='• '+text; li.style.margin='3px 0';
      list.appendChild(li); enforceTwoPages();
    }
    function addCustom(inputId, listId){
      const el=qs('#'+inputId); const val=el?.value?.trim(); if (!val) return;
      addToList(listId, val); el.value='';
    }
    qs('#hazardAdd')?.addEventListener('click', ()=>addCustom('hazardCustom','hazardList'));
    qs('#techAdd')  ?.addEventListener('click', ()=>addCustom('techCustom','techList'));
    qs('#orgAdd')   ?.addEventListener('click', ()=>addCustom('orgCustom','orgList'));
    qs('#ppeAdd')   ?.addEventListener('click', ()=>addCustom('ppeCustom','ppeList'));
    qs('#emAdd')    ?.addEventListener('click', ()=>addCustom('emCustom','emList'));
    qs('#ehAdd')    ?.addEventListener('click', ()=>addCustom('ehCustom','ehList'));
    qs('#disAdd')   ?.addEventListener('click', ()=>addCustom('disCustom','disList'));

    // AI destekli öneri (Cloudflare Workers opsiyonel)
    async function aiSuggest(section, pics, head){
      try {
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
      let hazards = pick('hazards'), tech=pick('tech'), org=pick('org'), ppe=pick('ppe'), em=pick('em'), eh=pick('eh'), dis=pick('dis');

      if (withAI) {
        const addMin = async (arr, sec) => {
          const ai = await aiSuggest(sec, pics, HEAD);
          while (arr.length < 5 && ai.length) arr.push(ai.shift());
          return arr;
        };
        hazards = await addMin(hazards,'hazards');
        tech    = await addMin(tech,'tech');
        org     = await addMin(org,'org');
        ppe     = await addMin(ppe,'ppe');
        em      = await addMin(em,'em');
        eh      = await addMin(eh,'eh');
        dis     = await addMin(dis,'dis');
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
      } else {
        fontHint.style.display='none';
      }
    }

    // ---------- Görselleri DOCX'e uygun byte'a dönüştür ----------
    async function dataURLToBytes(dataUrl){
      const b64 = dataUrl.split(',')[1];
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    async function fetchAsPngBytes(url, w=96, h=96){
      // SVG ise canvas -> PNG; değilse (PNG/JPG) doğrudan bytes
      const res = await fetch(url, {cache:'no-store'});
      if (!res.ok) throw new Error('image fetch failed');
      const ct = res.headers.get('content-type') || '';
      const blob = await res.blob();
      if (ct.includes('svg')){
        const svgText = await blob.text();
        const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        await new Promise((ok,err)=>{ img.onload=ok; img.onerror=err; img.src=svg64; });
        ctx.clearRect(0,0,w,h); ctx.drawImage(img,0,0,w,h);
        const pngDataUrl = canvas.toDataURL('image/png');
        return await dataURLToBytes(pngDataUrl);
      } else {
        const ab = await blob.arrayBuffer();
        return new Uint8Array(ab);
      }
    }

    function listItems(id){
      return qsa(`#${id} div`).map(x=>x.textContent.replace(/^[•\u2022]\s*/, '').trim()).filter(Boolean);
    }
    function sectionIcons(rawPics, section){
      // Bölüme uygun ikonlar: hazards -> GHS ve/veya W001; ppe -> M001; em/eh -> E003/F001
      const pics = [...rawPics];
      if (section==='hazards') return pics.filter(p=>/^GHS|W001$/.test(p));
      if (section==='ppe')     return pics.filter(p=>/^M001$/.test(p)).concat('M001');
      if (section==='em' || section==='eh') return pics.filter(p=>/^(E003|F001)$/.test(p)).concat(['E003']);
      if (section==='tech' || section==='org' || section==='dis') return pics.filter(p=>/^W001$/.test(p)).concat(['W001']);
      return pics;
    }

    // ---------- DOCX EXPORT ----------
    async function exportDocx(){
      const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun } =
        await import('https://cdn.jsdelivr.net/npm/docx@9.1.1/+esm');

      const barColor = (HEAD.type==='Gefahrstoff' ? 'E53935' : (HEAD.type==='Biostoff' ? '2E7D32' : '005AA3'));

      const bar = (text)=> new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [ new TableRow({ children: [ new TableCell({
          shading: { type: ShadingType.SOLID, color: barColor, fill: barColor },
          children: [ new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [ new TextRun({ text, bold:true, color:'FFFFFF' }) ]
          }) ]
        }) ] }) ]
      });

      const title = [];
      if (HEAD.title?.assetName) {
        title.push(new Paragraph({ children:[ new TextRun({ text: HEAD.title.assetName, bold:true, size:28 }) ] }));
      }
      title.push(new Paragraph({
        alignment: (HEAD.title?.center ? AlignmentType.CENTER : AlignmentType.LEFT),
        children:[ new TextRun({
          text: (HEAD.title?.subtitleText || 'Betriebsanweisung'),
          bold: !!HEAD.title?.bold,
          size: (HEAD.title?.fontSize ? HEAD.title.fontSize*2 : 28),
          font: (HEAD.title?.fontFamily || 'Arial')
        }) ]
      }));

      const meta = [
        ['Nr.',   qs('#metaNr')?.value || ''],
        ['Datum', qs('#metaDate')?.value || HEAD.date || ''],
        ['Firma', qs('#metaFirma')?.value || HEAD.firm || ''],
        ['Tätigkeit', qs('#metaTaet')?.value || ''],
        ['Arbeitsbereich/-platz', qs('#metaArb')?.value || ''],
        ['Hersteller', qs('#metaHer')?.value || ''],
        ['Typ', qs('#metaTyp')?.value || ''],
        ['Verantwortlich', qs('#metaVer')?.value || ''],
        ['Stand', qs('#metaStand')?.value || '']
      ].filter(([k,v])=>v);

      const metaPara = new Paragraph({
        children: [ new TextRun({ text: meta.map(([k,v])=>`${k}: ${v}`).join(' • '), size:22, font:'Arial' }) ]
      });

      async function twoColumnSection(titleText, listId, secKey){
        const icons = sectionIcons([...selectedPics], secKey).slice(0,4);
        const iconRuns = [];
        for (const code of icons){
          const entry = PICTO?.iso?.[code] || PICTO?.ghs?.[code];
          if (!entry) continue;
          const src = picImage(entry);
          try {
            const bytes = await fetchAsPngBytes(src, 96, 96);
            iconRuns.push(new Paragraph({ children: [ new ImageRun({ data: bytes, transformation: { width:72, height:72 } }) ] }));
          } catch {}
        }
        const bullets = listItems(listId).map(t=> new Paragraph({ text:t, bullet:{ level:0 } }));
        return [
          bar(titleText),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [ new TableRow({
              children: [
                new TableCell({ width:{ size:25, type:WidthType.PERCENTAGE }, children: (iconRuns.length?iconRuns:[ new Paragraph('') ]) }),
                new TableCell({ width:{ size:75, type:WidthType.PERCENTAGE }, children: (bullets.length?bullets:[ new Paragraph('') ]) })
              ]
            }) ]
          })
        ];
      }

      const children = [
        ...title,
        metaPara,
        bar('Anwendungsbereich'),
        new Paragraph({ text: (qs('#scope')?.value || '').trim() || '-' }),
        ...(await twoColumnSection('Gefahren für Mensch und Umwelt','hazardList','hazards')),
        ...(await twoColumnSection('Schutzmaßnahmen und Verhaltensregeln – Technisch (S)','techList','tech')),
        ...(await twoColumnSection('Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)','orgList','org')),
        ...(await twoColumnSection('Persönliche Schutzausrüstung (P)','ppeList','ppe')),
        ...(await twoColumnSection('Verhalten im Gefahrfall','emList','em')),
        ...(await twoColumnSection('Erste Hilfe','ehList','eh')),
        ...(await twoColumnSection('Sachgerechte Entsorgung / Inaktivierung','disList','dis'))
      ];

      const doc = new Document({ sections: [{ properties:{ page:{ margin:{ top:720, right:720, bottom:720, left:720 } } }, children }] });
      const blob = await Packer.toBlob(doc);
      const fname = (HEAD.title?.assetName ? HEAD.title.assetName+'_BA' : 'Betriebsanweisung') + '.docx';
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click();
      URL.revokeObjectURL(a.href);
    }

    qs('#saveDocx')?.addEventListener('click', exportDocx);

    // Cloud kaydet (opsiyonel)
    qs('#saveCloud')?.addEventListener('click', ()=>{
      alert('Keine Cloud-Umgebung konfiguriert. (Optional aktivierbar über env.json & Supabase/Worker)');
    });
  }
} catch(e){ console.error('Editor error:', e); }
