
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

    logoInp?.addEventListener('change', ()=>{ logoPrev.textContent='(Upload übersprungen: keine Cloud-Umgebung)'; });

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
          fontSize    : parseInt(qs('#fontSize')?.value||'18',10)
        }
      };
      localStorage.setItem('BA_HEAD', JSON.stringify(head));
      location.href='editor.html';
    });

    const root = qs('#indexRoot');
    qs('#typeRow')?.addEventListener('change',(e)=>{
      const val=e.target?.value; if(!val) return;
      root.classList.remove('t-Gefahrstoff','t-Biostoff','t-Maschine','t-PSA');
      root.classList.add('t-'+val);
    });
  }
} catch(e){ console.error('INDEX', e); }

// ---------------- EDITOR ----------------
let PICTO=null, SUG={};
try { PICTO = await fetch('/assets/pictos_index.json',{cache:'no-store'}).then(r=>r.json()); } catch {}
try { SUG   = await fetch('/assets/suggestions.json',{cache:'no-store'}).then(r=>r.json()); } catch { SUG={}; }

const sections = ['hazard','tech','org','ppe','em','eh','dis'];
const iconsBySection = { hazard:[], tech:[], org:[], ppe:[], em:[], eh:[], dis:[] };
let selectedPic=null, autoExport=false;

function renderHead(){
  HEAD = getHEAD();
  const headDiv=qs('#head');
  const subStyle = `
    font-family:${HEAD.title?.fontFamily||'Arial'};
    font-size:${(HEAD.title?.fontSize||18)}px;
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
        <div class="small" style="text-align:center">Typ: ${HEAD.type||'-'} • Unternehmen: ${HEAD.firm||'-'} • Abteilung: ${HEAD.dept||'-'} • Ersteller: ${HEAD.author||'-'} • Datum: ${HEAD.date||'-'}</div>
      </div>
    </div>
  `;
}

function allPicKeys(){
  const isoKeys = Object.keys(PICTO?.iso||{}), ghsKeys = Object.keys(PICTO?.ghs||{});
  return [...isoKeys.map(k=>({group:'iso',code:k})), ...ghsKeys.map(k=>({group:'ghs',code:k}))];
}

function renderPicList(){
  const list=qs('#picList'); list.innerHTML='';
  allPicKeys().forEach(k=>{
    const entry = PICTO?.[k.group]?.[k.code]; if(!entry) return;
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

qsa('.assignbar .target').forEach(t=>{
  t.addEventListener('click', async ()=>{
    if(!selectedPic){ alert('Bitte zuerst ein Piktogramm auswählen.'); return; }
    const sec = t.dataset.target;
    if(!iconsBySection[sec].includes(selectedPic.code)) iconsBySection[sec].push(selectedPic.code);
    renderSectionIcons(sec);
    await refreshPools(sec, true); // uzun cümleler + AI min. 5
    if (autoExport) { await exportDocx('silent'); }
  });
});
qs('#autoExport')?.addEventListener('change',(e)=>{ autoExport = !!e.target.checked; });

function renderSectionIcons(sec){
  const wrap = qs('#icons-'+sec); wrap.innerHTML='';
  iconsBySection[sec].forEach(code=>{
    const entry = PICTO?.iso?.[code] || PICTO?.ghs?.[code];
    if(!entry) return;
    const img = document.createElement('img'); img.src = entry.img; img.alt = entry.name||code;
    wrap.appendChild(img);
  });
}

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

async function aiSuggest(section, pics, head){
  try{
    const url = `/ai-suggest?section=${encodeURIComponent(section)}&type=${encodeURIComponent(head.type||'')}&asset=${encodeURIComponent(head.title?.assetName||'')}&pics=${encodeURIComponent(pics.join(','))}`;
    const r = await fetch(url, {cache:'no-store'}); if(!r.ok) return [];
    const data = await r.json(); return Array.isArray(data)?data:[];
  }catch{ return []; }
}

async function refreshPools(sectionChanged, withAI=false){
  const type = HEAD.type || 'Maschine';
  async function build(sec){
    const pics = iconsBySection[sec];
    const set = new Set();
    pics.forEach(p=> (SUG?.[type]?.[sec]?.[p] || []).forEach(x=>set.add(x)));
    let out = [...set];
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

// ---- Word export: resim yüklemeden (proxy’li kaynaklardan) PNG olarak gömme ----
async function imageToPngBytes(url){
  const res = await fetch(url, {cache:'no-store'});
  if (!res.ok) throw new Error('img fetch failed');
  const ct = res.headers.get('content-type') || '';
  const blob = await res.blob();

  // PNG/JPEG ise direkt bayt
  if (/png|jpeg|jpg/i.test(ct)) { const ab = await blob.arrayBuffer(); return new Uint8Array(ab); }

  // SVG/GIF -> canvas rasterize
  const dataUrl = await (async ()=>{
    if (/svg/i.test(ct)) {
      const svgText = await blob.text();
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    }
    return URL.createObjectURL(blob); // GIF veya diğer
  })();

  const img = new Image();
  img.crossOrigin = 'anonymous';
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

function fromList(id){ return qsa('#'+id+' div').map(x=>x.textContent.replace(/^[•\u2022]\s*/,'')); }
async function iconBytes(code){
  const entry = PICTO?.iso?.[code] || PICTO?.ghs?.[code];
  return await imageToPngBytes(entry.img);
}

async function exportDocx(mode){
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun } =
    await import('https://cdn.jsdelivr.net/npm/docx@9.1.1/+esm');

  const barColor = (HEAD.type==='Gefahrstoff'?'E53935':(HEAD.type==='Biostoff'?'2E7D32':'005AA3'));
  const band = (t)=> new Table({
    width:{ size:100, type:WidthType.PERCENTAGE },
    rows:[ new TableRow({ children:[ new TableCell({
      shading:{ type:ShadingType.SOLID, color:barColor, fill:barColor },
      children:[ new Paragraph({
        alignment:AlignmentType.CENTER,
        children:[ new TextRun({ text:t.toUpperCase(), bold:true, color:'FFFFFF' }) ]
      }) ]
    }) ] }) ]
  });

  const title=[];
  if(HEAD.title?.assetName){
    title.push(new Paragraph({ alignment:AlignmentType.CENTER, children:[ new TextRun({ text:HEAD.title.assetName.toUpperCase(), bold:true, size:32 }) ] }));
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
          new TableCell({ width:{ size:32, type:WidthType.PERCENTAGE }, children:(iconRuns.length?iconRuns:[new Paragraph('')]) }),
          new TableCell({ width:{ size:68, type:WidthType.PERCENTAGE }, children:(bullets.length?bullets:[ new Paragraph('') ]) })
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (HEAD.title?.assetName?HEAD.title.assetName+'_BA':'Betriebsanweisung')+'.docx';
  if (mode!=='silent') a.click();
  URL.revokeObjectURL(a.href);
}
qs('#saveDocx')?.addEventListener('click', ()=>exportDocx('manual'));

// İlk yükleme
if (isEditor) {
  document.getElementById('baBody')?.classList.add('theme-' + (HEAD?.type || 'Maschine'));
  renderHead();
  renderPicList();
  refreshPools(null, true); // AI devreye girer (min. 5)
}
