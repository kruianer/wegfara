---
id: bug-068
app: wegfara
req: req-066
priority: high
created: 2026-10-25
---

# Observed

Eine eingeladene Person scannt den QR-Code der Einladung (Planer, Karte
"Wer fährt mit", Button "Einladen"). Die Reise steht auf "Freigegeben".
Die Person kommt nicht hinein:

1. Die Passkey-Einrichtung meldet "Auf diesem Gerät ist für dich bereits
   ein Passkey hinterlegt …" (InvalidStateError).
2. Auf der normalen Anmeldeseite steht "Auf diesem Gerät ist kein
   Passkey hinterlegt, oder die Entsperrung hat nicht geklappt".

Wörtlich vom Nutzer: "Es kommt die Meldung, dass der Passkey schon
eingerichtet ist. Bei der normalen Anmeldung kommt dann kein Passkey
eingerichtet." (Die Reise ist freigegeben, keine-reise scheidet also
aus.)

Ursache laut Code:
- Die Anmeldeseite versucht den Passkey nur, wenn im localStorage der
  Merker `wegfara.passkey-auf-diesem-geraet` steht
  (components/use-entsperrung-beim-oeffnen.ts, lib/auth/geraete-merker.ts).
  Fehlt er, zeigt sie sofort den Dialog "kein Passkey hinterlegt". Im
  Dialog gibt es **keine Schaltfläche, um es trotzdem mit dem Passkey zu
  versuchen**, nur "Zugang verloren" (E-Mail-Link). Ein vorhandener,
  funktionierender Passkey ist damit unerreichbar.
- Gesetzt wird der Merker nur nach erfolgreicher Einrichtung oder
  Anmeldung im selben Browser. Er fehlt zum Beispiel, wenn der Passkey in
  einem anderen Browser oder Browser-Kontext angelegt wurde (In-App-
  Browser der QR-App, privater Modus, anderer Browser) oder wenn der
  Browser-Speicher gelöscht wurde.
- Endet die Einrichtung auf der Einladungsseite mit InvalidStateError
  ("bereits ein Passkey hinterlegt"), wird der Merker auch nicht gesetzt,
  und es gibt keinen Weg zur Anmeldung mit diesem Passkey. Die Person
  steckt in einer Sackgasse. Eine neue Einladung hilft nicht, sie endet
  wieder mit InvalidStateError.

# Expected

- Auf der Anmeldeseite lässt sich der Passkey immer versuchen, auch ohne
  Merker. Im Dialog gibt es dafür eine klare Schaltfläche (z. B. "Mit
  Passkey anmelden"). Nur der automatische Start beim Öffnen hängt am
  Merker.
- Die Überschrift des Dialogs behauptet nicht pauschal "kein Passkey
  hinterlegt", wenn das niemand geprüft hat.
- Meldet die Einladungsseite InvalidStateError, dann ist ein Passkey für
  diese Person auf dem Gerät. Die Seite setzt den Merker und meldet die
  Person direkt mit diesem Passkey an, oder sie bietet genau das an, statt
  in einer Fehlermeldung zu enden.
- Ergebnis: Wer auf seinem Gerät einen gültigen Passkey hat, kommt damit
  hinein, egal in welchem Browser-Kontext er angelegt wurde.

# Steps

1. Freigegebene Reise, Person als Teilnehmer, "Einladen", QR-Code mit
   einem anderen Gerät scannen. Der Passkey wird angelegt, aber in einem
   Browser-Kontext ohne späteren Merker (z. B. In-App-Browser der
   QR-App).
2. Wegfara im normalen Browser öffnen: Die Anmeldeseite zeigt sofort
   "kein Passkey hinterlegt" und bietet keinen Passkey-Versuch an.
3. Neue Einladung scannen: "bereits ein Passkey hinterlegt". Kein Weg
   hinein außer dem E-Mail-Link (nur mit hinterlegter Adresse).
