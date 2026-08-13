---
titel: Wikivoyage-Kurzbeschreibung für POIs
datum: 2026-08-13
---

## Problem/Nutzen

POIs entstehen heute per Karten-Klick oder per KI-Suche (req-010,
req-014) und tragen ausschließlich Kartendaten: Name, Typ, Position,
Ort. req-014 nennt Beschreibungstexte ausdrücklich als „nicht Teil
dieses Requirements" — es gibt bislang keinen einzigen Text, der
erklärt, *warum* ein Ort lohnt. Wer die POI-Liste durchgeht, um Orte zu
bewerten oder auszusortieren, hat außer dem Namen nichts, worauf er
seine Entscheidung stützen kann; bei der KI-Suche gilt dasselbe für die
KI selbst, die nur Namen ohne Kontext vorschlägt und bewertet
(Qualität der KI-Vorschläge).

Wikivoyage (Wikimedia-Projekt) pflegt für sehr viele Orte redaktionelle
Kurztexte in den Abschnitten „See" und „Do" — genau die Art von
Insider-Hinweis, die eine Bewertungsrunde erleichtert und die kein
Kartendienst liefert. Lizenz: CC BY-SA 4.0. Das erlaubt dauerhaftes
Speichern und Anzeigen der Texte, auch kommerziell, solange Autor bzw.
Quelle genannt wird und eigene Bearbeitungen des Textes unter derselben
Lizenz weitergegeben werden (Share-Alike gilt nur für Bearbeitungen,
nicht für die reine Anzeige). Kosten-/Limitmodell: kostenlos über die
MediaWiki-API der Wikivoyage-Instanzen (de/en), üblicher Rate-Limit-
Etikette (User-Agent, moderates Anfragetempo) folgend, keine
Kontingent-Pflicht. Gespeichert werden darf der abgerufene Textabschnitt
inklusive Artikeltitel und Sprachversion als Quellennachweis.

## Skizze

Beim Anlegen eines POI (Karten-Klick oder KI-Suche) wird zusätzlich zum
Kartendaten-Abgleich eine Wikivoyage-Suche nach dem POI-Namen im
Suchgebiet der Reise versucht (per MediaWiki-Such-API, dann Abschnitt
„See"/„Do" des Treffers mit größter Namens-/Ortsnähe). Ein Treffer
liefert einen kurzen Auszug (ein bis zwei Sätze) plus Link zum vollen
Artikel und Lizenzhinweis; kein Treffer lässt das Feld leer — der POI
entsteht wie bisher, nichts blockiert.

In der POI-Karte im Planer erscheint der Auszug unter dem Namen, klein
und mit „Quelle: Wikivoyage"-Link. Bei der KI-Suche (req-014) bekommt
die KI den Auszug als zusätzlichen Kontext zu jedem bereits gefundenen
Kandidaten mit, bevor sie zwischen ähnlichen Orten unterscheidet oder
eine Bewertung vorschlägt — das macht ihre Vorschläge nachvollziehbarer
begründbar.

Baut auf keiner vorhandenen Idee auf (die einzige offene Idee betrifft
Störungsmeldungen unterwegs, ein anderes Thema) und überschneidet sich
mit keinem umgesetzten Requirement: req-014 schließt
Beschreibungstexte ausdrücklich aus, req-010/req-013 behandeln nur
Darstellung und Filter vorhandener POI-Felder.
