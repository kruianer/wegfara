---
id: req-010
title: POI-Ansicht im Planer
app: wegfara
area: Planung
priority: high
created: 2026-08-02
---

# Ziel (Warum)

Als Reiseleiter will ich alle gesammelten Orte einer Reise nebeneinander
sehen — als Liste und auf der Karte — und festhalten, wie sicher jeder
davon ins Programm kommt. Das ist die Vorstufe zur Tagesplanung: erst
wenn ich weiß, was gesetzt ist und was nur eine Idee, kann ich Tage
füllen.

# Funktion (Was)

Der Bereich „POIs" des Planers füllt die beiden Flächen aus req-009:
links die Liste der gesammelten Orte, rechts die Karte.

Ein POI ist ein gesammelter Ort — eine Idee für die Reise, ohne feste
Zeit. Er trägt Name, Ort, Typ, geografische Position, einen Status und
kann eine Webadresse haben. POIs sind etwas anderes als die
Programmpunkte des Begleiters; diese bleiben unberührt.

Jeder POI hat einen von fünf Status: Gesetzt, Wahrscheinlich, Weiß noch
nicht, Wenn wir Zeit haben, Auf keinen Fall. Der Status lässt sich über
eine Auswahlliste an der POI-Zeile ändern und bleibt erhalten.

Es gibt sieben Typen: Sehenswürdigkeit, Stadt & Dorf, Restaurant,
Strand, Aktivität, Hotel, Weltkulturerbe. Über der Liste steht eine
Filterleiste mit „Alle" und je einem Eintrag pro Typ; die Auswahl
schränkt die Liste ein.

Der Listenkopf zeigt den Titel und einen Zähler, wie viele POIs von
insgesamt wie vielen gerade sichtbar sind.

Rechts erscheint jeder POI als Kreis in der Farbe seines Status. Liegen
mehrere POIs nah beieinander, umschließt sie ein gestrichelter Kreis.
Wie großzügig gruppiert wird, steuert ein Regler „Einzugsgebiet" oben
rechts auf der Karte. Unten links steht eine Legende der Statusfarben.

Ein Klick auf einen Kartenkreis hebt den zugehörigen POI in der Liste
hervor.

Zu jeder der drei Reisen liegen POIs im Bestand.

# GUI

- Vorlage: `delivery/design/planer/README (1).md`, Abschnitt „1. POIs",
  sowie `delivery/design/planer/Reiseplaner v4.dc.html`.
- Verbindlichkeit: eng folgen. Das Erscheinungsbild wird vollständig
  umgesetzt, auch dort, wo die Funktion dahinter noch fehlt.
- Sichtbar, aber ohne Funktion: das Banner „POIs für eine
  Bewertungsrunde auswählen" samt Auswahlkästchen und Schaltfläche
  „Bewertungsrunde starten".
- Abweichung zur Vorlage: Anstelle des Bildes je POI-Zeile erscheint
  eine einfarbige Fläche in der Farbe des Typs, in der Größe des Bildes
  aus der Vorlage (84 × 84, Radius 14).
- Statusfarben nach Design Tokens: Gesetzt #8FD6A4, Wahrscheinlich
  #C0D98F, Weiß noch nicht #9BA3C0, Wenn wir Zeit haben #E8C27E, Auf
  keinen Fall #E896A4.
- Typfarben: die fünf des Planer-Designs; für Hotel und Weltkulturerbe
  gelten die Farben des Begleiters aus req-003 — Hotel #2b7cc7,
  Weltkulturerbe #c9a227.
- Die Filterleiste ist einzeilig und bei Bedarf waagrecht scrollbar.

# Akzeptanzkriterien

- [x] Gegeben die geöffnete Reise „Süditalien Rundreise" mit zwölf
      POIs, wenn ich den Bereich „POIs" betrachte, dann sehe ich links
      zwölf POI-Zeilen.
- [x] Gegeben derselbe Zustand, wenn ich den Listenkopf betrachte,
      dann steht dort „12 von 12".
- [x] Gegeben derselbe Zustand, wenn ich in der Filterleiste
      „Restaurant" wähle, dann enthält die Liste nur POIs vom Typ
      Restaurant.
- [x] Gegeben ein POI mit dem Status „Weiß noch nicht", wenn ich in
      seiner Auswahlliste „Gesetzt" wähle, dann ist sein Statuspunkt
      grün (#8FD6A4).
- [x] Gegeben ich habe einen POI auf „Gesetzt" gesetzt, wenn ich die
      Seite neu lade, dann steht dieser POI weiterhin auf „Gesetzt".
- [x] Gegeben die geöffnete Reise mit zwölf POIs, wenn ich die Karte
      betrachte, dann sehe ich zwölf Kreismarker.
- [x] Gegeben mehrere POIs liegen nah beieinander, wenn ich die Karte
      betrachte, dann umschließt sie ein gestrichelter Kreis.
- [x] Gegeben die Karte ist sichtbar, wenn ich den Regler
      „Einzugsgebiet" auf einen kleineren Wert ziehe, dann verkleinern
      sich die gestrichelten Kreise.
- [x] Gegeben die Karte ist sichtbar, wenn ich einen Kreismarker
      anklicke, dann ist der zugehörige POI in der Liste hervorgehoben.
- [x] Gegeben der Bereich „POIs" ist geöffnet, wenn ich auf
      „Bewertungsrunde starten" klicke, dann passiert NICHTS.
- [x] Gegeben eine POI-Zeile, wenn ich sie betrachte, dann erscheint
      dort KEIN Foto.

# Constraints

- POIs sind eine eigene Sache und ersetzen die Programmpunkte des
  Begleiters nicht. Die vorhandenen Programmpunkte bleiben unverändert.
- Der Status eines POI wird ausschließlich vom Reiseleiter gesetzt.
  Solange es keine Rollen gibt, gilt der angemeldete Nutzer als
  Reiseleiter.

# Nicht Teil dieses Requirements

- Bewertungsrunden starten, beenden, abstimmen, kommentieren
- Aufklappbarer Bereich mit Kommentaren und Stimmen an der POI-Zeile
- Anlegen, Ändern oder Löschen von POIs durch den Nutzer
- Verknüpfung eines POI mit einem Programmpunkt oder einem Reisetag
- Der schwebende KI-Assistent
- Rollenunterscheidung zwischen Reiseleiter und Teilnehmer
- Echte Fotos zu POIs
