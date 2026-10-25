---
id: req-086
title: Jetzt- und GPS-Linie im Zeitstrahl des Begleiters
app: wegfara
area: Reise
priority: normal
created: 2026-10-25
---

# Goal (Why)

Als Teilnehmer will ich unterwegs direkt im Tagesplan sehen, wo wir laut
Plan sein sollten und wo wir tatsächlich sind. Der Live-Status oben
(req-051) nennt das in Worten, aber im Zeitstrahl selbst sehe ich nicht,
an welcher Stelle des Tages wir stehen.

# Function (What)

Im Zeitstrahl des Begleiters erscheinen am heutigen Tag zwei waagrechte
Linien:

- **„Jetzt“-Linie (Soll):** Akzentfarbe, Beschriftung „Jetzt · HH:MM“.
  Sie liegt beim Programmpunkt, der gerade läuft (bei zeitgleichen
  Optionen bei deren Gruppe). Läuft keiner, liegt sie auf der Wegzeile
  vor dem nächsten anstehenden Programmpunkt. Gibt es keine Wegzeile,
  liegt sie direkt vor diesem Programmpunkt. Die Uhrzeit läuft mit.
- **„GPS“-Linie (Ist):** blau (#4a90d9), mit pulsierendem Punkt wie auf
  der Karte. Sie liegt beim heutigen Programmpunkt, dessen Ort höchstens
  300 m entfernt ist. Ist keiner so nah, liegt sie mit „unterwegs“ auf
  der Wegzeile zum nächsten anstehenden Programmpunkt. Neben ihr steht
  derselbe Verzug wie in der Status-Pille des Live-Status (req-051,
  req-084), z. B. „25 Min zu spät“ oder „Ankunft im Plan“.
- **Beide an derselben Stelle:** Es erscheint nur eine Linie, „Jetzt ·
  Im Zeitplan“.
- Als Position gilt dieselbe wie im Live-Status: die eigene, sonst die
  des Reiseleiters. Gibt es keine, erscheint nur die „Jetzt“-Linie.
- Beim Öffnen des heutigen Tags scrollt der Zeitstrahl so, dass die
  „Jetzt“-Linie sichtbar ist.
- Die Linien erscheinen nur unter denselben Bedingungen wie der
  Live-Status: heute liegt im Zeitraum der Reise, und sie ist
  „Freigegeben“. Auf allen anderen Tagen gibt es keine Linie.

# GUI

- Mockup: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Zeitstrahl, „Jetzt“-Marker (pulsierender Punkt mit Linie und Text)
- Bindend: Orientierung. Der Mockup zeigt nur eine Linie. Farben,
  Puls-Animation und Schrift von dort übernehmen, für die zweite Linie
  das GPS-Blau.

# Acceptance Criteria

- [ ] Gegeben die Reise ist „Freigegeben“, heute läuft um 14:10
      „Mittagessen Positano“, und niemand teilt seine Position, wenn ich
      den heutigen Tag im Begleiter öffne, dann steht bei „Mittagessen
      Positano“ die Linie „Jetzt · 14:10“.
- [ ] Gegeben um 11:30 läuft kein Programmpunkt und „Mittagessen
      Positano“ beginnt um 13:00, wenn ich den heutigen Tag ansehe, dann
      liegt die „Jetzt“-Linie auf der Wegzeile vor „Mittagessen
      Positano“.
- [ ] Gegeben ich teile meine Position und bin 150 m vom Ort von
      „Strand Fornillo“ entfernt, wenn ich den heutigen Tag ansehe, dann
      liegt die blaue GPS-Linie bei „Strand Fornillo“.
- [ ] Gegeben ich teile meine Position, bin in Praiano und 25 Fahrminuten
      vom laufenden „Mittagessen Positano“ entfernt, wenn ich den
      heutigen Tag ansehe, dann steht die GPS-Linie mit „unterwegs · 25
      Min zu spät“ auf der Wegzeile nach Positano.
- [ ] Gegeben ich bin am Ort des laufenden Programmpunkts, wenn ich den
      heutigen Tag ansehe, dann sehe ich genau eine Linie, „Jetzt · Im
      Zeitplan“.
- [ ] Gegeben die „Jetzt“-Linie liegt beim sechsten Programmpunkt des
      Tages, außerhalb des sichtbaren Bereichs, wenn ich den heutigen Tag
      öffne, dann ist die „Jetzt“-Linie ohne Scrollen sichtbar.
- [ ] Gegeben ich wähle im Begleiter den morgigen Tag, wenn ich den
      Zeitstrahl ansehe, dann ist KEINE der beiden Linien vorhanden.
- [ ] Gegeben die Reise steht auf „In Planung“, wenn ich den heutigen Tag
      ansehe, dann ist KEINE der beiden Linien vorhanden.

# Constraints

- Verzug und Position kommen aus derselben Quelle wie im Live-Status.
  Linie und Status-Pille dürfen nie Unterschiedliches sagen.

# Out of Scope

- Linien im Zeitstrahl des Planers.
- Programmpunkte bei Verzug automatisch verschieben oder Vorschläge
  machen.
- Die Positionen einzelner Mitreisender als eigene Linien.
- Änderungen am Live-Status-Kasten selbst.
