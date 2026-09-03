---
id: req-024
title: Account aus der Anmeldung
app: wegfara
area: Planung
priority: high
created: 2026-09-03
---

# Ziel (Warum)

Damit später mehrere Freundeskreise die App getrennt nutzen können,
muss die Anwendung wissen, in wessen Account sie gerade arbeitet.
Heute steht dafür ein fester Wert im Code — jeder zweite Account wäre
damit wirkungslos, weil alle dieselben Daten sähen.

# Funktion (Was)

Welche Daten eine angemeldete Person sieht, ergibt sich aus ihrer
Anmeldung: Sie gehört zu genau einer Person, diese zu genau einem
Account, und nur dessen Reisen, POIs, Programmpunkte und Teilnehmer
werden angezeigt.

Der bisher fest hinterlegte Account entfällt. Es gibt keinen Weg mehr,
Daten ohne angemeldete Person abzurufen.

Nach außen ändert sich nichts: Alle Bereiche zeigen dieselben Daten wie
zuvor, weil derzeit genau ein Account existiert und alle Daten ihm
gehören.

Gehört eine angemeldete Person zu keinem Account, sieht sie keine
Daten — nicht die eines anderen Accounts.

# Akzeptanzkriterien

- [ ] Gegeben ich bin angemeldet, wenn ich den Planer öffne, dann sehe
      ich dieselben drei Reisen wie zuvor.
- [ ] Gegeben ich bin angemeldet, wenn ich den Begleiter öffne, dann
      sehe ich dieselben Programmpunkte wie zuvor.
- [ ] Gegeben ich bin angemeldet, wenn ich den Bereich
      „Einstellungen" öffne, dann sehe ich dieselben Personen wie
      zuvor.
- [ ] Gegeben es existiert ein zweiter Account mit eigenen Reisen, wenn
      ich als Person des ersten Accounts den Planer öffne, dann
      erscheinen dessen Reisen NICHT.
- [ ] Gegeben ich bin nicht angemeldet, wenn ich eine Schnittstelle
      aufrufe, die Reisedaten liefert, dann erhalte ich KEINE Daten.
- [ ] Gegeben der Quelltext der Anwendung, wenn ich ihn durchsuche,
      dann gibt es darin KEINE fest hinterlegte Account-Kennung mehr.

# Constraints

- Jede Abfrage auf Nutzerdaten filtert weiterhin nach Account (siehe
  [stack.md](../../stack.md)). Dieses Requirement ändert nur, woher die
  Kennung stammt — aus der Anmeldung statt aus dem Quelltext.
- Der Account darf nicht aus einer vom Aufrufer beeinflussbaren Angabe
  stammen (etwa einem Parameter in der Adresse), sondern ausschließlich
  aus der serverseitig geprüften Sitzung.

# Nicht Teil dieses Requirements

- Anlegen weiterer Accounts
- Wechsel zwischen Accounts
- Ein Gesamt-Admin mit accountübergreifenden Rechten
- Sichtbare Änderungen an der Oberfläche
