---
id: bug-020
app: wegfara
req: req-035
priority: high
created: 2026-09-05
---

# Observed

Speichern speichert offenbar nichts: Nach dem Anlegen eines POI und
einem Wechsel des Tabs ist der POI beim Zurückkommen weg.

# Expected

Ein gespeicherter POI bleibt gespeichert — nach einem Tab-Wechsel, einem
Neuladen der Seite und einem Neustart des Browsers steht er weiterhin in
der POI-Liste.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen POI von Hand anlegen und speichern
3. In einen anderen Tab wechseln und zurückkommen
4. Der POI ist nicht mehr da

# Ursache

Gespeichert war der POI. Anlegen, Ändern und Entfernen eines POI sind
Vorgänge, bei denen der Nutzer eine Bestätigung erwartet, und werden
deshalb sofort geschrieben (`app/api/pois/route.ts`, siehe stack.md,
Conventions); der Planer lädt seine POIs bei jedem Aufruf frisch aus der
Datenbank (`app/plan/page.tsx`, `dynamic = "force-dynamic"`). Weg war er
nur auf dem Bildschirm — ein Neuladen der Seite brachte ihn zurück.

Die POI-Liste im Bild setzte sich aus zwei Teilen zusammen: dem
serverseitig geladenen Anfangszustand (`pois`-Prop) und dem, was sich
seither getan hatte. Letzteres lag in `PoisView` selbst — die
Neuzugänge (`addedPois`), die entfernten (`removedPoiIds`) und die
geänderten Status (`statusOverrides`).

`PlanView` rendert je Planer-Bereich eine andere Ansicht. Ein Wechsel des
Bereichs unmountet `PoisView`, und mit ihr verschwindet ihr Zustand;
beim Zurückkommen wird sie neu gemountet und zeigt wieder nur den
Anfangszustand der Seite — ohne den neu angelegten POI. Derselbe Verlust
traf jede Änderung an der Liste: ein geänderter Status fiel auf seinen
alten zurück, ein entfernter POI stand wieder da, per KI gefundene
(req-014) und aus einem Google-Maps-Link übernommene POIs (req-026)
waren wieder weg.

Was die Sitzung überdauern muss, lag schon vorher eine Ebene höher: die
Programmpunkte (req-039), die Dokumente (req-034) und die Auswahl der
auf der Karte sichtbaren Status (req-013). Die POIs waren die Ausnahme.

# Behebung

Die POI-Liste liegt jetzt in `PlanView`, also oberhalb des
Bereichswechsels, und folgt damit demselben Muster wie Programmpunkte und
Dokumente:

- `app/plan/plan-view.tsx`: aus dem `pois`-Prop wird der Startwert eines
  Zustands. `rememberPois` übernimmt angelegte, geänderte und gefundene
  POIs — ein POI mit der Kennung eines vorhandenen ersetzt diesen an
  seiner Stelle, ein neuer kommt ans Ende; `forgetPoi` nimmt einen
  entfernten heraus. Mit einer gelöschten Reise verschwinden auch ihre
  POIs, wie ihre Dokumente und Zuordnungen.
- `app/plan/components/pois-view.tsx`: die drei eigenen Zustände
  entfallen. `PoisView` zeigt die übergebene Liste und meldet jede
  Änderung über `onPoisChanged` und `onPoiRemoved` nach oben — gespeichert
  ist sie da bereits.

An den Schnittstellen zum Server ändert sich nichts; geschrieben wurde
schon vorher richtig.

Geändert: `app/plan/plan-view.tsx`,
`app/plan/components/pois-view.tsx`.

# Prüfung

Vier neue Tests in `app/plan/plan-view.test.tsx` (Abschnitt
„Gespeicherte POIs bleiben stehen (bug-020)"), die ohne die Behebung
fehlschlagen: ein von Hand angelegter POI, ein geänderter Status, ein
entfernter POI und per KI gefundene POIs — jeweils über einen Wechsel des
Planer-Bereichs hinweg und zurück.

`app/plan/components/pois-view.test.tsx` hält die Liste jetzt in einem
Rahmen an PlanViews Stelle; die dortigen Abläufe bleiben unverändert.

# Akzeptanzkriterien der Behebung

- [x] Gegeben ein von Hand angelegter POI, wenn ich in einen anderen
      Planer-Bereich wechsle und zurückkomme, dann steht er weiterhin in
      der POI-Liste.
- [x] Gegeben derselbe POI, wenn ich die Seite neu lade oder den Browser
      neu starte, dann steht er weiterhin in der Liste — er ist beim
      Speichern sofort geschrieben worden, und der Planer lädt seine POIs
      bei jedem Aufruf frisch.
- [x] Gegeben ein POI, dessen Status ich geändert habe, wenn ich den
      Planer-Bereich wechsle und zurückkomme, dann steht der geänderte
      Status da.
- [x] Gegeben ein entfernter POI, wenn ich den Planer-Bereich wechsle und
      zurückkomme, dann bleibt er entfernt.
- [x] Gegeben per KI gefundene oder aus einem Google-Maps-Link
      übernommene POIs, wenn ich den Planer-Bereich wechsle und
      zurückkomme, dann stehen sie weiterhin in der Liste.
