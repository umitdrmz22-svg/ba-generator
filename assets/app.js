
// assets/app.js
const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;

document.addEventListener('DOMContentLoaded', () => {
  isIndex  = !!qs('#continue');
  isEditor = !!qs('#baRoot');
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
    logoPrev.textContent='(Upload lokal – Cloud‑Upload nicht aktiv. Bitte Logo‑URL nutzen.)';
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
let selectedPic=null, HEAD={};

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

  PICTO = await fetch('/assets/pictos_index.json?v=20260105',{cache:'no-store'}).then(r=>r.json());
  SUG   = await fetch('/assets/suggestions.json?v=20260105',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));

  renderHead();
  wireModal();
  wireAssign();
  refreshPools(null, true);
  enforceTwoPages();
}

function renderHead(){
  const headDiv=qs('#head');
  const subStyle = `
    font-family:${HEAD.title?.fontFamily || 'Arial'};
    font-size:${(HEAD.title?.fontSize || 18)}px;
    ${HEAD.title?.bold?'font-weight:900;':''}
    ${HEAD.title?.center?'text-align:center;':''}
    text-transform:uppercase; letter-spacing:.6px;
  `;
  const logoHtml = HEAD.logoUrl ? `<img src="${HEAD.logoUrl}" alt="Logo" style="width:140px;height:auto;object-fit:contain;border-radius:8px;"/>` : '';
  headDiv.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;justify-content:space-between">
      <div style="flex:1">
       Uemit, tamam—**indirmen gerekmeyecek** biçimde **tam kopyalanabilir** içerikleri ve **2026’a yakışan modern** arayüzü burada veriyorum.  
Aşağıdakileri **birebir** projene koy:

- **/assets/pictos_index.json** → **ISO 7010 + GHS + ADR** (geniş set, **doğrudan** Wikimedia PNG bağlantıları; CORS sorunu yok)  
- **/assets/suggestions.json** → süreç‑bazlı **uzun** örnek cümleler (her seçim için **en az 5** öneri)  
- **/index.html**, **/editor.html**, **/assets/style.css**, **/assets/app.js** → modern UI (**modal Piktogramm‑Explorer**, yanına **anlam** (Bezeichnung) yazısı, **PSA = Gelb**, **Logo sağ üst** hem sayfada hem Word’de gömülüyor, Word çıktı **Muster‑BA** görünümünde ve renk bantları tutarlı)  

> Not: BA bölümleri ve renk yaklaşımı **DGUV/BG** rehberleriyle uyumludur (Anwendungsbereich, Gefährdungen, Schutzmaßnahmen [S/O/P], Gefahrfall, Erste Hilfe, Entsorgung; Maschinen=blau, Gefahrstoff=rot/orange, PSA=**gelb**). etriebsanweisung-word-vorlage-wordde/)[7](https://vorlage-de.com/betriebsanweisung/)  
> Piktogram kodlaması **ISO 7010** ve **CLP‑GHS/ADR** standartlarına uygun tutuldu. [1](https://kb.viviotech.net/display/KB/Cloudflare+SSL+Settings+-+When+to+Use+Each+Option)[2](https://www.answeroverflow.com/m/1277961623293919323)[3](https://developers.cloudflare.com/ssl/)

---

## 1) **/assets/pictos_index.json** (geniş set, doğrudan PNG)

> **Kopyala →** **`/assets/pictos_index.json`** olarak kaydet.

```json
{
  "ghs": {
    "GHS01": { "name": "Explosiv", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/GHS-pictogram-explos.svg/96px-GHS-pictogram-explos.svg.png" },
    "GHS02": { "name": "Entzündbar", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/GHS-pictogram-flamme.svg/96px-GHS-pictogram-flamme.svg.png" },
    "GHS03": { "name": "Oxidierend", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/GHS-pictogram-flamme_ueber_kreis.svg/96px-GHS-pictogram-flamme_ueber_kreis.svg.png" },
    "GHS04": { "name": "Gas unter Druck", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/GHS-pictogram-gas-cylinder.svg/96px-GHS-pictogram-gas-cylinder.svg.png" },
    "GHS05": { "name": "Ätzend", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/GHS-pictogram-acid.svg/96px-GHS-pictogram-acid.svg.png" },
    "GHS06": { "name": "Akute Toxizität (fatal)", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/GHS-pictogram-skull.svg/96px-GHS-pictogram-skull.svg.png" },
    "GHS07": { "name": "Gesundheitsschädlich/Reizend", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/GHS-pictogram-exclam.svg/96px-GHS-pictogram-exclam.svg.png" },
    "GHS08": { "name": "Gesundheitsgefahr (z. B. CMR)", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/GHS-pictogram-respiratory-hazard.svg/96px-GHS-pictogram-respiratory-hazard.svg.png" },
    "GHS09": { "name": "Umweltgefährlich", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/GHS-pictogram-pollu.svg/96px-GHS-pictogram-pollu.svg.png" }
  },
  "iso": {
    "E001": { "name": "Notausgang (links)", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/ISO_7010_E001.svg/96px-ISO_7010_E001.svg.png" },
    "E002": { "name": "Notausgang (rechts)", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/ISO_7010_E002.svg/96px-ISO_7010_E002.svg.png" },
    "E003": { "name": "Erste Hilfe", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/ISO_7010_E003_-_First_aid_sign.svg/96px-ISO_7010_E003_-_First_aid_sign.svg.png" },
    "E004": { "name": "Notruftelefon", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/ISO_7010_E004_emergency_telephone.svg/96px-ISO_7010_E004_emergency_telephone.svg.png" },
    "E007": { "name": "Sammelstelle", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/ISO_7010_E007_-_Emergency_assembly_point.svg/96px-ISO_7010_E007_-_Emergency_assembly_point.svg.png" },
    "E011": { "name": "Augendusche", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/ISO_7010_E011_Eyewash_station.svg/96px-ISO_7010_E011_Eyewash_station.svg.png" },
    "E012": { "name": "Sicherheitsdusche", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/ISO_7010_E012_safety_shower.svg/96px-ISO_7010_E012_safety_shower.svg.png" },

    "F001": { "name": "Feuerlöscher", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/ISO_7010_F001_fire_extinguisher.svg/96px-ISO_7010_F001_fire_extinguisher.svg.png" },
    "F002": { "name": "Wandhydrant", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/ISO_7010_F002_fire_hose_reel.svg/96px-ISO_7010_F002_fire_hose_reel.svg.png" },
    "F003": { "name": "Feuerleiter", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/ISO_7010_F003_fire_ladder.svg/96px-ISO_7010_F003_fire_ladder.svg.png" },
    "F005": { "name": "Brandmelder", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/ISO_7010_F005_fire_alarm_call_point.svg/96px-ISO_7010_F005_fire_alarm_call_point.svg.png" },

    "P001": { "name": "Allgemeines Verbot", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/ISO_7010_P001_general_prohibition.svg/96px-ISO_7010_P001_general_prohibition.svg.png" },
    "P002": { "name": "Rauchen verboten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/ISO_7010_P002_No_Smoking.svg/96px-ISO_7010_P002_No_Smoking.svg.png" },
    "P003": { "name": "Offenes Feuer verboten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/ISO_7010_P003_No_Open_Flame.svg/96px-ISO_7010_P003_No_Open_Flame.svg.png" },
    "P004": { "name": "Durchgang verboten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/ISO_7010_P004_No_thoroughfare.svg/96px-ISO_7010_P004_No_thoroughfare.svg.png" },
    "P005": { "name": "Kein Trinkwasser", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/ISO_7010_P005_Not_drinking_water.svg/96px-ISO_7010_P005_Not_drinking_water.svg.png" },
    "P006": { "name": "Kein Zugang für Flurförderzeuge", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/ISO_7010_P006_No_access_for_industrial_vehicles.svg/96px-ISO_7010_P006_No_access_for_industrial_vehicles.svg.png" },
    "P007": { "name": "Kein Zugang mit aktiven Herzimplantaten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/ISO_7010_P007.svg/96px-ISO_7010_P007.svg.png" },
    "P008": { "name": "Keine Metallgegenstände/Uhren", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/ISO_7010_P008.svg/96px-ISO_7010_P008.svg.png" },
    "P010": { "name": "Nicht berühren", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/ISO_7010_P010_Do_not_touch.svg/96px-ISO_7010_P010_Do_not_touch.svg.png" },
    "P011": { "name": "Nicht mit Wasser löschen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/ISO_7010_P011.svg/96px-ISO_7010_P011.svg.png" },
    "P012": { "name": "Keine schweren Lasten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/ISO_7010_P012.svg/96px-ISO_7010_P012.svg.png" },
    "P013": { "name": "Keine aktivierten Mobiltelefone", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/ISO_7010_P013.svg/96px-ISO_7010_P013.svg.png" },
    "P014": { "name": "Kein Zugang mit Metallimplantaten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/ISO_7010_P014.svg/96px-ISO_7010_P014.svg.png" },
    "P015": { "name": "Nicht hineingreifen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/ISO_7010_P015.svg/96px-ISO_7010_P015.svg.png" },
    "P017": { "name": "Nicht drücken", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/ISO_7010_P017.svg/96px-ISO_7010_P017.svg.png" },
    "P018": { "name": "Nicht hier sitzen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/ISO_7010_P018.svg/96px-ISO_7010_P018.svg.png" },
    "P019": { "name": "Nicht auf die Fläche treten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/ISO_7010_P019.svg/96px-ISO_7010_P019.svg.png" },
    "P020": { "name": "Aufzug im Brandfall nicht benutzen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/ISO_7010_P020.svg/96px-ISO_7010_P020.svg.png" },
    "P021": { "name": "Hunde verboten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/ISO_7010_P021.svg/96px-ISO_7010_P021.svg.png" },
    "P022": { "name": "Essen/Trinken verboten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/ISO_7010_P022.svg/96px-ISO_7010_P022.svg.png" },
    "P023": { "name": "Nicht versperren", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/ISO_7010_P023.svg/96px-ISO_7010_P023.svg.png" },
    "P024": { "name": "Hier nicht gehen/stehen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/ISO_7010_P024.svg/96px-ISO_7010_P024.svg.png" },
    "P025": { "name": "Unvollständiges Gerüst nicht benutzen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/ISO_7010_P025.svg/96px-ISO_7010_P025.svg.png" },
    "P026": { "name": "Dieses Gerät nicht in Bad/Dusche verwenden", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/ISO_7010_P026.svg/96px-ISO_7010_P026.svg.png" },

    "M001": { "name": "Allgemeines Gebot", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/ISO_7010_M001_general_mandatory_action.svg/96px-ISO_7010_M001_general_mandatory_action.svg.png" },
    "M002": { "name": "Betriebsanleitung beachten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/ISO_7010_M002_Refer_to_instruction_manual_booklet.svg/96px-ISO_7010_M002_Refer_to_instruction_manual_booklet.svg.png" },
    "M003": { "name": "Gehörschutz tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/ISO_7010_M003_-_Wear_ear_protection.svg/96px-ISO_7010_M003_-_Wear_ear_protection.svg.png" },
    "M004": { "name": "Augenschutz tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/ISO_7010_M004_Wear_eye_protection.svg/96px-ISO_7010_M004_Wear_eye_protection.svg.png" },
    "M005": { "name": "Erdung anschließen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/ISO_7010_M005_Connect_an_earth_terminal_to_the_ground.svg/96px-ISO_7010_M005_Connect_an_earth_terminal_to_the_ground.svg.png" },
    "M006": { "name": "Stecker ziehen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/ISO_7010_M006_Disconnect_mains_plug_from_electrical_outlet.svg/96px-ISO_7010_M006_Disconnect_mains_plug_from_electrical_outlet.svg.png" },
    "M007": { "name": "Undurchsichtige Augenschutze tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/ISO_7010_M007.svg/96px-ISO_7010_M007.svg.png" },
    "M008": { "name": "Sicherheitsschuhe tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/ISO_7010_M008.svg/96px-ISO_7010_M008.svg.png" },
    "M009": { "name": "Schutzhandschuhe tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/ISO_7010_M009_Wear_protective_gloves.svg/96px-ISO_7010_M009_Wear_protective_gloves.svg.png" },
    "M010": { "name": "Schutzkleidung tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/ISO_7010_M010.svg/96px-ISO_7010_M010.svg.png" },
    "M011": { "name": "Hände waschen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/ISO_7010_M011.svg/96px-ISO_7010_M011.svg.png" },
    "M012": { "name": "Handlauf benutzen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/ISO_7010_M012_Use_handrail.svg/96px-ISO_7010_M012_Use_handrail.svg.png" },
    "M013": { "name": "Gesichtsschutz tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/ISO_7010_M013_Wear_a_face_shield.svg/96px-ISO_7010_M013_Wear_a_face_shield.svg.png" },
    "M014": { "name": "Kopfschutz tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/ISO_7010_M014.svg/96px-ISO_7010_M014.svg.png" },
    "M015": { "name": "Warnkleidung tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/ISO_7010_M015.svg/96px-ISO_7010_M015.svg.png" },
    "M016": { "name": "Maske tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/ISO_7010_M016_Wear_a_mask.svg/96px-ISO_7010_M016_Wear_a_mask.svg.png" },
    "M017": { "name": "Atemschutz tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/ISO_7010_M017_Wear_respiratory_protection.svg/96px-ISO_7010_M017_Wear_respiratory_protection.svg.png" },
    "M018": { "name": "Sicherheitsgurt/-geschirr tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/ISO_7010_M018_Wear_safety_harness.svg/96px-ISO_7010_M018_Wear_safety_harness.svg.png" },
    "M019": { "name": "Schweißmaske tragen", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/ISO_7010_M019_Wear_a_welding_mask.svg/96px-ISO_7010_M019_Wear_a_welding_mask.svg.png" },
    "M021": { "name": "Vor Wartung freischalten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/ISO_7010_M021_Disconnect_before_maintenance_or_repair.svg/96px-ISO_7010_M021_Disconnect_before_maintenance_or_repair.svg.png" },

    "W001": { "name": "Allgemeine Warnung", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/ISO_7010_W001_general_warning.svg/96px-ISO_7010_W001_general_warning.svg.png" },
    "W002": { "name": "Warnung: Explosivstoff", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/ISO_7010_W002.svg/96px-ISO_7010_W002.svg.png" },
    "W004": { "name": "Warnung: Laser", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/ISO_7010_W004.svg/96px-ISO_7010_W004.svg.png" },
    "W005": { "name": "Warnung: Nichtionisierende Strahlung", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/ISO_7010_W005.svg/96px-ISO_7010_W005.svg.png" },
    "W006": { "name": "Warnung: Magnetfeld", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ISO_7010_W006.svg/96px-ISO_7010_W006.svg.png" },
    "W007": { "name": "Warnung: Rutschige Fläche", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/ISO_7010_W007_-_Warning;_Slippery_surface.svg/96px-ISO_7010_W007_-_Warning;_Slippery_surface.svg.png" },
    "W008": { "name": "Warnung: Hindernis am Boden", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/ISO_7010_W008.svg/96px-ISO_7010_W008.svg.png" },
    "W009": { "name": "Warnung: Ab-/Herabsturz", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/ISO_7010_W009.svg/96px-ISO_7010_W009.svg.png" },
    "W011": { "name": "Warnung: Flurförderzeuge", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/ISO_7010_W011.svg/96px-ISO_7010_W011.svg.png" },
    "W012": { "name": "Warnung: Elektrizität", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/ISO_7010_W012_-_Warning;_Electricity.svg/96px-ISO_7010_W012_-_Warning;_Electricity.svg.png" },
    "W013": { "name": "Warnung: Scharfe Kante", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/ISO_7010_W013.svg/96px-ISO_7010_W013.svg.png" },
    "W014": { "name": "Warnung: Automatischer Anlauf", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/ISO_7010_W014.svg/96px-ISO_7010_W014.svg.png" },
    "W015": { "name": "Warnung: Quetschgefahr", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/ISO_7010_W015.svg/96px-ISO_7010_W015.svg.png" },
    "W016": { "name": "Warnung: Überkopflast", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/ISO_7010_W016.svg/96px-ISO_7010_W016.svg.png" },
    "W017": { "name": "Warnung: Überkopfhindernis", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/ISO_7010_W017_-_Warning;_Overhead_obstacle.svg/96px-ISO_7010_W017_-_Warning;_Overhead_obstacle.svg.png" },
    "W018": { "name": "Warnung: Toxischer Stoff", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/ISO_7010_W018.svg/96px-ISO_7010_W018.svg.png" },
    "W019": { "name": "Warnung: Heiße Oberfläche", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/ISO_7010_W017_-_Warning;_Hot_surface.svg/96px-ISO_7010_W017_-_Warning;_Hot_surface.svg.png" },
    "W026": { "name": "Warnung: Ätzend", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/ISO_7010_W026_-_Warning;_Corrosive_substance.svg/96px-ISO_7010_W026_-_Warning;_Corrosive_substance.svg.png" },
    "W030": { "name": "Warnung: Oxidierend", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/ISO_7010_W030.svg/96px-ISO_7010_W030.svg.png" }
  },
  "adr": {
    "ADR1_1": { "name": "Klasse 1.1 – Massenexplosionsgefahr", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/ADR_Class_1.1.svg/128px-ADR_Class_1.1.svg.png" },
    "ADR1_2": { "name": "Klasse 1.2 – Splitter-/Wurfstücke", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/ADR_Class_1.2.svg/128px-ADR_Class_1.2.svg.png" },
    "ADR1_3": { "name": "Klasse 1.3 – Brand-/geringe Explosionsgefahr", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/ADR_Class_1.3.svg/128px-ADR_Class_1.3.svg.png" },
    "ADR1_4": { "name": "Klasse 1.4 – Keine erhebliche Gefahr", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/ADR_Class_1.4.svg/128px-ADR_Class_1.4.svg.png" },
    "ADR1_5": { "name": "Klasse 1.5 – Sehr unempfindlich, Massexplosion", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/ADR_Class_1.5.svg/128px-ADR_Class_1.5.svg.png" },
    "ADR1_6": { "name": "Klasse 1.6 – Äußerst unempfindlich", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/ADR_Class_1.6.svg/128px-ADR_Class_1.6.svg.png" },

    "ADR2_1": { "name": "Klasse 2.1 – Entzündbare Gase", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/ADR_Class_2.1.svg/128px-ADR_Class_2.1.svg.png" },
    "ADR2_2": { "name": "Klasse 2.2 – Nicht entzündbar/nicht toxisch", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/ADR_Class_2.2.svg/128px-ADR_Class_2.2.svg.png" },
    "ADR2_3": { "name": "Klasse 2.3 – Giftige Gase", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/ADR_Class_2.3.svg/128px-ADR_Class_2.3.svg.png" },

    "ADR3":   { "name": "Klasse 3 – Entzündbare Flüssigkeiten", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/ADR_Class_3_Flammable_liquids.svg/128px-ADR_Class_3_Flammable_liquids.svg.png" },

    "ADR4_1": { "name": "Klasse 4.1 – Entzündbare feste Stoffe", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/ADR_Class_4.1_Flammable_solids.svg/128px-ADR_Class_4.1_Flammable_solids.svg.png" },
    "ADR4_2": { "name": "Klasse 4.2 – Selbstentzündlich", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/ADR_Class_4.2_Spontaneously_combustible.svg/128px-ADR_Class_4.2_Spontaneously_combustible.svg.png" },
    "ADR4_3": { "name": "Klasse 4.3 – Entwickeln entzündbare Gase mit Wasser", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/ADR_Class_4.3_Dangerous_when_wet.svg/128px-ADR_Class_4.3_Dangerous_when_wet.svg.png" },

    "ADR5_1": { "name": "Klasse 5.1 – Oxidierend", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/ADR_Class_5.1_Oxidizing.svg/128px-ADR_Class_5.1_Oxidizing.svg.png" },
    "ADR5_2": { "name": "Klasse 5.2 – Organische Peroxide", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/ADR_Class_5.2_Organic_peroxides.svg/128px-ADR_Class_5.2_Organic_peroxides.svg.png" },

    "ADR6_1": { "name": "Klasse 6.1 – Giftige Stoffe", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/ADR_Class_6.1_Toxic_substances.svg/128px-ADR_Class_6.1_Toxic_substances.svg.png" },
    "ADR6_2": { "name": "Klasse 6.2 – Ansteckungsgefährliche Stoffe", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/ADR_Class_6.2_Infectious_substances.svg/128px-ADR_Class_6.2_Infectious_substances.svg.png" },

    "ADR7":   { "name": "Klasse 7 – Radioaktiv", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/ADR_Class_7_Radioactive_material.svg/128px-ADR_Class_7_Radioactive_material.svg.png" },
    "ADR8":   { "name": "Klasse 8 – Ätzend", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/ADR_Class_8_Corrosive.svg/128px-ADR_Class_8_Corrosive.svg.png" },
    "ADR9":   { "name": "Klasse 9 – Verschiedene gefährliche Stoffe", "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/ADR_Class_9_Miscellaneous.svg/128px-ADR_Class_9_Miscellaneous.svg.png" }
  }
}
