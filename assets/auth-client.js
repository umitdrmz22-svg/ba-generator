'use strict';
(function(){
  const state={client:null,session:null,configured:false,ready:false};
  const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const message=(text,type='info')=>{
    const box=document.querySelector('#authMessage');
    if(!box) return;
    box.textContent=text;
    box.className=`auth-message ${type}`;
    box.hidden=false;
  };
  const loadConfig=async()=>{
    try{
      const response=await fetch('./auth-config',{headers:{accept:'application/json'},cache:'no-store'});
      if(response.ok){
        const remote=await response.json();
        if(remote?.configured&&remote.url&&remote.publishableKey) return remote;
      }
    }catch{}
    const fallback=globalThis.BA_AUTH_CONFIG||{};
    return {configured:Boolean(fallback.url&&fallback.publishableKey),url:fallback.url||'',publishableKey:fallback.publishableKey||''};
  };
  const loadLibrary=async()=>{
    if(globalThis.supabase?.createClient) return globalThis.supabase;
    throw new Error('Supabase-Bibliothek konnte nicht geladen werden.');
  };
  const renderSlots=()=>{
    document.querySelectorAll('[data-auth-slot]').forEach(slot=>{
      if(!state.configured){
        slot.innerHTML='<a class="auth-link" href="auth.html">Anmelden / Registrieren</a>';
        return;
      }
      const user=state.session?.user;
      if(!user){
        slot.innerHTML='<a class="auth-link" href="auth.html">Anmelden / Registrieren</a>';
        return;
      }
      const name=user.user_metadata?.full_name||user.email||'Benutzerkonto';
      slot.innerHTML=`<span class="auth-user" title="${escapeHtml(user.email||'')}">${escapeHtml(name)}</span><button class="auth-logout" type="button">Abmelden</button>`;
      slot.querySelector('.auth-logout')?.addEventListener('click',async()=>{
        const {error}=await state.client.auth.signOut({scope:'local'});
        if(error) return;
        location.href='index.html';
      });
    });
  };
  const initAuthPage=()=>{
    const login=document.querySelector('#loginForm');
    const register=document.querySelector('#registerForm');
    if(!login&&!register) return;
    const configNotice=document.querySelector('#authConfigNotice');
    if(!state.configured){
      if(configNotice) configNotice.hidden=false;
      document.querySelectorAll('#loginForm input,#loginForm button,#registerForm input,#registerForm button').forEach(el=>el.disabled=true);
      message('Die sichere Benutzerverwaltung ist vorbereitet, aber noch nicht mit einem Supabase-Projekt verbunden.','warning');
      return;
    }
    if(configNotice) configNotice.hidden=true;
    document.querySelectorAll('[data-auth-tab]').forEach(button=>button.addEventListener('click',()=>{
      const target=button.dataset.authTab;
      document.querySelectorAll('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===button));
      login.hidden=target!=='login';
      register.hidden=target!=='register';
      document.querySelector('#authMessage').hidden=true;
    }));
    login?.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=new FormData(login);
      const email=String(form.get('email')||'').trim();
      const password=String(form.get('password')||'');
      message('Anmeldung wird geprüft …');
      const {error}=await state.client.auth.signInWithPassword({email,password});
      if(error) return message(error.message,'error');
      location.href='index.html';
    });
    register?.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=new FormData(register);
      const fullName=String(form.get('fullName')||'').trim();
      const organizationName=String(form.get('organizationName')||'').trim();
      const email=String(form.get('email')||'').trim();
      const password=String(form.get('password')||'');
      const passwordRepeat=String(form.get('passwordRepeat')||'');
      if(password.length<10) return message('Das Passwort muss mindestens 10 Zeichen enthalten.','error');
      if(password!==passwordRepeat) return message('Die Passwörter stimmen nicht überein.','error');
      if(!form.get('terms')) return message('Bitte Datenschutz- und Nutzungsbedingungen bestätigen.','error');
      message('Benutzerkonto wird angelegt …');
      const redirect=new URL('index.html',location.href).href;
      const {data,error}=await state.client.auth.signUp({
        email,password,
        options:{emailRedirectTo:redirect,data:{full_name:fullName,organization_name:organizationName}}
      });
      if(error) return message(error.message,'error');
      register.reset();
      if(data.session) location.href='index.html';
      else message('Das Konto wurde angelegt. Bitte die Bestätigungs-E-Mail öffnen, bevor Sie sich anmelden.','success');
    });
    document.querySelector('#resetPassword')?.addEventListener('click',async()=>{
      const email=String(new FormData(login).get('email')||'').trim();
      if(!email) return message('Bitte zuerst die E-Mail-Adresse eingeben.','error');
      const redirect=new URL('auth.html?recovery=1',location.href).href;
      const {error}=await state.client.auth.resetPasswordForEmail(email,{redirectTo:redirect});
      if(error) return message(error.message,'error');
      message('Eine E-Mail zum Zurücksetzen des Passworts wurde versendet.','success');
    });
    if(state.session){
      const name=state.session.user.user_metadata?.full_name||state.session.user.email;
      message(`Angemeldet als ${name}.`,'success');
    }
  };
  const init=async()=>{
    try{
      const config=await loadConfig();
      state.configured=config.configured;
      if(state.configured){
        const library=await loadLibrary();
        state.client=library.createClient(config.url,config.publishableKey,{
          auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
        });
        const {data,error}=await state.client.auth.getSession();
        if(error) throw error;
        state.session=data.session;
        state.client.auth.onAuthStateChange((_event,session)=>{
          state.session=session;
          renderSlots();
        });
      }
      state.ready=true;
      renderSlots();
      initAuthPage();
      globalThis.dispatchEvent(new CustomEvent('ba-auth-ready',{detail:{configured:state.configured,session:state.session}}));
    }catch(error){
      console.error(error);
      state.ready=true;
      renderSlots();
      message('Die Benutzerverwaltung konnte nicht initialisiert werden.','error');
    }
  };
  globalThis.BAAuth={state,init};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
