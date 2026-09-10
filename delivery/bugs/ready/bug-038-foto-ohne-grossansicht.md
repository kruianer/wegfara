---
id: bug-038
app: wegfara
req: req-026
priority: normal
created: 2026-09-10
---

# Observed

Klicke ich in der POI-Liste auf ein Foto, passiert nichts. Es sollte sich
eine Großansicht öffnen.

# Expected

Ein Klick auf das Foto zeigt es groß. Aus der Großansicht komme ich mit
einem Klick daneben, mit „Schließen" und mit der Escape-Taste wieder
heraus.

Hat der POI mehrere Fotos, lässt sich in der Großansicht zwischen ihnen
blättern.

# Befund

`app/plan/components/poi-list.tsx` zeigt das erste Foto als reines
Bildelement ohne Klickverhalten. Die Datei liegt bereits unter
`/api/poi-fotos/<id>` bereit; die weiteren Fotos eines POI stehen in
`poi.photos`.

Das Bild ist ein Tippziel: Die Regeln aus [stack.md](../../stack.md)
gelten, und die Großansicht muss bei 375, 768 und 1280 px benutzbar sein.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen POI mit Foto ansehen
3. Auf das Foto klicken — es passiert nichts
