import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const PERSONAL_PRODUCTS = new Set([
  'ehs_ba_monthly','ehs_fluchtplan_monthly','ehs_brandschutzordnung_monthly',
  'ehs_gefahrstoffkataster_monthly','ehs_dokumentmanagement_monthly','ehs_unfallmanagement_monthly','ehs_pro_monthly',
]);
const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
const validUntil=(status:string,expiresAt:string|null|undefined)=>['active','grace','canceled'].includes(status)&&(!expiresAt||new Date(expiresAt).getTime()>Date.now());
const clean=(v:unknown,max=160)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,max);
const codeOf=(name:string)=>{
  const base=name.normalize('NFKD').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toUpperCase().slice(0,42)||'WERK';
  return `${base}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
};

export default { async fetch(req:Request){
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'METHOD_NOT_ALLOWED'},405);
  const authHeader=req.headers.get('Authorization');
  if(!authHeader?.startsWith('Bearer ')) return json({error:'UNAUTHORIZED'},401);

  const supabaseUrl=Deno.env.get('SUPABASE_URL');
  const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')??'{}');
  const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}');
  const publishableKey=publishableKeys.default??Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey=secretKeys.default??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!supabaseUrl||!publishableKey||!secretKey) return json({error:'SERVER_CONFIGURATION'},500);

  const userClient=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await userClient.auth.getUser();
  const user=userData.user;
  if(userError||!user) return json({error:'UNAUTHORIZED'},401);
  const admin=createClient(supabaseUrl,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:subs,error:subError}=await admin.from('ehs_subscriptions').select('product_id,status,expires_at').eq('user_id',user.id);
  if(subError) return json({error:'SUBSCRIPTION_QUERY_FAILED'},500);
  const hasPersonal=(subs??[]).some(r=>PERSONAL_PRODUCTS.has(String(r.product_id??''))&&validUntil(String(r.status??''),r.expires_at));
  if(!hasPersonal) return json({error:'PERSONAL_SUBSCRIPTION_REQUIRED'},403);

  const {data:existing,error:existingError}=await admin.from('ehs_personal_werk_bindings')
    .select('organization_id,werk_id,locked_at,ehs_werks(name,code)').eq('user_id',user.id).maybeSingle();
  if(existingError) return json({error:'BINDING_QUERY_FAILED'},500);
  if(existing){
    return json({ok:true,alreadyBound:true,binding:{organizationId:existing.organization_id,werkId:existing.werk_id,lockedAt:existing.locked_at,name:(existing.ehs_werks as any)?.name??'Werk',code:(existing.ehs_werks as any)?.code??''}});
  }

  let body:Record<string,unknown>={}; try{body=await req.json();}catch{}
  const requestedWerkId=clean(body.werkId,80);
  let organizationId=clean(body.organizationId,80);
  const werkName=clean(body.werkName,160);
  const requestedCode=clean(body.werkCode,60).toUpperCase();

  let werk:any=null;
  if(requestedWerkId){
    const {data,error}=await admin.from('ehs_werks').select('id,organization_id,name,code').eq('id',requestedWerkId).maybeSingle();
    if(error) return json({error:'WERK_QUERY_FAILED'},500);
    if(!data) return json({error:'WERK_NOT_FOUND'},404);
    const {data:membership}=await admin.from('organization_members').select('organization_id').eq('organization_id',data.organization_id).eq('user_id',user.id).eq('status','active').maybeSingle();
    if(!membership) return json({error:'NOT_ORG_MEMBER'},403);
    werk=data; organizationId=String(data.organization_id);
  } else {
    if(!organizationId){
      if(werkName.length<2) return json({error:'WERK_NAME_REQUIRED'},400);
      const {data:org,error:orgError}=await admin.from('organizations').insert({name:werkName,created_by:user.id}).select('id').single();
      if(orgError||!org) return json({error:'ORGANIZATION_CREATE_FAILED'},500);
      organizationId=String(org.id);
      const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:user.id,role:'owner',status:'active'});
      if(memberError) return json({error:'ORGANIZATION_MEMBERSHIP_CREATE_FAILED'},500);
    } else {
      const {data:membership}=await admin.from('organization_members').select('organization_id').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle();
      if(!membership) return json({error:'NOT_ORG_MEMBER'},403);
    }
    if(werkName.length<2) return json({error:'WERK_NAME_REQUIRED'},400);
    const {data:newWerk,error:werkError}=await admin.from('ehs_werks').insert({
      organization_id:organizationId,name:werkName,code:requestedCode||codeOf(werkName),plan_code:null,licensed_modules:[],
      included_editor_seats:0,included_reader_seats:0,extra_editor_seats:0,extra_reader_seats:0,
      billing_status:'pending',payment_source:'manual',created_by:user.id,
    }).select('id,organization_id,name,code').single();
    if(werkError||!newWerk) return json({error:'WERK_CREATE_FAILED'},500);
    werk=newWerk;
  }

  const {data:inserted,error:insertError}=await admin.from('ehs_personal_werk_bindings')
    .insert({user_id:user.id,organization_id:organizationId,werk_id:werk.id})
    .select('organization_id,werk_id,locked_at').single();
  if(insertError){
    const {data:winner}=await admin.from('ehs_personal_werk_bindings').select('organization_id,werk_id,locked_at').eq('user_id',user.id).maybeSingle();
    if(winner) return json({error:'WERK_ALREADY_BOUND',binding:winner},409);
    return json({error:'BINDING_CREATE_FAILED'},500);
  }
  return json({ok:true,alreadyBound:false,binding:{organizationId:inserted.organization_id,werkId:inserted.werk_id,lockedAt:inserted.locked_at,name:werk.name,code:werk.code},message:'PERSONAL_WERK_LOCKED'},201);
}};
