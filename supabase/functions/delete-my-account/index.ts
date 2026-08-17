import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const WEB_ORIGIN = 'https://umitdrmz22-svg.github.io';
const baseCors = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const headersFor = (req: Request) => {
  const origin = req.headers.get('Origin');
  return origin === WEB_ORIGIN ? { ...baseCors, 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : baseCors;
};
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headersFor(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    if (origin && origin !== WEB_ORIGIN) return json(req, { error: 'ORIGIN_NOT_ALLOWED' }, 403);
    return new Response('ok', { headers: headersFor(req) });
  }
  if (req.method !== 'POST') return json(req, { error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) return json(req, { error: 'UNAUTHORIZED' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  const publishableKey = publishableKeys.default ?? Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !publishableKey || !secretKey) return json(req, { error: 'SERVER_CONFIGURATION' }, 500);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader! } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) return json(req, { error: 'UNAUTHORIZED' }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: bindings, error: bindingError } = await admin
    .from('ehs_personal_werk_bindings')
    .select('organization_id')
    .eq('user_id', user.id);
  if (bindingError) return json(req, { error: 'PERSONAL_BINDING_QUERY_FAILED' }, 500);

  const orgIds = [...new Set((bindings ?? []).map((row: any) => String(row.organization_id)).filter(Boolean))];
  const exclusiveOrgIds: string[] = [];
  for (const organizationId of orgIds) {
    const [{ data: org, error: orgError }, { count: companyCount, error: companyError }, { count: otherMemberCount, error: memberError }, { count: otherBindingCount, error: otherBindingError }] = await Promise.all([
      admin.from('organizations').select('id,created_by').eq('id', organizationId).maybeSingle(),
      admin.from('ehs_companies').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
      admin.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('organization_id', organizationId).neq('user_id', user.id),
      admin.from('ehs_personal_werk_bindings').select('user_id', { count: 'exact', head: true }).eq('organization_id', organizationId).neq('user_id', user.id),
    ]);
    if (orgError || companyError || memberError || otherBindingError) return json(req, { error: 'PERSONAL_ORGANIZATION_CHECK_FAILED' }, 500);
    if (org?.created_by === user.id && (companyCount ?? 0) === 0 && (otherMemberCount ?? 0) === 0 && (otherBindingCount ?? 0) === 0) {
      exclusiveOrgIds.push(organizationId);
    }
  }

  if (exclusiveOrgIds.length) {
    const { data: docs, error: docsError } = await admin
      .from('documents')
      .select('id,current_file_path')
      .in('organization_id', exclusiveOrgIds);
    if (docsError) return json(req, { error: 'PERSONAL_DOCUMENT_QUERY_FAILED' }, 500);

    const documentIds = (docs ?? []).map((row: any) => String(row.id)).filter(Boolean);
    let versions: any[] = [];
    if (documentIds.length) {
      const { data, error } = await admin.from('document_versions').select('file_path').in('document_id', documentIds);
      if (error) return json(req, { error: 'PERSONAL_VERSION_QUERY_FAILED' }, 500);
      versions = data ?? [];
    }
    const paths = [...new Set([
      ...(docs ?? []).map((row: any) => String(row.current_file_path ?? '')).filter(Boolean),
      ...versions.map((row: any) => String(row.file_path ?? '')).filter(Boolean),
    ])];

    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await admin.storage.from('documents').remove(batch);
      if (error) {
        console.error('EHS personal storage deletion failed', error.message);
        return json(req, { error: 'PERSONAL_STORAGE_DELETE_FAILED' }, 500);
      }
    }
  }

  const { data: cleanup, error: cleanupError } = await admin.rpc('ehs_cleanup_personal_account_data', { p_user_id: user.id });
  if (cleanupError) {
    console.error('EHS personal DB cleanup failed', cleanupError.code);
    return json(req, { error: 'PERSONAL_DATA_DELETE_FAILED' }, 500);
  }

  const { error: signOutError } = await admin.auth.admin.signOut(accessToken, 'global');
  if (signOutError) console.warn('EHS global sign-out warning', signOutError.message);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    console.error('EHS account deletion failed', deleteError.code);
    return json(req, { error: 'DELETE_FAILED' }, 500);
  }

  return json(req, {
    ok: true,
    cleanup: cleanup ?? {},
    corporateRecordsPreserved: true,
  });
});
