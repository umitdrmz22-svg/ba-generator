'use strict';
(function(){
  const E=globalThis.BAEngine;
  if(!E||typeof globalThis.renderOutput!=='function') return;
  const baseRender=globalThis.renderOutput;
  const unique=items=>[...new Set(items.filter(Boolean))];
  const iconHtml=(code,state)=>{
    const ghs=E.GHS[code];
    const sign=E.SIGNS[code];
    const data=ghs||sign;
    if(!data) return '';
    const url=ghs?data[2]:data[2];
    const label=ghs?`${code} – ${data[1]}`:`${code} – ${data[1]}`;
    return `<figure class="section-picto" title="${escapeAttribute(label)}"><img src="${escapeAttribute(url)}" alt="${escapeAttribute(label)}"><figcaption>${escapeHtml(code)}</figcaption></figure>`;
  };
  const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const escapeAttribute=escapeHtml;
  const selectedSigns=(state,prefixes)=>unique((state.signs||[]).filter(code=>prefixes.some(prefix=>code.startsWith(prefix))));
  const codesForSection=(key,state)=>{
    if(state.type==='Gefahrstoff'){
      if(key==='hazard') return unique([...(state.pictograms||[]).filter(code=>code!=='GHS09'),...selectedSigns(state,['W'])]);
      if(key==='measure') return selectedSigns(state,['M','P']);
      if(key==='emergency') return selectedSigns(state,['W','P']);
      if(key==='firstAid') return selectedSigns(state,['E']);
      if(key==='disposal') return (state.pictograms||[]).includes('GHS09')?['GHS09']:[];
    }
    if(key==='hazard') return selectedSigns(state,['W']);
    if(key==='measure') return selectedSigns(state,['M','P']);
    if(key==='emergency') return selectedSigns(state,['W','P']);
    if(key==='firstAid') return selectedSigns(state,['E']);
    if(key==='maintenance') return selectedSigns(state,['M']);
    return [];
  };
  const decorate=(state)=>{
    const signalBlock=document.querySelector('#signalBlock');
    const signBlock=document.querySelector('#signBlock');
    signalBlock?.classList.add('section-distributed');
    signBlock?.classList.add('section-distributed');
    document.querySelectorAll('#sectionsOut > section').forEach(section=>{
      section.querySelector('.section-picto-column')?.remove();
      const key=section.dataset.section;
      const codes=codesForSection(key,state);
      const column=document.createElement('aside');
      column.className='section-picto-column';
      column.setAttribute('aria-label','Zugeordnete Gefahr- und Sicherheitszeichen');
      column.innerHTML=codes.map(code=>iconHtml(code,state)).join('');
      if(key==='hazard'&&state.signalWord){
        column.insertAdjacentHTML('beforeend',`<strong class="section-signal-word">${escapeHtml(state.signalWord)}</strong>`);
      }
      if(!codes.length&&!(key==='hazard'&&state.signalWord)) column.classList.add('empty');
      const body=section.querySelector('.section-body');
      if(body) section.insertBefore(column,body);
      section.classList.add('section-with-pictograms');
    });
  };
  globalThis.renderOutput=function(state){
    baseRender(state);
    decorate(state);
  };
})();
