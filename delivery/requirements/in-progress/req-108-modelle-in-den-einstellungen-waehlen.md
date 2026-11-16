---
id: req-108
title: Die KI-Modelle in den Einstellungen wählen, aus einer Liste des Dienstes
app: wegfara
area: Mein Bereich
priority: hoch
changes: req-028, req-090, req-072, req-103
created: 2026-11-16
---

# Goal (Why)

Die Modellnamen für OpenAI stehen im Quelltext und sind nur über eine
Datei auf dem Beelink zu ändern:

```
lib/ai/openai-client.ts:11   DEFAULT_MODEL       = "gpt-5.6-luna"
lib/ai/openai-client.ts:18   DEFAULT_IMAGE_MODEL = "gpt-image-1"
```

Übersteuern lässt sich das nur über `OPENAI_MODEL` und
`OPENAI_IMAGE_MODEL` in `~/wegfara-env/{dev,prod}.env` — mit Neustart
des Containers, ohne jede Rückmeldung in der App.

**Das hat gerade einen Fehler verursacht.** OpenAI hat `gpt-image-1` am
23.10.2026 abgeschaltet; bemerkt wurde es drei Wochen später, als „Bild
erzeugen" zu einem POI fehlschlug (bug-076). Die App hätte es wissen
können — sie fragt den Dienst nie, ob das eingestellte Modell noch
existiert.

**Für den Chat ist das längst gelöst.** req-090 holt den Katalog bei
Anthropic (`lib/ai/modell-katalog.ts`), nimmt nur aktive Modelle in die
Auswahl (`waehlbareChatModelle`) und merkt ihn je Account
(`modell-katalog-cache.ts`). Die Begründung von damals gilt
unverändert:

> Die Modelle selbst stehen nicht im Quelltext: der Dienst nennt sie,
> und eine Liste hier veraltete unbemerkt — die bis req-090 geführte war
> es schon.

Genau das ist mit den OpenAI-Modellen wieder passiert. Diesmal nicht in
einer Liste, sondern in zwei Konstanten.

# Scope (What)

## Eine Karte „KI-Modelle" in „Mein Bereich"

Neben der Karte „Zugangsschlüssel" (req-028) — dort gehört sie hin,
denn sie betrifft dieselben Dienste und wird vom selben Account
bezahlt.

Drei Auswahlfelder, je eines für:

| Zweck | heute | Schlüssel |
| --- | --- | --- |
| **Fragen** (POI-Suche req-014, Beschreibung req-058, Planen req-056) | `OPENAI_MODEL` | `ki_suche` |
| **Bilder** (POI-Bild req-072, Reisetitelfoto req-103) | `OPENAI_IMAGE_MODEL` | `ki_suche` |
| **Chat im Planer** (req-081, req-090) | schon wählbar, aber nur je Unterhaltung | `anthropic` |

Jedes Feld listet die Modelle, die **der Dienst selbst nennt** — nie
eine Liste aus dem Quelltext.

Ohne hinterlegten Schlüssel gibt es nichts zu holen: Die Karte sagt
dann, welcher Schlüssel fehlt, und verweist auf die Karte darüber (wie
`apiKeyMissingHint` es schon tut).

## Was in die Auswahl kommt

**Bei Anthropic** entscheidet das Feld `lebenslauf`: nur `active`, wie
`waehlbareChatModelle` es schon macht. Ein abgekündigtes oder
abgeschaltetes Modell gehört nicht in eine Auswahl, in der man sich
gerade entscheidet.

**Bei OpenAI gibt es dieses Feld nicht.** `GET /v1/models` nennt keinen
Lebenslauf, sondern höchstens ein **optionales `shutdown_date`**; die
Liste enthält auch Modelle, deren Abschaltdatum schon vergangen ist.
Deshalb:

- Ein Modell mit `shutdown_date` in der Vergangenheit kommt **nicht** in
  die Auswahl.
- Eines mit `shutdown_date` in der Zukunft kommt hinein, aber mit dem
  Datum danebenstehend — es ist auf dem Weg hinaus.
- Fehlt das Feld, gilt das Modell als wählbar.

Diese Unterscheidung gehört an **eine** Stelle, neben
`waehlbareChatModelle`, und nicht in die Oberfläche.

**Bildmodelle von Textmodellen trennen:** `GET /v1/models` nennt alle
in einer Liste. Wie sich die Bildmodelle davon abgrenzen lassen, ist
beim Umsetzen am Dienst zu prüfen — ist es nicht verlässlich möglich,
stehen in beiden Feldern alle Modelle, und die Karte sagt, welches Feld
welchen Zweck hat. **Nicht** aus der Kennung raten (derselbe Grundsatz
wie bei der Reihe in req-090: *nie aus der Kennung geraten*).

## Wo die Wahl liegt

**Je Account**, wie die Schlüssel (req-028) — bezahlt wird sie je
Account. Muster ist `account_api_key` mit `(account_id, kind)` als
Schlüssel; hier genügt `(account_id, zweck)` und der Modellname im
Klartext. Ein Modellname ist kein Geheimnis: Er wird gezeigt, nicht nur
gesetzt — anders als der Schlüssel.

## Was gilt, wenn nichts gewählt ist

Die Reihenfolge, von oben nach unten:

1. das in der Karte gewählte Modell,
2. sonst `OPENAI_MODEL` / `OPENAI_IMAGE_MODEL` aus der Umgebung —
   **der Rückfall bleibt**, damit eine Installation ohne gewähltes
   Modell weiterläuft,
3. sonst der Standard im Quelltext.

Der Standard im Quelltext muss dabei auf ein **lebendes** Modell zeigen
(bug-076). Er ist der letzte Rückfall, nicht die Regel.

## Wenn das eingestellte Modell verschwindet

Steht das gewählte Modell nicht mehr in der Liste des Dienstes, sagt die
Karte es — unübersehbar, mit dem Namen des Modells und dem Hinweis, ein
anderes zu wählen. Das ist der Punkt, an dem bug-076 drei Wochen früher
aufgefallen wäre.

Zusätzlich meldet es die Gesundheitsprüfung (`/api/health`,
`delivery/health.md`): Sie weiss dann, dass eine KI-Funktion nicht mehr
arbeiten kann, bevor jemand sie benutzt.

## Der Katalog wird nicht jedes Mal geholt

`lib/chat/modell-katalog-cache.ts` ist dafür schon gebaut und wird
**geteilt, nicht kopiert** — mit seinen erprobten Zeiten: 6 Stunden
gültig, 7 Tage Rückfall beim Ausfall des Dienstes, 1 Minute Pause nach
einem Fehlschlag. Er muss dafür einen zweiten Dienst führen können
(heute nur Anthropic).

# Acceptance Criteria

- [x] Gegeben ein Account mit `ki_suche`-Schlüssel, wenn ich „Mein
      Bereich" öffne, dann steht dort die Karte „KI-Modelle" mit drei
      Auswahlfeldern.
- [x] Gegeben die Karte, wenn ich ein Feld öffne, dann stehen darin die
      Modelle, die der Dienst nennt — keine Liste aus dem Quelltext.
- [x] Gegeben ich wähle ein Modell und speichere, dann benutzt die
      nächste KI-Anfrage dieses Modell.
- [x] Gegeben ich habe ein Bildmodell gewählt, wenn ich zu einem POI ein
      Bild erzeuge, dann entsteht es mit diesem Modell.
- [x] Gegeben kein `ki_suche`-Schlüssel ist hinterlegt, dann sagt die
      Karte, welcher Schlüssel fehlt, und listet keine Modelle.
- [x] Gegeben ein Modell, dessen `shutdown_date` vergangen ist, dann
      steht es **nicht** in der Auswahl.
- [x] Gegeben ein Modell mit `shutdown_date` in der Zukunft, dann steht
      es in der Auswahl **und** das Datum steht daneben.
- [x] Gegeben Anthropic nennt ein Modell als `deprecated` oder
      `retired`, dann steht es nicht in der Auswahl (wie req-090).
- [x] Gegeben ich habe nichts gewählt, wenn `OPENAI_IMAGE_MODEL` in der
      Umgebung steht, dann gilt dieses — der Rückfall bleibt.
- [x] Gegeben weder Wahl noch Umgebungsvariable, dann gilt der Standard
      aus dem Quelltext, und der benennt ein lebendes Modell.
- [x] Gegeben mein gewähltes Modell steht nicht mehr in der Liste des
      Dienstes, dann sagt die Karte es mit dem Namen des Modells.
- [ ] Gegeben dasselbe, wenn ich `/api/health` abfrage, dann meldet sie
      es ebenfalls.
- [x] Gegeben ich öffne die Karte zweimal innerhalb von sechs Stunden,
      dann wird der Dienst nur einmal gefragt.
- [x] Gegeben der Dienst antwortet nicht, wenn ich die Karte öffne, dann
      steht der zuletzt geholte Katalog da und die Karte sagt, dass er
      gemerkt ist.
- [x] Gegeben zwei Accounts, dann hat jeder seine eigene Wahl.
- [ ] Gegeben die Bildschirmprüfung bei 375, 768 und 1280 px, dann ist
      die Karte grün und ihre Tippziele mindestens 44 × 44 px
      (stack.md).

# Constraints

- Die Modelle kommen **immer vom Dienst**, nie aus einer Liste im
  Quelltext. Das ist der Kern von req-090 und der Grund für bug-076.
- **Nichts aus der Kennung raten** — weder die Reihe noch ob es ein
  Bildmodell ist (req-090, Constraints).
- Der Katalog wird mit dem Schlüssel des Accounts erfragt, und der
  **verlässt den Server nicht** (req-028). Die Anfrage an den Dienst
  geht vom Server aus, nie vom Browser.
- `modell-katalog-cache.ts` wird **geteilt, nicht kopiert** (vgl.
  req-082: dieselbe Konstante dreimal).
- Der Modellname wird im Klartext gespeichert und gezeigt. Er ist kein
  Geheimnis — anders als der Schlüssel, von dem nur die letzten vier
  Zeichen je wieder nach aussen gehen.
- Die Umgebungsvariablen bleiben als Rückfall. Eine Installation ohne
  gewähltes Modell läuft weiter.
- Scheitert das Speichern, bleibt die Wahl stehen und die Karte sagt es
  (bug-021).

# Out of Scope

- **bug-076 selbst.** Der Standard im Quelltext gehört dort auf ein
  lebendes Modell gesetzt — sofort und ohne dieses Requirement.
- Die Modellwahl je Reise oder je Benutzer. Sie liegt je Account, wie
  die Schlüssel.
- Die Wahl des Chat-Modells **je Unterhaltung** (req-090) zu ersetzen.
  Die Karte setzt, womit eine Unterhaltung beginnt; umstellen lässt es
  sich im Chat weiterhin.
- Weitere Anbieter neben OpenAI und Anthropic.
- Kosten je Modell anzuzeigen. Der Dienst nennt sie im Katalog nicht.
- Modelle selbst zu prüfen oder zu vergleichen.
