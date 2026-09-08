---
id: bug-024
app: wegfara
req: req-049
priority: normal
created: 2026-09-08
---

# Observed

Die mit req-049 eingeführte automatische Bildschirmbreiten-Prüfung
(`tests/e2e/screen-check.ts`) deckt auf, dass ein Großteil der
Bedienelemente im Planer (`/plan`, 1280 px — die einzige Breite, bei der
der Planer seinen eigentlichen Inhalt statt des Hinweises auf einen
breiteren Bildschirm zeigt) kleiner ist als die in
[stack.md](../../stack.md), Abschnitt „Bildschirmbreiten" geforderten
44×44 px:

- Kopfbereich: die Bereichs-Knöpfe „POIs", „Planung", „Bewertungen",
  „Kosten", „Dokumente", „Reisedetails" sowie „Begleiter" und „Mein
  Bereich" (jeweils ca. 27–33 px hoch), der Reise-Knopf (31 px) und
  „Abmelden" (38×38 px).
- POI-Filter: alle Typ-Chips („Alle", „Sehenswürdigkeit", „Stadt & Dorf",
  „Restaurant", „Strand", „Aktivität", „Hotel", „Weltkulturerbe", je ca.
  27 px hoch).
- POI-Liste: die Checkboxen zur Auswahl (13×13 px), der Status-Auswahl
  „Status von …" (28 px hoch), „POI anlegen" (32 px), „Liste ausblenden"
  (30 px), „Suchgebiet zeichnen" (32 px).
- Bewertungsrunde: die fünf Stimm-Radios „Gesetzt", „Wahrscheinlich",
  „Weiß noch nicht", „Wenn wir Zeit haben", „Auf keinen Fall" (je
  13×13 px).

Zusätzlich liegt der Filter-Chip „Weltkulturerbe" bei 1280 px an seiner
Mittelposition unter der Kartenansicht (`canvas[aria-label="Map"]`) —
ausgelöst wird er dort nicht, obwohl er sichtbar erscheint.

# Expected

Jedes Bedienelement im Planer ist bei 1280 px mindestens 44×44 px groß
und an seiner Mittelposition tatsächlich auslösbar — wie es die vier
Regeln in stack.md für alle drei geprüften Breiten verlangen.

# Steps

1. `npm run test:e2e` ausführen (setzt `E2E_CHROMIUM_PATH`, falls kein
   von Playwright mitgeliefertes Chromium vorhanden ist).
2. Jeder der vier Flüsse aus req-047 schlägt an der automatischen
   Bildschirmbreiten-Prüfung (req-049) fehl, sobald er `/plan` öffnet;
   die Meldung listet die betroffenen Elemente einzeln auf (siehe
   „Observed").

# Hinweis

Dies ist eine bewusste Folge von req-049 („Bestehende Verstöße beheben"
ist dort explizit außerhalb des Umfangs) — die Prüfung macht einen
bestehenden Zustand sichtbar, der zuvor unbemerkt blieb. Die Behebung
betrifft mehrere Komponenten (`header.tsx`, die POI-Filter- und
-Listenansicht, die Bewertungs-Stimmen) und ist deshalb als eigener Lauf
sinnvoller als ein Seiteneffekt von req-049.

# Ursache

Fast alle betroffenen Bedienelemente waren schlicht zu klein gebaut:
Knöpfe und Chips mit knappem Innenabstand, native Checkboxen ohne
eigene Größe (13×13 px im Browser-Standard) und ein `<select>` ohne
Mindesthöhe. Der Filter-Chip „Weltkulturerbe" hatte eine andere Ursache:
die Filterleiste (`.filterBar`) lief bei 1280 px über und scrollte
statt umzubrechen (`overflow-x: auto`) — der letzte Chip landete dadurch
außerhalb der sichtbar gescrollten Fläche, aber `getBoundingClientRect`
lieferte trotzdem seine layoutbedingte Position zurück, die bei 1280 px
in den Bereich der danebenliegenden Kartenansicht fiel; dort traf ein
Klick auf seiner Mittelposition die Karte statt den Chip.

Dieselbe Prüfung deckte beim Nachlauf zusätzlich zwei zu kleine
Bedienelemente auf der Anmeldeseite auf (`components/auth-panel.module.css`,
genutzt u.a. von `/einladung/passkey` und `/anmeldung`) — außerhalb des
ursprünglich beobachteten Bereichs, aber von derselben Prüfung
(req-049) verursacht und ohne Behebung ein rotes Quality-Gate.

# Behebung

Durchgehend `min-height: 44px` (Knöpfe, Chips, `select`) bzw.
`width/height: 44px` (native Checkboxen) ergänzt, jeweils mit
`box-sizing: border-box`, wo Innenabstand die Höhe sonst über 44px
hinaus vergrößert hätte:

- `app/plan/components/header.module.css`: `.navButton` (POIs, Planung,
  Bewertungen, Kosten, Dokumente, Reisedetails, Begleiter, Mein
  Bereich), `.tripButton` (Reise-Knopf, jetzt mit `flex-direction:
  column; justify-content: center` für die zwei Zeilen).
- `components/abmelden-button.module.css`: `.button` von 38×38 auf
  44×44 px.
- `app/plan/components/poi-list.module.css` und `poi-list.tsx`:
  `.chip` (Typ-Filter), `.filterBar` bricht jetzt um
  (`flex-wrap: wrap` statt `overflow-x: auto`) statt zu scrollen — behebt
  auch die Erreichbarkeit von „Weltkulturerbe". `.createButton` („POI
  anlegen"), `.rowCheckbox` und die neue Klasse `.bannerCheckbox`
  („Alle POIs auswählen", jetzt mit eigener Klasse statt ganz ohne),
  `.rowName` (Zeilenname, klappt das Formular auf), `.linkPill`
  (Google/Website/Maps), `.statusSelect`.
- `app/plan/components/split-view.module.css`: `.collapseToggle`
  („Liste ausblenden"/„Liste einblenden").
- `app/plan/components/poi-map.module.css`: `.drawButton`
  („Suchgebiet zeichnen"), `.statusFilterSwitch` (die fünf
  Status-Schalter der Karte — 44×44 px statt der 13×13 px des
  Browser-Standards; das Bedienfeld wurde von 242 auf 270px verbreitert,
  damit die Beschriftungen daneben Platz behalten).
- `components/auth-panel.module.css`: `.primaryButton`,
  `.secondaryButton`, `.linkButton`, `.input` — betrifft
  `/einladung/passkey`, `/anmeldung`, `/ersteinrichtung` und
  `/anmeldung/notfallcodes`, die sich diese Datei teilen.

Am Aussehen ändert sich dadurch etwas (grössere Chips, Checkboxen und
Knöpfe) — das ist der Preis der 44×44-px-Regel aus stack.md und war mit
den bisherigen, knapperen Maßen nicht zu vereinbaren.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen (CSS-Layout-Tests nach
dem Muster aus `poi-list.layout.test.ts`, da jsdom kein CSS ausführt):

- `app/plan/components/header.layout.test.ts`
- `components/abmelden-button.layout.test.ts`
- `app/plan/components/poi-list.layout.test.ts` (neuer Abschnitt
  „Tippziele und Filterleiste (bug-024)")
- `app/plan/components/split-view.layout.test.ts`
- `app/plan/components/poi-map.layout.test.ts` (neuer Abschnitt
  „Tippziele (bug-024)")
- `components/auth-panel.layout.test.ts`

Zusätzlich lief die volle automatisierte Bildschirmbreiten-Prüfung
(`npm run test:e2e`) vor der Behebung mit genau den in „Observed"
gelisteten Verstößen rot und ist jetzt grün — alle elf E2E-Tests
bestehen, ebenso die volle Unit-Test-Suite (2873 Tests), Lint und
`tsc --noEmit`.

# Akzeptanzkriterien der Behebung

- [x] Jedes in „Observed" gelistete Bedienelement im Planer ist bei
      1280 px mindestens 44×44 px groß.
- [x] Der Filter-Chip „Weltkulturerbe" ist bei 1280 px an seiner
      Mittelposition auslösbar, nicht mehr durch die Kartenansicht
      verdeckt.
- [x] `npm run test:e2e` ist grün (alle vier Flüsse aus req-047, inkl.
      der Bildschirmbreiten-Prüfung aus req-049).
- [x] Die volle Unit-Test-Suite, Lint und die Typprüfung bleiben grün.
