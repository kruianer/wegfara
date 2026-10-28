---
id: bug-069
app: wegfara
req: req-079
priority: normal
created: 2026-10-25
---

# Observed

Im Begleiter (`/go`) tippe ich auf einer Programmpunkt-Kachel auf "Mehr
lesen". Danach steht "Weniger anzeigen" ganz am Ende, unter dem Langtext,
den weiteren Fotos und "Nicht dabei". Um die Kachel wieder einzuklappen,
muss ich ganz nach unten scrollen.

Wörtlich vom Nutzer: "Klicke auf Mehr lesen, steht Weniger anzeigen ganz
am Ende. Lass es nach dem Kurztext, dann muss ich nicht nach ganz unten
klicken."

(Code: app/go/components/activity-card.tsx. Der Umschalter steht hinter
Langtext, weiteren Fotos und "Nicht dabei".)

# Expected

"Weniger anzeigen" steht im aufgeklappten Zustand an derselben Stelle,
an der vorher "Mehr lesen" stand: direkt unter dem Text-Anfang, also vor
dem restlichen Langtext und vor den weiteren Fotos. Zum Einklappen muss
man nicht scrollen. Im eingeklappten Zustand bleibt alles wie heute.

# Steps

1. Begleiter öffnen, auf einer Kachel mit Langtext und mehreren Fotos auf
   "Mehr lesen" tippen.
2. "Weniger anzeigen" steht erst ganz unten in der Kachel.
