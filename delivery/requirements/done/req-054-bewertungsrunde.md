---
id: req-054
title: Bewertungsrunde — die Gruppe stimmt über POIs ab
app: wegfara
area: Planung
priority: normal
created: 2026-09-06
---

# Goal (Why)

Als Reiseleiter will ich vor dem Planen wissen, worauf die Gruppe Lust
hat und wer wo mitkommt. Heute setze ich den Status jedes POI allein —
was die anderen wollen, erfahre ich nur im Gespräch. Und wer bei einem
Programmpunkt lieber nicht dabei wäre, sagt es mir oft gar nicht.

# Function (What)

Der Reiseleiter startet im Planer eine **Bewertungsrunde**: Er wählt
aus, über welche POIs der Reise abgestimmt wird.

Jeder **Teilnehmer der Reise** sieht die laufende Runde im Begleiter und
gibt je POI seine **Stimme** ab — eine von fünf:

- Will ich unbedingt
- Wäre schön
- Wenn wir Zeit haben
- Lieber nicht
- Ohne mich

„Ohne mich" heißt: Ich bin dort nicht dabei, auch wenn die anderen
hingehen. Solange die Runde läuft, lässt sich die eigene Stimme ändern.

Alle sehen alle Stimmen, mit Namen — auch, wer noch nicht gestimmt hat.

Der Reiseleiter sieht im Planer je POI die Verteilung der Stimmen. Er
**setzt den Status weiterhin selbst** (Gesetzt, Wahrscheinlich, …); die
Stimmen sind Entscheidungshilfe, kein Automatismus. Status und Stimme
sind zweierlei: Der Status beschreibt den Ort, die Stimme die Person.

Beim **Beenden** der Runde bleiben die Stimmen erhalten und sichtbar;
neue lassen sich nicht mehr abgeben. Wer „Ohne mich" gestimmt hat, wird
am POI angezeigt — und am Programmpunkt, sobald dieser POI verplant ist.

Wer in einer laufenden Runde noch nicht gestimmt hat, bleibt angemeldet,
auch ohne freigegebene Reise (siehe req-023, „offene Bewertung").

Der Begriff **Bewertungsrunde** wird ins Glossar der
[stack.md](../../stack.md) aufgenommen, ebenso **Stimme**.

# Acceptance Criteria

- [x] Gegeben ich bin Reiseleiter der Reise „Süditalien Rundreise", wenn
      ich eine Bewertungsrunde starte und drei POIs auswähle, dann läuft
      danach eine Runde über genau diese drei.
- [x] Gegeben ich bin Teilnehmer und eine Runde läuft, wenn ich den
      Begleiter öffne, dann sehe ich die POIs dieser Runde.
- [x] Gegeben ich sehe einen POI der Runde, wenn ich „Will ich
      unbedingt" wähle, dann ist meine Stimme gespeichert.
- [x] Gegeben ich habe „Wäre schön" gestimmt, wenn ich auf „Ohne mich"
      wechsle, dann gilt „Ohne mich".
- [x] Gegeben zwei Teilnehmer haben gestimmt und einer nicht, wenn ich
      den POI ansehe, dann sehe ich beide Stimmen mit Namen und wer noch
      fehlt.
- [x] Gegeben ich bin Reiseleiter, wenn ich die POI-Liste im Planer
      ansehe, dann sehe ich je POI der Runde die Verteilung der Stimmen.
- [x] Gegeben alle Teilnehmer haben „Will ich unbedingt" gestimmt, wenn
      ich die POI-Liste ansehe, dann hat sich der Status des POI NICHT
      von selbst geändert.
- [x] Gegeben ich bin Reiseleiter, wenn ich nach der Abstimmung den
      Status eines POI auf „Gesetzt" setze, dann bleiben die Stimmen
      unverändert daneben stehen.
- [x] Gegeben eine laufende Runde, wenn der Reiseleiter sie beendet,
      dann kann ich als Teilnehmer keine Stimme mehr abgeben.
- [x] Gegeben eine beendete Runde, wenn ich ihre POIs ansehe, dann sind
      die Stimmen weiterhin sichtbar.
- [x] Gegeben ein Teilnehmer hat bei einem POI „Ohne mich" gestimmt,
      wenn ich diesen POI ansehe, dann steht dort, dass er nicht dabei
      ist.
- [x] Gegeben ein POI mit einer „Ohne mich"-Stimme wurde verplant, wenn
      ich den Programmpunkt im Zeitstrahl ansehe, dann steht auch dort,
      wer nicht dabei ist.
- [x] Gegeben ich bin Teilnehmer und nicht Reiseleiter, wenn ich eine
      Bewertungsrunde starten will, dann wird das abgelehnt.
- [x] Gegeben ich gehöre nicht zu dieser Reise, wenn ich über ihre POIs
      abstimmen will, dann wird das abgelehnt.
- [x] Gegeben es läuft keine Runde, wenn ich als Teilnehmer den
      Begleiter öffne, dann sehe ich KEINE Abstimmung.
- [x] Gegeben ich habe in einer laufenden Runde noch nicht gestimmt und
      gehöre keiner freigegebenen Reise an, wenn ich die App öffne, dann
      bin ich weiterhin angemeldet.
- [x] Gegeben die Umsetzung ist fertig, wenn ich das Glossar in
      [stack.md](../../stack.md) öffne, dann stehen dort
      „Bewertungsrunde" und „Stimme".

# Constraints

- Die Stimme gehört zur Zuordnung zwischen Person und Reise — dieselbe
  Person kann bei verschiedenen Reisen verschieden stimmen (vgl.
  req-021).
- Der POI-Status bleibt unverändert bestehen; „Noch unverplant" und die
  Kartenfilter hängen daran (req-011, req-013).
- Im Zweifel vorschlagen statt selbst umbauen — die Stimmen ändern den
  Plan nie von selbst ([vision.md](../../vision.md)).

# Out of Scope

- Status automatisch aus den Stimmen setzen.
- Wer „Ohne mich" gestimmt hat, bei den Kosten einer Ausgabe
  ausschließen.
- Mehrere gleichzeitig laufende Runden zu einer Reise.
- Erinnerung an Teilnehmer, die noch nicht gestimmt haben.
- Abstimmen im Planer — die Stimme wird im Begleiter abgegeben.
- Kommentare oder Begründungen zu einer Stimme.
