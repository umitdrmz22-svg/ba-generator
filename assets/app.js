
/* Nur Deutsch in Code und UI verwenden */

/* Hilfsfunktionen */
const qs = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];

let isIndex=false, isEditor=false;
document.addEventListener('DOMContentLoaded', () => {
  isIndex = !!qs('#continue');
  isEditor = !!qs('#baRoot');
  if (isIndex) initIndex();
  if (isEditor) initEditor();
});

/* Kopf-Zustand aus LocalStorage */
function getHEAD(){
  try { return JSON.parse(localStorage.getItem('BA_HEAD') ?? '{}'); }
  catch { return {}; }
}
function setHEAD(head){
  localStorage.setItem('BA_HEAD', JSON.stringify(head ?? {}));
}

/* ---------------- INDEX ---------------- */
function initIndex(){
  const root = qs('#indexRoot');
  const btn = qs('#continue');
  const logoInp = qs('#logoFile'), logoPrev = qs('#logoPreview'), logoUrl = qs('#logoUrl');

  // Live-Vorschau für Logo-Datei
  logoInp?.addEventListener('change', async () => {
    const f = logoInp.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      window.__uploadedLogoUrl = dataUrl;
      logoPrev.innerHTML = `<img src="${dataUrl}" alt="Logo" style="max-height:56px;object-fit:contain;border-radius:8px;">`;
    };
    reader.readAsDataURL(f);
  });

  btn?.addEventListener('click', (e)=>{
    e.preventDefault();
    const type = qsa('input[name="type"]').find(r=>r.checked)?.value ?? 'Maschine';
    const head = {
      type,
      firm : qs('#firm')?.value?.trim() ?? '',
      dept : qs('#dept')?.value?.trim() ?? '',
      author : qs('#author')?.value?.trim() ?? '',
      date : qs('#date')?.value ?? '',
      logoUrl: (qs('#logoUrl')?.value?.trim() || window.__uploadedLogoUrl || ''),
      title : {
        assetName : qs('#assetName')?.value?.trim() ?? '',
        subtitleText: qs('#subtitleText')?.value?.trim() ?? 'Betriebsanweisung',
        bold : !!qs('#subtitleBold')?.checked,
        center : !!qs('#subtitleCenter')?.checked,
        fontFamily : qs('#fontFamily')?.value ?? 'Inter',
        fontSize : parseInt(qs('#fontSize')?.value ?? '18',10)
      }
    };
    setHEAD(head);
    // WICHTIG: Verwende eine relative Seite (Cloudflare Pages: /editor wird auf /editor.html gemappt)
    window.location.href = 'editor';
  });

  // Farbthema umschalten
  qs('#typeRow')?.addEventListener('change',(e)=>{
    const val=e.target?.value; if(!val) return;
    root.classList.remove('theme-Gefahrstoff','theme-Biostoff','theme-Maschine','theme-PSA');
    root.classList.add('theme-'+val);
  });
}

/* ---------------- EDITOR ---------------- */
let PICTO=null, SUG={}, FILTER={groups:new Set(['iso','ghs','adr']), term:''};
const sections = ['hazard','tech','org','ppe','em','eh','dis'];
const iconsBySection = { hazard:[], tech:[], org:[], ppe:[], em:[], eh:[], dis:[] };
let selectedPic=null, HEAD={};

/* Bild-Helfer: sichere Quellen + Fallback */
function staticallyUrl(u){
  // Statically: https://cdn.statically.io/img/<host>/<pfad>?w=64&f=png
  const clean = u.replace(/^https?:\/\//,'');
  return `https://cdn.statically.io/img/${clean}?w=64&f=png`;
}
function weservUrl(u){
  const clean = u.replace(/^https?:\/\//,'');
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=64`;
}
function makeImg(srcCandidates, alt='Piktogramm', size=56, cls=''){
  const img = document.createElement('img');
  img.width = size; img.height = size; img.loading = 'lazy';
  img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.crossOrigin = 'anonymous';
  if (cls) img.className = cls;

  const list = [...srcCandidates].filter(Boolean);
  let idx = 0;
  const trySet = ()=>{
    if (idx>=list.length) return;
    img.src = list[idx++];
  };
  img.addEventListener('error', trySet);

  trySet();
  img.alt = alt;
  img.style.objectFit = 'contain';
  img.style.borderRadius = '8px';
  img.style.background = '#fff';
  return img;
}

/* Flatten für Piktogramme */
function flattenPicto(src){
  const out = [];
  ['ghs','iso','adr'].forEach(group=>{
    const obj = src[group] ?? {};
    Object.keys(obj).forEach(code=>{
      const item = obj[code];
      const raw = item.imgRaw ?? item.img;

      // Kandidaten für WEB-Thumbnail (klein) und WORD (hochauflösend)
      const webCandidates = [
        item.img,                       // falls bereits proxied
        staticallyUrl(raw),
        staticallyUrl(item.img),
        weservUrl(raw),
        weservUrl(item.img),
        raw                              // letztversuch direkt
      ];
      const docxCandidates = [
        raw,
        staticallyUrl(raw).replace('?w=64&f=png',''), // volles Bild (ohne Parameter) – Statically leitet durch
        weservUrl(raw).replace('&w=64',''),           // volles Bild – Weserv
        item.img
      ];

      out.push({ group, code, name:item.name, webCandidates, docxCandidates });
    });
  });
  return out;
}

/* Freitext */
function addFreeText(inpId, listId){
  const val = qs('#'+inpId)?.value?.trim();
  if(!val) return;
  const li = document.createElement('div'); li.textContent = '• ' + val; li.style.margin='4px 0';
  qs('#'+listId)?.appendChild(li);
  qs('#'+inpId).value='';
  enforceTwoPages();
}

/* Initialisierung Editor */
async function initEditor(){
  HEAD = getHEAD();
  document.getElementById('baBody')?.classList.add('theme-' + (HEAD?.type ?? 'Maschine'));

  // Daten laden: ABSOLUTE Pfade (unter Root). Cloudflare Pages mappt /editor → /editor.html
  PICTO = await fetch('/assets/pictos_index.json?v=20260105',{cache:'no-store'}).then(r=>r.json());
  SUG = await fetch('/assets/suggestions.json?v=20260105',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));

  renderHead();
  buildPicList();
  wireAssign();
  wireModal();
  renderSectionIcons();
  renderAllSuggestions();            // beim Start Vorschläge zeigen
  enforceTwoPages();

  // DOCX-Bibliothek dynamisch laden (mehrere CDNs; garantiert vor Export)
  await ensureDocxLib();
}

/* Kopfbereich rendern (Logo FIX) */
function renderHead(){
  const headDiv=qs('#head');
  const subStyle = `
    font-family:${HEAD.title?.fontFamily ?? 'Inter'};
    font-size:${(HEAD.title?.fontSize ?? 18)}px;
    ${HEAD.title?.bold?'font-weight:900;':''}
    ${HEAD.title?.center?'text-align:center;':''}
    text-transform:uppercase; letter-spacing:.6px;
  `;
  const logoHtml = HEAD.logoUrl
    ? `<img src="${HEAD.logoUrl}" alt="Logo" style="width:140px;height:auto;object-fit:contain;border-radius:8px;" />`
    : '';
  headDiv.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;justify-content:space-between">
      <div style="flex:1">
        <div style="${subStyle}">
          ${HEAD.title?.subtitleText ?? 'Betriebsanweisung'}
        </div>
        <div style="font-size:14px;color:#334155;margin-top:6px">
          ${(HEAD.title?.assetName ?? '').trim()}
        </div>
        <div class="small" style="margin-top:6px">
          ${HEAD.firm||''} ${HEAD.dept?('· '+HEAD.dept):''} ${HEAD.author?('· '+HEAD.author):''} ${HEAD.date?('· '+HEAD.date):''}
        </div>
      </div>
      <div>${logoHtml}</div>
    </div>
  `;
}

/* Piktogramm-Liste (Seitenleiste) */
function buildPicList(){
  const list = qs('#picList');
  const all = flattenPicto(PICTO);

  const render = ()=>{
    list.innerHTML='';
    const term = FILTER.term.toLowerCase();
    const groups = FILTER.groups;
    all.filter(p=>{
      if(!groups.has(p.group)) return false;
      if(!term) return true;
      return (p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term));
    }).forEach(p=>{
      const row = document.createElement('div'); row.className='picrow';

      const img = makeImg(p.webCandidates, `${p.code} ${p.name}`, 56);
      const code = document.createElement('div'); code.className='code'; code.textContent = p.code;
      const name = document.createElement('div'); name.style.fontSize='12px'; name.style.color='#334155'; name.textContent = p.name;

      row.appendChild(img); row.appendChild(code); row.appendChild(name);
      row.onclick = ()=>{ selectedPic = p; highlightRow(row); openModalWith(p); };
      list.appendChild(row);
    });
  };
  render();

  qs('#picSearch')?.addEventListener('input',(e)=>{ FILTER.term=e.target.value; render(); });
  qsa('.grp').forEach(ch=>{
    ch.addEventListener('change', ()=>{
      if(ch.checked) FILTER.groups.add(ch.value); else FILTER.groups.delete(ch.value);
      render();
    });
  });
}

function highlightRow(el){
  qsa('.picrow').forEach(r=>r.classList.remove('selected'));
  el.classList.add('selected');
}

/* Modal mit Piktogramm-Kacheln */
function wireModal(){
  qs('#modalClose')?.addEventListener('click', ()=> qs('#picModal').hidden = true);
}
function openModalWith(p){
  const modal = qs('#picModal');
  const grid = qs('#modalPicList');
  const pool = filterSameGroup(p.group);

  grid.innerHTML = '';
  pool.forEach(x=>{
    const card = document.createElement('div'); card.className='piccard';

    const img = makeImg(x.webCandidates, `${x.code} ${x.name}`, 72);
    const code = document.createElement('div'); code.style.fontWeight='800'; code.textContent = x.code;
    const name = document.createElement('div'); name.className='small'; name.textContent = x.name;

    card.appendChild(img); card.appendChild(code); card.appendChild(name);
    card.onclick = ()=>{ selectedPic = x; qs('#picModal').hidden=true; };
    grid.appendChild(card);
  });
  modal.hidden = false;
}
function filterSameGroup(group){
  return flattenPicto(PICTO).filter(p=>p.group===group);
}

/* Zuordnung zu Abschnitten */
function wireAssign(){
  qsa('.assignbar .target').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!selectedPic) return;
      const target = btn.dataset.target;
      const listId = target+'List';

      const wrap = document.createElement('div');
      wrap.style.display='flex'; wrap.style.gap='10px'; wrap.style.alignItems='center';

      const img = makeImg(selectedPic.webCandidates, `${selectedPic.code} ${selectedPic.name}`, 40);
      const code = document.createElement('strong'); code.textContent = selectedPic.code;
      const name = document.createElement('span'); name.className='small'; name.style.color='#334155'; name.textContent = selectedPic.name;

      wrap.appendChild(img); wrap.appendChild(code); wrap.appendChild(name);
      qs('#'+listId)?.appendChild(wrap);

      iconsBySection[target].push(selectedPic);
      renderSuggestions(target);   // direkt Vorschläge zeigen/aktualisieren
      renderSectionIcons();
      enforceTwoPages();
    });
  });
}

/* Vorschläge (mind. 5) — beim Laden und nach Zuordnung */
function processKeyFromHead(){
  const s = (HEAD?.title?.assetName ?? '').toLowerCase();
  const keys = Object.keys(SUG);
  const match = keys.find(k => s.includes(k.toLowerCase()));
  return match || 'Allgemein';
}
function renderAllSuggestions(){
  sections.forEach(renderSuggestions);
}
function renderSuggestions(section){
  const holder = qs('#'+section+'Sug');
  if(!holder) return;

  const key = processKeyFromHead();
  const candidatesPrimary = ((SUG[key] ?? {})[section] ?? []);
  const candidatesFallback = ((SUG['Allgemein'] ?? {})[section] ?? []);
  let arr = candidatesPrimary.length ? candidatesPrimary : candidatesFallback;

  const top5 = arr.slice(0,5);
  holder.innerHTML = '';
  top5.forEach(text=>{
    const row = document.createElement('div');
    row.style.display='flex'; row.style.gap='8px'; row.style.alignItems='center';
    const btn = document.createElement('button'); btn.className='btn-primary'; btn.style.padding='6px 10px'; btn.textContent='➕';
    const span = document.createElement('span'); span.textContent = text;

    btn.addEventListener('click', ()=>{
      const listId = section+'List';
      const li = document.createElement('div'); li.textContent = '• ' + text; li.style.margin='4px 0';
      qs('#'+listId)?.appendChild(li);
      enforceTwoPages();
    });

    row.appendChild(btn); row.appendChild(span);
    holder.appendChild(row);
  });
}

/* Abschnitts-Icons oben (erste Auswahl je Abschnitt) */
function renderSectionIcons(){
  const host = qs('#secIcons'); if(!host) return;
  host.innerHTML='';
  sections.forEach(sec=>{
    const first = iconsBySection[sec][0];
    if(first){
      const img = makeImg(first.webCandidates, `${first.code} ${first.name}`, 48);
      host.appendChild(img);
    }else{
      const ph = document.createElement('div');
      ph.className='small';
      ph.style.padding='8px'; ph.style.border='1px dashed #cbd5e1'; ph.style.borderRadius='8px';
      ph.textContent = sec.toUpperCase();
      host.appendChild(ph);
    }
  });
}

/* 2-Seiten-Regel grob erzwingen */
function enforceTwoPages(){
  const total = document.body.innerText.length;
  const hint = qs('#fontHint');
  if(hint) hint.style.display = total>6000 ? 'block' : 'none';
}

/* -------- Word-Export (.docx) -------- */
async function ensureDocxLib(){
  if (window.docx) return;
  const cdns = [
    'https://cdn.jsdelivr.net/npm/docx@8.4.0/build/index.js',
    'https://unpkg.com/docx@8.4.0/build/index.js',
    'https://cdn.skypack.dev/docx@8.4.0'   // ESM; wird als Fallback geladen
  ];
  for (const src of cdns){
    try{
      // Bereits eingebunden?
      if ([...document.scripts].some(s=>s.src===src)) continue;
      await new Promise((resolve, reject)=>{
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = ()=>resolve(); s.onerror = ()=>reject(new Error('CDN nicht erreichbar'));
        document.head.appendChild(s);
      });
      if (window.docx) return;
    }catch(_e){ /* nächster CDN */ }
  }
  if (!window.docx) throw new Error('DOCX-Bibliothek konnte nicht geladen werden.');
}

async function fetchAsArrayBufferWithFallback(candidates){
  for (const u of candidates){
    try{
      const res = await fetch(u, {mode:'cors'});
      if(res.ok){ return await res.arrayBuffer(); }
    }catch(_e){ /* weiter versuchen */ }
  }
  throw new Error('Bild konnte nicht geladen werden.');
}
function collectTexts(listId){
  return [...qs('#'+listId).querySelectorAll('div')]
    .map(div=>div.textContent?.trim() ?? '')
    .filter(Boolean);
}
function collectPics(section){
  return iconsBySection[section] ?? [];
}

function buildDocParagraphs(sectionId, title){
  const { Paragraph, TextRun } = docx;
  const texts = collectTexts(sectionId);
  const runs = texts.map(t => new Paragraph({ children:[ new TextRun({ text:t, font:'Inter', size:24 }) ] }));
  return [ new Paragraph({ children:[ new TextRun({ text:title, bold:true, size:26, font:'Inter' }) ] }), ...runs ];
}

async function makeDocx(){
  // Stelle sicher, dass die Bibliothek garantiert geladen ist
  await ensureDocxLib();
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType } = docx;

  // Kopfzeile
  const headPara = new Paragraph({
    children:[
      new TextRun({ text:(HEAD.title?.subtitleText ?? 'Betriebsanweisung'), bold:true, size:28, font:'Inter' }),
      new TextRun({ text:' – '+(HEAD.title?.assetName ?? ''), bold:false, size:26, font:'Inter' }),
    ]
  });

  // Logo
  let logoPara = null;
  if (HEAD.logoUrl) {
    try {
      const buf = await fetchAsArrayBufferWithFallback([HEAD.logoUrl, staticallyUrl(HEAD.logoUrl), weservUrl(HEAD.logoUrl)]);
      const img = new ImageRun({ data:buf, transformation:{ width:140, height:60 } });
      logoPara = new Paragraph({ children:[ img ] });
    } catch(_e){ /* ohne Logo weiter */ }
  }

  // Piktogramm-Tabelle
  const allRows = [];
  for (const sec of sections){
    const pics = collectPics(sec);
    if (pics.length===0) continue;
    // Abschnittstitel
    allRows.push(new TableRow({
      children:[
        new TableCell({
          columnSpan:3,
          children:[ new Paragraph({ children:[ new TextRun({ text:sec.toUpperCase(), bold:true, size:26, font:'Inter' }) ] }) ]
        })
      ]
    }));
    // Zeilen mit Bildern + Code + Name
    for (const p of pics){
      let imgRun = null;
      try{
        const ab = await fetchAsArrayBufferWithFallback(p.docxCandidates);
        imgRun = new ImageRun({ data:ab, transformation:{ width:28, height:28 } });
      }catch(_e){
        // Text-Fallback
        imgRun = new TextRun({ text:'(Bild)', font:'Inter', size:22 });
      }
      allRows.push(new TableRow({
        children: [
          new TableCell({ children:[ new Paragraph({ children:[ imgRun instanceof TextRun ? imgRun : imgRun ] }) ] }),
          new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:p.code, bold:true, font:'Inter', size:24 }) ] }) ] }),
          new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:p.name, font:'Inter', size:24 }) ] }) ] })
        ]
      }));
    }
  }

  const picTable = allRows.length
    ? new Table({ width:{ size:100, type:WidthType.PERCENTAGE }, rows: allRows })
    : null;

  // Textabschnitte
  const paras = [
    headPara,
    ...(logoPara ? [ logoPara ] : []),
    ...buildDocParagraphs('appScope','Anwendungsbereich'),
    ...buildDocParagraphs('hazardList','Gefährdungen für Mensch und Umwelt'),
    ...buildDocParagraphs('techList','Schutzmaßnahmen und Verhaltensregeln – Technisch (S)'),
    ...buildDocParagraphs('orgList','Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)'),
    ...buildDocParagraphs('ppeList','Persönliche Schutzausrüstung (P)'),
    ...buildDocParagraphs('emList','Verhalten im Gefahrfall'),
    ...buildDocParagraphs('ehList','Erste Hilfe'),
    ...buildDocParagraphs('disList','Sachgerechte Entsorgung / Inaktivierung'),
    ...(picTable ? [ picTable ] : [])
  ];

  const doc = new Document({ sections:[ { properties:{}, children: paras } ] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Betriebsanweisung_${(HEAD.title?.assetName ?? 'Vorlage').replace(/\s+/g,'_')}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
}

// Export-Button: Garantiert zuerst Bibliothek laden, dann Export
qs('#exportDocx')?.addEventListener('click', async ()=>{
  try{
    await ensureDocxLib();
    await makeDocx();
  }catch(err){
    alert('Export fehlgeschlagen: '+(err?.message ?? err));
  }
});
