---
id: req-040
title: Programmpunkt umplanen
app: wegfara
area: Planung
priority: normal
created: 2026-09-04
changes: req-011
---

# Goal (Why)

Als Reiseleiter will ich einen einmal gesetzten Programmpunkt
korrigieren, ohne ihn zu entfernen und neu anzulegen. Ein Tag wird
selten beim ersten Versuch richtig — die Uhrzeit rutscht, ein
Programmpunkt passt besser auf den Folgetag, und die geschätzte Dauer
trifft nicht immer zu.

# Function (What)

Ein Programmpunkt im Zeitstrahl lässt sich auf eine andere Uhrzeit
ziehen; seine Dauer bleibt dabei gleich. Die neue Startzeit rastet auf
15 Minuten ein, wie beim Verplanen (req-039).

Zieht man ihn auf einen anderen Reisetag, wechselt er dorthin und behält
Uhrzeit und Dauer.

Am unteren Rand lässt sich der Programmpunkt länger oder kürzer ziehen.
Die kürzeste Dauer beträgt 15 Minuten.

Alle drei Änderungen sind sofort gespeichert und ohne Neuladen sichtbar.
Überlappungen bleiben erlaubt (req-039).

# GUI

- Mockup: `delivery/design/planer/Reiseplaner v4.dc.html`, Abschnitt
  „2. Planung" (Vorlage aus req-011).
- Bindend: nur Orientierung. Die Vorlage zeigt die Ansicht, nicht das
  Umplanen — Spaltenbreiten und Stundenraster aus req-011 bleiben
  unverändert.

# Acceptance Criteria

- [ ] Gegeben ein Programmpunkt liegt von 10:00 bis 12:30, wenn ich ihn
      auf 14:00 ziehe, dann liegt er von 14:00 bis 16:30.
- [ ] Gegeben ein Programmpunkt liegt am 12. Mai, wenn ich ihn auf den
      Reiter des 13. Mai ziehe, dann liegt er am 13. Mai zur selben
      Uhrzeit.
- [ ] Gegeben ein Programmpunkt endet um 12:30, wenn ich seinen unteren
      Rand auf 14:00 ziehe, dann endet er um 14:00.
- [ ] Gegeben ein Programmpunkt von 10:00 bis 12:30, wenn ich seinen
      unteren Rand über den Beginn hinaus nach oben ziehe, dann endet er
      um 10:15 und NICHT früher.
- [ ] Gegeben ich habe einen Programmpunkt verschoben, wenn ich die
      Seite neu lade, dann liegt er an der neuen Stelle.
- [ ] Gegeben ich verschiebe einen Programmpunkt, der aus einem POI
      stammt, wenn ich die Spalte „Noch unverplant" ansehe, dann ist der
      POI dort weiterhin NICHT zu sehen.
- [ ] Gegeben ich ziehe einen Programmpunkt auf eine Zeit, an der
      bereits einer liegt, dann liegen beide nebeneinander und das
      Verschieben wird NICHT abgelehnt.

# Constraints

- Ein Programmpunkt bleibt immer innerhalb des Reisezeitraums — auf
  einen Tag außerhalb lässt er sich nicht ziehen.
- Der Planer ist für breite Bildschirme. Auf schmalen Bildschirmen
  bleibt es beim heutigen Hinweis.

# Out of Scope

- Verplanen und Entfernen — das ist req-039.
- „KI planen lassen" und „Transfers" — beide Knöpfe bleiben ohne
  Funktion; Transfers werden beim Umplanen nicht angepasst.
- Bearbeiten von Titel, Texten, Buchungszustand und Kontaktwegen.
- Rückgängig machen einer Verschiebung über einen eigenen Weg.
