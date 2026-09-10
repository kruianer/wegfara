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

# Befund

Auf dev nachgemessen (2026-09-10, dev-Container):

- Der Google-Zugangsschlüssel **ist** hinterlegt (`account_api_key`, kind
  `google`, endet auf `WjJA`) und lässt sich sauber entschlüsseln.
- Der Kurzlink löst im Container einwandfrei auf: Status 200,
  Ziel `.../maps/place/inatura+-+Erlebnis+Naturschau+Dornbirn/@47.409286,...`
- **Google weist den Schlüssel ab:** ein Aufruf von
  `places.googleapis.com/v1/places:searchText` mit genau diesem Schlüssel
  antwortet mit `403 PERMISSION_DENIED — The caller does not have
  permission`.

Zwei Dinge sind daran zu tun:

**1. Der Fehlschlag bleibt unsichtbar.** Das ist der eigentliche Bug: Die
Anwendung muss sagen, dass der Abruf abgelehnt wurde. Ein 403 des Dienstes
ist etwas anderes als „Ort nicht gefunden" und sollte auch anders benannt
werden — der Nutzer muss erkennen, dass es an seinem Schlüssel liegt und
nicht am Link. Heute versinkt der Fall in `abfrage_fehlgeschlagen`, und
offenbar erreicht selbst diese Meldung das Feld nicht.

**2. Der Weg über den aufgelösten Link ist unnötig teuer.** Hinter dem
Kurzlink steht `!1s0x479b6b4a8e60626b:0x53b81cddba9fa03a` — eine
Hex-Kennung, keine Place-ID im `ChIJ…`-Format. `placeIdOf()` in
`lib/pois/google-link.ts` sucht nur nach `/!1s(ChIJ[\w-]+)/` und findet
nichts, also fällt es auf die Namenssuche zurück (ein Aufruf mehr, und der
Treffer ist nicht garantiert). Ob sich die Hex-Form in eine Place-ID
überführen lässt, wäre zu prüfen; ist sie es nicht, bleibt die Namenssuche
richtig — sie sollte dann aber bewusst der Weg sein und nicht ein
Nebenprodukt eines fehlgeschlagenen Musters.

Die Ursache des 403 selbst liegt außerhalb der Anwendung: In der Google
Cloud Console muss für dieses Projekt die **Places API (New)** aktiviert
und der Schlüssel dafür freigegeben sein (Schlüsselbeschränkungen prüfen:
API-Einschränkung und, falls gesetzt, HTTP-Referrer bzw. IP).

# Steps

1. Planer öffnen, Bereich POIs, „POI anlegen"
2. `https://maps.app.goo.gl/AtmT9iWJpmweLMYk8` in die erste Zeile einfügen
3. Es passiert nichts — keine Felder, keine Meldung, keine Fortschrittsanzeige
