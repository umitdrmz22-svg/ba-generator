
// functions/ai-suggest.ts
export const onRequestGet = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const section = url.searchParams.get('section') || '';
    const type    = url.searchParams.get('type') || '';
    const pics    = (url.searchParams.get('pics') || '').split(',').filter(Boolean);
    const asset   = (url.searchParams.get('asset') || '').toLowerCase();

    const out = new Set<string>();

    // Beispiel-Logik: ergänzt lokale Heuristiken
    if (section==='hazard' && /schweiß|schweiss|weld/.test(asset)) {
      out.add('UV/IR-Strahlung, Funkenflug und Schweißrauch beachten; Abschirmungen und Absaugungen verwenden.');
      out.add('Brand-/Explosionsgefahr in der Umgebung; brennbare Materialien entfernen; Löschmittel bereithalten.');
    }
    if (section==='ppe' && /weld|schweiß|schweiss/.test(asset)) {
      out.add('Schweißhelm (Schutzstufe passend), hitzebeständige Handschuhe, flammhemmende Kleidung tragen.');
    }
    if (pics.includes('GHS02') && section==='em') {
      out.add('Brandfall: geeignete Löschmittel (Schaum/CO₂) einsetzen; Rückzündung vermeiden; Bereich räumen.');
    }
    return new Response(JSON.stringify(Array.from(out)), { headers:{ 'content-type':'application/json' } });
  } catch {
    return new Response(JSON.stringify([]), { headers:{ 'content-type':'application/json' } });
  }
};
