---
id: bug-070
app: wegfara
priority: normal
created: 2026-10-25
---

# Observed

Im Begleiter (`/go`) sind die Knöpfe "Ab hier" und "Route" in der Zeile
für den Weg zwischen zwei Programmpunkten deutlich höher als die übrigen
Knöpfe.

Wörtlich vom Nutzer: "Die Buttons Ab hier und Route sind
überdurchschnittlich hoch. Gleich wie die anderen Buttons."

(Code: app/go/components/transfer-row.module.css. `.route`,
`.routePrimary` und `.routeSecondary` haben `min-height: 44px`, die
übrigen Pillen im Begleiter nicht, z. B. booking-button.module.css
`.pill` mit `padding: 6px 12px`.)

# Expected

"Ab hier" und "Route" sehen genauso hoch aus wie die anderen Pillen-
Knöpfe im Begleiter, zum Beispiel der Buchungsknopf auf der Kachel.

Die Regel aus delivery/stack.md "Tippziele sind mindestens 44×44 px"
bleibt erfüllt. Die sichtbare Pille wird flacher, die antippbare Fläche
bleibt mindestens 44 px groß (unsichtbar erweitert). Die Zeile wird
dadurch nicht höher als nötig.

# Steps

1. Begleiter öffnen, einen Tag mit einem Weg zwischen zwei
   Programmpunkten anzeigen.
2. "Route" (und am Reisetag "Ab hier") sind sichtbar höher als die
   übrigen Knöpfe.
