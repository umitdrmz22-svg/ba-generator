import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const LEGACY_ALL_ACCESS_PRODUCT = 'ehs_pro_monthly';
const MODULE_PRODUCTS = new Set([
  'ehs_ba_monthly',
  'ehs_fluchtplan_monthly',
  'ehs_brandschutzordnung_monthly',
  'ehs_gefahrstoffkataster_monthly',
  'ehs_dokumentmanagement_monthly',
  'ehs_unfallmanagement_monthly',
  LEGACY_ALL_ACCESS_PRODUCT,
]);
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PUBLISHER_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ServiceAccount = { client_email: string; private_key: string };
type SubscriptionLineItem = {
  productId?: string;
  expiryTime?: string;
  autoRenewingPlan?: { autoRenewEnabled?: boolean };
  offerDetails?: { basePlanId?: string };
};
type SubscriptionPurchaseV2 = {
  subscriptionState?: string;
  acknowledgementState?: string;
  lineItems?: SubscriptionLineItem[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToArrayBuffer(pem: string) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function serviceAccountAccessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const claims = encodeJson({
    iss: account.client_email,
    scope: ANDROID_PUBLISHER_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const tokenJson = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenJson.access_token) {
    console.error('Google OAuth failed', tokenResponse.status, tokenJson?.error);
    throw new Error('Google Play verification service unavailable');
  }
  return String(tokenJson.access_token);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mapState(state?: string) {
  switch (state) {
    case 'SUBSCRIPTION_STATE_ACTIVE': return 'active';
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': return 'grace';
    case 'SUBSCRIPTION_STATE_ON_HOLD': return 'on_hold';
    case 'SUBSCRIPTION_STATE_PAUSED': return 'paused';
    case 'SUBSCRIPTION_STATE_CANCELED': return 'canceled';
    case 'SUBSCRIPTION_STATE_EXPIRED': return 'expired';
    case 'SUBSCRIPTION_STATE_PENDING': return 'pending';
    case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED': return 'expired';
    default: return 'pending';
  }
}

function maxExpiry(lineItems: SubscriptionLineItem[]) {
  return lineItems
    .map((item) => item.expiryTime)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

async function getGoogleSubscription(packageName: string, purchaseToken: string, accessToken: string) {
  const url = `${GOOGLE_PUBLISHER_BASE}/applications/${encodeURIComponent(packageName)}` +
    `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await response.json();
  if (!response.ok) {
    console.error('subscriptionsv2.get failed', response.status, body?.error?.status);
    if (response.status === 404 || response.status === 410) throw new Error('PURCHASE_NOT_FOUND');
    throw new Error('Google Play verification failed');
  }
  return body as SubscriptionPurchaseV2;
}

async function acknowledgeIfNeeded(
  packageName: string,
  productId: string,
  purchaseToken: string,
  accessToken: string,
  purchase: SubscriptionPurchaseV2,
) {
  if (purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_PENDING') return;
  const state = mapState(purchase.subscriptionState);
  if (!['active', 'grace', 'canceled'].includes(state)) return;

  const url = `${GOOGLE_PUBLISHER_BASE}/applications/${encodeURIComponent(packageName)}` +
    `/purchases/subscriptions/${encodeURIComponent(productId)}` +
    `/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) {
    console.error('Subscription acknowledgement failed', response.status, (await response.text()).slice(0, 300));
    throw new Error('Purchase verified but acknowledgement failed');
  }
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

    try {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
      const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
      const publishableKey = publishableKeys.default ?? Deno.env.get('SUPABASE_ANON_KEY');
      const secretKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !publishableKey || !secretKey) throw new Error('Supabase server configuration incomplete');

      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      const user = userData.user;
      if (userError || !user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

      const requestBody = await req.json().catch(() => ({}));
      const packageName = String(requestBody.packageName ?? '').trim();
      const purchaseToken = String(requestBody.purchaseToken ?? '').trim();
      const productId = String(requestBody.productId ?? '').trim();
      if (!packageName || !purchaseToken || purchaseToken.length > 4096 || !MODULE_PRODUCTS.has(productId)) {
        return jsonResponse({ error: 'INVALID_REQUEST' }, 400);
      }

      const allowedPackages = (Deno.env.get('EHS_ANDROID_PACKAGE_NAMES') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (!allowedPackages.includes(packageName)) return jsonResponse({ error: 'PACKAGE_NOT_ALLOWED' }, 400);

      const account = JSON.parse(Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') ?? '{}') as ServiceAccount;
      if (!account.client_email || !account.private_key) throw new Error('Google Play service account secret missing');

      const googleAccessToken = await serviceAccountAccessToken(account);
      const purchase = await getGoogleSubscription(packageName, purchaseToken, googleAccessToken);
      const lineItems = purchase.lineItems ?? [];
      const matchingLineItems = lineItems.filter((item) => item.productId === productId);
      if (matchingLineItems.length === 0) return jsonResponse({ error: 'WRONG_PRODUCT' }, 400);

      const expectedAccountId = await sha256Hex(user.id);
      const googleAccountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
      if (!googleAccountId || googleAccountId !== expectedAccountId) {
        return jsonResponse({ error: 'ACCOUNT_BINDING_MISMATCH' }, 403);
      }

      const status = mapState(purchase.subscriptionState);
      const expiresAt = maxExpiry(matchingLineItems);
      const autoRenewing = matchingLineItems.some((item) => item.autoRenewingPlan?.autoRenewEnabled === true);
      const basePlanId = matchingLineItems.find((item) => item.offerDetails?.basePlanId)?.offerDetails?.basePlanId ?? null;

      await acknowledgeIfNeeded(packageName, productId, purchaseToken, googleAccessToken, purchase);

      const admin = createClient(supabaseUrl, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: writeError } = await admin
        .from('ehs_subscriptions')
        .upsert({
          user_id: user.id,
          provider: 'google_play',
          product_id: productId,
          base_plan_id: basePlanId,
          package_name: packageName,
          purchase_token: purchaseToken,
          status,
          expires_at: expiresAt,
          auto_renewing: autoRenewing,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,product_id' });
      if (writeError) {
        console.error('ehs_subscriptions upsert failed', writeError.code);
        throw new Error('Entitlement storage failed');
      }

      const entitled = ['active', 'grace', 'canceled'].includes(status) &&
        (!expiresAt || new Date(expiresAt).getTime() > Date.now());
      return jsonResponse({
        ok: true,
        productId,
        legacyAllAccess: productId === LEGACY_ALL_ACCESS_PRODUCT,
        status,
        entitled,
        expiresAt,
        autoRenewing,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown server error';
      if (message === 'PURCHASE_NOT_FOUND') return jsonResponse({ error: 'PURCHASE_NOT_FOUND' }, 404);
      console.error('verify-play-subscription', message);
      return jsonResponse({ error: 'SERVER_ERROR' }, 500);
    }
  },
};
