---
id: bug-040
app: wegfara
req: req-060
priority: normal
created: 2026-09-11
---

# Observed

„Ausgewählte löschen" und „Bewertungsrunde starten" stehen in eigenen
Zeilen und kosten Platz.

# Expected

Beide stehen in derselben Zeile wie die Filter — als **Symbol mit
Tooltip** statt mit Text. Der Tooltip nennt weiterhin, was der Knopf tut
(„Ausgewählte löschen", „Bewertungsrunde starten"), sodass die Bedeutung
nicht verlorengeht.

„Ausgewählte löschen" bleibt dabei nur wirksam, wenn POIs angekreuzt sind
— und die Rückfrage vor dem Entfernen bleibt bestehen (req-035).

Die Symbole sind Tippziele: mindestens 44×44 px über ihre Trefferfläche
(siehe [stack.md](../../stack.md)), ohne dass sie sichtbar größer werden
als die übrigen Elemente der Zeile.

# Steps

1. Planer öffnen, Bereich POIs
2. Die Zeilen über der Liste ansehen — Filter, Aktionen und Anlegen
   stehen getrennt

# Ursache

Über der Liste standen drei Zeilen: die Anlegezeile (req-060), die
Filterzeile (req-060) und darunter die Auswahlleiste aus req-057 — eine
eigene Box mit Rand, Fläche und Innenabstand (`.banner` in
`app/plan/components/poi-list.module.css`), die nichts weiter trug als das
Ankreuzkästchen „alle", seine Beschriftung und die beiden Schaltflächen
`.bannerDangerButton` („Ausgewählte löschen") und `.bannerButton`
(„Bewertungsrunde starten"/„… beenden"). Beide waren mit Text beschriftet
und brauchten deshalb die Breite einer eigenen Zeile; zusammen mit Rand,
Innenabstand und Abstand nach unten kostete die Leiste rund 60 px, die der
Liste darunter fehlten.

# Behebung

Die Auswahlleiste entfällt. Was sie trug, steht jetzt in der Filterzeile
selbst — sie ist damit die einzige Zeile zwischen Anlegen und Liste:

- `app/plan/components/poi-list.tsx`: das Ankreuzkästchen „Alle POIs
  auswählen" steht links vor dem Typ-Filter (`.filterAuswahl`), die beiden
  Aktionen rechts am Ende der Zeile (`.filterActions`, `margin-left: auto`).
  Statt ihres Textes tragen sie ein Symbol — `TrashIcon` für „Ausgewählte
  löschen", die neuen `StarIcon`/`StopIcon` in `components/icons.tsx` für
  „Bewertungsrunde starten" und „… beenden". Was der Knopf tut, nennt
  weiterhin sein Tooltip (`title`) und, für Vorlesegeräte, sein
  `aria-label` — beides wörtlich wie die bisherige Beschriftung.
- Die Beschriftung „N ausgewählt" aus der Leiste steht als `.auswahlZahl`
  neben dem Zähler und nur dann, wenn überhaupt etwas angekreuzt ist; der
  Hinweis auf eine laufende Runde als `.filterNote`.
- `.filterAction` in `app/plan/components/poi-list.module.css`: die
  Trefferfläche ist 44×44 px (stack.md, Bildschirmbreiten, Regel 4),
  gezeichnet werden darin 30×30 px — dieselbe Höhe, in der seit bug-039 die
  Auswahllisten daneben gezeichnet sind. Die äußeren 7 px sind ein
  durchsichtiger Rand, der allein die Trefferfläche trägt; damit er
  unsichtbar bleibt, endet der Hintergrund an der Innenkante
  (`background: … padding-box`) und der sichtbare 1-px-Rand wird als
  innerer Schatten gezeichnet (`box-shadow: inset 0 0 0 1px`). Dieselbe
  Lösung wie beim Löschen-Symbol der Zeile (req-060), den Verweisen
  (bug-028) und den Auswahllisten (bug-039). Damit sind die Symbole
  Tippziele, ohne sichtbar größer zu sein als die übrigen Elemente der
  Zeile.
- Unverändert bleibt, was die Knöpfe tun: „Ausgewählte löschen" ist ohne
  angekreuzte POIs abgeschaltet und löscht auch dann nicht selbst, sondern
  meldet die Auswahl an die Rückfrage aus req-035; „Bewertungsrunde
  starten" bleibt dem Reiseleiter vorbehalten und ohne Auswahl
  abgeschaltet.
- Die Regeln `.banner`, `.bannerLabel`, `.bannerActions`, `.bannerButton`,
  `.bannerDangerButton` und `.bannerNote` sind ersatzlos entfallen. Damit
  verliert der Abschnitt „sichtbare Größe der Filterzeile (bug-039)" seinen
  bisherigen Bezugspunkt: die gewohnte Höhe von 30 px steht dort — wie in
  `poi-anlegezeile.layout.test.ts` schon zuvor — als Konstante und wird
  jetzt zusätzlich gegen `.filterAction` geprüft.

# Prüfung

Neuer Abschnitt „Aktionen in der Filterzeile (bug-040)" in
`app/plan/components/poi-list.test.tsx` (acht Tests) und in
`app/plan/components/poi-list.layout.test.ts` (vier Tests), dazu ein
fünfter Layout-Test im Abschnitt zu bug-039. Alle dreizehn sind ohne die
Behebung rot (nachgestellt mit `git stash` auf Komponente und CSS): beide
Aktionen liegen in `poi-filterzeile`, tragen kein Wort Text und ein `svg`,
nennen im `title` weiterhin „Ausgewählte löschen", „Bewertungsrunde
starten" und „Bewertungsrunde beenden", bleiben ohne Auswahl abgeschaltet,
melden zum Entfernen nur an die Rückfrage (kein Aufruf am Server), und
unter dem Filter steht keine Aktionsleiste mehr. Im CSS: keine
`.banner*`-Regel mehr, die Aktionen rechts und umbrechend, 44×44 px
Trefferfläche bei 30 px sichtbarer Größe, das Löschen-Symbol in der
Warnfarbe.

Volle Suite grün: 3558 Unit-Tests in 299 Dateien (`npm test`), dazu
`npm run lint`, `npx prettier` und `npx tsc --noEmit`.

Nicht gelaufen: `npm run test:e2e` und das Nachmessen im echten Browser —
auf dieser Maschine fehlen PostgreSQL und Docker, die das Kommando braucht.
Die Bildschirmbreiten-Prüfung aus req-049 (375/768/1280 px auf der
POI-Ansicht) ist damit für diese Änderung offen; sie sollte vor der
Promotion nach prod einmal laufen.
