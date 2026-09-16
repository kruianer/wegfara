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

## Nicht prüfen

- **KI-Anbieter.** Der Zugangsschlüssel für OpenAI liegt seit req-028 je
  Account verschlüsselt in der Datenbank, nicht in einer
  Umgebungsvariablen — appbaua kommt nicht an ihn heran. `OPENAI_API_KEY`
  dient nur Diensten ohne Account-Bezug; ein Check dagegen wäre grün,
  während die KI-Suche für den Account nicht funktioniert. Das wäre
  schlechter als keine Prüfung.

- **Datenfluss.** wegfara empfängt keine Daten von außen. Karten, Orte
  und Wetter werden beim Öffnen einer Ansicht geholt; bleibt eine Quelle
  aus, fällt es dort auf und nicht an einem Datenalter.

- **`cloudflared`.** Läuft der Tunnel nicht, antwortet die Web-Prüfung
  ohnehin nicht — ein eigener Check dafür sagt nichts Zusätzliches.
