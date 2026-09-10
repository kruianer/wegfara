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

# Behebung

Jeder Eintrag der unteren Leiste trägt sein Symbol über der Beschriftung.
Die sechs Symbole liegen bei den übrigen in `components/icons.tsx` — ein
Kalenderblatt für „Plan", ein gefaltetes Blatt für „Karte", ein Geldschein
für „Kosten", ein Blatt mit umgeknickter Ecke für „Dokumente", eine Glocke
für „Meldungen" und die Empfangstresen-Glocke für „Concierge". Sie sind mit
20 px größer als die Schaltflächen-Zeichen des Planers (14 px): in der
unteren Leiste tragen sie die Erkennung, dort ist die Beschriftung nur
9,5 px hoch.

- Auch die beiden noch abgeschalteten Einträge („Meldungen", „Concierge")
  tragen eines — sonst fällt die Leiste beim Freischalten neu um.
- Die Symbole sind `aria-hidden`; ein Eintrag heißt weiterhin schlicht nach
  seinem Bereich, für Vorlesen wie für Tests.
- Ein Eintrag steht jetzt als Säule (Symbol oben, Text darunter) und ist
  mindestens 44 px hoch — das Tippziel aus `delivery/stack.md`. Vorher kam
  er mit 9,5 px Text und 8 px Polsterung nicht dorthin. Bei 375 px Breite
  bleiben je Eintrag rund 54 px, die Regel gilt also in beide Richtungen;
  „Dokumente" und „Concierge" werden notfalls abgeschnitten statt über den
  Rand zu laufen.
- Die Leiste wächst dadurch in der Höhe. Der Begleiter verträgt das ohne
  Anpassung: `.app` ist 100 dvh hoch und `.content` darf schrumpfen (siehe
  `app/go/go-view.layout.test.ts`).

Geprüft durch `app/go/components/bottom-nav.test.tsx` (Symbol je Eintrag,
Reihenfolge Symbol vor Text, Beschriftung bleibt der Name des Knopfes) und
`app/go/components/bottom-nav.layout.test.ts` (Säule und Tippziel im CSS —
jsdom rechnet kein Layout).
