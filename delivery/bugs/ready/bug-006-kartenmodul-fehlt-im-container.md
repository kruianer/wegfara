---
id: bug-006
title: Kartenmodul fehlt im ausgelieferten Container — Zeichnen ohne Wirkung
app: wegfara
area: Planung
severity: high
created: 2026-08-02
relates: req-012, bug-005
---

# Beobachtung

Im Bereich „POIs" des Planers lässt sich kein Suchgebiet zeichnen. Die
Schaltfläche reagiert — ihre Beschriftung wechselt auf „Zeichnen
beenden" —, aber weder ein Mausklick noch ein Tippen auf die Karte
setzt einen Eckpunkt. Ein erzwungenes Neuladen ändert nichts.

Die Browser-Konsole meldet:

```
Failed to load module script: The server responded with a
non-JavaScript MIME type of "text/html". Strict MIME type checking is
enforced for module scripts per HTML spec.
```

Auffällig dabei: Im Zeichenmodus zeigt der Mauszeiger über der Karte
eine Hand, nicht das vorgesehene Fadenkreuz, und ein Klick verschiebt
den Kartenausschnitt. Die Karte verhält sich also so, als gäbe es den
Zeichenmodus nicht — obwohl die Schaltfläche ihn anzeigt.

# Erwartet

Ein Klick oder Tipp auf die Karte setzt im Zeichenmodus einen
Eckpunkt (siehe req-012).

# Ursache (Analyse)

Das Modul der Kartenbibliothek ist im ausgelieferten Container nicht
vorhanden.

Geprüft auf dem Beelink:

```
docker exec wegfara-dev-app-1 sh -c "ls -d node_modules/maplibre-gl"
→ FEHLT

docker exec wegfara-dev-app-1 sh -c "ls -1 node_modules | wc -l"
→ 25   (enthält u. a. next, pg, @img — aber kein maplibre-gl)
```

Die Anwendung wird als Standalone-Bündel gebaut (`output: "standalone"`
in `next.config.ts`). Dieses Bündel enthält nur die Pakete, die das
Framework für den **Server** als nötig erkennt. Die Kartenbibliothek
läuft ausschließlich im Browser und wird dabei ausgelassen — der
Verweis auf ihr nachzuladendes Modul bleibt in der Seite jedoch
bestehen.

Beim Öffnen der Karte fordert der Browser dieses Modul an. Der Server
findet es nicht und antwortet mit seiner Fehlerseite in HTML. Der
Browser lehnt sie ab, weil ein Modul erwartet wurde — und alles, was
an der Kartenlogik hängt, bleibt wirkungslos. Die Schaltfläche selbst
reagiert weiterhin, weil ihr Code bereits geladen war.

Das erklärt zugleich, warum die Behebung von bug-005 (Berührungs-
gesten) nichts bewirkt hat: Der dort ergänzte Code wird nie
ausgeführt.

Und es erklärt die Hand statt des Fadenkreuzes: Die Klasse
`mapDrawing` mit `cursor: crosshair` wird von derselben Komponente
gesetzt, die nicht läuft. Was der Nutzer bedient, ist die Karte mit
ihrem Standardverhalten — Kacheln und Verschieben funktionieren, weil
dieser Teil der Bibliothek im gebündelten JavaScript enthalten ist;
die Anwendungslogik darüber fehlt.

# Umfang

Betroffen ist jede Ansicht mit Karte, da alle die Bibliothek auf
dieselbe Weise einbinden:

- `app/plan/components/poi-map.tsx` (POI-Ansicht)
- `app/plan/components/day-route-map.tsx` (Planungsansicht)
- `app/go/components/map-view.tsx` (Begleiter)

Beim Prüfen ist daher jede der drei Karten zu betrachten, nicht nur
das Zeichnen.

# Reproduktion

1. https://dev.wegfara.com/plan öffnen, Bereich „POIs"
2. Entwicklerwerkzeuge öffnen, Reiter „Konsole"
3. „Suchgebiet zeichnen" anklicken, dann auf die Karte klicken

Ergebnis: kein Eckpunkt; in der Konsole die oben genannte Meldung.

# Akzeptanzkriterien der Behebung

- [ ] Gegeben ich öffne den Bereich „POIs", wenn ich die
      Browser-Konsole betrachte, dann erscheint dort KEINE Meldung
      über ein nicht ladbares Modul.
- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich den Mauszeiger über
      die Karte bewege, dann erscheint ein Fadenkreuz und keine Hand.
- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich mit der Maus auf
      die Karte klicke, dann wird ein Eckpunkt gesetzt.
- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich mit der Maus auf
      die Karte klicke, dann verschiebt sich der Kartenausschnitt
      NICHT.
- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich auf einem
      Touchscreen auf die Karte tippe, dann wird ein Eckpunkt gesetzt.
- [ ] Gegeben ich öffne den Bereich „Karte" im Begleiter, wenn die
      Ansicht erscheint, dann sind Kartenkacheln sichtbar.
- [ ] Gegeben ich öffne den Bereich „Planung" im Planer, wenn die
      Ansicht erscheint, dann zeigt die rechte Karte die Wegpunkte des
      Tages.
- [ ] Gegeben der Container ist frisch gebaut, wenn ich seine
      ausgelieferten Dateien prüfe, dann ist das Modul der
      Kartenbibliothek darin enthalten.

# Constraints

- Die Anwendung wird weiterhin als Standalone-Bündel gebaut; das
  Deploy-Verfahren aus [devops.md](../../devops.md) bleibt unverändert.
- Die Behebung darf die Korrekturen aus bug-001 bis bug-005 nicht
  rückgängig machen.

# Hinweis zur Prüfung

Dass die Tests grün sind, sagt hier nichts aus: Sie ersetzen die
Kartenbibliothek durch einen Nachbau (`tests/mocks/maplibre-gl.ts`)
und laufen nie gegen das gebaute Abbild. Der Fehler entsteht erst
beim Bauen des Containers. Eine Prüfung, die das abdeckt, muss am
fertigen Abbild ansetzen — nicht in der Testsuite.
