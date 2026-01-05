
// assets/app.js
const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;

document.addEventListener('DOMContentLoaded', () => {
  try { isIndex  = !!qs('#continue'); } catch {}
  try { isEditor = !!qs('#baRoot');   } catch {}
  if (isIndex) initIndex();
  if (isEditor) initEditor();
});

// ---- Ortak: HEAD oku/yaz
function getHEAD(){ try{ return JSON.parse(localStorage.getItem('BA_HEAD') || '{}'); }catch{ return {}; } }
function setHEAD(head){ localStorage.setItem('BA_HEAD', JSON.stringify(head || {})); }

// ---- INDEX
function initIndex(){
  const root    = qs('#indexRoot');
  const btn     = qs('#continue');
  const logoInp = qs('#logoFile'), logoPrev = qs('#logoPreview');
  window.__uploadedLogoUrl = '';

  logoInp?.addEventListener('change', ()=>{ logoPrev.textContent='(Upload übersprungen: keine Cloud-Umgebung)'; });

  btn?.addEventListener('click', (e)=>{
    e.preventDefault();
    const type = qsa('input[name="type"]').find(r=>r.checked)?.value || 'Maschine';
    const head = {
      type,
      firm   : qs('#firm')?.value?.trim()   || '',
      dept   : qs('#dept')?.value?.trim()   || '',
      author : qs('#author')?.value?.trim() || '',
      date   : qs('#date')?.value           || '',
      logoUrl: window.__uploadedLogoUrl || '',
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
    // Kökten yönlendirme: path sorununu kesin çözer
    window.location.href = '/editor.html';
  });

  qs('#typeRow')?.addEventListener('change',(e)=>{
    const val=e.target?.value; if(!val) return;
    root.classList.remove('t-Gefahrstoff','t-Biostoff','t-Maschine','t-PSA');
    root.classList.add('t-' + val);
  });
}

// ---- EDITOR
let PICTO=null, SUG={}, FILTER={groups:new Set(['iso','ghs','adr']), term:''};
const sections = ['hazard','tech','org','ppe','em','eh','dis'];
const iconsBySection = { hazard:[], tech:[], org:[], ppe:[], em:[], eh:[], dis:[] };
let selectedPic=null, autoExport=false, HEAD={};

async function initEditor(){
  HEAD = getHEAD();
  document.getElementById('baBody')?.classList.add('theme-' + (HEAD?.type || 'Maschine'));

  // Veri kaynakları
  try { PICTO = await fetch('/assets/pictos_index.json?v=20260105',{cache:'no-store'}).then(r=>r.json()); } catch{}
  try { SUG   = await fetch('/assets/suggestions.json?v=20260105',{cache:'no-store'}).then(r=>r.json()); } catch{ SUG={}; }

  renderHead();
  wireFilters();
  renderPicList();
  refreshPools(null, true);

  // Atama barı
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

  // Kaydet Word
  qs('#saveDocx')?.addEventListener('click', ()=>exportDocx('manual'));

  enforceTwoPages();
}

// ---- Header render
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
  headDiv.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center">
      ${HEAD.logoUrl ? `${HEAD.logoUrl}` : ''}
      <div style="flex:1">
        <div style="font-size:20px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;text-align:center">${HEAD.title?.assetName || ''}</div>
        <div style="${subStyle}">${HEAD.title?.subtitleText || 'Betriebsanweisung'}</div>
        <div class="small" style="text-align:center">
          Typ: ${HEAD.type || '-'} • Unternehmen: ${HEAD.firm || '-'} • Abteilung: ${HEAD.dept || '-'} • Ersteller: ${HEAD.author || '-'} • Datum: ${HEAD.date || '-'}
        </div>
      </div>
    </div>
  `;
}

// ---- Piktogram listesi (dinamik grup + arama)
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
  // Grup checkleri
  qsa('.grp').forEach(chk=>{
    chk.addEventListener('change', ()=>{
      if(chk.checked) FILTER.groups.add(chk.value); else FILTER.groups.delete(chk.value);
      renderPicList();
    });
  });
  // Arama
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

// ---- Bölüm simgeleri
function renderSectionIcons(sec){
  const wrap = qs('#icons-' + sec); if(!wrap) return; wrap.innerHTML='';
  iconsBySection[sec].forEach(code=>{
    const entry = findEntry(code); if(!entry) return;
    const img = document.createElement('img'); img.src = entry.img; img.alt = entry.name || code;
    wrap.appendChild(img);
  });
}

// ---- Öneri havuzları
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

// Sunucu tarafı KI (varsa)
async function aiSuggest(section, pics, head){
  try{
    const url = `/ai-suggest?section=${encodeURIComponent(section)}&type=${encodeURIComponent(head.type||'')}&asset=${encodeURIComponent(head.title?.assetName||'')}&pics=${encodeURIComponent(pics.join(','))}`;
    const r = await fetch(url, {cache:'no-store'}); if(!r.ok) return [];
    const data = await r.json(); return Array.isArray(data)?data:[];
  }catch{ return []; }
}

// Yerel akıl yürütme (asset adı + simge kodları)
function localHeuristics(section, pics, head){
  const out = new Set();
  const name = (head?.title?.assetName || head?.asset || '').toLowerCase();

  const has = (code)=>pics.includes(code);
  const push = (arr)=>arr.forEach(s=>out.add(s));

  // Örnek kurallar (Makine/Werkstatt)
  if(section==='hazard'){
    if(/schweiß|schweiss|weld/.test(name)) push([
      'Schweißrauch, UV/IR-Strahlung und Funkenflug können Augen/Haut schädigen; Abschirmungen und Absaugung verwenden.',
      'Brand-/Explosionsgefahr durch Funken und heiße Schlacke; brennbare Stoffe entfernen, Löschmittel bereithalten.'
    ]);
    if(/flex|trennschleif|grinder/.test(name)) push([
      'Rotierende Scheibe: Rückschlag- und Bruchgefahr; nur freigegebene Scheiben, zulässige Drehzahl beachten.',
      'Hoher Lärm- und Staubanfall; geeigneten Gehör‑ und Atemschutz verwenden.'
    ]);
  }
  if(section==='tech'){
    if(has('W001')) push(['Gefahrenanalyse durchführen; Schutzhauben, Not‑Halt, Verriegelungen funktionsgeprüft betreiben.']);
    if(/weld|schweiß|schweiss/.test(name)) push(['Absaugung an der Quelle betreiben; Schweißstromquelle spannungsfrei schalten (LOTO) vor Wartung.']);
    if(has('GHS02')) push(['Zündquellen fernhalten; Erdung/Leitfähigkeit beim Umfüllen sicherstellen; Lüftung/Absaugung betreiben.']);
  }
  if(section==='org'){
    push(['Arbeiten nur nach Unterweisung und Freigabe; Zuständigkeiten und Sperrbereiche kennzeichnen.']);
    if(/hubarbeitsbühne|leiter/.test(name)) push(['PSAgA-Einsatz planen; Rettungskonzept und Wettergrenzen festlegen.']);
  }
  if(section==='ppe'){
    if(/weld|schweiß|schweiss/.test(name)) push(['Schweißschirm/Brille mit passendem Schutzstufenfilter, hitzebeständige Handschuhe und Schutzkleidung tragen.']);
    if(has('W021')) push(['Elektrische Gefährdung: isolierende Handschuhe/Schuhe, enganliegende Kleidung; Schmuck ablegen.']);
    push(['Sicherheitsschuhe mit Zehenschutz; bei Lärmexposition Gehörschutz; bei Span-/Staubflug Augenschutz.']);
  }
  if(section==='em'){
    push(['Gefahr → Not‑Halt betätigen, Bereich sichern und Personen warnen; nur ohne Selbstgefährdung eingreifen.']);
    if(has('GHS02')) push(['Brandfall: passende Löschmittel (Schaum/CO₂) einsetzen; Rückzündung beachten.']);
  }
  if(section==='eh'){
    push(['Verletzungen versorgen, Augenkontakt min. 15 min spülen; Notruf veranlassen und Maßnahmen dokumentieren.']);
  }
  if(section==='dis'){
    push(['Abfälle getrennt sammeln; öl-/chemiehaltige Stoffe gekennzeichneten Behältern zuführen; Nachweise führen.']);
  }
  return Array.from(out);
}

async function refreshPools(sectionChanged, withAI=false){
  const type = HEAD.type || 'Maschine';

  async function build(sec){
    const pics = iconsBySection[sec];
    const set = new Set();

    // Yerel eşleştirme: suggestions.json
    pics.forEach(p => (SUG?.[type]?.[sec]?.[p] || []).forEach(x => set.add(x)));

    // Makine adı ve seçili piktolara göre heuristik eklemeler
    localHeuristics(sec, pics, HEAD).forEach(x=>set.add(x));

    // Sunucu KI (varsa)
    if(withAI){
      const ai = await aiSuggest(sec, pics, HEAD);
      ai.forEach(x=>set.add(x));
    }

    // En fazla 12 öneri göster
    return Array.from(set).slice(0,12);
  }

  const todo = sectionChanged ? [sectionChanged] : sections;
  for(const s of todo){ fillPool(s+'Pool', await build(s)); }
}

// ---- İki sayfa kontrolü
const root=()=>qs('#baRoot'), fontHint=()=>qs('#fontHint');
function enforceTwoPages(){
  const a4px=1123, margin=40;
  let fs=parseInt(getComputedStyle(root()).fontSize,10);
  const tooHigh = root().scrollHeight > (2*a4px - margin);
  if (tooHigh && fs>10){ root().style.fontSize=(fs-1)+'px'; fontHint().style.display='block'; setTimeout(enforceTwoPages,0); }
  else if (tooHigh && fs<=10){ fontHint().style.display='block'; }
  else { fontHint().style.display='none'; }
}

// ---- Word export: docx (başlık şeritleri + simgeler + madde işaretleri)
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
function fromList(id){ return qsa('#'+id+' div').map(x=>x.textContent.replace(/^[•\\u2022]\\s*/,'').trim()); }
async function iconBytes(code){ const entry = findEntry(code); return await imageToPngBytes(entry.img); }

async function exportDocx(mode){
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, HeadingLevel } =
    await import('https://cdn.jsdelivr.net/npm/docx@9.1.1/+esm');

  const barColor = (HEAD.type==='Gefahrstoff'?'E53935':(HEAD.type==='Biostoff'?'2E7D32':(HEAD.type==='PSA'?'6A1B9A':'005AA3')));
  const band = (t)=> new Table({
    width:{ size:100, type:WidthType.PERCENTAGE },
    rows:[ new TableRow({ children:[ new TableCell({
      shading:{ type:ShadingType.SOLID, color:barColor, fill:barColor },
      children:[ new Paragraph({ alignment:AlignmentType.CENTER, children:[ new TextRun({ text:t.toUpperCase(), bold:true, color:'FFFFFF' }) ] }) ]
    }) ] }) ]
  });

  const headerTable = new Table({
    width:{ size:100, type:WidthType.PERCENTAGE },
    rows:[
      new TableRow({ children:[
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Unternehmen: ${HEAD.firm||'-'}` }) ] }) ] }),
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Abteilung: ${HEAD.dept||'-'}` }) ] }) ] }),
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Datum: ${HEAD.date||'-'}` }) ] }) ] })
      ]}),
      new TableRow({ children:[
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Verantwortlich: ${qs('#metaVer')?.value||'-'}` }) ] }) ] }),
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Bereich/Platz: ${qs('#metaArb')?.value||'-'}` }) ] }) ] }),
        new TableCell({ children:[ new Paragraph({ children:[ new TextRun({ text:`Nr.: ${qs('#metaNr')?.value||'-'}` }) ] }) ] })
      ]})
    ]
  });

  const title = [];
  if(HEAD.title?.assetName){
    title.push(new Paragraph({ alignment:AlignmentType.CENTER, heading:HeadingLevel.HEADING_1,
      children:[ new TextRun({ text:HEAD.title.assetName.toUpperCase(), bold:true, size:34 }) ] }));
  }
  title.push(new Paragraph({
    alignment:(HEAD.title?.center?AlignmentType.CENTER:AlignmentType.LEFT),
    children:[ new TextRun({ text:(HEAD.title?.subtitleText||'Betriebsanweisung').toUpperCase(), bold:!!HEAD.title?.bold, size:(HEAD.title?.fontSize?HEAD.title.fontSize*2:32), font:(HEAD.title?.fontFamily||'Arial') }) ]
  }));

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

  const doc = new Document({
    sections:[{
      properties:{ page:{ margin:{ top:720, right:720, bottom:720, left:720 } } },
      children:[
        ...title,
        headerTable,
        band('Anwendungsbereich'),
        new Paragraph({ text:(qs('#scope')?.value||'').trim() || '-' }),
        ...(await sectionBlock('Gefährdungen für Mensch und Umwelt','hazard','hazardList')),
        ...(await sectionBlock('Schutzmaßnahmen und Verhaltensregeln – Technisch (S)','tech','techList')),
        ...(await sectionBlock('Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)','org','orgList')),
        ...(await sectionBlock('Persönliche Schutzausrüstung (P)','ppe','ppeList')),
        ...(await sectionBlock('Verhalten im Gefahrfall','em','emList')),
        ...(await sectionBlock('Erste Hilfe','eh','ehList')),
        ...(await sectionBlock('Sachgerechte Entsorgung / Inaktivierung','dis','disList'))
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (HEAD.title?.assetName?HEAD.title.assetName+'_BA':'Betriebsanweisung')+'.docx';
  if (mode!=='silent') a.click();
  URL.revokeObjectURL(a.href);
}
