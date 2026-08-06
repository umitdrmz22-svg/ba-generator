'use strict';
(function(){
  const show=(text,type='info')=>{
    const box=document.querySelector('#authMessage');
    if(!box)return;
    box.textContent=text;
    box.className=`auth-message ${type}`;
    box.hidden=false;
  };
  const bind=()=>{
    const button=document.querySelector('#resendConfirmation');
    if(!button||button.dataset.bound==='true')return;
    button.dataset.bound='true';
    button.addEventListener('click',async()=>{
      const login=document.querySelector('#loginForm');
      const email=String(new FormData(login).get('email')||'').trim();
      const client=globalThis.BAAuth?.state?.client;
      if(!email)return show('Bitte zuerst die bei der Registrierung verwendete E-Mail-Adresse eingeben.','error');
      if(!client)return show('Die Supabase-Verbindung ist noch nicht bereit. Bitte die Seite neu laden.','error');
      button.disabled=true;
      show('Bestätigungs-E-Mail wird erneut angefordert …');
      const next=new URLSearchParams(location.search).get('next')||'index.html';
      const redirect=new URL(`auth.html?next=${encodeURIComponent(next)}`,location.href).href;
      const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:redirect}});
      button.disabled=false;
      if(error){
        const text=String(error.message||'');
        if(/rate limit|too many/i.test(text))return show('Das Versandlimit wurde erreicht. Bitte mindestens eine Stunde warten oder in Supabase einen eigenen SMTP-Dienst einrichten.','error');
        if(/not authorized/i.test(text))return show('Diese E-Mail-Adresse ist beim Supabase-Standardversand nicht autorisiert. Für externe Benutzer ist ein eigener SMTP-Dienst erforderlich.','error');
        return show(text,'error');
      }
      show('Bestätigungs-E-Mail wurde erneut angefordert. Bitte auch Spam- und Quarantäneordner prüfen.','success');
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  globalThis.addEventListener('ba-auth-ready',bind);
})();
