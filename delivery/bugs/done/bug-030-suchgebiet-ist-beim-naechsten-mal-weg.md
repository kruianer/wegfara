---
id: bug-030
app: wegfara
req: req-012
priority: high
created: 2026-09-10
---

# Observed

Ein auf der Karte gezeichnetes Suchgebiet ist beim nächsten Mal wieder
weg — es wird offenbar nicht in der Datenbank gespeichert.

Dazu: Die Farbe des Suchgebiets soll **rot oder lila** sein, damit es sich
von den Farben der OpenStreetMap-Karte darunter unterscheidet. Heute geht
es darin unter.

# Expected

Ein gezeichnetes Suchgebiet bleibt erhalten: Nach einem Neuladen der
Seite, einem Wechsel der Reise und dem nächsten Öffnen des Planers ist es
weiterhin da. Es hebt sich farblich von der Karte ab.

# Befund

Auf dev nachgemessen (2026-09-10): Es liegen **zwei** Suchgebiete in der
Datenbank, beide mit Punkten —

    Wien Städtereise   5 Punkte
    Dornbirn           7 Punkte

Gespeichert wird also grundsätzlich. Zu prüfen ist deshalb der Weg
zurück: ob das Gebiet beim Öffnen des Planers geladen und gezeichnet
wird, ob es an der richtigen Reise hängt, und ob ein erneutes Zeichnen
das vorhandene ersetzt statt es zu verlieren.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte ein Suchgebiet zeichnen
3. Seite neu laden oder die Reise wechseln und zurückkommen
4. Das Suchgebiet ist nicht mehr zu sehen

# Ursache

Der Befund stimmt: Gespeichert und geladen wird sauber. `setSearchArea`
ersetzt das Gebiet einer Reise vollständig, `listSearchAreas` liefert es
beim Öffnen des Planers wieder, und `app/plan/page.tsx` reicht es an
`PlanView`. Drei Dinge davor und danach ließen es trotzdem verschwinden:

1. **Der Zustand im Browser.** `PlanView` hält Reisen, POIs,
   Programmpunkte, Transfers, Dokumente und Bewertungsrunden im Zustand —
   nur die Suchgebiete waren eine reine Eigenschaft, der Anfangsstand vom
   Server. `PoisView` führte daneben eine eigene Kopie
   (`currentSearchArea`), die beim Wechsel des Planer-Bereichs mit der
   Komponente verschwand und beim Wechsel der Reise auf ebenjenen
   Anfangsstand zurückfiel. Wer ein Gebiet zeichnete und danach den
   Bereich oder die Reise wechselte, sah wieder den Stand von vor dem
   Zeichnen — dasselbe Muster wie bug-020 bei den POIs. Ein entferntes
   Gebiet kam auf demselben Weg sogar zurück.
2. **Der Ausschnitt der Karte.** Hat die Reise noch keine POIs — der
   Normalfall, denn das Suchgebiet wird gezeichnet, _um_ POIs zu finden —,
   stellte sich die Karte bei jedem Öffnen auf den Hauptort bei Zoom 8.
   Ein Gebiet von der Größe einer Stadt ist darin ein Punkt. Nach einem
   Neuladen war es zwar da, aber nicht zu finden.
3. **Die Farbe.** Fläche und Umriss trugen `--acc`, den Sandton der
   Oberfläche (#d9c589), bei 16 % Deckung und 2 px Linienbreite. Auf den
   beigen Straßen und grünen Flächen der OpenStreetMap-Kacheln ist das
   kaum zu sehen — zusammen mit 2. sah es aus wie „weg".

# Behebung

- `lib/pois/search-area.ts`: `SEARCH_AREA_COLOR` (#9333ea, ein kräftiges
  Lila) steht als Domänenwert an genau einer Stelle. Fläche (20 %),
  Umriss (3 px), Entwurf und die Griffe teilen sie sich; die Griffe
  bekommen sie über die CSS-Variable `--suchgebiet`, die
  `app/plan/components/poi-map.tsx` aus der Konstanten setzt. Der erste
  Punkt des Entwurfs bleibt grün — an ihm wird geschlossen (bug-009).
- `app/plan/plan-view.tsx`: die Suchgebiete liegen im Zustand,
  `rememberSearchArea` ersetzt das Gebiet einer Reise oder nimmt es ihr.
  Je Reise bleibt es bei höchstens einem (req-012).
- `app/plan/components/pois-view.tsx`: keine eigene Kopie mehr. Das Gebiet
  kommt mit jedem Rendern aus `PlanView` und gehört damit immer zur
  gezeigten Reise; Änderungen meldet `onSearchAreaChanged` nach oben —
  wie `onPoisChanged` bei den POIs.
- `app/plan/components/poi-map.tsx`: hat die Reise keine POIs, rückt die
  Karte beim ersten Zeichnen auf das gespeicherte Suchgebiet statt auf den
  Hauptort. Nur beim ersten Mal — ein später verschobener Eckpunkt darf
  den Ausschnitt nicht wegziehen.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

- `app/plan/plan-view.test.tsx`, Abschnitt „bleibt ohne Neuladen erhalten
  (bug-030)" — ein gezeichnetes Gebiet übersteht den Wechsel des
  Planer-Bereichs und den Wechsel der Reise und zurück; ein entferntes
  bleibt entfernt; ein neu gezeichnetes ersetzt das alte; das Gebiet der
  einen Reise bleibt beim Zeichnen in der anderen unberührt und wird unter
  deren Kennung gemeldet.
- `app/plan/components/poi-map.test.tsx`, Abschnitte „Farbe des
  Suchgebiets (bug-030)" und „Ausschnitt beim Öffnen (bug-030)".
- `lib/pois/search-area.test.ts`, Abschnitt `SEARCH_AREA_COLOR` — der
  Farbton liegt im roten oder lila Bereich des Farbkreises und ist
  kräftig genug, um sich von den Kartenfarben abzuheben.

Der Weg in die Datenbank und zurück war bereits abgedeckt
(`lib/db/search-area.test.ts`, `app/api/search-area/route.test.ts`) und
bleibt es.

Volle Suite grün: 3115 Unit-Tests, 13 E2E-Tests (`npm run test:e2e`),
Lint, Prettier und `tsc --noEmit`.
