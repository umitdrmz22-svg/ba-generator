const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE = 'ba-studio-draft-v2';

const GHS = {
  GHS01: ['Explodierende Bombe', 'Explosiv'], GHS02: ['Flamme', 'Entzündbar'],
  GHS03: ['Flamme über Kreis', 'Oxidierend'], GHS04: ['Gasflasche', 'Gase unter Druck'],
  GHS05: ['Ätzwirkung', 'Ätzend'], GHS06: ['Totenkopf', 'Akut toxisch'],
  GHS07: ['Ausrufezeichen', 'Gesundheitsschädlich'], GHS08: ['Gesundheitsgefahr', 'Schwere Gesundheitsgefahr'],
  GHS09: ['Umwelt', 'Gewässergefährdend']
};
const SECTIONS = {
  hazard: ['Gefahren für Mensch und Umwelt', 'hazardOut'],
  measure: ['Schutzmaßnahmen und Verhaltensregeln', 'measureOut'],
  emergency: ['Verhalten im Gefahrfall', 'emergencyOut'],
  firstAid: ['Erste Hilfe', 'firstAidOut'],
  disposal: ['Entsorgung / Instandhaltung', 'disposalOut']
};
const MACHINE = {
  Allgemein: {
    hazard: ['Quetsch-, Scher- und Einzugsgefahr durch bewegte Maschinenteile.', 'Verletzungsgefahr durch wegfliegende Werkstücke oder Werkzeugteile.', 'Gefährdung durch Lärm, elektrische Energie und scharfe Kanten.'],
    measure: ['Maschine vor Arbeitsbeginn auf erkennbare Schäden und wirksame Schutzeinrichtungen prüfen.', 'Schutzeinrichtungen niemals entfernen, umgehen oder unwirksam machen.', 'Eng anliegende Kleidung tragen; Schmuck ablegen und lange Haare sichern.', 'Störungen nur im Stillstand beseitigen; Energiezufuhr abschalten und gegen Wiedereinschalten sichern.'],
    emergency: ['Bei Gefahr Not-Halt betätigen, Maschine abschalten und Vorgesetzte informieren.', 'Gefahrenbereich sichern; defekte Maschine kennzeichnen und nicht weiter benutzen.'],
    firstAid: ['Erste Hilfe leisten, Ersthelfende verständigen und Notruf 112 absetzen.', 'Unfälle und Beinaheunfälle unverzüglich melden und dokumentieren.'],
    disposal: ['Wartung und Instandsetzung nur durch beauftragte, fachkundige Personen.', 'Späne, Betriebsstoffe und verschlissene Teile in den vorgesehenen Behältern entsorgen.']
  },
  Bohrmaschine: {hazard:['Erfassungs- und Einzugsgefahr an rotierendem Bohrer und Bohrfutter.','Schnitt- und Augenverletzungen durch scharfkantige, heiße Späne.'],measure:['Werkstück sicher einspannen; niemals mit der Hand festhalten.','Bohrfutterschlüssel vor dem Einschalten entfernen.','Späne nur bei Stillstand mit Spänehaken oder Handfeger entfernen.']},
  Drehmaschine: {hazard:['Erfassungsgefahr durch rotierendes Werkstück, Spannfutter und Späne.'],measure:['Spannschlüssel sofort abziehen und Schutzhaube schließen.','Messen, Reinigen und Späne entfernen nur bei Maschinenstillstand.']},
  Kreissäge: {hazard:['Schwere Schnittverletzungen und Rückschlag durch das Sägeblatt oder Werkstück.'],measure:['Spaltkeil, Schutzhaube und Absaugung korrekt einstellen und verwenden.','Schiebestock beziehungsweise Schiebeholz bei schmalen Werkstücken benutzen.']},
  Schweißgerät: {hazard:['Augen- und Hautschäden durch UV-/IR-Strahlung; Verbrennungen durch Funken und heiße Teile.','Brand- und Explosionsgefahr sowie Gefährdung durch Schweißrauch.'],measure:['Geeigneten Schweißschirm, Schutzhandschuhe und flammhemmende Kleidung tragen.','Punktabsaugung einsetzen und brennbare Stoffe aus dem Arbeitsbereich entfernen.']},
  CNC: {hazard:['Quetsch- und Schnittgefahr im Arbeitsraum sowie durch automatisch bewegte Achsen.'],measure:['Arbeitsraum nur im sicheren Zustand betreten; Verriegelungen nicht überbrücken.','Programm und Werkzeuge vor dem Start prüfen; Probelauf sicher durchführen.']}
};

document.addEventListener('DOMContentLoaded', () => $('#continue') ? initStart() : $('#baRoot') && initEditor());

function initStart() {
  $('#date').value ||= new Date().toISOString().slice(0, 10);
  $$('input[name=type]').forEach(r => r.addEventListener('change', () => $$('.type-option').forEach(x => x.classList.toggle('selected', $('input', x).checked))));
  $('#continue').addEventListener('click', async () => {
    const asset = $('#assetName').value.trim();
    if (!asset) return $('#assetName').reportValidity();
    const logoFile = $('#logoFile').files[0];
    const data = {type: $('input[name=type]:checked').value, firm: $('#firm').value.trim(), dept: $('#dept').value.trim(), asset, author: $('#author').value.trim(), date: $('#date').value, logo: logoFile ? await fileDataUrl(logoFile) : ''};
    localStorage.setItem(STORE, JSON.stringify(data));
    location.href = '/editor.html';
  });
}

function initEditor() {
  const state = Object.assign({type:'Gefahrstoff', selected:{}, pictograms:[]}, safeJson(localStorage.getItem(STORE)));
  state.selected ||= {};
  Object.keys(SECTIONS).forEach(k => state.selected[k] ||= []);
  $('#companyOut').textContent = state.firm || 'Unternehmen';
  $('#departmentOut').textContent = state.dept || 'Arbeitsbereich';
  $('#dateOut').textContent = state.date ? `Stand: ${formatDate(state.date)}` : '';
  $('#assetOut').textContent = state.asset || 'Nicht benannt';
  $('#activity').value = state.activity || '';
  $('#activityOut').textContent = state.activity || '';
  if (state.logo) $('#logoPreview').innerHTML = `<img alt="Firmenlogo" src="${state.logo}">`;
  const chemical = state.type === 'Gefahrstoff';
  $('#sdbPanel').classList.toggle('hidden', !chemical);
  $('#machinePanel').classList.toggle('hidden', chemical);
  $('#baSheet').classList.toggle('chemical', chemical);
  $('#baSheet').classList.toggle('machine', !chemical);
  renderSuggestions(state, chemical ? chemicalDefaults(state) : machineSuggestions('Allgemein'));
  renderOutput(state);

  $('#sdbFile').addEventListener('change', async e => { if (e.target.files[0]) $('#sdbText').value = await readDocument(e.target.files[0]); });
  $('#dropzone').addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('over'); });
  $('#dropzone').addEventListener('dragleave', e => e.currentTarget.classList.remove('over'));
  $('#dropzone').addEventListener('drop', async e => { e.preventDefault(); e.currentTarget.classList.remove('over'); const f=e.dataTransfer.files[0]; if(f) $('#sdbText').value=await readDocument(f); });
  $('#analyzeSdb').addEventListener('click', () => analyzeSdb(state, $('#sdbText').value));
  $('#machineSuggest').addEventListener('click', () => { state.activity=$('#activity').value.trim(); $('#activityOut').textContent=state.activity; renderSuggestions(state, machineSuggestions($('#machineKind').value)); save(state); });
  $('#colorTheme').addEventListener('change', e => { const sheet=$('#baSheet'); sheet.classList.remove('chemical','machine'); sheet.classList.add(e.target.value==='auto' ? (chemical?'chemical':'machine') : e.target.value==='orange'?'chemical':'machine'); });
  $('#saveDraft').addEventListener('click', e => { save(state); e.currentTarget.textContent='Gespeichert ✓'; setTimeout(()=>e.currentTarget.textContent='Entwurf speichern',1400); });
  $('#printBa').addEventListener('click', () => window.print());
}

function chemicalDefaults(state) {
  return {hazard:['Gesundheits- und Umweltgefahren ausschließlich nach dem aktuellen Sicherheitsdatenblatt und der Gefährdungsbeurteilung eintragen.'], measure:['Am Arbeitsplatz nicht essen, trinken oder rauchen; Berührung und Einatmen vermeiden.'], emergency:['Gefahrenbereich sichern, Vorgesetzte informieren und betriebliche Alarmierung beachten.'], firstAid:['Bei Beschwerden ärztlichen Rat einholen und Sicherheitsdatenblatt bereithalten.'], disposal:['Stoff und Behälter nach SDB und betrieblichen Vorgaben entsorgen; nicht in die Kanalisation gelangen lassen.']};
}
function machineSuggestions(kind) {
  const base=MACHINE.Allgemein, extra=MACHINE[kind]||{}; return Object.fromEntries(Object.keys(SECTIONS).map(k=>[k,[...(base[k]||[]),...(extra[k]||[])]]));
}

function analyzeSdb(state, text) {
  const result=$('#analysisResult');
  if (text.trim().length < 40) { result.innerHTML='<b>Keine ausreichenden Daten.</b><span>Bitte laden Sie ein textlesbares SDB hoch oder fügen Sie den Text ein.</span>'; return; }
  const normalized=text.replace(/\s+/g,' ');
  const codes=unique(normalized.match(/\b(?:EUH|H|P)\s?\d{3}[A-Za-z]?\b/gi)||[]).map(x=>x.replace(/\s/g,'').toUpperCase());
  const pictos=unique((normalized.match(/\bGHS\s?0[1-9]\b/gi)||[]).map(x=>x.replace(/\s/g,'').toUpperCase()));
  const signal=(normalized.match(/Signalwort\s*:?\s*(Gefahr|Achtung)/i)||[])[1]||'';
  const sentences=normalized.split(/(?<=[.!?])\s+/).filter(s=>/\b(?:EUH|H|P)\s?\d{3}/i.test(s)).slice(0,35);
  const suggested=chemicalDefaults(state);
  sentences.forEach(sentence => {
    const clean=sentence.replace(/^.*?(?=(?:EUH|H|P)\s?\d{3})/i,'').slice(0,380).trim();
    if (/^(H|EUH)/i.test(clean)) suggested.hazard.push(clean);
    else if (/^P/i.test(clean)) {
      if (/P3(?:01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|20|21|22|30|31|32|33|34|35|36|37|38|40|42|50|51|52|60|61|62|63|64)/i.test(clean)) suggested.firstAid.push(clean);
      else if (/P37|P38|P39/i.test(clean)) suggested.emergency.push(clean);
      else if (/P4(?:01|02|03|04|05|06|07|08|09|10|11|12|13|20|22)/i.test(clean)) suggested.disposal.push(clean);
      else suggested.measure.push(clean);
    }
  });
  state.pictograms=pictos; state.signalWord=signal; state.sdbCodes=codes;
  result.innerHTML=`<b>${pictos.length} Piktogramm(e), ${codes.length} H-/P-/EUH-Code(s) erkannt</b><span>${signal ? `Signalwort: ${escapeHtml(signal)} · `:''}Ergebnisse bitte mit Abschnitt 2 des SDB abgleichen.</span>`;
  renderSuggestions(state, Object.fromEntries(Object.entries(suggested).map(([k,v])=>[k,unique(v)])));
  renderOutput(state); save(state);
}

function renderSuggestions(state, suggestions) {
  const host=$('#suggestions'); host.innerHTML='';
  Object.entries(SECTIONS).forEach(([key,[title]]) => {
    const group=document.createElement('details'); group.open=['hazard','measure'].includes(key);
    group.innerHTML=`<summary>${title}<span>${suggestions[key]?.length||0}</span></summary><div class="choices"></div><button class="add-own" type="button">+ Eigener Eintrag</button>`;
    const choices=$('.choices',group);
    unique([...(suggestions[key]||[]),...(state.selected[key]||[])]).forEach(text => addChoice(choices,key,text,state));
    $('.add-own',group).onclick=()=>{const text=prompt('Eigenen, fachlich geprüften Eintrag hinzufügen:'); if(text?.trim()) addChoice(choices,key,text.trim(),state,true);};
    host.appendChild(group);
  });
}
function addChoice(host,key,text,state,checked=false) {
  const label=document.createElement('label'); label.className='choice';
  const input=document.createElement('input'); input.type='checkbox'; input.checked=checked||state.selected[key].includes(text);
  label.append(input,document.createTextNode(text)); host.appendChild(label);
  if(input.checked&&!state.selected[key].includes(text)) state.selected[key].push(text);
  input.onchange=()=>{ state.selected[key]=input.checked?unique([...state.selected[key],text]):state.selected[key].filter(x=>x!==text); renderOutput(state); save(state); };
}
function renderOutput(state) {
  Object.entries(SECTIONS).forEach(([key,[,id]])=>{const el=$(`#${id}`), values=state.selected[key]||[]; el.classList.toggle('empty',!values.length); el.innerHTML=values.length?`<ul>${values.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:'<p>Bitte geprüfte Inhalte auswählen.</p>';});
  const pictos=$('#pictograms'); pictos.innerHTML=(state.pictograms||[]).map(code=>`<div class="ghs" title="${GHS[code]?.[1]||code}" aria-label="${GHS[code]?.[1]||code}"><span>${ghsSymbol(code)}</span><small>${code}</small></div>`).join('');
  $('#signalWord').textContent=state.signalWord||'';
  $('#signalBlock').classList.toggle('hidden',!(state.pictograms?.length||state.signalWord));
}
function ghsSymbol(code){return {GHS01:'💥',GHS02:'🔥',GHS03:'◉',GHS04:'▰',GHS05:'⚗',GHS06:'☠',GHS07:'!',GHS08:'✦',GHS09:'♧'}[code]||'!';}
async function readDocument(file){
  if(file.type==='text/plain'||/\.txt$/i.test(file.name)) return file.text();
  try { const pdfjs=globalThis.pdfjsLib || await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'; const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise; let text=''; for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i), content=await page.getTextContent(); text+=' '+content.items.map(x=>x.str).join(' ');} return text; } catch(e){ return 'PDF konnte nicht gelesen werden. Bei einem Scan bitte Texterkennung durchführen oder den Text aus Abschnitt 2, 4, 5, 6, 7, 8 und 13 einfügen.'; }
}
function save(state){localStorage.setItem(STORE,JSON.stringify(state));}
function safeJson(value){try{return JSON.parse(value)||{};}catch{return{};}}
function unique(values){return [...new Set(values.filter(Boolean))];}
function fileDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
function formatDate(date){return new Intl.DateTimeFormat('de-DE').format(new Date(`${date}T00:00:00`));}
function escapeHtml(value){const d=document.createElement('div');d.textContent=value;return d.innerHTML;}
