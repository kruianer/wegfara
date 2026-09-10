---
id: bug-026
app: wegfara
req: req-048
priority: high
created: 2026-09-10
---

# Observed

Beim Anlegen eines POI den Google-Maps-Link
`https://maps.app.goo.gl/AtmT9iWJpmweLMYk8` in die erste Zeile des
Formulars eingetragen. Danach sollten die Daten übernommen werden — es ist
aber nichts passiert: keine Felder gefüllt, keine Meldung, keine Anzeige
dass etwas läuft.

# Expected

Der Link wird abgerufen und füllt Name, Adresse und Position; solange das
läuft, ist am Feld erkennbar, dass gearbeitet wird. Geht es nicht, sagt das
Formular warum — still bleiben darf es nie (bug-021).

# Verdacht

`app/plan/components/poi-form.tsx` bricht den Abruf ohne hinterlegten
Google-Zugangsschlüssel wortlos ab:

    // Ohne Zugangsschluessel wird gar nicht erst angefragt (req-028); am
    // Feld steht dann der Hinweis darauf.
    if (!hasGoogleKey) return;

Der Hinweis erscheint dabei nur, solange `istLink` gilt — wird der Link
etwa aus der Zwischenablage eingefügt und das Feld dann verlassen, oder
greift die Erkennung nicht, sieht der Nutzer gar nichts. Zu prüfen ist
beides: ob der Schlüssel für den Account gesetzt ist, und ob der Hinweis in
jedem Fall sichtbar wird.

Auch wenn ein fehlender Schlüssel die Ursache ist, bleibt es ein Fehler:
Der Nutzer trägt einen gültigen Link ein und bekommt keinerlei Rückmeldung.

# Steps

1. Planer öffnen, Bereich POIs, „POI anlegen"
2. `https://maps.app.goo.gl/AtmT9iWJpmweLMYk8` in die erste Zeile einfügen
3. Es passiert nichts — keine Felder, keine Meldung, keine Fortschrittsanzeige
