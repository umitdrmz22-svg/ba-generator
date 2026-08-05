export const onRequestGet = ({ env }) => {
  const url = env.SUPABASE_URL || '';
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  const payload = {
    configured: Boolean(url && publishableKey),
    url,
    publishableKey
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
};
