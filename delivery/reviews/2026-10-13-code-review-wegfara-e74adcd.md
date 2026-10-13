---
type: code-review
repo: Wegfara
commit: e74adcd
date: 2026-10-13
---

# Code-Review: Wegfara (e74adcd)

Automatisch erstellt vom appbaua-Worker am 2026-10-13.

Review complete. Working tree is clean, both throwaway measurement files removed, nothing committed.

---

```
---
type: code-review
repo: wegfara
commit: e74adcd
date: 2026-10-13
---
```

# Code-Review: wegfara (e74adcd)

Automatisch erstellt vom appbaua-Worker am 2026-10-13. Vorgänger: [2026-10-06 (6162b77)](2026-10-06-code-review-wegfara-6162b77.md).

## Kurz-Zusammenfassung

Anders als letzte Woche hat sich diesmal viel bewegt: **12.963 neue Zeilen** in zwei Strecken — req-080 (Reiseplan zum Ausdrucken) und req-081 (Chatfenster im Planer). `npx tsc --noEmit` und `npm run lint` sind fehlerfrei. `npm test` lief **zweimal** vollständig grün: 4624 Tests in 362 Dateien, **187,12 s** und **158,55 s**. Die Streuung ist damit auf 18 % gefallen (letzte Woche 58 %) — der Vorbefund „kein `testTimeout`" bleibt trotzdem offen, denn die Absicherung fehlt weiter, es war diesmal nur reichlich Luft.

Die Strecke req-081 ist handwerklich sorgfältig: Schema, Migrationen und `datenbank.md` stimmen überein, die Mandantentrennung läuft sauber über die Reise, die Fehler-Taxonomie aus bug-032 ist durchgezogen. **Die drei Modellkennungen sind korrekt** — `claude-opus-5`, `claude-sonnet-5` und `claude-haiku-4-5` sind alle drei gültige aktuelle Kennungen, und sie stehen tatsächlich an genau einer Stelle. Das ist die Art Detail, die oft falsch ist; hier ist es richtig.

Die beiden schwerwiegenden Befunde liegen beide dort, wo der Chat auf **Zeit** trifft — und beide habe ich gemessen, nicht vermutet:

**N1: Das Antwort-Budget deckt das Nachdenken mit, und das Anstoßen an die Grenze wird nicht bemerkt.** `max_tokens: 8192` steht fest, `thinking` und `effort` bleiben bewusst unberührt. Bei Opus 5 und Sonnet 5 ist Nachdenken aber die **Vorgabe** des Dienstes, und `max_tokens` begrenzt Nachdenken **plus** Antworttext gemeinsam. Gemessen: Frisst das Nachdenken das Budget, meldet die App „Der KI-Dienst hat nichts geantwortet" — was nicht stimmt. Reicht es für eine halbe Antwort, wird die **abgeschnittene Antwort als fertige abgelegt**, ununterscheidbar von einer vollständigen. `stop_reason` wird nur gegen `"refusal"` geprüft; `"max_tokens"` fällt stumm durch.

**N2: Ein Reisewechsel mitten in der Antwort zeigt sie in der falschen Reise.** Gemessen: Verlauf der Reise Wien nach dem Wechsel = `'Wien-Frage MOSEL-ANTWORT-GANZ Sonnet 5'`. Das verletzt ein Akzeptanzkriterium, das in req-081 als erfüllt abgehakt ist. Der Lade-Effekt hat eine Verfallsprüfung (`aktuell`), die laufende Antwort hat keine.

**N4: Der Constraint „Anthropic über das Agent SDK" ist nicht erfüllt** — verwendet wird `@anthropic-ai/sdk` mit `messages.stream()`, also genau der „einfache Nachrichten-Aufruf", den der Constraint ausschließen wollte. Die Wahl ist inhaltlich vertretbar, aber sie ist nirgends als Abweichung vermerkt; stattdessen wurde `stack.md` auf den Code umgeschrieben.

## Neue Befunde

### N1. Nachdenken und Antwort teilen sich 8192 Tokens — und die Grenze wird nicht bemerkt (hoch)

`lib/ai/anthropic-client.ts:29` setzt die Obergrenze, mit einer sauberen Begründung:

```ts
const MAX_TOKENS = 8192;
```

Und `lib/ai/anthropic-client.ts:87-91` entscheidet bewusst, nichts weiter zu setzen:

> *„Das Modell bekommt keine Werkzeuge (req-081, Constraints). `thinking` und `effort` bleiben unberuehrt: jedes der drei Modelle hat dafuer andere erlaubte Werte, und die Vorgabe des Dienstes ist bei allen dreien nutzbar — eine eigene Einstellung waere je Modell eine andere und damit eine zweite Liste, die veraltet."*

Die Sorge vor einer zweiten Liste ist berechtigt. Die Schlussfolgerung stimmt nicht: **die Vorgabe des Dienstes ist bei den drei Modellen nicht dieselbe Vorgabe.**

| Modell | `thinking` weggelassen heißt… | Vorgabe `effort` |
| --- | --- | --- |
| `claude-opus-5` | **adaptives Nachdenken ist an** | `high` |
| `claude-sonnet-5` | **adaptives Nachdenken ist an** | `high` |
| `claude-haiku-4-5` | kein Nachdenken | kennt `effort` nicht |

Dazu zwei Eigenschaften, die zusammen den Befund ergeben:

1. **`max_tokens` ist eine harte Grenze für Nachdenken *und* Antworttext gemeinsam.** Die 8192 Tokens sind nicht 8192 Tokens Antwort, sondern 8192 Tokens Nachdenken plus Antwort.
2. **Die Denk-Tokens werden nicht ausgeliefert.** Die Anzeige-Vorgabe ist „omitted", die Denk-Blöcke kommen also ohne Text — es entstehen keine `text_delta`, solange nachgedacht wird.

Bei der Vorgabe Sonnet 5 und erst recht bei Opus 5 auf `effort: high` ist das kein Randfall: Die Modellauswahl bietet „Opus 5 — stark, teuer" an, also genau für die schweren Fragen, bei denen am längsten nachgedacht wird.

**Gemessen** (Wegwerf-Testdatei unter `lib/ai/`, Antwort des Dienstes als Ereignisstrom nachgebildet, danach entfernt):

| Fall | Strom | Ergebnis |
| --- | --- | --- |
| A | Denk-Block, dann `stop_reason: "max_tokens"`, kein Text | `text=''`, `fehler={ art: 'leer', detail: 'Antwort ohne Inhalt.' }` |
| B | Denk-Block, halbe Antwort, dann `stop_reason: "max_tokens"` | `text='Der erste Tag beginnt in Bernkastel und dann'`, **`fehler=null`** |
| C | Gegenprobe, `stop_reason: "end_turn"` | `text='Gern.'`, `fehler=null` |

**Fall A** ist eine falsche Aussage an den Nutzer. Er liest (`lib/ai/fehler.ts`):

> „Der KI-Dienst hat nichts geantwortet. Bitte erneut versuchen."

Der Dienst hat sehr wohl geantwortet — und die Antwort kostet Geld, abgerechnet über den Schlüssel des Accounts. Der Rat „bitte erneut versuchen" führt beim zweiten Mal zum selben Ergebnis, weil die Ursache die feste Obergrenze ist und nicht ein Zufall. Der Kommentar bei `anthropic-client.ts:137-138` begründet diesen Zweig mit *„Der Dienst hat geantwortet, aber ohne ein Wort"* — ein Fall, der so gar nicht eintritt.

**Fall B ist der schwerere.** `fehler=null` heißt für `app/api/chat/route.ts:176-183`: die abgeschnittene Antwort wird ganz normal mit `createChatNachricht` abgelegt. Sie steht danach als vollständige Antwort im Verlauf, überdauert das Neuladen, und nichts an ihr sagt, dass sie mitten im Satz endet. Im nächsten Zug geht sie als Zusammenhang wieder an das Modell. Die einzige Spur ist der abgebrochene Satz selbst.

Dass das nicht auffiel, hat einen Grund im Test: `lib/ai/anthropic-client.test.ts:205` heißt *„begrenzt die Laenge einer Antwort"* und prüft

```ts
expect(gesendet(fetchMock).max_tokens).toBe(8192);
```

— also dass die Grenze **gesendet** wird, nicht was beim **Anstoßen** geschieht. Von den Abschlussgründen sind nur `end_turn` (Zeile 113) und `refusal` (Zeile 324) abgedeckt; `max_tokens` kommt in der ganzen Datei nicht vor.

**Vorschlag, in dieser Reihenfolge:**

1. **`stop_reason: "max_tokens"` behandeln** — als benannter Grund (`AiFehlerArt`, etwa `"abgeschnitten"`) mit einem Satz, der sagt, was wirklich war: die Antwort wurde zu lang. Dazu der Repro-Test aus Fall B, der heute rot wäre. Das allein beendet die stille Ablage halber Antworten.
2. **`thinking` und `effort` bewusst setzen, nicht bewusst weglassen.** Die Sorge vor der zweiten Liste löst sich, wenn die Einstellung **am Modelleintrag** in `lib/chat/modelle.ts` steht statt im Client — dann bleibt es eine Liste. Für ein Gespräch ohne Werkzeuge ist `effort: "low"` oder `"medium"` bei Opus 5 und Sonnet 5 sachlich richtig und spart dem Account Geld; Haiku 4.5 bekommt kein `effort`, weil es damit einen Fehler liefert.
3. **`max_tokens` erhöhen**, sobald Nachdenken an bleibt — 8192 für Nachdenken plus Antwort ist bei `effort: high` knapp.
4. Wird das Nachdenken bewusst angelassen, gehört die Anzeige-Vorgabe `display: "summarized"` dazu: sonst steht die Blase leer, solange nachgedacht wird. Der Knopf sagt immerhin „Antwortet…", das mildert es — aber das Kriterium *„dann wächst sie sichtbar"* ist erst nach dem Nachdenken erfüllt.

> Zur Einordnung: Punkte 1 bis 3 sind keine Geschmacksfrage. Die Herstellerhinweise für den Wechsel auf Opus 5 führen genau diese Konstellation — eine Strecke, die `thinking` nie gesetzt hat — als blockierenden Punkt: *„it now thinks, and `max_tokens` caps thinking + response text together. Raise `max_tokens` … otherwise responses truncate mid-answer."*

### N2. Ein Reisewechsel mitten in der Antwort zeigt sie in der neuen Reise (hoch)

`app/plan/components/chat-fenster.tsx:72-86` wirft beim Reisewechsel den Stand der vorigen Reise während des Renderns weg, mit einer ausdrücklichen Begründung:

> *„die Komponente bleibt dabei gemountet, ihr Zustand waere sonst der der vorigen Reise — fuer einen Augenblick stuende deren Unterhaltung unter dem Namen der neuen."*

Genau dieser Fall tritt trotzdem ein, nur über einen anderen Weg. Der **Lade**-Effekt ist gegen das Überholen abgesichert (`chat-fenster.tsx:91-103`, `let aktuell = true` und die Prüfung `if (!aktuell) return`). Die **laufende Antwort** ist es nicht: die Rückmeldungen, die `frageSenden` an `sendeChatFrage` übergibt (`chat-fenster.tsx:120-145`), rufen `setEntstehend`, `setNachrichten` und `setOffeneFrage` ohne jede Prüfung, zu welcher Reise sie gehören.

**Gemessen** (Wegwerf-Testdatei unter `app/plan/components/`, danach entfernt). Ablauf: Frage in der Mosel-Reise senden → Strom liefert die Frage und hält an → auf die Wien-Reise wechseln → erst danach Text und fertige Antwort nachschieben:

```
NACH WECHSEL, vor der Antwort: 'Wien-Frage'
NACH DER ANTWORT, Verlauf von WIEN: 'Wien-FrageMOSEL-ANTWORT-GANZSonnet 5'
```

Die Antwort auf eine Frage zur Mosel-Reise steht im Verlauf der Wien-Reise, mit Modellangabe, nicht von einer echten Nachricht zu unterscheiden. req-081 hakt dazu ab:

> *„- [x] Gegeben ich wechsle die Reise, wenn ich den Bereich Chat öffne, dann sehe ich die Unterhaltung dieser Reise und nicht die der vorigen."*

**Wie schwer das wiegt:** Es ist keine Verletzung der Mandantentrennung — gewechselt wird nur zwischen Reisen desselben Accounts, und die abgelegte Zeile trägt die richtige `trip_id` (die Prüfung in `createChatNachricht` greift). Es ist eine Anzeige, die falsch ist, bis man neu lädt. Aber es ist dieselbe Fehlerart, gegen die der Kommentar oben geschrieben wurde, und der bestehende Test *„zeigt beim Wechsel der Reise deren Unterhaltung"* (`chat-fenster.test.tsx:258`) kann sie nicht fangen: der Haus-Mock (`schnittstelle()`, Zeile 54) gibt den POST-Körper **auf einmal** zurück, die Antwort ist also immer fertig, bevor der Wechsel stattfinden kann.

**Vorschlag:** dieselbe Verfallsprüfung wie im Lade-Effekt, nur an der Reise statt an einem Flag — in `frageSenden` die `tripId` festhalten, zu der gefragt wurde, und jede Rückmeldung mit `if (gefragtFuer !== tripId) return` abschirmen. Dazu der Repro-Test mit strömendem Mock (Muster siehe N3-Vorschlag unten, derselbe Mechanismus). Fünf Zeilen Produktivcode.

Nebenbei aufgefallen: `laeuft` wird beim Reisewechsel **nicht** zurückgesetzt (`chat-fenster.tsx:78-86` setzt sechs Zustände, diesen nicht). Solange die alte Antwort läuft, ist das Schreibfeld der **neuen** Reise gesperrt und der Knopf sagt „Antwortet…", obwohl in dieser Reise nichts läuft. Dieselbe Prüfung räumt das mit auf.

### N3. Bricht der Nutzer ab, ist die Antwort bezahlt und verloren (mittel)

In `app/api/chat/route.ts` gibt es keine Behandlung eines Abbruchs — gemessen per Suche über Route, Browser-Anschluss und Client:

```
$ grep -rn "signal\|abort\|Abort\|cancel" app/api/chat/route.ts lib/chat/senden.ts lib/ai/anthropic-client.ts
KEINE Behandlung von Abbruch
```

Der `ReadableStream` (`route.ts:146`) definiert nur `start(controller)`, kein `cancel()`, und `request.signal` wird nicht an das SDK weitergegeben. Daraus folgt: Verlässt der Nutzer die Seite, schließt den Tab oder wechselt die Reise, während eine Antwort entsteht, bricht der Browser die Anfrage ab, der Strom wird verworfen — und das nächste `controller.enqueue` (`route.ts:150`) wirft, weil der Strom nicht mehr beschreibbar ist. Die Ausnahme verlässt `start`, die Schleife wird abgebrochen, und `createChatNachricht` für die Antwort (`route.ts:176`) **läuft nie**.

Die Folgen, in der Reihenfolge ihrer Schwere:

- Die Antwort ist **weg**, obwohl sie erzeugt und über den Schlüssel des Accounts bezahlt wurde. Im Verlauf steht die Frage allein — ohne Antwort, ohne Grund, ohne Knopf „Erneut senden" (der hängt an `fehler`, und der wird hier nie gesetzt). Nach dem Neuladen sieht der Nutzer seine Frage ins Leere laufen.
- Weil das SDK kein Abbruchsignal bekommt, **läuft die Erzeugung beim Dienst weiter** und wird vollständig abgerechnet — für eine Antwort, die niemand mehr sieht und die nirgends landet.

Das ist dieselbe Stelle, an der req-081 verlangt: *„Die Unterhaltung bleibt erhalten, die Frage lässt sich erneut senden."* Für den Fehlschlag des Dienstes ist das erfüllt, für den Abbruch nicht.

**Vorschlag:** `request.signal` an `anthropic.messages.stream({ … }, { signal })` durchgeben, damit der Dienst nicht weiterrechnet, und die Antwort ablegen, bevor sie verschickt wird (`createChatNachricht` vor `sende({art:"antwort"})`) — dann überlebt sie den Abbruch. Ein `cancel()` am Strom macht den Abbruch außerdem sichtbar statt als geworfene Ausnahme.

### N4. Der Constraint „über das Agent SDK" ist nicht erfüllt, und die Abweichung ist nicht vermerkt (mittel)

req-081 nennt unter Constraints als ersten Punkt:

> *„**Anthropic über das Agent SDK.** Es ist für Werkzeuge gebaut, die später dazukommen — mit einem einfachen Nachrichten-Aufruf zu beginnen und später umzubauen, wäre zweimal Arbeit."*

Gebaut ist der einfache Nachrichten-Aufruf. `package.json` führt `"@anthropic-ai/sdk": "^0.133.0"`, und `lib/ai/anthropic-client.ts:94` ruft `anthropic.messages.stream({…})`. Das sind zwei verschiedene Pakete: das Agent SDK heißt `@anthropic-ai/claude-agent-sdk` und ist etwas anderes — die Claude-Code-Umgebung als Bibliothek, mit eingebauten Werkzeugen für Dateien und Shell, eigener Schleife und Unteragenten. `@anthropic-ai/sdk` ist die gewöhnliche API-Bibliothek.

Dazu drei Dinge, die zusammen das Problem ausmachen:

- **Der Kommentar behauptet das Gegenteil.** `lib/ai/anthropic-client.ts:18-19`: *„Das SDK wird mit Werkzeugen im Blick gewaehlt (req-081, Constraints)"*. Gewählt wurde das SDK, das der Constraint ausschließen wollte.
- **`stack.md` wurde auf den Code umgeschrieben.** Commit `5bf85b8` („stack.md nennt Anthropic und den dritten Schluessel") formuliert die bindende Datei zu *„über das offizielle Anthropic-SDK"* — die Vorgabe folgt damit der Umsetzung statt umgekehrt.
- **Die Begründung des Constraints bleibt unbeantwortet.** Er wollte „zweimal Arbeit" vermeiden. Ob das eintritt, ist jetzt nicht entschieden, sondern nur nicht aufgeschrieben.

**Meine Einschätzung, fair gesagt: die Umsetzung ist wahrscheinlich die bessere Wahl, der Constraint vermutlich der Irrtum.** Das Agent SDK ist auf einen Agenten zugeschnitten, der auf einem Rechner arbeitet — Dateien lesen, Shell ausführen. Für eine Schnittstelle, die einen Browser-Chat bedient und später POIs suchen und Tage planen soll, ist das nicht die passende Form; das passende Mittel sind Werkzeuge über `tool_use` bzw. den Tool Runner, und die sitzen **in genau diesem SDK**. Der spätere Umbau ist damit kein Paketwechsel, sondern ein `tools`-Feld am vorhandenen Aufruf — die befürchtete doppelte Arbeit entsteht nicht.

**Vorschlag:** Nicht umbauen, sondern **die Entscheidung festhalten**. Der Kommentar in `anthropic-client.ts` soll sagen, was zutrifft: dass bewusst das Nachrichten-SDK genommen wurde, weil die späteren Werkzeuge dort über `tools` hineinkommen und das Agent SDK eine andere Bauform ist. Und req-081 gehört eine Zeile „Abweichung vom Constraint, Begründung: …". Eine stillschweigend überschriebene Vorgabe ist schlimmer als eine begründet verworfene — beim nächsten Mal weiß niemand mehr, ob da entschieden oder vergessen wurde.

### N5. Die Unterhaltung wächst unbegrenzt, begrenzt ist nur die einzelne Nachricht (niedrig)

`lib/chat/validate.ts:7-12` begründet die Obergrenze je Nachricht genau richtig:

> *„Eine Obergrenze gehoert dazu: was hier hineinkommt, geht als Zusammenhang mit jeder weiteren Frage erneut an den Dienst und kostet dort jedes Mal."*

Begrenzt wird davon nur die Hälfte: `CHAT_MAX_ZEICHEN = 4000` gilt für die einzelne Nachricht. Die **Zahl** der Nachrichten ist unbegrenzt, und `app/api/chat/route.ts:141-143` gibt bei jeder Frage den ganzen Verlauf mit. Was der Kommentar beschreibt — „kostet dort jedes Mal" — trifft also zu und wächst quadratisch mit der Länge der Unterhaltung: Zug 50 bezahlt 49 vorige Fragen und Antworten mit.

Eine Verdichtung oder Begrenzung gibt es nicht. Die erste harte Grenze ist das Kontextfenster von Haiku 4.5 mit 200K Tokens (Opus 5 und Sonnet 5 haben 1M) — davor bremst nichts. Wird sie erreicht, antwortet der Dienst mit 400, was `sdkFehlerArt` auf `"anfrage"` abbildet, und der Nutzer liest:

> „Der KI-Dienst hat die Anfrage abgelehnt. Nicht der Zugangsschlüssel ist die Ursache; bitte dem Betreiber melden."

Also eine Aufforderung, den Betreiber zu rufen, wo „Verwerfen" das Problem löst — der Knopf dafür ist da, nur nennt ihn niemand.

Das ist bewusst klein eingeordnet: req-081 ist der erste Schritt, „Verbrauch und Kosten der Unterhaltung anzeigen" steht ausdrücklich außerhalb, und wer zahlt, ist der Nutzer selbst. Dass aber die eine Hälfte der eigenen Begründung umgesetzt und die andere offen blieb, ist der Hinweis wert. **Vorschlag:** entweder eine Obergrenze für die Zahl der mitgegebenen Nachrichten (die ältesten fallen weg, mit einem Hinweis im Verlauf), oder der Fall des erschöpften Kontexts bekommt einen eigenen Grund, dessen Satz auf „Verwerfen" zeigt statt auf den Betreiber.

## Vorbefunde: was ich nachgemessen habe

Die letzte Review führte vierzehn offene Punkte. Ich habe diesmal **drei** davon gezielt nachgemessen — die, auf die die neue Strecke einwirkt. Die übrigen elf habe ich **nicht** erneut geprüft; sie stehen unverändert in der Vorgänger-Review, und ich behaupte zu ihnen hier nichts.

| Vorbefund | Stand am 2026-10-13 |
| --- | --- |
| **#2 `testTimeout` in `vitest.config.ts`** | **Offen.** `grep -n "testTimeout" vitest.config.ts` → nicht vorhanden. Die Streuung ist aber von 58 % auf 18 % gefallen (187,12 s / 158,55 s, beide grün). Der Befund bleibt richtig, der Druck ist geringer. |
| **#1 `ensureMapWorkerUrl()` in jeder Karte** | **Offen, unverändert.** Drei Dateien rufen `new MapLibreMap(`: `app/go/components/map-view.tsx`, `app/plan/components/poi-map.tsx` und `app/plan/components/day-route-map.tsx`. Die ersten beiden rufen `ensureMapWorkerUrl()` (Zeile 201 bzw. 756), **`day-route-map.tsx` nicht**. Siebte Review für diesen Punkt. |
| **N1 vom 06.10. („Heute" in UTC)** | **Offen — und gewachsen.** `heutigesDatum()` gibt es im Repo nicht. Die Zahl der eigenen UTC-Ableitungen ist von sechs auf **sieben** gestiegen: req-080 hat `app/plan/reiseplan/[tripId]/page.tsx:37` (`new Date().toISOString().slice(0, 10)`) hinzugefügt. |

Der dritte Punkt ist der, auf den ich hinweisen möchte, auch wenn die neue Stelle harmlos ist: das Datum dient dort nur als „Stand" auf dem gedruckten Blatt, ein Nutzer in Tokio druckt vor 09:00 Ortszeit also das Datum von gestern aufs Papier. Das ist kosmetisch. **Bemerkenswert ist die Richtung:** ein sechsfach belegter Befund, dessen Behebung als „eine Zeile in `lib/trips/date-utils.ts`" beschrieben war, ist in der Woche danach siebenfach geworden. Die neue Datei trägt sogar den Kommentar *„Haengt vom aktuellen Datum … ab — nie statisch vorrendern."* — das Problem war im Blick, nur nicht als dieses Problem erkannt. Das ist genau der Fall, für den die letzte Review die Struktur-Zusicherung vorgeschlagen hat („keine eigene Heute-Ableitung außerhalb von `date-utils`"): Eine Vorgabe ohne Messpunkt wird nicht eingehalten, sondern vergessen.

## Gut gelöst

Nicht als Höflichkeit, sondern weil es nachgemessen ist und weil es die Stellen sind, an denen man beim nächsten Mal nicht noch einmal suchen muss.

- **Schema, Migrationen und `datenbank.md` stimmen überein.** `migrations/0050_chat_nachricht.sql` hat zwei Prüfregeln, die die Zeilen wirklich zusammenhalten: `rolle in ('ich','ki')`, und `modell` ist bei `ki` nicht null und bei `ich` null. `delivery/datenbank.md:874` führt dieselbe Tabelle spaltenweise, nennt die Mandantentrennung über die Reise und begründet, warum `modell` als Text und nicht als Prüfliste dasteht — *„eine alte Antwort soll ihre Herkunft behalten, auch wenn ihr Modell nicht mehr zur Auswahl steht."* Auch `migrations/0049` erweitert die `kind`-Prüfregel statt sie zu ersetzen und schreibt hin, warum. Das Akzeptanzkriterium zur nachgezogenen `datenbank.md` ist erfüllt, und zwar vollständig.
- **Die drei Modellkennungen sind richtig und stehen wirklich an einer Stelle.** `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5` — gegen die aktuelle Modellliste geprüft, alle drei gültig. `lib/chat/modelle.ts` ist die einzige Quelle; der Client nimmt die Kennung vom Aufrufer (`anthropic-client.ts:16`), und `chatModellLabel` lässt eine unbekannte Kennung stehen, statt sie zu schlucken. Genau so, wie der Constraint es wollte.
- **Die Mandantentrennung der neuen Flächen ist sauber, auch an der neuen Druckseite.** `app/api/chat/route.ts` holt den Account ausschließlich aus der Anmeldung und prüft die aus der Anfrage kommende `tripId` in allen drei Methoden gegen ihn; `lib/db/chat-nachrichten.ts` prüft zusätzlich im Datenzugriff (`createChatNachricht:91`, `deleteChatNachrichten:121`) — doppelt, bewusst, mit Begründung. `app/plan/reiseplan/[tripId]/page.tsx` prüft Anmeldung, `darfPlanen` **und** Sichtbarkeit der Reise, bevor etwas gerendert wird, und leitet sonst in den Begleiter. Nachgeprüft: `session.accountId` löst über `lib/db/sessions.ts:37` auf den Account auf, in den der Gesamt-Admin gewechselt ist — der Chat rechnet also über den Schlüssel des Accounts ab, in dem gearbeitet wird, nie über einen fremden. Das ist req-028 korrekt umgesetzt.
- **`lib/ai/fehler.ts` ist der Grund, dass N1 überhaupt auffällt.** Die Datei trennt Fehlerart, Detail des Dienstes und Satz an den Nutzer, und jeder Satz sagt ausdrücklich, ob der Zugangsschlüssel die Ursache ist — mit der Begründung aus bug-021/bug-026 direkt darüber. Weil die Taxonomie existiert, ist der neue Grund aus N1 Schritt 1 ein Eintrag in einem Record und kein Umbau. Die neue Strecke hat sie korrekt mitbenutzt (`lib/ai/sdk-fehler.ts` bündelt die Abbildung für beide SDKs an einer Stelle statt sie zu verdoppeln).
- **Der Grund für einen Fehlschlag wird nicht abgelegt — und das steht begründet in der Doku.** `datenbank.md` erklärt, dass ein Fehlschlag bewusst keine Zeile bekommt, die Frage aber stehen bleibt. Das ist die Art Entscheidung, die man sonst beim nächsten Lesen für ein Versehen hält.

## Empfohlene Reihenfolge

1. **N1 Schritt 1** — `stop_reason: "max_tokens"` als benannten Grund behandeln, mit dem Repro-Test aus Fall B. Das ist der kleinste Eingriff mit der größten Wirkung: er beendet das stille Ablegen halber Antworten als vollständige. Eine Fehlerart, ein Satz, ein Zweig, ein Test.
2. **N2** — die Verfallsprüfung an der Reise, fünf Zeilen, plus Repro-Test mit strömendem Mock. Danach ist ein abgehaktes Akzeptanzkriterium wirklich erfüllt, und der gesperrte Eingabe-Knopf nach dem Wechsel verschwindet mit.
3. **N1 Schritte 2 und 3** — `thinking`/`effort` an den Modelleintrag in `lib/chat/modelle.ts`, `max_tokens` erhöhen. Das ist die eigentliche Ursache von N1 und senkt zugleich die Kosten je Antwort, weil ein Gespräch ohne Werkzeuge kein `effort: high` braucht.
4. **N3** — `request.signal` durchgeben und die Antwort vor dem Verschicken ablegen. Zwei kleine Umstellungen, und ein Abbruch kostet dann nichts und verliert nichts.
5. **Vorbefund #1, die drei Zeilen** — `ensureMapWorkerUrl()` in `day-route-map.tsx:281`, der Repro-Test auf `querySourceFeatures`, und die Struktur-Zusicherung „jede Datei mit `new MapLibreMap(` enthält `ensureMapWorkerUrl(`". Siebte Review. Zwei Zeilen Produktivcode. Danach zeigt die Tageskarte ihre Linien und die Serie endet.
6. **Vorbefund N1 vom 06.10., Schritt 1** — `heutigesDatum()` an einer Stelle, die inzwischen **sieben** Aufrufstellen darauf, und die Zusicherung dagegen. Die Zusicherung ist hier der wichtigere Teil: ohne sie ist der Befund nächste Woche achtfach.
7. **N4** — den Kommentar in `anthropic-client.ts` auf das korrigieren, was zutrifft, und die Abweichung in req-081 vermerken. Zehn Minuten, und sie verhindert, dass beim Bau der Werkzeuge jemand das falsche Paket nachinstalliert.
8. **Vorbefund #2** — `testTimeout: 15000`. Eine Zeile. Die Streuung ist zurückgegangen, der fehlende Messpunkt nicht.
9. **N5** — die Zahl der mitgegebenen Nachrichten begrenzen oder dem erschöpften Kontext einen Grund geben, der auf „Verwerfen" zeigt.
10. **Die elf übrigen Vorbefunde** aus der Review vom 06.10., unverändert in ihrer dortigen Reihenfolge.

**Eine Beobachtung quer über 1, 2, 5 und 6:** Alle vier sind Befunde, bei denen ein **Test existiert, der daneben greift**. „begrenzt die Laenge einer Antwort" prüft das gesendete Feld statt die erreichte Grenze. „zeigt beim Wechsel der Reise deren Unterhaltung" kann den Wechsel mitten in der Antwort nicht herstellen, weil der Mock alles auf einmal liefert. Die Kartentests prüfen die Linien nicht an `querySourceFeatures`. Und für „kein eigenes Heute-Datum" gibt es überhaupt keinen Messpunkt. Die Suite ist mit 4624 Tests groß und zweimal grün — ihre Lücken liegen nicht dort, wo nicht getestet wird, sondern dort, wo **das Nachbarverhalten getestet wird statt des gemeinten**. Beide Messungen dieser Review brauchten denselben Trick: einen Mock, der wirklich strömt, und einen Abschlussgrund, den die Suite nicht kennt. Das ist der billigste Hebel für die nächste Strecke.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt am Stand `e74adcd`: `npx tsc --noEmit` (fehlerfrei), `npm run lint` (fehlerfrei), `npm test` **zweimal** (Lauf 1: 4624 Tests in 362 Dateien grün, 187,12 s; Lauf 2: identisch grün, 158,55 s). Typprüfung und Lint waren vor Lauf 1 beendet.

`npm run test:e2e` wurde **nicht** ausgeführt — aus demselben Grund wie in den beiden Vorgängern: der erreichbare PostgreSQL (`db:5432`) ist der Server der laufenden dev-Umgebung, und ein autonomer Lauf legt dort keine Wegwerf-Datenbank an, solange er es nicht muss. Alle Aussagen zu E2E stammen aus dem Quelltext der Flüsse.

**Zwei Befunde sind empirisch bestätigt**, beide mit Wegwerf-Testdateien, die danach entfernt wurden (`git status` ist sauber):

| Befund | Messung |
| --- | --- |
| N1 | Wegwerf-Test unter `lib/ai/`: Antwort des Dienstes als Ereignisstrom nachgebildet, drei Fälle gegen `createAnthropicChatClient` mit gemocktem `fetch`. Ergebnis: `max_tokens` ohne Text → `{art:'leer'}`; `max_tokens` mit halbem Text → `fehler=null` und abgeschnittener Text als Ergebnis; `end_turn` als Gegenprobe. |
| N2 | Wegwerf-Test unter `app/plan/components/`: `fetch`-Mock mit echtem `ReadableStream`, dessen restliche Stücke an einem vom Test aufgelösten Promise hängen. Nach `rerender` mit der zweiten `tripId` lautet der Verlauf `'Wien-FrageMOSEL-ANTWORT-GANZSonnet 5'`. |

Die drei Vorbefunde in der Tabelle sind einzeln per Grep und Lesen der Stellen nachgeschlagen; die Messwerte stehen dort, nicht als Behauptung. Die **elf übrigen** Vorbefunde der letzten Review habe ich nicht erneut geprüft. Neu betrachtet wurden: die ganze Strecke req-081 (`lib/chat/`, `lib/ai/anthropic-client.ts`, `lib/ai/chat-client.ts`, `lib/ai/sdk-fehler.ts`, `app/api/chat/`, `app/plan/components/chat-fenster.tsx`, `lib/db/chat-nachrichten.ts`), die Migrationen 0049 und 0050 gegen `delivery/datenbank.md`, die Modellkennungen gegen die aktuelle Modellliste, die Zugangsschlüssel-Route auf die Admin-Prüfung der neuen Art, `lib/db/sessions.ts` auf die Auflösung des wirkenden Accounts, sowie aus req-080 `app/plan/reiseplan/[tripId]/page.tsx`, `lib/druck/kosten.ts`, `lib/druck/geld.ts` und `lib/druck/layouts.ts`.

Kein Zugriff auf prod, keine Datenbank der laufenden Umgebungen angefasst, kein Netzaufruf nach außen. Es wurde nichts committet und nichts gepusht.
