---
id: bug-068
app: wegfara
req: req-023
priority: normal
created: 2026-10-25
---

# Observed

Eine eingeladene Person (Rolle Teilnehmer) scannt den QR-Code der
Einladung (Planer, Karte "Wer fährt mit", Button "Einladen"). Danach
gibt es widersprüchliche Meldungen:

1. Nach dem ersten Scan landet sie auf der Anmeldeseite mit "Auf diesem
   Gerät ist kein Passkey hinterlegt, oder die Entsperrung hat nicht
   geklappt."
2. Bei einer neuen Einladung meldet die Passkey-Einrichtung: "Auf diesem
   Gerät ist für dich bereits ein Passkey hinterlegt …"
   (InvalidStateError).
3. Meldet sie sich normal an, heißt es wieder "kein Passkey
   eingerichtet".

Wörtlich vom Nutzer: "Es kommt die Meldung, dass der Passkey schon
eingerichtet ist. Bei der normalen Anmeldung kommt dann kein Passkey
eingerichtet."

Vermutete Ursache (aus dem Code, bitte bestätigen): Die Reise steht auf
"In Planung". Der Passkey wird beim ersten Scan korrekt angelegt. Danach
geht es nach "/", und requireTripAccess() beendet die Sitzung, weil die
Person keiner freigegebenen Reise angehört und keine leitet
(sessionRemainsValid). Dann folgt die Weiterleitung nach
/anmeldung?fehler=keine-reise. Die Anmeldeseite zeigt in diesem Fall den
Dialog. Seine feste Überschrift lautet "Auf diesem Gerät ist kein
Passkey hinterlegt, oder die Entsperrung hat nicht geklappt", obwohl der
Passkey existiert und die Anmeldung technisch geklappt hat. Der
eigentliche Grund (NO_ACTIVE_TRIP_NOTICE) steht klein darunter und geht
unter. Dasselbe passiert bei jeder späteren normalen Anmeldung.

Nebenbefund: Bei einem verbrauchten oder abgelaufenen Einladungslink
(fehler=einladung) erscheint dieselbe irreführende Überschrift.

# Expected

- Verhindert ein anderer Grund als ein fehlender Passkey die Anmeldung
  (keine-reise, einladung), dann nennt die Anmeldeseite genau diesen
  Grund als Hauptaussage. Dass auf dem Gerät kein Passkey hinterlegt sei,
  behauptet sie dann nicht.
- Bei "keine-reise" versteht die Person, dass ihr Passkey in Ordnung ist
  und sie hineinkommt, sobald der Reiseleiter die Reise freigibt.
- Der Reiseleiter sieht beim Einladen eines Teilnehmers in eine Reise
  "In Planung", dass die Person erst nach der Freigabe hineinkommt. Dann
  schickt er keine Einladung ab, die scheinbar nicht funktioniert.

# Steps

1. Reise auf "In Planung" lassen, eine Person als Teilnehmer zuordnen.
2. In "Wer fährt mit" auf "Einladen" klicken und den QR-Code mit einem
   anderen Gerät scannen.
3. Der Passkey wird angelegt, danach erscheint die Anmeldeseite mit
   "kein Passkey hinterlegt".
4. Erneut einladen: "bereits ein Passkey hinterlegt". Normal anmelden:
   wieder "kein Passkey hinterlegt".
