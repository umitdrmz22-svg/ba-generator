# Benutzerregistrierung einrichten

Die Anwendung enthält eine vollständige Registrierungs- und Anmeldeoberfläche auf Basis von Supabase Auth. Für produktive Konten sind einmalig folgende Schritte erforderlich.

## 1. Supabase-Projekt anlegen

1. Ein neues Supabase-Projekt erstellen.
2. Unter **Authentication → Providers → Email** die E-Mail-Anmeldung aktivieren.
3. **Confirm Email** für produktive Nutzung aktiviert lassen.
4. Unter **Authentication → URL Configuration** die produktive Site-URL und zulässige Redirect-URLs hinterlegen.

## 2. Datenbank und Rollen anlegen

Im Supabase SQL Editor die Datei `supabase/001_auth_and_tenants.sql` vollständig ausführen. Sie erstellt:

- Benutzerprofile,
- Firmen-/Organisationsbereiche,
- Mitgliedschaften,
- Rollen `owner`, `admin`, `ersteller`, `pruefer`, `freigeber`, `leser`,
- Row-Level-Security-Richtlinien,
- die automatische Anlage eines Firmenbereichs nach der Registrierung.

Die Rollen werden nicht aus frei änderbaren Benutzermetadaten gelesen.

## 3. Cloudflare Pages konfigurieren

Unter **Settings → Environment variables** setzen:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Alternativ kann für ältere Projekte `SUPABASE_ANON_KEY` verwendet werden. Niemals einen Secret-/Service-Schlüssel im Browser oder Repository hinterlegen.

Die Function `functions/auth-config.ts` liefert ausschließlich die für Browser vorgesehenen öffentlichen Verbindungsdaten. Der eigentliche Zugriffsschutz erfolgt durch Supabase Auth und Row Level Security.

## 4. GitHub Pages

GitHub Pages führt keine Cloudflare Functions aus. Für eine reine GitHub-Pages-Demo können URL und Publishable Key in `assets/auth-config.js` eingetragen werden. Diese Werte sind öffentlich und dürfen nur zusammen mit korrekt eingerichteter Row Level Security verwendet werden.

## 5. Test

1. `auth.html` öffnen.
2. Firmenkonto registrieren.
3. Bestätigungs-E-Mail öffnen.
4. Anmelden.
5. In Supabase prüfen, ob `profiles`, `organizations` und `organization_members` angelegt wurden.
6. Prüfen, dass das erste Mitglied die Rolle `owner` besitzt.

## Noch nicht enthalten

- Einladung weiterer Benutzer,
- Rollenverwaltung im Frontend,
- MFA/SSO,
- Mandantenabrechnung,
- Dokument- und Dateispeicherung.

Diese Funktionen werden im anschließenden Gefahrstoff- und Dokumentenmanagement aufgebaut.
