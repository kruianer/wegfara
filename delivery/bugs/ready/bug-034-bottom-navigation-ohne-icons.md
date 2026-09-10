---
id: bug-034
app: wegfara
priority: normal
created: 2026-09-10
---

# Observed

Die untere Navigationsleiste des Begleiters zeigt nur Text — Plan, Karte,
Kosten, Dokumente. Die Icons fehlen; das war schon einmal anders.

# Expected

Jeder Eintrag der unteren Leiste trägt wieder sein Icon über dem Text. Auf
dem Smartphone ist die Leiste das Hauptnavigationsmittel — ein Symbol
findet man im Vorbeigehen, Text muss man lesen.

# Befund

`app/go/components/bottom-nav.tsx` führt je Eintrag nur `label`, kein
Icon. Die Symbole liegen bereits in `components/icons.tsx` bzw. werden
dort ergänzt; die Kopfzeile des Begleiters nutzt schon welche (etwa
`PlanerIcon` in `app/go/components/header.tsx`).

# Steps

1. Begleiter auf dem Smartphone öffnen
2. Die untere Leiste ansehen — nur Text, keine Symbole
