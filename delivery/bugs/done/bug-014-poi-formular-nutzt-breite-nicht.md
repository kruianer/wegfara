---
id: bug-014
app: wegfara
req: req-035
priority: normal
created: 2026-09-04
---

# Observed

Beim Bearbeiten eines POI nutzt das Formular nicht die ganze Breite des
linken Containers.

# Expected

Das Bearbeiten-Formular nutzt die volle Breite des linken Containers —
so wie das Formular bei der Neuanlage eines POI.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen bestehenden POI zum Bearbeiten öffnen
3. Breite des Formulars mit der bei der Neuanlage vergleichen

# Ursache

Das Formular beim Anlegen steht als eigene Zeile über der Liste und
nutzt deren volle Breite (`.formStandalone`). Das Formular zum Ändern
stand dagegen in der mittleren Spalte der POI-Zeile (`.rowMain`) —
zwischen Auswahlkästchen, Bild (84 px) und Statusliste (bis 160 px).
Es bekam damit rund 300 px weniger als das Formular bei der Neuanlage.

# Behebung

Die POI-Zeile teilt sich nicht mehr selbst in Spalten: ihre Angaben
liegen jetzt in `.rowTop`, das aufgeklappte Formular steht als
Geschwister darunter und damit über die ganze Breite der Liste. Da die
Liste (`.rows`) denselben seitlichen Innenabstand von 22 px hat wie das
Formular beim Anlegen (`.formStandalone`), sind beide gleich breit.

Geändert: `app/plan/components/poi-list.tsx` und
`app/plan/components/poi-list.module.css`.

# Akzeptanzkriterien der Behebung

- [x] Gegeben ein bestehender POI, wenn ich ihn zum Bearbeiten
      aufklappe, dann hängt sein Formular an der Zeile selbst und nicht
      in deren mittlerer Spalte.
- [x] Gegeben ein aufgeklapptes Formular, wenn ich seine Breite mit der
      bei der Neuanlage vergleiche, dann ist sie dieselbe.
