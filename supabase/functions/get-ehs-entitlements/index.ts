import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const MODULE_PRODUCTS = [
  'ehs_ba_monthly',
  'ehs_fluchtplan_monthly',
  'ehs_brandschutzordnung_monthly',
  'ehs_gefahrstoffkataster_monthly',
  'ehs_dokumentmanagement_monthly',
  'ehs_unfallmanagement_monthly',
] as const;
const LEGACY_ALL_ACCESS_PRODUCT = 'ehs_pro_monthly';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type AccessMode = 'none' | 'read' | 'edit';
type ModuleAccess = {
  productId: string;
  active: boolean;
  mode: AccessMode;
  sources: string[];
  works: Array<{ id: string; name: string; code: string; role: string; seatType: string }>;
  expiresAt: string | null;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function accessRank(mode: AccessMode) {
  return mode === 'edit' ? 2 : mode === 'read' ? 1 : 0;
}

function maxMode(a: AccessMode, b: AccessMode): AccessMode {
  return accessRank(a) >= accessRank(b) ? a : b;
}

function validUntil(status: string, expiresAt: string | null | undefined) {
  if (!['active', 'grace', 'canceled'].includes(status)) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function validCorporate(status: string, periodEnd: string | null | undefined) {
  if (!['active', 'grace', 'canceled'].includes(status)) return false;
  if (!periodEnd) return true;
  return new Date(periodEnd).getTime() > Date.now();
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (!['GET', 'POST'].includes(req.method)) return response({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return response({ error: 'UNAUTHORIZED' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const publishableKey = publishableKeys.default ?? Deno.env.get('SUPABASE_ANON_KEY');
    const secretKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !publishableKey || !secretKey) return response({ error: 'SERVER_CONFIGURATION' }, 500);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;
    if (userError || !user) return response({ error: 'UNAUTHORIZED' }, 401);

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const access = new Map<string, ModuleAccess>();
    for (const productId of MODULE_PRODUCTS) {
      access.set(productId, {
        productId,
        active: false,
        mode: 'none',
        sources: [],
        works: [],
        expiresAt: null,
      });
    }

    const { data: personalRows, error: personalError } = await admin
      .from('ehs_subscriptions')
      .select('product_id,status,expires_at')
      .eq('user_id', user.id);
    if (personalError) {
      console.error('personal entitlement query failed', personalError.code);
      return response({ error: 'ENTITLEMENT_QUERY_FAILED' }, 500);
    }

    let legacyAllAccess = false;
    for (const row of personalRows ?? []) {
      const productId = String(row.product_id ?? '');
      if (!validUntil(String(row.status ?? ''), row.expires_at)) continue;
      if (productId === LEGACY_ALL_ACCESS_PRODUCT) {
        legacyAllAccess = true;
        continue;
      }
      const item = access.get(productId);
      if (!item) continue;
      item.active = true;
      item.mode = 'edit';
      item.sources.push('google_play');
      item.expiresAt = row.expires_at ?? null;
    }

    if (legacyAllAccess) {
      for (const item of access.values()) {
        item.active = true;
        item.mode = 'edit';
        item.sources.push('legacy_all_access');
      }
    }

    const { data: memberships, error: membershipError } = await admin
      .from('ehs_werk_members')
      .select('werk_id,seat_type,role,status')
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (membershipError) {
      console.error('werk membership query failed', membershipError.code);
      return response({ error: 'ENTITLEMENT_QUERY_FAILED' }, 500);
    }

    const werkIds = [...new Set((memberships ?? []).map((m) => String(m.werk_id)))];
    let werks: Array<Record<string, unknown>> = [];
    if (werkIds.length > 0) {
      const { data, error } = await admin
        .from('ehs_werks')
        .select('id,name,code,licensed_modules,billing_status,current_period_end')
        .in('id', werkIds);
      if (error) {
        console.error('werk license query failed', error.code);
        return response({ error: 'ENTITLEMENT_QUERY_FAILED' }, 500);
      }
      werks = (data ?? []) as Array<Record<string, unknown>>;
    }

    const werkById = new Map(werks.map((w) => [String(w.id), w]));
    for (const membership of memberships ?? []) {
      const werk = werkById.get(String(membership.werk_id));
      if (!werk) continue;
      const status = String(werk.billing_status ?? '');
      const periodEnd = (werk.current_period_end as string | null | undefined) ?? null;
      if (!validCorporate(status, periodEnd)) continue;
      const seatType = String(membership.seat_type ?? 'reader');
      const mode: AccessMode = seatType === 'editor' ? 'edit' : 'read';
      const modules = Array.isArray(werk.licensed_modules) ? werk.licensed_modules.map(String) : [];
      for (const productId of modules) {
        const item = access.get(productId);
        if (!item) continue;
        item.active = true;
        item.mode = maxMode(item.mode, mode);
        if (!item.sources.includes('corporate_werk')) item.sources.push('corporate_werk');
        item.works.push({
          id: String(werk.id),
          name: String(werk.name ?? ''),
          code: String(werk.code ?? ''),
          role: String(membership.role ?? ''),
          seatType,
        });
      }
    }

    const modules = [...access.values()];
    return response({
      ok: true,
      userId: user.id,
      modules,
      corporate: {
        workCount: new Set(modules.flatMap((m) => m.works.map((w) => w.id))).size,
        works: Array.from(
          new Map(modules.flatMap((m) => m.works).map((w) => [w.id, w])).values(),
        ),
      },
    });
  },
};
