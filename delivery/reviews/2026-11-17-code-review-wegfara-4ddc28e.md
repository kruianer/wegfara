---
type: code-review
repo: Wegfara
commit: 4ddc28e
date: 2026-11-17
---

# Code-Review: Wegfara (4ddc28e)

Automatisch erstellt vom appbaua-Worker am 2026-11-17.

## Kurz-Zusammenfassung

Vorgänger: [2026-11-10 (8dee11d)](2026-11-10-code-review-wegfara-8dee11d.md). Diese Review deckt `8dee11d..4ddc28e` ab:
- req-104 bis req-111, bug-075 und bug-076, insgesamt 52 Commits
- 199 Dateien außerhalb von `delivery/`, +13705/−593 Zeilen

| Prüfung | Ergebnis |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm test`, ein vollständiger Lauf | **428 Dateien, 6042 Tests, alle grün**, 218 s |

Im ganzen Repo ist kein Test übersprungen: kein `skip`, `only`, `fixme` oder `todo`.

**prod steht inzwischen auf `4836767`**, also mit req-104 bis req-107 und bug-075. Die Vorbefunde A1 und N1, die vor diesem Promote behoben sein sollten, sind weiter offen.

Die neuen Teile sind sorgfältig gebaut. Bei Mandantentrennung, Pfaden und Schlüsseln habe ich keinen kritischen Fehler gefunden. **Die drei schwersten neuen Befunde:**
1. **bug-076 ist nur halb behoben.** Ein abgeschaltetes Standard- oder Umgebungsmodell merkt `/api/health` erst, wenn ein Admin die Karte „KI-Modelle“ öffnet (N1).
2. **Wechsel der Reise in der Planung:** Tag und KI-Vorschlag der alten Reise bleiben stehen. „Übernehmen“ schickt die Punkte von A an Reise B (N3).
3. **Wechsel des Zugangsschlüssels:** Der Modellkatalog bleibt bis zu 6 Stunden der des alten Schlüssels. Der Server nimmt dann Modelle an, die der neue Schlüssel nicht nutzen darf (N2).

> Das Repo ist laut Security-Bericht vom 2026-11-11 öffentlich. Sicherheitsrelevante Befunde beschreibe ich deshalb nur so genau, wie es für die Behebung nötig ist.

## Neue Befunde

### N1. bug-076: Ein abgeschaltetes Modell fällt nur mit offener Karte auf (hoch)

`lib/ki-modelle/wahl.ts:29` und `:41-44`:
- `gleicheAb` bricht bei `gewaehlt === null` ab. Geprüft wird also nur die **Wahl** des Accounts, nicht das Modell, das tatsächlich gilt. Das wirksame Modell ist die Wahl, sonst `OPENAI_IMAGE_MODEL`, sonst der Standard.
- Abgeglichen wird nur gegen einen Katalog, der schon im Zwischenspeicher liegt. Den legt erst die Karte „KI-Modelle“ an.
- Eine Antwort „Modell existiert nicht“ vom Dienst wird nirgends festgehalten.

**Szenario:** Genau der Fall von bug-076. Nichts ist gewählt, das Standard-Bildmodell wird abgeschaltet, und alle Bilder schlagen fehl. `/api/health` meldet weiter „ok“, bis ein Admin „Mein Bereich“ öffnet; nach jedem Neustart wieder von vorn. Das „Erwartet“ von bug-076 ist damit nicht erfüllt: Der Fall soll auffallen, bevor es jemand im Planer merkt.

Dazu fehlt für OpenAI der Rückfall (`wahl.ts:44`). Fehlt das gewählte Modell im Katalog, wird es trotzdem weitergereicht, und jede Anfrage scheitert. Der Chat fällt in diesem Fall auf das neueste Sonnet zurück.

**Vorschlag:**
- Das wirksame Modell abgleichen, also `openAiModel(wahl.fragen)` und `openAiBildModell(wahl.bilder)`.
- Bei einem Modellfehler des Dienstes `merkeVerschwunden` setzen.
- Fehlt die Wahl im Katalog, `null` zurückgeben, damit Umgebung bzw. Standard gelten. Die Warnung bleibt dabei stehen.
- Einen Test für „nichts gewählt, Standard verschwunden“ schreiben.

### N2. Der Modellkatalog überlebt einen Wechsel des Zugangsschlüssels (mittel)

Der Zwischenspeicher hat als Schlüssel nur `dienst:accountId` (`lib/chat/modell-katalog-cache.ts:71-73`). `clearChatModellCache` (`:209`) wird außerhalb der Tests nirgends aufgerufen, auch nicht beim Speichern eines Schlüssels.

**Folgen:**
- Bis zu 6 Stunden zeigt die Karte die Modelle des alten Schlüssels.
- `PUT /api/ki-modelle` (`app/api/ki-modelle/route.ts:50-58`) nimmt ein Modell an, das der neue Schlüssel nicht nutzen darf, und jede Anfrage scheitert.
- War der alte Schlüssel ungültig, sperrt die Fehlerpause 60 s lang.
- Der Kommentar in `ki-modelle-card.tsx` („ein neu hinterlegter Schlüssel bringt seine Modelle mit“) stimmt nicht.

**Vorschlag:** Beim Speichern oder Löschen eines Schlüssels den Eintrag für diesen Dienst und Account entfernen. Alternativ einen Fingerabdruck des Schlüssels in den Cache-Schlüssel aufnehmen.

### N3. Planung: Wechsel der Reise setzt Tag und KI-Vorschlag nicht zurück (mittel)

`app/plan/plan-view.tsx:876` rendert `<PlanungView>` ohne `key`. `selectTrip` (`:421-424`) lässt den Bereich stehen. `selectedDate` (`planung-view.tsx:239`) und `vorschlag` (`:256`) bleiben deshalb erhalten. Der Fehler ist alt (seit August), trifft aber jetzt auch req-110.

**Szenario:** In der Planung von Reise A wird in der Seitenleiste Reise B gewählt.
- Der Tag von A bleibt gewählt, der Zeitstrahl ist leer und kein Reiter markiert.
- Das Ins-Bild-Rollen aus req-110 greift nicht.
- Ein offener KI-Vorschlag von A bleibt sichtbar. „Übernehmen“ schickt die Punkte von A mit `tripId` B.
- Der Server überspringt fremde POIs und Programmpunkte (`app/api/ki-planung/route.ts:146, :162`). Es geht also nichts kaputt, aber die Oberfläche meldet Erfolg, ohne etwas übernommen zu haben.

**Vorschlag:** `<PlanungView key={selectedTrip.id} …>`, gleich zusammen mit N6 aus der Vorwoche (`PoiList`).

### N4. Lese-Schnittstelle (req-104): Die Google-Tagesgrenze ist keine harte Grenze (mittel)

`lib/werkzeuge/google-grenze.ts:44-51` liest den Stand und zählt danach in einer zweiten Abfrage hoch, ohne Sperre dazwischen. Gleichzeitige `tools/call` lesen alle denselben Stand und gehen alle an Google. Um wie viel die Grenze überschritten wird, hängt nur davon ab, wie viele Aufrufe gleichzeitig laufen.

**Vorschlag:** Prüfen und Zählen in einer Anweisung: `insert … on conflict (account_id, tag) do update set anzahl = anzahl + 1 where anzahl < $grenze returning anzahl`. Kommt keine Zeile zurück, ist die Grenze erreicht.

Verwandt, niedrig: `saveMitdenkaZugang` (`lib/db/mitdenka-zugang.ts:67-80`) löscht und fügt ohne Transaktion ein. Zwei gleichzeitige POSTs enden mit einem unbehandelten 500. **Vorschlag:** ein einzelnes Upsert.

### N5. Miniaturen (req-105): `sharp` ohne Pixelgrenze und ohne Begrenzung der Gleichzeitigkeit (mittel)

`lib/images/miniatur.ts:110` ruft `sharp(data)` mit der Standardgrenze von rund 268 Mio. Pixeln auf, direkt in der Upload-Anfrage. Ein einfarbiges PNG mit sehr großen Abmessungen ist komprimiert klein, belegt dekodiert aber rund 1 GB. Mehrere davon gleichzeitig können den Container mit OOM abstürzen lassen. Der Nachhol-Lauf trifft dieselben Dateien noch einmal.

**Vorschlag:** `sharp(data, { limitInputPixels: 50_000_000, sequentialRead: true })` und `sharp.concurrency(1)` oder ein kleiner Semaphor um `verkleinere`.

### N6. Miniaturen ohne Original entstehen und werden nie aufgeräumt (mittel)

Das widerspricht der Regel in stack.md: „sie geht mit ihrem Original“. Zwei Wege führen dahin:
- **Nachhol-Lauf** (`lib/miniaturen/nachholen.ts:90-96`): Er liest das Original. Wird das Foto währenddessen gelöscht, schreibt `files.save` die Miniatur danach trotzdem.
- **`remove()`** (`lib/images/photo-store.ts:94-96`): Scheitert dort das Löschen der Miniatur, schlucken die Aufrufer den Fehler mit `.catch(() => {})`.

`inhalt()` sieht nur Originale, solche Miniaturen findet also niemand.

**Vorschlag:**
- Nach dem `save` prüfen, ob das Original noch da ist, sonst die Miniatur wieder löschen.
- Der Lauf soll Miniaturen ohne Original wegräumen.

### N7. „Auf der Karte zeigen“ (req-107) bei einem POI, den die Karte ausblendet (mittel)

`app/plan/components/pois-view.tsx:156, :164` und `poi-map.tsx:952-957`: Ab Werk zeigt die Karte nur „gesetzt“ und „wahrscheinlich“.
- Bei einem POI mit „weiß nicht“ springt die Karte auf eine leere Stelle, und nichts pulsiert.
- Mit „weniger Bewegung“ bleibt `pulsRef` ohne Timer stehen. Wird der Status später eingeblendet, erscheint unvermittelt der Ring.

**Vorschlag:** Den POI für die Dauer des Zeigens in `mapPois` aufnehmen, oder den Knopf mit einem Hinweis abschalten.

### N8. Trenner (req-109) (niedrig bis mittel)

- **Speichern bei jedem Zeigerschritt** (`plan-view.tsx:391-396`): Jedes `pointermove` schreibt synchron in `localStorage` und zeichnet ganz PlanView mit allen `.filter()` neu. Auf dem iPad ruckelt das. `onZugEnde` wird nicht genutzt. **Vorschlag:** Während des Zugs lokal halten, in `onZugEnde` speichern.
- **Keine Tastatur** (`trenner.tsx:83-90`): Es gibt kein `tabIndex`, keine `aria-valuenow/min/max` und keine Pfeiltasten. req-109 verlangt nur die Ansage für Vorlesehilfen, und die ist erfüllt. Nach WCAG 2.1.1 fehlt die Bedienung per Tastatur.
- **SplitView begrenzt beim Schrumpfen nicht** (`split-view.tsx:143-162`): Nach einem Zug auf 960 px und einem Fenster von 1100 px bleiben der Karte rund 70 px. `maxWidth` rechnet mit `windowWidth`, die Seitenleiste ist also nicht abgezogen. Die Planung löst das mit `lib/plan/spalten-breiten.ts` richtig. **Vorschlag:** SplitView auf dieselbe Rechnung umstellen.

### N9. Kleinere Befunde (niedrig)

| Ort | Befund |
| --- | --- |
| `lib/werkzeuge/zugang.ts:100-110`, `migrations/0056_mitdenka_zugang.sql` | Der Schlüssel hängt nur am Account. Verliert der Admin, der ihn erzeugt hat, seine Rolle, gilt der Schlüssel weiter. Laut req-104 ist das so gewollt; „erzeugt von“ in der Karte anzuzeigen wäre aber billig. |
| `lib/ki-modelle/stand.ts:59, :138` | Einträge in `verschwunden` werden nur geräumt, wenn eine Liste vorliegt. Nach dem Entfernen des Schlüssels oder dem Löschen des Accounts bleibt `/api/health` bis zum Neustart auf „warnung“. |
| `app/api/health/route.ts:27-34` | Der Endpunkt ohne Anmeldung fasst alle Accounts zusammen und nennt die Modellkennungen. Die Wahl eines einzelnen Accounts färbt den ganzen Status. Vorschlag: nach außen nur Zweck und Anzahl, die Einzelheiten ins Log. |
| `app/api/ki-modelle/route.ts:50-58` | Ein Bildmodell wird für „Fragen“ angenommen; laut req-108 ist das erlaubt. Ist der Dienst nicht erreichbar, lautet die 409 „nennt der Dienst nicht zur Wahl“ statt „nicht erreichbar“. |
| `lib/chat/modelle.ts:75` | Das Abschaltdatum wird nur beim Holen geprüft. Ein Modell, dessen Abschaltung in die bis zu 7 Tage Rückfall fällt, bleibt wählbar. |
| `lib/miniaturen/nachholen.ts:39, :95` | Die Zählung nimmt jede Datei mit, auch HEIC und andere Nicht-Bilder. Der Stand wird nie voll, und HEIC scheitert bei jedem Lauf neu. Der Lauf arbeitet über das Dateisystem statt über die DB. |
| `lib/images/photo-store.ts:59-61` | Dateien werden nicht atomar geschrieben. Eine halb geschriebene Miniatur kann mit gültigem ETag ausgeliefert werden und bleibt einen Tag im Browser-Cache. Vorschlag: in `.tmp` schreiben, dann `rename`. |
| `lib/images/miniatur.ts:88` | `mif1`/`msf1` gelten als HEIF, sind aber auch die Hauptkennungen vieler AVIF-Dateien. Prüfen, ob unter den kompatiblen Kennungen `avif` steht. |
| `lib/images/bild-auslieferung.ts:80` | Auch für ein 304 wird die ganze Datei gelesen und gehasht, bei `/api/dokumente` ganze PDFs. Vorschlag: ETag aus `stat` (Größe und Änderungszeit). |
| `scripts/verify-standalone-bundle.mjs` | Die Prüfung stellt nur fest, dass der Ordner `sharp` da ist, nicht die Bibliothek für die Plattform (`@img/sharp-linuxmusl-x64`). Fehlt sie, entstehen still keine Miniaturen. Vorschlag: `require("sharp")` aus dem Standalone-Verzeichnis laden. |
| `components/blaetter-leiste.tsx:96` | `useLayoutEffect(messen)` hat keine Abhängigkeiten und erzwingt nach jedem Rendern ein Layout, auch bei jedem Zeigerschritt im Zeitstrahl. Den Rest erledigt schon der ResizeObserver. |
| `lib/werkzeuge/ausfuehren.ts:263` | `strecke()` holt `steps=true`, braucht aber nur Dauer und Entfernung. |

## Prozessbefunde

| # | Befund |
| --- | --- |
| P1 | **Doppelter Kopf in den abgelegten Reviews.** Fünf der sechs letzten Berichte tragen Frontmatter und Titel zweimal: einmal vom Worker, einmal aus dem Bericht selbst (z. B. `2026-11-10-…-8dee11d.md:1-18`). Dieser Bericht beginnt deshalb ohne eigenen Kopf. Besser wäre, wenn der Worker beim Ablegen einen vorhandenen Kopf erkennt. |
| P2 | Die Vorwoche hat empfohlen, A1 und N1 vor dem nächsten Promote nach prod zu erledigen. Seither wurde zweimal promotet (`1863370`, `fa34202`/`4836767`), A1 und N1 sind offen. req-104 hat zwar keine neue offene Stelle hinzugefügt, die Lese-Schnittstelle ist aber jetzt in prod. |
| P3 | P2 und P3 der Vorwoche sind offen: Der Dateiname von bug-073 nennt die Prüfung noch „ausgesetzt“, und zu bug-074 gibt es keine Datei unter `delivery/bugs/`. |

## Vorbefunde: Stand am 2026-11-17

Die Dateien hinter A2 bis A4, A7, A9 bis A12 und den Vorwochen-Befunden N2 bis N5 und N8 wurden seit `8dee11d` **nicht geändert**. Sie sind damit unverändert offen.

| Vorbefund | Stand |
| --- | --- |
| **A1:** Keine Rollenprüfung beim Einladen und bei Rollenänderungen (kritisch) | **Offen, vierte Review in Folge**, und in prod. `app/api/einladungen/route.ts`, `app/api/trip-participants/route.ts` sind unverändert. |
| **N1 (Vorwoche):** Routen prüfen nur den Account, nicht die Teilnahme an der Reise (hoch) | **Offen.** Die neuen Routen aus req-108 und req-105 (`/api/ki-modelle`, `/api/miniaturen`) sind sauber auf Admins beschränkt. Die alten Stellen sind unverändert. |
| **A2:** Kein `TZ` im Container | **Offen.** `deploy/` setzt weiterhin kein `TZ`. |
| **A3, A4:** Chat-Antwort nach Reisewechsel, Fehlergründe im Chat | **Offen.** `chat-fenster.tsx` hat nur die Vorwahl aus req-108 bekommen. |
| **A5:** „Heute“ per `toISOString().slice(0,10)` | **Offen, sechs Stellen:** `app/page.tsx:40`, `app/go/page.tsx:39`, `app/plan/page.tsx:42`, `app/plan/reiseplan/[tripId]/page.tsx:43`, `app/mein-bereich/page.tsx:89`, `app/plan/accounts/page.tsx:74`. |
| **A6:** `ensureMapWorkerUrl()` fehlt in der Tageskarte | **Offen, zwölfte Review in Folge.** `day-route-map.tsx:316`. Es geht um zwei Zeilen. |
| **A7:** Geistbox springt bei 1 px nach oben | **Offen.** |
| **A8:** Karte und Spalten werden beim Umschalten neu aufgebaut | **Offen.** `planung-view.tsx:571-637` und `split-view.tsx` haben im breiten und im schmalen Zweig eine unterschiedliche Struktur. Das Zuklappen der Trenner remountet dagegen nichts. |
| **A9 bis A12** | Stand wie in der Vorwoche. |
| **Vorwoche N2 bis N5:** Druck, Kilometer, Titelfoto, Chat-Schleife | **Offen**, die Dateien sind unverändert. |
| **Vorwoche N6:** `PoiList` ohne `key={tripId}` | **Offen.** `pois-view.tsx:220`, siehe auch N3. |
| **Vorwoche N7:** Gegend | **Teilweise.** req-107 setzt die Gegend in der Zeile neu. Alte, zu lange Gegenden werden dort abgewiesen und nie gekürzt. Den Platzhalter `"ohne"` und das Zurücknehmen ganzer Objekte habe ich nicht erneut geprüft. |
| **Vorwoche N8:** Kleinere Befunde | **Offen**, die Dateien sind unverändert. |

## Gut gelöst

- **Lese-Schnittstelle (req-104):**
  - Der Schlüssel hat 256 Bit Zufall und wird nur als SHA-256 gespeichert. Widerrufen wirkt sofort.
  - Der Account kommt nur aus dem Schlüssel. Vor jedem Werkzeug laufen die UUID-Prüfung und `tripBelongsToAccount`, und eine fremde Reise bekommt dieselbe Antwort wie eine fehlende.
  - Der Port ist an `127.0.0.1` gebunden. Was über den Tunnel kommt, bekommt 404, noch bevor der Schlüssel geprüft wird (`lib/werkzeuge/erreichbarkeit.ts`).
  - Die JSON-RPC-Fehlercodes sind sauber, und es gehen keine Einzelheiten nach außen.
  - Die Tagesgrenze gilt nach dem Kalendertag in Europe/Berlin.
- **Miniaturen und Bild-Routen (req-105):**
  - Kein Pfad-Traversal: `?groesse` wird nur verglichen, die Namen gehen über `basename`.
  - Ein 304 gibt es erst nach Anmelde- und Account-Prüfung.
  - `If-None-Match` wird nach RFC 9110 behandelt, auch mit `W/`, Listen und `*`.
  - Der `Content-Type` kommt aus dem Inhalt.
  - Scheitert die Miniatur, bricht der Upload nicht ab.
  - Das Backup enthält die Miniaturen, mit Test, und alte Backups fallen auf das Original zurück.
- **KI-Modelle (req-108):**
  - Die Wahl und der Zwischenspeicher sind je Account getrennt, und PUT verlangt `accountAdmin`.
  - Gespeichert wird nur, was der Dienst nennt.
  - Health fragt je Aufruf weder die DB noch den Dienst.
  - Außer den zwei Standards steht keine Modellkennung fest im Code.
- **Schriften (bug-075):** Sie liegen im Repo, mit OFL-Lizenzen. Ein Test verbietet `next/font/google`.
- **Trenner und Blätterknöpfe (req-109, req-110):**
  - `pointercancel` wird behandelt, ebenso Pointer Capture und die 44-px-Greiffläche.
  - Kaputte Werte im `localStorage` werden abgewiesen, und die Einteilung wird je Reise gemerkt.
  - `TOLERANZ_PX` fängt halbe Pixel ab.
  - Der Trenner ist **ein** Baustein für SplitView und Planung.
- **Teaserbild (req-111):**
  - Es nutzt die Miniatur, mit `alt=""` und `loading="lazy"`.
  - Es ist kein Griff (`pointer-events: none`).
  - Ob es erscheint, entscheidet die gemessene Blockgröße.
- **Bildschirmprüfung:** Sie lässt sich auf einen `BEREICH` eingrenzen und rechnet Überlappungen mit dem sichtbaren Teil. Das ist sauber begründet und erlaubt neue Bausteine auf Seiten mit Altbestand.

## Empfohlene Reihenfolge

1. **A1 und Vorwochen-N1:** Rechteprüfung auf dem Server. Sie sind inzwischen in prod.
2. **N1:** Health und Rückfall für das wirksame Modell. Damit ist bug-076 wirklich behoben.
3. **N3 und Vorwochen-N6:** zwei `key`s setzen.
4. **A6:** `ensureMapWorkerUrl()` aufrufen.
5. **N2:** Den Katalog beim Schlüsselwechsel leeren.
6. **N5 und N6:** `sharp` begrenzen und verwaiste Miniaturen aufräumen.
7. **N4:** Die Google-Grenze atomar zählen.
8. **A2:** `TZ` im Container setzen.
9. Druck und Chat aus der Vorwoche (N2 bis N5).
10. N7, N8, A8 und der Rest aus N9; dann P1 bis P3.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt am Stand `4ddc28e` (`dev`).

| Prüfung | Ergebnis |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm test`, ein vollständiger Lauf | 428 Dateien, 6042 Tests, alle grün, 218 s |

`npm run test:e2e` wurde **nicht** ausgeführt.

Die Durchsicht lief in vier unabhängigen Teilprüfungen:
- req-104
- req-105 und bug-075
- req-108 und bug-076
- Oberfläche (req-106, req-107, req-109 bis req-111) mit den Vorbefunden A6, A8 und N6

Selbst im Code nachgeprüft:
- **N1:** `gleicheAb` mit `gewaehlt === null`, und der Katalog kommt nur aus dem Zwischenspeicher.
- **N2:** `clearChatModellCache` hat keinen Aufrufer außerhalb der Tests.
- **N3:** `PlanungView` ohne `key`, kein Zurücksetzen von `selectedDate`. Die Route der KI-Planung überspringt fremde POIs.
- **N4:** Lesen und Zählen getrennt in `nimmGoogleAbfrage`.
- **N5:** `sharp(data)` ohne Optionen.
- **A5, A6:** Fundstellen per grep. Für A1, A2 und die Druck- und Chat-Befunde: kein Diff in den betroffenen Dateien.
- Die Erkennung des Tunnels und der Docker-Build für `sharp` (Alpine, musl-Bibliothek im Lockfile).

Die übrigen Befunde stammen aus den Teilprüfungen, mit Datei und Zeile. Ich habe weder prod noch eine Datenbank der laufenden Umgebungen angefasst. Im Repo wurde nichts geändert, committet oder gepusht.
