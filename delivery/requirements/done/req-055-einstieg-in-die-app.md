---
id: req-055
title: Einstieg in die App — direkt dorthin, wo ich hingehöre
app: wegfara
area: Reise
priority: high
created: 2026-09-06
changes: req-015
---

# Goal (Why)

Als Teilnehmer will ich unterwegs die App öffnen und sofort den Plan
sehen — nicht erst eine Seite, auf der ich zwischen Planer, Begleiter
und Abstimmung wählen soll. Wo ich hingehöre, weiß die App besser als
ich: Es hängt davon ab, ob gerade eine Reise läuft, ob abgestimmt wird
und welche Rolle ich habe.

# Function (What)

Die Hauptadresse leitet weiter, statt eine Auswahl zu zeigen.

**Nicht angemeldet** → Anmeldeseite.

**Angemeldet** → dorthin, wo ich hingehöre, in dieser Reihenfolge:

1. Bin ich Teilnehmer einer Reise, die **gerade läuft** (heutiges Datum
   im Zeitraum, Zustand „Freigegeben"), geht es in den **Begleiter** zum
   Plan.
2. Läuft keine Reise, aber eine **Bewertungsrunde** (req-054), geht es
   in den Begleiter zur **Abstimmung**.
3. Sonst: **Reiseleiter und Account-Admin** in den Planer, alle übrigen
   in den Begleiter.

**Der Begleiter in der Vorbereitung.** Solange keine Reise läuft, zeigt
der Begleiter keinen Plan, sondern die laufende Abstimmung. Gibt es auch
die nicht, steht dort, dass gerade nichts ansteht.

**Direkte Adressen.** `/go` und `/plan` sind unmittelbar aufrufbar und
als Lesezeichen auf dem Homescreen tauglich. Wer nicht angemeldet ist,
kommt zur Anmeldung und danach genau dorthin zurück.

**Der Planer ist für Reiseleiter und Account-Admin.** Ruft ein
Teilnehmer ohne diese Rolle `/plan` auf, landet er ohne Meldung im
Begleiter.

**Umschalten.** Wer beide Bereiche darf, findet im Kopfbereich beider
einen Wechsel. Auf schmalen Bildschirmen weist der Planer weiterhin
darauf hin, dass er einen breiteren braucht.

**Ohne Passkey.** Wer auf seinem Gerät keinen Passkey einrichten kann,
meldet sich per Anmeldelink an — jedes Mal neu (req-016). Ein
dauerhafter Zugang ohne Passkey wird nicht geschaffen.

Die Startseite mit den drei Kacheln aus req-015 entfällt; ebenso das
Feld für den Einladungscode, da der Beitritt seit req-023 über die
Einladung läuft.

# Änderung gegenüber heute (req-015)

- Die Hauptadresse zeigt heute eine Auswahlseite mit Planer, Begleiter
  und Abstimmung — künftig leitet sie weiter.
- Nach der Anmeldung landet man heute auf dieser Auswahlseite.
- Der Planer ist heute für jeden Angemeldeten erreichbar.
- Das Feld für den Einladungscode entfällt ersatzlos.

# Acceptance Criteria

- [x] Gegeben ich bin nicht angemeldet, wenn ich die Hauptadresse
      aufrufe, dann sehe ich die Anmeldeseite.
- [x] Gegeben ich bin Teilnehmer einer Reise, die heute läuft und
      freigegeben ist, wenn ich die Hauptadresse aufrufe, dann bin ich
      im Begleiter beim Plan.
- [x] Gegeben keine Reise läuft, aber eine Bewertungsrunde ist offen,
      wenn ich als Teilnehmer die Hauptadresse aufrufe, dann bin ich im
      Begleiter bei der Abstimmung.
- [x] Gegeben weder eine Reise läuft noch eine Bewertungsrunde, wenn ich
      als Reiseleiter die Hauptadresse aufrufe, dann bin ich im Planer.
- [x] Gegeben weder eine Reise läuft noch eine Bewertungsrunde, wenn ich
      als Teilnehmer ohne Rolle die Hauptadresse aufrufe, dann bin ich
      im Begleiter.
- [x] Gegeben eine Reise läuft und ich bin Reiseleiter, wenn ich die
      Hauptadresse aufrufe, dann bin ich im Begleiter — die laufende
      Reise geht vor.
- [x] Gegeben ich bin angemeldet, wenn ich die Hauptadresse aufrufe,
      dann sehe ich KEINE Auswahlseite mit drei Kacheln.
- [x] Gegeben ich bin angemeldet, wenn ich `/go` aufrufe, dann bin ich
      im Begleiter.
- [x] Gegeben ich bin nicht angemeldet, wenn ich `/go` aufrufe und mich
      danach anmelde, dann bin ich im Begleiter.
- [x] Gegeben ich bin Teilnehmer ohne Reiseleitung und ohne
      Account-Admin, wenn ich `/plan` aufrufe, dann bin ich im Begleiter
      und sehe KEINE Fehlermeldung.
- [x] Gegeben ich bin Reiseleiter im Begleiter, wenn ich den Kopfbereich
      ansehe, dann finde ich dort den Wechsel in den Planer.
- [x] Gegeben ich bin Teilnehmer ohne Rolle im Begleiter, wenn ich den
      Kopfbereich ansehe, dann gibt es dort KEINEN Wechsel in den
      Planer.
- [x] Gegeben keine Reise läuft und keine Bewertungsrunde ist offen,
      wenn ich als Teilnehmer den Begleiter öffne, dann steht dort, dass
      gerade nichts ansteht.
- [x] Gegeben eine Bewertungsrunde ist offen und keine Reise läuft, wenn
      ich den Begleiter öffne, dann sehe ich KEINEN Tagesplan.

# Constraints

- Der Planer ist für breite Bildschirme; auf schmalen bleibt der Hinweis
  darauf bestehen (siehe [stack.md](../../stack.md)).
- Alles außer Anmeldung und Wiederherstellung setzt eine angemeldete
  Person voraus (req-016).
- Passwörter gibt es nicht; ohne Passkey bleibt der Anmeldelink
  (siehe [security.md](../../security.md)).

# Out of Scope

- Ein dauerhafter Zugang ohne Passkey.
- Einen dritten Bereich neben Planer und Begleiter bauen — die
  Abstimmung liegt im Begleiter (req-054).
- Merken, wo der Nutzer zuletzt war.
- Die App als PWA installierbar machen.
- Mehrere gleichzeitig laufende Reisen unterscheiden — läuft mehr als
  eine, gilt die, die zuerst begonnen hat.
