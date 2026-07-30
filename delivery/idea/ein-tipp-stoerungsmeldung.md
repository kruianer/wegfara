---
titel: Ein-Tipp-Störungsmeldung im Begleiter
datum: 2026-07-30
---

## Problem/Nutzen

Die Vision beschreibt den Kernmoment von wegfara so: das Museum ist zu,
der Stau frisst zwei Stunden, die Schlange dauert noch dreißig
Minuten — und die App soll das melden können und daraufhin eine
Anpassung vorschlagen. Bisher gibt es dafür im Begleiter (`/go`) keinen
Weg: alle bisher umgesetzten Requirements (req-001 bis req-008)
betreffen ausschließlich die Darstellung des Plans (Zeitstrahl, Karte,
Wetter, Buchungsstatus, Themenauswahl), aber keine Eingabe des Nutzers
unterwegs.

Genau in dem Moment, in dem der Plan nicht mehr aufgeht, hat der
Nutzer aber am wenigsten Zeit, Aufmerksamkeit und oft nur eine freie
Hand (Unterwegs-Tauglichkeit). Ein Formular mit Freitextfeld wäre hier
der falsche Maßstab — gebraucht wird der schnellstmögliche Weg von
"etwas stimmt nicht" zu einem konkreten, änderbaren Vorschlag der KI
(Qualität der KI-Vorschläge, Leitprinzip "konkreter Vorschlag statt
leeres Formular").

## Skizze

Am aktuell laufenden oder nächsten Programmpunkt im Begleiter
erscheint eine einzige, gut erreichbare Schaltfläche (z. B. Daumen
unten am Bildschirmrand, mit einer Hand bedienbar). Ein Tipp öffnet
keine Tastatur, sondern eine kleine Auswahl mit wenigen, vorformulierten
Gründen als große Kacheln: "Geschlossen", "Warteschlange", "Stau",
"Verspätung", "Sonstiges" (Sonstiges optional mit kurzer Spracheingabe
statt Tippen).

Nach der Auswahl erzeugt die KI sofort einen konkreten
Anpassungsvorschlag für den restlichen Tag (z. B. Punkte tauschen,
verschieben, streichen) inklusive kurzer, nachvollziehbarer Begründung
— der Nutzer bestätigt oder verwirft ihn, der Plan ändert sich nie von
selbst (Leitprinzip aus der Vision). Bis zur Bestätigung bleibt der
alte Plan sichtbar und gültig.

Baut auf keiner vorhandenen Idee auf (delivery/idea/ war leer) und
überschneidet sich mit keinem bisherigen Requirement, da keines davon
eine Nutzereingabe unterwegs oder einen KI-Anpassungsvorschlag umsetzt.
