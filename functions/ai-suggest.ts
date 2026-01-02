
// /functions/ai-suggest.ts
export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || '';
  const type    = url.searchParams.get('type')    || '';
  const asset   = url.searchParams.get('asset')   || '';
  const pics    = (url.searchParams.get('pics')||'').split(',').filter(Boolean);

  const base = [];
  if (section==='hazards' && type==='Maschine') base.push('Quetsch-/Scherstellen vermeiden','Elektrische Gefährdungen beachten','Stolper-/Sturzgefahren minimieren');
  if (section==='ppe') base.push('Schutzbrille stets tragen','Gehörschutz im Lärmbereich verwenden','Schnittfeste Handschuhe bei Bedarf');
  if (section==='em') base.push('Not-Halt betätigen; Bereich sichern','Vorgesetzte informieren','Ereignis dokumentieren');

  let llm = [];
  if (env.AI_API_URL && env.AI_API_KEY && env.AI_API_URL.startsWith('https://api-inference.huggingface.co')) {
    try {
      const prompt = `Erzeuge 5 kurze Stichpunkte für "${section}" in einer Betriebsanweisung (Typ=${type}, Asset=${asset}, Piktos=${pics.join(',')}).`;
      const resp = await fetch(env.AI_API_URL, {
        method: 'POST',
        headers: {
          'content-type':'application/json',
          'authorization': `Bearer ${env.AI_API_KEY}`
        },
        body: JSON.stringify({ inputs: prompt })
      });
      const data = await resp.json();
      // HF bazı modeller metni string/array olarak döndürebilir; normalize edelim:
      const raw = Array.isArray(data) ? (data[0]?.generated_text || '') : (data?.generated_text || data?.[0]?.generated_text || '');
      llm = String(raw).split('\n').map(s=>s.replace(/^[-•\s]+/,'').trim()).filter(Boolean);
    } catch (e) {
      // logs
    }
  }

  const out = [...new Set([...base, ...llm])].slice(0,10);
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
};
