
// functions/ai-suggest.ts
export const onRequestGet = async ({ request, env }) => {
  // Basit örnek: önce yerel suggestions.json'ı okur, sonra (varsa) env üzerinden bir KI servisine gider.
  // Cloudflare Pages Functions içinde "ASSETS" bağlamından statik dosyalar okunabilir:
  try {
    const url = new URL(request.url);
    const section = url.searchParams.get('section') || '';
    const type    = url.searchParams.get('type') || '';
    const pics    = (url.searchParams.get('pics') || '').split(',').filter(Boolean);

    // Statik suggestions.json'ı getir
    const base = await fetch(new URL('/assets/suggestions.json', url.origin).toString(), { cache: 'no-store' });
    const data = await base.json();

    const out = new Set<string>();
    pics.forEach(p => {
      (data?.[type]?.[section]?.[p] || []).forEach(t => out.add(t));
    });

    // İsteğe bağlı: buradan sonra env.SOME_AI_URL varsa basit bir çağrı yapılıp ek cümleler eklenebilir.
    // Bu örnekte yalnızca yerel önerileri döndürüyoruz.
    return new Response(JSON.stringify(Array.from(out).slice(0, 8)), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' }, status: 200 });
  }
};
``
