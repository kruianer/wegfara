---
id: req-102
title: Suchgebiet auf der Karte ein- und ausblenden
app: wegfara
area: Planung
priority: normal
changes: req-012
created: 2026-10-28
---

# Goal (Why)

Das Suchgebiet liegt als farbige Fläche über der Karte im Bereich „Orte".
Beim Durchsehen der POIs stört es: Die Fläche liegt über den Nadeln und
nimmt der Karte die Ruhe, obwohl ich das Gebiet nur beim Suchen brauche.

Heute gibt es dafür nur zwei Wege, und beide sind falsch: Entweder
**entfernen** (Papierkorb) — dann ist es weg und muss neu gezeichnet
werden — oder stehen lassen.

Als Reiseleiter will ich es **ausblenden** können, ohne es zu verlieren.

# Function (What)

Das Bedienfeld des Suchgebiets auf der Karte (`drawPanel`) bekommt einen
**dritten Knopf**: Suchgebiet ein- oder ausblenden.

| Knopf | heute | künftig |
|---|---|---|
| Zeichnen | ✓ | ✓ |
| Entfernen | ✓ | ✓ |
| **Ein-/Ausblenden** | — | **neu** |

Er steht im **selben Bedienfeld** wie die beiden anderen — dort, wo man
das Gebiet erzeugt und entfernt, blendet man es auch aus.

## Was er tut und was nicht

**Ausgeblendet verschwindet allein die Darstellung.** Das Gebiet bleibt
gespeichert und gilt weiter: Die KI-Suche sucht darin wie vorher
(`lib/pois/ai-search.ts`). Nur die Fläche und ihr Rand sind nicht zu
sehen.

Das ist der Unterschied zum Papierkorb: **Ausblenden ist eine Ansicht,
Entfernen ist eine Änderung.**

## Wann der Knopf erscheint

Nur, wenn es ein Suchgebiet gibt — wie der Papierkorb heute. Ohne Gebiet
gibt es nichts auszublenden.

Im Zeichenmodus erscheint er **nicht**: Wer gerade zeichnet, soll sehen,
was er zeichnet.

## Dass es ausgeblendet ist, muss sichtbar sein

Sonst wundert man sich später, warum kein Gebiet da ist, und zeichnet ein
zweites. Zwei Dinge sagen es:

- Der Knopf zeigt seinen Zustand (`aria-pressed`) und wechselt sein
  Symbol — wie der Zeichnen-Knopf es schon tut.
- Der **Papierkorb bleibt sichtbar**, auch wenn das Gebiet ausgeblendet
  ist. Er ist der Beweis, dass noch eines existiert.

## Der Zustand wird gemerkt

Je Reise, bei den übrigen Ansicht-Einstellungen
(`lib/pois/ansicht-einstellungen.ts`, bug-052) — wie die Statusauswahl
der Karte. Wer das Gebiet ausblendet, den Bereich wechselt und
zurückkommt, findet die Karte so vor, wie er sie verlassen hat.

**Beim Zeichnen eines neuen Gebiets wird es wieder eingeblendet.** Man
hat es gerade gezeichnet, es soll zu sehen sein.

# GUI

- Der Knopf steht im Bedienfeld `drawPanel`
  (`app/plan/components/poi-map.tsx:920`), rechts neben Zeichnen und
  Papierkorb, in derselben Gestalt (`drawButton`).
- **Symbol statt Text**, wie die beiden anderen (bug-042): Die Knöpfe
  nahmen der Karte sonst über 200 px Breite. Was der Knopf tut, sagt sein
  `title` und sein `aria-label`.
- Es braucht ein **neues Symbol** — ein Auge, offen und durchgestrichen.
  `components/icons.tsx` hat noch keines.
- Tippziel mindestens 44 × 44 px wie die bestehenden Knöpfe.
- Bei 1024, 1280 und 1920 px gelten die vier Regeln aus `stack.md`. Das
  Bedienfeld hat damit drei Knöpfe statt zwei — es darf die Karte nicht
  einengen.

# Acceptance Criteria

- [ ] Gegeben eine Reise mit Suchgebiet, wenn ich die Karte im Bereich
      „Orte" ansehe, dann gibt es im Bedienfeld einen Knopf zum
      Ausblenden.
- [ ] Gegeben ein sichtbares Suchgebiet, wenn ich den Knopf antippe, dann
      ist die Fläche nicht mehr zu sehen.
- [ ] Gegeben ein ausgeblendetes Suchgebiet, wenn ich den Knopf antippe,
      dann ist die Fläche wieder zu sehen.
- [ ] Gegeben ein ausgeblendetes Suchgebiet, wenn ich die KI-Suche
      starte, dann sucht sie in diesem Gebiet wie vorher.
- [ ] Gegeben ein ausgeblendetes Suchgebiet, wenn ich das Bedienfeld
      ansehe, dann steht der Papierkorb weiterhin da.
- [ ] Gegeben ein ausgeblendetes Suchgebiet, wenn ich den Knopf ansehe,
      dann ist an ihm erkennbar, dass es ausgeblendet ist.
- [ ] Gegeben eine Reise ohne Suchgebiet, wenn ich das Bedienfeld
      ansehe, dann gibt es den Knopf zum Ausblenden NICHT.
- [ ] Gegeben ich bin im Zeichenmodus, wenn ich das Bedienfeld ansehe,
      dann gibt es den Knopf zum Ausblenden NICHT.
- [ ] Gegeben ein ausgeblendetes Suchgebiet, wenn ich in einen anderen
      Bereich wechsle und zurückkomme, dann ist es weiterhin
      ausgeblendet.
- [ ] Gegeben ein ausgeblendetes Suchgebiet, wenn ich ein neues zeichne,
      dann ist es danach zu sehen.
- [ ] Gegeben ein ausgeblendetes Suchgebiet, wenn ich den Papierkorb
      antippe, dann ist das Gebiet entfernt und der Knopf zum Ausblenden
      verschwindet.
- [ ] Gegeben zwei Reisen, wenn ich in einer das Gebiet ausblende, dann
      bleibt es in der anderen sichtbar.

# Constraints

- Ausblenden ändert **nur die Darstellung**. Das gespeicherte Gebiet
  bleibt unberührt — es wird kein `onSearchAreaChange(null)` ausgelöst.
- Umgesetzt wird über die **Sichtbarkeit der beiden Kartenebenen**
  (`search-area-fill`, `search-area-outline`), nicht durch Entfernen und
  Neuaufbauen: Sonst flackert die Karte und die Ebenen-Reihenfolge
  verschiebt sich.
- Der gemerkte Zustand liegt bei den übrigen Ansicht-Einstellungen, je
  Reise (bug-052), nicht am Gerät.
- Das neue Symbol kommt in `components/icons.tsx` zu den übrigen. Es wird
  kein Zeichensatz und keine Fremdquelle eingeführt.
- Die KI-Suche (req-014) bleibt unberührt. Sie liest das Gebiet aus den
  Daten, nicht aus der Karte.

# Out of Scope

- Mehr als ein Suchgebiet je Reise.
- Das Suchgebiet ändern, ohne es neu zu zeichnen (Punkte verschieben gibt
  es im Zeichenmodus schon).
- Die Fläche anders einfärben oder durchscheinend machen. Ausblenden
  genügt; eine zweite Einstellung für dasselbe Problem wäre eine zu viel.
- Das Suchgebiet in der Tagesplanung oder im Begleiter zeigen.
- Die Statusauswahl der Karte (req-013) oder das Bedienfeld sonst
  umbauen.
