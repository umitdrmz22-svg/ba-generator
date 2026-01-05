
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
      logoPrev.innerHTML = `<img src="${dataUrl}" alt="Logo" style="height:62px;object-fit:contain;border-radius:8px;">`;
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
    window.location.href = '/editor.html';
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

function addFreeText(inpId, listId){
  const val = qs('#'+inpId)?.value?.trim();
  if(!val) return;
  const li = document.createElement('div'); li.textContent = '• ' + val; li.style.margin='4px 0';
  qs('#'+listId)?.appendChild(li);
  qs('#'+inpId).value='';
  enforceTwoPages();
}

async function initEditor(){
  HEAD = getHEAD();
  document.getElementById('baBody')?.classList.add('theme-' + (HEAD?.type ?? 'Maschine'));

  // Daten laden (Piktogramme + Vorschläge)
  PICTO = await fetch('/assets/pictos_index.json?v=20260105',{cache:'no-store'}).then(r=>r.json());
  SUG = await fetch('/assets/suggestions.json?v=20260105',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));

  renderHead();
  buildPicList();
  wireAssign();
  wireModal();
  renderSectionIcons();
  enforceTwoPages();

  // DOCX-Bibliothek dynamisch laden (CDN)
  await ensureDocxLib();
}

/* Kopfbereich rendern */
function renderHead(){
  const headDiv=qs('#head');
  const subStyle = `
    font-family:${HEAD.title?.fontFamily ?? 'Inter'};
    font-size:${(HEAD.title?.fontSize ?? 18)}px;
    ${HEAD.title?.bold?'font-weight:900;':''}
    ${HEAD.title?.center?'text-align:center;':''}
    text-transform:uppercase; letter-spacing:.6px;
  `;
  const logoHtml = HEAD.logoUrl ? `<img src="${HEAD.logoUrl}" alt="Logo" style="width:140px;height:auto;object-fit:contain;border-radius:8px;" />` : '';
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
      row.innerHTML = `
        <img src="${p.img}" alt="${p.code}">
        <div class="code">${p.code}</div>
        <div style="font-size:12px;color:#334155">${p.name}</div>
      `;
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
    card.innerHTML = `<img src="${x.img}" alt="${x.code}"><div style="font-weight:800">${x.code}</div><div class="small">${x.name}</div>`;
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
      const li = document.createElement('div');
      li.style.display='flex'; li.style.gap='10px'; li.style.alignItems='center';
      li.innerHTML = `<img src="${selectedPic.img}" alt="${selectedPic.code}" style="width:32px;height:32px;object-fit:contain;border-radius:6px;"> <strong>${selectedPic.code}</strong> <span class="small" style="color:#334155">${selectedPic.name}</span>`;
      qs('#'+listId)?.appendChild(li);
      iconsBySection[target].push(selectedPic);
      showSuggestionsFor(target, selectedPic);
      enforceTwoPages();
    });
  });
}

/* Vorschläge anzeigen (mind. 5) */
function showSuggestionsFor(section, pic){
  const holder = qs('#'+section+'Sug');
  if(!holder) return;
  const processKey = (HEAD?.title?.assetName ?? 'Allgemein').toLowerCase();
  const matchedProcess = pickProcessKey(processKey);
  const candidates = ((SUG[matchedProcess] ?? {})[section] ?? []);
  const top5 = candidates.slice(0,5);
  holder.innerHTML = '';
  if(top5.length===0) return;
  top5.forEach(text=>{
    const row = document.createElement('div');
    row.style.display='flex'; row.style.gap='8px'; row.style.alignItems='center';
    row.innerHTML = `<button class="btn-primary" style="padding:6px 10px;">➕</button> <span>${text}</span>`;
    row.querySelector('button')?.addEventListener('click', ()=>{
      const listId = section+'List';
      const li = document.createElement('div'); li.textContent = '• ' + text; li.style.margin='4px 0';
      qs('#'+listId)?.appendChild(li);
      enforceTwoPages();
    });
    holder.appendChild(row);
  });
}

/* Prozess-Schlüssel heuristisch wählen */
function pickProcessKey(s){
  const keys = Object.keys(SUG);
  const match = keys.find(k => s.includes(k.toLowerCase()));
  return match ?? 'Allgemein';
}

/* Flatten für Piktogramme */
function flattenPicto(src){
  const out = [];
  ['ghs','iso','adr'].forEach(group=>{
    const obj = src[group] ?? {};
    Object.keys(obj).forEach(code=>{
      const item = obj[code];
      out.push({ group, code, name:item.name, img:item.img, imgRaw:item.imgRaw ?? item.img });
    });
  });
  return out;
}

/* Abschnitts-Icons oben (erste Auswahl je Abschnitt) */
function renderSectionIcons(){
  const host = qs('#secIcons'); host.innerHTML='';
  sections.forEach(sec=>{
    const img = iconsBySection[sec][0]?.img ?? null;
    const html = img ? `<img src="${img}" alt="${sec}">` : `<div class="small" style="padding:8px;border:1px dashed #cbd5e1;border-radius:8px;">${sec.toUpperCase()}</div>`;
    host.insertAdjacentHTML('beforeend', html);
  });
}

/* 2-Seiten-Regel grob erzwingen */
function enforceTwoPages(){
  const total = document.body.innerText.length;
  const hint = qs('#fontHint');
  if(total>6000){ hint.style.display='block'; } else { hint.style.display='none'; }
}

/* -------- Word-Export (.docx) -------- */
async function ensureDocxLib(){
  if (window.docx) return;
  await new Promise((resolve)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/docx@8.4.0/build/index.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}
async function fetchAsArrayBuffer(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Bild konnte nicht geladen werden: '+url);
  return await res.arrayBuffer();
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
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = docx;

  // Kopfzeile
  const headPara = new Paragraph({
    children:[
      new TextRun({ text:(HEAD.title?.subtitleText ?? 'Betriebsanweisung'), bold:true, size:28, font:'Inter' }),
      new TextRun({ text:' – '+(HEAD.title?.assetName ?? ''), bold:false, size:26, font:'Inter' }),
    ]
  });

  // Logo
  let logoRun = null;
  if (HEAD.logoUrl) {
    try {
      const buf = await fetchAsArrayBuffer(HEAD.logoUrl);
      logoRun = new ImageRun({ data:buf, transformation:{ width:140, height:60 } });
    } catch(e){ /* Fallback ohne Logo */ }
  }

  // Abschnitt: Piktogramme als Tabelle
  const picParas = [];
  sections.forEach(sec=>{
    const items = collectPics(sec);
    if(items.length===0) return;
    picParas.push(new Paragraph({ children:[ new TextRun({ text:sec.toUpperCase(), bold:true, size:26, font:'Inter' }) ] }));
    items.forEach(p=>{
      picParas.push(new Paragraph({ children:[
        new TextRun({ text:`${p.code} – ${p.name}`, size:24, font:'Inter' })
      ]}));
    });
  });

  // Textabschnitte
  const paras = [
    headPara,
    ...(logoRun ? [ new Paragraph({ children:[ logoRun ] }) ] : []),
    ...buildDocParagraphs('appScope','Anwendungsbereich'),
    ...buildDocParagraphs('hazardList','Gefährdungen für Mensch und Umwelt'),
    ...buildDocParagraphs('techList','Schutzmaßnahmen und Verhaltensregeln – Technisch (S)'),
    ...buildDocParagraphs('orgList','Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)'),
    ...buildDocParagraphs('ppeList','Persönliche Schutzausrüstung (P)'),
    ...buildDocParagraphs('emList','Verhalten im Gefahrfall'),
    ...buildDocParagraphs('ehList','Erste Hilfe'),
    ...buildDocParagraphs('disList','Sachgerechte Entsorgung / Inaktivierung'),
    ...picParas
  ];

  const doc = new Document({ sections:[ { properties:{}, children: paras } ] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Betriebsanweisung_${(HEAD.title?.assetName ?? 'Vorlage').replace(/\s+/g,'_')}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
}

qs('#exportDocx')?.addEventListener('click', ()=> makeDocx().catch(err=>alert('Export fehlgeschlagen: '+err.message)));

/* Ende */
