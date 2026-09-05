---
id: bug-017
app: wegfara
req: req-039
priority: normal
created: 2026-09-05
---

# Observed

Auf dem iPad lassen sich die POIs nicht mit dem Finger auf den
Zeitstrahl schieben. Das Ziehen funktioniert dort nicht.

# Expected

Ein POI lässt sich auch mit dem Finger aus „Noch unverplant" auf den
Zeitstrahl ziehen und wird dort zum Programmpunkt — wie mit der Maus.

Betrifft ebenso das Umplanen eines liegenden Programmpunkts (req-040):
Verschieben im Tag, auf einen anderen Tag und Ändern der Dauer müssen
per Finger genauso gehen.

# Steps

1. Planer auf dem iPad öffnen, Bereich Planung
2. Einen POI aus „Noch unverplant" mit dem Finger auf den Zeitstrahl
   ziehen
3. Der POI bleibt liegen, es entsteht kein Programmpunkt

# Ursache

Das Verplanen (req-039) und das Umplanen (req-040) hingen ausschließlich
am nativen Zug des Browsers: `draggable` am POI bzw. am Programmpunkt,
`dragstart` beim Aufnehmen, `dragover`/`drop` auf dem Stundenraster und
den Tages-Reitern.

Diesen Zug startet Safari auf dem iPad mit dem Finger nicht — die
`drag`-Ereignisse entstehen dort gar nicht erst. Die Anwendung bekam vom
Ziehen also nichts mit: der POI blieb liegen, es entstand kein
Programmpunkt. Mit der Maus dagegen funktionierte alles, weshalb der
Fehler nur am Touchgerät auffiel. Es ist derselbe Mechanismus wie in
bug-009, dort für das Schließen des Suchgebiets.

# Behebung

Neben dem nativen Zug steht jetzt ein zweiter Weg über Zeiger-Ereignisse,
die auf jedem Gerät ankommen (`app/plan/components/pointer-drag.ts`):
drücken, ziehen, loslassen. Er greift für Finger und Stift; die Maus
bleibt beim nativen Zug, der dort funktioniert und die Ansicht am Rand von
selbst mitrollt — beide Wege gleichzeitig würden dasselbe Loslassen
zweimal auswerten.

- Erst ab acht Pixeln Bewegung ist es ein Zug und kein Tippen; nimmt der
  Browser den Zeiger an sich (weil er rollt), endet der Zug folgenlos.
- Wo losgelassen wurde, entscheidet die Ablagefläche unter dem Zeiger
  (`data-drop-grid` am Stundenraster, `data-drop-day` am Tages-Reiter) —
  nicht das Ziel des Ereignisses, denn ab dem Aufnehmen gehören alle
  Zeiger-Ereignisse dem gezogenen Element.
- Abgelegt wird über dieselbe Entscheidung wie beim Zug mit der Maus:
  auf dem Raster beginnt ein POI dort bzw. verschiebt sich ein
  Programmpunkt dorthin, sein unterer Rand endet dort; auf einem
  Tages-Reiter wechselt der Programmpunkt den Tag und behält Uhrzeit und
  Dauer. Einrasten auf 15 Minuten, Mindestdauer und Reisezeitraum gelten
  unverändert (req-039, req-040).

Dazu, was der Finger sonst nicht bedienen kann:

- POI-Karten geben mit `touch-action: pan-y` die senkrechte Bewegung
  weiter ans Rollen der Liste und die waagerechte — die zum Zeitstrahl
  hin — dem Zug. Programmpunkte und ihr unterer Rand nehmen den Finger
  ganz (`touch-action: none`); gerollt wird der Zeitstrahl auf der freien
  Rasterfläche.
- Der untere Rand eines Programmpunkts ist mit acht Pixeln nicht zu
  treffen: am Touchgerät (`pointer: coarse`) wächst er auf 20 Pixel,
  bei kurzen Programmpunkten auf höchstens ein Drittel der Blockhöhe.
- Ein Fingertipp auf das Kreuz zum Entfernen beginnt keinen Zug mehr.

Der Stundenbereich des Tages wird jetzt in der Planungsansicht gerechnet
und an den Zeitstrahl gereicht: beide Spalten rechnen damit, seit ein POI
aus der Schwesterspalte auf dem Raster losgelassen werden kann.

Geändert: `app/plan/components/pointer-drag.ts` (neu),
`planung-view.tsx`, `timeline-column.tsx`, `unplanned-column.tsx`,
`day-tabs.tsx` sowie `timeline-column.module.css` und
`unplanned-column.module.css`.

# Prüfung

Neue Tests in `app/plan/components/planung-view.test.tsx`, die ohne die
Behebung fehlschlagen:

- Ein mit dem Finger gezogener POI wird zum Programmpunkt und
  verschwindet aus „Noch unverplant".
- Ein Programmpunkt lässt sich mit dem Finger auf eine andere Uhrzeit
  und auf den Reiter eines anderen Reisetages ziehen.
- Der untere Rand lässt sich mit dem Finger auf ein neues Ende ziehen,
  ohne dass der Block darunter mitzieht.
- Ein Tippen, ein vom Browser abgebrochener Zug und ein Loslassen neben
  den Ablageflächen verplanen nichts.
- Mit der Maus läuft der Zeiger-Weg nicht mit, damit ein Zug nicht
  zweimal ausgewertet wird.
- Zeigt die Ansicht nur an (req-038), lässt sich auch mit dem Finger
  nichts ziehen.

# Akzeptanzkriterien der Behebung

- [x] Gegeben der Planer am iPad, wenn ich einen POI aus „Noch
      unverplant" mit dem Finger auf den Zeitstrahl ziehe, dann entsteht
      dort ein Programmpunkt — wie mit der Maus.
- [x] Gegeben ein liegender Programmpunkt, wenn ich ihn mit dem Finger
      auf eine andere Uhrzeit ziehe, dann liegt er dort und behält seine
      Dauer (req-040).
- [x] Gegeben ein liegender Programmpunkt, wenn ich ihn mit dem Finger
      auf den Reiter eines anderen Reisetages ziehe, dann wechselt er
      dorthin und behält Uhrzeit und Dauer (req-040).
- [x] Gegeben ein liegender Programmpunkt, wenn ich seinen unteren Rand
      mit dem Finger ziehe, dann ändert sich seine Dauer, mindestens
      aber 15 Minuten (req-040).
- [x] Gegeben dieselben Handgriffe mit der Maus, wenn ich sie ausführe,
      dann verhalten sie sich unverändert.
