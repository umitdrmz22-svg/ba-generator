# BA Studio

Browserbasierter Fachassistent für Betriebsanweisungen zu **Gefahrstoffen**, **Maschinen/Arbeitsmitteln/Arbeitsverfahren**, **persönlichen Schutzausrüstungen (PSA)** und **Biostoffen**.

Die Anwendung erzeugt keinen ungeprüften „rechtssicheren“ Automatismus. Sie liest fachliche Grundlagen lokal im Browser, kombiniert diese mit dem konkreten Verwendungszweck und bietet je BA-Abschnitt mindestens fünf auswählbare Formulierungen an. Eigene, fachlich geprüfte Formulierungen können jederzeit ergänzt werden. Die fertige BA ist anhand der betrieblichen Gefährdungsbeurteilung und der aktuellen Primärunterlagen zu prüfen und freizugeben.

## Funktionen

- vier BA-Arten mit DGUV-orientierter Farbgebung: Gefahrstoff orange, Maschine/Arbeitsmittel blau, PSA grün, Biostoff grün
- lokaler Import textlesbarer PDF- und TXT-Dateien
- SDB-Erkennung von Signalwort, H-, EUH- und P-Codes sowie GHS01–GHS09
- manuelle Korrektur der GHS-Auswahl
- auswählbare Sicherheitszeichen nach ASR A1.3 (Gebot, Warnung, Verbot und Rettung)
- verwendungszweckbezogene Zusatzvorschläge, etwa Bindemittel und Rutschsicherung bei Öl
- mindestens fünf Vorschläge pro Abschnitt plus frei formulierbare eigene Einträge
- betriebliche Felder für BA-Nummer, Arbeitsbereich, Arbeitsplatz, Tätigkeit, Revision, Notruf, Ersthelfende und zuständige Stelle
- integrierte Beispiel-BA
- A4-Vorschau und Druck-/PDF-Ausgabe
- Entwurfsspeicherung ausschließlich im lokalen Browser-Speicher

Die lokal eingebundenen GHS-Piktogramme sowie Gebots-, Warn-, Verbots- und Rettungszeichen stammen aus dem offiziellen Downloadbereich der [BGHM Sicherheitszeichen](https://www.bghm.de/arbeitsschuetzer/praxishilfen/sicherheitszeichen/warnzeichen). Dadurch bleiben die Zeichen auch ohne externe Bild-Hosts verfügbar.

## Lokal starten und testen

```bash
node tests/engine.test.js
python3 -m http.server 4173
```

Danach `http://localhost:4173` öffnen. Die PDF-Textextraktion lädt PDF.js bei Bedarf von cdnjs. TXT-Dateien und manuell eingefügter Text funktionieren ohne diese Abhängigkeit.

## Fachliche Grundlagen

- [§ 14 GefStoffV](https://www.gesetze-im-internet.de/gefstoffv_2010/__14.html)
- [TRGS 555 – Betriebsanweisung und Information der Beschäftigten](https://www.baua.de/DE/Angebote/Rechtstexte-und-Technische-Regeln/Regelwerk/TRGS/TRGS-555.html)
- [§ 12 BetrSichV](https://www.gesetze-im-internet.de/betrsichv_2015/__12.html)
- [§ 3 PSA-BV](https://www.gesetze-im-internet.de/psa-bv/__3.html)
- [§ 14 BioStoffV](https://www.gesetze-im-internet.de/biostoffv_2013/__14.html)
- [DGUV Information 211-010 – Sicherheit durch Betriebsanweisungen](https://publikationen.dguv.de/regelwerk/dguv-informationen/339/sicherheit-durch-betriebsanweisungen)
- [DGUV Information 213-016 – Betriebsanweisungen nach der Biostoffverordnung](https://publikationen.dguv.de/regelwerk/dguv-informationen/830/betriebsanweisungen-nach-der-biostoffverordnung)
- [ASR A1.3 – Sicherheits- und Gesundheitsschutzkennzeichnung](https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A1-3.html)

## Datenschutz

SDB-Inhalte, Stammdaten und Logo werden nicht an einen eigenen Server übertragen. Der Entwurf wird im `localStorage` des Browsers gespeichert. Für eine vollständig offline betriebene Installation sollte PDF.js lokal eingebunden und mit einer Content-Security-Policy abgesichert werden.
