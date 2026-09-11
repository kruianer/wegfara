---
id: req-063
title: Bereich Bewertungen — der Stand der Runde im Planer
app: wegfara
area: Planung
priority: normal
created: 2026-09-11
changes: req-054
---

# Goal (Why)

Als Reiseleiter will ich sehen, wie die Gruppe abgestimmt hat — an einer
Stelle, nicht verstreut über die POI-Liste. Was alle wollen, was niemand
will und wer noch nicht gestimmt hat: daraus entscheide ich, welche POIs
in den Plan kommen.

Der Bereich „Bewertungen" steht im Planer bereits im Kopfbereich, ist
aber abgeschaltet (bug-045) — er wurde nie gebaut.

# Function (What)

Der Bereich zeigt die **laufende** Bewertungsrunde; läuft keine, die
zuletzt beendete. Je POI eine Zeile:

- Name des POI und sein Status
- die Stimmen je Stufe als Zahl — Will ich unbedingt, Wäre schön, Wenn
  wir Zeit haben, Lieber nicht, Ohne mich
- wie viele noch nicht gestimmt haben
- aufklappbar: **wer** wie gestimmt hat, mit Namen

**Sortiert nach Zustimmung**, höchste oben. Gerechnet wird je Stimme:
Will ich unbedingt = 2, Wäre schön = 1, Wenn wir Zeit haben = 0, Lieber
nicht = −1, Ohne mich = −2; die Summe ergibt die Reihenfolge.

**Aus der Zeile heraus** lässt sich der Status des POI setzen — die
Entscheidung trifft weiterhin der Reiseleiter, sie folgt nie von selbst
aus den Stimmen (req-054).

**Oben „Runde beenden"**, nur bei laufender Runde und nur für den
Reiseleiter. Danach bleiben die Stimmen sichtbar.

Wurde ein POI der Runde inzwischen gelöscht, verschwindet seine Zeile.

**Gab es noch nie eine Runde**, steht dort: „Noch keine Bewertungsrunde.
Im Bereich POIs lässt sich eine starten."

Abgestimmt wird weiterhin ausschließlich im Begleiter (req-054).

# Änderung gegenüber heute (req-054)

- Der Bereich „Bewertungen" ist im Planer abgeschaltet; er wird
  bedienbar.
- Der Stand steht heute nur verstreut an den POI-Zeilen der POI-Liste;
  dort bleibt er zusätzlich bestehen.

# Acceptance Criteria

- [x] Gegeben ich öffne den Planer, wenn ich „Bewertungen" wähle, dann
      öffnet sich der Bereich.
- [x] Gegeben eine laufende Runde über drei POIs, wenn ich den Bereich
      öffne, dann sehe ich drei Zeilen.
- [x] Gegeben zwei Teilnehmer haben „Will ich unbedingt" für „Villa
      Rufolo" gestimmt, wenn ich seine Zeile ansehe, dann steht dort die
      Zahl 2 bei dieser Stufe.
- [x] Gegeben vier Teilnehmer und zwei haben gestimmt, wenn ich die
      Zeile ansehe, dann steht dort, dass zwei noch nicht gestimmt haben.
- [x] Gegeben eine Zeile mit Stimmen, wenn ich sie aufklappe, dann sehe
      ich, wer wie gestimmt hat.
- [x] Gegeben POI A mit zwei „Will ich unbedingt" und POI B mit zwei
      „Wäre schön", wenn ich die Liste ansehe, dann steht A vor B.
- [x] Gegeben POI C, für den zwei „Ohne mich" gestimmt haben, wenn ich
      die Liste ansehe, dann steht er hinter POIs ohne Ablehnung.
- [ ] Gegeben eine Zeile, wenn ich dort den Status auf „Gesetzt" setze,
      dann trägt der POI im Bereich POIs diesen Status.
- [ ] Gegeben alle Teilnehmer haben „Will ich unbedingt" gestimmt, wenn
      ich die Zeile ansehe, dann hat sich der Status des POI NICHT von
      selbst geändert.
- [ ] Gegeben ich bin Reiseleiter und eine Runde läuft, wenn ich „Runde
      beenden" wähle, dann ist sie beendet.
- [ ] Gegeben die Runde ist beendet, wenn ich den Bereich öffne, dann
      sehe ich ihre Stimmen weiterhin.
- [ ] Gegeben die Runde ist beendet, wenn ich den Bereich ansehe, dann
      gibt es KEINEN Knopf „Runde beenden" mehr.
- [ ] Gegeben ein POI der Runde wurde gelöscht, wenn ich den Bereich
      ansehe, dann ist seine Zeile verschwunden.
- [x] Gegeben es gab noch nie eine Runde für diese Reise, wenn ich den
      Bereich öffne, dann sehe ich den Hinweis mit dem Verweis auf den
      Bereich POIs.

# Constraints

- Aus den Stimmen folgt nie ein Status — der Plan ändert sich nicht von
  selbst ([vision.md](../../vision.md), req-054).
- Abgestimmt wird im Begleiter; dieser Bereich zeigt und entscheidet,
  er stimmt nicht ab (req-054).
- Alle sehen alle Stimmen mit Namen (req-054) — der Planer steht ohnehin
  nur Reiseleitern und Account-Admins offen (req-055).

# Out of Scope

- Abstimmen im Planer.
- Eine Runde aus diesem Bereich heraus starten — das bleibt in der
  POI-Liste, wo die POIs ausgewählt werden.
- Teilnehmer erinnern, die noch nicht gestimmt haben.
- Mehrere Runden derselben Reise nebeneinander anzeigen.
- Den Stand im Begleiter anzeigen.
