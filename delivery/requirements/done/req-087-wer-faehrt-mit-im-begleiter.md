---
id: req-087
title: „Wer fährt mit“ im Begleiter
app: wegfara
area: Reise
priority: normal
created: 2026-10-25
---

# Goal (Why)

Als Reiseleiter will ich die Mitreisenden meiner Reise auch auf dem
iPhone verwalten, vor allem unterwegs jemanden einladen. Heute geht das
nur im Planer, und der ist erst ab 1180 px Breite nutzbar. Auf dem Handy
komme ich gar nicht an die Mitreisenden.

# Function (What)

- Im Begleiter gibt es im Menü „Mehr“ den neuen Eintrag „Wer fährt
  mit“. Er erscheint nur für Personen, die im Planer die Karte „Wer fährt
  mit“ bearbeiten dürfen (Reiseleiter der Reise, Account-Admin). Alle
  anderen sehen den Eintrag nicht.
- Er öffnet eine Ansicht für die Reise, die im Begleiter gerade offen ist.
  Eine eigene Reise-Auswahl gibt es dort nicht, gewechselt wird wie
  bisher im Begleiter.
- Die Ansicht kann alles, was die Karte „Wer fährt mit“ im Planer
  (req-021, req-023) kann:
  - die zugeordneten Personen mit Rolle und dem Hinweis „Zugang“ oder
    „Kein Zugang“
  - die Rolle ändern (Reiseleiter oder Teilnehmer)
  - „Einladen“ mit QR-Code, Link und „Link kopieren“, inklusive E-Mail,
    sobald req-085 umgesetzt ist
  - eine Person des Accounts zur Reise hinzufügen
  - eine Person nach Rückfrage aus der Reise entfernen
- Es gelten dieselben Regeln wie im Planer. Insbesondere bleibt immer
  mindestens ein Reiseleiter.
- Ein „Zurück“ führt in den Begleiter.
- Die Ansicht ist für 375 px (iPhone), 768 px (iPad hochkant) und
  1280 px gebaut und erfüllt bei jeder dieser Breiten die vier Regeln aus
  delivery/stack.md: Nichts ragt über den Rand, nichts überlappt, alles
  ist erreichbar, und jede Tippfläche ist mindestens 44×44 px groß.

# Acceptance Criteria

- [x] Gegeben ich bin Reiseleiter von „Süditalien Rundreise“ und habe sie
      im Begleiter offen, wenn ich auf dem iPhone „Mehr“ öffne, dann sehe
      ich den Eintrag „Wer fährt mit“.
- [x] Gegeben ich bin nur Teilnehmer dieser Reise und kein Account-Admin,
      wenn ich „Mehr“ öffne, dann gibt es KEINEN Eintrag „Wer fährt mit“.
- [x] Gegeben ich öffne „Wer fährt mit“ auf einem 375 px breiten
      Bildschirm, wenn ich die Liste mit 4 Personen ansehe, dann steht bei
      jeder Person Name, Rolle, Zugangshinweis und „Einladen“ vollständig
      sichtbar, ohne dass sich die Seite seitlich scrollen lässt.
- [x] Gegeben die Person „Anna“ hat „Kein Zugang“, wenn ich bei ihr auf
      „Einladen“ tippe, dann sehe ich QR-Code und Link vollständig auf dem
      Bildschirm.
- [x] Gegeben die Person „Ben“ gehört zum Account, aber nicht zur Reise,
      wenn ich ihn hinzufüge, dann steht er danach in der Liste und
      genauso im Planer in „Wer fährt mit“.
- [x] Gegeben ich bin der einzige Reiseleiter, wenn ich mich zum
      Teilnehmer machen will, dann wird das abgelehnt mit „Die Reise
      braucht mindestens einen Reiseleiter.“
- [x] Gegeben ich habe in „Wer fährt mit“ etwas geändert, wenn ich auf
      „Zurück“ tippe, dann bin ich wieder im Begleiter bei derselben
      Reise.

# Constraints

- Gleiche Regeln und gleiche Berechtigungen wie die Karte „Wer fährt mit“
  im Planer. Beide Wege zeigen und ändern dieselben Daten.

# Out of Scope

- Die übrigen Reisedetails (Name, Zeitraum, Zustand, Reise anlegen oder
  löschen) im Begleiter.
- Den Planer auf schmalen Bildschirmen freischalten. Er zeigt dort
  weiterhin den Hinweis „Bildschirm zu schmal“.
- Neue Personen im Account anlegen oder ihre Daten (E-Mail, Telefon,
  IBAN) bearbeiten. Das bleibt in „Mein Bereich“.
- Änderungen an der Planer-Karte „Wer fährt mit“ selbst.
