---
id: req-094
title: Seitenleiste immer schmal, mit Namen unter dem Symbol
app: wegfara
area: Planung
priority: normal
created: 2026-10-28
changes: req-077, req-078
---

# Goal (Why)

Die Seitenleiste des Planers klappt heute auf 320 px auf, um die Namen
der Bereiche zu zeigen (req-077). Steht der Name aber **unter** seinem
Symbol, braucht es das Aufklappen nicht mehr — und die Leiste kostet
dauerhaft weniger Breite.

Das ist besonders auf dem iPad hochkant wichtig: Seit req-088 läuft der
Planer ab 768 px, und dort ist jedes Pixel Breite knapp. Eine
aufgeklappte Leiste von 320 px deckt dann fast die halbe Fläche.

Das Muster gibt es in der App schon: Die untere Leiste des Begleiters
zeigt Symbol über Beschriftung (bug-034), und
`app/plan/components/seitenleiste.tsx` nennt das an seinem
`SYMBOL_GROESSE_PX` ausdrücklich als den anderen Modus. Es wird also
nichts erfunden, sondern das vorhandene Muster in den Planer geholt.

Knipsa geht denselben Weg (dort req-032) — die Entscheidung ist dieselbe,
die Maße sind es nicht: wegfara hat sieben Bereiche mit längeren Namen.

# Function (What)

Ändert die Seitenleiste aus req-077 und req-078.

## Immer schmal

Die Leiste hat **nur noch eine Form**. Es gibt keinen aufgeklappten
Zustand, keinen Knopf zum Auf- und Zuklappen und keine Fläche davor, die
einen Griff daneben abfängt.

Unter jedem Symbol steht sein Name, klein. Die Breite richtet sich nach
dem **längsten Namen** — nicht umgekehrt.

## Die Namen werden kürzer

Das ist der Kern: Die heutigen Namen passen nicht in eine schmale
Leiste. Gemessen bei 9,5 px Schriftgröße, wie sie die untere Leiste des
Begleiters schon verwendet:

| heute | Breite | künftig | Breite |
|---|---|---|---|
| POIs | ~20 px | **Orte** | ~20 px |
| Planung | ~35 px | **Plan** | ~20 px |
| Bewertungen | **~54 px** | **Stimmen** | ~35 px |
| Kosten | ~30 px | Kosten | ~30 px |
| Dokumente | ~44 px | **Papiere** | ~35 px |
| Reisedetails | **~59 px** | **Reise** | ~25 px |
| Chat | ~20 px | Chat | ~20 px |

„Reisedetails" allein bräuchte mehr als die heutige eingeklappte Leiste
(66 px) innen hergibt. Mit den kurzen Namen bestimmen „Stimmen" und
„Papiere" die Breite, und die Leiste kommt mit **etwa 60 px** aus.

Der genaue Wert wird beim Umsetzen am gerenderten Text gemessen, nicht
geschätzt — die Zahlen hier sind eine Rechnung, keine Messung.

**Nur die Leiste trägt die kurzen Namen.** Die Überschrift des Bereichs,
Requirements und das Glossar behalten die vollen Begriffe: Ein Bereich
heißt weiterhin „Bewertungen", er steht in der Leiste nur kürzer da.

## Die Marke oben

Über den Einträgen bleibt die Kompassrose. Darunter stehen **„Wegfara"**
und der Slogan **„Wohin es euch zieht"** (`LEISTEN_SLOGAN`) — beide
**sehr klein**, mittig, der Slogan auf zwei Zeilen umbrechend.

Heute erscheinen sie nur im aufgeklappten Zustand. Da es den nicht mehr
gibt, müssen sie in die schmale Form passen.

Beide sind **Beschriftung, nicht Bedienelement**: Sie dürfen unter
44 px bleiben. Die Regel aus `stack.md` gilt für Tippziele — der Block
als Ganzes ist eines und bleibt groß genug.

## Was aus der gewählten Reise wird

Die Reisewahl (`reisewahl.tsx`) zeigt aufgeklappt Namen und Zeitraum der
Reise. In der schmalen Form ist dafür kein Platz.

**Vorschlag:** Sie bleibt als Symbol mit dem kurzen Namen „Reise" und
führt wie heute zu den Reisedetails; welche Reise offen ist, steht
ohnehin im Bereich selbst. Der volle Name gehört in `title` und
`aria-label`, damit er beim Darüberfahren und für Vorleseprogramme da
ist.

Das ist die unbequemste Stelle dieses Requirements und beim Umsetzen
noch zu prüfen.

## Was gleich bleibt

- Die Bereiche, ihre Symbole und ihre Reihenfolge.
- Jeder Eintrag bleibt ein Tippziel von mindestens 44 × 44 px
  (`stack.md`, Regel 4) — bei etwa 60 px Breite ist das die Höhe, die
  zählt.
- Der Fuß der Leiste: der Wechsel in den Begleiter, „Mein Bereich",
  Abmelden.
- Ein noch nicht gebauter Bereich steht sichtbar, aber abgeschaltet da
  (bug-033).
- Der Begleiter (`/go`) behält seine untere Leiste unverändert.

# GUI

- Vorbild ist die untere Leiste des Begleiters (bug-034): Symbol über
  Beschriftung, Schrift 9,5 px.
- Verbindlichkeit: eng folgen. Die Symbole bleiben die bestehenden
  (`BEREICHS_SYMBOLE`), die Größe bleibt `SYMBOL_GROESSE_PX` (22 px).
- Die Breite der Leiste steht als Token an einer Stelle; `--leiste-breite-offen`
  entfällt.
- Kein `white-space: nowrap` an den Namen: Ein künftig längerer Name soll
  umbrechen, statt die Leiste zu sprengen.
- Kontrast nach `lib/design/kontrast.ts`: die kleinen Namen und der
  Slogan mindestens 4,5:1 auf `--deep`. Bei 9,5 px und 8 px ist das die
  Stelle, an der es leicht misslingt (vgl. bug-051).
- Bei 768, 1180 und 1280 px gelten die vier Regeln aus `stack.md`.

# Acceptance Criteria

- [x] Gegeben der Planer bei 1280 px, wenn ich ihn öffne, dann steht
      unter jedem Symbol der Seitenleiste sein Name.
- [x] Gegeben die Seitenleiste, wenn ich sie ganz ansehe, dann gibt es
      KEINEN Knopf zum Auf- oder Zuklappen.
- [x] Gegeben die Seitenleiste, wenn ich einen Bereich wähle, dann
      erscheint er, und die Leiste verändert ihre Breite nicht.
- [x] Gegeben die Seitenleiste, wenn ich ihre Breite messe, dann ist sie
      höchstens so breit, wie der längste Name plus Rand verlangt — und
      in keinem Fall breiter als 72 px.
- [x] Gegeben die Seitenleiste, wenn ich sie ansehe, dann stehen unter
      der Kompassrose „Wegfara" und „Wohin es euch zieht", beide klein.
- [x] Gegeben ein Eintrag der Seitenleiste, wenn ich seine Fläche messe,
      dann ist sie mindestens 44 px hoch.
- [x] Gegeben der Bereich „Bewertungen", wenn ich die Leiste ansehe, dann
      steht dort „Stimmen" — und die Überschrift des Bereichs weiterhin
      „Bewertungen".
- [x] Gegeben ich fahre über den Eintrag der Reise, wenn der Hinweis
      erscheint, dann nennt er den vollen Namen der Reise.
- [x] Gegeben der Planer bei 768 px (iPad hochkant), wenn ich ihn öffne,
      dann ragt nichts über den Rand und die Seite lässt sich nicht
      seitlich scrollen.
- [x] Gegeben ein noch nicht gebauter Bereich, wenn ich die Leiste
      ansehe, dann steht er sichtbar und abgeschaltet da (bug-033).
- [x] Gegeben der Begleiter, wenn ich ihn öffne, dann ist seine untere
      Leiste unverändert.

# Constraints

- Die Breite der Leiste steht an **einer** Stelle als Token.
  `--leiste-breite-offen` wird entfernt, nicht nur ungenutzt gelassen.
- Die kurzen Namen stehen bei den Bereichen (`lib/plan/areas.ts`), neben
  dem vollen Namen — nicht als zweite Liste woanders (vgl. req-082). Der
  volle Name bleibt der Begriff der App.
- Die Tests zur aufklappbaren Leiste aus req-077/req-078 sind anzupassen,
  nicht zu löschen: Was sie prüfen — Abstände zwischen den Gruppen
  (bug-058), Tippziele, Symbolgröße — gilt weiter.
- `app/plan/components/seitenleiste.layout.test.ts` prüft das CSS als
  Text und kennt die heutigen Selektoren und den offenen Zustand. Er ist
  mitzuziehen.
- Der Zustand „offen" entfällt auch im Quelltext (`useState`, `.offen`,
  `.davor`, `mitZugeklappterLeiste`) — es bleibt kein toter Pfad stehen.
- Steht req-089 (Stil-Baukasten) zu diesem Zeitpunkt schon, kommen
  Schriftstufen und Abstände von dort.

# Out of Scope

- Die untere Leiste des Begleiters ändern.
- Die Symbole neu zeichnen oder austauschen.
- Die Bereiche selbst, ihre Reihenfolge oder ihren Inhalt.
- Die Namen der Bereiche in Requirements, Glossar oder Überschriften
  ändern — nur die Leiste wird kürzer.
- Den Planer unter 768 px zeigen (das ist req-088).
- Eine Leiste, die sich je Bildschirmbreite anders verhält. Sie ist
  immer gleich; nur unter 768 px gibt es den Planer nicht.
