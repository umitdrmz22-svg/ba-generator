
// assets/app.js
// Tek dosyada hem index.html (tür/firma/logo) hem editor.html (şablon+piktogram+öneri) desteği.
// ------------------------------------------------------------
// 0) Yardımcılar / Başlatma
// ------------------------------------------------------------

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => [...document.querySelectorAll(sel)];

// Supabase URL'i /env.json'dan alalım (daha önce functions/env.json.ts ile yayınlıyorsunuz)
let cfg = {};
try {
  cfg = await fetch('/env.json', { cache: 'no-store' }).then(r => r.json());
} catch {
  cfg = {};
}

// Doldurun: publishable/anon key (client-side kullanım içindir; RLS açık olmalıdır)
const SUPABASE_KEY = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE';

// Supabase JS (ESM) yükle
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');

// İstemciyi oluştur (URL + KEY varsa)
let supabase = null;
if (cfg?.url && SUPABASE_KEY && SUPABASE_KEY !== 'PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE') {
  supabase = createClient(cfg.url, SUPABASE_KEY); // createClient kullanımı.  [1](https://www.slideshare.net/ssuser0ae3f9/iso7010safetysignsguidebookeuropeenglish1pdf)
}

// Sayfa tipini algıla
const isIndex  = !!qs('#continue');   // index.html → "Weiter zur Vorlage" butonu var
const isEditor = !!qs('#baRoot');     // editor.html → ana kapsayıcı var

// ------------------------------------------------------------
// 1) Ortak: Piktogram dizinini ve önerileri yükleme
// ------------------------------------------------------------

let PICTO = null, SUG = null;

// Piktogram dizini (ISO 7010 + GHS linkleri)
try {
  PICTO = await fetch('/assets/pictos_index.json', { cache: 'no-store' }).then(r => r.json());
} catch {
  PICTO = null; // İlk aşamada yoksa link seçiciyi atlarız
}

// Öneri kütüphanesi (hazards/tech/org/ppe/em/eh/dis)
try {
  SUG = await fetch('/assets/suggestions.json', { cache: 'no-store' }).then(r => r.json());
} catch {
  SUG = {};
}

// ------------------------------------------------------------
// 2) INDEX MODE (Tür + Firma + Logo yükleme + geçiş)
// ------------------------------------------------------------

if (isIndex) {
  const typeRadios = qsa('input[name="type"]');
  const firm   = qs('#firm');
  const dept   = qs('#dept');
  const author = qs('#author');
  const date   = qs('#date');
  const logoFile    = qs('#logoFile');
  const logoPreview = qs('#logoPreview');
  const btnContinue = qs('#continue');

  // 2.1 Logo yükleme (Supabase Storage → 'logos' bucket)
  // Not: Bucket 'logos' önceden oluşturulmalı; public read ayarı açık olmalı.
  let logoUrl = '';

  if (logoFile) {
    logoFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!supabase) {
        logoPreview.textContent = 'Supabase anahtarı yok: LOGO yüklemek için publishable key ekleyin.';
        return;
      }
      const path = `logo_${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
      if (error) {
        logoPreview.textContent = 'Upload-Fehler: ' + error.message;
        return;
      }
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      logoUrl = data?.publicUrl || '';
      // Görsel önizleme
      logoPreview.innerHTML = logoUrl
        ? `<img src="${logoUrl}" alt="Logo" style="max-height:60px;">`
        : 'Logo-URL bulunamadı.';
    });
  }

  // 2.2 Devam: seçimleri editor sayfasına aktar (localStorage)
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      const type = typeRadios.find(r => r.checked)?.value;
      const firmVal   = firm?.value?.trim();
      const deptVal   = dept?.value?.trim();
      const authorVal = author?.value?.trim();
      const dateVal   = date?.value;

      if (!type || !firmVal || !authorVal || !dateVal) {
        alert('Bitte Typ, Unternehmen, Ersteller und Datum ausfüllen.');
        return;
      }
      const HEAD = { type, firm: firmVal, dept: deptVal || '', author: authorVal, date: dateVal, logoUrl };
      localStorage.setItem('BA_HEAD', JSON.stringify(HEAD));
      location.href = '/editor.html';
    });
  }

  // (Opsiyonel) Magic Link ile giriş (index.html’de “sendLink” varsa)
  const sendLinkBtn = qs('#sendLink');
  const emailInput  = qs('#email');
  if (sendLinkBtn && emailInput) {
    sendLinkBtn.addEventListener('click', async () => {
      if (!supabase) { alert('Supabase anahtarı yok.'); return; }
      const email = emailInput.value?.trim();
      if (!email) { alert('r } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin }  // SITE_URL yapılandırmasına uygun.  [7](https://wiki2.org/en/File:ISO_7010_W001_svg)[8](https://commons.wikimedia.org/wiki/File:ISO_7010_M001.svg)
      });
      alert(error ? ('Hata: ' + error.message) : 'E-Mail gönderildi. Gelen bağlantıya tıklayın.');
    });
  }
}

// ------------------------------------------------------------
// 3) EDITOR MODE (Boş şablon + piktogram seçici + öneri + 2 sayfa sınırı)
// ------------------------------------------------------------

if (isEditor) {
  // 3.1 Başlık bilgilerini localStorage'dan yükle
  const HEAD = JSON.parse(localStorage.getItem('BA_HEAD') || '{}');
  const headDiv = qs('#head');
  if (headDiv) {
    headDiv.innerHTML = `
      <div class="box">
        <strong>Betriebsanweisung</strong> – Typ: ${HEAD.type || '-'}<br>
        Unternehmen: ${HEAD.firm || '-'} &nbsp; | &nbsp; Abteilung: ${HEAD.dept || '-'}<br>
        Ersteller: ${HEAD.author || '-'} &nbsp; | &nbsp; Datum: ${HEAD.date || '-'}
        ${HEAD.logoUrl ? `<div style="margin-top:6px"><img src="${HEAD.logoUrl}" alt="Logo" style="max-height:48px;"></div>` : ``}
      </div>`;
  }

  // 3.2 Piktogram seçimi: ISO 7010 + GHS
  const picChooser = qs('#picChooser');
  const selectedPics = new Set();

  // Bağlantı sağlık kontrolü (bozuksa alternatif kaynakları göster)
  async function checkUrlAlive(url) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res?.ok;
    } catch {
      return false;
    }
  }

  async function healPictoIndex() {
    if (!PICTO) return;
    for (const [group, entries] of Object.entries(PICTO)) {
      if (!entries || typeof entries !== 'object') continue;
      for (const [code, item] of Object.entries(entries)) {
        if (code === 'authoritative_pages') continue; // referans seti
        if (!item?.url) continue;
        const ok = await checkUrlAlive(item.url);
        if (!ok && entries.authoritative_pages) {
          // Erişilemiyorsa resmi alternatifleri ekleyelim
          item.alt = entries.authoritative_pages;
        }
      }
    }
  }
  await healPictoIndex();

  // Piktogram gridinin render'ı (basit link; tıklanınca seçili olur)
  function renderPictoChooser(containerId, groupKeys) {
    const cont = qs('#' + containerId);
    if (!cont) return;
    cont.innerHTML = '';

    groupKeys.forEach(k => {
      const entry = PICTO?.[k.group]?.[k.code];
      if (!entry) return;

      const div = document.createElement('div');
      div.className = 'pic';
      div.dataset.code = k.code;

      if (entry.url) {
        const a = document.createElement('a');
        a.href = entry.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = (entry.name || k.code) + ' (' + k.code + ')';
        div.appendChild(a);
      }
      if (entry.alt) {
        const altBox = document.createElement('div');
        altBox.className = 'small';
        altBox.textContent = 'Alternatif kaynak: ';
        Object.entries(entry.alt).forEach(([label, href], i) => {
          const link = document.createElement('a');
          link.href = href; link.target = '_blank'; link.rel = 'noopener';
          link.textContent = label;
          altBox.appendChild(link);
          if (i < Object.keys(entry.alt).length - 1) altBox.appendChild(document.createTextNode(' • '));
        });
        div.appendChild(altBox);
      }

      div.addEventListener('click', () => togglePicSelection(div));
      qs('#' + containerId).appendChild(div);
    });
  }

  function togglePicSelection(el) {
    const code = el.dataset.code;
    if (selectedPics.has(code)) { selectedPics.delete(code); el.classList.remove('selected'); }
    else { selectedPics.add(code); el.classList.add('selected'); }
    refreshPools(); // seçime göre öneri havuzlarını güncelle
  }

  // İlk set (ISO + GHS karması). İsterseniz genişletebilirsiniz.
  renderPictoChooser('picChooser', [
    { group: 'iso', code: 'W001' }, { group: 'iso', code: 'M001' },
    { group: 'iso', code: 'E003' }, { group: 'iso', code: 'F001' },
    { group: 'ghs', code: 'GHS02' }, { group: 'ghs', code: 'GHS05' },
    { group: 'ghs', code: 'GHS07' }, { group: 'ghs', code: 'GHS08' }
  ]);

  // 3.3 Öneri havuzlarını doldurma (hazard/tech/org/ppe/em/eh/dis)
  function fillPool(divId, items) {
    const div = qs('#' + divId);
    if (!div) return;
    div.innerHTML = '';
    (items || []).forEach(t => {
      const b = document.createElement('button');
      b.textContent = '➕ ' + t;
      b.style.margin = '4px';
      b.addEventListener('click', () => addToList(divId.replace('Pool','List'), t));
      div.appendChild(b);
    });
  }

  function addToList(listId, text) {
    const list = qs('#' + listId);
    if (!list) return;
    const li = document.createElement('div');
    li.textContent = '• ' + text;
    li.style.margin = '3px 0';
    list.appendChild(li);
    enforceTwoPages();
  }

  function addCustom(inputId, listId) {
    const el = qs('#' + inputId);
    if (!el) return;
    const val = el.value?.trim();
    if (!val) return;
    addToList(listId, val);
    el.value = '';
  }

  // Önerileri piktogram ve türe göre birleştir
  function refreshPools() {
    const type = HEAD.type || 'Maschine';
    const pics = [...selectedPics];

    const pick = (section) => {
      const out = new Set();
      pics.forEach(p => (SUG?.[type]?.[section]?.[p] || []).forEach(x => out.add(x)));
      return [...out];
    };

    fillPool('hazardPool', pick('hazards'));
    fillPool('techPool',   pick('tech'));
    fillPool('orgPool',    pick('org'));
    fillPool('ppePool',    pick('ppe'));
    fillPool('emPool',     pick('em'));
    fillPool('ehPool',     pick('eh'));
    fillPool('disPool',    pick('dis'));
    enforceTwoPages();
  }

  // Custom ekleme butonları
  qs('#hazardAdd')?.addEventListener('click', () => addCustom('hazardCustom','hazardList'));
  qs('#techAdd')  ?.addEventListener('click', () => addCustom('techCustom','techList'));
  qs('#orgAdd')   ?.addEventListener('click', () => addCustom('orgCustom','orgList'));
  qs('#ppeAdd')   ?.addEventListener('click', () => addCustom('ppeCustom','ppeList'));
  qs('#emAdd')    ?.addEventListener('click', () => addCustom('emCustom','emList'));
  qs('#ehAdd')    ?.addEventListener('click', () => addCustom('ehCustom','ehList'));
  qs('#disAdd')   ?.addEventListener('click', () => addCustom('disCustom','disList'));

  // 3.4 İki sayfa sınırı + yazı küçültme (min 10pt)
  const root = qs('#baRoot');
  const fontHint = qs('#fontHint');

  function enforceTwoPages() {
    if (!root) return;
    const a4px = 1123;          // ekranda yaklaşık A4 yüksekliği
    const margin = 40;          // tolerans
    let fs = parseInt(getComputedStyle(root).fontSize, 10);
    const tooHigh = root.scrollHeight > (2 * a4px - margin);

    if (tooHigh && fs > 10) {
      root.style.fontSize = (fs - 1) + 'px';
      if (fontHint) fontHint.style.display = 'block';
      setTimeout(enforceTwoPages, 0); // kademeli küçült
    } else if (tooHigh && fs <= 10) {
      if (fontHint) fontHint.style.display = 'block';
      if (!qs('#limitWarn')) {
        const w = document.createElement('div');
        w.id = 'limitWarn';
        w.className = 'warn';
        w.textContent = 'Uyarı: içerik 2 sayfayı aşıyor. Metni kısaltın veya maddeleri sadeleştirin.';
        root.prepend(w);
      }
    } else {
      if (fontHint) fontHint.style.display = 'none';
      qs('#limitWarn')?.remove();
    }
  }

  // 3.5 Kaydet (RLS için user_id zorunlu)
  qs('#save')?.addEventListener('click', async () => {
    if (!supabase) { alert('Supabase anahtarı yok.'); return; }

    const { data: ses, error: uerr } = await supabase.auth.getUser();
    if (uerr) { alert('Auth error: ' + uerr.message); return; }
    const userId = ses?.user?.id || null;
    if (!userId) {
      alert('Giriş yapmadan kaydetme mümkün değil. Lütfen e‑posta ile giriş yapın.');
      return;
    }

    const doc = {
      user_id: userId,
      type: HEAD.type,
      head: HEAD,
      scope: qs('#scope')?.value || '',
      pictos: [...selectedPics],
      hazards: listToArray('hazardList'),
      tech:    listToArray('techList'),
      org:     listToArray('orgList'),
      ppe:     listToArray('ppeList'),
      em:      listToArray('emList'),
      eh:      listToArray('ehList'),
      dis:     listToArray('disList'),
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('ba_documents').insert(doc);
    alert(error ? ('Fehler: ' + error.message) : 'Gespeichert.');
  });

  function listToArray(id) {
    return qsa(`#${id} div`).map(x => x.textContent.replace(/^•\s*/,''));
  }

  // İlk enforce (boş sayfa için)
  enforceTwoPages();
}

// ------------------------------------------------------------
// BİTTİ
// ------------------------------------------------------------
