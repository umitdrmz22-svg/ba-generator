
// functions/env.json.ts
export const onRequestGet = ({ env }) => {
  const payload = {
    url: env.SUPABASE_URL || null,
    hasAnonKey: Boolean(env.SUPABASE_ANON_KEY)
  };
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' }
  });
};
