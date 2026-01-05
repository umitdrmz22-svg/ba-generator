
const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;

document.addEventListener('DOMContentLoaded', () => {
  try { isIndex  = !!qs('#continue'); } catch {}
  try { isEditor = !!qs('#baRoot');   } catch {}
  if (isIndex) initIndex();
  if (isEditor) initEditor();
});

function getHEAD(){ try{ return JSON.parse(localStorage.getItem('BA_HEAD') || '{}'); }catch{ return {}; } }
function setHEAD(head){ localStorage.setItem('BA_HEAD', JSON.stringify(head || {})); }

// ---------- INDEX ----------
function initIndex(){
  const root    = qs('#indexRoot');
  const btn     = qs('#continue');
  const logoInp = qs('#logoFile'), logoPrev = qs('#logoPreview'), logoUrl = qs('#logoUrl');
  window.__uploadedLogoUrl = '';

  logoInp?.addEventListener('change', ()=>{
    logoPrev.textContent='(Upload lokal – Cloud‑Upload nicht aktiv. Nutzen Sie ggf. eine Logo‑URL.)';
  });

  btn?.addEventListener('click', (e)=>{
    e.preventDefault();
    const type = qsa('input[name="type"]').find(r=>r.checked)?.value || 'Maschine';
    const head = {
      type,
      firm   : qs('#firm')?.value?.trim()   || '',
      dept   : qs('#dept')?.value?.trim()   || '',
      author : qs('#author')?.value?.trim() || '',
      date   : qs('#date')?.value           || '',
      logoUrl: (logoUrl?.value?.trim() || window.__uploadedLogoUrl || ''),
      title  : {
        assetName   : qs('#assetName')?.value?.trim() || '',
        subtitleText: qs('#subtitleText')?.value?.trim() || 'Betriebsanweisung',
        bold        : !!qs('#subtitleBold')?.checked,
        center      : !!qs('#subtitleCenter')?.checked,
        fontFamily  : qs('#fontFamily')?.value || 'Arial',
        fontSize    : parseInt(qs('#fontSize')?.value || '18',10)
      }
    };
    setHEAD(head);
    window.location.href = '/editor.html';
  });

  qs('#typeRow')?.addEventListener('change',(e)=>{
    const val=e.target?.value; if(!val) return;
    root.classList.remove('t-Gefahrstoff','t-Biostoff','t-Maschine','t-PSA');
    root.classList.add('t-' + val);
  });
}

// ---------- EDITOR ----------
let PICTO=null, SUG={}, FILTER={groups:new Set(['iso','ghs','adr']), term:''};
const sections = ['hazard','tech','org','ppe','em','eh','dis'];
const iconsBySection = { hazard:[], tech:[], org:[], ppe:[], em:[], eh:[], dis:[] };
let selectedPic=null, autoExport=false, HEAD={};

function addFreeText(inpId, listId){
  const val = qs('#'+inpId)?.value?.trim();
  if(!val) return;
  const li = document.createElement('div'); li.textContent = '• ' + val; li.style.margin='3px 0';
  qs('#'+listId)?.appendChild(li);
  qs('#'+inpId).value='';
  enforceTwoPages();
}

async function initEditor(){
  HEAD = getHEAD();
  document.getElementById('baBody')?.classList.add('theme-' + (HEAD?.type || 'Maschine'));

  try { PICTO = await fetch('/assets/pictos_index.json?v=20260105',{cache:'no-store'}).then(r=>r.json()); } catch{}
  try { SUG   = await fetch('/assets/suggestions.json?v=20260105',{cache:'no-store'}).then(r=>r.json()); } catch{ SUG={}; }

  renderHead();
  wireFilters();
  renderPicList();
  refreshPools(null, true);

  qsa('.assignbar .target').forEach(t=>{
    t.addEventListener('click', async ()=>{
      if(!selectedPic){ alert('Bitte zuerst ein Piktogramm auswählen.'); return; }
      const sec = t.dataset.target;
      if(!iconsBySection[sec].includes(selectedPic.code)) iconsBySection[sec].push(selectedPic.code);
      renderSectionIcons(sec);
      await refreshPools(sec, true);
      if(autoExport){ await exportDocx('silent'); }
    });
  });

  qs('#autoExport')?.addEventListener('change',(e)=>{ autoExport = !!e.target.checked; });

  qs('#saveDocx')?.addEventListener('click', ()=>exportDocx('manual'));

  enforceTwoPages();
}

function renderHead(){
  HEAD = getHEAD();
  const headDiv=qs('#head');
  const subStyle = `
    font-family:${HEAD.title?.fontFamily || 'Arial'};
    font-size:${(HEAD.title?.fontSize || 18)}px;
    ${HEAD.title?.bold?'font-weight:900;':''}
    ${HEAD.title?.center?'text-align:center;':''}
    text-transform:uppercase; letter-spacing:.6px;
  `;
  const logoHtml = HEAD.logoUrl ? `<img src="${HEAD.logoUrl}" alt="Logo" style="max-height:48px;max-width:160px;object-fit:contain;"/>` : '';
  headDiv.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center">
      <div style="flex:1">
        <div style="font-size:20px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;text-align:center">${HEAD.title?.assetName || ''}</div>
        <div style="${subStyle}">${HEAD.title?.subtitleText || 'Betriebsanweisung'}</div>
        <div class="small" style="text-align:center">
          Typ: ${HEAD.type || '-'} • Unternehmen: ${HEAD.firm || '-'} • Abteilung: ${HEAD.dept || '-'} • Ersteller: ${HEAD.author || '-'} • Datum: ${HEAD.date || '-'}
        </div>
      </div>
      ${logoHtml}
    </div>
  `;
}

function allPicKeys(){
  const groups = Object.keys(PICTO || {});
  const out = [];
  groups.forEach(g => Object.keys(PICTO[g] || {}).forEach(code => out.push({group:g, code})));
  return out;
}
function findEntry(code){
  for (const g of Object.keys(PICTO || {})) if (PICTO[g]?.[code]) return PICTO[g][code];
  return null;
}
function wireFilters(){
  qsa('.grp').forEach(chk=>{
    chk.addEventListener('change', ()=>{
      if(chk.checked) FILTER.groups.add(chk.value); else FILTER.groups.delete(chk.value);
      renderPicList();
    });
  });
  qs('#picSearch')?.addEventListener('input',(e)=>{
    FILTER.term = (e.target.value || '').trim().toLowerCase();
    renderPicList();
  });
}
function renderPicList(){
  const list=qs('#picList'); if(!list) return; list.innerHTML='';
  allPicKeys().forEach(k=>{
    if(!FILTER.groups.has(k.group)) return;
    const entry = PICTO?.[k.group]?.[k.code]; if(!entry) return;
    const hay = (k.code + ' ' + (entry.name || '')).toLowerCase();
    if(FILTER.term && !hay.includes(FILTER.term)) return;

    const row = document.createElement('div'); row.className='picrow'; row.dataset.code=k.code; row.dataset.group=k.group;
    const img = document.createElement('img'); img.src = entry.img; img.alt = entry.name || k.code;
    const code= document.createElement('div'); code.className='code'; code.textContent = k.code + (entry.name?` – ${entry.name}`:'');
    row.appendChild(img); row.appendChild(code);
    row.addEventListener('click', ()=>selectPic(row));
    list.appendChild(row);
  });
}
function selectPic(el){
  qsa('.picrow').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
  selectedPic = { code: el.dataset.code, group: el.dataset.group };
}

function renderSectionIcons(sec){
  const wrap = qs('#icons-' + sec); if(!wrap) return; wrap.innerHTML='';
  iconsBySection[sec].forEach(code=>{
    const entry = findEntry(code); if(!entry) return;
    const img = document.createElement('img'); img.src = entry.img; img.alt = entry.name || code;
    wrap.appendChild(img);
  });
}

// ----- Vorschläge
function fillPool(divId, items){
  const div=qs('#' + divId); if(!div) return; div.innerHTML='';
  (items || []).forEach(t=>{
    const b=document.createElement('button');
    b.textContent='➕ ' + t; b.style.margin='4px';
    b.addEventListener('click',()=>{
      const listId=divId.replace('Pool','List');
      const li=document.createElement('div'); li.textContent='• ' + t; li.style.margin='3px 0';
      qs('#' + listId)?.appendChild(li);
      enforceTwoPages();
    });
    div.appendChild(b);
  });
}
async function aiSuggest(section, pics, head){
  try{
    const url = `/ai-suggest?section=${encodeURIComponent(section)}&type=${encodeURIComponent(head.type||'')}&asset=${encodeURIComponent(head.title?.assetName||'')}&pics=${encodeURIComponent(pics.join(','))}`;
    const r = await fetch(url, {cache:'no-store'}); if(!r.ok) return [];
    const data = await r.json(); return Array.isArray(data)?data:[];
  }catch{ return []; }
}
function localHeuristics(section, pics, head){
  const out = new Set();
  const name = (head?.title?.assetName || head?.asset || '').toLowerCase();
  const has = (code)=>pics.includes(code);
  const push = (arr)=>arr.forEach(s=>out.add(s));

  if(section==='hazard'){
    if(/schweiß|schweiss|weld/.test(name)) push([
      'Schweißrauch, UV/IR-Strahlung und Funkenflug können Augen/Haut schädigen; Abschirmungen und Absaugung verwenden.',
      'Brand-/Explosionsgefahr durch Funken und heiße Schlacke; brennbare Stoffe entfernen, Löschmittel bereithalten.'
    ]);
    if(/trennschleif|flex|grinder/.test(name)) push([
      'Rotierende Scheibe: Rückschlag- und Bruchgefahr; nur freigegebene Scheiben, zulässige Drehzahl beachten.',
      'Lärm und Staubexposition; geeigneten Gehör‑ und Atemschutz verwenden.'
    ]);
    if(has('W012')) push(['Elektrische Gefährdungen: Leitungen/Gehäuse prüfen, Beschädigungen sofort melden und Betrieb unterbinden.']);
  }
  if(section==='tech'){
    push(['Schutzeinrichtungen (Hauben, Lichtschranken, Verriegelungen) funktionsgeprüft betreiben; Umgehungen sind verboten.']);
    if(/weld|schweiß|schweiss/.test(name)) push(['Absaugung an der Quelle; vor Wartung Freischalten (LOTO); Nachlaufzeiten beachten.']);
    if(has('GHS02')) push(['Zündquellen fernhalten; Erdung/Leitfähigkeit beim Umfüllen sicherstellen; Lüftung/Absaugung betreiben.']);
  }
  if(section==='org'){
    push(['Arbeiten nur nach Unterweisung/Freigabe; Zuständigkeiten, Sperrbereiche und Kennzeichnungen (ISO 7010) festlegen.']);
    push(['Prüf- und Wartungsintervalle dokumentieren; Mängel zeitnah beseitigen.']);
  }
  if(section==='ppe'){
    push(['Sicherheitsschuhe mit Zehenschutz; bei Span-/Staubflug Augenschutz; bei Lärm Gehörschutz.']);
    if(/weld|schweiß|schweiss/.test(name)) push(['Schweißschirm mit passender Schutzstufe, hitzebeständige Handschuhe und flammhemmende Kleidung.']);
  }
  if(section==='em'){
    push(['Gefahr → Not‑Halt betätigen, Bereich sichern, Personen warnen; nur ohne Selbstgefährdung eingreifen.']);
    if(has('GHS02')) push(['Brandfall: geeignete Löschmittel (Schaum/CO₂) einsetzen; Rückzündung beachten; Bereich räumen.']);
  }
  if(section==='eh'){
    push(['Verletzungen versorgen; Augenkontakt mindestens 15 Minuten spülen; Notruf; Maßnahmen dokumentieren.']);
  }
  if(section==='dis'){
    push(['Abfälle sortenrein erfassen; öl-/chemiehaltige Abfälle gekennzeichneten Behältern zuführen; Nachweise führen.']);
  }
  return Array.from(out);
}

async function refreshPools(sectionChanged, withAI=false){
  const type = HEAD.type || 'Maschine';
  async function build(sec){
    const pics = iconsBySection[sec];
    const set = new Set();
    pics.forEach(p => (SUG?.[type]?.[sec]?.[p] || []).forEach(x => set.add(x)));
    localHeuristics(sec, pics, HEAD).forEach(x=>set.add(x));
    if(withAI){
      const ai = await aiSuggest(sec, pics, HEAD);
      ai.forEach(x=>set.add(x));
    }
    return Array.from(set).slice(0,12);
  }
  const todo = sectionChanged ? [sectionChanged] : sections;
  for(const s of todo){ fillPool(s+'Pool', await build(s)); }
}

// ---------- Layout/Export ----------
const root=()=>qs('#baRoot'), fontHint=()=>qs('#fontHint');
function enforceTwoPages(){
  const a4px=1123, margin=40;
  let fs=parseInt(getComputedStyle(root()).fontSize,10);
  const tooHigh = root().scrollHeight > (2*a4px - margin);
  if (tooHigh && fs>10){ root().style.fontSize=(fs-1)+'px'; fontHint().style.display='block'; setTimeout(enforceTwoPages,0); }
  else if (tooHigh && fs<=10){ fontHint().style.display='block'; }
  else { fontHint().style.display='none'; }
}

async function imageToPngBytes(url){
  const res = await fetch(url, {cache:'no-store'}); if (!res.ok) throw new Error('img fetch failed');
  const ct  = res.headers.get('content-type') || '';
  const blob = await res.blob();
  if (/png|jpeg|jpg/i.test(ct)){ const ab = await blob.arrayBuffer(); return new Uint8Array(ab); }
  const dataUrl = await (async ()=>{
    if (/svg/i.test(ct)){ const svgText = await blob.text(); return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText); }
    return URL.createObjectURL(blob);
  })();
  const img = new Image(); img.crossOrigin = 'anonymous';
  const canvas = document.createElement('canvas'); canvas.width=96; canvas.height=96;
  const ctx = canvas.getContext('2d');
  await new Promise((ok,err)=>{ img.onload=ok; img.onerror=err; img.src=dataUrl; });
  ctx.clearRect(0,0,96,96); ctx.drawImage(img,0,0,96,96);
  const pngDataUrl = canvas.toDataURL('image/png');
  const b64 = pngDataUrl.split(',')[1]; const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  return bytes;
}
function fromList(id){ return qsa('#'+id+' div').map(x=>x.textContent.replace(/^[•\u2022]\s*/,'').trim()); }
async function iconBytes(code){ const entry = findEntry(code); return await imageToPngBytes(entry.img); }
async function logoBytes(){ if(!HEAD.logoUrl) return null; try{ return await imageToPngBytes(HEAD.logoUrl); }catch{ return null; } }

async function exportDocx(mode){
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, Footer, PageNumber } =
    await import('https://cdn.jsdelivr.net/npm/docx@9.1.1/+esm');

  const barColor = (HEAD.type==='Gefahrstoff'?'E53935':(HEAD.type==='Biostoff'?'2E7D32':(HEAD.type==='PSA'?'2E7D32':'005AA3')));
  const band = (t)=> new Table({
    width:{ size:100, type:WidthType.PERCENTAGE },
    rows:[ new TableRow({ children:[ new TableCell({
      shading:{ type:ShadingType.SOLID, color:barColor, fill:barColor },
      children:[ new Paragraph({ alignment:AlignmentType.CENTER, children:[ new TextRun({ text:t.toUpperCase(), bold:true, color:'FFFFFF' }) ] }) ]
    }) ] }) ]
  });

  const logo = await logoBytes();
  const headerRow = new TableRow({ children:[
    new TableCell({ children:[
      new Paragraph({ children:[ new TextRun({ text:(HEAD.title?.assetName||'').toUpperCase(), bold:true, size:34 }) ], alignment:AlignmentType.LEFT }),
      new Paragraph({ children:[ new TextRun({ text:(HEAD.title?.subtitleText||'Betriebsanweisung').toUpperCase(), bold:!!HEAD.title?.bold, size:(HEAD.title?.fontSize?HEAD.title.fontSize*2:32), font:(HEAD.title?.fontFamily||'Arial') }) ], alignment:(HEAD.title?.center?AlignmentType.CENTER:AlignmentType.LEFT) })
    ]}),
    new TableCell({ children:[ ...(logo ? [ new Paragraph({ children:[ new ImageRun({ data:logo, transformation:{ width:120, height:48 } }) ], alignment:AlignmentType.RIGHT }) ] : [ new Paragraph('') ]) ]})
  ]});

  const headerTable = new Table({
    width:{ size:100, type:WidthType.PERCENTAGE },
    rows:[ headerRow,
      new TableRow({ children:[
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Unternehmen: ${HEAD.firm||'-'}` }) ] }) ] }),
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Abteilung: ${HEAD.dept||'-'}` }) ] }) ] }),
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Datum: ${HEAD.date||'-'}` }) ] }) ] })
      ]})
    ]
  });

  async function sectionBlock(titleText, secKey, listId){
    const icons = iconsBySection[secKey];
    const iconRuns=[];
    for(const c of icons.slice(0,10)){
      try{ const bytes=await iconBytes(c);
        iconRuns.push(new Paragraph({ children:[ new ImageRun({ data:bytes, transformation:{ width:60, height:60 } }) ] }));
      }catch{}
    }
    const bullets = fromList(listId).map(t=> new Paragraph({ text:t, bullet:{ level:0 } }));
    return [
      band(titleText),
      new Table({
        width:{ size:100, type:WidthType.PERCENTAGE },
        rows:[ new TableRow({ children:[
          new TableCell({ width:{ size:32, type:WidthType.PERCENTAGE }, children:(iconRuns.length?iconRuns:[ new Paragraph('') ]) }),
          new TableCell({ width:{ size:68, type:WidthType.PERCENTAGE }, children:(bullets.length?bullets:[ new Paragraph('') ]) })
        ]}) ]
      })
    ];
  }

  const approvalTable = new Table({
    width:{ size:100, type:WidthType.PERCENTAGE },
    rows:[
      new TableRow({ children:[
        new TableCell({ children:[ new Paragraph({ text:"Ersteller: "+(HEAD.author||'-') }) ] }),
        new TableCell({ children:[ new Paragraph({ text:"Verantwortlich: "+(qs('#metaVer')?.value||'-') }) ] }),
        new TableCell({ children:[ new Paragraph({ text:"Datum: "+(HEAD.date||'-') }) ] })
      ]}),
      new TableRow({ children:[
        new TableCell({ children:[ new Paragraph("Unterschrift / Kästchen: _____________________") ] }),
        new TableCell({ children:[ new Paragraph("Unterschrift / Kästchen: _____________________") ] }),
        new TableCell({ children:[ new Paragraph("Unterschrift / Kästchen: _____________________") ] })
      ]})
    ]
  });

  const footer = new Footer({
    children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun("Seite "), PageNumber.CURRENT, new TextRun(" / "), PageNumber.TOTAL ] }) ]
  });

  const doc = new Document({
    sections:[{
      properties:{ page:{ margin:{ top:720, right:720, bottom:720, left:720 } }, footer },
      children:[
        headerTable,
        band('Anwendungsbereich'),
        new Paragraph({ text:(qs('#scope')?.value||'').trim() || '-' }),
        ...(await sectionBlock('Gefährdungen für Mensch und Umwelt','hazard','hazardList')),
        ...(await sectionBlock('Schutzmaßnahmen und Verhaltensregeln – Technisch (S)','tech','techList')),
        ...(await sectionBlock('Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)','org','orgList')),
        ...(await sectionBlock('Persönliche Schutzausrüstung (P)','ppe','ppeList')),
        ...(await sectionBlock('Verhalten im Gefahrfall','em','emList')),
        ...(await sectionBlock('Erste Hilfe','eh','ehList')),
        ...(await sectionBlock('Sachgerechte Entsorgung / Inaktivierung','dis','disList')),
        approvalTable
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (HEAD.title?.assetName?HEAD.title.assetName+'_BA':'Betriebsanweisung')+'.docx';
  if (mode!=='silent') a.click();
  URL.revokeObjectURL(a.href);
}
``
