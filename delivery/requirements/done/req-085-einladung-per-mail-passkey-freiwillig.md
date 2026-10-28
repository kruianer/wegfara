---
id: req-085
title: Einladung per E-Mail, Passkey freiwillig
app: wegfara
area: Planung
priority: high
created: 2026-10-25
changes: req-066
---

# Goal (Why)

Als Reiseleiter will ich meine Mitreisenden mit einem Klick einladen,
und sie sollen sicher in die Reise kommen, auch wenn ihr Gerät mit dem
Passkey Probleme macht. Heute kommt die Einladung aus dem Planer nicht
per E-Mail, und wenn der Passkey scheitert, steckt die eingeladene
Person fest.

# Function (What)

- „Einladen“ in der Karte „Wer fährt mit“ schickt der Person die
  Einladung zusätzlich per E-Mail, wenn eine Adresse hinterlegt ist.
  QR-Code und Link erscheinen weiterhin wie heute.
- Ohne hinterlegte Adresse erscheinen QR-Code und Link wie heute, dazu
  der Hinweis „Keine E-Mail-Adresse hinterlegt — gib den Link selbst
  weiter.“
- Die Einladungsseite bietet den Passkey an, macht ihn aber nicht zur
  Pflicht. Von Anfang an, nicht erst nach einem Fehlschlag, steht neben
  der Passkey-Einrichtung „Ohne Passkey weiter“. Wer das wählt, ist
  angemeldet. Die Sitzung gilt wie jede andere so lange, wie die Person
  einer freigegebenen Reise angehört.
- Geht die Sitzung verloren (neues Gerät, Browserdaten gelöscht), kommt
  die Person wie heute über den Anmeldelink per E-Mail zurück.
- Der Text der Einladungs-Mail sagt, dass der Passkey empfohlen, aber
  freiwillig ist.

# Änderung gegenüber heute

- req-066 „Einladung legt sofort einen Passkey an“: Die Einrichtung
  startet weiterhin von selbst. Der Weg ohne Passkey ist jetzt aber von
  Beginn an sichtbar und nicht mehr nur nach einem Fehlschlag.
- req-023: Die Einladung aus „Wer fährt mit“ verschickt jetzt zusätzlich
  eine E-Mail. Gültigkeit (7 Tage), einmalige Verwendung und das
  Entwerten der vorherigen Einladung bleiben unverändert.

# Acceptance Criteria

- [x] Gegeben die Person „Anna“ mit der Adresse anna@example.org ist der
      Reise „Süditalien Rundreise“ zugeordnet, wenn ich in „Wer fährt
      mit“ bei ihr auf „Einladen“ klicke, dann erhält anna@example.org
      eine Einladungs-Mail mit dem Einladungslink.
- [x] Gegeben ich habe für Anna auf „Einladen“ geklickt, wenn die Fläche
      mit QR-Code und Link aufgeht, dann steht dort „Einladung an
      anna@example.org geschickt“.
- [x] Gegeben die Person „Ben“ hat keine E-Mail-Adresse, wenn ich bei ihm
      auf „Einladen“ klicke, dann sehe ich QR-Code und Link mit dem
      Hinweis „Keine E-Mail-Adresse hinterlegt — gib den Link selbst
      weiter.“
- [x] Gegeben Anna öffnet ihren Einladungslink, wenn die Einladungsseite
      erscheint, dann ist „Ohne Passkey weiter“ sofort sichtbar, ohne
      dass vorher ein Fehler aufgetreten ist.
- [x] Gegeben Anna tippt auf „Ohne Passkey weiter“ und die Reise ist
      „Freigegeben“, wenn sie die App schließt und am nächsten Tag
      wieder öffnet, dann ist sie weiterhin angemeldet und sieht die
      Reise.
- [x] Gegeben ich habe Anna zweimal hintereinander eingeladen, wenn sie
      den Link aus der ersten Mail öffnet, dann kommt sie NICHT hinein
      und sieht den Hinweis, dass der Link nicht mehr gültig ist.
- [x] Gegeben die Mail an Anna lässt sich nicht verschicken, wenn ich auf
      „Einladen“ klicke, dann erscheinen QR-Code und Link trotzdem, mit
      dem Hinweis „Die E-Mail konnte nicht verschickt werden — gib den
      Link selbst weiter.“

# Constraints

- Die Vorgaben aus delivery/security.md bleiben unverändert: Der
  Einladungslink ist 7 Tage gültig, genau einmal verwendbar und an genau
  eine Person gebunden. Er wird nicht zum Dauerzugang. „Für die Dauer der
  Reise“ gilt allein die Sitzung, und die gilt schon heute so.
- Die Mail enthält wie bisher keine Reisedaten (req-038), nur Name und
  Link.

# Out of Scope

- Ein Link, der mehrfach oder bis zum Reiseende verwendbar ist.
- Ein Button „Alle einladen“ für mehrere Personen auf einmal.
- Eine E-Mail-Adresse direkt in „Wer fährt mit“ erfassen. Adressen
  werden weiterhin unter „Mein Bereich“ gepflegt.
- Die Behebung von bug-068 (Passkey ohne Geräte-Merker unerreichbar).
  Das ist ein eigener Bug.
- Erinnerungs-Mails an Personen, die die Einladung nicht eingelöst
  haben.
