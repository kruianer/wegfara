---
id: bug-058
app: wegfara
req: req-077
priority: normal
created: 2026-09-26
---

# Observed

In der aufgeklappten Seitenleiste klebt alles zu sehr zusammen: Slogan,
die gewählte Reise und die Menüpunkte stehen fast ohne Luft übereinander.

# Expected

Zwischen den drei Gruppen — Name mit Slogan, gewählte Reise, Menüpunkte —
steht sichtbar mehr Abstand als zwischen den Menüpunkten untereinander.
Man erkennt am Abstand, was zusammengehört.

# Steps

1. Planer öffnen, Seitenleiste aufklappen
2. Auf den Bereich zwischen Slogan, Reise und erstem Menüpunkt sehen

# Ursache

Alle Gruppen stehen in derselben Flex-Spalte mit **einem** Abstand für
alles ([seitenleiste.module.css](../../../app/plan/components/seitenleiste.module.css)):

```
.tafel { gap: 10px; }      /* zwischen ALLEN Gruppen */
.nav   { gap: 2px; }       /* zwischen den Menuepunkten */
.slogan { margin-top: 3px; }
```

10 px trennen damit den Slogan von der Reise und die Reise von der
Navigation — dieselben 10 px, die auch innerhalb einer Zeile zwischen
Symbol und Text stehen. Der Slogan hängt mit 3 px praktisch am Namen.

Für den Unterschied zwischen „gehört zusammen" und „ist eine andere
Gruppe" bleibt damit kein Spielraum.

Zum Vergleich LivingGardenTwin, die Vorlage aus req-077: Dort trennen
**16 px vor** und **20 px nach** der Uhr die Gruppen
(`--rail-clock-lead: 16px`, `--rail-clock-trail: 20px`), während die
Einträge mit 4 px dicht beieinander bleiben.

# Erwartete Behebung

Der Abstand **zwischen den Gruppen** wird größer als der innerhalb einer
Gruppe. Wie groß, entscheidet die Umsetzung — der Unterschied muss auf
einen Blick zu sehen sein.

Die Maße aus req-078 bleiben: Slogan 21 px, aufgeklappt 320 px,
Beschriftung 13 px, Symbole 22 px, Zeilenhöhe 44 px.

# Notes

Die eingeklappte Leiste zeigt nur Symbole — dort ist nichts zu ändern.

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)): Bei mehr Abstand muss die aufgeklappte Leiste
auf niedrigen Bildschirmen weiterhin vollständig hineinpassen.

# Behebung

Der eine Abstand für alles ist weg: `.tafel` hat keinen `gap` mehr. Jede
Gruppe bringt ihren eigenen mit, und der ist ein Vielfaches dessen, was in
ihr steht. Die Maße sind die von LivingGardenTwin — 16 px vor und 20 px
nach der Mitte, wie dort um die Uhr.

In [seitenleiste.module.css](../../../app/plan/components/seitenleiste.module.css):

- Vier Design Tokens an `.spur`, bei den beiden Breiten aus req-078:
  `--leiste-vor-reise: 16px`, `--leiste-nach-reise: 20px`,
  `--leiste-vor-fuss: 16px` und `--leiste-eintrag-abstand: 2px`. Sie stehen
  dort, wo auch die Breiten stehen — ein Ort für die Maße der Leiste.
- `.kopf { margin-bottom: var(--leiste-vor-reise) }`,
  `.nav { margin-top: var(--leiste-nach-reise) }`,
  `.fuss { margin-top: var(--leiste-vor-fuss) }`. Die Fugen bekommen ihren
  Abstand einzeln, statt dass ein `gap` der Tafel sich auf jede legt.
- `.nav` und `.fuss` behalten ihre 2 px zwischen den Einträgen, jetzt aus
  `--leiste-eintrag-abstand`.
- `.slogan { margin-top: 6px }` statt 3 px. Warum gerade dort mehr nötig
  war: der Slogan ist um 3,5° gedreht, und die Drehung hebt sein rechtes
  Ende an. Gemessen in Chromium beginnt sein Kasten deshalb 3 px **über**
  der Unterkante des Namens, obwohl im Layout 6 px zwischen beiden stehen —
  mit den alten 3 px waren es 6 px darüber, und unter „Wegfara" blieb
  nichts. Am linken Rand, wo der Name steht, liegen die vollen 6 px Luft.

Die Abstände gelten in beiden Zuständen. Eingeklappt zeigt die Leiste zwar
nur Symbole (siehe Notes), aber es sind dieselben drei Gruppen: die
Kompassrose, das Reise-Symbol, die Bereiche. Ein eigener Satz Abstände für
den eingeklappten Zustand wären zwei Regelwerke für eine Leiste — und beim
Aufklappen rutschten die Symbole unter dem Finger um 22 px weg.

Der Fuß mit „Mein Bereich", „Verwaltung" und dem Abmelden ist die vierte
Gruppe. Er war schon durch eine Linie abgesetzt und behält sie; die 10 px
Luft davor sind jetzt 16 px, damit er nicht als einzige Gruppe enger steht
als die übrigen. Sichtbar wird das nur auf einer niedrigen Leiste — sonst
schiebt `.nav` (`flex: 1`) ihn ohnehin nach unten.

Nichts geändert: die Maße aus req-078 (Slogan 21 px, aufgeklappt 320 px,
Beschriftung 13 px, Symbole 22 px, Zeilenhöhe 44 px), die eingeklappte
Breite von 66 px und die Reisewahl selbst
(`reisewahl.module.css` — sie bekommt ihren Abstand von den Nachbarn, statt
ihn mitzubringen; so bleiben alle Maße der Leiste in einer Datei).

# Prüfung

Reproduce-first, in
[seitenleiste.layout.test.ts](../../../app/plan/components/seitenleiste.layout.test.ts)
(jsdom rechnet kein Layout, geprüft wird deshalb direkt am CSS — wie bei
bug-014): der neue Abschnitt „Abstand zwischen den Gruppen (bug-058)" war
ohne die Behebung mit vier Fällen rot.

- „verteilt keinen Abstand mehr über alle Fugen zugleich" — die Tafel hat
  keinen `gap`, und jede der drei Fugen nennt ihren eigenen.
- „trennt die Gruppen sichtbar weiter, als in ihnen Abstand steht" — die
  engste Fuge zwischen zwei Gruppen ist mindestens 6 px größer als jeder
  Abstand innerhalb einer Gruppe (Menüpunkt ↔ Menüpunkt, Eintrag ↔ Eintrag
  am Fuß, Kompassrose ↔ Name, Symbol ↔ Beschriftung, Name ↔ Slogan) und
  mindestens das Vierfache des Abstands zwischen den Menüpunkten. Das ist
  der Kern des Bugs: vorher nannte keine der drei Fugen einen eigenen
  Abstand — es gab nur den gemeinsamen der Tafel, und der galt überall
  gleich.
- „hält Name und Slogan zusammen" und „hängt nicht mehr am Namen" — der
  Slogan steht weiter als 3 px unter dem Namen und näher an ihm, als die
  Gruppen auseinanderstehen.
- „lässt die Maße aus req-078 unberührt" — 13 px, 44 px, 320 px, 21 px.
- „passt mit dem größeren Abstand weiterhin ganz auf den Schirm" — die
  Leiste, aus ihren eigenen Maßen gerechnet, mit allen sechs Bereichen, dem
  Begleiter und dem dreizeiligen Fuß des Gesamt-Admins: 628 px bei den
  900 px, mit denen die E2E-Prüfung misst (`tests/e2e/screen-check.ts`).
- „lässt die Liste rollen, wenn es doch zu niedrig wird" — `overflow-y` und
  `min-height: 0` an der Liste, `flex: none` an Kopf und Fuß (Regel 3).

In Chromium nachgemessen, `/plan` bei 1280×900 mit aufgeklappter Leiste
(vorher jede Fuge 10 px):

```
Name → Reise            16 px
Reise → Bereiche        20 px
Menüpunkt → Menüpunkt    2 px
Linie → erster Eintrag   9 px   (8 px Innenabstand + 1 px Linie)
Kopf                    48 px   (Name 21 + 6 + Slogan 21)
Leiste ohne Leerraum   583 px von 900 px, die Liste rollt nicht
```

Die 583 px sind die Leiste der Testperson: sie ist kein Gesamt-Admin, ihr
Fuß hat zwei Einträge statt drei. Mit der „Verwaltung" sind es die 628 px
aus dem Test darüber. Der Slogan misst dabei 143 px — die aufgeklappten
320 px bleiben auf ihn ausgelegt (req-078).

Volle Suite grün: 4285 Unit-Tests (336 Dateien), 19 E2E-Flüsse
(`npm run test:e2e`, darin die Bildschirmbreiten-Prüfung aus req-049 bei
375, 768 und 1280 px), `npm run lint`, Prettier und `npx tsc --noEmit`;
gebaut hat der E2E-Lauf selbst (`npm run build`).
