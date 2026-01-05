
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
