---
id: req-106
title: Die POI-Liste wird so breit, dass der Kurztext hineinpasst
app: wegfara
area: Planung
priority: normal
changes: req-097
created: 2026-11-14
---

# Goal (Why)

Die POI-Liste in der Orte-Ansicht war zu schmal. req-097 hatte sie auf
324 px festgelegt, damit der Karte möglichst viel Platz bleibt — und
dabei das Lesen aus dem Blick verloren.

**Gerechnet statt geschätzt.** Die Zeile ist dreispaltig
(`104px | 1fr | 78px`, 10 px Fugen, 8 px Polster). Bei 324 px bleiben
der Mittelspalte 106 px:

| Liste | Mitte | Zeichen/Zeile | 3 Zeilen | vom Kurztext sichtbar |
| ----: | ----: | ------------: | -------: | --------------------: |
| 324   | 106   | 18            | 54       | **27 %** |
| 461   | 243   | 42            | 126      | 63 % |
| 576   | 358   | 62            | 186      | 93 % |
| **640** | 422 | 73            | **219**  | **100 %** |

Ein Kurztext hat höchstens 200 Zeichen
(`POI_SHORT_TEXT_MAX_LENGTH`). Bei 324 px war gut ein Viertel zu sehen,
der Rest stand hinter dem Auslassungszeichen.

# Scope (What)

`listenBreite` rechnet die Startbreite neu: **45 % des Schirms,
höchstens 640 px**, nie unter den 324 px, die die dreispaltige Zeile
braucht.

| Schirm | Liste | Karte | Anteil |
| -----: | ----: | ----: | -----: |
| 1024 (iPad quer) | 461 | 563 | 45 % |
| 1280   | 576 | 704  | 45 % |
| 1440   | 640 | 800  | 44 % |
| 1920   | 640 | 1280 | 33 % |
| 3840   | 640 | 3200 | 17 % |

**Die 640 px sind nicht gewählt, sondern die Zahl, ab der mehr Breite
keinen Text mehr zeigt.** Darüber füllte sie nur Leerraum — deshalb
wächst die Liste nicht mit dem Schirm weiter, und bei 4K bekommt die
Karte 3200 px.

Auf dem iPad quer darf die Liste knapp die Hälfte nehmen: dort
betrachtet man ohnehin eine Seite nach der anderen.

# Acceptance Criteria

- [x] Gegeben ein iPad quer (1024 px), wenn ich die Orte-Ansicht öffne,
      dann ist die Liste 461 px breit.
- [x] Gegeben ein Laptop (1280 px), dann ist sie 576 px breit.
- [x] Gegeben ein 4K-Schirm (3840 px), dann ist sie **nicht breiter als
      640 px** und die Karte bekommt den Rest.
- [x] Gegeben irgendeine Schirmbreite, dann ist die Liste nie schmaler
      als die 324 px, die die dreispaltige Zeile braucht.
- [x] Gegeben ich ziehe am Trenner, dann gilt meine Breite — breiter und
      schmaler als der Startwert.
- [x] Gegeben 640 px Listenbreite, wenn ein POI einen Kurztext von 200
      Zeichen hat, dann ist er in drei Zeilen ganz zu sehen.

# Constraints

- Der Trenner bleibt, wie er war: Was gezogen wurde, gilt. Die neue
  Breite ist nur der Startwert, keine gemerkte Breite wird verworfen.
- Die Untergrenze von 324 px aus req-097 bleibt — darunter bricht die
  dreispaltige Zeile.
- Die Zeile selbst wird nicht umgebaut: Bild und Aktionsspalte behalten
  ihr Mass, die Mittelspalte nimmt den Zuwachs.
- Unter 1024 px gilt weiter die schmale Ordnung aus req-088: eine Seite
  allein, ein Umschalter darüber.

# Out of Scope

- Die dreispaltige Zeile anders aufzuteilen oder eine vierte Spalte.
- Den Kurztext länger zu machen als 200 Zeichen.
- Die Zeilenzahl des Kurztexts über drei hinaus.
- Die Aufteilung im Bereich Chat (dort weiter die halbe Breite).
