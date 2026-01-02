
// functions/ai-suggest.ts
export const onRequestGet = async ({ request, env }) => {
  const u = new URL(request.url);
  const section = u.searchParams.get('section') || '';
  const type    = u.searchParams.get('type')    || '';
  const asset   = u.searchParams.get('asset')   || '';
  const pics    = (u.searchParams.get('pics')||'').split(',').filter(Boolean);

  // Basit, güvenli varsayılan öneriler (en az 3)
  const base: string[] = [];
  if (section==='hazards' && type==='Maschine') base.push('Quetsch-/Scherstellen vermeiden','Elektrische Gefährdungen beachten','Stolper-/Sturzgefahren minimieren');
  if (section==='ppe') base.push('Schutzbrille stets tragen','Gehörschutz im Lärmbereich verwenden','Schnittfeste Handschuhe bei Bedarf');
  if (section==='em') base.push('Not-Halt betätigen und Bereich sichern','Vorgesetzte informieren','Ereignis kurz dokumentieren');

  // Opsiyonel LLM çağrısı
  let llm: string[] = [];
  if (env.AI_API_KEY && env.AI_API_URL) {
    try {
      const prompt =
        `Erzeuge 5 kurze Stichpunkte für "${section}" in einer Betriebsanweisung (Typ=${type}, Asset=${asset}, Piktos=${pics.join(',')}).`+
        ` Nutze ISO 7010/GHS Terminologie; keine langen Sätze; keine Wiederholungen.`;
      const resp = await fetch(env.AI_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json', 'authorization':`Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({ prompt, max_tokens: 160 })
      });
      const data = await resp.json();
      llm = (data?.choices?.[0]?.text || '')
        .split('\n')
        .map((s:string)=>s.replace(/^[-•\s]+/,'').trim())
        .filter((s:string)=>s.length>0);
    } catch {}
  }

  // Birleştir, tekilleştir ve 10’a sınırla
  const out = Array.from(new Set([...base, ...llm])).slice(0,10);
  return new Response(JSON.stringify(out), { headers:{ 'content-type':'application/json' } });
};
