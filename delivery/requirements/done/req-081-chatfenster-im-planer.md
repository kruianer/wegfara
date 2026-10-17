---
id: req-081
title: Chatfenster im Planer — erster Schritt
app: wegfara
area: Planung
priority: normal
created: 2026-10-12
---

# Goal (Why)

Als Reiseleiter will die App irgendwann **im Gespräch** bedienen können:
„Suche Weingüter bei Bernkastel", „verschiebe das Abendessen auf 20 Uhr",
„was kostet der Tag". Die KI-Suche und die KI-Planung können heute je eine
Sache auf Zuruf; was fehlt, ist der Ort, an dem man mit der App *redet*.

Dieses Requirement baut **nur den Ort**, nicht die Fernsteuerung: einen
eigenen Bereich im Planer mit einem Chatfenster und einer Modellauswahl.
Die KI antwortet, aber sie tut nichts. Keine Werkzeuge, kein Zugriff auf
Reisedaten, keine Änderungen.

Der Grund für diesen Zuschnitt: Ob sich die App so bedienen lässt,
entscheidet sich an der Unterhaltung selbst — am Tempo, an der Art der
Antworten, am Gefühl. Das will ich erleben, bevor Werkzeuge gebaut werden,
die auf Reisedaten schreiben.

# Function (What)

## Der Bereich

Im Planer kommt ein Bereich **Chat** dazu, erreichbar über die
Seitenleiste wie die übrigen (req-077).

Er ist zweigeteilt wie der Bereich POIs: **links das Chatfenster, rechts
die Karte der Reise** mit ihren POIs. Die Karte ist im ersten Schritt nur
Beiwerk — sie wird gebraucht, sobald der Chat etwas bewirkt, und soll von
Anfang an den Platz haben, an dem man später die Wirkung sieht.

Für die Karte wird die vorhandene genommen, nicht eine zweite gebaut.

## Die Unterhaltung

Ein Feld zum Schreiben, darüber der Verlauf: eigene Nachrichten und die
Antworten der KI, in zeitlicher Folge.

Die Antwort erscheint **während** sie entsteht, nicht erst am Ende — bei
längeren Antworten sonst der Eindruck, es hänge.

Der Verlauf gehört zur **geöffneten Reise**: Ein Reisewechsel zeigt die
Unterhaltung dieser Reise. Er überdauert das Neuladen der Seite.

Eine Unterhaltung lässt sich **verwerfen** und neu beginnen.

## Die Modellauswahl

Drei Modelle von Anthropic, wählbar je Unterhaltung:

- **Opus 5** — stark, teuer
- **Sonnet 5** — ausgewogen, die Vorgabe
- **Haiku 4.5** — schnell, günstig

Die Auswahl ist sichtbar, ohne dass man suchen muss, und steht bei jeder
Antwort dabei: Welche Antwort von welchem Modell kam, soll im Verlauf
ablesbar sein.

Ein Wechsel mitten in der Unterhaltung ist erlaubt; die folgenden
Antworten kommen dann vom neuen Modell.

## Der Zugangsschlüssel

Das Chatfenster läuft über einen **eigenen Zugangsschlüssel für
Anthropic**, hinterlegt je Account wie die bestehenden (req-028). Der
vorhandene Schlüssel `ki_suche` ist ein OpenAI-Schlüssel und taugt dafür
nicht.

Fehlt der Schlüssel, sagt der Bereich das — mit dem Weg dorthin, wo man
ihn hinterlegt. Er zeigt kein leeres Fenster, in das man vergeblich
schreibt.

## Wenn es nicht geht

Schlägt eine Antwort fehl — kein Schlüssel, Dienst nicht erreichbar,
Anfrage abgelehnt, Kontingent erschöpft —, **sagt die App den Grund** im
Verlauf an der Stelle, an der die Antwort stünde. Die Unterhaltung bleibt
erhalten, die Frage lässt sich erneut senden.

# Acceptance Criteria

- [x] Gegeben ich bin im Planer, wenn ich die Seitenleiste ansehe, dann
      gibt es einen Bereich **Chat**.
- [x] Gegeben ich öffne den Bereich Chat, wenn ich hinsehe, dann steht
      links das Chatfenster und rechts die Karte der Reise mit ihren POIs.
- [x] Gegeben der Account hat einen Anthropic-Zugangsschlüssel, wenn ich
      eine Frage sende, dann erscheint eine Antwort im Verlauf.
- [x] Gegeben eine Antwort entsteht, wenn ich hinsehe, dann wächst sie
      sichtbar und erscheint nicht erst am Ende vollständig.
- [x] Gegeben ich habe mehrere Nachrichten gesendet, wenn ich den Verlauf
      ansehe, dann stehen Fragen und Antworten in zeitlicher Folge.
- [x] Gegeben ich lade die Seite neu, wenn ich den Bereich Chat öffne,
      dann ist die Unterhaltung noch da.
- [x] Gegeben ich wechsle die Reise, wenn ich den Bereich Chat öffne, dann
      sehe ich die Unterhaltung dieser Reise und nicht die der vorigen.
- [x] Gegeben eine Unterhaltung läuft, wenn ich sie verwerfe, dann ist der
      Verlauf leer und ich kann neu beginnen.
- [x] Gegeben ich sehe die Modellauswahl, wenn ich sie öffne, dann stehen
      dort Opus 5, Sonnet 5 und Haiku 4.5.
- [x] Gegeben ich habe noch nichts gewählt, wenn ich die Auswahl ansehe,
      dann steht sie auf Sonnet 5.
- [x] Gegeben ich wechsle das Modell mitten in der Unterhaltung, wenn ich
      die nächste Frage sende, dann antwortet das neue Modell.
- [x] Gegeben eine Antwort steht im Verlauf, wenn ich sie ansehe, dann ist
      erkennbar, von welchem Modell sie kam.
- [x] Gegeben dem Account fehlt der Anthropic-Zugangsschlüssel, wenn ich
      den Bereich Chat öffne, dann sagt er das und nennt den Weg zum
      Hinterlegen.
- [x] Gegeben eine Antwort schlägt fehl, wenn ich den Verlauf ansehe, dann
      steht dort der **Grund** und meine Frage ist nicht verloren.
- [x] Gegeben eine Antwort schlug fehl, wenn ich die Frage erneut sende,
      dann wird sie erneut versucht.
- [x] Gegeben ich bin nicht angemeldet, wenn ich die Schnittstelle des
      Chats direkt aufrufe, dann werde ich abgewiesen.
- [x] Gegeben ich gehöre nicht zu dieser Reise, wenn ich ihre Unterhaltung
      abrufe, dann werde ich abgewiesen.
- [x] Gegeben der Bereich ist auf 1280 px zu sehen, wenn ich ihn bediene,
      dann sind Chatfenster und Karte beide benutzbar.
- [x] Gegeben der Planer ist auf 375 px und 768 px zu sehen, wenn ich den
      Bereich öffne, dann ist er benutzbar oder verweist wie die übrigen
      auf einen breiteren Bildschirm (siehe [stack.md](../../stack.md)).
- [x] Gegeben das Schema wurde geändert, wenn ich
      [datenbank.md](../../datenbank.md) ansehe, dann ist sie nachgezogen.

# Constraints

- **Anthropic über das Agent SDK.** Es ist für Werkzeuge gebaut, die
  später dazukommen — mit einem einfachen Nachrichten-Aufruf zu beginnen
  und später umzubauen, wäre zweimal Arbeit.
- **Keine Werkzeuge, kein Zugriff auf Reisedaten.** Die KI bekommt in
  diesem Schritt keine Werkzeuge und keine Reisedaten im Zusammenhang.
  Sie antwortet auf das Geschriebene, nichts weiter.
- **Eigener Zugangsschlüssel je Account** (req-028), verschlüsselt in der
  Datenbank. Die Prüfregel von `account_api_key.kind` erlaubt heute nur
  `ki_suche` und `google` — Anthropic braucht einen eigenen Wert.
- Der Schlüssel der Umgebung (`OPENAI_API_KEY`) wird **nicht** verwendet;
  er dient dem Health-Check (siehe [health.md](../../health.md)).
- Die Modellkennungen stehen an **einer** Stelle im Quelltext. Modelle
  werden abgelöst; eine zweite Liste veraltet unbemerkt.
- Die Karte rechts ist die vorhandene (`poi-map`), nicht eine zweite.
- Der Verlauf gehört zur Reise und zum Account: Wer eine Reise nicht
  sieht, sieht ihre Unterhaltung nicht (req-023, `security.md`).
- Ein Fehler wird benannt und nicht verschluckt (vgl. bug-021, bug-026,
  bug-027, bug-032).
- Wird das Schema geändert, ist `delivery/datenbank.md` nachzuziehen.

# Out of Scope

Dieser Schritt baut den Ort, nicht die Fernsteuerung. Später, jeweils als
eigenes Requirement:

- **Werkzeuge** — POIs suchen und anlegen, Tage planen, Kosten ändern,
  irgendetwas schreiben.
- **Reisedaten im Zusammenhang** — die KI weiß nichts über die geöffnete
  Reise.
- Den Chat im Begleiter (`/go`).
- Sprache statt Schrift.
- Mehrere Unterhaltungen je Reise nebeneinander.
- Den Verlauf durchsuchen oder ausgeben.
- Modelle anderer Anbieter.
- Verbrauch und Kosten der Unterhaltung anzeigen.
