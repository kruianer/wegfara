---
titel: Treffpunkt — ein gemeinsamer Punkt, zu dem ein Pfeil führt
datum: 2026-11-05
---

## Problem/Nutzen

Die Vision verspricht: „wer sich verliert, findet die anderen wieder."
req-050 liefert dafür die eine Hälfte: Punkte der Mitreisenden auf der
Karte. Das beantwortet „wo sind die anderen?", aber nicht die Frage, die
danach kommt: „wo treffen wir uns?"

Die Situation ist alltäglich: Auf dem Markt teilt sich die Gruppe auf,
die einen wollen noch zum Hafen, die anderen ins Café, um vier soll es
gemeinsam weitergehen. Oder das Kind ist müde, und zwei gehen schon
vor. Heute wird das in der Messenger-Gruppe verhandelt („am Brunnen" —
welcher Brunnen?), oder man ruft sich zu und hofft. Ein Punkt auf der
Karte hilft dabei nur begrenzt:

- Wer unterwegs ist, ist ein bewegtes Ziel. Zwei, die aufeinander
  zulaufen wollen, gehen leicht aneinander vorbei.
- Wer seine Position nicht teilt, bleibt unsichtbar — und das soll auch
  so bleiben. Ein Treffpunkt funktioniert trotzdem, weil er nichts über
  die eigene Position verrät.
- Ein Punkt verfällt nach 15 Minuten (req-050). Im Funkloch bleibt also
  gar nichts.
- Eine Karte einhändig in der Sonne zu lesen ist mühsam; eine Karte
  drehen, um zu wissen, in welche Gasse man muss, erst recht.

Eine Verabredung ist außerdem kein Programmpunkt. Sie gehört nicht in
den Zeitstrahl, und niemand soll dafür den Plan ändern. Bisher kommt das
Wort „Treffpunkt" in keinem Requirement und keiner Idee als Funktion
vor; req-050 schließt nur Benachrichtigungen aus. Die Idee baut auf
req-050 auf, ersetzt es aber nicht: Neu ist nicht das Sehen der anderen,
sondern die gemeinsame Verabredung.

Der Nutzen liegt in den Richtungen Gruppen-Zusammenspiel („sich
wiederfinden") und Unterwegs-Tauglichkeit (einhändig, Sonne, wenig
Aufmerksamkeit, schlechtes Netz).

## Skizze

**Setzen in zwei Tipps.** Auf der Karte im Begleiter gibt es „Treffpunkt
setzen". Lange auf die Karte drücken oder „Hier, wo ich stehe" wählen,
fertig. Die Uhrzeit ist vorbelegt (nächste volle Viertelstunde plus 30
Minuten) und lässt sich mit einem Tipp ändern; ein Name ist freiwillig
(„Brunnen"). Gemäß dem Leitprinzip „ein konkreter, änderbarer Vorschlag
statt ein leeres Formular" schlägt die App als Name den nächsten POI
der Reise vor, wenn einer in der Nähe liegt.

**Ein Treffpunkt je Reise.** Es gibt nur einen aktuellen Treffpunkt.
Jeder Teilnehmer darf ihn setzen, verschieben oder löschen; ein neuer
ersetzt den alten. Das hält die Bedienung einfach. Mehrere parallele
Treffpunkte für Teilgruppen wären mehr Optionen statt weniger Schritte.

**Was die anderen sehen.** Eine schmale Leiste im Begleiter, auf jeder
Ansicht, mit großer Schrift und hohem Kontrast:

> Treffpunkt Brunnen · 16:00 · 320 m ↗

Ein Tipp öffnet die Zielansicht: bildschirmfüllender Pfeil, Entfernung,
Uhrzeit, Name, darunter ein Link in die Navigations-App (wie bei den POIs
in req-079). Mehr nicht. Es ist bewusst keine Karte, sondern das, was
man in der Gasse mit einer Hand und einem Blick lesen kann.

**Der Pfeil braucht kein Netz.** Richtung und Entfernung entstehen allein
auf dem Gerät aus dem eigenen GPS (`lib/positions/geolocation.ts`) und
dem Kompass des Geräts (`deviceorientation`). Es wird keine Position
gesendet und keine geteilt; der Pfeil funktioniert also auch mit
ausgeschaltetem Schalter aus req-050. Der Treffpunkt selbst wird beim
Abruf im Gerät gemerkt, damit er ein Funkloch übersteht. Das geht auch
ohne das volle Tagespaket (Idee `tagespaket-offline-im-begleiter`), wäre
dort aber später gut aufgehoben.

Stolperstellen, die vor einem Requirement zu prüfen sind:

- iOS gibt den Kompass nur nach einer Nutzeraktion frei; der Tipp auf
  die Leiste kann diese Aktion sein.
- Gibt es keinen Kompass oder ist er ungenau, fällt die Ansicht auf
  Entfernung plus Himmelsrichtung zurück („320 m nach Nordost").

**Bin unterwegs — und ich bin da.** Zwei Tipps in der Zielansicht:
„Bin unterwegs" und „Bin da". Beides ist freiwillig und wird als Zustand
je Teilnehmer gezeigt („Anna ist da, Ben unterwegs"). So weiß die Gruppe,
ob sich das Warten lohnt, ohne dass jemand seine Position teilen muss.
Geht die Meldung im Funkloch nicht raus, wird sie nachgereicht. Wer nur
„5 Minuten später" melden will, tippt auf die Uhrzeit.

**Daten.** Eine neue Tabelle wie `trip_treffpunkt` mit genau einer Zeile
je Reise (Position, Uhrzeit, Name, gesetzt von), dazu der Zustand je
Teilnehmer. Nur der aktuelle Stand wird gespeichert, ohne Verlauf, im
Geist von `trip_position`. Zwei Stunden nach der Uhrzeit oder wenn die
Reise endet, verschwindet alles; ein alter Treffpunkt ist schlimmer als
keiner. Der Treffpunkt ist nur innerhalb der Reise sichtbar, nicht für
Außenstehende. Gäste mit Zugang sehen ihn wie andere Teilnehmer.

**Später denkbar, nicht Teil der ersten Stufe:** Der Chat-Assistent kann
einen Treffpunkt vorschlagen, wenn die Gruppe sich aufteilt („Wer zum
Hafen geht, ist um 16:00 am Brunnen wieder dabei"), und zwar im Sinne
von „vorschlagen statt selbst umbauen" erst nach Bestätigung. Auch eine
Benachrichtigung bei neuem Treffpunkt wäre sinnvoll, setzt aber Push
voraus, das es bisher nicht gibt (req-065 schließt es aus). In der
ersten Stufe erscheint die Leiste, sobald jemand die App öffnet.

**Nicht Teil der Idee:** ein Eintrag im Zeitstrahl, Umplanen des Plans,
Hintergrund-Standort, Navigation in der App, Verlauf vergangener
Treffpunkte.

Der kleinste nützliche Schritt ist Setzen, Leiste und Zielansicht mit
Pfeil. Unterwegs/Da und das Nachreichen kommen danach.
