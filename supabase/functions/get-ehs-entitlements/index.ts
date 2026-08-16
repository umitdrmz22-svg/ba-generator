import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const MODULE_PRODUCTS = [
  'ehs_ba_monthly','ehs_fluchtplan_monthly','ehs_brandschutzordnung_monthly',
  'ehs_gefahrstoffkataster_monthly','ehs_dokumentmanagement_monthly','ehs_unfallmanagement_monthly',
] as const;
const LEGACY_ALL_ACCESS_PRODUCT = 'ehs_pro_monthly';
const corsHeaders = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
type AccessMode='none'|'read'|'edit';
type WorkAccess={id:string;organizationId:string;name:string;code:string;role:string;seatType:string};
type ModuleAccess={productId:string;active:boolean;mode:AccessMode;sources:string[];works:WorkAccess[];expiresAt:string|null};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
const rank=(m:AccessMode)=>m==='edit'?2:m==='read'?1:0;
const maxMode=(a:AccessMode,b:AccessMode):AccessMode=>rank(a)>=rank(b)?a:b;
const validUntil=(s:string,e:string|null|undefined)=>['active','grace','canceled'].includes(s)&&(!e||new Date(e).getTime()>Date.now());
const validCorporate=validUntil;
const pushWork=(item:ModuleAccess,work:WorkAccess)=>{if(!item.works.some(w=>w.id===work.id))item.works.push(work);};

export default { async fetch(req:Request){
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(!['GET','POST'].includes(req.method))return response({error:'METHOD_NOT_ALLOWED'},405);
  const authHeader=req.headers.get('Authorization');
  if(!authHeader?.startsWith('Bearer '))return response({error:'UNAUTHORIZED'},401);
  const supabaseUrl=Deno.env.get('SUPABASE_URL');
  const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')??'{}');
  const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}');
  const publishableKey=publishableKeys.default??Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey=secretKeys.default??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!supabaseUrl||!publishableKey||!secretKey)return response({error:'SERVER_CONFIGURATION'},500);
  const userClient=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await userClient.auth.getUser(); const user=userData.user;
  if(userError||!user)return response({error:'UNAUTHORIZED'},401);
  const admin=createClient(supabaseUrl,secretKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const access=new Map<string,ModuleAccess>();
  for(const productId of MODULE_PRODUCTS)access.set(productId,{productId,active:false,mode:'none',sources:[],works:[],expiresAt:null});

  const {data:binding,error:bindingError}=await admin.from('ehs_personal_werk_bindings').select('organization_id,locked_at').eq('user_id',user.id).maybeSingle();
  if(bindingError)return response({error:'ENTITLEMENT_QUERY_FAILED'},500);
  let personalWork:WorkAccess|null=null;
  if(binding?.organization_id){
    const {data:org,error:orgError}=await admin.from('organizations').select('id,name').eq('id',binding.organization_id).maybeSingle();
    if(orgError)return response({error:'ENTITLEMENT_QUERY_FAILED'},500);
    if(org)personalWork={id:`personal:${org.id}`,organizationId:String(org.id),name:String(org.name??'Werk'),code:'EINZELLIZENZ',role:'owner',seatType:'editor'};
  }

  const {data:personalRows,error:personalError}=await admin.from('ehs_subscriptions').select('product_id,status,expires_at').eq('user_id',user.id);
  if(personalError)return response({error:'ENTITLEMENT_QUERY_FAILED'},500);
  let legacyAllAccess=false; const activePersonalProducts:string[]=[];
  for(const row of personalRows??[]){
    const productId=String(row.product_id??''); if(!validUntil(String(row.status??''),row.expires_at))continue;
    if(productId===LEGACY_ALL_ACCESS_PRODUCT){legacyAllAccess=true;continue;}
    const item=access.get(productId); if(!item)continue;
    item.active=true;item.mode='edit';if(!item.sources.includes('google_play'))item.sources.push('google_play');item.expiresAt=row.expires_at??null;activePersonalProducts.push(productId);if(personalWork)pushWork(item,personalWork);
  }
  if(legacyAllAccess)for(const item of access.values()){item.active=true;item.mode='edit';if(!item.sources.includes('legacy_all_access'))item.sources.push('legacy_all_access');if(personalWork)pushWork(item,personalWork);}

  const {data:memberships,error:membershipError}=await admin.from('ehs_werk_members').select('werk_id,seat_type,role,status').eq('user_id',user.id).eq('status','active');
  if(membershipError)return response({error:'ENTITLEMENT_QUERY_FAILED'},500);
  const werkIds=[...new Set((memberships??[]).map(m=>String(m.werk_id)))]; let werks:Array<Record<string,unknown>>=[];
  if(werkIds.length){const {data,error}=await admin.from('ehs_werks').select('id,organization_id,name,code,licensed_modules,billing_status,current_period_end').in('id',werkIds);if(error)return response({error:'ENTITLEMENT_QUERY_FAILED'},500);werks=(data??[]) as Array<Record<string,unknown>>;}
  const werkById=new Map(werks.map(w=>[String(w.id),w]));
  for(const membership of memberships??[]){const werk=werkById.get(String(membership.werk_id));if(!werk)continue;const status=String(werk.billing_status??'');const periodEnd=(werk.current_period_end as string|null|undefined)??null;if(!validCorporate(status,periodEnd))continue;const seatType=String(membership.seat_type??'reader');const mode:AccessMode=seatType==='editor'?'edit':'read';const modules=Array.isArray(werk.licensed_modules)?werk.licensed_modules.map(String):[];for(const productId of modules){const item=access.get(productId);if(!item)continue;item.active=true;item.mode=maxMode(item.mode,mode);if(!item.sources.includes('corporate_werk'))item.sources.push('corporate_werk');pushWork(item,{id:String(werk.id),organizationId:String(werk.organization_id??''),name:String(werk.name??''),code:String(werk.code??''),role:String(membership.role??''),seatType});}}

  const modules=[...access.values()];const allWorks=Array.from(new Map(modules.flatMap(m=>m.works).map(w=>[w.id,w])).values());
  return response({ok:true,userId:user.id,modules,personal:{activeProducts:activePersonalProducts,legacyAllAccess,bindingRequired:(activePersonalProducts.length>0||legacyAllAccess)&&!personalWork,binding:personalWork?{organizationId:personalWork.organizationId,name:personalWork.name,lockedAt:binding?.locked_at??null}:null},corporate:{workCount:new Set(modules.flatMap(m=>m.works.filter(w=>!w.id.startsWith('personal:')).map(w=>w.id))).size,works:allWorks.filter(w=>!w.id.startsWith('personal:'))}});
}};
