---
type: code-review
repo: Wegfara
commit: bc0e0f4
date: 2026-11-03
---

# Code-Review: Wegfara (bc0e0f4)

Automatisch erstellt vom appbaua-Worker am 2026-11-03.

Die Review ist schon fertig, es läuft nichts mehr. Der vollständige Bericht steht in meiner vorigen Antwort. Das hier ist nur der Ersatz-Wecker, falls etwas hängen geblieben wäre.

- **Prüfungen:** Typprüfung und Lint ohne Fehler. `npm test` lief einmal komplett durch: 405 Dateien, 5668 Tests, alle grün. Die E2E-Tests habe ich nicht laufen lassen, weil sie auf die Datenbank der laufenden Umgebung zeigen.
- **Schwerster Befund:** Die Server-Routen prüfen weiterhin keine Rolle und keine Zugehörigkeit zur Reise. Neu dazugekommen sind die Routen für Titelfoto, Tagesüberschriften und Gegend. Darunter ist `POST /api/reise-titelfoto/ki`: Jedes angemeldete Mitglied des Accounts kann damit kostenpflichtige KI-Bilder für jede Reise des Accounts erzeugen lassen. Das sollte vor dem nächsten Deploy nach prod behoben sein.
- **Zweitschwerster Befund:** Der gedruckte Reiseplan lässt Tagesausflüge über 30 km aus der Übersichtskarte weg, dadurch fallen die gefahrenen Kilometer zu klein aus.
- **Vorbefunde:** Von denen der letzten Review ist nur das Test-Timeout erledigt. Unter anderem fehlt `TZ` im Container weiterhin, und `ensureMapWorkerUrl()` fehlt in der Tageskarte nun die zehnte Review in Folge.

Ich habe nichts geändert, nichts committet und nichts gepusht.
