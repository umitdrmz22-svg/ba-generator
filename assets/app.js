
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// 1) Supabase URL/Key (env.json veya doğrudan)
const cfg = await fetch('/env.json').then(r => r.json());
const SUPABASE_KEY = 'BURAYA-PUBLISHABLE-VEYA-ANON-KEY-YAZIN';
const supabase = createClient(cfg.url, SUPABASE_KEY);

// 2) Logo yükle (Storage: 'logos' bucket’ı oluşturulmuş olmalı)
const logoFile = document.getElementById('logoFile');
const logoPreview = document.getElementById('logoPreview');
let logoUrl = '';

logoFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const path = `logo_${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
  if (error) { logoPreview.textContent = 'Upload-Fehler: ' + error.message; return; }
  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  logoUrl = data.publicUrl;
  logoPreview.innerHTML = `<img src="${logoUrl}" alt="Logo" style="max-height:60px">`;
});

// 3) Devam: seçimleri editor sayfasına aktar (localStorage)
document.getElementById('continue')?.addEventListener('click', () => {
  const type = [...document.querySelectorAll('input[name="type"]')]
    .find(r => r.checked)?.value;
  const firm = document.getElementById('firm').value.trim();
  const dept = document.getElementById('dept').value.trim();
  const author = document.getElementById('author').value.trim();
  const date = document.getElementById('date').value;

  if (!type || !firm || !author || !date) {
    alert('Bitte Typ, Unternehmen, Ersteller und Datum ausfüllen.');
    return;
  }
  const payload = { type, firm, dept, author, date, logoUrl };
  localStorage.setItem('BA_HEAD', JSON.stringify(payload));
  location.href = '/editor.html';
  
/ Piktogram dizinini yükle
const PICTO = await fetch('/assets/pictos_index.json').then(r => r.json());

// ISO ve GHS piktogram seçiciye grid olarak bas
function renderPictoChooser(containerId, groupKeys) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = '';
  groupKeys.forEach(k => {
    const src = PICTO[k.group][k.code].url;
    const div = document.createElement('div');
    div.className = 'pic';
    div.dataset.code = k.code;
    const img = document.createElement('img');
    // Wikimedia “File:” sayfası → gerçek görsel linki: thumbnail yerine sayfa gösterir.
    // Kolay yol: <a href> ile sayfaya gidelim; img’i de sayfaya referansla yüklemeyelim.
    // Alternatif: küçük önizleme PNG’yi kullanmak için '/thumb/' yolunu türetmek gerekir.
    // Sadelik için: tıklayınca seç, ayrıntı için yeni sekmede “File” sayfasını aç.
    const a = document.createElement('a');
    a.href = src; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = PICTO[k.group][k.code].name + ' (' + k.code + ')';
    div.appendChild(a);
    div.onclick = () => togglePicSelection(div);
    cont.appendChild(div);
  });
}

function togglePicSelection(el) {
  const code = el.dataset.code;
  if (selectedPics.has(code)) { selectedPics.delete(code); el.classList.remove('selected'); }
  else { selectedPics.add(code); el.classList.add('selected'); }
  refreshPools();  // piktogramlara göre öneri havuzunu güncelle
}

// Örnek kullanım:
renderPictoChooser('picChooser', [
  { group: 'iso', code: 'W001' }, { group: 'iso', code: 'M001' },
  { group: 'iso', code: 'E003' }, { group: 'iso', code: 'F001' },
  { group: 'ghs', code: 'GHS02' }, { group: 'ghs', code: 'GHS05' },
  { group: 'ghs', code: 'GHS07' }, { group: 'ghs', code: 'GHS08' }
]);

});
