---
type: code-review
repo: Wegfara
commit: d7c0a8c
date: 2026-10-27
---

# Code-Review: Wegfara (d7c0a8c)

Automatisch erstellt vom appbaua-Worker am 2026-10-27.

---
type: code-review
repo: wegfara
commit: d7c0a8c
date: 2026-10-27
---

# Code-Review: wegfara (d7c0a8c)

Automatisch erstellt am 2026-10-27. Vorgänger: [2026-10-20 (1a2f681)](2026-10-20-code-review-wegfara-1a2f681.md).

## Kurz-Zusammenfassung

Seit der letzten Review kamen neun Requirements und sechs Bugfixes dazu: req-084 bis req-092 sowie bug-065 bis bug-070. Das sind 79 Commits, 181 geänderte Dateien außerhalb von `delivery/` und +17012/−1120 Zeilen.

Die Prüfungen sind grün:
- `npx tsc --noEmit`: fehlerfrei.
- `npm run lint`: fehlerfrei.
- `npm test`: **381 Dateien, 5217 Tests, alle grün** in 211,7 s, ein vollständiger Lauf.

Alle neun Requirements stehen zu 100 % auf `[x]`. Das Muster aus N1 der Vorwoche (done mit offenen Kriterien) hat sich nicht wiederholt.

**Der schwerste Befund dieser Woche ist eine Rechtelücke.** Er ist nicht durch req-087 entstanden, req-087 hat ihn aber sichtbar gemacht:
- Die Schnittstellen zum Einladen (`POST /api/einladungen`) und zum Verwalten der Reiseteilnehmer (`PUT`/`DELETE /api/trip-participants`) prüfen serverseitig nur Sitzung und Account, **keine Rolle**.
- Jede angemeldete Person kann so einen Zugangslink für jede andere Person des Accounts erzeugen und sich als diese anmelden, auch als Reiseleiter oder Account-Admin.
- req-087 führt mit `darfMitreisendeVerwalten` genau die passende Regel ein, wendet sie aber nur in der Oberfläche an.

Zweitwichtigster Befund: Die Verzugsrechnung von req-084 läuft auf dem Server in der Zeitzone des Containers. Der Container setzt keine Zeitzone, also läuft er in UTC, die Programmpunkte stehen aber in Ortszeit.

## Neue Befunde

### N1. Einladen und Rollen ändern ohne serverseitige Rechteprüfung — Identitätsübernahme im Account (kritisch)

`app/api/einladungen/route.ts:19-50` verlangt nur `currentSession()` und reicht dann `session.accountId` und eine frei gewählte `participantId` an `inviteTripParticipant` weiter. `lib/invitations/create-invitation.ts:26-40` prüft nur zwei Dinge:
- `findParticipantInAccount`: Gehört die Person zum Account?
- `isInAnyTrip`: Ist sie irgendeiner Reise zugeordnet?

Ob der Aufrufer Reiseleiter einer Reise dieser Person oder Account-Admin ist, prüft niemand.

**Szenario:**
1. Ein einfacher Teilnehmer schickt `POST /api/einladungen {"participantId": "<Id des Reiseleiters oder Admins>"}`.
2. Die Antwort enthält die Einladungs-URL im Klartext.
3. Wer sie öffnet, ist nach `redeemAccessLink` → `beginSession` mit voller Sitzung diese Person. Seit req-085 ist das auch ohne Passkey möglich.
4. Nebenbei wird der gültige Link des Opfers entwertet (`issueInvitation` → `invalidateAccessLinks`), und das Opfer bekommt zusätzlich eine Einladungsmail.

Genauso offen ist `app/api/trip-participants/route.ts:49-98`. `PUT {tripId, participantId: <eigene Id>, role: "reiseleiter"}` macht jeden Teilnehmer zum Reiseleiter jeder Reise des Accounts, auch einer, der er nicht angehört. Damit sieht er deren Daten. Das verletzt `delivery/security.md:91` („Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren“).

Die Regel existiert seit req-087 bereits: `lib/trip-participants/rules.ts:166` (`darfMitreisendeVerwalten`). Benutzt wird sie aber nur in `app/go/go-view.tsx:379` (Eintrag unter „Mehr“ ausblenden) und `app/go/mitreisende/page.tsx:45` (Seite sperren), nicht in den API-Routen. Auch im Planer rendert `reisedetails-view.tsx` die `TripParticipantsCard` für jeden, der die Reise sieht.

Die Lücke ist älter als dieser Stand, denn die Route ist seit req-023/req-038 so gebaut. Durch req-085 und req-087 ist sie aber deutlich wichtiger geworden:
- Einladungen gehen jetzt per Mail hinaus.
- Der Einstieg liegt jetzt im Begleiter, den alle Teilnehmer nutzen.

**Vorschlag:**
- In `POST /api/einladungen`, `PUT` und `DELETE /api/trip-participants` serverseitig dieselbe Regel wie `darfMitreisendeVerwalten` erzwingen: Reiseleiter einer Reise, der die betroffene Person angehört, oder Account-Admin. Sonst 403.
- Admins nur durch Admins einladen lassen.
- Je Route einen API-Test mit einer Teilnehmer-Sitzung ergänzen, der 403 erwartet.
- Das sollte vor dem nächsten Promote nach prod passieren.

### N2. Verzug auf dem Weg (req-084) rechnet in der Zeitzone des Servers (hoch)

`lib/live-status/zeit.ts:7-13` (`lokaleZeit`) und `:26-32` (`minutenBis`) rechnen mit `getHours()` bzw. `new Date(j, m, t, h, min)`, also in der Zeitzone des Prozesses. Der Kommentar sagt das selbst („Zeitzone des Geraets bzw. des Servers“).

`app/api/live-status/route.ts:40` gibt `new Date()` an `ermittleStandortlage` weiter. Dort rechnen `standortlage.ts:58` und `verzug.ts:70` (`minutenBis(startAt, ab)`) auf dem Server. Weder `deploy/Dockerfile` noch `deploy/docker-compose.yml` setzen `TZ`, der Container läuft also in UTC. Die Programmpunkte stehen dagegen in Ortszeit.

**Szenario:** Winter (UTC+1), 10:30 Ortszeit, der nächste Punkt beginnt um 13:30, die Fahrzeit beträgt 200 Minuten.
- Der Server sieht „jetzt“ als 09:30 und rechnet mit 240 statt 180 verbleibenden Minuten.
- Die Pille zeigt „Ankunft im Plan“ statt „20 Min zu spät“. Im Sommer liegt sie um 120 Minuten daneben.
- Zwischen 0 und 1 bzw. 2 Uhr Ortszeit fragt der Server außerdem den Vortag ab.

Die Tests laufen in der lokalen Zeitzone und zeigen das deshalb nicht.

**Vorschlag:**
- Kurzfristig `TZ=Europe/Berlin` (bzw. die Betreiberzone) in `docker-compose.yml` setzen.
- Sauber wäre, die lokale Zeit des Geräts mit der Anfrage zu schicken oder eine Reisezeitzone einzuführen.

Der Befund überschneidet sich mit dem offenen Vorbefund zu den „Heute“-Ableitungen. `route.ts:43` nutzt `toIsoDate()`, also eine dritte Variante.

### N3. Chat: Antwort landet nach Reisewechsel in der falschen Reise (Vorbefund, jetzt durch Code-Lesung eindeutig) (hoch)

`app/plan/components/chat-fenster.tsx:244-298`: Die Anfrage selbst trägt die richtige `tripId` (`:260`). Die Rückrufe `text`/`antwort`/`fehler` prüfen aber nie, ob noch dieselbe Reise offen ist. Dazu kommen zwei Dinge:
- Der Rücksetz-Block `:171-181` setzt weder `laeuft` noch `offeneFrage` zurück.
- `ChatFenster` hat in `chat-view.tsx:64` keinen `key`.

**Szenario:** Ich frage in Reise A und wechsle zu Reise B. Kommt die Antwort an, hängt `:282` sie an die Unterhaltung von B. Scheitert sie, setzt `:291` die Frage aus A als offene Frage, und „Erneut senden“ (`:452`) schickt sie mit der `tripId` von B. Der Server legt sie dann dauerhaft in B ab.

Damit ist die widersprüchliche Messung aus N4 der Vorwoche zumindest für den Fehlerpfad aufgelöst: Die falsche Zuordnung wird persistiert.

**Vorschlag:** Wie in den Vorwochen. Gefragte `tripId` in einer Ref festhalten und jedes Ereignis verwerfen, wenn sie nicht mehr passt. Oder `<ChatFenster key={tripId}>` zusammen mit Abbruch (siehe N9).

### N4. bug-068 als erledigt abgelegt, die korrigierte Diagnose aber nicht behoben (mittel, Prozess)

Die Bug-Datei wurde in `ddadf7e` auf „Passkey ohne Geräte-Merker unerreichbar (Diagnose korrigiert)“ umgeschrieben. Der Fix `9b67496` setzt dagegen die *ursprüngliche* Diagnose um: Link-Vorschau verbraucht den Token, daher GET → Seite + POST. Das ist für sich sinnvoll.

Die korrigierte Ursache besteht weiter:
- In `app/anmeldung/anmelde-view.tsx:83` erscheint ohne Merker sofort der Dialog. Darin steht nur „Zugang verloren“ und kein Weg zum vorhandenen Passkey.
- `InvalidStateError` auf der Einladungsseite (`lib/auth/passkey-fehler.ts:34`) führt nicht zur Anmeldung mit dem vorhandenen Passkey.

Seit req-085 kommt die Person über „Ohne Passkey weiter“ zwar trotzdem hinein, ihr Passkey bleibt aber unerreichbar.

**Vorschlag:** Einen Folge-Bug mit der korrigierten Diagnose anlegen, oder bug-068 wieder öffnen. Bug-Datei und Fix passen derzeit nicht zueinander.

### N5. Einladungsseite löst beim Laden von selbst ein — Mail-Scanner verbrauchen den Link (mittel)

`app/einladung/einladung-annehmen-view.tsx:28-33` schickt das POST-Formular beim Laden per JavaScript automatisch ab.

**Szenario:** Mail-Scanner, die Seiten mit JavaScript rendern (Safe-Links-artige Dienste), lösen die Einladung beim Prüfen ein. Die Person sieht danach „Einladung ungültig“, also genau das Symptom, das bug-068 beheben sollte. Seit req-085 gehen Einladungen per Mail hinaus, das Risiko ist damit neu.

**Vorschlag:** Erst auf eine echte Geste hin einlösen. Das ist eine bewusste Abwägung gegen „ohne Knopfdruck“ (req-066) und sollte im Requirement festgehalten werden.

### N6. Geistbox springt bei 1 px nach oben eine Rasterstufe (bug-066 nur zur Hälfte behoben) (mittel)

`lib/plan/drag-preview.ts:120-127` liefert Beginn + Strecke in Minuten. `snapStartMinutes` (`lib/plan/plan-poi.ts:68`) rundet mit `Math.floor` ab.

**Szenario:** Ein Block beginnt um 10:00. 1 px Zittern nach oben ergibt 599,x Minuten, abgerundet also 9:45. Nach unten springt die Box erst nach einer vollen Stufe. Mit dem Finger auf dem iPad passiert das praktisch bei jedem Anfassen. Kein Test deckt eine kleine Bewegung nach oben ab.

**Vorschlag:** Die Strecke auf Rasterschritte runden (`start + Math.round(strecke / raster) * raster`) und dafür einen Test ergänzen.

### N7. iPad hochkant (req-088): Umschalten baut Karte und Spalten neu auf (mittel)

- **Karte:** `planung-view.tsx:491` und `split-view.tsx:147` bauen bei schmaler Breite die nicht gezeigte Seite ab. Dabei entsteht `DayRouteMap` neu, `framedRef` beginnt wieder bei null, und der Kartenausschnitt springt auf alle Wegpunkte zurück. Das ist eine Regression gegenüber dem Ziel von bug-065.
- **Spalten:** Über die 1180-px-Grenze hinweg (iPad Pro beim Drehen) wechseln `planung-view.tsx:472` und `split-view.tsx:120` die Baumstruktur ohne stabile `key`s. Ein halb ausgefülltes POI-Formular oder ein Chat-Entwurf geht verloren, obwohl der Kommentar in `split-view.tsx` den Erhalt verspricht.

**Vorschlag:** Die Karte wie die linke Seite mit `hidden` stehen lassen und `resizeMap` beim Einblenden aufrufen. Zudem stabile `key`s bzw. eine gleichbleibende Struktur, deren Layout nur per CSS wechselt.

### N8. Chat (req-090/092): Fehlergründe und Stopp-Gründe unvollständig (mittel)

1. **Stopp-Gründe:** `lib/ai/anthropic-client.ts:264-287` behandelt nur die `stop_reason`s `refusal` und `max_tokens`.
   - `model_context_window_exceeded` legt eine abgeschnittene Antwort als vollständig ab. Das widerspricht req-092 („abgeschnitten muss weiterhin greifen“).
   - `pause_turn` nach einer Suche ohne Text ergibt „hat nichts geantwortet“.
2. **Modellfehler als Störung:** `app/api/chat/route.ts` weist ein unbekanntes Modell mit 400 ab. `lib/chat/senden.ts:63-65` (`grundAusStatus`) bildet aber jeden Status außer 409 auf „dienst“ ab.
   - **Szenario:** Der Planer ist lange offen, und das gewählte Modell fällt nach der Auffrischung des Katalogs heraus. Jede Frage meldet dann „Störung, später erneut versuchen“, der wahre Grund geht verloren.
   - Genau dieses Muster schließt `stack.md` aus („ein `catch`, der jeden Grund auf denselben Satz abbildet“).
3. **Ablage ohne Transaktion:** `lib/db/chat-nachrichten.ts:133-152` legt Antwort und Quellen ohne Transaktion ab. Scheitert eine Quelle, steht die Antwort halb in der Datenbank, und der Browser meldet „nicht erreichbar“. Ein erneutes Senden legt die Frage dann doppelt an.

**Vorschlag:**
- `model_context_window_exceeded` wie `max_tokens` behandeln.
- `pause_turn` fortsetzen oder benennen.
- Für ein unbekanntes Modell einen eigenen Fehlercode senden, den der Browser auf „modell“ abbildet, und dabei den Katalog neu laden.
- Die Ablage per `withDatabaseClient` in eine Transaktion legen.

### N9. Chat-Vorbefunde unverändert offen (mittel/niedrig)

- **Kein Abbruch:** In `route.ts`, `lib/chat/senden.ts` und `anthropic-client.ts` gibt es kein `request.signal` und kein `AbortSignal`. Mit der Web-Suche ist das teurer geworden: Suchen laufen und kosten weiter, auch wenn das Fenster zu ist.
- **Verlaufslänge:** `listChatNachrichten` (`chat-nachrichten.ts:81-88`) hat weiterhin kein Limit. Wird das Kontextfenster überschritten, endet das jetzt zusätzlich in N8.1. `kontextTokens` aus dem Modell-Katalog wäre ein fertiges Maß zum Kürzen.
- **Agent-SDK-Kommentar** (`anthropic-client.ts:29`): unverändert.

### N10. Kleinere Befunde (niedrig)

| Ort | Befund |
| --- | --- |
| `lib/live-status/standortlage.ts:106` | `meter <= besteMeter`: Bei zwei Punkten am selben Ort (Frühstück/Abendessen im Hotel) gewinnt der zuletzt iterierte. Die GPS-Linie steht dann morgens beim Abendessen. Lieber `<` verwenden und bei Gleichstand den zeitlich nächsten Punkt nehmen. |
| `app/go/components/use-live-lage.ts:29-38` | Der Startwert der Uhr kommt vom Server (UTC), `setZeit` folgt erst nach 20 s. „Jetzt“ steht also kurz falsch und springt dann. Bei Reisewechsel bleibt die Lage der alten Reise stehen. |
| `lib/routing/osrm-client.ts:119,141` | Ein Zeitüberlauf beim *Lesen* der Antwort gilt als `endgueltig` und wird nicht wiederholt, entgegen stack.md. Bei 5xx/429 wird der Inhalt nicht verworfen, und `Retry-After` wird ignoriert. |
| `lib/live-status/fahrzeit-cache.ts:27` | Die Map im Modul-Scope wird nie aufgeräumt. Auch eine fachliche „keine Route“ holt einen alten Wert hervor. |
| `lib/chat/modell-katalog-cache.ts:31-61` | Der Cache-Schlüssel ist nur der Account, nicht der API-Schlüssel. Nach einem Schlüsselwechsel gilt die alte Modellliste bis zu 6 h. |
| `lib/invitations/create-invitation.ts:79-82` | Entwerten und Neuanlage laufen ohne Transaktion. Zwei gleichzeitige Einladungen ergeben zwei gültige Links. |
| `lib/db/trip-participants.ts:153-202` | Prüfung „letzter Reiseleiter“ und Schreiben laufen ohne Sperre. Wenn sich zwei Reiseleiter gleichzeitig herabstufen, hat die Reise keinen mehr. |
| `lib/mail/smtp-mailer.ts:44` | Keine SMTP-Timeouts. Bei einem hängenden Mailserver wartet „Einladen“ bis zu 2 min. |
| `app/api/auth/einladung/route.ts` | Keine Origin-Prüfung, also Login-CSRF mit eigenem Token möglich. Das gab es schon vorher, mit dem alten GET sogar leichter. |
| `lib/design/bildschirm-regeln.ts:237-257` | Jedes sichtbare `[role="dialog"]` gilt als modal. Das nicht-modale Dropdown `reisewahl.tsx:118` schaltet damit die Prüfung für den Rest der Seite ab, genau bei „offenen Dropdowns“, die req-089 abdecken soll. Nur `aria-modal="true"` als modal werten. |
| `lib/design/bildschirm-regeln.ts:184-189` | Abgeschaltete Knöpfe fallen auch aus der Tippziel-Regel. |
| `scripts/baukasten-export.mjs:135-139` | Die Mockups setzen die Begleiter-Schriften an `:root`, auch für Planer-Seiten (die App nutzt dort Figtree/Playfair). Damit brechen die Mockups anders um als die App. |
| `lib/marke.ts:22`, `lib/icon/icon-farben.ts:14-15`, `app/go/theme.module.css` vs. `lib/theme/themes.ts` | Es gibt weiterhin zweite Farbquellen ohne Gleichheitstest gegen `FARBWELT_PLANER` bzw. das Thema `light`. |
| `app/plan/baukasten/katalog-view.tsx:104-112`, `bausteine.tsx:506-515` | Rund 80 iframes ohne `loading="lazy"`. Der echte „Abmelden“-Knopf in der Katalog-Seitenleiste meldet den Admin tatsächlich ab. |
| `lib/activities/text-anfang.ts` | Abkürzungen („z. B.“, „ca.“) gelten als Satzende. Kosmetisch. |

## Vorbefunde: was ich nachgemessen habe

| Vorbefund | Stand am 2026-10-27 |
| --- | --- |
| **#1 `ensureMapWorkerUrl()` in jeder Karte** | **Offen, neunte Review in Folge.** `day-route-map.tsx:310` ruft `new MapLibreMap(` ohne vorherigen Aufruf; `map-view.tsx:201` und `poi-map.tsx:756` rufen ihn. Seit req-088 kann die Tageskarte auf dem iPad die erste Karte der Sitzung sein, das macht den Befund wahrscheinlicher. |
| **#2 `testTimeout` in `vitest.config.ts`** | **Offen.** Nicht vorhanden. Der volle Lauf war diese Woche grün. |
| **req-082 (N1 der Vorwoche)** | **Offen, unverändert.** Weiter in `done/` mit 1 von 16 Kriterien. `DURATION_STEP_MINUTES = 15` steht unabhängig in `lib/pois/estimated-duration.ts:4`, und `ZOOM_STUFEN_PX` (`lib/plan/timeline-zoom.ts:33`) endet weiter bei 176. |
| **Pfeil-Test (N2 der Vorwoche)** | **Offen.** Weiter `findByTestId` auf den Nachbar-Block statt `waitFor` auf die Pfeile. Diese Woche nicht aufgetreten. |
| **bug-060, Echo bei `ok:false` (N3)** | **Offen.** `go-view.tsx:250` lässt das Echo ohne Hinweis stehen. |
| **Chat-Reisewechsel (N4)** | **Offen**, jetzt als N3 mit eindeutigem Fehlerpfad. |
| **Chat: Abbruch, Verlaufslänge, SDK-Kommentar (N5)** | **Offen**, siehe N9. |
| **Eigene „Heute“-Ableitungen** | **Offen.** `toISOString().slice(0,10)` in `app/page.tsx:40`, `app/go/page.tsx:39`, `app/plan/page.tsx:40` und `app/plan/reiseplan/[tripId]/page.tsx:37`. Die Stellen `lib/trips/ende-vorschlag.ts` und `lib/backup/database.ts` rechnen bewusst in UTC mit gegebenen Daten und sind korrekt; sie fallen damit aus der Zählung. Neu dazu kommt `app/api/live-status/route.ts:43` mit `toIsoDate()`, siehe N2. |

## Gut gelöst

- **Abnahme-Disziplin:** req-084 bis req-092 sind ausnahmslos zu 100 % abgehakt. Für keines der Kriterien fand sich ein Gegenbeweis im Code (Grenzfälle siehe N2, N8, N10).
- **Einlösen von Zugangslinks:** `consumeAccessLink` ist ein einziges bedingtes `UPDATE … WHERE used_at IS NULL AND expires_at > now RETURNING`, atomar gegen gleichzeitiges Einlösen. Gespeichert wird nur die Prüfsumme, und GET verbraucht seit bug-068 nichts mehr. Die Einladungsmail enthält keine Reisedaten, und Tokens stehen in keinem Log.
- **bug-067 (Routing-Ausfall):** `AbortSignal.timeout` ohne Leaks, höchstens zwei Wiederholungen, nie bei einer fachlichen Antwort. Das Logformat `routing: profil=… versuch=n/3 grund=…` enthält keine Koordinaten. Der Fahrzeit-Cache ist auf den Live-Status beschränkt, und `tripId` wird vorher über die Sitzung geprüft.
- **req-092 Stream-Parsing:** `server_tool_use`, `web_search_tool_result` und Zitate werden sauber getrennt. Zitate kommen nur als http(s), je Adresse einmal, und Suchfehler werden einzeln benannt. Mandantentrennung bei `chat_nachricht`/`chat_quelle` gilt lückenlos über `join trip … account_id`. Migration 0051, CHECK-Werte, `ON DELETE CASCADE`, Backup-Reihenfolge und `datenbank.md` passen zusammen.
- **req-090 Modell-Katalog:** Nur aktive Modelle, eine Zeitgrenze von 10 s. Gleichzeitige Anfragen eines Accounts werden zusammengelegt, und ein Ausfall fällt auf den gemerkten Stand zurück. Zwischen Accounts wird nichts gemischt.
- **req-089/091 Baukasten:** `/plan/baukasten` ist nur für den Gesamt-Admin erreichbar (404 vor `findeBaustein`, E2E-belegt). Die Tokens haben eine Quelle (`lib/design/stil.ts`). Die Kontrastformel entspricht exakt WCAG 2.1. Die erzeugten Dateien werden per Test Zeichen für Zeichen gegen das Erzeugte geprüft, und `screen-check.ts` nutzt jetzt dieselben Regeln wie die Mockups statt einer Kopie. Die Farbwerte stimmen mit allen fünf alten Blättern überein; einzige Ausnahme ist das dokumentierte `--warn`.
- **bug-065/066/070:** Kartenausschnitt mit sauberem Gebietsschlüssel, Vorschau und Ablage nutzen dieselbe Funktion (`timelineDragTimes`), und die Trefferfläche bleibt per `::after` 44 px hoch.

## Empfohlene Reihenfolge

1. **N1: Rechteprüfung in `/api/einladungen` und `/api/trip-participants`.** Sicherheitslücke, vor dem nächsten Promote nach prod.
2. **N2: `TZ` im Container setzen.** Eine Zeile in `docker-compose.yml` behebt die falschen Verzugsangaben im Betrieb.
3. **N3: `tripId`-Absicherung im Chat-Fenster.** Seit drei Reviews offen, jetzt mit Datenschaden in der falschen Reise.
4. **N8 + N9: Stopp-Gründe, Modellfehler, Abbruch und Verlaufsgrenze im Chat.** Mit der Web-Suche sind sie teurer geworden.
5. **N6: Rundung in der Geistbox**, damit bug-066 auf dem iPad wirklich behoben ist.
6. **N7: Karte und Spalten beim Umschalten stehen lassen.**
7. **N4/N5: Folge-Bug zu bug-068 anlegen** und das automatische Einlösen abwägen.
8. **Vorbefund req-082** nachziehen oder zurückstufen; **Vorbefund #1** (`ensureMapWorkerUrl`, zwei Zeilen).
9. Die übrigen Befunde aus N10 nach Gelegenheit.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt am Stand `d7c0a8c`:

| Prüfung | Ergebnis |
| --- | --- |
| `npx tsc --noEmit` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm test`, ein vollständiger Lauf | 381 Dateien, 5217 Tests, alle grün, 211,71 s |

`npm run test:e2e` wurde **nicht** ausgeführt, aus demselben Grund wie in den Vorgängern: Die Datenbank-Umgebung zeigt auf den Server der laufenden Umgebung, und ein autonomer Lauf legt dort keine Wegwerf-Datenbank an.

Die Durchsicht lief in vier unabhängigen Teilprüfungen: Chat (req-090/092), Einladung/Auth (bug-068, req-085/087), Live-Status/Routing/Planer (bug-065 bis bug-070, req-084/086/088) und Baukasten (req-089/091). Die schwersten Befunde habe ich selbst im Code nachgeprüft:
- **N1:** beide Routen ohne Rollenprüfung, `darfMitreisendeVerwalten` nur in UI-Dateien.
- **N2:** kein `TZ` in `deploy/`, `minutenBis` in `verzug.ts:70` auf dem Server.
- **N3:** kein `key` an `ChatFenster`.
- **N4:** Commits `ddadf7e`/`9b67496`.
- **N6:** `Math.floor` in `snapStartMinutes`.
- **N8.2:** `grundAusStatus`.
- **N10:** `role="dialog"` ohne `aria-modal` in `reisewahl.tsx:118`.

Die übrigen Befunde aus N10 sind aus den Teilprüfungen mit Datei:Zeile übernommen und nicht einzeln nachgemessen. Kein Zugriff auf prod, keine Datenbank der laufenden Umgebungen angefasst, kein Netzaufruf nach außen. `git status` war am Ende sauber. Es wurde nichts committet und nichts gepusht.
