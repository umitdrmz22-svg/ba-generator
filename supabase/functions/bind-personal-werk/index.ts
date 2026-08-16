import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const PERSONAL_PRODUCTS = new Set([
  'ehs_ba_monthly',
  'ehs_fluchtplan_monthly',
  'ehs_brandschutzordnung_monthly',
  'ehs_gefahrstoffkataster_monthly',
  'ehs_dokumentmanagement_monthly',
  'ehs_unfallmanagement_monthly',
  'ehs_pro_monthly',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function validUntil(status: string, expiresAt: string | null | undefined) {
  if (!['active', 'grace', 'canceled'].includes(status)) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const publishableKey = publishableKeys.default ?? Deno.env.get('SUPABASE_ANON_KEY');
    const secretKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !publishableKey || !secretKey) return json({ error: 'SERVER_CONFIGURATION' }, 500);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;
    if (userError || !user) return json({ error: 'UNAUTHORIZED' }, 401);

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: subscriptions, error: subscriptionError } = await admin
      .from('ehs_subscriptions')
      .select('product_id,status,expires_at')
      .eq('user_id', user.id);
    if (subscriptionError) return json({ error: 'SUBSCRIPTION_QUERY_FAILED' }, 500);

    const hasPersonalSubscription = (subscriptions ?? []).some((row) =>
      PERSONAL_PRODUCTS.has(String(row.product_id ?? '')) && validUntil(String(row.status ?? ''), row.expires_at),
    );
    if (!hasPersonalSubscription) return json({ error: 'PERSONAL_SUBSCRIPTION_REQUIRED' }, 403);

    const { data: existing, error: existingError } = await admin
      .from('ehs_personal_werk_bindings')
      .select('organization_id,locked_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) return json({ error: 'BINDING_QUERY_FAILED' }, 500);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { body = {}; }
    const requestedOrganizationId = String(body.organizationId ?? '').trim();
    const requestedWerkName = String(body.werkName ?? '').trim().replace(/\s+/g, ' ');

    if (existing) {
      if (requestedOrganizationId && requestedOrganizationId !== existing.organization_id) {
        return json({ error: 'WERK_ALREADY_BOUND', binding: existing }, 409);
      }
      const { data: org } = await admin.from('organizations').select('id,name').eq('id', existing.organization_id).maybeSingle();
      return json({ ok: true, alreadyBound: true, binding: { ...existing, name: org?.name ?? 'Werk' } });
    }

    let organizationId = requestedOrganizationId;
    let organizationName = '';

    if (organizationId) {
      const { data: membership, error: memberError } = await admin
        .from('organization_members')
        .select('organization_id,status,organizations(name)')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (memberError) return json({ error: 'MEMBERSHIP_QUERY_FAILED' }, 500);
      if (!membership) return json({ error: 'NOT_ORG_MEMBER' }, 403);
      organizationName = String((membership.organizations as { name?: string } | null)?.name ?? 'Werk');
    } else {
      if (requestedWerkName.length < 2 || requestedWerkName.length > 120) return json({ error: 'WERK_NAME_REQUIRED' }, 400);
      const { data: org, error: orgError } = await admin
        .from('organizations')
        .insert({ name: requestedWerkName, created_by: user.id })
        .select('id,name')
        .single();
      if (orgError || !org) return json({ error: 'WERK_CREATE_FAILED' }, 500);
      organizationId = String(org.id);
      organizationName = String(org.name);
      const { error: memberInsertError } = await admin
        .from('organization_members')
        .insert({ organization_id: organizationId, user_id: user.id, role: 'owner', status: 'active' });
      if (memberInsertError) {
        await admin.from('organizations').delete().eq('id', organizationId).eq('created_by', user.id);
        return json({ error: 'WERK_MEMBERSHIP_CREATE_FAILED' }, 500);
      }
    }

    const { data: inserted, error: insertError } = await admin
      .from('ehs_personal_werk_bindings')
      .insert({ user_id: user.id, organization_id: organizationId })
      .select('organization_id,locked_at')
      .single();

    if (insertError) {
      const { data: winner } = await admin
        .from('ehs_personal_werk_bindings')
        .select('organization_id,locked_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (winner) {
        if (winner.organization_id !== organizationId) return json({ error: 'WERK_ALREADY_BOUND', binding: winner }, 409);
        return json({ ok: true, alreadyBound: true, binding: { ...winner, name: organizationName } });
      }
      return json({ error: 'BINDING_CREATE_FAILED' }, 500);
    }

    return json({ ok: true, alreadyBound: false, binding: { ...inserted, name: organizationName }, message: 'PERSONAL_WERK_LOCKED' }, 201);
  },
};
