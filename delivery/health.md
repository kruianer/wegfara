# Health-Checks

Woran man erkennt, dass diese App funktioniert. Gelesen vom
appbaua-Worker (req-032).

## Datenbank

- Container: `wegfara-dev-db-1` (dev), `wegfara-prod-db-1` (prod)
- Datenbank: `wegfara`
- Benutzer: `wegfara`

## Web

- dev: `https://dev.wegfara.com/api/health` erwartet `200`
- prod: `https://app.wegfara.com/api/health` erwartet `200`

Der Endpunkt sagt mehr, als dass der Server antwortet: Er prüft seit
bug-027 auch, ob die Anwendung in ihr Bildverzeichnis schreiben kann, und
antwortet sonst mit `503`. Ein nicht beschreibbares Verzeichnis fiel
vorher erst beim ersten Foto auf — und dann still.

Die Hauptadresse (`/`) taugt nicht als Prüfung: Sie leitet auf die
Anmeldeseite weiter (`307`, req-055) und sagt nur, dass etwas antwortet.

## KI-Anbieter

- Anbieter: openai
- Schlüssel aus: `OPENAI_API_KEY`

Geprüft wird damit, dass OpenAI erreichbar ist und der Schlüssel der
Umgebung gilt — nicht mehr. Die KI-Suche und die KI-Planung laufen seit
req-028 über den Zugangsschlüssel des jeweiligen Accounts, der
verschlüsselt in der Datenbank liegt; an ihn kommt appbaua nicht heran.
Diese Prüfung kann also grün sein, während die Suche für einen Account
nicht funktioniert, weil dessen eigener Schlüssel fehlt oder abgelaufen
ist.

## Nicht prüfen

- **Datenfluss.** wegfara empfängt keine Daten von außen. Karten, Orte
  und Wetter werden beim Öffnen einer Ansicht geholt; bleibt eine Quelle
  aus, fällt es dort auf und nicht an einem Datenalter.

- **`cloudflared`.** Läuft der Tunnel nicht, antwortet die Web-Prüfung
  ohnehin nicht — ein eigener Check dafür sagt nichts Zusätzliches.
