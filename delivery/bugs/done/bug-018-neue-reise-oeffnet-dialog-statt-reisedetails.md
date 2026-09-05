---
id: bug-018
app: wegfara
req: req-033
priority: normal
created: 2026-09-05
---

# Observed

Beim Anlegen einer neuen Reise erscheint immer noch der Dialog.

# Expected

Eine neue Reise anlegen führt direkt in die Reisedetails (req-033): sie
erscheinen mit leeren Feldern, erst das Speichern legt die Reise an. Ein
Dialog erscheint dabei nicht.

# Steps

1. Planer öffnen
2. Eine neue Reise anlegen
3. Statt der Reisedetails öffnet sich der Dialog

# Ursache

Der Weg zum Anlegen führt seit req-033 über das Aufklappmenü am
Reisenamen: es öffnet sich als Dialog über der Ansicht, und sein Eintrag
„Neue Reise" führt in die Reisedetails. Der Eintrag selbst tat, was er
soll — das überlagernde Formular aus req-017 gibt es nicht mehr, und wer
den Eintrag trifft, landet in den leeren Reisedetails.

Der Dialog ließ sich aber nur auf genau zwei Arten wieder schließen:
durch einen zweiten Klick auf den Reisenamen oder durch einen Klick auf
einen seiner Einträge. Ein Tippen daneben schloss ihn nicht, die
Escape-Taste ebenso wenig. Kam ein Tippen auf „Neue Reise" nicht als
Klick an — am iPad nicht selten, siehe bug-017 und bug-009 —, blieb der
Dialog stehen und verdeckte genau die Stelle, an der die Reisedetails
erscheinen. Aus Sicht des Nutzers öffnete sich beim Anlegen einer Reise
also der Dialog statt der Reisedetails, und er ließ sich nicht
wegtippen.

# Behebung

Das Aufklappmenü verhält sich jetzt wie ein Dialog, der sich wegtippen
lässt (`app/plan/components/header.tsx`):

- Ein Zeigerereignis außerhalb des Reisewählers schließt es. Es wird
  dabei nicht abgefangen, sondern erreicht die Ansicht darunter — was
  dort liegt, bleibt mit einem Griff bedienbar, statt dass der erste
  Griff nur den Dialog schließt.
- Die Escape-Taste schließt es ebenfalls.
- Was innerhalb des Menüs getippt wird, lässt es unberührt; seine
  Einträge schließen es weiterhin selbst, bevor sie ihre Wirkung
  auslösen.

Gehorcht wird auf `pointerdown`, nicht auf `click` — so kommt das
Schließen auch mit dem Finger und dem Stift an, nicht nur mit der Maus.
Am Verhalten des Eintrags „Neue Reise" selbst ändert sich nichts: er
führt weiterhin unmittelbar in die leeren Reisedetails, ohne Formular
darüber (req-033).

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

- `app/plan/components/header.test.tsx`: das Aufklappmenü schließt beim
  Tippen daneben und mit Escape, bleibt beim Tippen darin offen, und das
  Tippen daneben erreicht die Ansicht darunter (der angetippte Bereich
  wird gewechselt).
- `app/plan/plan-view.test.tsx`: nach „Neue Reise" steht kein Dialog mehr
  über den Reisedetails, und ein offenes Aufklappmenü verschwindet beim
  Tippen auf die Reisedetails.

# Akzeptanzkriterien der Behebung

- [x] Gegeben das Aufklappmenü am Reisenamen ist offen, wenn ich „Neue
      Reise" wähle, dann sehe ich die Reisedetails mit leeren Feldern und
      keinen Dialog darüber.
- [x] Gegeben das Aufklappmenü ist offen, wenn ich daneben tippe, dann
      ist es weg und die Ansicht darunter wieder frei.
- [x] Gegeben das Aufklappmenü ist offen, wenn ich daneben auf eine
      Schaltfläche tippe, dann wirkt dieses Tippen auch dort — es wird
      nicht vom Schließen verbraucht.
- [x] Gegeben das Aufklappmenü ist offen, wenn ich Escape drücke, dann
      ist es weg.
- [x] Gegeben das Aufklappmenü ist offen, wenn ich darin tippe, dann
      bleibt es offen.
