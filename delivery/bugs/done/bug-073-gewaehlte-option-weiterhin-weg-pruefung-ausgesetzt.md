---
id: bug-073
app: wegfara
req: req-004
priority: hoch
created: 2026-10-29
---

# Observed

Die gewählte Alternative einer Options-Gruppe übersteht im Begleiter das
Neuladen **weiterhin nicht** — trotz der Behebungen bug-060, bug-071 und
bug-072.

**Der E2E-Fluss ist deshalb vorübergehend ausgesetzt**
(`test.fixme` in `tests/e2e/begleiter.e2e.ts`), damit der Prod-Deploy
nicht länger daran scheitert. Er hat ihn **vier Mal** blockiert:

| Lauf | Datum | Ergebnis |
|---|---|---|
| 39065440052 | 17.10. | bug-060, behoben |
| 40661379363 | 28.10. 09:04 | bug-071, behoben |
| 40774676177 | 28.10. 21:46 | bug-072, behoben |
| 40927165205 | **29.10. 18:09** | **weiterhin rot** |

Jedes Mal: Playwright wartet 15 Sekunden, fragt 34-mal nach
`aria-pressed="true"` an „Option 2 von 2" und sieht durchgehend
`"false"`. Kein Flackern — ein stabiler falscher Zustand.

# Expected

Wer im Begleiter eine Alternative wählt und die Seite neu lädt, sieht
weiterhin seine Wahl.

# Steps

1. Begleiter öffnen, Reise mit einer Options-Gruppe (zwei Programmpunkte
   mit identischer Zeit)
2. Die zweite Alternative antippen — sie wird sofort als gewählt gezeigt
3. Seite neu laden
4. Es steht wieder die erste Alternative da

# Ursache

**Nicht gefunden.** Was ausgeschlossen ist:

**Alle drei früheren Behebungen sind vorhanden und unverändert.**
Geprüft am Stand `4557e35`:

- `void saveOptionSelection` ist weg, das Ergebnis wird ausgewertet
  (bug-060)
- `lib/db/pg-typen.ts` setzt die Typ-Wandler, `pool.ts` nutzt sie
  (bug-071)
- `keepalive: true` in `save-option-selection.ts`, `pagehide` in
  `go-view.tsx`, Echo-Übernahme erst nach dem Mounten (bug-072)

**Die Kette ist durchgelesen und sieht richtig aus:**

| Glied | Befund |
|---|---|
| `aria-pressed` ← `selectedId` ← `optionSelections` | Pfad intakt (`activity-option-group.tsx:79`, `timeline.tsx:179`) |
| Schlüssel `tripId\|startAt\|endAt` | an **einer** Stelle gebaut (`memberKey`, `lib/activities/groups.ts:14`) |
| Server und Client | beide über `toIsoDateTimeString` |
| Echo | vor dem Speichern geschrieben |
| API-Route und `on conflict` | plausibel |

**Die Unit-Tests zu genau diesem Fall sind grün**, darunter einer, der die
Hydration mit Echo nachstellt (`app/go/go-view.test.tsx:805`). Der Fehler
zeigt sich **nur im echten Browser auf dem Runner**.

**Örtlich nicht nachstellbar.** Der Fluss braucht eine
PostgreSQL-Datenbank; auf dem Arbeitsplatz gibt es keine, und die des
Beelink ist nicht nach aussen freigegeben.

# Ursache (gefunden am 29.10.)

**Ein Wettlauf beim Neuladen, und er tritt auch von Hand auf.** Beim
Neuladen lebt die alte Seite weiter, bis die neue da ist. Dabei kann Folgendes passieren:

1. Tipp auf die zweite Alternative. Das Echo liegt im Gerät, das Speichern
   ist unterwegs.
2. Neuladen: Der Server liest die neue Seite, **bevor** das Speichern
   geschrieben ist, und gibt also den alten Stand mit.
3. Die Bestätigung des Speicherns erreicht noch die **alte** Seite. Die
   löscht daraufhin das Echo, denn der Server hat die Wahl ja.
4. Die neue Seite findet die Wahl weder im mitgebrachten Stand noch im
   Echo und zeigt die erste Alternative. Das ist der stabile falsche Zustand
   aus dem Runner-Protokoll.

Seit bug-072 (`keepalive`) überlebt der Schreibvorgang das Neuladen und
kommt deshalb regelmäßig noch bei der alten Seite an. Darum ist der
Fluss seit `b4e6c9c` auf dem Runner **bei jedem Lauf** rot und nicht mehr
nur ab und an. Der Schwesterfluss mit festgehaltenem Speichern blieb grün:
Dort kommt die Bestätigung nie bei der alten Seite an.

**Örtlich nachgestellt** mit PostgreSQL als WASM (PGlite) statt Docker. In
normaler Reihenfolge ist der Fluss örtlich grün, weil der Arbeitsplatz
langsamer ist als der Runner. Erzwingt man die Reihenfolge oben von Hand
(Speichern festhalten, bis die neue Seite gelesen ist; neue Seite
festhalten, bis die alte bestätigt ist), scheitert er mit genau der Meldung
des Runners.

Auch ein Mensch kann ihn treffen: Er muss nur neu laden, während das
Speichern unterwegs ist. Unterwegs bei schlechtem Netz kann das Sekunden
dauern. Der Test war also nicht zu scharf, es ist ein echter Mangel.

# Behebung

- Die Antwort des Speicherns nennt die Uhrzeit des Servers, zu der die Wahl
  gespeichert war. Die Seite `/go` nennt die Uhrzeit, zu der der Server sie
  gelesen hat.
- Eine Bestätigung löscht das Echo nicht mehr spurlos, sondern legt die
  bestätigte Wahl samt Uhrzeit bis zum nächsten Laden ab.
- Beim Laden gilt: Hat der Server die Seite **vor** dem Speichern
  gelesen, gilt die Wahl aus dem Gerät. Hat er sie **danach** gelesen,
  gilt sein Stand, auch wenn inzwischen jemand anders gewählt hat. Die
  abgelegte Bestätigung fällt in beiden Fällen weg.
- Der ausgesetzte Fluss ist wieder eingeschaltet. Ein neuer Fluss stellt
  den Wettlauf in fester Reihenfolge nach. Er scheiterte gegen den alten
  Bau und ist mit der Behebung grün.

# Erwartete Behebung (ursprünglich)

**Zuerst die Beobachtung aus der laufenden App**, nicht aus dem Test. Der
Betreiber will es selbst nachstellen und beschreiben. Erst wenn klar ist,
ob der Fehler auch von Hand auftritt, ist zu entscheiden:

- **Tritt er von Hand auf**, ist es ein echter Mangel und zu beheben.
- **Tritt er nur im Test auf**, ist der Test zu scharf: Er lädt
  **sofort** nach dem Klick neu, was kein Mensch tut. Dann wäre die
  Behebung, ihn eine Bestätigung abwarten zu lassen — und der Mangel
  wäre keiner.

Diese Unterscheidung ist der Kern. Dreimal wurde am Code behoben, ohne
sie zu treffen.

Zum Nachstellen auf dem Beelink: `TZ=Europe/Berlin` setzen, sonst tritt
der Fehler im UTC-Container nicht auf (siehe `scripts/e2e.mjs`).

# Notes

**Der Fluss ist ausgesetzt, nicht gelöscht.** `test.fixme` behält ihn samt
Begründung im Quelltext; in jedem Testlauf steht er als ausgesetzt da.
Gelöscht würde niemandem auffallen, dass diese Naht ungeprüft ist.

Wieder einzuschalten, sobald der Mangel behoben oder als Testproblem
erkannt ist. Dann fällt die Markierung weg, nicht der Test.

**Was dabei ungeprüft bleibt:** dass eine Wahl im Begleiter die Datenbank
erreicht und von dort wieder gelesen wird. Das ist die Naht, die dieser
Fluss als einziger prüft (req-047, Fluss 6).

**Zur Fragilität der Stelle:** Der Schlüssel aus Reise, Startzeit und
Endzeit wird an einer Stelle gebaut, aber an vier Stellen gebraucht —
Anzeige, Echo, Schreibvorgang, Lesen. Nach der Behebung wäre zu
überlegen, ob die Wahl nicht an der **Gruppe** hängen sollte statt an
ihrer Zeit: Eine Kennung, die sich nicht verschiebt, wenn jemand die
Uhrzeit ändert.
