---
titel: Vorlieben aus den eigenen Stimmen — die KI lernt aus der Bewertungsrunde
datum: 2026-10-15
---

## Problem/Nutzen

Die KI-Suche weiß heute nur das, was jemand von Hand aufgeschrieben hat.
Seit req-057 stehen in den Reisedetails Interessen zum Ankreuzen, zwei
Freitextfelder („Worauf legen wir Wert", „Was wir nicht wollen") und
eine Mindestbewertung. Alle vier sind freiwillig, und sie sind genau so
gut, wie der Reiseleiter sie pflegt. In der Praxis werden sie einmal
beim Anlegen der Reise halb ausgefüllt und danach nie wieder angefasst.

Gleichzeitig sammelt wegfara längst die bessere Antwort — und wirft sie
weg. Die Bewertungsrunde (req-054, req-063) fragt die Gruppe POI für POI,
und die Stimmen bleiben nach dem Beenden erhalten: `rating_vote` hält je
Runde, POI und Person eine von fünf Stimmen (`unbedingt`,
`waere_schoen`, `wenn_zeit`, `lieber_nicht`, `ohne_mich`). Am POI hängt
sein `type` (sieben Werte von `sehenswuerdigkeit` bis
`weltkulturerbe`), seine `bewertung`, seine `duration_min`, seine
`kosten_cent`. Und `rating_vote.participant_id` zeigt auf `participant`
— eine Person des Accounts, nicht der Reise. Die Stimmen sind also
schon heute reisenübergreifend auswertbar, ohne eine einzige neue
Spalte.

Was daraus folgt, ist der Nutzen. Auf der zweiten Reise schlägt die KI
wieder drei Kirchen vor, und die Gruppe stimmt sie wieder nieder — obwohl
sie das auf der ersten Reise schon fünfmal getan hat. Niemand schreibt
„keine Kirchen" ins Freitextfeld; man stimmt es einfach jedes Mal ab.
Das ist Arbeit, die wegfara der Gruppe zum zweiten Mal aufhält, mit
Daten, die es besitzt.

Der Gewinn ist dreifach:

- **Weniger Handgriffe:** Die Präferenzen müssen nicht gepflegt werden,
  sie entstehen aus dem, was die Gruppe ohnehin tut. Das ist dieselbe
  Bewegung wie „Beleg fotografieren statt Betrag tippen" — erkennen
  statt eingeben lassen.
- **Treffsicherere Vorschläge:** Ein Lauf liefert seit req-057 zwanzig
  POIs. Werden davon fünf besser, spart das eine ganze Abstimmungsrunde.
- **Nachvollziehbarkeit:** Eine abgeleitete Vorliebe kann ihre Belege
  nennen („dreimal ‚Lieber nicht' bei Kirchen auf zwei Reisen"). Das ist
  mehr, als ein handgeschriebener Satz je kann, und es macht die
  Vorliebe korrigierbar.

Der zweite Teil ist persönlich statt gemeinsam. `ohne_mich` sagt nicht
„der Ort ist schlecht", sondern „ich bin da nicht dabei". Wer dreimal
beim Wandern „Ohne mich" gestimmt hat, bei dem ist es keine Tageslaune.
Daraus lässt sich beim Planen ein Hinweis bauen, bevor die Gruppe sich
auf einen Tag festlegt, an dem einer zuhause bleibt.

Das Ganze passt in die Leitprinzipien, aber nur in einer Richtung:
**vorschlagen, nicht umbauen.** req-054 hält ausdrücklich fest, dass aus
Stimmen nie ein Status folgt. Diese Idee tastet das nicht an — sie
ändert keinen Status, keinen Plan und kein Freitextfeld. Sie legt der KI
nur mehr Kontext vor und macht ihn dem Reiseleiter sichtbar und
abschaltbar.

Und sie braucht keine neue Datenquelle, keinen neuen Dienst und keine
Lizenzprüfung: die Daten sind die eigenen.

## Skizze

**Das Profil.** Aus allen `beendet`-Runden des Accounts wird ein
kompaktes Vorlieben-Profil gerechnet — kein Modell, eine Auszählung:

- je `poi.type` die Verteilung der Stimmen über alle Reisen, als
  Zustimmungsgrad (`unbedingt` = +2, `waere_schoen` = +1, `wenn_zeit` =
  0, `lieber_nicht` = −2; `ohne_mich` zählt hier **nicht** mit, es ist
  eine persönliche Aussage)
- je `participant` dasselbe für `ohne_mich`, getrennt gehalten
- zusätzlich zwei Achsen, die sich aus den Stimmen gegen die POI-Felder
  ablesen lassen: Zustimmung gegen `kosten_cent` (teuer beliebt oder
  nicht?) und gegen `duration_min` (lieber kurz oder lang?)

**Die Schwelle.** Eine Vorliebe entsteht erst, wenn sie belegt ist:
mindestens **fünf** Stimmen eines Typs aus mindestens **zwei** Runden,
und das Ergebnis muss deutlich sein. Darunter steht nichts — ein Profil
aus drei Stimmen ist Rauschen, und Rauschen, das wie Wissen aussieht,
ist schlimmer als eine leere Zeile. Hat eine Gruppe noch keine beendete
Runde, bleibt alles wie heute (req-057, unverändert).

**Das Alter.** Jüngere Runden wiegen mehr als alte; eine Runde von vor
drei Reisen zählt weniger als die letzte. Vorlieben verschieben sich,
und die Kinder, mit denen man reist, werden älter.

**Die Ansicht.** In den Reisedetails, unter den vier Feldern aus
req-057, ein Abschnitt **„Was wir aus euren Stimmen wissen"**: je
abgeleitete Vorliebe eine Zeile in Worten, mit ihrem Beleg dahinter.

> Strand & Baden kommt bei euch gut an — 7 × „Will ich unbedingt",
> 2 × „Wäre schön", aus drei Bewertungsrunden.
> Kirchen und Museen eher nicht — 6 × „Lieber nicht" von 9 Stimmen.
> Lea ist bei Wanderungen meist nicht dabei — 3 × „Ohne mich".

Je Zeile ein Schalter, der sie für diese Reise **stummschaltet**: eine
Reise ist nicht wie die vorige, und „diesmal machen wir Kultur" muss
sich in einem Tipp sagen lassen. Darüber ein Schalter für den ganzen
Abschnitt. Was stummgeschaltet ist, geht nicht an die KI.

**Der Weg in die Suche.** Das Profil wird dem Prompt der POI-Suche
(req-057) als zusätzlicher Block beigelegt — nach den Freitextfeldern,
nicht an deren Stelle. Bei Widerspruch gewinnt das, was der Nutzer
getippt hat: steht „diesmal Museen" in „Worauf legen wir Wert", schlägt
das die abgeleitete Abneigung. Der Mensch hat das letzte Wort, die
Statistik das vorletzte. Dieselbe Reihenfolge gilt beim KI-Planen
(req-056) und im Chat (req-081).

**Die Begründung am POI.** `poi.ki_begruendung` gibt es schon. Stammt
ein Vorschlag erkennbar aus einer abgeleiteten Vorliebe, soll das darin
stehen („weil Strände bei euch bisher gut ankamen") — so wird sichtbar,
dass das Profil wirkt, und falsch Gelerntes fällt auf, statt im Prompt
zu verschwinden.

**Der Hinweis beim Verplanen.** Wird ein POI verplant (req-039), zu dem
jemand ein belegtes `ohne_mich`-Muster hat, erscheint am Programmpunkt
ein ruhiger Hinweis — kein Dialog, keine Sperre, eine Zeile: „Lea war
bei Wanderungen bisher meist nicht dabei." req-054 zeigt `ohne_mich`
heute nur für die Stimme zu *diesem* POI; neu ist der Bezug auf das
Muster über die Reisen hinweg, bevor jemand überhaupt abgestimmt hat.

**Was ausdrücklich nicht dazugehört:** kein automatisch gesetzter
Status, kein Umsortieren der POI-Liste, kein Ausfiltern von
Vorschlägen (ein unpassender Vorschlag mit Begründung ist besser als
ein verschwundener), kein Schreiben in die Freitextfelder, kein
reisenübergreifendes Profil über Accountgrenzen — die Mandantentrennung
läuft wie überall über den Account.

**Worauf das aufbaut:** auf req-054/req-063 (die Stimmen), req-057 (die
Präferenzen und der Such-Prompt), req-056 und req-081 (die anderen
beiden Stellen, an denen die KI plant). Neu ist, dass die Stimmen nach
dem Ende einer Runde nicht mehr nur Archiv sind, sondern Eingabe.
