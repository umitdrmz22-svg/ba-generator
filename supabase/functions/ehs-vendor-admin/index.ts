import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
};
const MODULES=['ehs_ba_monthly','ehs_fluchtplan_monthly','ehs_brandschutzordnung_monthly','ehs_gefahrstoffkataster_monthly','ehs_dokumentmanagement_monthly','ehs_unfallmanagement_monthly'];
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
const emailOf=(v:unknown)=>String(v??'').trim().toLowerCase();
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const text=(v:unknown,max:number)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,max);
const uniqueModules=(v:unknown)=>[...new Set(Array.isArray(v)?v.map(String):[])].filter(x=>MODULES.includes(x));

export default{async fetch(req:Request){
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(!['GET','POST'].includes(req.method))return json({error:'METHOD_NOT_ALLOWED'},405);
  const authHeader=req.headers.get('Authorization');if(!authHeader?.startsWith('Bearer '))return json({error:'UNAUTHORIZED'},401);
  const url=Deno.env.get('SUPABASE_URL');
  const pub=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')??'{}').default??Deno.env.get('SUPABASE_ANON_KEY');
  const service=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}').default??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!pub||!service)return json({error:'SERVER_CONFIGURATION'},500);
  const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const{data:userData,error:userError}=await userClient.auth.getUser();const user=userData.user;if(userError||!user)return json({error:'UNAUTHORIZED'},401);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const{data:authUser}=await admin.auth.admin.getUserById(user.id);
  const email=emailOf(authUser?.user?.email||user.email);
  if(!email||!authUser?.user?.email_confirmed_at)return json({error:'VERIFIED_EMAIL_REQUIRED'},403);
  const{data:vendor,error:vendorError}=await admin.from('ehs_vendor_admin_emails').select('email,role,status').eq('email',email).eq('status','active').maybeSingle();
  if(vendorError)return json({error:'VENDOR_AUTH_QUERY_FAILED'},500);if(!vendor)return json({error:'FORBIDDEN'},403);
  let body:Record<string,unknown>={};if(req.method==='POST'){try{body=await req.json();}catch{body={};}}
  const action=String(body.action??(req.method==='GET'?'overview':'')).trim();
  const audit=async(eventType:string,companyId:string|null,werkId:string|null,metadata:Record<string,unknown>={})=>{await admin.from('ehs_vendor_audit_log').insert({actor_user_id:user.id,event_type:eventType,company_id:companyId,werk_id:werkId,metadata});};
  const planFor=async(count:number)=>{const{data,error}=await admin.from('ehs_corporate_prices').select('plan_code,module_count,monthly_price_cents,included_editors,included_readers').eq('module_count',count).eq('active',true).maybeSingle();if(error||!data)throw new Error('PLAN_NOT_FOUND');return data;};
  const inviteOwner=async(companyId:string,werkId:string,ownerEmail:string)=>{
    const{data:invite,error}=await admin.from('ehs_werk_invites').insert({company_id:companyId,werk_id:werkId,email:ownerEmail,seat_type:'editor',role:'owner',status:'pending',invited_by:user.id}).select('id,email,expires_at').single();
    if(error)throw error;
    let mailStatus='queued';
    const{error:mailError}=await admin.auth.admin.inviteUserByEmail(ownerEmail,{redirectTo:'https://umitdrmz22-svg.github.io/defidev-legal/ehs-set-password.html',data:{ehs_company_id:companyId,ehs_werk_id:werkId,ehs_invite_id:invite.id}});
    if(mailError){const msg=String(mailError.message??'').toLowerCase();mailStatus=msg.includes('already')||msg.includes('registered')?'existing_account':'email_failed';}
    return{inviteId:invite.id,expiresAt:invite.expires_at,mailStatus};
  };

  if(action==='overview'){
    const{data:companies,error}=await admin.from('ehs_companies').select('id,organization_id,name,legal_name,billing_email,vat_id,status,created_at').order('created_at',{ascending:false});
    if(error)return json({error:'OVERVIEW_FAILED'},500);
    const output=[];
    for(const c of companies??[]){const{data:werks}=await admin.from('ehs_werks').select('id,name,code,plan_code,licensed_modules,billing_status,current_period_start,current_period_end,included_editor_seats,included_reader_seats,extra_editor_seats,extra_reader_seats').eq('company_id',c.id).order('name');output.push({...c,werks:werks??[]});}
    const{data:prices}=await admin.from('ehs_corporate_prices').select('plan_code,module_count,monthly_price_cents,currency,included_editors,included_readers').eq('active',true).order('module_count');
    return json({ok:true,vendorRole:vendor.role,companies:output,prices:prices??[],modules:MODULES});
  }

  if(action==='createCompany'){
    const companyName=text(body.companyName,180),legalName=text(body.legalName,180)||companyName,billingEmail=emailOf(body.billingEmail),vatId=text(body.vatId,64)||null,werkName=text(body.werkName,160),werkCode=text(body.werkCode,60),ownerEmail=emailOf(body.ownerEmail),modules=uniqueModules(body.modules);
    if(companyName.length<2||werkName.length<2||werkCode.length<1||!validEmail(ownerEmail)||!validEmail(billingEmail)||modules.length<1)return json({error:'INVALID_INPUT'},400);
    let orgId='',companyId='',werkId='';
    try{
      const plan=await planFor(modules.length);
      const{data:org,error:orgError}=await admin.from('organizations').insert({name:companyName,created_by:user.id}).select('id').single();if(orgError||!org)throw orgError||new Error('ORG_CREATE_FAILED');orgId=String(org.id);
      const{data:company,error:companyError}=await admin.from('ehs_companies').insert({organization_id:orgId,name:companyName,legal_name:legalName,billing_email:billingEmail,vat_id:vatId,status:'active',created_by:user.id}).select('id').single();if(companyError||!company)throw companyError||new Error('COMPANY_CREATE_FAILED');companyId=String(company.id);
      const start=new Date(),end=new Date(start);end.setMonth(end.getMonth()+1);
      const{data:werk,error:werkError}=await admin.from('ehs_werks').insert({organization_id:orgId,company_id:companyId,name:werkName,code:werkCode,plan_code:plan.plan_code,licensed_modules:modules,billing_status:'active',payment_source:'invoice',current_period_start:start.toISOString(),current_period_end:end.toISOString(),created_by:user.id}).select('id').single();if(werkError||!werk)throw werkError||new Error('WERK_CREATE_FAILED');werkId=String(werk.id);
      const invite=await inviteOwner(companyId,werkId,ownerEmail);
      await audit('company_provisioned',companyId,werkId,{moduleCount:modules.length,planCode:plan.plan_code,mailStatus:invite.mailStatus});
      return json({ok:true,companyId,organizationId:orgId,werkId,planCode:plan.plan_code,ownerInvite:invite},201);
    }catch(error){
      if(companyId)await admin.from('ehs_companies').delete().eq('id',companyId);
      if(orgId)await admin.from('organizations').delete().eq('id',orgId);
      const msg=String((error as Error)?.message||error||'');
      return json({error:msg.includes('duplicate')?'DUPLICATE_COMPANY_OR_WERK':'PROVISION_FAILED'},409);
    }
  }

  if(action==='addWerk'){
    const companyId=String(body.companyId??''),werkName=text(body.werkName,160),werkCode=text(body.werkCode,60),modules=uniqueModules(body.modules);
    if(!companyId||werkName.length<2||!werkCode||modules.length<1)return json({error:'INVALID_INPUT'},400);
    const{data:company}=await admin.from('ehs_companies').select('id,organization_id,status').eq('id',companyId).maybeSingle();if(!company||company.status!=='active'||!company.organization_id)return json({error:'COMPANY_NOT_FOUND'},404);
    try{const plan=await planFor(modules.length);const start=new Date(),end=new Date(start);end.setMonth(end.getMonth()+1);const{data:werk,error}=await admin.from('ehs_werks').insert({organization_id:company.organization_id,company_id:companyId,name:werkName,code:werkCode,plan_code:plan.plan_code,licensed_modules:modules,billing_status:'active',payment_source:'invoice',current_period_start:start.toISOString(),current_period_end:end.toISOString(),created_by:user.id}).select('id').single();if(error||!werk)throw error||new Error('WERK_CREATE_FAILED');await audit('werk_added',companyId,String(werk.id),{moduleCount:modules.length,planCode:plan.plan_code});return json({ok:true,werkId:werk.id,planCode:plan.plan_code},201);}catch(error){return json({error:String((error as Error)?.message||'WERK_CREATE_FAILED')},409);}
  }

  if(action==='updateWerk'){
    const companyId=String(body.companyId??''),werkId=String(body.werkId??''),modules=uniqueModules(body.modules),billingStatus=String(body.billingStatus??'active'),extraEditors=Math.max(0,Math.min(100,Number(body.extraEditors??0)||0)),extraReaders=Math.max(0,Math.min(500,Number(body.extraReaders??0)||0));
    if(!companyId||!werkId||modules.length<1||!['active','grace','past_due','suspended','canceled','expired'].includes(billingStatus))return json({error:'INVALID_INPUT'},400);
    const{data:werk}=await admin.from('ehs_werks').select('id,company_id').eq('id',werkId).maybeSingle();if(!werk||String(werk.company_id)!==companyId)return json({error:'WERK_NOT_FOUND'},404);
    try{const plan=await planFor(modules.length);let periodEnd:string|null=null;if(body.periodEnd){const d=new Date(String(body.periodEnd));if(Number.isNaN(d.getTime()))return json({error:'INVALID_PERIOD_END'},400);periodEnd=d.toISOString();}const patch:any={plan_code:plan.plan_code,licensed_modules:modules,billing_status:billingStatus,extra_editor_seats:extraEditors,extra_reader_seats:extraReaders};if(periodEnd)patch.current_period_end=periodEnd;const{data,error}=await admin.from('ehs_werks').update(patch).eq('id',werkId).select('id,plan_code,licensed_modules,billing_status,current_period_end,extra_editor_seats,extra_reader_seats').single();if(error)throw error;await audit('werk_license_updated',companyId,werkId,{moduleCount:modules.length,planCode:plan.plan_code,billingStatus,extraEditors,extraReaders});return json({ok:true,werk:data});}catch(error){const msg=String((error as Error)?.message||error||'');if(msg.includes('SEAT_UNDERFLOW'))return json({error:'ACTIVE_USERS_EXCEED_NEW_SEAT_LIMIT'},409);return json({error:'WERK_UPDATE_FAILED'},409);}
  }

  return json({error:'UNKNOWN_ACTION'},400);
}};