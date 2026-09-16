---
id: req-065
title: Icon für Browser-Tab und Homescreen
app: wegfara
area: Reise
priority: normal
created: 2026-09-16
---

# Goal (Why)

Als Nutzer lege ich wegfara auf den Homescreen meines iPads — und bekomme
ein leeres Kästchen statt eines Icons. Im Browser-Tab dasselbe. Die App
soll aussehen wie eine App, gerade der Begleiter, den ich unterwegs aus
dem Homescreen heraus öffne.

# Function (What)

Die **Kompassrose** aus `components/compass-icon.tsx` wird zum Icon —
dasselbe Zeichen, das auf der Anmeldeseite und in der Bereichsleiste
steht. Sie liegt auf dem dunklen Grund der Anmeldeseite (Farbwelt
„Indigo-Nacht", req-015); Apple schneidet das Icon selbst rund zu und
fällt bei Transparenz auf Schwarz zurück.

Das Icon erscheint:

- im Browser-Tab und bei Lesezeichen
- auf dem Homescreen von iPad und iPhone
- auf dem Homescreen von Android

Unter dem Icon steht **Wegfara**.

**Beim Start vom Homescreen läuft die App ohne Adresszeile** — wie eine
eigene App, nicht wie eine Webseite im Browser. Der Begleiter gewinnt
dadurch auf dem Smartphone die Höhe der Browser-Leiste.

**Dev und prod sind unterscheidbar:** Das Icon der dev-Umgebung ist
gekennzeichnet, sodass sich beide auf demselben Homescreen auseinander
halten lassen. Woran — etwa an einer abweichenden Grundfarbe — entscheidet
die Umsetzung; sichtbar sein muss es auf einen Blick.

# Acceptance Criteria

- [ ] Gegeben ich öffne app.wegfara.com im Browser, wenn ich den Tab
      ansehe, dann trägt er die Kompassrose als Icon.
- [ ] Gegeben ich lege app.wegfara.com auf dem iPad zum Homebildschirm
      hinzu, wenn ich den Homescreen ansehe, dann zeigt das Icon die
      Kompassrose.
- [ ] Gegeben das Icon liegt auf dem Homescreen, wenn ich den Text
      darunter lese, dann steht dort „Wegfara".
- [ ] Gegeben das Icon liegt auf dem Homescreen, wenn ich es ansehe, dann
      ist die Kompassrose auf dunklem Grund zu sehen und NICHT auf einer
      schwarzen Fläche.
- [ ] Gegeben ich öffne die App vom Homescreen des iPads, wenn sie
      startet, dann ist KEINE Adresszeile zu sehen.
- [ ] Gegeben ich lege dev.wegfara.com und app.wegfara.com beide auf den
      Homescreen, wenn ich beide Icons ansehe, dann kann ich sie
      unterscheiden.
- [ ] Gegeben ich öffne die App vom Homescreen, wenn ich mich anmelde,
      dann funktioniert die Anmeldung mit Passkey wie im Browser.

# Constraints

- Die Auslieferung ans Smartphone ist eine PWA, kein App Store (siehe
  [stack.md](../../stack.md)).
- Der Passkey hängt an der Domain — vom Homescreen aus gilt derselbe wie
  im Browser derselben Umgebung (req-037).
- Was dev kennzeichnet, muss aus der Umgebung kommen und nicht aus dem
  Quelltext: beide Umgebungen bauen aus demselben Stand.

# Out of Scope

- Offline-Betrieb und das Zwischenspeichern von Seiten.
- Benachrichtigungen auf das Gerät.
- Ein Startbildschirm beim Öffnen der App.
- Ein neues Zeichen entwerfen — es bleibt die vorhandene Kompassrose.
- Die App im App Store anbieten.
