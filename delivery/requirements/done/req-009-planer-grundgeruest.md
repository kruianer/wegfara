---
id: req-009
title: Grundgerüst des Planers
app: wegfara
area: Planung
priority: high
created: 2026-08-02
---

# Ziel (Warum)

Als Reiseleiter will ich am großen Bildschirm eine Reise öffnen und
mich zwischen den Bereichen der Planung bewegen. Das ist der Rahmen,
in den alles Weitere hineinwächst — ohne ihn gibt es keinen Ort für
POI-Sammlung, Tagesplanung oder Kosten.

# Funktion (Was)

Der Planer ist ein eigener Bereich der Anwendung, getrennt vom
Begleiter. Er ist für breite Bildschirme gedacht — iPad quer und
Laptop.

Über allem liegt ein durchgehender Kopfbereich mit dem Logo aus
Kompassrose und Wortmarke, den Bereichen der Planung als Schaltflächen
und rechts dem Namen der geöffneten Reise samt Zeitraum.

Es gibt sechs Bereiche: POIs, Planung, Bewertungen, Kosten, Dokumente,
Einstellungen. In diesem Requirement ist „POIs" der aktive Bereich; die
übrigen sind sichtbar, aber noch nicht bedienbar.

Ein Klick auf den Reisenamen öffnet darunter eine Liste aller Reisen
mit Name, Zeitraum und Status. Die Auswahl einer Reise öffnet sie im
Planer. Beim ersten Aufruf ist die laufende Reise geöffnet; gibt es
keine, die nächste bevorstehende; gibt es auch die nicht, die zuletzt
beendete.

Unter dem Kopfbereich liegen zwei Flächen nebeneinander, getrennt durch
einen verschiebbaren Trenner. Die linke nimmt anfangs die halbe
Fensterbreite ein und lässt sich am Trenner verbreitern. Beide Flächen
bleiben in diesem Requirement leer.

Ist das Fenster schmaler als die Mindestbreite, erscheint statt des
Planers ein Hinweis, dass dieser Bereich einen breiteren Bildschirm
benötigt, mit einem Verweis auf den Begleiter.

# GUI

- Vorlage: `delivery/design/planer/README (1).md` (Handover) und
  `delivery/design/planer/Reiseplaner v4.dc.html` (Prototyp mit
  vollständigen Farbwerten in der Logikklasse).
- Verbindlichkeit: eng folgen.
- Betroffen sind aus der Vorlage: der Abschnitt „Struktur der App"
  (Kopfbereich) sowie aus Abschnitt „1. POIs" ausschließlich die
  Aufteilung in zwei Spalten mit Trenner — nicht deren Inhalt.
- Farben: das Standard-Thema „Indigo-Nacht" aus den Design Tokens.
  Weitere Themen sind nicht Teil dieses Requirements.
- Schriften: Playfair Display für Überschriften und Wortmarke, Figtree
  für die Bedienoberfläche.
- Der Kopfbereich zeigt keine Teilnehmer-Avatare.
- Die Mindestbreite beträgt 1180 Pixel.

# Akzeptanzkriterien

- [x] Gegeben ich rufe den Planer auf einem 1440 Pixel breiten Fenster
      auf, wenn ich den Kopfbereich betrachte, dann sehe ich die
      Wortmarke „Wegfara".
- [x] Gegeben derselbe Zustand, wenn ich den Kopfbereich betrachte,
      dann sehe ich genau sechs Bereichsschaltflächen.
- [x] Gegeben derselbe Zustand, wenn ich den Kopfbereich betrachte,
      dann ist „POIs" als aktiver Bereich hervorgehoben.
- [x] Gegeben heute ist der 10.10.2026 und die Reise „Wien
      Städtereise" läuft vom 09. bis 11.10.2026, wenn ich den Planer
      aufrufe, dann steht „Wien Städtereise" im Kopfbereich.
- [x] Gegeben der Planer ist geöffnet, wenn ich auf den Reisenamen
      klicke, dann erscheint eine Liste mit genau drei Reisen.
- [x] Gegeben die Reiseliste ist offen, wenn ich „Süditalien
      Rundreise" wähle, dann steht „Süditalien Rundreise" im
      Kopfbereich.
- [x] Gegeben der Planer ist geöffnet, wenn ich den Trenner um 200
      Pixel nach rechts ziehe, dann ist die linke Fläche um 200 Pixel
      breiter.
- [x] Gegeben ich rufe den Planer in einem 800 Pixel breiten Fenster
      auf, wenn ich die Seite betrachte, dann erscheint ein Hinweis auf
      die benötigte Bildschirmbreite.
- [x] Gegeben der Planer ist geöffnet, wenn ich auf „Kosten" klicke,
      dann wechselt die Ansicht NICHT.
- [x] Gegeben der Planer ist geöffnet, wenn ich den Kopfbereich
      betrachte, dann erscheinen dort KEINE Teilnehmer-Avatare.

# Constraints

- Der Planer und der Begleiter sind getrennte Bereiche derselben
  Anwendung und teilen sich Datenmodell und Reisen (siehe
  [stack.md](../../stack.md)). Der Planer übernimmt nicht das
  Erscheinungsbild des Begleiters.
- Die Reisen stammen aus dem vorhandenen Bestand; es werden keine
  weiteren angelegt.

# Nicht Teil dieses Requirements

- Inhalte der beiden Flächen: POI-Liste, Karte, Filter, Zähler
- Die Bereiche Planung, Bewertungen, Kosten, Dokumente und
  Einstellungen
- Die Teilnehmer-Sicht, die per Einladungslink erreichbar ist
- Teilnehmer und ihre Darstellung im Kopfbereich
- Auswahl unter den acht Farbwelten des Planers
- Der schwebende KI-Assistent
- Anlegen, Ändern oder Löschen von Reisen
