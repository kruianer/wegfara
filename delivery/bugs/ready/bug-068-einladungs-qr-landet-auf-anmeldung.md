---
id: bug-068
app: wegfara
req: req-023
priority: normal
created: 2026-10-25
---

# Observed

Eine eingeladene Person hat den QR-Code einer Einladung gescannt (Planer,
Karte "Wer fährt mit", Button "Einladen"). Statt der Passkey-Einrichtung
kam die Meldung, auf dem Gerät gebe es keinen Passkey. Wörtlich vom
Nutzer: "Der QR-Code hat nicht funktioniert. Er sagt, es gibt keinen
Passkey auf dem Gerät."

Diese Meldung ("Auf diesem Gerät ist kein Passkey hinterlegt …") steht
nur auf der Anmeldeseite (app/anmeldung/anmelde-view.tsx). Die Person ist
also auf /anmeldung gelandet und nicht auf /einladung/passkey. Das heißt,
das Einlösen des Tokens in app/einladung/route.ts ist fehlgeschlagen
(Weiterleitung nach /anmeldung?fehler=einladung). Die Anmeldeseite hat
dann die Passkey-Entsperrung gestartet, und die musste scheitern.

Mögliche Ursachen (bitte prüfen, das Log "einladung-einloesen" zeigt den
Fehlschlag):
- Der Einmal-Link wurde schon vorher per GET abgerufen und damit
  verbraucht, z. B. durch die Link-Vorschau der Kamera-/QR-App oder eines
  Messengers. Ein GET, das den Token entwertet, ist für Vorschau-Abrufe
  anfällig.
- Ein erneuter Klick auf "Einladen" hat den gezeigten Link entwertet.
- Der Link ist abgelaufen, oder dev und prod wurden verwechselt.

Zusätzlich: Der Hinweis "Dieser Zugangslink ist abgelaufen oder wurde
bereits verwendet …" ist dem Nutzer offenbar nicht aufgefallen. Er hat
nur die Passkey-Meldung gesehen.

# Expected

- Wer einen frischen Einladungs-QR-Code scannt, landet zuverlässig in der
  Passkey-Einrichtung (/einladung/passkey) und kann den Passkey anlegen.
  Eine Link-Vorschau oder ein Vorab-Abruf darf die Einladung nicht
  verbrauchen.
- Ist der Link wirklich ungültig, startet die Anmeldeseite keine
  aussichtslose Passkey-Entsperrung. Sie zeigt klar und an erster Stelle,
  dass der Einladungslink ungültig ist und man einen neuen beim
  Reiseleiter holen soll.

# Steps

1. Im Planer bei einer Reise in "Wer fährt mit" bei einer Person ohne
   Zugang auf "Einladen" klicken.
2. Den QR-Code mit einem anderen Gerät (ohne Wegfara-Passkey) scannen und
   öffnen.
3. Statt der Passkey-Einrichtung erscheint die Anmeldeseite mit "kein
   Passkey hinterlegt".
