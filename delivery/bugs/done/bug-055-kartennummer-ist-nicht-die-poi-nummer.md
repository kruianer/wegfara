---
id: bug-055
app: wegfara
req: req-074
priority: normal
created: 2026-09-26
---

# Observed

Im Planer, Bereich Planung: Die Zahlen auf den Kartenmarkern sind
verwirrend. Es sieht aus, als wären es die POI-Nummern — sie sind es aber
nicht.

# Expected

Eine Zahl an einem Ort bedeutet überall dasselbe. Steht auf dem
Kartenmarker eine 14, ist es POI 14 — dieselbe Zahl wie in der POI-Liste,
in der Auswahlliste und am Programmpunkt im Zeitstrahl (req-074).

Braucht die Tagesroute zusätzlich eine Reihenfolge, ist sie von der
POI-Nummer unterscheidbar.

# Steps

1. Planer öffnen, Bereich Planung
2. POIs für einen Tag verplanen
3. Auf die Karte sehen: die Marker sind 1, 2, 3 … durchnummeriert
4. Dieselben POIs tragen in der POI-Liste und im Zeitstrahl andere Zahlen

# Ursache

Die Zahl auf der Planer-Karte ist ein **Laufzähler der Tagesreihenfolge**,
nicht die POI-Nummer. In [day-map.ts](../../../lib/map/day-map.ts)
(Zeile 96) wird sie beim Aufbauen der Marker fortlaufend vergeben:

```
markers.push({
  number: nummer,      // Laufnummer innerhalb des Tages
  activity,
  ...
```

und in [day-route-map.tsx](../../../app/plan/components/day-route-map.tsx)
(Zeile 178) unverändert in den Marker geschrieben.

Auf der **POI-Karte** steht dagegen `poi.number` (req-013). Zwei
verschiedene Zahlensysteme für dieselben Orte, in derselben Anwendung.

Verschärft hat es req-074: Seit die POI-Nummer auch am Programmpunkt im
Zeitstrahl steht, liegen beide Zahlen direkt nebeneinander — der
Zeitstrahl sagt „14", die Karte daneben „3".

# Erwartete Behebung

Der Marker zeigt die **POI-Nummer**, wie überall sonst.

Ob die Reihenfolge des Tages daneben noch gebraucht wird, entscheidet die
Umsetzung — wenn ja, muss sie sichtbar etwas anderes sein als die
POI-Nummer und nicht dieselbe Stelle belegen.

Ein Programmpunkt ohne POI (von Hand angelegt) hat keine POI-Nummer; wie
sein Marker aussieht, entscheidet die Umsetzung — er darf nur keine Zahl
tragen, die als POI-Nummer gelesen wird.

# Notes

Die Reihenfolge des Tages ist ohnehin am Zeitstrahl ablesbar und wird mit
req-075 auf der Karte durch Pfeile gezeigt — die Zahl ist dafür nicht die
einzige Möglichkeit.

# Behebung

Der Wegpunkt der Tageskarte trägt die POI-Nummer. Sie kommt aus `poi.number`
(req-013) und wird nirgends neu gezählt: `buildDayMap`
([day-map.ts](../../../lib/map/day-map.ts)) bekommt die Nummern der Reise
mitgegeben und schreibt sie als `poiNummer` an Marker und Linien — dieselbe
Zuordnung, aus der der Zeitstrahl seine Zahlen nimmt
([nummer.ts](../../../lib/pois/nummer.ts)).

Die Reihenfolge des Tages bekommt keine zweite Stelle auf der Karte. Sie steht
weiter als `reihenfolge` am Marker, beschriftet im Planer aber keinen mehr — der
Zeitstrahl und die Pfeile (req-075) sagen sie. Im Begleiter bleibt sie die Zahl
am Marker: dort gibt es keine POI-Nummern, und sie passt zu dessen eigenem
Zeitstrahl (req-008).

Ein Programmpunkt ohne POI-Nummer — von Hand angelegt (req-018) oder mit einem
POI, den die Reise nicht mehr führt — wird als kleinerer, gefüllter Punkt
gezeichnet und trägt keine Zahl. Sein `aria-label` ist allein sein Titel.

Die Richtungspfeile nennen dieselben Zahlen wie die Marker: „Pfeil von POI 14
nach POI 3". Fehlt an einem Ende eine Nummer, heißt es wie bisher „Pfeil in
Wegrichtung" — eine Zahl aus einer anderen Zählung wäre dort falsch zu lesen.

Repro-first: sieben Tests waren ohne den Fix rot — fünf in
[day-route-map.test.tsx](../../../app/plan/components/day-route-map.test.tsx)
(bug-055), der Vergleich aller fünf Stellen in
[poi-nummer.test.tsx](../../../app/plan/components/poi-nummer.test.tsx) und die
Beschriftung der Wegpunkte aus req-075.
