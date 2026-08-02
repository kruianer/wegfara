# Handoff: Wegfara – KI-gestützte Reiseplanungs-App (iPad / Laptop)

## Overview
Wegfara ist eine kollaborative, KI-gestützte Reiseplanungs-App für Gruppen. Ein **Reiseleiter** sammelt Points of Interest (POIs), startet Bewertungsrunden, in denen **Reiseteilnehmer** per Smartphone abstimmen und kommentieren, plant Tage per Drag & Drop auf einem Zeitstrahl (mit KI-Autoplan und generierten Transfers), verwaltet Kosten/Budget, Dokumente und Reise-Eckdaten. Zielgeräte: iPad quer und Laptop (min. ~1180 px Breite).

## About the Design Files
Die Dateien in diesem Paket sind **Design-Referenzen in HTML** — interaktive Prototypen, die Look und Verhalten zeigen, **kein Produktionscode**. Aufgabe ist es, diese Designs in der Zielumgebung des Codebases (React, Vue, Swift UI, …) mit deren etablierten Patterns und Libraries **nachzubauen**. Existiert noch keine Umgebung, wähle ein passendes Framework (empfohlen: React + TypeScript, Kartenbibliothek Leaflet oder MapLibre) und implementiere die Designs dort.

Technischer Hinweis zum Prototyp: `Reiseplaner v4.dc.html` ist eine „Design Component" — sie läuft über die mitgelieferte `support.js`-Runtime. Zum Ansehen die HTML-Datei direkt im Browser öffnen (alle Dateien müssen im selben Ordner liegen, Internetverbindung nötig für Fonts, Leaflet und Wikipedia-Bilder). Das eigentliche Design (Markup mit Inline-Styles + eine JS-Logikklasse) steht vollständig in dieser einen Datei.

## Fidelity
**High-fidelity.** Farben, Typografie, Abstände, Radien und Interaktionen sind final gemeint und sollen pixelgenau übernommen werden. Das Design ist vollständig **theming-fähig** (8 dunkle Themes über ein Token-Objekt, siehe Design Tokens).

## Struktur der App
Ein persistenter Top-Header (Höhe 62–66 px, Hintergrund `deep`-Token, untere 1px-Border `bd`) mit:
- Logo: Kompassrose (achtzackiger Stern als SVG, Akzentfarbe, im Kreis mit 1.5px-Border und Glow-Schatten) + Wortmarke „Wegfara" (Playfair Display 600, 22px) + Unterzeile „KI · REISEPLANUNG" (9.5px, letter-spacing 0.26em, uppercase, `text3`)
- Navigation als Pill-Buttons (13px, 600): **POIs · Planung · Bewertungen · Kosten · Dokumente · Mobil · Einstellungen**; aktiver Tab: Hintergrund `accTint`, Textfarbe `accText`
- Rechts: Reisename (Playfair italic 16px) + Datum, danach überlappende Teilnehmer-Avatare (29px Kreise, Initialen, 2px Border in `deep`, margin-left −7px)

Schriften: **Playfair Display** (Überschriften, teils italic für Akzentwörter) + **Figtree** (UI). Beide via Google Fonts.

## Screens / Views

### 1. POIs (Split-View: Liste links, Karte rechts)
- **Linke Spalte**: Standard 50 % der Fensterbreite, min 410 px; dazwischen ein **Splitter** (8 px breit, col-resize-Cursor, mittiger Griff 2×38 px) zum Aufziehen (max: Fensterbreite − 480 px). Beim Ziehen Karte per `invalidateSize()` nachführen.
- **Listenkopf**: Titel „Points of *Interest*" (Playfair 25px, „Interest" italic in `accText`), rechts Zähler „X von Y". Darunter **einzeilige Filterleiste** (Typ-Chips: Alle, Sehenswürdigkeit, Stadt & Dorf, Restaurant, Strand, Aktivität) — `overflow-x:auto`, Chips `flex:none`, Scrollbar versteckt. Aktiver Chip: `accTint`-Bg, `acc`-Border, `accText`.
- **Reiseleiter-Banner**: „POIs für eine Bewertungsrunde auswählen" + Button **„Bewertungsrunde starten"** (Pill, `acc`-Bg, `onAcc`-Text; disabled solange nichts angehakt). Startet eine neue Runde mit den angehakten POIs und springt zur Seite Bewertungen.
- **POI-Zeile** (Border-bottom `bdFaint`): Checkbox (nur Reiseleiter) · Bild 84×84, Radius 14 (Prototyp lädt Wikipedia-Thumbnails; produktiv: eigene Fotos) · Statuspunkt (9px Kreis, Statusfarbe + Glow) + Name (15px/600) · Ort · Typ (12px `text3`) · **Link-Buttons als Pills** (Google, Website, Maps — 10.5px/700, `field`-Bg, `bd`-Border; Hover: `acc`-Border + `accText`).
- **Status-Dropdown** (nur Reiseleiter), 5 Werte: Gesetzt, Wahrscheinlich, Weiß noch nicht, Wenn wir Zeit haben, Auf keinen Fall (Farben s. Tokens). Teilnehmer sehen stattdessen einen Status-Badge.
- **Badge „In Bewertung"** (uppercase, 9.5px, `accTint`/`accText`/`hintBd`) wenn der POI in einer aktiven Runde liegt.
- Bei POIs, die je in einer Runde waren: Voter-Avatare (22px, Ring grün = dafür / rot = dagegen), Label „X dafür · Y dagegen", **Kommentar-Pill-Button** („Kommentieren" bzw. „N Kommentare") → klappt Inline-Bereich auf: Kommentarliste, Dafür/Dagegen-Buttons (Outline-Pills, gefüllt wenn eigene Stimme), Eingabefeld + Senden.
- **Karte (rechts)**: Leaflet, dunkle Carto-Tiles (`dark_all`; Tweak: Standard-OSM). Marker = CircleMarker (r=8, Füllung = Statusfarbe, 2px dunkler Rand). **Cluster-Zonen**: POIs werden per Haversine-Distanz (×1.25 Straßenfaktor) gierig geclustert; Cluster ≥2 Mitglieder bekommen einen gestrichelten Kreis (Akzentfarbe, fill 7 %, `dashArray:'2 7'`), Radius = max. Mitgliedsdistanz + 8 km, min 12 km.
- **Overlay oben rechts** (Glas-Panel: `cardGlass`-Bg, blur 12px, Radius 18): „Einzugsgebiet"-Slider 10–150 km (Schritt 5, Default 60) — steuert den Cluster-Radius. Overlay unten links: Status-Legende.
- Marker-Klick expandiert den POI in der Liste.

### 2. Planung (3 Spalten: Warteschlange · Zeitstrahl · Karte)
- **Spalte 1 „Noch unverplant"** (294px): Karten der gesetzten + wahrscheinlichen, noch nicht verplanten POIs; `draggable`, zeigen Statuspunkt, Name, Ort, geschätzte Dauer (je Typ: Sehenswürdigkeit 2.5h, Stadt & Dorf 3h, Restaurant 2h, Strand 3h, Aktivität 2h).
- **Spalte 2 Zeitstrahl** (412px): Tages-Tabs (Tag 1–7 mit Wochentag/Datum, aktiv = `accTint`+`acc`-Border), Titelzeile mit Buttons **„KI planen lassen"** (gefüllt, Glow) und **„Transfers"** (Outline). Vertikaler Zeitstrahl 08:00–22:00, **48 px pro Stunde**, Stundenlinien `bdFaint`. POI-Blöcke: absolut positioniert (`top=(start−8)*48`, `height=dur*48−4`), Radius 12, draggable (Drop rastet auf 30 min). Transfer-Blöcke: gestrichelte Border `hintBd`, Bg `hintBg`, „KI"-Mini-Badge, Label „Transfer · Ort → Ort · X km · Dauer". Beide mit ×-Entfernen.
- **KI-Hinweisbox** nach Aktionen (Bg `hintBg`, Border `hintBd`, „KI"-Badge): z. B. Zwischenstopp-Empfehlung, wenn eine Etappe > 150 km ist.
- **KI-Logik im Prototyp** (produktiv durch echte KI/Routing ersetzen): Autoplan nimmt bis zu 3 unverplante POIs, reiht sie ab 9:00 mit Transfers (Ø 70 km/h, auf 15 min gerundet, min 15 min) + 15 min Puffer. „Transfers" berechnet Fahrten zwischen bestehenden Blöcken.
- **Spalte 3 Karte**: nummerierte Wegpunkte (27px Kreise, `card`-Bg, Akzent-Border + Glow) in Tagesreihenfolge, verbunden durch gepunktete Akzent-Polyline; Overlay mit Tagestitel + „X km · Y Fahrzeit".

### 3. Bewertungen (neue eigene Seite)
- Titel „Bewertungs*runden*", Untertitel. 
- **Panel „Rücklauf pro Teilnehmer · aktive Runden"**: 2-Spalten-Grid; pro Teilnehmer Avatar, Name, „X / Y Stimmen", Fortschrittsbalken (6px, `track`-Bg, `acc`-Füllung). Y = Summe der POIs aller aktiven Runden.
- **Runden-Karten** (neueste zuerst): Header mit Titel (Playfair 18px), Status-Chip (Aktiv = accent / Beendet = muted), für Reiseleiter bei aktiven Runden Button **„Runde beenden"** (Outline in `neg`-Farbe). Meta-Zeile: „X POIs · gestartet D.M. [· beendet D.M.] · Rücklauf Z %".
- **POI-Zeilen** im Grid `minmax(180px,1.2fr) 150px 1fr auto`: Statuspunkt + Name/Ort · **Stimmbalken** (7px, Segmente grün `pos` = dafür, rot `neg` = dagegen, Rest `track` = offen, Breiten anteilig an Teilnehmerzahl) · Text „X dafür · Y dagegen · Z offen" · Voter-Avatare rechts.
- Runde beenden setzt Status auf „beendet" (POIs verlieren den „In Bewertung"-Badge, verschwinden aus der Mobilansicht).

### 4. Kosten
- 4 KPI-Karten (Radius 18): Gesamtkosten, Pro Person, Budget p. P., **Differenz zum Budget** (accent-Karte; Wert `hi` wenn unter, `neg` wenn über Budget; Zahlen Playfair 29px).
- Budgetauslastungs-Balken (9px, Prozent von Budget × Teilnehmer).
- Links Kostengruppen-Karten (Unterkunft, Transport, Aktivitäten, Essen & Trinken, Sonstiges): Header mit Gruppensumme, Zeilen im Grid `1fr 92px 92px` (Name + optionaler Verknüpfungs-Chip zu POI/Transfer, Betrag p. P., Gesamt).
- Rechts Panel „Pro Teilnehmer": Avatar, Name, „Anteil X · bezahlt Y", **Saldo** (+grün/−rot; Saldo = bezahlt − Anteil).

### 5. Dokumente
- Header + Button „Dokument hochladen" (gefüllte Pill). Filter-Chips: Alle / Mit POI verknüpft / Mit Transfer verknüpft / Ohne Verknüpfung.
- Karten-Grid `repeat(auto-fill,minmax(255px,1fr))`: Dateisymbol (42×52, Extension-Label), Name, „Größe · Datum · Uploader", Verknüpfungs-Chip („POI · Neapel" accent / „Transfer · Mietwagen" muted / „Nicht verknüpft" grau).

### 6. Mobil (iPhone-Vorschau der Teilnehmer-Bewertung)
Zweispaltiges Layout: links Erklärtext + **Select „Simulierter Teilnehmer"** + Live-Hinweisbox (Stimmen fließen sofort in Übersicht/POI-Liste); rechts ein iPhone-Frame (im Prototyp `ios-frame.jsx`/`IOSDevice`, dark).
Im Telefon:
- **Header** (unterhalb der iOS-Statusleiste beginnen! padding-top ≈ 66px): „Wegfara" + „Deine offenen Bewertungen", rechts „X von Y bewertet", darunter Gesamt-Fortschrittsbalken (5px).
- Liste **nach Runden gruppiert**: Abschnittskopf pro aktiver Runde (uppercase-Titel in `accText`, Trennlinie, eigener Fortschritt „X / Y"). Kein Runden-Wähler — Teilnehmer sehen alle offenen Bewertungen untereinander.
- **POI-Zeile**: Bild 52×52 (Radius 12), Name, Ort; darunter Buttons **Dafür / Dagegen** (je flex:1, Outline-Pills grün/rot, gefüllt wenn gewählt) + Kommentar-Pill (öffnet Inline-Kommentare + Eingabe „OK").
- **Detail-Overlay (Bottom-Sheet)** beim Tipp auf die Zeile: abgedunkelter Hintergrund (rgba(0,0,0,0.55), Klick schließt), Sheet von unten (max-height 80 %, Radius 22 oben, fadeup-Animation 0.22s): Hero-Bild 148px mit ×-Button, Statuspunkt + Name (Playfair 19px), Ort · Typ, Kurzbeschreibung (~240 Zeichen, im Prototyp Wikipedia-Extract), Link-Pills **Google / Website / Maps / ★ Rezensionen** (Rezensionen accent-gefärbt; URL = Google-Suche „Name Ort bewertungen"), Dafür/Dagegen, Kommentarliste + Eingabe.
- Alle Touch-Ziele ≥ 44 px hoch halten.

### 7. Einstellungen
- Karte „Eckdaten der Reise": Reisename (Text), Beginn/Ende (Date), **Reiseart** als 2 wählbare Karten (Autoreise / Städtereise — aktive: `acc`-Border + `accTint`), Slider „Standard-Einzugsgebiet" 10–150 km (koppelt den Karten-Slider), Budget pro Person (Number) + Währung (EUR/CHF).
- Karte „Reiseteilnehmer · N Personen": Zeilen mit Avatar, Name (Inline-Edit: Border erscheint bei Hover/Focus), Rolle-Select (Reiseleiter/Teilnehmer), ×-Entfernen; Button „+ Teilnehmer hinzufügen".

### KI-Chat (schwebend, nur auf POIs + Planung)
- Zu-Button unten rechts: dunkle Pill „KI-Assistent" mit pulsierendem Akzentpunkt (shimmer 2.6s) + Glow.
- Offen: Panel 376×492 (Glas, Radius 22, Schatten `0 26px 70px rgba(0,0,0,0.5)`), Header mit Kontextzeile („Kontext: POI-Sammlung" / „Tagesplanung"), Bubbles (User = `accTint`+`hintBd`, KI = `mutedTint`), Input-Pill + Senden. Enter sendet; Antwort im Prototyp simuliert (~650 ms Delay); Auto-Scroll ans Ende.

## Interactions & Behavior
- Seitenwechsel über Header-Nav (Client-State, kein Routing nötig, aber produktiv URLs empfohlen)
- Drag & Drop: HTML5-DnD; Drop auf Zeitstrahl rundet auf 0.5h, klemmt auf 8–22 Uhr; Verschieben bestehender Blöcke gleich
- Voting ist ein Toggle (erneuter Klick auf gleiche Stimme entfernt sie); eine Stimme pro Teilnehmer pro POI
- Rollen: Teilnehmer sehen nur POIs, die je in einer Runde waren; keine Checkboxen, kein Status-Dropdown, keine „Runde beenden"-Buttons
- Hover-Zustände: Borders wechseln auf `acc`, teils Glow-Schatten `0 0 18px glow`
- Animationen: `fadeup` (opacity+8px translateY, 0.18–0.22s ease) für aufklappende Bereiche/Overlays; `shimmer`-Puls für den KI-Punkt
- Karten fitten Bounds beim ersten Rendern (padding 0.18/0.35); bei Tageswechsel re-fit

## State Management
Zentrale Entitäten (im Prototyp eine Klasse mit setState; produktiv Store + Backend):
- `settings` {name, start, end, art: 'auto'|'stadt', radius, budget, cur}
- `participants` [{id, name, color, role}]
- `pois` [{id, name, ort, type, lat, lng, status, web, votes: {userId: 1|-1}, comments: [{by, text}]}]
- `rounds` [{id, title, status: 'aktiv'|'beendet', started, ended?, pois: [poiId]}] — „in Bewertung" = Mitglied einer aktiven Runde
- `plan` {dayIndex: [{kind:'poi', poi, start, dur} | {kind:'transfer', from, to, start, dur, km}]}
- `docs` [{name, ext, size, date, by, link: {kind:'POI'|'Transfer', label} | null}]
- UI-State: aktive Seite, Filter, Splitterbreite, expandierter POI, ausgewählte Checkboxen, aktiver Tag, KI-Hinweis, Chatverlauf, simulierter Mobil-User, Mobil-Detail-POI
- Abgeleitet: Rücklauf pro Teilnehmer/Runde, Kosten-Summen, Budget-Delta, unverplante POIs

## Design Tokens
Theme-Objekt (8 dunkle Themes; Default **Indigo-Nacht**). Vollständige Paletten aller Themes stehen in der Logikklasse der HTML-Datei (`this.THEMES`). Indigo-Nacht:
- `page #0C0F1E` (+ Sternenhimmel: mehrere radial-gradients mit 1–1.5px weißen Punkten + Mondlicht-Gradient oben rechts in `glow`)
- `card #131730` · `cardAlt #171C38` · `field #1C2242` · `cardGlass rgba(19,23,48,0.84)`
- Borders: `bd rgba(166,180,232,0.16)` · `bdSoft 0.10` · `bdFaint 0.06` · `track #1C2240` · `mutedTint rgba(166,180,232,0.08)`
- Text: `text #E9EBF7` · `text2 #B3BAD8` · `text3 #7B83A8` · `text4 #4A5170` · `head #F0EAD8`
- Akzent (Mondgold): `acc #D9C589` · `onAcc #131022` · `accText #E5D6A5` · `accTint rgba(217,197,137,0.11)` · `hi #EFE3B8` · `glow rgba(217,197,137,0.20)`
- Hinweis: `hintBg rgba(217,197,137,0.08)` · `hintBd rgba(217,197,137,0.30)` · `hintFg #DECFA6`
- Semantik: `pos #8FD6A4` (dafür) · `neg #E896A4` (dagegen) · `deep #090C18` (Header/Chat)
- Status: Gesetzt `#8FD6A4` · Wahrscheinlich `#C0D98F` · Weiß noch nicht `#9BA3C0` · Wenn wir Zeit haben `#E8C27E` · Auf keinen Fall `#E896A4` (Tints = Farbe mit 14 % Alpha)
- Weitere Themes: Veilchen-Nacht, Wald-Nacht, Anthrazit-Orange, Gold-Nacht, Bernstein-Nacht, Rubin-Nacht, Ozean-Nacht
- Radien: Pills 999 · Karten 18 · Sheets 22 · Eingaben 12 · Zeitstrahl-Blöcke 12–14 · Bilder 12–14
- Typo-Skala: 32/29/25 Playfair (Seitentitel/KPI/Panel), 18–19 Playfair (Kartentitel), 13–15 Figtree (Body), 11–12 (Meta), 9.5–10.5 uppercase mit letter-spacing 0.08–0.26em (Labels)

## Assets
- Fonts: Google Fonts — Playfair Display (500–700, ital), Figtree (400–700)
- Karten: Leaflet 1.9.4 + Carto-Basemaps `dark_all` (Attribution OSM/CARTO erforderlich); Tweak-Option Standard-OSM-Tiles
- POI-Bilder & Kurzbeschreibungen: im Prototyp zur Illustration von der Wikipedia-REST-API geladen — produktiv durch eigene Fotos/Redaktionstexte oder eine Places-API ersetzen
- Logo: Inline-SVG-Kompassrose (kein externes Asset)
- `image-slot.js`: Drag&Drop-Bildplatzhalter (nur Prototyp-Hilfsmittel)
- `ios-frame.jsx`: iPhone-Rahmen für die Mobil-Vorschau (nur Prototyp-Hilfsmittel)

## Files
Alle Dateien liegen flach in diesem Ordner:
- `Reiseplaner v4.dc.html` — das komplette Design (Markup + Logikklasse + alle Theme-Paletten); im Browser öffnen zum Ausprobieren
- `support.js` — Runtime des Prototyps (nicht portieren)
- `image-slot.js`, `ios-frame.jsx` — Prototyp-Hilfskomponenten (nicht portieren; iPhone-Vorschau dient nur der Demonstration der Teilnehmer-Sicht)

Demo-Daten: Beispielreise „Süditalien Roadtrip", 12.–18.09.2026, 6 Teilnehmer, Budget 1.200 € p. P., 12 POIs, 3 Bewertungsrunden (1 beendet, 2 aktiv).
