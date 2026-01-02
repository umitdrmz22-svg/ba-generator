
// functions/ai-suggest.ts
export const onRequestGet = async ({ request, env }) => {
  const u = new URL(request.url);
  const section = u.searchParams.get('section') || '';
  const type    = u.searchParams.get('type')    || '';
  const asset   = u.searchParams.get('asset')   || '';
  const pics    = (u.searchParams.get('pics')||'').split(',').filter(Boolean);

  // Basit, güvenli kurallı öneriler (uzun cümleler; her biri tek madde)
  const base: string[] = [];
  if (section==='hazard' && type==='Maschine') {
    base.push(
      "Elektrische Gefährdungen: Vor Arbeitsbeginn alle Zuleitungen und Gehäuse sichtbar prüfen und beschädigte Leitungen sofort außer Betrieb nehmen.",
      "Eingriffe nur durch Elektrofachkräfte oder unter deren Aufsicht durchführen und die fünf Sicherheitsregeln konsequent anwenden.",
      "Nach dem Freischalten die Spannungsfreiheit mit geeignetem Messgerät feststellen und gegen Wiedereinschalten sichern."
    );
  }
  if (section==='tech') {
    base.push(
      "Lockout/Tagout (LOTO) anwenden, Anlage vollständig freischalten und mit persönlichem Schloss sichern.",
      "Gespeicherte Energien (Druck, Feder) abbauen und Nachlaufzeiten beachten, mechanische Verriegelungen einsetzen."
    );
  }
  if (section==='org') {
    base.push(
      "Arbeiten nur mit schriftlicher Freigabe (Erlaubnisschein) durchführen und Abschnittsgrenzen klar kennzeichnen.",
      "Unbefugten Zutritt verhindern und Gefährdungsbereiche abgrenzen, Warnhinweise gemäß ISO 7010 anbringen."
    );
  }
  if (section==='ppe') {
    base.push(
      "Schutzbrille mit Seitenschutz und ggf. Gesichtsschutz gegen Spanflug verwenden.",
      "Gehörschutz bei Lärmexposition über Grenzwert tragen und Wirksamkeit prüfen."
    );
  }
  if (section==='em') {
    base.push(
      "Bei Gefahr sofort Not‑Halt betätigen, Bereich sichern und alle Personen warnen.",
      "Verletzte nur ohne Selbstgefährdung retten und Stromquellen freischalten; bewegte Teile stoppen."
    );
  }
  if (section==='eh') {
    base.push(
      "Schnitt-/Quetschverletzungen blutungsstillend versorgen und verunreinigte Wunden spülen.",
      "Bei Augenkontakt mindestens 15 Minuten spülen und ärztliche Abklärung veranlassen."
    );
  }
  if (section==='dis') {
    base.push(
      "Wartungsabfälle getrennt sammeln und öl-/chemikalienhaltige Abfälle gekennzeichneten Behältern zuführen.",
      "Leckagen mit Bindemittel aufnehmen und kontaminierte Materialien als gefährliche Abfälle entsorgen."
    );
  }

  // Opsiyonel: HuggingFace veya başka LLM ile daha fazla uzun cümle üretimi
  let llm: string[] = [];
  if (env.AI_API_URL && env.AI_API_KEY) {
    try {
      const prompt = `Erzeuge 6 einzelne, lange Stichpunkte (jeweils ein Satz) für Abschnitt "${section}" in einer Betriebsanweisung (Typ=${type}, Asset=${asset}, Piktos=${pics.join(',')}).`;
      const resp = await fetch(env.AI_API_URL, {
        method:'POST',
        headers:{ 'content-type':'application/json', 'authorization':`Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({ inputs: prompt })
      });
      const data = await resp.json();
      const raw = Array.isArray(data) ? (data[0]?.generated_text || '') : (data?.generated_text || data?.[0]?.generated_text || '');
      llm = String(raw).split('\n').map(s=>s.replace(/^[-•\s]+/,'').trim()).filter(Boolean);
    } catch {}
  }

  const out = [...new Set([...base, ...llm])].slice(0, 10);
  return new Response(JSON.stringify(out), { headers:{ 'content-type':'application/json' } });
};
