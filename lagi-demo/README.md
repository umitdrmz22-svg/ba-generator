# LAGI – GitHub-Pages-Demo

LAGI – Legal · Arbeitsschutz · Gefahrstoffe · Integriertes Management.

Eigenständige Demo unter `lagi-demo/` im vorhandenen Repository `umitdrmz22-svg/ba-generator`. Die bestehenden produktiven Module werden nicht überschrieben.

Enthalten sind die sieben Module Gefahrstoffkataster, BA Studio, DMS Studio, Unfall & Maßnahmen, Brandschutzordnung, Fluchtplan Studio und Rechtskataster. Alle Module haben eine gemeinsame Navigation, Erklärungen, direkte Einstiege und Rückwege. Das festgelegte LAGI-Logo bleibt unverändert.

Die Angaben sind fiktiv. Änderungen werden nur im lokalen Browser gespeichert. Es gibt keine externen Skripte oder Cloud-Verarbeitung der Demo-Eingaben. Die Demo dient nicht als Nachweis der Rechtskonformität.

## Veröffentlichung

Die öffentliche Veröffentlichung dieser fiktiven Demo auf GitHub Pages wurde am 03.10.2026 ausdrücklich freigegeben. Vorgesehene Adresse: https://umitdrmz22-svg.github.io/ba-generator/lagi-demo/. Die bestehende private Site bleibt unverändert.

Keine neuen Workflows, keine Änderungen an CI, mobilen Builds oder Datenbankkonfigurationen. Es werden nur die Dateien in diesem Ordner und der zugehörige Interaktionstest in den aktuellen GitHub-Quellstand übernommen.

## Prüfung

`node --check lagi-demo/assets/app.js`

`node --check lagi-demo/assets/data.js`

`node tests/lagi-demo-interactions.cjs`

Die Prüfung umfasst 13 Interaktionsgruppen im JavaScript-/DOM-Testadapter. Eine visuelle Browserprüfung ist nicht erfolgt.
