---
id: req-092
title: Der Chat darf im Web suchen
app: wegfara
area: Planung
priority: normal
created: 2026-10-26
---

# Goal (Why)

Der Chat kann nicht im Internet nachsehen. Frage ich nach den
Öffnungszeiten eines Museums, nach dem Wetter im Reisezeitraum oder nach
einem Restaurant in Rothenburg, antwortet das Modell aus dem, was es beim
Training gelernt hat — oder sagt, dass es das nicht weiß.

Für einen Reiseplaner ist das die Hälfte des Nutzens. Gerade die Fragen,
die beim Planen wirklich auftauchen, hängen an aktuellen Angaben:
Öffnungszeiten, Preise, ob ein Laden noch existiert, Feiertage,
Bauarbeiten.

Das ist kein Fehler, sondern der bewusste Zuschnitt von req-081: Dort
steht ausdrücklich „Keine Werkzeuge, kein Zugriff auf Reisedaten" — der
erste Schritt sollte das Gespräch erlebbar machen, bevor Werkzeuge
gebaut werden. Der Schritt ist getan; dieses Requirement nimmt die erste
Beschränkung zurück.

Gemessen am 26.10.2026: `lib/ai/anthropic-client.ts` ruft
`anthropic.messages.stream()` **ohne** `tools`-Parameter auf. Das Modell
hat damit keine Möglichkeit, etwas nachzusehen.

# Function (What)

Der Chat bekommt die **Web-Suche von Anthropic** — ein Werkzeug, das auf
den Servern des Dienstes läuft. Die App ruft keine Suchmaschine selbst
auf und braucht keinen weiteren Zugangsschlüssel.

## Warum serverseitig

Anthropic führt die Suche selbst aus und liefert das Ergebnis im selben
Strom zurück. Für wegfara heißt das:

- **Keine zweite Abhängigkeit**, kein eigener Suchdienst, kein weiterer
  Schlüssel. Der vorhandene Schlüssel der Art `anthropic` (req-028)
  deckt es ab.
- **Kein eigener Netzzugriff** aus dem Container heraus — das ist nach
  bug-067 ein Vorteil, denn jeder zusätzliche ausgehende Dienst ist eine
  weitere Stelle, die ausfallen kann.
- Das SDK kennt das Werkzeug schon (Fassung `web_search_20250305` und
  neuere). Es ist keine neue Abhängigkeit nötig.

## Was der Nutzer sieht

**Dass gesucht wurde, muss sichtbar sein.** Eine Antwort, die auf einer
Suche beruht, unterscheidet sich im Wert von einer aus dem Gedächtnis —
und nur die erste lässt sich nachprüfen.

- Während gesucht wird, steht es da („sucht im Web …").
- Die **Quellen** der Antwort stehen darunter, als anklickbare Adressen
  mit dem Titel der Seite.
- Antwortet das Modell ohne Suche, steht dort nichts. Keine leere
  Quellenzeile.

## Wie oft gesucht wird

Das Modell entscheidet selbst, ob eine Frage eine Suche braucht — „was
ist ein Transfer" braucht keine. Die Zahl der Suchen je Antwort ist
**begrenzt** (`max_uses`): Jede kostet Geld, und ohne Grenze kann eine
einzige Frage viele auslösen.

Die Grenze steht als benannter Wert an einer Stelle, nicht als Zahl im
Aufruf.

## Was das System dem Modell sagt

Der heutige Systemtext sagt: „Du kennst die geöffnete Reise nicht und
kannst in der App nichts ändern." Der erste Teil bleibt richtig — die
Reisedaten bekommt das Modell weiterhin nicht. Hinzu kommt, dass es nun
im Web nachsehen **kann** und bei Fragen nach aktuellen Angaben
(Öffnungszeiten, Preise, Wetter) auch soll, statt zu raten.

## Wenn die Suche nicht gelingt

Die Suche kann scheitern, während die Antwort läuft. Dann **bleibt die
Antwort stehen**, und der Grund steht dabei — nicht die ganze Antwort
verwerfen, weil eine Suche fehlschlug. Das ist dasselbe Muster, das
`anthropic-client.ts` bei `refusal` und `max_tokens` schon anwendet.

# GUI

- Die Suchmeldung und die Quellen erscheinen im Verlauf
  (`app/plan/components/chat-fenster.tsx`), am Eintrag der Antwort — nicht
  als eigene Nachricht.
- Die Gestaltung nimmt vorhandene Bausteine: die Quellen als Liste
  kleiner Verweise, die Suchmeldung in der Art der übrigen leisen
  Hinweise. Es kommt kein neues Gestaltungsmittel hinzu.
- Adressen sind anklickbar, öffnen in einem neuen Reiter und sind
  mindestens 44 px hoch zu treffen (`stack.md`, Regel 4).
- Kontrast nach `lib/design/kontrast.ts`: die Quellenzeile ist leiser,
  aber nicht unter 4,5:1.
- Bei 375, 768 und 1280 px gelten die vier Regeln aus `stack.md`; lange
  Adressen brechen um und ragen nicht über den Rand.

# Acceptance Criteria

- [x] Gegeben ich frage nach den Öffnungszeiten eines Museums, wenn die
      Antwort kommt, dann beruht sie auf einer Web-Suche und nennt ihre
      Quellen.
- [x] Gegeben ich frage etwas, das keine Suche braucht („was ist ein
      Transfer"), wenn die Antwort kommt, dann wurde nicht gesucht und es
      steht keine Quellenzeile da.
- [x] Gegeben eine Suche läuft, wenn ich den Verlauf ansehe, dann sehe
      ich, dass gerade gesucht wird.
- [x] Gegeben eine Antwort beruht auf drei Quellen, wenn ich sie ansehe,
      dann stehen alle drei als anklickbare Adressen mit Titel darunter.
- [x] Gegeben ich klicke eine Quelle an, wenn sie sich öffnet, dann
      geschieht das in einem neuen Reiter.
- [x] Gegeben die Suche scheitert mitten in der Antwort, wenn ich den
      Verlauf ansehe, dann steht der Text, der bis dahin kam, UND der
      Grund dabei.
- [x] Gegeben das Modell würde mehr Suchen auslösen als erlaubt, wenn die
      Antwort kommt, dann wurde die Grenze eingehalten.
- [ ] Gegeben eine Antwort besteht nur aus Suchergebnissen und noch
      keinem Text, wenn der Strom weiterläuft, dann gilt sie NICHT als
      leere Antwort (bug-032).
- [ ] Gegeben ich frage nach den Daten der geöffneten Reise, wenn die
      Antwort kommt, dann sagt das Modell weiterhin, dass es sie nicht
      kennt — die Suche gibt ihm keinen Zugriff darauf.
- [ ] Gegeben ich sehe eine Antwort mit Quellen bei 375 px, wenn ich sie
      ansehe, dann ragt keine Adresse über den Rand.
- [ ] Gegeben es ist kein Zugangsschlüssel der Art `anthropic`
      hinterlegt, wenn ich etwas frage, dann sehe ich denselben Hinweis
      wie bisher — die Suche ändert daran nichts.

# Constraints

- **Nur die Web-Suche.** Das SDK bietet daneben `web_fetch` (eine
  bestimmte Seite abrufen), Code-Ausführung und weitere Werkzeuge. Die
  bleiben aussen vor: Ein Schritt, ein Werkzeug, damit sich beurteilen
  lässt, was es bringt.
- Die Suche läuft **auf den Servern von Anthropic**. Die App ruft keine
  Suchmaschine auf und öffnet keine weitere ausgehende Verbindung.
- Kein weiterer Zugangsschlüssel. Abgerechnet wird über den vorhandenen
  der Art `anthropic` (req-028) — und zwar über den des Accounts, in dem
  gearbeitet wird, nie über eine Umgebungsvariable.
- Die Fassung des Werkzeugs (`web_search_20250305` oder neuer) steht an
  **einer** Stelle, bei den übrigen Vorgaben des Chat-Clients. Sie wird
  nicht über mehrere Dateien verteilt.
- `MAX_TOKENS` zählt Nachdenken, Suchergebnisse und Antworttext
  gemeinsam (bug-061). Dass eine Antwort mit Suche früher an die Grenze
  stösst, ist zu berücksichtigen: Die Meldung „abgeschnitten" muss
  weiterhin greifen und darf nicht als leere Antwort erscheinen.
- Die Prüfung `gab === 0` in `anthropic-client.ts` zählt heute nur
  Textstücke. Mit der Suche kommen zuerst andere Blöcke; sie darf eine
  Antwort, die mit einer Suche beginnt, nicht als leer verwerfen
  (bug-032).
- Die Quellen kommen aus der Antwort des Dienstes. Es wird keine Adresse
  erfunden und keine aus dem Text geraten.
- Der Chat bleibt ohne Zugriff auf die Reisedaten. Dieses Requirement
  gibt ihm Augen nach aussen, nicht nach innen.

# Out of Scope

- `web_fetch` — eine vom Nutzer genannte Seite abrufen.
- Werkzeuge, die in der App etwas tun: POIs suchen und anlegen, Tage
  planen, Kosten ändern. Das ist der nächste Schritt aus req-081.
- Dem Modell die Daten der geöffneten Reise mitgeben.
- Suchergebnisse zu POIs machen oder in die Reise übernehmen.
- Die Suche auf bestimmte Domains begrenzen (`allowed_domains`).
- Eine Einstellung, mit der sich die Suche je Account oder Reise
  abschalten lässt.
- Kosten der Suche anzeigen oder abrechnen.
- Die KI-Suche (`ki_suche`, OpenAI) und die KI-Planung ändern — die
  bleiben, wie sie sind.
