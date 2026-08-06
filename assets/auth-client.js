'use strict';
(function(){
  const path=location.pathname;
  const isAuthPage=path.endsWith('/auth.html');
  const isProtectedPage=!isAuthPage&&(path.endsWith('/ba-generator/')||path.endsWith('/index.html')||path.endsWith('/editor.html'));
  if(isProtectedPage)document.documentElement.classList.add('auth-checking');

  const state={client:null,session:null,configured:false,ready:false};
  const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentTarget=()=>path.endsWith('/editor.html')?'editor.html':'index.html';
  const requestedTarget=()=>{
    const value=new URLSearchParams(location.search).get('next');
    return ['index.html','editor.html'].includes(value)?value:'index.html';
  };
  const message=(text,type='info')=>{
    const box=document.querySelector('#authMessage');
    if(!box)return;
    box.textContent=text;
    box.className=`auth-message ${type}`;
    box.hidden=false;
  };
  const redirectToAuth=()=>location.replace(`auth.html?next=${encodeURIComponent(currentTarget())}`);
  const revealProtectedPage=()=>document.documentElement.classList.remove('auth-checking');
  const loadCloudModule=()=>{
    if(!isProtectedPage||document.querySelector('script[data-ba-cloud]'))return;
    const script=document.createElement('script');
    script.src='assets/ba-cloud.js?v=20260806';
    script.dataset.baCloud='true';
    document.body.appendChild(script);
  };
  const loadConfig=async()=>{
    try{
      const response=await fetch('./auth-config',{headers:{accept:'application/json'},cache:'no-store'});
      if(response.ok){
        const remote=await response.json();
        if(remote?.configured&&remote.url&&remote.publishableKey)return remote;
      }
    }catch{}
    const fallback=globalThis.BA_AUTH_CONFIG||{};
    return {configured:Boolean(fallback.url&&fallback.publishableKey),url:fallback.url||'',publishableKey:fallback.publishableKey||''};
  };
  const loadLibrary=async()=>{
    if(globalThis.supabase?.createClient)return globalThis.supabase;
    throw new Error('Supabase-Bibliothek konnte nicht geladen werden.');
  };
  const renderSlots=()=>{
    document.querySelectorAll('[data-auth-slot]').forEach(slot=>{
      if(!state.configured||!state.session){
        slot.innerHTML='<a class="auth-link" href="auth.html">Anmelden / Registrieren</a>';
        return;
      }
      const user=state.session.user;
      const name=user.user_metadata?.full_name||user.email||'Benutzerkonto';
      slot.innerHTML=`<span class="auth-user" title="${escapeHtml(user.email||'')}">${escapeHtml(name)}</span><button class="auth-logout" type="button">Abmelden</button>`;
      slot.querySelector('.auth-logout')?.addEventListener('click',async()=>{
        const {error}=await state.client.auth.signOut({scope:'local'});
        if(error)return;
        location.replace('auth.html');
      });
    });
  };
  const enforceAccess=()=>{
    if(!isProtectedPage)return true;
    if(!state.configured||!state.session){redirectToAuth();return false;}
    revealProtectedPage();
    loadCloudModule();
    return true;
  };
  const initAuthPage=()=>{
    const login=document.querySelector('#loginForm');
    const register=document.querySelector('#registerForm');
    if(!login&&!register)return;
    const configNotice=document.querySelector('#authConfigNotice');
    if(!state.configured){
      if(configNotice)configNotice.hidden=false;
      document.querySelectorAll('#loginForm input,#loginForm button,#registerForm input,#registerForm button').forEach(el=>el.disabled=true);
      message('Die sichere Benutzerverwaltung ist vorbereitet, aber noch nicht mit einem Supabase-Projekt verbunden.','warning');
      return;
    }
    if(state.session){location.replace(requestedTarget());return;}
    if(configNotice)configNotice.hidden=true;
    document.querySelectorAll('[data-auth-tab]').forEach(button=>button.addEventListener('click',()=>{
      const target=button.dataset.authTab;
      document.querySelectorAll('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===button));
      login.hidden=target!=='login';
      register.hidden=target!=='register';
      const box=document.querySelector('#authMessage');if(box)box.hidden=true;
    }));
    login?.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=new FormData(login);
      const email=String(form.get('email')||'').trim();
      const password=String(form.get('password')||'');
      message('Anmeldung wird geprüft …');
      const {error}=await state.client.auth.signInWithPassword({email,password});
      if(error)return message(error.message,'error');
      location.replace(requestedTarget());
    });
    register?.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=new FormData(register);
      const fullName=String(form.get('fullName')||'').trim();
      const organizationName=String(form.get('organizationName')||'').trim();
      const email=String(form.get('email')||'').trim();
      const password=String(form.get('password')||'');
      const passwordRepeat=String(form.get('passwordRepeat')||'');
      if(password.length<10)return message('Das Passwort muss mindestens 10 Zeichen enthalten.','error');
      if(password!==passwordRepeat)return message('Die Passwörter stimmen nicht überein.','error');
      if(!form.get('terms'))return message('Bitte Datenschutz- und Nutzungsbedingungen bestätigen.','error');
      message('Benutzerkonto wird angelegt …');
      const next=encodeURIComponent(requestedTarget());
      const redirect=new URL(`auth.html?next=${next}`,location.href).href;
      const {data,error}=await state.client.auth.signUp({email,password,options:{emailRedirectTo:redirect,data:{full_name:fullName,organization_name:organizationName,company_name:organizationName}}});
      if(error)return message(error.message,'error');
      register.reset();
      if(data.session)location.replace(requestedTarget());
      else message('Das Konto wurde angelegt. Bitte die Bestätigungs-E-Mail öffnen, bevor Sie sich anmelden.','success');
    });
    document.querySelector('#resetPassword')?.addEventListener('click',async()=>{
      const email=String(new FormData(login).get('email')||'').trim();
      if(!email)return message('Bitte zuerst die E-Mail-Adresse eingeben.','error');
      const next=encodeURIComponent(requestedTarget());
      const redirect=new URL(`auth.html?recovery=1&next=${next}`,location.href).href;
      const {error}=await state.client.auth.resetPasswordForEmail(email,{redirectTo:redirect});
      if(error)return message(error.message,'error');
      message('Eine E-Mail zum Zurücksetzen des Passworts wurde versendet.','success');
    });
  };
  const init=async()=>{
    try{
      const config=await loadConfig();
      state.configured=config.configured;
      if(state.configured){
        const library=await loadLibrary();
        state.client=library.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        const {data,error}=await state.client.auth.getSession();
        if(error)throw error;
        state.session=data.session;
        state.client.auth.onAuthStateChange((_event,session)=>{
          state.session=session;
          renderSlots();
          if(isProtectedPage&&!session)redirectToAuth();
        });
      }
      state.ready=true;
      renderSlots();
      if(!enforceAccess())return;
      initAuthPage();
      globalThis.dispatchEvent(new CustomEvent('ba-auth-ready',{detail:{configured:state.configured,session:state.session}}));
    }catch(error){
      console.error(error);
      state.ready=true;
      renderSlots();
      if(isProtectedPage){redirectToAuth();return;}
      message('Die Benutzerverwaltung konnte nicht initialisiert werden.','error');
    }
  };
  globalThis.BAAuth={state,init};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
