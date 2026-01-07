
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

/* Kopf-Zustand */
function getHEAD(){ try{ return JSON.parse(localStorage.getItem('BA_HEAD') ?? '{}'); }catch{ return {}; } }
function setHEAD(h){ localStorage.setItem('BA_HEAD', JSON.stringify(h ?? {})); }

/* ---------------- INDEX ---------------- */
function initIndex(){
  const root = qs('#indexRoot');
  const btn = qs('#continue');
  const logoInp = qs('#logoFile'), logoPrev = qs('#logoPreview'), logoUrl = qs('#logoUrl');

  logoInp?.addEventListener('change', () => {
    const f = logoInp.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = () => { window.__uploadedLogoUrl = reader.result; logoPrev.innerHTML = `${reader.result}`; };
    reader.readAsDataURL(f);
  });

  btn?.addEventListener('click', (e)=>{
    e.preventDefault();
    const type = qsa('input[name="type"]').find(r=>r.checked)?.value ?? 'Maschine';
    const head = {
      type,
      firm: qs('#firm')?.value?.trim() ?? '',
      dept: qs('#dept')?.value?.trim() ?? '',
      author: qs('#author')?.value?.trim() ?? '',
      date: qs('#date')?.value ?? '',
      logoUrl: (logoUrl?.value?.trim() || window.__uploadedLogoUrl || ''),
      title: {
        assetName: qs('#assetName')?.value?.trim() ?? '',
        subtitleText: qs('#subtitleText')?.value?.trim() ?? 'Betriebsanweisung',
        bold: !!qs('#subtitleBold')?.checked,
        center: !!qs('#subtitleCenter')?.checked,
        fontFamily: qs('#fontFamily')?.value ?? 'Inter',
        fontSize: parseInt(qs('#fontSize')?.value ?? '18',10)
      }
    };
    setHEAD(head);
    window.location.href = '/editor';
  });

  qs('#typeRow')?.addEventListener('change',(e)=>{
    const val=e.target?.value; if(!val) return;
    root.classList.remove('theme-Gefahrstoff','theme-Biostoff','theme-Maschine','theme-PSA');
    root.classList.add('theme-'+val);
  });
}

/* ---------------- EDITOR ---------------- */
let PICTO=null, SUG={}, FILTER={groups:new Set(['iso','ghs','adr']), term:''};
const sections=['hazard','tech','org','ppe','em','eh','dis'];
const iconsBySection={hazard:[],tech:[],org:[],ppe:[],em:[],eh:[],dis:[]};
let selectedPic=null, HEAD={};

/* Data-URL -> ArrayBuffer (Word) */
function arrayBufferFromDataUrl(dataUrl){
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i=0;i<len;i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* Flatten inline JSON */
function flattenPictoInline(src){
  const out=[];
  ['ghs','iso','adr'].forEach(group=>{
    const obj = src[group] ?? {};
    Object.keys(obj).forEach(code=>{
      const it = obj[code];
      out.push({ group, code, name: it.name, thumbDataUrl: it.thumbDataUrl, fullDataUrl: it.fullDataUrl });
    });
  });
  return out;
}

/* Freitext */
function addFreeText(inpId, listId){
  const val=qs('#'+inpId)?.value?.trim(); if(!val) return;
  const li=document.createElement('div'); li.textContent='• '+val; li.style.margin='4px 0';
  qs('#'+listId)?.appendChild(li); qs('#'+inpId).value=''; enforceTwoPages();
}

/* Başlat */
async function initEditor(){
  HEAD=getHEAD();
  qs('#baBody')?.classList.add('theme-'+(HEAD?.type ?? 'Maschine'));

  // Offline veri
  PICTO = await fetch('/assets/pictos_index_inline.json',{cache:'no-store'}).then(r=>r.json());
  SUG   = await fetch('/assets/suggestions.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));

  renderHead();
  buildPicList();
  wireAssign(); wireModal();
  renderSectionIcons(); renderAllSuggestions(); enforceTwoPages();

  if (!window.docx) console.warn('DOCX-Bibliothek fehlt. Prüfe /assets/lib/docx.min.js und <script>-Einbindung.');
}

/* Kopf */
function renderHead(){
  const h=qs('#head');
  const subStyle=`
    font-family:${HEAD.title?.fontFamily ?? 'Inter'};
    font-size:${(HEAD.title?.fontSize ?? 18)}px;
    ${HEAD.title?.bold?'font-weight:900;':''}
    ${HEAD.title?.center?'text-align:center;':''}
    text-transform:uppercase; letter-spacing:.6px;`;
  const logo = HEAD.logoUrl ? `${HEAD.logoUrl}` : '';
  h.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
      <div style="flex:1">
        <div style="${subStyle}">${HEAD.title?.subtitleText ?? 'Betriebsanweisung'}</div>
        <div style="font-size:14px;color:#334155;margin-top:4px">${(HEAD.title?.assetName ?? '').trim()}</div>
        <div class="small" style="margin-top:4px">
          ${HEAD.firm||''} ${HEAD.dept?('· '+HEAD.dept):''} ${HEAD.author?('· '+HEAD.author):''} ${HEAD.date?('· '+HEAD.date):''}
        </div>
      </div>
      <div>${logo}</div>
    </div>`;
}

/* Liste + arama */
function buildPicList(){
  const list=qs('#picList'); const all=flattenPictoInline(PICTO);
  const render=()=>{
    list.innerHTML='';
    const term=FILTER.term.toLowerCase(); const groups=FILTER.groups;
    all.filter(p=>{
      if(!groups.has(p.group)) return false;
      if(!term) return true;
      return p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term);
    }).forEach(p=>{
      const row=document.createElement('div'); row.className='picrow';
      const img=document.createElement('img'); img.src=p.thumbDataUrl; img.width=44; img.height=44; img.alt=p.code+' '+p.name; img.style.objectFit='contain'; img.style.borderRadius='6px'; img.style.background='#fff';
      const code=document.createElement('div'); code.className='code'; code.textContent=p.code;
      const name=document.createElement('div'); name.style.fontSize='12px'; name.style.color='#334155'; name.textContent=p.name;
      row.appendChild(img); row.appendChild(code); row.appendChild(name);
      row.onclick=()=>{ selectedPic=p; highlightRow(row); openModalWith(p); };
      list.appendChild(row);
    });
  };
  render();
  qs('#picSearch')?.addEventListener('input',(e)=>{ FILTER.term=e.target.value; render(); });
  qsa('.grp').forEach(ch=> ch.addEventListener('change',()=>{ ch.checked?FILTER.groups.add(ch.value):FILTER.groups.delete(ch.value); render(); }));
}
function highlightRow(el){ qsa('.picrow').forEach(r=>r.classList.remove('selected')); el.classList.add('selected'); }

/* Modal */
function wireModal(){ qs('#modalClose')?.addEventListener('click', ()=> qs('#picModal').hidden=true ); }
function openModalWith(p){
  const m=qs('#picModal'), grid=qs('#modalPicList');
  const pool=flattenPictoInline(PICTO).filter(x=>x.group===p.group);
  grid.innerHTML='';
  pool.forEach(x=>{
    const card=document.createElement('div'); card.className='piccard';
    const img=document.createElement('img'); img.src=x.thumbDataUrl; img.width=64; img.height=64; img.alt=x.code+' '+x.name; img.style.objectFit='contain';
    const c=document.createElement('div'); c.style.fontWeight='800'; c.textContent=x.code;
    const n=document.createElement('div'); n.className='small'; n.textContent=x.name;
    card.appendChild(img); card.appendChild(c); card.appendChild(n);
    card.onclick=()=>{ selectedPic=x; qs('#picModal').hidden=true; };
    grid.appendChild(card);
  });
  m.hidden=false;
}

/* Zuordnung */
function wireAssign(){
  qsa('.assignbar .target').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!selectedPic) return;
      const sec=btn.dataset.target, listId=sec+'List';
      const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.gap='10px'; wrap.style.alignItems='center';
      const img=document.createElement('img'); img.src=selectedPic.thumbDataUrl; img.width=36; img.height=36; img.alt=selectedPic.code; img.style.objectFit='contain'; img.style.borderRadius='6px'; img.style.background='#fff';
      const code=document.createElement('strong'); code.textContent=selectedPic.code;
      const name=document.createElement('span'); name.className='small'; name.style.color='#334155'; name.textContent=selectedPic.name;
      wrap.appendChild(img); wrap.appendChild(code); wrap.appendChild(name);
      qs('#'+listId)?.appendChild(wrap);
      iconsBySection[sec].push(selectedPic);
      renderSuggestions(sec); renderSectionIcons(); enforceTwoPages();
    });
  });
}

/* Vorschläge */
function processKeyFromHead(){
  const s=(HEAD?.title?.assetName ?? '').toLowerCase();
  const keys=Object.keys(SUG); const m=keys.find(k=>s.includes(k.toLowerCase()));
  return m || 'Allgemein';
}
function renderAllSuggestions(){ sections.forEach(renderSuggestions); }
function renderSuggestions(section){
  const el=qs('#'+section+'Sug'); if(!el) return;
  const k=processKeyFromHead();
  const prim=((SUG[k] ?? {})[section] ?? []), fall=((SUG['Allgemein'] ?? {})[section] ?? []);
  const arr=prim.length?prim:fall; const top=arr.slice(0,5);
  el.innerHTML=''; top.forEach(t=>{
    const row=document.createElement('div'); row.style.display='flex'; row.style.gap='6px'; row.style.alignItems='center';
    const b=document.createElement('button'); b.className='btn-primary btn-compact'; b.textContent='➕';
    const s=document.createElement('span'); s.textContent=t;
    b.addEventListener('click',()=>{ const listId=section+'List'; const li=document.createElement('div'); li.textContent='• '+t; li.style.margin='4px 0'; qs('#'+listId)?.appendChild(li); enforceTwoPages(); });
    row.appendChild(b); row.appendChild(s); el.appendChild(row);
  });
}

/* Abschnitts-Icons */
function renderSectionIcons(){
  const host=qs('#secIcons'); if(!host) return; host.innerHTML='';
  sections.forEach(sec=>{
    const f=iconsBySection[sec][0];
    if(f){ const img=document.createElement('img'); img.src=f.thumbDataUrl; img.width=40; img.height=40; img.alt=f.code; img.style.objectFit='contain'; host.appendChild(img); }
    else{
      const ph=document.createElement('div'); ph.className='small';
      ph.style.padding='6px'; ph.style.border='1px dashed #cbd5e1'; ph.style.borderRadius='8px'; ph.textContent=sec.toUpperCase();
      host.appendChild(ph);
    }
  });
}

/* 2-Seiten kuralı (yaklaşık) */
function enforceTwoPages(){
  const total=document.body.innerText.length; const hint=qs('#fontHint');
  if(hint) hint.style.display = total>6000 ? 'block' : 'none';
}

/* -------- DOCX EXPORT -------- */
function docxReady(){ return !!(window.docx && window.docx.Document && window.docx.Packer); }
function textsOf(listId){ return [...qs('#'+listId).querySelectorAll('div')].map(d=>d.textContent?.trim()??'').filter(Boolean); }
function picsOf(sec){ return iconsBySection[sec] ?? []; }

function buildParas(sectionId, title){
  const {Paragraph,TextRun}=window.docx;
  const t=textsOf(sectionId);
  return [
    new Paragraph({children:[ new TextRun({text:title,bold:true,size:26,font:'Inter'}) ]}),
    ...t.map(x=> new Paragraph({children:[ new TextRun({text:x,font:'Inter',size:24}) ]}))
  ];
}

async function makeDocx(){
  if(!docxReady()) throw new Error('DOCX-Bibliothek konnte nicht geladen werden.');
  const {Document,Packer,Paragraph,TextRun,ImageRun,Table,TableRow,TableCell,WidthType}=window.docx;

  const head=new Paragraph({children:[
    new TextRun({text:(HEAD.title?.subtitleText ?? 'Betriebsanweisung'),bold:true,size:28,font:'Inter'}),
    new TextRun({text:' – '+(HEAD.title?.assetName ?? ''),size:26,font:'Inter'})
  ]});

  let logoPara=null;
  if(HEAD.logoUrl){
    try{
      const ab = arrayBufferFromDataUrl(HEAD.logoUrl);
      logoPara=new Paragraph({children:[ new ImageRun({data:ab,transformation:{width:140,height:60}}) ]});
    }catch(_e){}
  }

  const rows=[];
  for(const sec of sections){
    const pics=picsOf(sec); if(!pics.length) continue;
    rows.push(new TableRow({children:[ new TableCell({columnSpan:3,children:[ new Paragraph({children:[ new TextRun({text:sec.toUpperCase(),bold:true,size:26,font:'Inter'}) ]}) ]}) ]}));
    for(const p of pics){
      let imgRun;
      try{
        const ab = arrayBufferFromDataUrl(p.fullDataUrl);
        imgRun=new ImageRun({data:ab,transformation:{width:28,height:28}});
      }catch(_e){ imgRun=new TextRun({text:'(Bild)',font:'Inter',size:22}); }
      rows.push(new TableRow({children:[
        new TableCell({children:[ new Paragraph({children:[ imgRun ]}) ]}),
        new TableCell({children:[ new Paragraph({children:[ new TextRun({text:p.code,bold:true,font:'Inter',size:24}) ]}) ]}),
        new TableCell({children:[ new Paragraph({children:[ new TextRun({text:p.name,font:'Inter',size:24}) ]}) ]})
      ]}));
    }
  }
  const table = rows.length ? new Table({width:{size:100,type:WidthType.PERCENTAGE},rows}) : null;

  const children=[
    head, ...(logoPara?[logoPara]:[]),
    ...buildParas('appScope','Anwendungsbereich'),
    ...buildParas('hazardList','Gefährdungen für Mensch und Umwelt'),
    ...buildParas('techList','Schutzmaßnahmen und Verhaltensregeln – Technisch (S)'),
    ...buildParas('orgList','Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)'),
    ...buildParas('ppeList','Persönliche Schutzausrüstung (P)'),
    ...buildParas('emList','Verhalten im Gefahrfall'),
    ...buildParas('ehList','Erste Hilfe'),
    ...buildParas('disList','Sachgerechte Entsorgung / Inaktivierung'),
    ...(table?[table]:[])
  ];

  const doc=new Document({sections:[{properties:{},children}]});
  const blob=await Packer.toBlob(doc);
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`Betriebsanweisung_${(HEAD.title?.assetName ?? 'Vorlage').replace(/\s+/g,'_')}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
}

qs('#exportDocx')?.addEventListener('click', async ()=>{
  try{
    if(!docxReady()) throw new Error('DOCX-Bibliothek konnte nicht geladen werden.');
    await makeDocx();
  }catch(e){ alert('Export fehlgeschlagen: '+(e?.message ?? e)); }
});
