(function (root) {
  'use strict';

  const TYPE_CONFIG = {
    Gefahrstoff: {
      label: 'Gefahrstoff', short: 'Stoff / Gemisch', accent: '#e87500', law: 'gemäß § 14 GefStoffV und TRGS 555',
      sourceTitle: 'Sicherheitsdatenblatt (SDB)', sourceHelp: 'Aktuelles, textlesbares SDB als PDF/TXT oder relevanten Text einfügen.',
      sections: [
        ['hazard', 'Gefahren für Mensch und Umwelt'],
        ['measure', 'Schutzmaßnahmen und Verhaltensregeln'],
        ['emergency', 'Verhalten im Gefahrfall'],
        ['firstAid', 'Erste Hilfe'],
        ['disposal', 'Sachgerechte Entsorgung']
      ]
    },
    Arbeitsmittel: {
      label: 'Maschine / Arbeitsmittel', short: 'Maschine, Anlage oder Arbeitsverfahren', accent: '#0069b4', law: 'gemäß § 12 BetrSichV und Gefährdungsbeurteilung',
      sourceTitle: 'Herstellerinformation / Gefährdungsbeurteilung', sourceHelp: 'Betriebsanleitung, GBU-Auszug oder bekannte Gefährdungen als Text einfügen.',
      sections: [
        ['scope', 'Anwendungsbereich'],
        ['hazard', 'Gefahren für Mensch und Umwelt'],
        ['measure', 'Schutzmaßnahmen und Verhaltensregeln'],
        ['emergency', 'Verhalten bei Störungen'],
        ['firstAid', 'Verhalten bei Unfällen – Erste Hilfe'],
        ['maintenance', 'Instandhaltung und Entsorgung'],
        ['consequences', 'Folgen der Nichtbeachtung']
      ]
    },
    PSA: {
      label: 'Persönliche Schutzausrüstung (PSA)', short: 'Benutzung, Pflege und Grenzen', accent: '#2f7d32', law: 'gemäß § 3 PSA-BV, Gefährdungsbeurteilung und Herstellerinformation',
      sourceTitle: 'Herstellerinformation / Gefährdungsbeurteilung', sourceHelp: 'Gebrauchsanleitung, DGUV-Regel oder betriebliche Vorgaben als Text einfügen.',
      sections: [
        ['scope', 'Anwendungsbereich'],
        ['hazard', 'Gefahren bei fehlender oder falscher Benutzung'],
        ['measure', 'Benutzung und Verhaltensregeln'],
        ['emergency', 'Verhalten bei Mängeln oder besonderen Ereignissen'],
        ['firstAid', 'Rettung und Erste Hilfe'],
        ['maintenance', 'Pflege, Aufbewahrung und Prüfung'],
        ['consequences', 'Folgen der Nichtbeachtung']
      ]
    },
    Biostoff: {
      label: 'Biostoff', short: 'Gezielte oder nicht gezielte Tätigkeit', accent: '#35823a', law: 'gemäß § 14 BioStoffV und Gefährdungsbeurteilung',
      sourceTitle: 'Gefährdungsbeurteilung / Biostoffinformationen', sourceHelp: 'GBU, TRBA-/GESTIS-Informationen oder bekannte Expositionen als Text einfügen.',
      sections: [
        ['scope', 'Arbeitsbereich, Tätigkeit und maßgebliche Biostoffe'],
        ['hazard', 'Gefahren für die Gesundheit'],
        ['measure', 'Schutzmaßnahmen und Hygieneregeln'],
        ['emergency', 'Verhalten im Gefahrfall'],
        ['firstAid', 'Erste Hilfe und Expositionsereignisse'],
        ['disposal', 'Dekontamination und sachgerechte Entsorgung'],
        ['info', 'Weitere Informationen']
      ]
    }
  };

  const GHS = {
    GHS01: ['Explodierende Bombe', 'Explosiv', 'assets/bghm/ghs/GHS_01_gr.gif'],
    GHS02: ['Flamme', 'Entzündbar', 'assets/bghm/ghs/GHS_02_gr.gif'],
    GHS03: ['Flamme über Kreis', 'Oxidierend', 'assets/bghm/ghs/GHS_03_gr.gif'],
    GHS04: ['Gasflasche', 'Gase unter Druck', 'assets/bghm/ghs/GHS_04_gr.gif'],
    GHS05: ['Ätzwirkung', 'Ätzend', 'assets/bghm/ghs/GHS_05_gr.gif'],
    GHS06: ['Totenkopf mit gekreuzten Knochen', 'Akut toxisch', 'assets/bghm/ghs/GHS_06_gr.gif'],
    GHS07: ['Ausrufezeichen', 'Reizend / gesundheitsschädlich', 'assets/bghm/ghs/GHS_07_gr.gif'],
    GHS08: ['Gesundheitsgefahr', 'Schwere Gesundheitsgefahr', 'assets/bghm/ghs/GHS_08_gr.gif'],
    GHS09: ['Umwelt', 'Gewässergefährdend', 'assets/bghm/ghs/GHS_09_gr.gif']
  };

  const SIGNS = {
    M003: ['Gebot', 'Gehörschutz benutzen', 'assets/bghm/signs/M003.jpg'],
    M004: ['Gebot', 'Augenschutz benutzen', 'assets/bghm/signs/M004.jpg'], M008: ['Gebot', 'Fußschutz benutzen', 'assets/bghm/signs/M008.jpg'],
    M009: ['Gebot', 'Handschutz benutzen', 'assets/bghm/signs/M009.jpg'], M010: ['Gebot', 'Schutzkleidung benutzen', 'assets/bghm/signs/M010.jpg'],
    M013: ['Gebot', 'Gesichtsschutz benutzen', 'assets/bghm/signs/M013.jpg'], M014: ['Gebot', 'Kopfschutz benutzen', 'assets/bghm/signs/M014.jpg'],
    M017: ['Gebot', 'Atemschutz benutzen', 'assets/bghm/signs/M017.jpg'], M018: ['Gebot', 'Auffanggurt benutzen', 'assets/bghm/signs/M018.jpg'],
    M021: ['Gebot', 'Vor Wartung oder Reparatur freischalten', 'assets/bghm/signs/M021.jpg'], M022: ['Gebot', 'Hautschutzmittel benutzen', 'assets/bghm/signs/M022.jpg'],
    W009: ['Warnung', 'Warnung vor Biogefährdung', 'assets/bghm/signs/W009.jpg'], W011: ['Warnung', 'Warnung vor Rutschgefahr', 'assets/bghm/signs/W011.jpg'],
    W012: ['Warnung', 'Warnung vor elektrischer Spannung', 'assets/bghm/signs/W012.jpg'], W014: ['Warnung', 'Warnung vor Flurförderzeugen', 'assets/bghm/signs/W014.jpg'],
    W019: ['Warnung', 'Warnung vor Quetschgefahr', 'assets/bghm/signs/W019.jpg'], W021: ['Warnung', 'Warnung vor feuergefährlichen Stoffen', 'assets/bghm/signs/W021.jpg'],
    W023: ['Warnung', 'Warnung vor ätzenden Stoffen', 'assets/bghm/signs/W023.jpg'], W024: ['Warnung', 'Warnung vor Handverletzungen', 'assets/bghm/signs/W024.jpg'],
    P002: ['Verbot', 'Rauchen verboten', 'assets/bghm/signs/P002.jpg'], P003: ['Verbot', 'Keine offene Flamme; Feuer, offene Zündquelle und Rauchen verboten', 'assets/bghm/signs/P003.jpg'],
    P022: ['Verbot', 'Essen und Trinken verboten', 'assets/bghm/signs/P022.jpg'], P028: ['Verbot', 'Benutzen von Handschuhen verboten', 'assets/bghm/signs/P028.jpg'],
    E003: ['Rettung', 'Erste Hilfe', 'assets/bghm/signs/E003.jpg'], E004: ['Rettung', 'Notruftelefon', 'assets/bghm/signs/E004.jpg'],
    E011: ['Rettung', 'Augenspüleinrichtung', 'assets/bghm/signs/E011.jpg'], E012: ['Rettung', 'Notdusche', 'assets/bghm/signs/E012.jpg']
  };

  const BASE = {
    Gefahrstoff: {
      hazard: [
        'Gefährliche Eigenschaften und Aufnahmewege anhand von Abschnitt 2 des aktuellen Sicherheitsdatenblatts konkret benennen.',
        'Dämpfe, Aerosole oder Stäube können beim Einatmen die Gesundheit beeinträchtigen.',
        'Haut- und Augenkontakt kann zu Reizungen oder Schädigungen führen.',
        'Bei unsachgemäßer Verwendung kann der Stoff Boden, Kanalisation oder Gewässer verunreinigen.',
        'Verschüttetes Produkt kann eine Rutsch- oder Sturzgefahr verursachen.'
      ],
      measure: [
        'Nur für den festgelegten Verwendungszweck und nach den betrieblichen Vorgaben einsetzen.',
        'Haut- und Augenkontakt sowie das Einatmen von Dämpfen, Aerosolen oder Stäuben vermeiden.',
        'Vorgeschriebene persönliche Schutzausrüstung gemäß Abschnitt 8 des Sicherheitsdatenblatts benutzen.',
        'Am Arbeitsplatz nicht essen, trinken oder rauchen; vor Pausen und nach Arbeitsende Hände reinigen.',
        'Gebinde geschlossen halten, eindeutig kennzeichnen und nicht in Lebensmittelbehälter umfüllen.'
      ],
      emergency: [
        'Tätigkeit stoppen, Gefahrenbereich sichern und die verantwortliche Person informieren.',
        'Unbeteiligte fernhalten und verschüttetes Material nicht betreten oder verteilen.',
        'Nur die im Sicherheitsdatenblatt genannten Lösch- und Aufnahmemittel verwenden.',
        'Freisetzung in Kanalisation, Boden und Gewässer verhindern; Abläufe erforderlichenfalls abdecken.',
        'Größere oder nicht sicher beherrschbare Freisetzungen nach betrieblichem Alarmplan melden.'
      ],
      firstAid: [
        'Eigenschutz beachten, Ersthelfende verständigen und Sicherheitsdatenblatt bereithalten.',
        'Nach Einatmen die betroffene Person an die frische Luft bringen und ruhig lagern.',
        'Nach Hautkontakt kontaminierte Kleidung entfernen und Haut mit viel Wasser reinigen.',
        'Nach Augenkontakt sofort mehrere Minuten mit Wasser spülen; vorhandene Kontaktlinsen nach Möglichkeit entfernen.',
        'Bei Beschwerden, Verletzungen oder unklarer Exposition ärztliche Hilfe veranlassen; im Notfall 112 wählen.'
      ],
      disposal: [
        'Produktreste und verunreinigte Materialien getrennt in gekennzeichneten, geeigneten Behältern sammeln.',
        'Nicht in Ausguss, Kanalisation, Boden oder Gewässer gelangen lassen.',
        'Abfälle nach Abschnitt 13 des Sicherheitsdatenblatts und dem betrieblichen Entsorgungskonzept entsorgen.',
        'Leere Gebinde nicht für andere Zwecke verwenden und nur vollständig restentleert dem vorgesehenen Entsorgungsweg zuführen.',
        'Verunreinigtes Aufnahmemittel wie Produktabfall behandeln und der zuständigen Sammelstelle übergeben.'
      ]
    },
    Arbeitsmittel: {
      scope: ['Diese Betriebsanweisung gilt für die bezeichnete Maschine beziehungsweise das Arbeitsmittel im angegebenen Arbeitsbereich.','Sie gilt für Bedienung, Rüsten und betriebsübliche Reinigung im beschriebenen Umfang.','Hersteller-Betriebsanleitung und Gefährdungsbeurteilung sind ergänzend zu beachten.','Nur beauftragte und unterwiesene Beschäftigte dürfen das Arbeitsmittel benutzen.','Für Instandhaltung oder besondere Störungsbeseitigung gelten erforderlichenfalls separate Freigaben und Anweisungen.'],
      hazard: ['Quetsch-, Scher-, Einzugs- oder Stoßgefahr durch bewegte Teile und unkontrollierte Bewegungen.','Verletzungsgefahr durch wegfliegende Werkstücke, Bruchstücke oder herabfallende Gegenstände.','Gefährdung durch elektrische, pneumatische, hydraulische oder gespeicherte Energie.','Schnitt-, Stich- oder Verbrennungsgefahr an Werkzeugen, Kanten oder heißen Oberflächen.','Lärm, Vibrationen, ergonomische Belastungen oder Gefahrstoffe können die Gesundheit beeinträchtigen.'],
      measure: ['Vor Arbeitsbeginn Sicht- und Funktionskontrolle durchführen; erkennbare Mängel sofort melden.','Schutzeinrichtungen, Verriegelungen und Not-Halt-Einrichtungen niemals entfernen, überbrücken oder unwirksam machen.','Nur bestimmungsgemäßes, geeignetes Werkzeug und die festgelegte persönliche Schutzausrüstung verwenden.','Arbeitsbereich geordnet halten und unbefugte Personen aus dem Gefahrenbereich fernhalten.','Bei Eingriffen in den Gefahrenbereich Energiezufuhr abschalten, gegen Wiedereinschalten sichern und Stillstand abwarten.'],
      emergency: ['Bei Störung Arbeit sofort stoppen und Arbeitsmittel sicher stillsetzen.','Not-Halt betätigen, wenn eine unmittelbare Gefahr für Personen oder Anlage besteht.','Energiequellen absperren und gegen unbeabsichtigtes Wiederanlaufen sichern.','Störung nur im festgelegten Umfang und durch hierzu befugte Personen beseitigen.','Defektes Arbeitsmittel kennzeichnen, der Benutzung entziehen und verantwortliche Person informieren.'],
      firstAid: ['Maschine oder Arbeitsmittel sicher stillsetzen und Unfallstelle sichern.','Erste Hilfe leisten und Ersthelfende verständigen.','Bei schweren Verletzungen oder unklarer Lage Notruf 112 absetzen.','Verletzte nur aus akuter Gefahr retten; bei Rettung Eigenschutz beachten.','Unfall beziehungsweise Beinaheereignis unverzüglich melden und betrieblich dokumentieren.'],
      maintenance: ['Reinigung, Wartung und Instandsetzung nur bei sicher stillgesetztem Arbeitsmittel durchführen.','Alle Energiearten trennen, gespeicherte Energie abbauen und Freischaltung prüfen.','Instandhaltung nur durch beauftragte und dafür qualifizierte Personen durchführen lassen.','Nach Arbeiten Schutzeinrichtungen vollständig montieren und sichere Funktion prüfen.','Betriebsstoffe, Späne und verschlissene Teile in den vorgesehenen Behältern entsorgen.'],
      consequences: ['Nichtbeachtung kann zu schweren oder tödlichen Verletzungen führen.','Manipulierte Schutzeinrichtungen können unkontrollierte Gefahr bringende Bewegungen auslösen.','Unsachgemäße Bedienung kann Maschine, Werkstück und betriebliche Einrichtungen beschädigen.','Mängel oder Beinaheereignisse können sich bei weiterer Benutzung zu Unfällen entwickeln.','Verstöße gegen diese Betriebsanweisung sind unverzüglich der verantwortlichen Person zu melden.']
    },
    PSA: {
      scope: ['Diese Betriebsanweisung gilt für die bezeichnete persönliche Schutzausrüstung im festgelegten Arbeitsbereich.','Die PSA ist bei den in der Gefährdungsbeurteilung festgelegten Tätigkeiten zu benutzen.','Herstellerinformation, Kennzeichnung und festgelegte Einsatzgrenzen sind zu beachten.','Die PSA ist grundsätzlich für die persönliche Benutzung bestimmt.','Bei kombinierter PSA muss die Schutzwirkung aller Komponenten erhalten bleiben.'],
      hazard: ['Fehlende oder ungeeignete PSA kann zu schweren oder tödlichen Verletzungen führen.','Falsches Anlegen kann die vorgesehene Schutzwirkung erheblich reduzieren.','Beschädigte, gealterte oder verschmutzte PSA kann ohne sichtbare Vorwarnung versagen.','Ungeeignete Kombinationen mehrerer PSA können sich gegenseitig in ihrer Wirkung beeinträchtigen.','Überschrittene Einsatzgrenzen können zu Exposition, Absturz, Gehörschäden oder anderen Gesundheitsschäden führen.'],
      measure: ['Vor jeder Benutzung Zustand, Kennzeichnung, Passform und Vollständigkeit prüfen.','PSA nach Herstellerinformation korrekt anlegen, einstellen und während der gesamten Gefährdungsdauer tragen.','Nur freigegebene Komponenten kombinieren; keine eigenmächtigen Änderungen vornehmen.','Persönliche Einsatzgrenzen, Tragezeitbegrenzungen und arbeitsmedizinische Vorgaben beachten.','Nach Gebrauch PSA ablegen, ohne sich oder saubere Bereiche zu kontaminieren.'],
      emergency: ['Bei Beschädigung oder Funktionsstörung Gefahrenbereich sofort sicher verlassen.','Defekte PSA deutlich kennzeichnen, aussondern und verantwortliche Person informieren.','Nach außergewöhnlicher Beanspruchung PSA bis zur fachkundigen Prüfung nicht weiterverwenden.','Bei Kontamination festgelegte Dekontaminations- und Entsorgungsmaßnahmen anwenden.','Bei erforderlicher Rettung ausschließlich den festgelegten Rettungsplan und die vorgesehene Ausrüstung nutzen.'],
      firstAid: ['Eigenschutz und sicheren Zugang zur betroffenen Person gewährleisten.','Betriebliches Rettungsverfahren auslösen und Ersthelfende verständigen.','Bei schwerer Verletzung, Atemnot oder Bewusstlosigkeit sofort Notruf 112 absetzen.','Kontaminierte PSA nur unter Beachtung des Selbstschutzes entfernen.','Ereignis, verwendete PSA und festgestellte Mängel für die weitere Untersuchung dokumentieren.'],
      maintenance: ['PSA nach Herstellerangaben reinigen, trocknen und hygienisch aufbewahren.','Vor Sonne, Hitze, Feuchtigkeit, Chemikalien und mechanischer Beschädigung geschützt lagern.','Prüf- und Austauschfristen einhalten und erforderliche Prüfungen dokumentieren.','Reparaturen nur vom Hersteller oder einer autorisierten Stelle durchführen lassen.','Ausgesonderte oder kontaminierte PSA gegen Wiederverwendung sichern und sachgerecht entsorgen.'],
      consequences: ['Nichtbenutzung kann die unmittelbare Exposition gegenüber der ermittelten Gefährdung verursachen.','Falsche Auswahl oder Passform kann die Schutzwirkung aufheben.','Nicht erkannte Schäden können zum plötzlichen Versagen der PSA führen.','Fehlende Pflege kann Hygieneprobleme, Materialalterung und Funktionsverlust verursachen.','Abweichungen sind vor Fortsetzung der Tätigkeit mit der verantwortlichen Person zu klären.']
    },
    Biostoff: {
      scope: ['Diese Betriebsanweisung gilt für die beschriebene gezielte oder nicht gezielte Tätigkeit mit Biostoffen.','Arbeitsbereich, Tätigkeit und mögliche Biostoffexposition sind eindeutig abzugrenzen.','Risikogruppe und Schutzstufe sind gemäß Gefährdungsbeurteilung zu berücksichtigen.','Nur unterwiesene und erforderlichenfalls besonders qualifizierte Beschäftigte dürfen die Tätigkeit ausführen.','Zusätzliche Vorgaben aus einschlägigen TRBA und Hygieneplänen sind zu beachten.'],
      hazard: ['Biostoffe können Infektionen, sensibilisierende oder toxische Wirkungen verursachen.','Eine Aufnahme kann über Atemwege, Mund, Schleimhäute oder verletzte Haut erfolgen.','Stich-, Schnitt- oder Spritzereignisse können zu einer erhöhten Exposition führen.','Kontaminierte Oberflächen, Werkzeuge, Wäsche oder Abfälle können Biostoffe übertragen.','Aerosolbildung kann Biostoffe im Arbeitsbereich verteilen und Dritte gefährden.'],
      measure: ['Hygieneplan, Händehygiene und festgelegte Schutzstufenmaßnahmen konsequent einhalten.','Hautverletzungen vor Arbeitsbeginn flüssigkeitsdicht abdecken.','Vorgeschriebene PSA anlegen und kontaminierte Bereiche nicht mit sauberer PSA oder Arbeitskleidung verlassen.','Aerosol-, Spritzer- sowie Stich- und Schnittgefahren durch festgelegte Arbeitsverfahren minimieren.','Essen, Trinken, Rauchen, Schminken und Aufbewahren von Lebensmitteln im Arbeitsbereich unterlassen.'],
      emergency: ['Tätigkeit stoppen, kontaminierten Bereich sichern und verantwortliche Person informieren.','Verschüttetes oder freigesetztes Material nach Hygiene- und Desinfektionsplan aufnehmen.','Aerosolbildung vermeiden und nur festgelegte Desinfektionsmittel mit vorgeschriebener Einwirkzeit verwenden.','Kontaminierte Kleidung oder PSA kontrolliert ablegen und der Aufbereitung oder Entsorgung zuführen.','Unbeabsichtigte Exposition unverzüglich nach betrieblichem Meldeweg anzeigen.'],
      firstAid: ['Wunden sofort zur Blutung anregen, mit Wasser spülen und fachgerecht desinfizieren.','Kontaminierte Haut gründlich reinigen; Augen oder Schleimhäute sofort mit Wasser spülen.','Ersthelfende und verantwortliche Person informieren.','Nach relevanter Exposition unverzüglich Betriebsarzt oder ärztliche Stelle aufsuchen und Impfstatus bereithalten.','Expositionsereignis dokumentieren; erforderlichenfalls Unfallanzeige und Nachsorge veranlassen.'],
      disposal: ['Kontaminierte Materialien in geeigneten, gekennzeichneten und verschließbaren Behältern sammeln.','Abfälle nicht umfüllen, sortieren oder verdichten, wenn dadurch eine Exposition entstehen kann.','Flächen und Arbeitsmittel mit dem festgelegten Verfahren und der vorgeschriebenen Einwirkzeit dekontaminieren.','Mehrwegmaterial nur nach validierter Aufbereitung erneut verwenden.','Abfall- und Transportweg gemäß Hygieneplan, Schutzstufe und betrieblichen Vorgaben einhalten.'],
      info: ['Betriebliche Ansprechperson und arbeitsmedizinische Kontaktstelle benennen.','Erforderliche Impfangebote und arbeitsmedizinische Vorsorge gemäß Gefährdungsbeurteilung beachten.','Unterweisung vor Aufnahme der Tätigkeit und danach mindestens jährlich dokumentieren.','Betriebsanweisung bei maßgeblichen Änderungen der Arbeitsbedingungen aktualisieren.','Hygieneplan, Hautschutzplan und Notfallkontakte am Arbeitsplatz zugänglich halten.']
    }
  };

  const GHS_RULES = {
    GHS01:{hazard:['Explosionsgefahr durch Schlag, Reibung, Feuer, Wärme oder andere Zündquellen.'],measure:['Von Hitze, Funken, offenen Flammen, Erschütterung und Reibung fernhalten.'],emergency:['Bei Brand- oder Explosionsgefahr Bereich sofort räumen und betrieblichen Alarmplan auslösen.']},
    GHS02:{hazard:['Entzündbarer Stoff; Dämpfe können mit Luft explosionsfähige Gemische bilden.'],measure:['Von Hitze, heißen Oberflächen, Funken und offenen Flammen fernhalten; nicht rauchen.'],emergency:['Zündquellen beseitigen, Bereich lüften und nur das im SDB genannte Löschmittel verwenden.']},
    GHS03:{hazard:['Brandfördernder Stoff; kann einen Brand verursachen oder verstärken.'],measure:['Von Kleidung, brennbaren Stoffen und unverträglichen Stoffen getrennt halten.'],disposal:['Nicht mit brennbaren Abfällen vermischen; getrennt sammeln.']},
    GHS04:{hazard:['Gas unter Druck; Erwärmung kann Bersten verursachen, tiefgekühltes Gas kann Kälteverletzungen hervorrufen.'],measure:['Druckbehälter gegen Umfallen sichern, vor Wärme schützen und nur mit geeigneter Armatur verwenden.'],emergency:['Bei Undichtigkeit Ventil nur gefahrlos schließen, Bereich lüften und gegen Zutritt sichern.']},
    GHS05:{hazard:['Schwere Verätzungen der Haut und schwere Augenschäden sind möglich.'],measure:['Chemikalienbeständige Handschuhe sowie dicht schließenden Augen- oder Gesichtsschutz gemäß SDB tragen.'],firstAid:['Bei Augen- oder Hautkontakt sofort mit viel Wasser spülen und unverzüglich ärztliche Hilfe veranlassen.']},
    GHS06:{hazard:['Akut giftig; bereits kleine Mengen können lebensgefährlich sein.'],measure:['Exposition strikt vermeiden; nur im festgelegten geschlossenen Verfahren oder unter wirksamer Absaugung arbeiten.'],emergency:['Gefahrenbereich sofort räumen; Rettung nur durch geschulte Personen mit geeigneter PSA.']},
    GHS07:{hazard:['Der Stoff kann Haut, Augen oder Atemwege reizen beziehungsweise gesundheitsschädlich wirken.'],measure:['Kontakt und Einatmen vermeiden; für wirksame Lüftung sorgen.'],firstAid:['Bei anhaltender Reizung oder Unwohlsein ärztlichen Rat einholen.']},
    GHS08:{hazard:['Schwere oder langfristige Gesundheitsschäden können auftreten.'],measure:['Exposition durch geschlossene Verfahren oder wirksame Absaugung minimieren.'],firstAid:['Nach möglicher Exposition oder bei Beschwerden ärztlichen Rat einholen und SDB bereithalten.']},
    GHS09:{hazard:['Der Stoff kann Wasserorganismen schädigen und längerfristige Umweltwirkungen verursachen.'],measure:['Freisetzung in Boden, Gewässer und Kanalisation verhindern.'],emergency:['Leckage eindämmen und Kanalisation abdecken.'],disposal:['Stoff, Spülwasser und Aufnahmematerial getrennt sammeln.']}
  };

  const H_TO_GHS = {
    GHS01:/\bH(?:200|201|202|203|204|205|240)\b/i, GHS02:/\bH(?:220|221|222|223|224|225|226|228|241|242|250|251|252|260|261)\b/i,
    GHS03:/\bH(?:270|271|272)\b/i, GHS04:/\bH(?:280|281)\b/i, GHS05:/\bH(?:290|314|318)\b/i,
    GHS06:/\bH(?:300|301|310|311|330|331)\b/i, GHS07:/\bH(?:302|312|315|317|319|332|335|336)\b/i,
    GHS08:/\bH(?:304|334|340|341|350|351|360|361|362|370|371|372|373)\b/i, GHS09:/\bH(?:400|410|411|412|413)\b/i
  };

  const PURPOSE_RULES = [
    {match:/\b(öl|oel|schmier|hydraulik|kühlschmier|fett)\b/i, add:{hazard:['Ausgetretenes Öl erzeugt eine erhebliche Rutschgefahr und kann Boden oder Gewässer verunreinigen.'],measure:['Gebinde und ölführende Verbindungen dicht halten; Auffangmöglichkeit und geeignetes Bindemittel bereithalten.'],emergency:['Ausgetretenes Öl sofort mit geeignetem Bindemittel aufnehmen, Rutschbereich kennzeichnen und gegen Betreten sichern.'],disposal:['Ölgetränktes Bindemittel, Tücher und Produktreste in dafür vorgesehenen verschließbaren Behältern sammeln.']}},
    {match:/\b(reinig|desinf|schaumrein|alkal|säure|saeure)\b/i, add:{hazard:['Beim Dosieren und Versprühen besteht erhöhte Spritz- und Aerosolgefahr.'],measure:['Reinigungs- und Desinfektionsmittel niemals unkontrolliert mischen; Dosier- und Anwendungsvorgaben einhalten.'],emergency:['Bei Fehlmischung Bereich verlassen, Alarmierung auslösen und keine eigenständige Neutralisation durchführen.'],firstAid:['Bei Spritzern sofort Augen- beziehungsweise Notdusche benutzen und kontaminierte Kleidung ausziehen.']}},
    {match:/\b(lösemittel|loesemittel|verdünn|klebstoff|lack|farbe|aceton|ethanol|isoprop)\b/i, add:{hazard:['Dämpfe können sich bodennah ausbreiten und an entfernten Zündquellen entzünden.'],measure:['Nur bei wirksamer Lüftung verwenden; Gebinde nach Entnahme sofort schließen und Zündquellen ausschließen.'],emergency:['Verschüttetes Material mit nicht brennbarem Aufnahmemittel aufnehmen und Bereich wirksam lüften.']}},
    {match:/\b(gasflasche|druckgas|stickstoff|ammoniak|kältemittel|kaeltemittel)\b/i, add:{hazard:['Austretendes Gas kann Sauerstoff verdrängen oder gesundheitsschädliche Konzentrationen bilden.'],measure:['Gasbehälter gegen Umfallen sichern; Anschlüsse auf Dichtheit prüfen und für ausreichende Lüftung sorgen.'],emergency:['Bei Gasalarm oder wahrnehmbarer Leckage Bereich sofort verlassen, Zutritt verhindern und betrieblichen Alarmplan auslösen.']}},
    {match:/\b(bohr|drehmaschine|säge|saege|fräs|fraes|rotierend)\b/i, types:['Arbeitsmittel'], add:{hazard:['Rotierende Werkzeuge können Haare, Kleidung oder Schmuck erfassen und einziehen.'],measure:['Lange Haare sichern, Schmuck ablegen und an rotierenden Teilen keine Handschuhe tragen.'],emergency:['Bei Werkzeugbruch, Festsetzen oder ungewöhnlichen Geräuschen Maschine sofort stillsetzen.']}},
    {match:/\b(förderband|foerderband|bandanlage|rollenbahn)\b/i, types:['Arbeitsmittel'], add:{hazard:['An Umlenkungen, Rollen und Übergaben bestehen Einzugs-, Quetsch- und Schergefahren.'],measure:['Niemals über laufende Fördertechnik steigen oder in laufende Übergabestellen greifen.'],emergency:['Verklemmungen nur nach Stillsetzen, Freischalten und Sichern gegen Wiedereinschalten beseitigen.']}},
    {match:/\b(stapler|flurförder|hubwagen)\b/i, types:['Arbeitsmittel'], add:{hazard:['Anfahren von Personen, Umsturz und herabfallende Lasten können schwere Verletzungen verursachen.'],measure:['Nur mit Beauftragung und erforderlicher Qualifikation fahren; Verkehrswege und Geschwindigkeitsregeln einhalten.'],emergency:['Bei sicherheitsrelevanten Mängeln Fahrzeug stillsetzen, Schlüssel abziehen und kennzeichnen.']}},
    {match:/\b(leiter|tritt)\b/i, types:['Arbeitsmittel'], add:{hazard:['Absturz durch ungeeignete Aufstellung, Übersteigen oder Verlust des sicheren Halts.'],measure:['Vor Benutzung Zustand und Aufstellung prüfen; drei Kontaktpunkte halten und nicht seitlich hinauslehnen.'],emergency:['Beschädigte Leiter sofort der Benutzung entziehen und kennzeichnen.']}},
    {match:/\b(gehör|gehoer|kapsel|ohrstöpsel|ohrstoepsel)\b/i, types:['PSA'], add:{hazard:['Unzureichender Schutz kann zu bleibender, nicht heilbarer Lärmschwerhörigkeit führen.'],measure:['Gehörschutz vor Betreten des Lärmbereichs korrekt einsetzen und lückenlos tragen.'],maintenance:['Wiederverwendbaren Gehörschutz hygienisch reinigen und Dichtkissen beziehungsweise Stöpsel rechtzeitig ersetzen.']}},
    {match:/\b(atemschutz|filtermaske|halbmaske|vollmaske)\b/i, types:['PSA'], add:{hazard:['Falscher Filter oder unzureichender Dichtsitz kann zu gefährlicher Schadstoffaufnahme führen.'],measure:['Dichtsitzkontrolle vor jeder Benutzung durchführen; Bart im Dichtbereich ist unzulässig.'],emergency:['Bei Geruchs- oder Geschmackswahrnehmung, Atemwiderstand oder Unwohlsein Gefahrenbereich sofort verlassen.']}},
    {match:/\b(absturz|auffanggurt|psaga|höhenarbeit|hoehenarbeit)\b/i, types:['PSA'], add:{hazard:['Ein Sturz in das Auffangsystem kann zu Hängetrauma und schweren Verletzungen führen.'],measure:['Nur geprüfte, freigegebene Anschlagpunkte und kompatible Systemkomponenten benutzen.'],firstAid:['Rettung unverzüglich nach dem vor Arbeitsbeginn festgelegten Rettungskonzept durchführen.']}},
    {match:/\b(blut|kanüle|kanuele|nadel|körperflüss|koerperfluess)\b/i, types:['Biostoff'], add:{hazard:['Stich- oder Schnittverletzungen können blutübertragbare Krankheitserreger übertragen.'],measure:['Sichere Instrumente verwenden; Kanülen nicht in Schutzkappen zurückstecken.'],firstAid:['Nach Stich- oder Schnittverletzung unverzüglich betriebsärztliche Abklärung und Postexpositionsmaßnahmen veranlassen.']}},
    {match:/\b(abfall|fäkal|faekal|abwasser|schimmel|tier|lebensmittel|reinigung)\b/i, types:['Biostoff'], add:{hazard:['Unbekannte Mischpopulationen von Mikroorganismen können über Aerosole, Kontakt oder Verletzungen aufgenommen werden.'],measure:['Aerosolarme Arbeitsweise und konsequente Trennung von kontaminierten und sauberen Bereichen einhalten.'],disposal:['Kontaminierte Abfälle ohne Umfüllen oder Nachsortieren im festgelegten geschlossenen System entsorgen.']}}
  ];

  function unique(values) { return [...new Set((values || []).map(v => String(v).trim()).filter(Boolean))]; }
  function emptySelected(type) { return Object.fromEntries(TYPE_CONFIG[type].sections.map(([key]) => [key, []])); }
  function baseSuggestions(type) { return Object.fromEntries(TYPE_CONFIG[type].sections.map(([key]) => [key, [...(BASE[type][key] || [])]])); }

  function parseSdb(text) {
    const raw = String(text || '').replace(/\u00ad/g, '').replace(/[\t\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw.length < 40) return {ok:false, codes:[], pictograms:[], signalWord:'', suggestions:{}};
    const codes = unique((raw.match(/\b(?:EUH|H|P)\s?\d{3}[A-Za-z]?(?:\s?\+\s?P?\d{3})*/gi) || []).map(x => x.replace(/\s/g, '').toUpperCase()));
    const explicit = (raw.match(/\bGHS\s?0[1-9]\b/gi) || []).map(x => x.replace(/\s/g, '').toUpperCase());
    const inferred = Object.entries(H_TO_GHS).filter(([, pattern]) => pattern.test(raw)).map(([key]) => key);
    const pictograms = unique([...explicit, ...inferred]);
    const signalWord = (raw.match(/Signalwort\s*:?\s*(Gefahr|Achtung)/i) || [])[1] || '';
    const suggestions = {};
    const sentences = raw.split(/(?<=[.!?;])\s+|(?=\b(?:EUH|H|P)\s?\d{3})/).filter(s => /\b(?:EUH|H|P)\s?\d{3}/i.test(s));
    sentences.slice(0, 80).forEach(sentence => {
      const value = sentence.trim().slice(0, 420);
      const code = (value.match(/\b(EUH|H|P)\s?(\d{3})/i) || []);
      if (!code.length) return;
      const prefix = code[1].toUpperCase(), number = Number(code[2]);
      let section = 'measure';
      if (prefix === 'H' || prefix === 'EUH') section = 'hazard';
      else if (number >= 300 && number < 370) section = 'firstAid';
      else if (number >= 370 && number < 400) section = 'emergency';
      else if (number >= 400) section = 'disposal';
      (suggestions[section] ||= []).push(value);
    });
    return {ok:true, codes, pictograms, signalWord, suggestions:Object.fromEntries(Object.entries(suggestions).map(([k,v]) => [k, unique(v)]))};
  }

  function buildSuggestions(type, context, analysis) {
    const out = baseSuggestions(type);
    const haystack = `${context?.asset || ''} ${context?.purpose || ''} ${context?.category || ''} ${context?.sourceText || ''}`;
    PURPOSE_RULES.forEach(rule => {
      if (rule.types && !rule.types.includes(type)) return;
      if (!rule.match.test(haystack)) return;
      Object.entries(rule.add).forEach(([key, values]) => { if (out[key]) out[key].push(...values); });
    });
    if (type === 'Gefahrstoff' && analysis) {
      (analysis.pictograms || []).forEach(code => Object.entries(GHS_RULES[code] || {}).forEach(([key, values]) => { if (out[key]) out[key].push(...values); }));
      Object.entries(analysis.suggestions || {}).forEach(([key, values]) => { if (out[key]) out[key].push(...values); });
    }
    return Object.fromEntries(Object.entries(out).map(([key, values]) => [key, unique(values)]));
  }

  function completeness(type, selected) {
    const missing = TYPE_CONFIG[type].sections.filter(([key]) => !(selected?.[key]?.length)).map(([,title]) => title);
    return {complete:missing.length === 0, missing};
  }

  function demoState() {
    const type = 'Gefahrstoff';
    const suggestions = buildSuggestions(type, {asset:'Aceton (Muster)', purpose:'Entfetten von Metallteilen; kleine Mengen am Arbeitsplatz'}, {pictograms:['GHS02','GHS07'], suggestions:{}});
    const selected = {};
    TYPE_CONFIG[type].sections.forEach(([key]) => { selected[key] = suggestions[key].slice(0, 2); });
    return {type, firm:'Muster GmbH', dept:'Instandhaltung', workplace:'Werkbank 2', asset:'Aceton (Muster – Angaben mit aktuellem SDB prüfen)', purpose:'Entfetten von Metallteilen in kleinen Mengen', author:'Fachkraft für Arbeitssicherheit', responsible:'Verantwortliche Person', date:new Date().toISOString().slice(0,10), baNumber:'BA-GS-001', revision:'1', emergency:'112 / interne Alarmnummer ergänzen', firstAider:'Ersthelfende gemäß Aushang', disposalContact:'Gefahrstoff-Sammelstelle', pictograms:['GHS02','GHS07'], signs:['M004','M009','P003','E011'], signalWord:'Gefahr', sdbCodes:['H225','H319','H336'], selected, custom:{}, sourceText:''};
  }

  const api = {TYPE_CONFIG, GHS, SIGNS, BASE, parseSdb, buildSuggestions, emptySelected, completeness, demoState, unique};
  root.BAEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
