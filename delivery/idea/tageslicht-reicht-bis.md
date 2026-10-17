---
titel: Tageslicht im Plan — und die Frage „reicht das Licht noch?"
datum: 2026-10-01
---

## Problem/Nutzen

wegfara weiß heute nicht, wann es am Reiseziel hell ist. Im ganzen Repo
gibt es keine Zeile zu Sonnenaufgang, Sonnenuntergang oder Dämmerung —
die einzigen Treffer für „dunkel" sind Farbwelten (req-007). Der
Begleiter zeigt im Kopfbereich Temperatur und Regenwahrscheinlichkeit
(req-002), und der Abruf bei Open-Meteo holt genau diese zwei Werte
(`lib/weather/open-meteo-client.ts`: `temperature_2m_max`,
`precipitation_probability_max`). Ein Programmpunkt trägt eine Uhrzeit
(req-003), ein POI eine Dauer (req-041, req-058), ein Transfer eine
gerechnete Fahrzeit mit Puffer (req-059, req-073). Alles davon misst
Zeit; nichts davon misst Licht.

Das ist eine Lücke eigener Art, weil Licht die eine Tagesbedingung ist,
die sich **nicht** verhandeln lässt. Ein geschlossenes Museum hat eine
Webseite, ein Stau löst sich auf, ein Restaurant hat einen zweiten
Standort — die Dunkelheit kommt pünktlich und ohne Ausweichoption. Und
sie verschiebt sich massiv über das, was eine Reise ausmacht: Ein
Aussichtspunkt um 19:00 ist im Juni in Amalfi ein Sonnenuntergang und im
Oktober in Bergen ein schwarzes Panorama. Ein Reisetag in Lappland im
Dezember hat vier Stunden Licht, und der Planer verteilt neun
Programmpunkte darüber, ohne zu widersprechen.

Der eigentliche Nutzen liegt aber nicht in der Anzeige der
Sonnenuntergangszeit — die steht in jedem Wetter-Widget. Er liegt in der
**Differenz**, die bisher niemand bildet: wegfara kennt seit req-059 die
echte Rückwegzeit und seit req-041 die Restdauer am Ort. Damit kann es
die Frage beantworten, die man unterwegs wirklich hat und die man auf
einem Wanderweg nicht im Kopf rechnet — „schaffe ich den Rückweg noch im
Hellen?". Das ist genau der Kernmoment der Vision, nur in seiner
unauffälligsten Variante: Der Plan geht nicht mehr auf, und man merkt es
erst, wenn es zu spät ist, weil nichts daran falsch aussieht. „Abstieg
90 Min, Abfahrt 17:30" ist ein korrekter Plan und im November ein
Abstieg im Dunkeln.

Dazu kommt die Qualität der KI-Vorschläge: Lässt man die KI den Tag
planen (req-056) oder einen Punkt umplanen (req-040), hat sie keinerlei
Information darüber, wann am Zielort das Licht endet. Sie kann einen
Aussichtspunkt nur zufällig richtig legen. Eine Zeile Kontext im Prompt
repariert eine ganze Klasse von Fehlvorschlägen.

Abgrenzung zu den vorhandenen Ideen: Öffnungszeiten aus OpenStreetMap
sagt, ob die Tür offen ist; Feiertage und Ferien sagt, was für ein Tag
es ist; das Tagespaket macht den Plan netzunabhängig. Keine davon sagt,
wann Licht ist — und Tageslicht ist unter allen Tagesbedingungen die
einzige, die **gar keine Datenquelle braucht**.

**Quelle, Lizenz, Kosten, Speichern:** keine externe Quelle. Sonnenauf-
und -untergang sowie die bürgerliche Dämmerung ergeben sich aus
Koordinate und Datum über ein bekanntes astronomisches Verfahren (NOAA
Solar Position Algorithm) — rund fünfzig Zeilen eigener Rechnung oder
eine kleine Bibliothek wie `suncalc` (MIT). Kein Zugangsschlüssel, keine
Nutzungsbedingungen, kein Limit, keine Kosten, kein Abfluss von
Nutzerdaten. Gespeichert wird bewusst nichts: Der Wert ist jederzeit neu
berechenbar, also gehört er nicht in die Datenbank — keine Migration.
Open-Meteo könnte `sunrise`/`sunset` mitliefern, ist dafür aber
untauglich: Der Abruf deckt 16 Tage ab (`FORECAST_DAYS = 16`), eine drei
Monate im Voraus geplante Reise bekäme nichts, und ohne Netz erst recht
nicht. Die eigene Rechnung gilt für jedes Datum und funktioniert offline
— passend zum Leitprinzip „Open Source und selbst gehostet" und zum
Tagespaket.

## Skizze

**1. Eine reine Rechnung, kein Dienst.** Ein neues Modul
`lib/tageslicht/` liefert zu Koordinate und Datum Sonnenaufgang,
Sonnenuntergang und das Ende der bürgerlichen Dämmerung (die Grenze, ab
der man draußen nichts mehr erkennt — nicht der Sonnenuntergang selbst,
das ist der häufigste Denkfehler). Kein Netzaufruf, keine DB, kein
Zwischenspeicher nötig. Die Zeitzone kommt aus dem Ort der Reise;
Open-Meteo wird bereits mit `timezone=auto` befragt, die Zuordnung ist
also schon im Haus. Zwei Sonderfälle muss die Funktion beantworten statt
zu scheitern: Polartag („es wird heute nicht dunkel") und Polarnacht
(„es wird heute nicht hell").

**2. Begleiter: Licht sieht man, man liest es nicht.** Der Zeitstrahl in
`/go` erhält einen Lichtverlauf — der Bereich außerhalb des Tageslichts
ist gedämpft hinterlegt. Dass ein Programmpunkt im Dunkeln liegt, sieht
man dann ohne eine einzige Zahl. Im Kopfbereich steht neben dem Wetter
die Untergangszeit des gewählten Tages; das Sonnensymbol ist in der
Design-Vorlage (req-002) schon vorhanden und wird mitgenutzt, statt ein
neues Element einzuführen.

**3. Der Kern: „Licht reicht bis".** Am laufenden Programmpunkt rechnet
der Begleiter die Restkette des Tages — verbleibende Dauer am Ort plus
Transferzeiten und Puffer (req-059, req-073) — gegen das Ende der
Dämmerung. Endet sie danach, erscheint eine ruhige Zeile: „Rückweg endet
40 Min nach Dunkelheit." Kein Alarm, keine Umplanung von selbst
(Leitprinzip: vorschlagen statt umbauen) — und wenn die
Ein-Tipp-Störungsmeldung gebaut ist, ist das genau ein Anlass, den sie
der KI übergeben kann.

**4. Planer: der Hinweis fällt vor dem Fehler.** Beim Verplanen eines
POI (req-039) und beim Umplanen (req-040) erscheint ein Hinweis, wenn
die gewählte Zeit im Dunkeln liegt. Dem Tagesplan-Kontext der KI
(req-056) werden Sonnenauf- und -untergang des jeweiligen Reisetags
mitgegeben, damit sie Außenpunkte überhaupt richtig legen kann.

**5. Nur wo es zählt.** Der Hinweis gilt für Außen-POIs —
Aussichtspunkt, Strand, Wanderung, Park. Ein Museum und ein Restaurant
schweigen dazu; der POI-Typ ist vorhanden (req-010, req-013), und ohne
diese Einschränkung wird aus einer Hilfe eine Hinweis-Inflation.

**Bewusst nicht Teil davon:** goldene Stunde, blaue Stunde, Mondphasen,
Fotografie-Werkzeuge. Das ist der naheliegende Ausbau und genau der
falsche — die Idee endet bei der einen Frage, die unterwegs wirklich
weh tut (Leitprinzip: weniger Funktionen, aber fertig).
