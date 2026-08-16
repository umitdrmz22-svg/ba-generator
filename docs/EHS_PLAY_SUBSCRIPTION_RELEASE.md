# DefiDev EHS – Google Play Monatsabo

Stand: 16.08.2026

## Zielarchitektur

Die sechs bestehenden EHS-Werkzeuge bleiben fachliche Module. Für Google Play wird **eine gemeinsame mobile DefiDev-EHS-App** vorgesehen, statt sechs nahezu identischer Wrapper-Apps. Die App meldet den Nutzer am gemeinsamen Supabase-Projekt an und schaltet die Module über eine zentrale Berechtigung frei.

Google-Play-Produkt:

- Subscription Product ID: `ehs_pro_monthly`
- Base plan: monatlich, automatisch verlängernd
- Berechtigung: alle freigegebenen EHS-Module
- Werbung: keine

## Serverseitige Verifikation

Die Edge Function `verify-play-subscription` ist die einzige Komponente, die einen vom Android-Client gelieferten Purchase Token in eine EHS-Berechtigung umwandeln darf.

Ablauf:

1. Nutzer meldet sich über Supabase Auth an.
2. Android-App startet Google Play Billing und setzt `obfuscatedAccountId = SHA-256(Supabase user UUID)`.
3. Nach dem Kauf sendet die App ausschließlich `packageName` und `purchaseToken` zusammen mit dem Supabase-JWT an `verify-play-subscription`.
4. Die Edge Function prüft den JWT und den Nutzer.
5. Die Edge Function ruft Google Play `purchases.subscriptionsv2.get` auf.
6. Sie prüft Produkt-ID `ehs_pro_monthly`, Paketname und die an den Nutzer gebundene obfuscated account ID.
7. Bei einem legitimen, noch nicht bestätigten Kauf wird der Kauf über die Google Play Developer API bestätigt.
8. Erst danach schreibt der Server den verifizierten Status in `public.ehs_subscriptions`.
9. Die Web-/App-Module lesen nur `has_active_ehs_subscription()` bzw. `get_ehs_subscription_status()`; der Purchase Token ist für normale Clients nicht lesbar.

## Supabase-Migration

Einmal im gemeinsamen Projekt ausführen:

`supabase/040_ehs_subscription_entitlements.sql`

Die Tabelle hat RLS. `anon` und `authenticated` haben keine direkten Tabellenrechte. Nur die serverseitige Function schreibt Kaufdaten.

## Erforderliche Edge-Function-Secrets

**Nicht in Git committen.**

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` – vollständiges JSON eines Google-Cloud-Servicekontos mit der minimal erforderlichen Google-Play-Developer-API-Berechtigung.
- `EHS_ANDROID_PACKAGE_NAMES` – kommaseparierte Allowlist der zulässigen Paketnamen, z. B. `com.defidev.ehs`.

Supabase stellt die eigenen URL-/API-Key-Secrets der Function bereit. Es sollen die aktuellen publishable/secret keys verwendet werden; Secret Keys gehören ausschließlich in Backend/Edge Functions.

## Google Play Console

Vor Production:

1. Die gemeinsame Android-App anlegen und Paketnamen endgültig festlegen.
2. Subscription `ehs_pro_monthly` anlegen.
3. Monats-Base-Plan aktivieren und Preis festlegen.
4. Google-Cloud-Servicekonto mit Play Console verknüpfen und nur die erforderlichen Berechtigungen vergeben.
5. Google Play Developer API aktivieren.
6. Lizenztester eintragen.
7. Kauf, Verlängerung, Kündigung, Grace Period, On Hold und Ablauf testen.
8. Data Safety und Datenschutzerklärung anhand der realen Cloud-/EHS-Datenflüsse abschließend prüfen.

## Freischaltlogik

Zugriff erlaubt:

- `active`
- `grace`
- `canceled`, solange `expires_at` noch in der Zukunft liegt

Kein Zugriff:

- `pending`
- `on_hold`
- `paused`
- `expired`
- `revoked`

Damit bleibt ein vom Nutzer gekündigtes, aber bereits bezahltes Abo bis zum Ende des Abrechnungszeitraums nutzbar.

## Rechtlicher/produktbezogener Release-Blocker

Vor einer öffentlichen kommerziellen Freigabe müssen die vollständige Anbieteranschrift in Impressum/Datenschutz, die endgültigen Vertrags-/Preisangaben und die tatsächlichen Datenflüsse der mobilen EHS-App fertig geprüft sein. Die App darf nicht als Ersatz für gesetzlich erforderliche Fachkunde, Gefährdungsbeurteilungen, Freigaben oder Sachverständigenprüfungen beworben werden.
