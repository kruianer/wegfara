---
type: code-review
repo: Wegfara
commit: 8dee11d
date: 2026-11-10
---

# Code-Review: Wegfara (8dee11d)

Automatisch erstellt vom appbaua-Worker am 2026-11-10.

---
type: code-review
repo: wegfara
commit: 8dee11d
date: 2026-11-10
---

# Code-Review: wegfara (8dee11d)

Automatisch erstellt am 2026-11-10. Vorgänger: [2026-11-03 (bc0e0f4)](2026-11-03-code-review-wegfara-bc0e0f4.md), letzter vollständiger Bericht: [2026-10-27 (d7c0a8c)](2026-10-27-code-review-wegfara-d7c0a8c.md).

> Hinweis zur Ablage: Den Bericht gebe ich hier noch einmal vollständig aus. In der Vorwoche wurde die Antwort des Ersatz-Weckers statt des Berichts abgelegt (siehe P1).

## Kurz-Zusammenfassung

**Seit der letzten Review hat sich am Code nichts geändert.** Zwischen `bc0e0f4` und `8dee11d` kamen nur Dateien unter `delivery/` dazu: eine Review, ein Security-Bericht und eine Idee. Die Review vom 2026-11-03 ist aber nur als Platzhalter abgelegt (siehe P1). Ihre Befunde sind damit nirgends festgehalten.

Diese Review deckt deshalb den ganzen Abstand zum letzten vollständigen Bericht ab, also `d7c0a8c..8dee11d`:
- req-093 bis req-103 und bug-071 bis bug-074
- 215 Dateien außerhalb von `delivery/`, +20336/−3462 Zeilen

| Prüfung | Ergebnis |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm test`, ein vollständiger Lauf | **405 Dateien, 5668 Tests, alle grün**, 158,5 s |

Im ganzen Repo ist kein Test übersprungen: kein `skip`, `only`, `fixme` oder `todo`. Das `test.fixme` aus `7aeb295` (bug-073) hat `3574570` wieder entfernt.

**Die drei schwersten Befunde:**
1. **Seit drei Reviews offen:** Einladen und Rollen ändern laufen weiterhin ohne Rechteprüfung auf dem Server (A1). Damit kann ein Teilnehmer die Identität einer anderen Person im Account übernehmen.
2. **Neu:** Die Routen aus req-093 und req-103 prüfen nur den Account, nicht die Teilnahme an der Reise. Das betrifft auch die kostenpflichtige KI-Bilderzeugung und den Plan-Leser des Chats (N1).
3. **Neu:** Der gedruckte Reiseplan (req-103) lässt Tagesausflüge, die nur wenige Stationen der Reise haben, ganz aus dem Kartenausschnitt fallen. Er druckt dann eine zu kleine Kilometerzahl, obwohl seine Vollständigkeitsprüfung bestanden ist (N2).

## Neue Befunde

### N1. Neue Routen ohne Prüfung der Reisezugehörigkeit (hoch)

Betroffen sind diese Routen:
- `app/api/reise-titelfoto/route.ts`
- `app/api/reise-titelfoto/[tripId]/route.ts`
- `app/api/reise-titelfoto/ki/route.ts` (`:31-46`)
- `app/api/tages-ueberschriften/route.ts`
- `app/api/poi-gegend/route.ts`
- `app/api/chat/route.ts` mit dem Plan-Leser `lib/chat/plan-leser.ts`

Sie prüfen nur `session` und `findTrip(db, session.accountId, tripId)`. Ob die Person zur Reise gehört oder dort planen darf, prüft keine davon. `darfPlanen` wirkt nur in der Oberfläche.

**Szenario:** Eine Teilnehmerin von Reise A ruft die API direkt mit der Kennung von Reise B desselben Accounts auf.
- Mit `POST /api/reise-titelfoto/ki` erzeugt sie für B KI-Bilder, bezahlt mit dem Zugangsschlüssel des Accounts.
- Mit `POST /api/chat` und der `tripId` von B liest der Plan-Leser für sie Plan, POIs und Kosten von B.

Das widerspricht `delivery/security.md` („Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren“). Das Muster ist älter (`pois`, `poi-fotos`), und laut Glossar „schränkt die Rolle vorerst nichts ein“. Die Angriffsfläche ist aber deutlich größer geworden.

**Vorschlag:**
- Eine zentrale Prüfung `tripSichtbarFuer(session, tripId)` auf Basis von `listTripsForSession` einführen.
- Sie zuerst in den KI-Routen und im Chat einsetzen, dann überall, wo eine `tripId` ankommt.
- Je Route einen 403-Test mit einer fremden Teilnehmer-Sitzung schreiben.
- Zusammen mit A1 vor dem nächsten Promote nach prod erledigen.

### N2. Gedruckter Reiseplan: Tagesausflüge fallen aus Karte und Kilometern (hoch)

`vorOrt` (`lib/druck/karte.ts:204-218`) zieht die Grenze bei `max(30, 4 × Median der Entfernungen zum Kern)`. Hat ein Ausflug nur wenige Stationen der Reise, bleibt der Median im Hauptort, und die Grenze liegt bei 30 km. Der Ausflug gilt dann als „weit weg“.

Mit den Koordinaten der Fixture nachgerechnet:

| Fall | Ergebnis |
| --- | --- |
| Bilbao mit einem Ausflug nach San Sebastián (3 Stationen) | San Sebastián fällt heraus |
| Wie oben, mit zwei Bilbao-Stationen mehr | San Sebastián und Laguardia fallen heraus |
| Zwei Standorte im Verhältnis 8:7 | Der kleinere verschwindet |
| Fixture (6 von 15 Stationen im Ausflug) | Bleibt knapp darunter, deshalb ist der Test mit 133 km grün |

**Folgen:**
1. **Übersichtskarte** (`karte.ts:317-320`): Der Ausschnitt zeigt nur Bilbao. Das widerspricht „zeigt die ganze Reise“.
2. **Kilometer** (`lib/druck/uebersicht.ts:131-133` mit `:173-177`): Wege außerhalb des Ausschnitts fallen aus der Summe. Die Prüfung in `:123-130` ist trotzdem bestanden, und die gedruckte Zahl ist zu klein. Genau das schließt req-103 aus.
3. **Tageskarte des Ausflugstags** (`karte.ts:385-389`): Sie zoomt auf das Hotel, und der Ausflug liegt außerhalb des Bildes.

**Vorschlag:**
- Als „weit weg“ nur den ersten Ort des ersten Tages und den letzten Ort des letzten Tages zulassen, also An- und Abreise.
- Die Kilometer nicht über die Strichart der Karte zählen.
- Die Tageskarte immer auf alle Stationen des Tages zuschneiden.
- Tests für einen Ausflug mit 12:3 Stationen und für einen Ausflugstag ergänzen, der am Hotel beginnt.

### N3. Kilometersumme: falsche und fehlende Transfers (mittel)

`lib/druck/uebersicht.ts:120-133` und `lib/druck/karte.ts:284-299`:
1. **Veraltete Transfers:** Geprüft werden die Paare aufeinanderfolgender Stationen, summiert aber *alle* Transfers im Ausschnitt. `updateActivityTimes` (`lib/db/activities.ts:169`) löscht keine Transfers. Nach einer Umsortierung zählen alte Wege mit, und die Summe wird zu groß.
2. **Options-Gruppen:** Ist der Transfer an B2 gespeichert und gewählt ist B1, findet `A>B1` nichts. Es gibt dann nie Kilometer, und die Karte zeichnet die Linie zur nicht gewählten Alternative.
3. **Ausgeblendete Stationen:** Bei A→H→C mit ausgeblendetem H wird `A>C` gesucht. Den Transfer gibt es nicht, also `null`.
4. **„0 km“:** Ohne Karte (`karte === null`) ist der Ausschnitt leer, und gedruckt wird „0 km vor Ort gefahren“. `kartenWege` liest nur `activity.position`, die Stationen aber `activity.position ?? poi.position` (`lib/druck/stationen.ts:149`).
5. **Echte 0-km-Wege:** `!(distanceKm > 0)` (`uebersicht.ts:128`) wirft sie hinaus.

**Vorschlag:**
- Nur die gefundenen Paare summieren und zeichnen.
- Gruppenbewusst suchen, wie `transferBetween` in `lib/transfers/timeline.ts`.
- Ohne Karte `null` zurückgeben.
- `Number.isFinite(d) && d >= 0` prüfen.

### N4. Titelfoto: Ersetzen ohne Transaktion (mittel)

`lib/db/trip-titelfoto.ts:100-111` (`entferneBisherige`) liest den Dateinamen, löscht und fügt neu ein, jeweils in einer eigenen Abfrage ohne Transaktion.

**Szenario:** Hochladen und KI-Bild laufen gleichzeitig, etwa in zwei Tabs. Die KI-Anfrage dauert Sekunden, der Fall ist also realistisch.
- Eine Datei bleibt ohne Datensatz in `IMAGE_DIR` liegen. Das verletzt stack.md („kein Bild ohne Datensatz“).
- Oder der Primärschlüssel kollidiert. Dann meldet `app/api/reise-titelfoto/route.ts:151/157` **404 „unknown trip“**, und die KI-Route meldet 500, nachdem sie das bezahlte Bild schon verworfen hat. Die Ursache steht in keinem Log.

**Vorschlag:**
- Die drei Schritte über `withDatabaseClient` in eine Transaktion mit `for update` legen, oder `delete … returning` plus `insert … on conflict (trip_id) do update`.
- Im `catch` die Ursache loggen und 500 statt 404 liefern.

Am Rand: `route.ts:91` löscht ein eigenes oder KI-Titelfoto ohne Rückfrage, sobald ein POI-Foto gewählt wird.

### N5. Chat-Werkzeugschleife (req-093): `pause_turn` und Kontextüberlauf (mittel)

`lib/ai/anthropic-client.ts:464`: Die Schleife endet bei jedem `stop_reason` außer `tool_use`.

- **`pause_turn`:** Eine halbe Antwort wird als vollständig gespeichert. Ohne Text erscheint „hat nichts geantwortet“.
- **`model_context_window_exceeded`:** Das wird nicht als „abgeschnitten“ gemeldet, entgegen req-092. Durch die Werkzeugrunden ist das wahrscheinlicher geworden, denn `poisLesen` und `kostenLesen` haben keine Obergrenze.
- **Text über mehrere Runden** wird ohne Trenner aneinandergehängt (`:388`).
- **`kosten_lesen` mit `datum: null`** (`plan-leser.ts:229-233`) gilt als Frage nach einem Tag statt als Gesamtaufstellung.

**Vorschlag:**
- Bei `pause_turn` die Assistant-Nachricht anhängen und weiter fragen.
- Den Kontextüberlauf wie `max_tokens` behandeln.
- Die Listen kürzen.
- Zwischen den Runden einen Absatz einfügen.
- `datum == null` wie „kein Tag“ behandeln.

### N6. POI-Liste: Suche und Auswahl bleiben beim Reisewechsel stehen (mittel)

`app/plan/components/pois-view.tsx:135-143, :201`: `PoiList` hat keinen `key`. Beim Wechsel bleiben `suche`, `auswahlModus`, `expanded` und die Gegend-Meldung (`use-poi-gegend.ts:26`) stehen.

**Szenario:** In Reise A wird „Gugg“ gesucht, dann wird zu Reise B gewechselt. B zeigt „0 von 32“.

**Vorschlag:** `<PoiList key={tripId} …>` setzen und die Gegend-Meldung im selben Zug zurücksetzen.

### N7. Gegend: alte Werte und Platzhalter (niedrig bis mittel)

- **Alte, lange Gegenden:** Massenaktion (`poi-listen-kopf.tsx:323`) und Formular (`poi-form.tsx:939`) bieten Gegenden von vor req-101 an. Der Server lehnt sie mit 400 ab, die Oberfläche sagt nur „konnte nicht gespeichert werden“. **Vorschlag:** `gegenden.filter(g => !gegendZuLang(g))`.
- **Platzhalter:** `GEGEND_FILTER_OHNE = "ohne"` kollidiert mit dem gültigen Kürzel „OHNE“. Der Vergleich ignoriert Groß- und Kleinschreibung, und es gibt einen doppelten React-Key. **Vorschlag:** ein Wert, den es als Gegend nicht geben kann.
- **Schreibweise:** Der Kommentar in `gegenden.ts:58-73` sagt „erste alphabetisch“, der Code nimmt die erste in POI-Reihenfolge. `poi-listen-kopf.tsx:513` vergleicht exakt. **Vorschlag:** `gleicheGegend` verwenden.
- **Zurücknehmen:** `use-poi-gegend.ts:35, :52` schreibt ganze POI-Objekte zurück und überschreibt dabei neuere Änderungen. **Vorschlag:** nur das Feld `gegend` zurücksetzen.

### N8. Kleinere Befunde (niedrig)

| Ort | Befund |
| --- | --- |
| `lib/db/tages-ueberschriften.ts:70-86, 105-113` | Delete und Insert ohne Transaktion. Eine KI-Antwort kann eine gerade gesetzte Handüberschrift überschreiben; zwei gleichzeitige Schreibvorgänge enden mit 500. Vorschlag: `insert … on conflict … do update … where not von_hand`. |
| `app/api/tages-ueberschriften/route.ts:126` | Das Datum wird nur per Regex geprüft. `2026-02-30` ergibt 500, Tage außerhalb der Reise werden gespeichert. Wird der Zeitraum verschoben, verwaisen die Überschriften. |
| `app/api/poi-gegend/route.ts:18`, `app/api/activity-option-selection/route.ts:12` | `request.json()` ungeschützt. Kaputtes JSON ergibt 500 statt 400. |
| `app/api/reise-titelfoto/route.ts:68/79`, `[tripId]/route.ts:25` | Eine Kennung, die keine UUID ist, ergibt 22P02 und damit 500. |
| `poi-list.tsx:280-284` | Die Auswahl wird schon vor der Rückfrage zum Entfernen geleert. Wer abbricht, muss alles neu ankreuzen. |
| `poi-listen-kopf.tsx:423, :444` | `aria-label` verschluckt die Zahl der Filter und die Sortierung. Es gibt keine Live-Region. `aria-pressed` und eine wechselnde Beschriftung sind doppelt. Escape schließt die Blätter nicht. |
| `planung-view.tsx:257` | Die Gegend-Pillen nehmen auch Gegenden, die nur an „Nein“-POIs hängen. Ein Klick darauf ergibt eine leere Spalte. |
| `app/go/go-view.tsx:287-297` | Ein Echo, das sich dauerhaft nicht nachholen lässt, bleibt für immer liegen und überschreibt bei jedem Laden den Stand des Servers. |
| `app/go/go-view.tsx:338-351` | A, dann B gewählt, und A scheitert: Das Echo von B wird gelöscht. |
| `lib/druck/uebersicht.ts:207` | Geldformat uneinheitlich: „12400 €“ neben „1240,50 €“. Vorschlag: `Intl.NumberFormat("de-DE")`. |
| `lib/druck/karte.ts:87, 144-158` | Bei Zoom 1 doppelte Kacheln und doppelte Keys. Reisen über den 180. Längengrad werden nicht umgebrochen. |
| `app/mein-bereich/page.tsx:96`, `app/plan/accounts/page.tsx:57` | Zwei weitere Stellen leiten „heute“ in UTC ab (zu A5). |

## Prozessbefunde

| # | Befund |
| --- | --- |
| P1 | `delivery/reviews/2026-11-03-code-review-wegfara-bc0e0f4.md` enthält nur den Text des Ersatz-Weckers, nicht den Bericht. Beim Ablegen sollte der Worker prüfen, ob die abgelegte Antwort der Bericht ist, zum Beispiel ob sie „Neue Befunde“ enthält. |
| P2 | Name, Titel und die Notiz bei `:142` von `delivery/bugs/done/bug-073-…-pruefung-ausgesetzt.md` sind veraltet. Der Fluss ist wieder eingeschaltet und der Mangel behoben. |
| P3 | Zu bug-074 (`99e4f42`) gibt es keine Datei unter `delivery/bugs/`. |
| P4 | Die Zeitgrenze der Tests ist erledigt (`vitest.config.ts:31`, 20 s). Das `20000` je Test in `baukasten.test.tsx` ist damit überflüssig. |

## Vorbefunde: Stand am 2026-11-10

| Vorbefund | Stand |
| --- | --- |
| **A1:** Keine Rollenprüfung in `/api/einladungen` und PUT/DELETE `/api/trip-participants` (kritisch) | **Offen, dritte Review in Folge.** `app/api/einladungen/route.ts:19-42`, `app/api/trip-participants/route.ts:49-73, 75-94`. `darfMitreisendeVerwalten` gibt es nur in `go-view.tsx:457` und `go/mitreisende/page.tsx:45`. |
| **A2:** Kein `TZ` im Container (hoch) | **Offen.** `deploy/` setzt kein `TZ`, `lib/live-status/zeit.ts:11` arbeitet mit `getHours()`. bug-071 hat nur das Lesen der Zeitstempel behoben. |
| **A3:** Chat-Antwort landet nach Reisewechsel in der falschen Reise | **Offen.** `chat-fenster.tsx:299-351` und `chat-view.tsx:64` ohne `key`. |
| **A4:** Fehlergründe im Chat | **Offen.** `grundAusStatus` (`senden.ts:72-74`); Ablage ohne Transaktion (`chat-nachrichten.ts:157-178`); kein `AbortSignal` (`route.ts:164`); kein Limit (`:96-107`). |
| **A5:** „Heute“ per `toISOString().slice(0,10)` | **Offen, jetzt sechs Stellen.** `app/page.tsx:40`, `app/go/page.tsx:39`, `app/plan/page.tsx:42`, `app/plan/reiseplan/[tripId]/page.tsx:43` sowie die zwei Stellen aus N8. |
| **A6:** `ensureMapWorkerUrl()` in der Tageskarte | **Offen, elfte Review in Folge.** `day-route-map.tsx:316`. |
| **A7:** Geistbox springt bei 1 px nach oben (bug-066) | **Offen.** `plan-poi.ts:68` mit `Math.floor`, Aufruf aus `drag-preview.ts:88/127`. |
| **A8:** Karte und Spalten werden beim Umschalten neu aufgebaut | **Offen.** `planung-view.tsx:512-533`, `split-view.tsx:169-200`. |
| **A9:** Echo bei `ok:false` (bug-060) | **Im Klick-Pfad behoben** (`go-view.tsx:347-348`). Der Rest steht in N8. |
| **A10:** Einladung löst sich beim Laden selbst ein | **Offen, bewusst so** (bug-068). |
| **A11:** Jedes `role="dialog"` gilt als modal | **Offen.** `bildschirm-regeln.ts:237-243`. |
| **A12:** `meter <= besteMeter` | **Offen.** `standortlage.ts:106`. |
| Zeitgrenze der Tests | **Erledigt** (`8f30813`). |

## Gut gelöst

- **bug-073 ist echt behoben:** `gespeichertUm` und `gelesenUm` vom selben Server, dazu ein zweiter E2E-Fluss für den Wettlauf (`tests/e2e/begleiter.e2e.ts:80, :147`).
- **bug-071:** Nur OID 1114 kommt als Text, alle Leser gehen über `toIsoDateTimeString`.
- **Plan-Leser:** `accountId` und `tripId` werden auf dem Server gebunden, die Felder sind ausdrücklich ausgewählt und die Werkzeugrunden gedeckelt.
- **Migrationen 0052 bis 0055:** `datenbank.md` und die Backup-Reihenfolge sind nachgezogen.
- **Ablage des Titelfotos:** erst die Datei, dann die Zeile, mit Aufräumen bei Fehlern. Dateinamen aus `randomUUID`.
- **POI-Liste und -Auswahl:**
  - Es gibt eine einzige Filterstelle.
  - Massenaktionen wirken nur auf Einträge, die angekreuzt und sichtbar sind.
  - Die gemerkte Ansicht ist sauber geprüft, und der Suchbegriff wird nicht gemerkt.
- **Gegend (req-101):** eine Konstante auf allen Ebenen.
- **Suchgebiet (req-102):** wird über die Sichtbarkeit der Ebenen gesteuert.
- **Druck:**
  - Rechnen und Zeichnen sind getrennt.
  - Die Tagesfarben haben eine Quelle und sind per Test belegt.
  - Das Verkehrsmittel entscheidet nichts.
  - Die Quellenangabe steht unter jeder Karte.
  - Die KI-Überschriften bekommen keine Zahlen, und Handeingaben sind geschützt.
- **CI:** `deploy-dev.yml` testet jetzt wie prod.

## Empfohlene Reihenfolge

1. **A1 + N1:** Rechteprüfung auf dem Server, vor dem nächsten Promote nach prod.
2. **A2:** `TZ` in `docker-compose.yml` setzen.
3. **N2 + N3:** Ausschnitt und Kilometer im gedruckten Plan richtigstellen.
4. **N4:** Titelfoto-Wechsel in eine Transaktion legen.
5. **A6:** `ensureMapWorkerUrl()` aufrufen (zwei Zeilen).
6. **A3 + N5 + A4:** Chat absichern.
7. **N6 + N7:** Zustand der POI-Liste und Gegend-Listen.
8. **A7, A8.**
9. **P1 bis P3.**
10. Rest aus N8.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt am Stand `8dee11d`. Der Code ist identisch mit `bc0e0f4`.

| Prüfung | Ergebnis |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm test`, ein vollständiger Lauf | 405 Dateien, 5668 Tests, alle grün, 158,5 s |

`npm run test:e2e` wurde **nicht** ausgeführt, weil die Datenbank-Umgebung auf den Server der laufenden Umgebung zeigt.

Die Durchsicht lief in vier unabhängigen Teilprüfungen:
- API, Datenbank und Rechte
- Druck (req-103)
- POI-Oberfläche (req-094 bis req-102)
- Chat, Begleiter und Vorbefunde

Selbst im Code nachgeprüft:
- **N1:** Die KI-Route prüft nur `session.accountId`.
- **N2:** Die `vorOrt`-Formel. Die Fälle der Fixture hat eine Teilprüfung mit `npx tsx` nachgerechnet.
- **N3:** Die Summe läuft über `imAusschnitt`.
- **N4:** `entferneBisherige` ohne Transaktion.
- **A2:** Kein `TZ` im Container.
- **A6:** `day-route-map.tsx:316`.

Die übrigen Befunde stammen aus den Teilprüfungen mit Datei und Zeile. Ich habe weder prod noch eine Datenbank der laufenden Umgebungen angefasst. Im Repo wurde nichts geändert, committet oder gepusht. Außerhalb des Repos habe ich eine veraltete Arbeitsnotiz des Workers zur Test-Zeitgrenze korrigiert: Sie nannte noch 5 s, gültig sind jetzt 20 s.
