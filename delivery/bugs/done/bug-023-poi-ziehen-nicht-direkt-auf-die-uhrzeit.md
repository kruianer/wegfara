---
id: bug-023
app: wegfara
req: req-039
priority: normal
created: 2026-09-06
---

# Observed

Das Verschieben eines POI auf den Zeitstrahl funktioniert grundsätzlich,
ist aber alles andere als intuitiv:

- Beim Draufbleiben mit dem Finger gibt es keine Rückmeldung, dass der
  POI gegriffen ist.
- Es sieht so aus, als müsse man den POI zuerst auf die Tagesansicht
  ziehen — sonst funktioniert es nicht.

# Expected

- Sobald ich mit dem Finger auf dem POI bleibe, ändert sich seine
  Rahmenfarbe: ich sehe, dass er gegriffen ist.
- Ich kann den POI in einem Zug direkt auf die gewünschte Uhrzeit im
  Zeitstrahl ziehen, ohne Zwischenschritt über die Tagesansicht.

# Steps

1. Planer auf dem iPad öffnen, Bereich Planung
2. Einen POI aus „Noch unverplant" mit dem Finger anfassen — keine
   sichtbare Rückmeldung
3. Ihn direkt auf eine Uhrzeit im Zeitstrahl ziehen

# Ursache

Beides hing am selben Punkt: Der Finger-Zug (bug-017) begann erst mit der
Bewegung — acht Pixel weit — und meldete bis dahin nichts. Vorher war dem
POI nicht anzusehen, dass er gegriffen ist; es gab schlicht nichts
anzuzeigen, weil noch gar nichts gegriffen war.

Damit die Liste „Noch unverplant" weiterhin mit dem Finger rollt, tragen
die POI-Karten `touch-action: pan-y`: die senkrechte Bewegung gehört dem
Rollen, die waagerechte dem Zug. Wer den POI direkt auf eine Uhrzeit
zieht, bewegt den Finger aber schräg nach unten — diese Geste nimmt der
Browser als Rollen an sich und bricht den Zug mit `pointercancel` ab.
Erst wer zuerst zur Seite zieht — also scheinbar „auf die Tagesansicht" —
hat den Browser auf den Zug festgelegt und kann danach die Uhrzeit
ansteuern. Daher der Eindruck des Zwischenschritts.

Nachträglich hilft `touch-action` nicht mehr: sobald die Geste läuft,
wertet der Browser die Angabe nicht neu aus. Und `touchmove` hängt React
passiv ein, weshalb ein Rückruf der Ansicht das Rollen nicht abwenden
kann.

# Behebung

Der Finger-Zug greift jetzt, bevor er zieht
(`app/plan/components/pointer-drag.ts`):

- Bleibt der Finger 250 ms auf der Karte liegen, ist der POI gegriffen —
  ohne dass er sich bewegt haben müsste. Bewegt er sich vorher weit genug,
  um kein Tippen mehr zu sein, greift er wie bisher sofort; ein Wisch über
  die Liste rollt sie weiterhin.
- Wer gegriffen hat, meldet das über `onGrab` nach außen und wieder
  zurück, sobald losgelassen oder abgebrochen wird.
- Ab dem Greifen sperrt der Zug das Rollen selbst: ein `touchmove` am
  Dokument, nicht passiv eingehängt, das die Bewegung abfängt. Damit
  gehört die ganze Geste dem Zug — in jede Richtung, also auch schräg
  nach unten auf die gewünschte Uhrzeit. Gelöst wird die Sperre mit dem
  Ende des Zuges und beim Verschwinden des Elements.

Die Spalte „Noch unverplant" zeigt den gegriffenen POI an
(`unplanned-column.tsx`, `unplanned-column.module.css`): seine
Rahmenfarbe wechselt auf die Akzentfarbe — dieselbe Rückmeldung wie an
der gegriffenen Kante eines Programmpunkts (bug-022) —, dazu ein leichter
Schein und ein gefüllter Hintergrund. Damit das iPad beim Liegenbleiben
nicht stattdessen die Textauswahl mitsamt Lupe über die Karte legt,
nimmt die Karte keine Auswahl mehr an (`user-select`,
`-webkit-touch-callout`).

Am Zeitstrahl ändert sich nichts an der Bedienung: Programmpunkte und
ihre Kanten nutzen denselben Zug und greifen damit ebenso, sobald der
Finger liegen bleibt. Der Zug mit der Maus bleibt der native.

Geändert: `app/plan/components/pointer-drag.ts`,
`app/plan/components/unplanned-column.tsx` und
`app/plan/components/unplanned-column.module.css`.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

`app/plan/components/planung-view.test.tsx`

- Der Rahmen der POI-Karte wechselt, sobald der Finger auf ihr liegen
  bleibt — ohne dass gezogen wird — und ist mit dem Loslassen wieder der
  alte.
- Solange nicht gegriffen ist, rollt die Liste weiter; ab dem Greifen
  fängt der Zug die Bewegung ab, und mit seinem Ende rollt sie wieder.
- Ein gegriffener POI lässt sich in einem einzigen Zug schräg nach unten
  auf 14:00 ziehen und liegt danach als Programmpunkt von 14:00 bis
  16:30 im Zeitstrahl — ohne Zwischenschritt über die Tagesansicht.
- Zeigt die Ansicht nur an (req-038), wird nichts gegriffen und nichts
  gesperrt.

`app/plan/components/unplanned-column.layout.test.ts` (neu; jsdom führt
kein CSS aus, deshalb direkt am Stylesheet geprüft)

- Die gegriffene Karte trägt die Akzentfarbe im Rahmen, die ungegriffene
  den unauffälligen Rahmen.
- Auf der Karte wählt der Finger nichts aus, und die Liste rollt
  weiterhin.

Unverändert grün: die Tests zum Finger-Zug (bug-017), zum Umplanen
(req-040, req-046) und die vier E2E-Flüsse (req-047), darunter „POI
verplanen".

# Akzeptanzkriterien der Behebung

- [x] Gegeben ein POI in „Noch unverplant", wenn ich mit dem Finger auf
      ihm liegen bleibe, dann ändert sich seine Rahmenfarbe und zeigt,
      dass er gegriffen ist.
- [x] Gegeben ein gegriffener POI, wenn ich ihn in einem Zug direkt auf
      eine Uhrzeit im Zeitstrahl ziehe, dann entsteht dort ein
      Programmpunkt — ohne Zwischenschritt über die Tagesansicht.
- [x] Gegeben ein gegriffener POI, wenn ich ihn loslasse oder der Zug
      abbricht, dann hat die Karte wieder ihr gewohntes Aussehen und die
      Liste rollt wieder.
- [x] Gegeben ein Wisch über die Liste, wenn ich dabei auf einer Karte
      aufsetze, dann rollt die Liste wie bisher.
- [x] Gegeben dieselben Handgriffe wie bisher, wenn ich mit der Maus oder
      am Zeitstrahl ziehe, dann verhalten sie sich unverändert (req-039,
      req-040, req-046).
