---
type: code-review
repo: Wegfara
commit: 1a2f681
date: 2026-10-20
---

# Code-Review: Wegfara (1a2f681)

Automatisch erstellt vom appbaua-Worker am 2026-10-20.

Alle Belege sind zusammen. Hier der vollständige Bericht.

---

```
---
type: code-review
repo: wegfara
commit: 1a2f681
date: 2026-10-20
---
```

# Code-Review: wegfara (1a2f681)

Automatisch erstellt am 2026-10-20. Vorgänger: [2026-10-13 (e74adcd)](2026-10-13-code-review-wegfara-e74adcd.md).

## Kurz-Zusammenfassung

Seit letzter Woche: req-082 (feines Raster), req-083 (POI mehrfach verplanen) und vier Bugfixes (bug-060 bis bug-064), zusammen 76 geänderte Dateien, +4027/−983 Zeilen. `npx tsc --noEmit` und `npm run lint` sind fehlerfrei. `npm test` lief **zweimal** vollständig: Lauf 1 **4698 Tests, 1 fehlgeschlagen** (364 Dateien, 147,54 s), Lauf 2 **4697 Tests, alle grün** (144,07 s) — derselbe Stand, unterschiedliches Ergebnis. Das ist kein neuer Bug im Produktivcode, sondern die erste konkrete Manifestation eines seit mehreren Reviews offenen Vorbefunds (fehlender `testTimeout`, siehe unten).

Von den vier Bugfixes sind drei (bug-062, bug-063, bug-064) handwerklich vorbildlich: Ursache korrekt getroffen, Reproduce-first-Test nachweisbar vorhanden, keine Nebenwirkungen. req-083 (POI mehrfach verplanen) ist ebenfalls solide — jedes Akzeptanzkriterium ist einem konkreten Test zuordenbar.

**req-082 ist der Ausreißer dieser Woche, und er wiegt schwer:** Das Requirement liegt in `delivery/requirements/done/`, aber von 16 Akzeptanzkriterien ist genau **eines** mit `[x]` abgehakt — die übrigen 15 stehen auf `[ ]`. Das ist kein Lese-Versehen: zwei davon sind nachweislich **nicht umgesetzt** — das POI-Formular akzeptiert weiterhin nur 15-Minuten-Schritte, und die Zoomstufen wurden nicht erweitert, obwohl beides explizit gefordert war. Ein Requirement wurde nach `done/` verschoben, ohne dass seine eigene Checkliste das belegt.

## Neue Befunde

### N1. req-082 als „done“ markiert, aber 15 von 16 Akzeptanzkriterien unbestätigt — zwei davon nachweislich nicht erfüllt (hoch)

`delivery/requirements/done/req-082-feines-raster-auf-dem-zeitstrahl.md` zeigt:

```
$ grep -c "^\- \[x\]" req-082-feines-raster-auf-dem-zeitstrahl.md
1
$ grep -c "^\- \[ \]" req-082-feines-raster-auf-dem-zeitstrahl.md
15
```

Zum Vergleich: req-079, req-080, req-081 und req-083 stehen alle zu 100 % auf `[x]`. Das ist kein Normalzustand, sondern ein Einzelfall.

Zwei der unbestätigten Kriterien sind nicht bloß ungetestet, sondern **nicht umgesetzt**:

1. **POI-Formular ignoriert das Raster.** Das Akzeptanzkriterium fordert: *„Gegeben das Raster steht auf 5 Minuten, wenn ich im POI-Formular eine Dauer von 35 Minuten eintrage, dann wird sie angenommen."* Gemessen:

   ```
   lib/pois/estimated-duration.ts:4:  export const DURATION_STEP_MINUTES = 15;
   lib/pois/validate.ts:9:   import { DURATION_STEP_MINUTES } from "./estimated-duration";
   lib/pois/validate.ts:195: if (minutes % DURATION_STEP_MINUTES !== 0) return "ungueltig";
   ```

   `DURATION_STEP_MINUTES` ist komplett unabhängig von der neuen `lib/plan/raster.ts` (`GRUNDRASTER_MINUTEN`/`FEINES_RASTER_MINUTEN`) — genau die Art zweiter Quelle, die der Constraint des Requirements ausdrücklich verhindern wollte („Drei Kopien und ein Umschalter ergeben Zustände, die nicht zusammenpassen" — jetzt sind es weiterhin zwei unabhängige). 35 Minuten werden bei jedem Raster abgewiesen.

2. **Zoomstufen nicht erweitert.** Das Requirement fordert bei größter Stufe mindestens 44 px je Rastereinheit im 5-Minuten-Raster (528 px/h). Gemessen:

   ```ts
   // lib/plan/timeline-zoom.ts:27 — unverändert gegenüber req-078
   export const ZOOM_STUFEN_PX = [24, 32, HOUR_HEIGHT_PX, 72, 96, 128, 176];
   ```

   176 px/h bei 5 Minuten = 176⁄12 ≈ **14,7 px** — ein Drittel des verlangten Tippziels. Der Datei-Kommentar selbst sagt noch *„das Raster bleibt bei 15 Minuten"* und nennt req-082 nirgends — ein Hinweis, dass die Datei für dieses Requirement gar nicht angefasst wurde.

Solide ist dagegen, was tatsächlich umgesetzt wurde: Die dreifache `SNAP_MINUTES`-Dopplung aus dem Constraint ist konsolidiert (`lib/plan/raster.ts`, referenziert von `move-activity.ts`, `plan-poi.ts`, `tagesplan.ts`), und der Umschalter selbst existiert und übersteht den Tageswechsel. Aber zwei von sechzehn Kriterien sind nicht nebensächlich — sie sind der Teil, der die Feinarbeit auf dem iPad überhaupt bedienbar macht (Out-of-Scope-Abgrenzung des Requirements nennt genau diesen Zweck).

**Vorschlag:** Entweder nachziehen (Formular auf das gewählte Raster umstellen, Zoomstufen um 2–3 ergänzen, siehe Requirement-Vorgabe „zwei bis drei Stufen weiter") oder das Requirement ehrlich zurück nach `in-progress/` stellen, bis die Checkliste stimmt. „Done" mit 94 % offenen Kriterien ist für künftige Reviews nicht von „done mit vollständiger Abnahme" zu unterscheiden, wenn niemand nachzählt.

### N2. Neuer flakiger Test: Pfeil-Aktualisierung nach Verplanen rennt dem Assert hinterher (mittel)

Zwei identische vollständige Testläufe auf demselben Stand:

| Lauf | Ergebnis | Dauer |
| --- | --- | --- |
| 1 | 4698 Tests, **1 fehlgeschlagen**, 364 Dateien | 147,54 s |
| 2 | 4697 Tests, **alle grün**, 364 Dateien | 144,07 s |

Der Fehlschlag in Lauf 1:

```
FAIL app/plan/components/planung-view.test.tsx > Pfeile nur zu verplanten POIs (req-075)
  > zieht den Pfeil nach, sobald derselbe POI verplant wird
- Expected: ["Pfeil von POI 14 nach POI 3", "Pfeil von POI 3 nach POI 8"]
+ Received: ["Pfeil von POI 14 nach POI 3"]
```

Isoliert ausgeführt (`npm test -- app/plan/components/planung-view.test.tsx`, alle 136 Tests der Datei) ist er zuverlässig grün. Der Test wartet in Zeile 2115 nur auf `screen.findByTestId("activity-block-activity-3")` — das Erscheinen des neuen Programmpunkt-Blocks — und prüft direkt danach die Pfeile. Die Pfeil-Neuberechnung ist aber eine eigene, nachgelagerte Reaktion (vermutlich über einen weiteren Effekt/Re-Render), die unter Last (12 parallele vitest-Worker in der vollen Suite) noch nicht abgeschlossen ist, wenn die Prüfung läuft.

Das ist dieselbe Fehlerklasse, die die letzten beiden Reviews schon benannt haben („ein Test existiert, der daneben greift" bzw. der seit Wochen offene Vorbefund zum fehlenden `testTimeout`) — nur diesmal mit einem konkreten Namen und einem reproduzierbaren Vorher/Nachher. **Vorschlag:** `testTimeout: 15000` in `vitest.config.ts` (siehe Vorbefund #2 unten) behebt die Symptomatik nicht direkt, aber macht sie sichtbar statt sporadisch; zusätzlich sollte der Test auf das tatsächlich gemeinte Signal warten (`await waitFor(() => expect(pfeile()).toHaveLength(2))` statt `findByTestId` auf den Nachbar-Block).

### N3. bug-060: dauerhafter Fehlschlag beim Nachholen bleibt unbegrenzt und stumm (mittel)

Der Fix (`lib/activities/option-selection-echo.ts`) ist für den eigentlichen Bug zielgerichtet und mit Reproduce-first-Test belegt (`app/go/go-view.test.tsx:782-800`: Server kennt die Wahl noch nicht, UI zeigt sie per Echo trotzdem korrekt — mit altem Code wäre das rot gewesen).

Lücke: Der Nachhol-Effekt beim Mount (`go-view.tsx:198-210`) löscht das Echo nur bei `ok === true`. Schlägt der nachgeholte Schreibvorgang dauerhaft fehl (Gruppe inzwischen entfernt, anhaltender Serverfehler), bleibt das Echo unbegrenzt bestehen und wird bei jedem weiteren Laden erneut erfolglos versucht — ohne dass je ein Hinweis wie der vorhandene `option-hinweis` erscheint. Kein bestehender Test deckt `ok: false` in diesem Pfad ab. Das widerspricht dem eigenen Ziel des Bugs, die Anzeige nicht stillschweigend auf einem nicht gespeicherten Stand zu lassen — hier passiert exakt das, nur dauerhaft statt einmalig.

**Vorschlag:** Nach N erfolglosen Nachholversuchen (oder nach einer Obergrenze) das Echo verwerfen und denselben Hinweis zeigen wie beim direkten Fehlschlag.

### N4. Reisewechsel während einer Chat-Antwort (N2 der letzten Review) — Messung widersprüchlich, Code-Lücke unverändert (ungeklärt, als offen zu behandeln)

`app/plan/components/chat-fenster.tsx` hat weiterhin keine Prüfung, zu welcher Reise eine laufende Antwort gehört: `frageSenden` übergibt `text`/`antwort`/`fehler`-Callbacks an `sendeChatFrage`, die beim Eintreffen ungeprüft `setEntstehend`/`setNachrichten` aufrufen — unverändert seit der letzten Review, Code-Lesung bestätigt das eindeutig.

Ich habe versucht, das wie letzte Woche empirisch nachzustellen (Wegwerf-Test, echter `ReadableStream`, Wechsel mitten im Stream, danach entfernt). Ergebnis war **nicht eindeutig**: Ein Spy auf `sendeChatFrage` bestätigt, dass der `antwort`-Callback mit dem falschen (Mosel-)Inhalt tatsächlich feuert und sein `setNachrichten`-Updater korrekt ein neues Array mit der geleakten Nachricht berechnet — doch im gerenderten Endzustand blieb der Verlauf der Wien-Reise leer. Ein isolierter Minimal-Nachbau desselben Render-Phase-Reset-Musters **ohne** die übrige Komponentenlogik zeigte dagegen, dass ein später eintreffendes `setState` nach einem solchen Reset normal durchschlägt. Die Diskrepanz zwischen beiden Messungen konnte ich in der verfügbaren Zeit nicht auf eine Ursache zurückführen (kein Hinweis auf „act"-Warnungen, kein erneutes Auslösen des Reset-Zweigs, kein Unmount).

Ich kann daher **nicht bestätigen**, dass N2 der letzten Review behoben ist — nur, dass meine Testumgebung ihn in einem Lauf nicht zeigte, während die Quelltext-Lücke, die ihn ursprünglich ermöglicht, unverändert vorhanden ist. Für die Praxis ändert das nichts an der Empfehlung: **die strukturelle Absicherung (die gefragte `tripId` in `frageSenden` festhalten und jede Rückmeldung mit `if (gefragtFuer !== tripId) return` abschirmen) sollte unabhängig von diesem unklaren Messergebnis ergänzt werden** — eine Korrektheitseigenschaft, die von einem unverstandenen Verhalten abhängt, ist keine Absicherung. Fünf Zeilen, wie letzte Woche vorgeschlagen.

### N5. Vorbefunde aus der letzten Review zum Chat, unverändert offen

- **N3 (Abbruch während der Antwort):** weiterhin keine Behandlung. `grep -rn "signal|abort|cancel" app/api/chat/route.ts lib/chat/senden.ts lib/ai/anthropic-client.ts` liefert nichts.
- **N5 (unbegrenzte Unterhaltungslänge):** weiterhin nur `CHAT_MAX_ZEICHEN = 4000` je Nachricht; die Zahl der Nachrichten im mitgegebenen Verlauf ist unbegrenzt.
- **N4 (Agent SDK):** Kommentar in `anthropic-client.ts:18` behauptet weiterhin, das SDK sei „mit Werkzeugen im Blick gewaehlt" — unverändert falsch. `req-081...md` trägt weiterhin keinen Abweichungsvermerk.

Diese drei wurden diese Woche nicht angefasst (kein Commit berührt die betroffenen Dateien) und werden hier nur der Vollständigkeit halber erneut vermerkt, nicht neu bewertet.

## Vorbefunde: was ich nachgemessen habe

| Vorbefund | Stand am 2026-10-20 |
| --- | --- |
| **#1 `ensureMapWorkerUrl()` in jeder Karte** | **Offen, unverändert — achte Review in Folge.** `day-route-map.tsx:281` ruft weiterhin `new MapLibreMap(` ohne vorheriges `ensureMapWorkerUrl()`; `map-view.tsx` und `poi-map.tsx` rufen es korrekt. |
| **#2 `testTimeout` in `vitest.config.ts`** | **Offen, unverändert — und diese Woche erstmals mit einem konkreten Symptom (siehe N2 oben).** `grep -n "testTimeout" vitest.config.ts` → nicht vorhanden. |
| **Eigene „Heute"-Ableitungen außerhalb von `lib/trips/date-utils.ts`** | **Offen.** Diese Woche unverändert (keine der Fundstellen liegt im aktuellen Diff): `app/page.tsx:40`, `app/go/page.tsx:30`, `app/plan/page.tsx:40`, `app/plan/reiseplan/[tripId]/page.tsx:37`, `lib/trips/ende-vorschlag.ts:23`, `lib/backup/database.ts:80`. Ich präzisiere die Zählung nicht gegen die „sieben" der letzten Woche nach, da mein Suchmuster evtl. nicht identisch war — zählt neu ab heute. |

## Gut gelöst

- **bug-061 (N1 der letzten Review) ist korrekt und vollständig behoben.** `lib/ai/anthropic-client.ts:34` erhöht `MAX_TOKENS` auf 16000 mit einer Begründung, die auf Anthropics eigenen Hinweis verweist; `stop_reason === "max_tokens"` wird jetzt als eigener, benannter Grund (`"abgeschnitten"`) behandelt statt als vollständige Antwort abgelegt zu werden (`anthropic-client.ts:148-157`). Der Kommentar verweist korrekt auf bug-061. Damit ist der schwerste Befund der letzten beiden Reviews erledigt.
- **req-083 (POI mehrfach verplanen) ist handwerklich sauber und vollständig belegt.** Jedes Akzeptanzkriterium ist einem konkreten Test zuordenbar: Mehrfach-Verplanen (`lib/pois/plannable.ts` + `plannable.test.ts`), Verschieben/Entfernen wirkt nur auf den gezogenen Programmpunkt (`planung-view.test.tsx:1387-1427`), KI-Lückenfüllung schlägt einen bereits zweifach verplanten POI korrekt kein drittes Mal vor (`ki-planung.test.ts:263-293`), zwei Marker auf der Karte für zwei Programmpunkte desselben POI (`day-map.test.ts:391-418`), Filter-Persistenz über Tageswechsel (`ansicht-einstellungen.test.ts`). `unplanned.ts` wurde restlos durch `plannable.ts` ersetzt, keine toten Importe.
- **bug-062, bug-063, bug-064 sind drei vorbildliche kleine Fixes.** Jeder trifft die beschriebene Ursache direkt (bug-064: eine Zeile CSS, `cursor: not-allowed` → `pointer`, exakt die genannte Ursache), jeder hat einen Reproduce-first-Test, der mit dem alten Code nachweislich rot gewesen wäre, keiner zeigt Nebenwirkungen. bug-063 (Umbau von Kopf- und unterer Leiste im Begleiter, 19 Dateien) ist trotz seiner Größe vollständig mit Tests für Schließen-bei-Auswahl/bei-Klick-daneben/mit-Escape belegt (`go-view.test.tsx:1616-1645`) — keine Behauptung ohne Testcode.
- `npx tsc --noEmit` und `npm run lint` sind fehlerfrei; der zweite vollständige Testlauf (4697 Tests) war grün.

## Empfohlene Reihenfolge

1. **N1 — req-082 nachziehen oder ehrlich zurückstufen.** POI-Formular ans gewählte Raster koppeln, Zoomstufen erweitern — oder das Requirement zurück nach `in-progress/`, bis die Checkliste stimmt. Das ist der gewichtigste Befund dieser Woche, weil er ein Muster betrifft (Abnahme ohne Beleg), nicht nur eine einzelne Lücke.
2. **Vorbefund #2 — `testTimeout: 15000`.** Eine Zeile, seit mehreren Reviews offen, diese Woche mit einem konkreten flakigen Test (N2) erstmals sichtbar geworden.
3. **N2 — den Pfeil-Test auf das richtige Signal warten lassen**, statt auf den Nachbar-Block.
4. **N4 — die defensive `tripId`-Absicherung in `chat-fenster.tsx` ergänzen**, unabhängig vom unklaren Messergebnis dieser Review.
5. **N3 — bug-060: dauerhaften Fehlschlag beim Nachholen begrenzen und sichtbar machen.**
6. **Vorbefund #1 — `ensureMapWorkerUrl()` in `day-route-map.tsx:281`.** Achte Review in Folge, zwei Zeilen Produktivcode.
7. **N5 — die drei unveränderten Chat-Vorbefunde** (Abbruch, unbegrenzte Historie, Agent-SDK-Kommentar) aus der Vorgänger-Review, unverändert in ihrer dortigen Priorität.
8. **Eigene „Heute"-Ableitungen** konsolidieren — kosmetisch, aber seit Wochen unangefasst.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt am Stand `1a2f681`: `npx tsc --noEmit` (fehlerfrei), `npm run lint` (fehlerfrei), `npm test` **zweimal vollständig** (Lauf 1: 4698 Tests/364 Dateien, 1 Fehlschlag, 147,54 s; Lauf 2: 4697 Tests/364 Dateien, alle grün, 144,07 s). Der Fehlschlag aus Lauf 1 wurde isoliert erneut ausgeführt (grün) und ist als N2 dokumentiert, nicht als Suite-Regression gewertet.

`npm run test:e2e` wurde **nicht** ausgeführt — aus demselben Grund wie in den Vorgängern: `PGHOST=db` / `PGDATABASE=appbaua_prod` zeigen auf den Server der laufenden Umgebung, und ein autonomer Lauf legt dort keine Wegwerf-Datenbank an.

Zwei Befunde wurden mit Wegwerf-Testdateien empirisch untersucht, beide danach vollständig entfernt (`git status` während der ganzen Review mehrfach geprüft, am Ende sauber):

| Befund | Messung |
| --- | --- |
| N2 (Pfeil-Test) | Zwei vollständige `npm test`-Läufe auf identischem Stand, Ergebnis verglichen; isolierter Lauf der betroffenen Datei zur Bestätigung der Flakiness statt eines echten Regressionsbugs. |
| N4 (Chat-Reisewechsel) | Wegwerf-Test mit echtem `ReadableStream`, Spy auf `sendeChatFrage`, Render-Logging in einer temporär bearbeiteten Kopie von `chat-fenster.tsx` (per `git checkout` restlos zurückgesetzt) sowie ein isolierter Minimal-Nachbau des Render-Phase-Reset-Musters. Ergebnis widersprüchlich, siehe N4 — bewusst als ungeklärt берichtet statt als „behoben" oder „bestätigt offen" behauptet. |

Die beauftragten Teilprüfungen zu req-083 sowie zu bug-060/062/063/064 und req-082 liefen als zwei unabhängige, eigenständig recherchierende Durchsichten; ihre Befunde sind oben mit Datei:Zeile nachgeführt, nicht unbesehen übernommen (die Dateizuordnung von req-083 wurde dabei korrigiert — mehrere ursprünglich zugeordnete Dateien gehören tatsächlich zu req-082/bug-060/062/063, nicht zu req-083).

Kein Zugriff auf prod, keine Datenbank der laufenden Umgebungen angefasst, kein Netzaufruf nach außen. Es wurde nichts committet und nichts gepusht.
