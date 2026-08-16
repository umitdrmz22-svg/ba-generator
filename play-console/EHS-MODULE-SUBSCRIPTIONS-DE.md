# DefiDev EHS — Google Play Abonnements

Stand: 16.08.2026

## Geschäftsmodell

- Eine Android-App: **DefiDev EHS**
- Package: `com.defidev.ehs`
- Keine Werbung / kein AdMob
- Jedes EHS-Modul wird **separat** monatlich abonniert.
- Deutschland-Startpreis: **4,99 EUR je Modul / Monat**
- Kein kostenloser Probezeitraum zum Start.
- Kein neues All-Access-Abo. `ehs_pro_monthly` bleibt ausschließlich als technisches Legacy-Entitlement erhalten und wird nicht für neue Käufe angeboten.

## In Play Console anzulegende Subscription-Produkte

| Modul | Subscription Product ID | Titel | Base plan ID | Billing period | Renewal | DE-Preis |
|---|---|---|---|---|---|---:|
| BA Studio | `ehs_ba_monthly` | BA Studio – Monatsabo | `monthly` | Monthly | Auto-renewing | 4,99 EUR |
| Fluchtplan Studio | `ehs_fluchtplan_monthly` | Fluchtplan Studio – Monatsabo | `monthly` | Monthly | Auto-renewing | 4,99 EUR |
| Brandschutzordnung Studio | `ehs_brandschutzordnung_monthly` | Brandschutzordnung Studio – Monatsabo | `monthly` | Monthly | Auto-renewing | 4,99 EUR |
| Gefahrstoffkataster | `ehs_gefahrstoffkataster_monthly` | Gefahrstoffkataster – Monatsabo | `monthly` | Monthly | Auto-renewing | 4,99 EUR |
| Dokumentmanagement | `ehs_dokumentmanagement_monthly` | Dokumentmanagement – Monatsabo | `monthly` | Monthly | Auto-renewing | 4,99 EUR |
| Unfallmanagement | `ehs_unfallmanagement_monthly` | Unfallmanagement – Monatsabo | `monthly` | Monthly | Auto-renewing | 4,99 EUR |

## Empfohlene Base-Plan-Einstellungen

Für jedes der sechs Produkte identisch:

- Base plan ID: `monthly`
- Type: Auto-renewing
- Billing period: Monthly
- Germany price: 4,99 EUR
- Grace period: 7 days
- Account hold: enabled; Google-Play-Standard bzw. maximal zulässige sinnvolle Dauer verwenden
- Resubscribe: enabled
- Offers / free trial: none at launch
- New locations: nicht automatisch aktivieren, solange Preise/Steuern für diese Märkte nicht geprüft wurden

## Technische Zuordnung

Die Android-App fragt alle sechs Product IDs über Google Play Billing ab. Der im Google-Play-Kaufdialog gelieferte Preis ist die maßgebliche Anzeige. Nach Kauf wird der Purchase Token an die Supabase Edge Function `verify-play-subscription` übertragen. Dort wird:

1. der eingeloggte Supabase-Benutzer aus dem JWT bestimmt,
2. der Google-Play-Kauf über `purchases.subscriptionsv2.get` serverseitig geprüft,
3. die Product ID gegen die angeforderte Modul-ID geprüft,
4. `obfuscatedExternalAccountId` gegen SHA-256 der Supabase User UUID geprüft,
5. der Kauf bei Bedarf bestätigt/acknowledged,
6. das Modul-Entitlement als `(user_id, product_id)` gespeichert.

Zugriff wird nur für Status `active`, `grace` oder `canceled` bis zum bezahlten Ablaufzeitpunkt gewährt. `on_hold`, `paused`, `pending`, `expired` und `revoked` schalten das Modul nicht frei.

## Datenschutz / App Content

- Ads: NO
- Advertising ID: NO
- Account creation: YES
- Account deletion: YES, in-app und Web-Löschweg
- In-app purchases: YES, subscriptions
- Subscription benefits: jeweils ausschließlich das gekaufte EHS-Modul
- Zahlungsdaten werden durch Google Play verarbeitet; DefiDev speichert keine Karten-/Bankdaten.

## Noch nicht im Sourcecode zu speichern

Folgende Werte sind Secrets und gehören ausschließlich in sichere Plattform-Secret-Stores, niemals in GitHub Sourcecode:

- Google Play Service Account JSON
- Android Upload Keystore und Passwörter
- Supabase Secret/Service-Role Keys
