---
id: req-015
title: Startseite als Einstieg
app: wegfara
area: Reise
priority: normal
created: 2026-08-02
---

# Ziel (Warum)

Als Nutzer will ich unter der Adresse von wegfara ankommen und von dort
aus dorthin gelangen, wo ich hinwill — planen am Schreibtisch,
begleiten unterwegs, oder als Teilnehmer abstimmen. Heute muss ich den
Pfad kennen und ihn von Hand eintippen.

# Funktion (Was)

Unter der Adresse von wegfara erscheint eine Startseite. Sie zeigt das
Logo aus Kompassrose und Wortmarke, einen Satz, der die App benennt,
und die Wege in die drei Bereiche:

- **Planer** — für die Planung am großen Bildschirm
- **Begleiter** — für unterwegs
- **Abstimmung** — für Reiseteilnehmer, über ein Feld zur Eingabe des
  Einladungscodes

Zu jedem Weg steht eine kurze Zeile, für wen er gedacht ist.

Der Weg zum Planer ist auf schmalen Geräten gekennzeichnet: Er bleibt
sichtbar, trägt aber den Hinweis, dass dafür ein breiterer Bildschirm
nötig ist, und führt dort nicht weiter.

Das Feld für den Einladungscode ist vorhanden; da die Abstimmung noch
nicht gebaut ist, erscheint bei einer Eingabe der Hinweis, dass dieser
Bereich noch nicht verfügbar ist. Es werden keine Codes geprüft.

Die Seite ist auf allen Bildschirmgrößen benutzbar — auf dem Handy
untereinander, auf breiten Bildschirmen nebeneinander.

# GUI

- Erscheinungsbild wie der Planer: Farbwelt „Indigo-Nacht" aus
  `delivery/design/planer/README (1).md`, Abschnitt „Design Tokens".
- Hintergrund in `page` (#0C0F1E) mit dem dort beschriebenen
  Sternenhimmel: mehrere radiale Verläufe mit 1 bis 1,5 px weißen
  Punkten, dazu ein Mondlicht-Verlauf oben rechts in `glow`.
- Logo: die Kompassrose des Planers — achtzackiger Stern in der
  Akzentfarbe, im Kreis mit 1,5 px Umrandung und Schein — darunter die
  Wortmarke „Wegfara" in Playfair Display, darunter die Zeile
  „KI · REISEPLANUNG" in Versalien mit weitem Zeichenabstand.
- Die drei Wege als Karten im Stil des Planers: Radius 18,
  Hintergrund `card`, Umrandung `bd`; beim Überfahren wechselt die
  Umrandung auf `acc` mit Schein.
- Beschriftungen in Figtree, Überschriften in Playfair Display.
- Das Logo steht mittig über den Karten; die Seite ist in der Höhe
  zentriert und kommt ohne Scrollen aus, solange der Platz reicht.

# Akzeptanzkriterien

- [ ] Gegeben ich rufe https://dev.wegfara.com auf, wenn die Seite
      erscheint, dann sehe ich die Wortmarke „Wegfara".
- [ ] Gegeben derselbe Zustand, wenn ich die Seite betrachte, dann sehe
      ich genau drei Wege: Planer, Begleiter und Abstimmung.
- [ ] Gegeben die Startseite in einem 1440 Pixel breiten Fenster, wenn
      ich den Weg „Planer" anklicke, dann öffnet sich der Planer.
- [ ] Gegeben die Startseite, wenn ich den Weg „Begleiter" anklicke,
      dann öffnet sich der Begleiter.
- [ ] Gegeben die Startseite in einem 500 Pixel breiten Fenster, wenn
      ich den Weg „Planer" betrachte, dann trägt er einen Hinweis auf
      die benötigte Bildschirmbreite.
- [ ] Gegeben die Startseite in einem 500 Pixel breiten Fenster, wenn
      ich den Weg „Planer" anklicke, dann öffnet sich der Planer NICHT.
- [ ] Gegeben die Startseite, wenn ich einen Einladungscode eingebe und
      bestätige, dann erscheint der Hinweis, dass die Abstimmung noch
      nicht verfügbar ist.
- [ ] Gegeben die Startseite in einem 500 Pixel breiten Fenster, wenn
      ich sie betrachte, dann stehen die drei Wege untereinander.
- [ ] Gegeben die Startseite, wenn ich sie betrachte, dann ist der
      Hintergrund dunkel (#0C0F1E).
- [ ] Gegeben die Startseite, wenn ich sie betrachte, dann erscheinen
      dort KEINE Reisedaten.

# Constraints

- Die Startseite zeigt keine Inhalte einer Reise. Sie ist ein reiner
  Einstieg.
- Der Zugang zur Abstimmung erfolgt über den Einladungscode; es gibt
  keinen offenen Weg dorthin (siehe req-009).

# Nicht Teil dieses Requirements

- Die Teilnehmer-Abstimmung selbst
- Prüfung oder Einlösung von Einladungscodes
- Anmeldung, Abmeldung, Benutzerkonto
- Auswahl einer Reise auf der Startseite
- Vorstellung der App mit Funktionsbeschreibung oder Bildern
- Rechtliche Seiten wie Impressum oder Datenschutzerklärung
- Umschaltung der Farbwelt auf der Startseite
