'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE = 'ba-studio-draft-v3';
const E = globalThis.BAEngine;

document.addEventListener('DOMContentLoaded', () => $('#continue') ? initStart() : $('#baRoot') && initEditor());

function initStart() {
  $('#date').value ||= new Date().toISOString().slice(0, 10);
  $$('input[name=type]').forEach(radio => radio.addEventListener('change', () => $$('.type-option').forEach(card => card.classList.toggle('selected', $('input', card).checked))));
  $('#loadDemo').addEventListener('click', () => { localStorage.setItem(STORE, JSON.stringify(E.demoState())); location.href = 'editor.html'; });
  $('#continue').addEventListener('click', async () => {
    const asset = $('#assetName').value.trim(), purpose = $('#purpose').value.trim();
    if (!asset) return $('#assetName').reportValidity();
    if (!purpose) return $('#purpose').reportValidity();
    const type = $('input[name=type]:checked').value, logoFile = $('#logoFile').files[0];
    const state = {
      type, firm:$('#firm').value.trim(), baNumber:$('#baNumber').value.trim(), dept:$('#dept').value.trim(), workplace:$('#workplace').value.trim(),
      asset, purpose, author:$('#author').value.trim(), responsible:$('#responsible').value.trim(), date:$('#date').value, revision:$('#revision').value.trim(),
      logo:logoFile ? await fileDataUrl(logoFile) : '', emergency:'112', firstAider:'', disposalContact:'', pictograms:[], signs:[], signalWord:'', sdbCodes:[],
      selected:E.emptySelected(type), custom:E.emptySelected(type), sourceText:''
    };
    save(state); location.href = 'editor.html';
  });
}

function initEditor() {
  let state = safeJson(localStorage.getItem(STORE));
  if (!E.TYPE_CONFIG[state.type]) { state = E.demoState(); save(state); }
  const config = E.TYPE_CONFIG[state.type];
  state.selected = Object.assign(E.emptySelected(state.type), state.selected || {});
  state.custom = Object.assign(E.emptySelected(state.type), state.custom || {});
  state.pictograms ||= []; state.signs ||= []; state.sdbCodes ||= [];

  document.documentElement.style.setProperty('--ba-accent', config.accent);
  $('#sourceTitle').textContent = config.sourceTitle; $('#sourceHelp').textContent = config.sourceHelp;
  $('#ghsPanel').classList.toggle('hidden', state.type !== 'Gefahrstoff');
  bindStateInput('#assetInput','asset',state); bindStateInput('#purposeInput','purpose',state); bindStateInput('#deptInput','dept',state); bindStateInput('#workplaceInput','workplace',state);
  bindStateInput('#baNumberInput','baNumber',state); bindStateInput('#revisionInput','revision',state); bindStateInput('#emergencyInput','emergency',state);
  bindStateInput('#firstAiderInput','firstAider',state); bindStateInput('#disposalContactInput','disposalContact',state);
  $('#sourceText').value = state.sourceText || '';
  $('#signalWordInput').value = state.signalWord || '';
  $('#signalWordInput').addEventListener('change', e => { state.signalWord=e.target.value; renderOutput(state); save(state); });

  renderGhsPicker(state); renderSignPicker(state);
  let analysis = {pictograms:state.pictograms, suggestions:{}};
  let suggestions = E.buildSuggestions(state.type, context(state), analysis);
  renderSuggestions(state, suggestions); renderOutput(state);

  $('#sourceFile').addEventListener('change', async e => { if (e.target.files[0]) { $('#sourceText').value = await readDocument(e.target.files[0]); state.sourceText=$('#sourceText').value; save(state); } });
  $('#dropzone').addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('over'); });
  $('#dropzone').addEventListener('dragleave', e => e.currentTarget.classList.remove('over'));
  $('#dropzone').addEventListener('drop', async e => { e.preventDefault(); e.currentTarget.classList.remove('over'); const file=e.dataTransfer.files[0]; if(file){$('#sourceText').value=await readDocument(file); state.sourceText=$('#sourceText').value; save(state);} });
  $('#analyzeSource').addEventListener('click', () => {
    state.sourceText = $('#sourceText').value;
    if (state.type === 'Gefahrstoff') {
      analysis = E.parseSdb(state.sourceText);
      if (!analysis.ok) return showAnalysis('Keine ausreichenden Daten.', 'Bitte ein textlesbares SDB hochladen oder mindestens die Abschnitte 2, 4–8 und 13 einfügen.', false);
      state.pictograms = analysis.pictograms; state.signalWord = analysis.signalWord; state.sdbCodes = analysis.codes;
      $('#signalWordInput').value = state.signalWord; renderGhsPicker(state);
      showAnalysis(`${analysis.pictograms.length} GHS-Piktogramm(e), ${analysis.codes.length} H-/P-/EUH-Code(s) erkannt`, `${state.signalWord ? `Signalwort: ${state.signalWord} · ` : ''}Ergebnis zwingend mit Abschnitt 2 des vollständigen SDB abgleichen.`, true);
    } else {
      const ok = state.sourceText.trim().length >= 40;
      analysis = {suggestions:extractSourceStatements(state.sourceText, config.sections), pictograms:[]};
      showAnalysis(ok ? 'Grundlage eingelesen.' : 'Nur wenig Text vorhanden.', ok ? 'Erkannte Aussagen werden als zusätzliche Vorschläge angeboten; GBU und Herstellerangaben bleiben maßgeblich.' : 'Bitte aussagekräftige Hersteller- oder GBU-Informationen ergänzen.', ok);
    }
    suggestions = E.buildSuggestions(state.type, context(state), analysis);
    renderSuggestions(state, suggestions); renderOutput(state); save(state);
  });
  $('#refreshSuggestions').addEventListener('click', () => { suggestions=E.buildSuggestions(state.type,context(state),analysis); renderSuggestions(state,suggestions); renderOutput(state); save(state); });
  $('#saveDraft').addEventListener('click', e => { state.sourceText=$('#sourceText').value; save(state); const old=e.currentTarget.textContent; e.currentTarget.textContent='Gespeichert ✓'; setTimeout(()=>e.currentTarget.textContent=old,1300); });
  $('#printBa').addEventListener('click', () => {
    const result=E.completeness(state.type,state.selected);
    if(!result.complete){ $('#completeStatus').textContent=`Fehlt: ${result.missing.join(', ')}`; $('#completeStatus').className='badge error'; $('#suggestions').scrollIntoView({behavior:'smooth'}); return; }
    window.print();
  });
}

function context(state){return {asset:state.asset,purpose:state.purpose,sourceText:state.sourceText};}
function bindStateInput(selector,key,state){const el=$(selector);el.value=state[key]||'';el.addEventListener('input',()=>{state[key]=el.value.trim();renderOutput(state);save(state);});}

function renderGhsPicker(state){
  const host=$('#ghsPicker'); if(!host)return; host.innerHTML='';
  Object.entries(E.GHS).forEach(([code,[name,meaning,url]])=>{
    const label=document.createElement('label'); label.className='picto-choice';
    const input=document.createElement('input'); input.type='checkbox'; input.checked=state.pictograms.includes(code);
    const img=document.createElement('img'); img.src=url; img.alt=`${code} ${meaning}`; img.width=48; img.height=48; img.referrerPolicy='no-referrer';
    const text=document.createElement('span'); text.innerHTML=`<b>${code}</b><small>${escapeHtml(name)}</small>`;
    label.append(input,img,text); host.appendChild(label);
    input.addEventListener('change',()=>{state.pictograms=input.checked?E.unique([...state.pictograms,code]):state.pictograms.filter(x=>x!==code);renderOutput(state);save(state);});
  });
}

function renderSignPicker(state){
  const host=$('#signPicker'); host.innerHTML='';
  Object.entries(E.SIGNS).forEach(([code,[kind,name,url]])=>{
    const label=document.createElement('label'); label.className='sign-choice';
    const input=document.createElement('input'); input.type='checkbox'; input.checked=state.signs.includes(code);
    const icon=signIcon(code,kind,url); const text=document.createElement('span'); text.innerHTML=`<b>${code}</b><small>${escapeHtml(name)}</small>`;
    label.append(input,icon,text); host.appendChild(label);
    input.addEventListener('change',()=>{state.signs=input.checked?E.unique([...state.signs,code]):state.signs.filter(x=>x!==code);renderOutput(state);save(state);});
  });
}

function signIcon(code,kind,url){const el=document.createElement('img');el.className='safety-sign-img';el.src=url;el.alt=`${code} – ${E.SIGNS[code][1]}`;el.title=el.alt;el.width=42;el.height=42;return el;}

function renderSuggestions(state,suggestions){
  const host=$('#suggestions'); host.innerHTML=''; const config=E.TYPE_CONFIG[state.type];
  config.sections.forEach(([key,title],index)=>{
    const group=document.createElement('details'); group.open=index<2; group.dataset.section=key;
    const all=E.unique([...(suggestions[key]||[]),...(state.custom[key]||[]),...(state.selected[key]||[])]);
    group.innerHTML=`<summary><span>${index+1}. ${escapeHtml(title)}</span><em>${all.length} Vorschläge</em></summary><div class="choices"></div><div class="own-row"><input aria-label="Eigene Formulierung für ${escapeHtml(title)}" placeholder="Eigene fachlich geprüfte Formulierung …"><button type="button">Hinzufügen</button></div>`;
    const choices=$('.choices',group); all.forEach(text=>addChoice(choices,key,text,state));
    const own=$('.own-row input',group), button=$('.own-row button',group);
    const add=()=>{const value=own.value.trim();if(!value)return;state.custom[key]=E.unique([...state.custom[key],value]);state.selected[key]=E.unique([...state.selected[key],value]);addChoice(choices,key,value,state);own.value='';renderOutput(state);save(state);};
    button.addEventListener('click',add); own.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();add();}});
    host.appendChild(group);
  });
}

function addChoice(host,key,text,state){
  if([...host.querySelectorAll('.choice span')].some(x=>x.textContent===text))return;
  const label=document.createElement('label'); label.className='choice';
  const input=document.createElement('input'); input.type='checkbox'; input.checked=state.selected[key].includes(text);
  const span=document.createElement('span'); span.textContent=text; label.append(input,span); host.appendChild(label);
  input.addEventListener('change',()=>{state.selected[key]=input.checked?E.unique([...state.selected[key],text]):state.selected[key].filter(x=>x!==text);renderOutput(state);save(state);});
}

function renderOutput(state){
  const config=E.TYPE_CONFIG[state.type]; document.documentElement.style.setProperty('--ba-accent',config.accent);
  $('#companyOut').textContent=state.firm||'Unternehmen'; $('#lawOut').textContent=config.law; $('#numberOut').textContent=state.baNumber||'BA-Nr.: —';
  $('#dateOut').textContent=state.date?`Stand: ${formatDate(state.date)}`:'Stand: —'; $('#revisionOut').textContent=`Revision: ${state.revision||'—'}`;
  $('#departmentOut').textContent=[state.dept,state.workplace].filter(Boolean).join(' / ')||'—'; $('#purposeOut').textContent=state.purpose||'—'; $('#assetOut').textContent=state.asset||'Nicht benannt';
  $('#assetLabel').textContent=config.short.toUpperCase(); $('#authorOut').textContent=state.author||'—'; $('#responsibleOut').textContent=state.responsible||'—';
  const logo=$('#logoPreview'); logo.innerHTML=''; if(state.logo){const img=document.createElement('img');img.alt='Firmenlogo';img.src=state.logo;logo.appendChild(img);} else logo.textContent='LOGO';
  const pHost=$('#pictograms'); pHost.innerHTML=''; (state.pictograms||[]).forEach(code=>{if(!E.GHS[code])return;const fig=document.createElement('figure');fig.className='ghs';const img=document.createElement('img');img.src=E.GHS[code][2];img.alt=`${code} – ${E.GHS[code][1]}`;img.width=58;img.height=58;img.referrerPolicy='no-referrer';const cap=document.createElement('figcaption');cap.textContent=code;fig.append(img,cap);pHost.appendChild(fig);});
  $('#signalWord').textContent=state.signalWord||''; $('#signalBlock').classList.toggle('hidden',!(state.pictograms.length||state.signalWord));
  const sHost=$('#signsOut'); sHost.innerHTML=''; (state.signs||[]).forEach(code=>{const data=E.SIGNS[code];if(!data)return;const wrap=document.createElement('figure');wrap.append(signIcon(code,data[0],data[2]));const cap=document.createElement('figcaption');cap.textContent=code;wrap.title=data[1];sHost.appendChild(wrap);}); $('#signBlock').classList.toggle('hidden',!state.signs.length);
  const sections=$('#sectionsOut'); sections.innerHTML='';
  config.sections.forEach(([key,title],index)=>{
    const section=document.createElement('section'); section.dataset.section=key; const values=state.selected[key]||[];
    section.innerHTML=`<h3><span>${index+1}</span>${escapeHtml(title)}</h3><div class="section-body ${values.length?'':'empty'}">${values.length?`<ul>${values.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>`:'<p>Geprüfte Inhalte auswählen.</p>'}</div>`;
    const contact=key==='emergency'&&state.emergency?`Notruf / Alarmierung: ${state.emergency}`:key==='firstAid'&&state.firstAider?`Ersthelfende: ${state.firstAider}`:['disposal','maintenance'].includes(key)&&state.disposalContact?`Zuständige Stelle: ${state.disposalContact}`:'';
    if(contact){const line=document.createElement('div');line.className='section-contact';line.textContent=contact;section.appendChild(line);}
    sections.appendChild(section);
  });
  const c=E.completeness(state.type,state.selected), badge=$('#completeStatus'); badge.textContent=c.complete?'Alle Abschnitte befüllt ✓':`${c.missing.length} Abschnitt(e) offen`; badge.className=`badge ${c.complete?'ok':'warn'}`;
}

function extractSourceStatements(text,sections){
  const out={}; const keys=sections.map(([k])=>k); const sentences=String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/).filter(s=>s.length>25&&s.length<350);
  sentences.slice(0,35).forEach((s,i)=>{const low=s.toLowerCase();let key=keys[i%keys.length];if(/gefahr|verletz|gesundheit|risiko/.test(low)&&keys.includes('hazard'))key='hazard';else if(/schutz|muss|darf|verwenden|tragen/.test(low)&&keys.includes('measure'))key='measure';else if(/störung|notfall|ausfall|mangel/.test(low)&&keys.includes('emergency'))key='emergency';else if(/erste hilfe|notruf|verletzte|arzt/.test(low)&&keys.includes('firstAid'))key='firstAid';else if(/wart|prüf|reinig|lager|entsorg/.test(low))key=keys.includes('maintenance')?'maintenance':keys.includes('disposal')?'disposal':key;(out[key]||=[]).push(s.trim());});return out;
}

function showAnalysis(title,text,ok){const box=$('#analysisResult');box.classList.toggle('bad',!ok);box.innerHTML=`<b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span>`;}
async function readDocument(file){if(file.type==='text/plain'||/\.txt$/i.test(file.name))return file.text();try{const pdfjs=globalThis.pdfjsLib||await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();text+=' '+content.items.map(x=>x.str).join(' ');}return text;}catch{return 'PDF konnte nicht gelesen werden. Bei einem Scan bitte OCR durchführen oder die relevanten Inhalte als Text einfügen.';}}
function save(state){localStorage.setItem(STORE,JSON.stringify(state));}
function safeJson(value){try{return JSON.parse(value)||{};}catch{return{};}}
function fileDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
function formatDate(date){return new Intl.DateTimeFormat('de-DE').format(new Date(`${date}T00:00:00`));}
function escapeHtml(value){const d=document.createElement('div');d.textContent=String(value||'');return d.innerHTML;}
