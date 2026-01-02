
// assets/app.js
const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;
try { isIndex = !!qs('#continue'); } catch {}
try { isEditor = !!qs('#baRoot');  } catch {}

function getHEAD(){ try{ return JSON.parse(localStorage.getItem('BA_HEAD')||'{}'); }catch{return{}} }
let HEAD = getHEAD();

// ---------------- INDEX ----------------
try {
  if (isIndex) {
    const btn = qs('#continue');
    const logoInp = qs('#logoFile'), logoPrev = qs('#logoPreview');
    window.__uploadedLogoUrl = '';

    logoInp?.addEventListener('change', ()=>{ logoPrev.textContent='(Upload übersprungen: keine Cloud‑Umgebung)'; });

    btn?.addEventListener('click',(e)=>{
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
          fontSize    : parseInt(qs('#fontSize')?.value||'16',10)
        }
      };
      localStorage.setItem('BA_HEAD', JSON.stringify(head));
      location.href='editor.html';
    });

    const indexRoot=qs('#indexRoot');
    qs('#typeRow')?.addEventListener('change',(e)=>{
      const val=e.target?.value;
      if(!val) return;
      indexRoot.classList.remove('t-Gefahrstoff','t-Biostoff','t-Maschine','t-PSA');
      indexRoot.classList.add('t-'+val);
    });
  }
} catch(e){ console.error('Index error:', e); }

// ---------------- EDITOR ----------------
let PICTO=null, SUG={};
try { PICTO = await fetch('/assets/pictos_index.json',{cache:'no-store'}).then(r=>r.json()); } catch {}
try { SUG   = await fetch('/assets/suggestions.json',{cache:'no-store'}).then(r=>r.json()); } catch { SUG={}; }

const sections = ['hazard','tech','org','ppe','em','eh','dis'];
const iconsBySection = { hazard:[], tech:[], org:[], ppe:[], em:[], eh:[], dis:[] };
let autoExport=false;

function allPicKeys(){
  const isoKeys = Object.keys(PICTO?.iso||{}), ghsKeys = Object.keys(PICTO?.ghs||{});
  return [...isoKeys.map(k=>({group:'iso', code:k})), ...ghsKeys.map(k=>({group:'ghs', code:k}))];
}
function renderPicList(){
  const list=qs('#picList'); list.innerHTML='';
  allPicKeys().forEach(k=>{
    const entry = PICTO?.[k.group]?.[k.code]; if(!entry) return;
    const card = document.createElement('div'); card.className='piccard'; card.dataset.code=k.code; card.dataset.group=k.group;
    const img  = document.createElement('img'); img.src=entry.img; img.alt=entry.name||k.code;
    const code = document.createElement('div'); code.className='code'; code.textContent=k.code;
    card.appendChild(img); card.appendChild(code);
    card.addEventListener('click', ()=>selectPic(card));
    list.appendChild(card);
  });
}
let selectedPic=null;
function selectPic(el){
  qsa('.piccard.selected').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
  selectedPic = { code: el.dataset.code, group: el.dataset.group };
}

function renderHead(){
  HEAD = getHEAD();
  const headDiv=qs('#head');
  const subtitleStyle = `
    font-family:${HEAD.title?.fontFamily||'Arial'};
    font-size:${(HEAD.title?.fontSize||16)}px;
    ${HEAD.title?.bold?'font-weight:800;':''}
    ${HEAD.title?.center?'text-align:center;':''}
    text-transform:uppercase;
    letter-spacing:.6px;
  `;
  headDiv.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center">
      ${HEAD.logoUrl ? `${HEAD.logoUrl}` : ''}
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800;letter-spacing:.4px;text-transform:uppercase">${HEAD.title?.assetName || ''}</div>
        <div style="${subtitleStyle}">${HEAD.title?.subtitleText || 'Betriebsanweisung'}</div>
        <div class="small">Typ: ${HEAD.type||'-'} • Unternehmen: ${HEAD.firm||'-'} • Abteilung: ${HEAD.dept||'-'} • Ersteller: ${HEAD.author||'-'} • Datum: ${HEAD.date||'-'}</div>
      </div>
    </div>
  `;
}

function renderSectionIcons(sec){
  const wrap=qs('#icons-'+sec); wrap.innerHTML='';
  iconsBySection[sec].forEach(code=>{
    const entry = PICTO?.iso?.[code] || PICTO?.ghs?.[code];
    if(!entry) return;
    const img=document.createElement('img'); img.src=entry.img; img.alt=entry.name||code;
    wrap.appendChild(img);
  });
}

qsa('.assignbar .target').forEach(t=>{
  t.addEventListener('click', async ()=>{
    if(!selectedPic){ alert('Önce piktogram seçin.'); return; }
    const sec = t.dataset.target;
    if(!iconsBySection[sec].includes(selectedPic.code)) iconsBySection[sec].push(selectedPic.code);
    renderSectionIcons(sec);
    await refreshPools(sec, true); // AI ile en az 5’e tamamla
    if (autoExport) { await exportDocx('silent'); } // otomatik Word’e gönder
  });
});

qs('#autoExport')?.addEventListener('change',(e)=>{ autoExport = !!e.target.checked; });

// AI çağrısı
async function aiSuggest(section, pics, head){
  try{
    const url = `/ai-suggest?section=${encodeURIComponent(section)}&type=${encodeURIComponent(head.type||'')}&asset=${encodeURIComponent(head.title?.assetName||'')}&pics=${encodeURIComponent(pics.join(','))}`;
    const r = await fetch(url,{cache:'no-store'}); if(!r.ok) return [];
    const data = await r.json(); return Array.isArray(data)?data:[];
  }catch{ return []; }
}

// Havuzlar: her cümle tek tek seçilir
function fillPool(divId, items){
  const div=qs('#'+divId); if(!div) return; div.innerHTML='';
  (items||[]).forEach(t=>{
    const b=document.createElement('button'); b.textContent='➕ '+t; b.style.margin='4px';
    b.addEventListener('click',()=>{
      const listId=divId.replace('Pool','List');
      const li=document.createElement('div'); li.textContent='• '+t; li.style.margin='3px 0';
      qs('#'+listId)?.appendChild(li); enforceTwoPages();
    });
    div.appendChild(b);
  });
}

function fromList(id){ return qsa('#'+id+' div').map(x=>x.textContent.replace(/^[•\u2022]\s*/,'')); }

async function refreshPools(sectionChanged, withAI=false){
  const type = HEAD.type || 'Maschine';
  async function build(sec){
    const pics = iconsBySection[sec];
    const localSet = new Set();
    pics.forEach(p=> (SUG?.[type]?.[sec]?.[p] || []).forEach(x=>localSet.add(x)));
    let out=[...localSet];
    if(withAI){
      const ai = await aiSuggest(sec, pics, HEAD);
      while(out.length<5 && ai.length) out.push(ai.shift());
    }
    return out;
  }
  const todo = sectionChanged ? [sectionChanged] : sections;
  for(const s of todo){ fillPool(s+'Pool', await build(s)); }
}

const root=qs('#baRoot'), fontHint=qs('#fontHint');
function enforceTwoPages(){
  const a4px=1123, margin=40;
  let fs=parseInt(getComputedStyle(root).fontSize,10);
  const tooHigh = root.scrollHeight > (2*a4px - margin);
  if (tooHigh && fs>10){ root.style.fontSize=(fs-1)+'px'; fontHint.style.display='block'; setTimeout(enforceTwoPages,0); }
  else if (tooHigh && fs<=10){ fontHint.style.display='block'; }
  else { fontHint.style.display='none'; }
}

// DOCX export (Muster görünümü)
async function iconBytes(code){
  const entry = PICTO?.iso?.[code] || PICTO?.ghs?.[code];
  const r = await fetch(entry.img, {cache:'no-store'}); const ab = await r.arrayBuffer();
  return new Uint8Array(ab); // PNG/JPG
}
async function exportDocx(mode){
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun } =
    await import('https://cdn.jsdelivr.net/npm/docx@9.1.1/+esm');

  const barColor = (HEAD.type==='Gefahrstoff'?'E53935':(HEAD.type==='Biostoff'?'2E7D32':'005AA3'));
  const band = (t)=> new Table({
    width:{ size:100, type:WidthType.PERCENTAGE },
    rows:[ new TableRow({ children:[ new TableCell({
      shading:{ type:ShadingType.SOLID, color:barColor, fill:barColor },
      children:[ new Paragraph({ alignment:AlignmentType.CENTER, children:[ new TextRun({ text:t.toUpperCase(), bold:true, color:'FFFFFF' }) ] }) ]
    }) ] }) ]
  });

  const title=[];
  if(HEAD.title?.assetName){ title.push(new Paragraph({ children:[ new TextRun({ text:HEAD.title.assetName.toUpperCase(), bold:true, size:30 }) ] })); }
  title.push(new Paragraph({
    alignment:(HEAD.title?.center ? AlignmentType.CENTER : AlignmentType.LEFT),
    children:[ new TextRun({ text:(HEAD.title?.subtitleText || 'Betriebsanweisung').toUpperCase(), bold:!!HEAD.title?.bold, size:(HEAD.title?.fontSize ? HEAD.title.fontSize*2 : 30), font:(HEAD.title?.fontFamily || 'Arial') }) ]
  }));

  async function sectionBlock(titleText, secKey, listId){
    const icons = iconsBySection[secKey];
    const iconRuns=[];
    for(const c of icons.slice(0,10)){ // daha çok ikon (10'a kadar)
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
          new TableCell({ width:{ size:32, type:WidthType.PERCENTAGE }, children:(iconRuns.length?iconRuns:[new Paragraph('')]) }),
          new TableCell({ width:{ size:68, type:WidthType.PERCENTAGE }, children:(bullets.length?bullets:[new Paragraph('')]) })
        ]}) ]
      })
    ];
  }

  const doc = new Document({ sections:[{
    properties:{ page:{ margin:{ top:720, right:720, bottom:720, left:720 } } },
    children:[
      ...title,
      band('Anwendungsbereich'),
      new Paragraph({ text:(qs('#scope')?.value||'').trim()||'-' }),
      ...(await sectionBlock('Gefährdungen für Mensch und Umwelt','hazard','hazardList')),
      ...(await sectionBlock('Schutzmaßnahmen und Verhaltensregeln – Technisch (S)','tech','techList')),
      ...(await sectionBlock('Schutzmaßnahmen und Verhaltensregeln – Organisatorisch (O)','org','orgList')),
      ...(await sectionBlock('Persönliche Schutzausrüstung (P)','ppe','ppeList')),
      ...(await sectionBlock('Verhalten im Gefahrfall','em','emList')),
      ...(await sectionBlock('Erste Hilfe','eh','ehList')),
      ...(await sectionBlock('Sachgerechte Entsorgung / Inaktivierung','dis','disList'))
    ]
  }]});

  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download = (HEAD.title?.assetName ? HEAD.title.assetName+'_BA' : 'Betriebsanweisung') + '.docx';
  if (mode!=='silent') a.click(); else { // auto-export modunda yeni docu sessizce hazırlıyoruz
    // kullanıcıyı rahatsız etmeyelim; isterse Settings'e ekleriz → “Bufer’e kaydet” gibi.
    // Şimdilik görünmez link tıklatmıyoruz.
  }
  URL.revokeObjectURL(a.href);
}
qs('#saveDocx')?.addEventListener('click', ()=>exportDocx('manual'));

// İlk render
renderHead();
renderPicList();
refreshPools(null, true); // AI ile başlat
