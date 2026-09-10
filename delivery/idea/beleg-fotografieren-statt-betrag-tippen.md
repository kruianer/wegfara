---
titel: Beleg fotografieren statt Betrag tippen
datum: 2026-09-10
---

## Problem/Nutzen

Eine Ausgabe erfassen (req-029) heißt heute: Titel, Betrag, Währung und
Beteiligte von Hand eintippen — genau in dem Moment an der Kasse, in
dem man das Wechselgeld einsteckt und eigentlich weiter will. req-029
nennt „Belege fotografieren, anhängen oder per KI auslesen" ausdrücklich
als **nicht** Teil des Requirements, und dessen GUI-Abschnitt hält fest:
„Abweichung zur Vorlage: Der Beleg-Scan mit KI-Erkennung entfällt" — die
Design-Vorlage hatte ihn also schon vorgesehen, er wurde nur bewusst
zurückgestellt.

Die Ideen-Richtung nennt exakt diesen Fall als Beispiel für „Weniger
Handgriffe": „Beleg fotografieren statt Betrag tippen." Fotografieren
kann man zwar schon — Dokumente ablegen (req-034) erlaubt das Ablegen
per Kamera —, aber req-034 schließt „Auslesen von Inhalten per KI"
ebenso ausdrücklich aus und kennt keine Verknüpfung zu einer Ausgabe
(nur zu POI oder Transfer). Der Weg von „Foto vom Bon" zu „Ausgabe
erfasst" ist damit unvollständig: Das Foto landet im Dokumente-Ordner,
Betrag, Titel und Beteiligte trägt man trotzdem noch separat von Hand
ein — der eigentliche Handgriff bleibt.

Das ist eine der besten Gelegenheiten, an denen die KI unterwegs
tatsächlich einen Schritt spart statt nur einen Vorschlag zu machen
(Ideen-Richtung: Gruppen-Zusammenspiel und Weniger Handgriffe zugleich —
schnelleres Erfassen heißt auch, dass Salden (req-030) und
Überweisungscode (req-031) früher stimmen).

## Skizze

**Ein Foto, ein Vorschlag.** In „Kosten" (Begleiter) bekommt „+ Neue
Ausgabe erfassen" zusätzlich zum leeren Formular den Weg „Beleg
fotografieren" (Kamera oder Datei, wie beim Dokumente-Ablegen in
req-034). Das Bild geht an die KI-Kapselung `lib/ai/` (dasselbe Prinzip
wie bei der POI-Suche req-014/req-057 und der Beschreibung per KI
req-058) und liefert einen Vorschlag für Betrag, Währung (falls
erkennbar) und einen kurzen Titel (Händler oder Kategorie), der das
bestehende Formular aus req-029 vorausfüllt. Zahler und Beteiligte
wählt der Nutzer weiterhin selbst — das kann kein Beleg hergeben.

**Vorschlagen statt raten.** Erkennt die KI nichts oder ist sie sich
nicht sicher, bleiben die betroffenen Felder leer statt falsch befüllt,
mit dem Hinweis „Beleg konnte nicht gelesen werden — bitte eintragen".
Vor dem Speichern sieht der Nutzer immer das ausgefüllte Formular und
bestätigt oder korrigiert jedes Feld — nichts wird ungesehen
übernommen (Leitprinzip „vorschlagen statt selbst umbauen").

**Beleg bleibt auffindbar.** Das Foto wird wie in req-034 abgelegt
(Datei zuerst, dann Datensatz) und automatisch mit der neu entstandenen
Ausgabe verknüpft — eine dritte Verknüpfungsart neben POI und Transfer.
So ist der Beleg später wiederzufinden, ohne dass der Nutzer ihn
zusätzlich manuell verknüpfen muss.

**Abgrenzung.** Baut auf keiner vorhandenen Idee auf und ist keine
Variante davon: Keine der offenen Ideen (Ein-Tipp-Störungsmeldung,
Öffnungszeiten aus OpenStreetMap, Tagespaket offline, Wegzeiten aus
offenem Routing, Wikivoyage-Kurzbeschreibung) betrifft Ausgaben oder
Belege. Kein Requirement deckt es ab: req-029 schließt Beleg-Scan und
KI-Auslesen ausdrücklich aus („Nicht Teil dieses Requirements"), req-034
schließt „Auslesen von Inhalten per KI" ebenso aus und kennt keine
Verknüpfung zu Ausgaben. Der Stack wird nicht umgebaut: `lib/ai/` wird
nur für einen weiteren, bild-basierten Zweck genutzt, wie es bei der
POI-Suche und der Beschreibung per KI bereits geschieht — kein neuer
Dienst, kein neues Modell.
