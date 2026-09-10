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

# Ursache

**Jeder Fehlschlag hieß dasselbe.** `findPlaceId()` und `placeDetails()` in
`lib/google/places-client.ts` machten aus jeder Antwort, die nicht `ok` war,
ein `null`. Das Nachschlagen konnte daraus nur lesen „kein Treffer" — der
403 von Google wurde damit zu „Zu diesem Link ließ sich kein Ort finden".
Am Feld stand also ein Satz über den Link, obwohl es am Schlüssel lag.
Dasselbe traf den fehlenden Zugangsschlüssel: die 409 der Schnittstelle
wurde in `ortAusGoogleLink()` zu „Die Abfrage bei Google ist
fehlgeschlagen".

**Und das Feld konnte ganz still bleiben.** `ortAusGoogleLink()` reichte die
Antwort ungeprüft durch (`as GoogleOrtLookup`). Alles, was nicht die
erwartete Form hatte, ging damit als Treffer durch; das Formular las darauf
`ort.name` eines Ortes, den es nicht gab. Der Fehler fiel in den
`setTimeout`-Rückruf des Suchfelds — niemand fing ihn, keine Meldung
erschien, und am Feld blieb „Schlägt bei Google nach…" stehen. Im
Repro-Test nachgemessen: `TypeError: Cannot read properties of undefined
(reading 'name')`, unhandled.

**Die Fortschrittsanzeige kam zu spät.** Sie wurde erst im Rückruf nach der
Wartezeit gesetzt — auf ein eingefügtes Link hin geschah also erst einmal
sichtbar nichts.

Warum beim Melder gar keine Meldung erschien, ließ sich allein am Quelltext
nicht abschließend festmachen: die übrigen geprüften Wege hätten etwas
hinterlassen. Nachweisbar still bleibt das Feld bei einer unerwarteten
Antwort der Schnittstelle — genau dieser Fall ist jetzt abgedeckt, und die
übrigen sind so benannt, dass sie sich nicht mehr verwechseln lassen.

**Zur Hex-Kennung:** Sie lässt sich nicht in eine Place-ID überführen. Die
Form `0x…:0x…` ist die Feature-Kennung des Ortes mit seiner CID dahinter;
die Places API (New) nimmt allein Kennungen in `ChIJ…`-Form an, und einen
offiziellen Weg von der einen in die andere gibt es nicht. Die Namenssuche
bleibt damit richtig.

# Behebung

**Der Grund geht bis ans Feld durch.** Jede Abfrage bei Google liefert jetzt
entweder ihren Treffer, ausdrücklich keinen — oder den Grund, warum sie
nicht ging (`GoogleAbfrage` in `lib/google/places-client.ts`). Ein
abgewiesener Zugang (403/401, und die 400 auf einen ungültigen Schlüssel)
heißt `zugang_abgelehnt` und ist damit etwas anderes als „nicht gefunden".
Am Suchfeld steht dazu: „Google hat den Zugangsschlüssel abgewiesen — am
Link liegt es nicht." samt Hinweis auf die Places API (New) und „Mein
Bereich". Der fehlende Schlüssel (409) heißt `kein_zugangsschluessel` und
nennt ebenfalls seinen eigenen Grund.

**Eine unerwartete Antwort gilt als Fehlschlag, nicht als Treffer.**
`ortAusGoogleLink()` prüft die Form der Antwort, bevor sie das Formular
erreicht: ohne Name und Position gibt es keinen Ort, sondern eine Meldung.
Still bleiben kann das Feld damit nicht mehr (bug-021).

**Die Anzeige steht ab dem Einfügen.** Dass nachgeschlagen wird, ergibt sich
jetzt aus dem Feld selbst (erkannter Link, Schlüssel vorhanden, noch kein
Ergebnis) statt aus einem Zustand, der erst nach der Wartezeit gesetzt wird.

**Die Namenssuche ist der benannte Weg und kostet einen Aufruf statt
zweier.** `istFeatureKennung()` in `lib/pois/google-link.ts` erkennt die
Hex-Form und lässt sie bewusst liegen — sie ist kein Muster, das
danebengeht. Nachgeschlagen wird der Name über `findPlace()`, das die
Angaben des Treffers gleich mitbringt, wie es die KI-Suche seit req-057 tut;
der zweite Aufruf für die Einzelheiten entfällt. Steht im Link doch eine
Place-ID, wird sie weiterhin bevorzugt.

Die Ursache des 403 selbst bleibt außerhalb der Anwendung: In der Google
Cloud Console muss die **Places API (New)** aktiviert und der Schlüssel
dafür freigegeben sein. Die Anwendung sagt das jetzt, statt es zu
verschweigen.
