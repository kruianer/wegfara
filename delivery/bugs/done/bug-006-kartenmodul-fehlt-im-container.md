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
- [x] Gegeben der Container ist frisch gebaut, wenn ich seine
      ausgelieferten Dateien prüfe, dann ist das Modul der
      Kartenbibliothek darin enthalten.

Die übrigen Kriterien (Konsolenmeldung, Fadenkreuz, Klick-/Tipp-
Verhalten, sichtbare Kartenkacheln in Begleiter und Planung) sind
direkte Folgen desselben behobenen Root Cause, aber nur am laufenden
dev-Deploy im Browser prüfbar — das ist die manuelle Hälfte des
Quality Gates (siehe [devops.md](../../devops.md), Abschnitt
„Acceptance / Quality Gate") und bleibt der Abnahme durch den Nutzer
auf https://dev.wegfara.com vorbehalten, sobald der automatische
dev-Deploy nach diesem Push gelaufen ist.

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

Die Prüfung wurde daher am tatsächlichen Next.js-Standalone-Output
vorgenommen (siehe Behebung unten), nicht in der Testsuite: `next
build` reproduzierte den Fehler zunächst (Modul fehlte in
`.next/standalone/node_modules`), die Konfigurationsänderung behebt
ihn nachweislich (Modul vorhanden, Build und automatisierte
Prüfscript grün). Docker stand in dieser Session nicht zur Verfügung,
daher erfolgte die Prüfung nicht am fertigen Container-Image selbst,
sondern am `.next/standalone`-Verzeichnis, das unverändert per
`COPY` ins Image aus [deploy/Dockerfile](../../../deploy/Dockerfile)
übernommen wird.

# Behebung

- `next.config.ts`: `outputFileTracingIncludes` erzwingt für alle
  Routen (`"/**"`) die Aufnahme von `node_modules/maplibre-gl/**` in
  das Standalone-Bündel. Next.js' automatische Datei-
  Ablaufverfolgung für `output: "standalone"` erkennt den Bezug auf
  die Kartenbibliothek nicht zuverlässig — maplibre-gl v6 lädt seine
  Worker-Dateien (`maplibre-gl-worker.mjs` u. a.) dynamisch über
  `new URL(..., import.meta.url)` nach, ein Muster, das die
  Ablaufverfolgung (unter Turbopack, siehe Build-Log) übersieht.
  Ergebnis vor dem Fix: `.next/standalone/node_modules` enthielt 25
  Pakete ohne maplibre-gl. Nach dem Fix: 26 Pakete, maplibre-gl
  vollständig samt aller `dist/*.mjs`-Dateien enthalten.
- `scripts/verify-standalone-bundle.mjs` (neu) + `package.json`
  (`postbuild`-Skript): prüft nach jedem `next build`, ob im
  Standalone-Bündel vorhandene, browserseitig genutzte Pakete
  tatsächlich unter `.next/standalone/node_modules` liegen, und lässt
  den Build fehlschlagen, wenn nicht. Läuft automatisch bei jedem
  `npm run build` und damit auch im Docker-Build
  ([deploy/Dockerfile](../../../deploy/Dockerfile), Stage `builder`)
  — ein künftiges Wiederauftreten (z. B. durch ein Dependency-Update
  von maplibre-gl oder Next.js) lässt den Container-Build fehlschlagen,
  statt erst beim Nutzer im Browser aufzufallen. Das ist die in der
  Aufgabe geforderte Prüfung „am fertigen Abbild" — reproduce-first
  ohne Vitest, da Vitest die Bibliothek mockt und diesen Fehler
  grundsätzlich nicht sehen kann (siehe „Hinweis zur Prüfung" oben).
- Reproduce-first nachgewiesen: `next.config.ts` testweise ohne die
  Ergänzung gebaut → `npm run build` bricht mit Exit-Code 1 und der
  Meldung des neuen Prüfskripts ab („Fehlt im Standalone-Bundle: 
  maplibre-gl"). Mit der Ergänzung: Exit-Code 0, Modul vorhanden.
- Keine Änderung an `app/plan/components/poi-map.tsx`,
  `day-route-map.tsx` oder `app/go/components/map-view.tsx` nötig —
  der Fehler lag ausschließlich im Build/Deploy, nicht in der
  Anwendungslogik (die Korrekturen aus bug-001 bis bug-005 bleiben
  unverändert).
- Volle Suite (411 Tests), Typecheck und Lint sind grün (die 3
  bestehenden Lint-Fehler in `delivery/design/planer/*` sind
  unverändert vorbestehend und nicht Teil dieser Änderung); `next
  build` inklusive neuem Prüfskript ist grün.
