
// functions/img.ts
const ALLOWED = [
  'commons.wikimedia.org',
  'upload.wikimedia.org',
  'unece.org',
  'symbib-light.bgrci.de',
  'www.bghm.de'
];

export const onRequestGet = async ({ request }) => {
  const u = new URL(request.url);
  const src = u.searchParams.get('src') || '';
  if (!src) return new Response('Missing src', { status: 400 });

  try {
    const target = new URL(src);
    if (!ALLOWED.includes(target.host)) {
      return new Response('Host not allowed', { status: 403 });
    }

    const r = await fetch(target.toString(), { headers: { 'User-Agent': 'BA-Generator/1.0' } });
    if (!r.ok) return new Response('Upstream error', { status: r.status });

    const buf = await r.arrayBuffer();
    const ct  = r.headers.get('content-type') || 'application/octet-stream';
    return new Response(buf, {
      headers: {
        'content-type': ct,
        'cache-control': 'public, max-age=86400',
        'access-control-allow-origin': '*'
      }
    });
  } catch (e) {
    return new Response('Bad src', { status: 400 });
  }
};
