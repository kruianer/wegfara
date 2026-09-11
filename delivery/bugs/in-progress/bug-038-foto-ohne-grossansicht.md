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

# Behebung

Das Foto der Zeile ist jetzt ein Knopf; er öffnet die Großansicht
`components/foto-ansicht.tsx`.

- Die Großansicht liegt in `components/` und nicht im Planer: ein Foto
  groß zu sehen gehört nicht allein dorthin, und der Begleiter kann sie
  später ohne Umzug mitbenutzen (siehe `delivery/stack.md`,
  Conventions). Sie folgt der Vollbildansicht eines Dokuments
  (`dokument-ansicht.tsx`, req-034) — abgedunkelter Hintergrund, Leiste
  oben, Bild darunter.
- Heraus kommt man auf allen drei genannten Wegen: Klick daneben (der
  Hintergrund schließt, das Innere hält den Klick auf), „Schließen" und
  die Escape-Taste. Die Taste hängt am Dokument, nicht an der Fläche,
  sonst griffe sie erst mit dem Fokus darin — wie beim Reisewechsler des
  Planers (`header.tsx`).
- Die Großansicht bekommt alle Fotos des POI (`poi.photos`), nicht nur
  das erste aus der Zeile. Ab zwei Fotos steht „Zurück / Bild n von m /
  Weiter" in der Leiste; bei einem einzigen bleibt sie leer bis auf
  „Schließen".
- Gemerkt wird die Kennung des POI, nicht der POI selbst — so zeigt die
  offene Ansicht den aktuellen Stand, und ein entfernter POI schließt
  sie.
- Bildschirmbreiten (`delivery/stack.md`): Das Foto der Zeile ist
  84×84 px und damit von sich aus ein ausreichendes Tippziel; „Zurück",
  „Weiter" und „Schließen" stehen auf 44×44 px. Bei 375 px passen sie
  nicht neben den Namen — die Leiste bricht um, statt sie aus ihr ragen
  zu lassen (Regel 1). Die Fläche selbst ist nie breiter als der
  Bildschirm (`min(1040px, 100%)`), das Bild fügt sich in den Rest
  (`object-fit: contain`).

Geprüft durch `components/foto-ansicht.test.tsx` (Anzeige, Blättern,
alle drei Wege hinaus), `components/foto-ansicht.layout.test.ts` (die
vier Regeln im CSS — jsdom rechnet kein Layout) und den Weg von der
Liste dorthin in `app/plan/components/poi-list.test.tsx`. Ohne den Fix
scheitern fünf dieser Tests (reproduce-first).
