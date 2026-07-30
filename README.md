# BA Studio

Browserbasierter Assistent für Betriebsanweisungen zu **Gefahrstoffen** und **Maschinen/Arbeitsmitteln**. Die Anwendung hilft beim Strukturieren und Formulieren; die fertige Betriebsanweisung muss immer anhand der betrieblichen Gefährdungsbeurteilung fachkundig geprüft und freigegeben werden.

## Funktionen

- Auswahl zwischen Gefahrstoff- und Maschinen-Betriebsanweisung
- lokaler Import textlesbarer Sicherheitsdatenblätter (`.pdf`/`.txt`)
- Erkennung von GHS-Codes (zusätzlich aus eindeutigen H-Codes abgeleitet), Signalwort sowie H-, EUH- und P-Codes
- Darstellung der neun offiziellen GHS/CLP-Piktogramme statt symbolischer Emoji-Platzhalter
- allgemeine, piktogrammbezogene Vorschläge für Gefahren, Maßnahmen, Gefahrfall, Erste Hilfe und Entsorgung
- auswählbare statt ungeprüft automatisch übernommene Sätze
- fachlich getrennte Bereiche für Gefahren, Schutzmaßnahmen, Gefahrfall, Erste Hilfe und Entsorgung/Instandhaltung
- maschinenspezifische Beispielsätze für mehrere häufige Maschinentypen
- typgerechtes Farbschema, A4-Vorschau und Export über „Drucken / PDF“
- Speicherung des Entwurfs ausschließlich im `localStorage` des Browsers

## Lokal starten

Es ist kein Build-Schritt erforderlich:

```bash
python3 -m http.server 4173
```

Danach `http://localhost:4173` öffnen. Für die PDF-Textextraktion lädt der Browser PDF.js von cdnjs. Textdateien und manuell eingefügter Text funktionieren ohne diese externe Abhängigkeit.

## Fachliche Leitplanken

Die Oberfläche orientiert sich an der üblichen Gliederung einer Betriebsanweisung. Bei Gefahrstoffen sind insbesondere die Gefährdungsbeurteilung, § 14 GefStoffV und TRGS 555 maßgeblich. Für Arbeitsmittel sind unter anderem § 12 BetrSichV, die Herstellerinformationen und die konkrete Gefährdungsbeurteilung zu beachten. Sicherheitskennzeichen sind entsprechend ASR A1.3 auszuwählen.

Der Import ist bewusst ein **Vorschlagsmechanismus**: SDB-PDFs sind nicht einheitlich aufgebaut, Scans enthalten häufig keinen maschinenlesbaren Text und Code-Erkennung ersetzt keine inhaltliche Prüfung. Maßgeblich ist stets die aktuelle Fassung des vollständigen SDB, insbesondere die Abschnitte 2, 4–8 und 13, zusammen mit den tatsächlichen betrieblichen Bedingungen.

### Offizielle Grundlagen

- [Gefahrstoffverordnung (GefStoffV)](https://www.gesetze-im-internet.de/gefstoffv_2010/)
- [TRGS 555 „Betriebsanweisung und Information der Beschäftigten“ (BAuA)](https://www.baua.de/DE/Angebote/Regelwerk/TRGS/TRGS-555.html)
- [Betriebssicherheitsverordnung (BetrSichV)](https://www.gesetze-im-internet.de/betrsichv_2015/)
- [ASR A1.3 „Sicherheits- und Gesundheitsschutzkennzeichnung“ (BAuA)](https://www.baua.de/DE/Angebote/Regelwerk/ASR/ASR-A1-3.html)

## Datenschutz und Sicherheit

SDB-Inhalte, Stammdaten und Logo werden nicht an einen eigenen Server übertragen. Der Entwurf wird lokal im Browser gespeichert. Die optionale PDF-Bibliothek wird aktuell von einem CDN geladen; für eine vollständig offline betriebene Installation sollte PDF.js lokal eingebunden und mit einer Content-Security-Policy abgesichert werden.
