
// assets/app.js
// Index + Editor tek dosyada; hata toleranslı; RLS uyumlu.

// ---------------------------
// 0) Basit yardımcılar
// ---------------------------
const qs  = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];
let isIndex=false, isEditor=false;
try { isIndex  = !!qs('#continue'); } catch {}
try { isEditor = !!qs('#baRoot');   } catch {}

// ---------------------------
// 1) Supabase (isteğe bağlı)
// ---------------------------
let supabase = null;
try {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  let cfg = {};
  try { cfg = await fetch('/env.json', { cache:'no-store' }).then(r=>r.json()); } catch {}
  const SUPABASE_KEY = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE';
  if (cfg?.url && SUPABASE_KEY && SUPABASE_KEY!=='PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE') {
    supabase = createClient(cfg.url, SUPABASE_KEY);
  }
} catch (e) {
  console.warn('Supabase init skipped:', e);
}

// ---------------------------
// 2) Ortak veriler (piktogram dizini + öneriler)
// ---------------------------
let PICTO = null, SUG = {};
try { PICTO = await fetch('/assets/pictos_index.json', { cache:'no-store' }).then(r=>r.json()); } catch {}
try { SUG   = await fetch('/assets/suggestions.json',  { cache:'no-store' }).then(r=>r.json()); } catch { SUG={}; }

// ---------------------------
// 3) INDEX sayfası
// ---------------------------
try {
  if (isIndex) {
    const btn     = qs('#continue');
    const firm    = qs('#firm');
    const dept    = qs('#dept');
    const author  = qs('#author');
    const dateEl  = qs('#date');
    const logoInp = qs('#logoFile');
    const logoPrev= qs('#logoPreview');

    // Logo upload (opsiyonel)
    window.__uploadedLogoUrl = '';
    if (logoInp) {
      logoInp.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!supabase) { logoPrev.textContent = 'Supabase yok (env/key). Yükleme atlandı.'; return; }
        const path = `logo_${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('logos').upload(path, file, { upsert:true });
        if (error) { logoPrev.textContent = 'Upload-Fehler: ' + error.message; return; }
        const { data } = supabase.storage.from('logos').getPublicUrl(path);
        window.__uploadedLogoUrl = data?.publicUrl || '';
        logoPrev.innerHTML = window.__uploadedLogoUrl ? `${window.__uploadedLogoUrl}` : 'Yüklenemedi';
      });
    }

    // Devam butonu
    if (btn) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = qsa('input[name="type"]').find(r=>r.checked)?.value;
        const firmVal   = firm?.value?.trim();
        const deptVal   = dept?.value?.trim();
        const authorVal = author?.value?.trim();
        const dateVal   = dateEl?.value;

        if (!type || !firmVal || !authorVal || !dateVal) {
          alert('Bitte Typ, Unternehmen, Ersteller und Datum ausfüllen.');
          return;
        }
        const head = { type, firm: firmVal, dept: deptVal||'', author: authorVal, date: dateVal, logoUrl: window.__uploadedLogoUrl||'' };
        try { localStorage.setItem('BA_HEAD', JSON.stringify(head)); } catch {}
        // relatif yol
        location.href = 'editor.html';
      });
    }
  }
} catch (e) {
  console.error('Index error:', e);
}

// ---------------------------
// 4) EDITOR sayfası
// ---------------------------
try {
  if (isEditor) {
    const HEAD   = JSON.parse(localStorage.getItem('BA_HEAD') || '{}');
    const headDiv= qs('#head');
    if (headDiv) {
      headDiv.innerHTML = `
        <div class="box">
          <strong>Betriebsanweisung</strong> – Typ: ${HEAD.type || '-'}<br>
          Unternehmen: ${HEAD.firm || '-'} &nbsp; | &nbsp; Abteilung: ${HEAD.dept || '-'}<br>
          Ersteller: ${HEAD.author || '-'} &nbsp; | &nbsp; Datum: ${HEAD.date || '-'}
          ${HEAD.logoUrl ? `<div style="margin-top:6px">${HEAD.logoUrl}</div>` : ``}
        </div>`;
    }

    // Piktogram seçici (link tabanlı)
    const picChooser  = qs('#picChooser');
    const selectedPics= new Set();

    async function checkUrlAlive(url){
      try { const r = await fetch(url, { method:'HEAD' }); return r?.ok; } catch { return false; }
    }
    async function healPictoIndex(){
      if (!PICTO) return;
      for (const [group, entries] of Object.entries(PICTO)) {
        if (!entries || typeof entries!=='object') continue;
        for (const [code, item] of Object.entries(entries)) {
          if (code==='authoritative_pages') continue;
          if (!item?.url) continue;
          const ok = await checkUrlAlive(item.url);
          if (!ok && entries.authoritative_pages) item.alt = entries.authoritative_pages;
        }
      }
    }
    await healPictoIndex();

    function renderPictoChooser(containerId, groupKeys){
      const cont = qs('#'+containerId); if (!cont) return; cont.innerHTML='';
      groupKeys.forEach(k=>{
        const entry = PICTO?.[k.group]?.[k.code]; if (!entry) return;
        const div = document.createElement('div'); div.className='pic'; div.dataset.code=k.code;

        if (entry.url){
          const a = document.createElement('a'); a.href = entry.url; a.target='_blank'; a.rel='noopener';
          a.textContent = (entry.name || k.code) + ' (' + k.code + ')';
          div.appendChild(a);
        }
        if (entry.alt){
          const alt = document.createElement('div'); alt.className='small'; alt.textContent='Alternatif kaynak: ';
          Object.entries(entry.alt).forEach(([label,href],i)=>{
            const link=document.createElement('a'); link.href=href; link.target='_blank'; link.rel='noopener';
            link.textContent=label; alt.appendChild(link);
            if (i < Object.keys(entry.alt).length-1) alt.appendChild(document.createTextNode(' • '));
          });
          div.appendChild(alt);
        }
        div.addEventListener('click', ()=>togglePicSelection(div));
        cont.appendChild(div);
      });
    }
    function togglePicSelection(el){
      const code = el.dataset.code;
      if (selectedPics.has(code)) { selectedPics.delete(code); el.classList.remove('selected'); }
      else { selectedPics.add(code); el.classList.add('selected'); }
      refreshPools();
    }
    // İlk set
    renderPictoChooser('picChooser', [
