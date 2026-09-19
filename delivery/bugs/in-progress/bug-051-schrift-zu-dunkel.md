---
id: bug-051
app: wegfara
req: req-015
priority: hoch
created: 2026-09-19
---

# Observed

Im Planer hebt sich die Schrift kaum vom Hintergrund ab — besonders die
**Zeitanzeige am Zeitstrahl**. In der POI-Liste wirkt die Schrift
deutlich heller und ist gut lesbar.

# Expected

Schrift ist überall lesbar. Wo sie heute so dunkel ist, dass sie
verschwimmt, wird sie aufgehellt — im Planer wie überall sonst.

# Steps

1. Planer öffnen, Bereich Planung
2. Auf den Zeitstrahl sehen: die Stundenbeschriftung (07, 08, 09 …)
3. Sie verschwimmt mit dem Hintergrund
4. Zum Vergleich in den Bereich POIs wechseln: dort ist die Schrift
   heller

# Ursache

Die Farbwelt „Indigo-Nacht" (req-015) führt vier Textstufen. Gemessen
gegen die Kartenflächen `--card` (`#131730`) und `--card-alt`
(`#171c38`):

| Token | Farbe | auf `--card` | auf `--card-alt` |
|---|---|---|---|
| `--text` | `#e9ebf7` | 14,8:1 | 14,0:1 |
| `--text-2` | `#b3bad8` | 9,2:1 | 8,7:1 |
| `--text-3` | `#7b83a8` | 4,7:1 | 4,5:1 |
| **`--text-4`** | **`#4a5170`** | **2,3:1** | **2,2:1** |

`--text-4` erreicht **2,2:1** und verfehlt damit die Mindestanforderung
von 4,5:1 für Fließtext deutlich — es reicht nicht einmal für große
Schrift (3:1). Verwendet wird es durchweg bei **sehr kleiner** Schrift,
wo der Kontrast am wichtigsten wäre:

- [timeline-column.module.css:78](../../../app/plan/components/timeline-column.module.css)
  — `.hourLabel`, die Stundenbeschriftung, 10 px
- [timeline-column.module.css:222](../../../app/plan/components/timeline-column.module.css)
  — 14 px
- [cards.module.css:138](../../../components/cards.module.css) —
  `.detailLabel`, 9,5 px
- [cards.module.css:509](../../../components/cards.module.css) — 10 px
- [bereichsleiste.module.css:110/114](../../../components/bereichsleiste.module.css)
  — abgeschaltete Knöpfe

Dass die POI-Liste heller wirkt, hat denselben Grund von der anderen
Seite: `poi-list.module.css` verwendet `--text-4` **kein einziges Mal**.

`--text-3` liegt mit 4,49:1 auf `--card-alt` haarscharf unter der Grenze
und ist beim Aufhellen mitzuprüfen.

# Erwartete Behebung

- `--text-4` wird so weit aufgehellt, dass es auf beiden Kartenflächen
  mindestens **4,5:1** erreicht.
- `--text-3` wird auf `--card-alt` über 4,5:1 gebracht.
- Die Abstufung der vier Textstufen bleibt erkennbar: `--text-4` bleibt
  die leiseste, sie wird nur lesbar.
- Ein abgeschalteter Knopf (`bereichsleiste`) darf weiterhin als
  abgeschaltet erkennbar sein — dort zählt nicht die Lesbarkeitsgrenze
  für Fließtext, aber verschwinden soll er auch nicht.

# Notes

Die Farbwerte stehen viermal gleichlautend in verschiedenen Dateien
(`plan-view`, `accounts-view`, `mein-bereich`, `auth-panel`). Beim
Beheben ist darauf zu achten, dass alle Stellen denselben Wert tragen —
sonst ist die Schrift je nach Ansicht verschieden hell.

Geprüft wird gegen die Kontrastregel aus [stack.md](../../stack.md).
