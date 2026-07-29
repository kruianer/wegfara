---
id: req-007
title: Themenauswahl im Begleiter
app: wegfara
area: Reise
priority: normal
created: 2026-07-29
changes: req-001
---

# Ziel (Warum)

Als Reisender will ich das Aussehen des Begleiters umstellen können.
Unterwegs entscheidet das über Lesbarkeit: in der Mittagssonne braucht
es hohen Kontrast, abends im Auto blendet eine helle Ansicht, und auf
langen Fahrten schont eine dunkle Darstellung den Akku.

# Funktion (Was)

Im Kopfbereich rechts steht ein runder Knopf. Ein Klick darauf öffnet
eine Liste mit zehn Farbwelten. Jeder Eintrag zeigt drei Farbmuster
seiner Farbwelt und ihren Namen; die aktive trägt ein Häkchen.

Die Auswahl einer Farbwelt färbt den Begleiter sofort um — ohne
Neuladen der Seite. Danach schließt sich die Liste.

Die getroffene Wahl bleibt auf dem Gerät erhalten und gilt beim
nächsten Öffnen weiter. Sie gilt nur für die Person an diesem Gerät und
wird nicht mit anderen Reiseteilnehmern geteilt.

Wurde noch nie gewählt, gilt „Hell".

Es gibt diese zehn Farbwelten: Hell, Dunkel, Notte · OLED, Riviera ·
Petrol, Aurora · Violett, Magma · Rot, Blau · dunkel, Lila · dunkel,
Orange / Anthrazit, Anthrazit / Gold.

Das Theme gilt für den Begleiter. Die Startseite bleibt unverändert.

# Änderung gegenüber heute (req-001)

Heute sind die Farben des Begleiters fest hinterlegt und entsprechen
der Farbwelt „Hell". Diese feste Zuordnung wird durch die Auswahl
ersetzt — nicht ergänzt. Es entsteht keine zweite Darstellung neben der
bisherigen; „Hell" bleibt als eine von zehn Farbwelten erhalten und
sieht unverändert aus.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitte „Header" (runder Theme-Knopf, 36 px) und „Theming", sowie
  der Screenshot `08-plan-notte-dark.png`, der die geöffnete Liste
  zeigt.
- Verbindlichkeit: eng folgen. Die Farbwerte der zehn Farbwelten sind
  der Tabelle im Abschnitt „Theming" und den vollständigen Sätzen im
  Style-Block der Vorlage zu entnehmen.
- Die Liste erscheint rechtsbündig unter dem Knopf, 240 px breit; je
  Eintrag drei Farbmuster (12 × 20 px, Pillenform) nebeneinander, dann
  der Name, beim aktiven Eintrag ein Häkchen.
- Jede Farbwelt wird vollständig angelegt, einschließlich der Werte für
  Warnungen (`--warn`, `--warnSoft`), auch wenn diese heute noch
  nirgends dargestellt werden.

# Akzeptanzkriterien

- [ ] Gegeben der Begleiter ist geöffnet, wenn ich den runden Knopf
      rechts im Kopfbereich anklicke, dann erscheint eine Liste mit
      genau zehn Einträgen.
- [ ] Gegeben die Liste ist geöffnet und es wurde noch nie gewählt,
      wenn ich sie betrachte, dann trägt der Eintrag „Hell" das
      Häkchen.
- [ ] Gegeben die Liste ist geöffnet, wenn ich „Notte · OLED" wähle,
      dann ist der Hintergrund des Begleiters schwarz (#000000).
- [ ] Gegeben ich habe „Notte · OLED" gewählt, wenn die Liste sich
      geschlossen hat und ich sie erneut öffne, dann trägt „Notte ·
      OLED" das Häkchen.
- [ ] Gegeben ich habe „Riviera · Petrol" gewählt, wenn ich den
      Begleiter schließe und erneut öffne, dann ist „Riviera · Petrol"
      weiterhin aktiv.
- [ ] Gegeben ich habe „Magma · Rot" gewählt, wenn ich einen
      Programmpunkt betrachte, dann folgt auch dessen Karte der
      gewählten Farbwelt.
- [ ] Gegeben ein Eintrag der Liste, wenn ich ihn betrachte, dann sehe
      ich genau drei Farbmuster seiner Farbwelt.
- [ ] Gegeben ich wähle eine Farbwelt, wenn sich die Farben ändern,
      dann wird die Seite NICHT neu geladen.
- [ ] Gegeben ich habe „Dunkel" gewählt, wenn ich die Startseite von
      wegfara aufrufe, dann ist diese NICHT eingefärbt.

# Constraints

- Die Farbwerte der zehn Farbwelten sind durch die Design-Vorlage
  vorgegeben und werden unverändert übernommen.

# Nicht Teil dieses Requirements

- Umschaltung der Kartenkacheln zwischen hell und dunkel (gehört zur
  Kartenansicht)
- Automatische Übernahme der Systemeinstellung des Geräts
- Eigene Farbwelten anlegen oder bestehende ändern
- Übernahme der Farbwelt auf andere Geräte desselben Nutzers
- Theme für den Planer-Bereich
