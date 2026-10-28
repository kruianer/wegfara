---
id: req-103
title: Gedruckter Reiseplan — Karten, Titelfoto, Übersichtsseite und als Modul im Planer
app: wegfara
area: Planung
priority: normal
changes: req-080, req-018
created: 2026-10-28
---

# Goal (Why)

Der gedruckte Reiseplan (req-080) hat vier Schwächen, die beim Ansehen
des fertigen Hefts auffielen:

**Das Titelfoto wird nicht gewählt, sondern gefunden.**
`lib/druck/deckblatt.ts:47` nimmt das erste Foto der ersten Station, die
eines hat. Ist das Hotel die erste Station, steht ein Zimmerfoto auf dem
Titel. Das Heft soll die Teilnehmer begeistern — dann muss das stärkste
Bild nach vorn.

**Es gibt keine Karte.** req-080 hat sie ausdrücklich ausgeklammert („ein
Kartenbild auf Papier wäre ein eigenes Thema"). Ohne Karte sieht man
nicht, wo die Reise verläuft — die Angabe, auf die man bei einem Reiseplan
zuerst schaut.

**Es gibt keine Übersicht.** Nach dem Deckblatt folgt gleich Tag 1. Was
die Reise als Ganzes ist, steht nirgends.

**Der Plan öffnet einen eigenen Browser-Reiter.** Er ist damit kein Teil
des Planers, sondern etwas daneben — obwohl er zur Reise gehört wie die
Kosten oder die Dokumente.

Entwurf: `delivery/design/reiseplan-druck/deckblatt-und-summary.mockup.html`

# Function (What)

## 1. Das Titelfoto lässt sich wählen

In den **Reisedetails** — nicht im Druck-Bereich: Das Titelfoto ist eine
Angabe zur Reise wie Titel, Zeitraum und Beschreibung.

Drei Quellen:

- **Aus der Reise**: alle Fotos der POIs im Gitter, jedes mit seiner
  Herkunft („1 · Guggenheim"), damit man weiss, was man wählt. KI-Bilder
  sind als solche gekennzeichnet (req-072).
- **Hochladen**: ein eigenes Bild, das zu keinem POI gehört.
- **Von der KI erzeugen** (req-072), wenn kein gutes dabei ist.

**Ohne Wahl bleibt es, wie es ist**: das erste Foto der ersten Station.
Niemand muss etwas tun, damit der Plan funktioniert — die Wahl ist eine
Verbesserung, keine Pflicht.

## 2. Karten im Heft

**Zwei Karten, beide mit echten Kartenkacheln** in hellen Farben — nicht
die dunklen des Planers.

### Die Übersichtskarte (neue Seite 2)

Sie zeigt die ganze Reise. **Die Transfers sind eingezeichnet, je Tag in
einer anderen Farbe** — so liest man die Reise als Folge von Tagen, nicht
als Punktwolke. Eine Legende sagt, welche Farbe welcher Tag ist.

**Der Ausschnitt richtet sich nach den Stationen, nicht nach den
Transfers.** Das ist die Regel aus req-018:

> „Der Kartenausschnitt richtet sich weiterhin nach den Programmpunkten
> des Tages — führt eine Anreiselinie darüber hinaus, ragt sie aus dem
> sichtbaren Bereich heraus."

Damit löst sich die An- und Abreise von selbst: Wer 800 km mit dem Auto
anreist, hat eine Linie, die am Rand aus dem Bild läuft — genau wie ein
Flug. **Das Verkehrsmittel entscheidet nicht**, nur die Lage im
Ausschnitt. Eine Regel „Flug und Bahn weglassen" wäre falsch: Dieselbe
Autostrecke wäre einmal Anreise und einmal Tagesweg.

Was im Ausschnitt liegt, ist **durchgezogen**; was hinausläuft,
**gestrichelt**.

### Die Tageskarte (auf jeder Tagesseite)

Oben, direkt unter dem Titel: Sie ordnet, was danach kommt. **Flach über
die Breite**, etwa ein Fünftel der Seite — mehr würde den Stationen den
Platz nehmen, und die sind der Inhalt.

Sie zeigt **nur diesen Tag**, in seiner Tagesfarbe. Keine anderen Tage,
keine graue Umgebung; sonst wäre es eine kleine Übersichtskarte.

Die Nummern sind die **Reihenfolge des Tages** (1, 2, 3 …), nicht die
POI-Nummern: Hier geht es um den Ablauf.

**Die Verkehrsmittel sind unterscheidbar.** Ein Weg zu Fuss sieht anders
aus als einer mit dem Bus oder dem Auto — über die Strichart, nicht über
die Farbe (die gehört dem Tag):

| Mittel | Linie |
|---|---|
| zu Fuss, Rad | gepunktet |
| Bus, Bahn, Fähre, Boot | kurz gestrichelt |
| Auto | durchgezogen |

Eine Legende am Fuss der Tageskarte nennt die drei Arten.

### Die Tagesfarben

Sieben Farben, geprüft: alle über **4,5:1** auf dem Kartengrund und
bewusst **unterschiedlich hell**, nicht nur unterschiedlich bunt — wer das
Heft schwarzweiss druckt, muss die Linien trotzdem unterscheiden können.

Hat eine Reise mehr als sieben Tage, **wiederholen sich die Farben**.
Dass zwei weit auseinanderliegende Tage dieselbe Farbe tragen, ist
weniger schlimm als eine achte Farbe, die sich von keiner unterscheidet.

## 3. Die Übersichtsseite (neue Seite 2)

Unter der Übersichtskarte:

- **Je Reisetag eine Zeile**: Datum, eine Überschrift, die wichtigsten
  Orte und die Zahl der Stationen.
- **An- und Abreisetage sind markiert** — sie sind halbe Tage, und die
  Reise nimmt die Zeit.
- **Drei Zahlen** am Fuss: Stationen, vor Ort gefahrene Kilometer,
  geplante Kosten.

**Die Kilometer stehen nur, wenn sie stimmen können.** Sie kommen aus
`distanceKm` der Transfers (req-052); fehlen Transfers an einem Tag, wäre
die Zahl zu klein — und das ist schlimmer als keine Zahl. Dann nimmt eine
andere Zahl ihren Platz (etwa die Zahl der Gegenden).

### Die Überschriften je Tag kommen von der KI

„Guggenheim und Altstadt" statt „Guggenheim-Museum, Casco Viejo, Puente
colgante". Das ist genau, was eine KI gut kann, und von Hand würde es
niemand tun.

Mit drei Bedingungen:

- **Einmal erzeugt, nicht bei jedem Druck.** Auf Knopfdruck, das Ergebnis
  wird gespeichert. Sonst kostet jeder Ausdruck Geld und das Heft liest
  sich jedes Mal anders.
- **Änderbar.** Was die KI schreibt, ist ein Vorschlag. Wer eine
  Überschrift überschreibt, behält sie — die KI rührt sie nicht mehr an.
- **Es muss ohne gehen.** Ohne Zugangsschlüssel (req-028), ohne Netz oder
  bei einem Fehlschlag stehen die Orte des Tages verbunden da. Der Plan
  ist nie kaputt, nur weniger schön (vgl. bug-067).

**Die Zahlen bekommt die KI nicht.** Stationen, Kilometer und Kosten
kommen aus den Daten. Eine KI, die Summen schätzt, ist ein Risiko ohne
Gewinn.

## 4. Der Plan wird ein Bereich des Planers

Statt eines eigenen Browser-Reiters wird „Drucken" ein **Bereich** wie
POIs, Planung oder Kosten — in der Seitenleiste, mit eigenem Symbol
(beides gibt es schon: `DruckIcon` und der Eintrag im Fuss).

Darin stehen die Vorschau und ein Knopf zum Drucken. Der Druck selbst
bleibt der des Browsers (`@media print`), wie req-080 es gesetzt hat.

**Die eigene Adresse bleibt bestehen.** Wer den Plan verschicken oder
eigenständig öffnen will, kann das weiter — der Bereich ist der
gewöhnliche Weg, nicht der einzige.

# GUI

- Entwurf: `delivery/design/reiseplan-druck/deckblatt-und-summary.mockup.html`
- Verbindlichkeit: eng folgen bei Aufbau und Anordnung. Die Farbwelt des
  Hefts bleibt die aus req-080 (Mitternachtsblau, warmes Rot, Safran).
- Die Kartenkacheln sind **hell**. Die des Planers sind dunkel und auf
  Papier unbrauchbar (req-080: „braucht andere Kacheln als der dunkle
  Planer").
- Die Tagesfarben stehen als benannte Werte an einer Stelle, mit ihrem
  geprüften Kontrast im Kommentar.
- Der Bereich „Drucken" nutzt dieselbe Seitenleiste und dasselbe Gerüst
  wie die übrigen Bereiche.
- Bei 1024, 1280 und 1920 px gelten die vier Regeln aus `stack.md` für
  die Vorschau im Planer. Das Heft selbst ist A4 hoch, randlos.

# Acceptance Criteria

- [x] Gegeben die Reisedetails, wenn ich sie ansehe, dann gibt es ein
      Feld „Titelfoto" mit den Fotos der Reise zur Wahl.
- [x] Gegeben ich wähle das Foto des Guggenheim, wenn ich den Plan
      ansehe, dann steht es auf dem Deckblatt.
- [x] Gegeben ich habe kein Titelfoto gewählt, wenn ich den Plan ansehe,
      dann steht dort das erste Foto der ersten Station — wie bisher.
- [x] Gegeben ich lade ein eigenes Bild hoch, wenn ich den Plan ansehe,
      dann steht es auf dem Deckblatt.
- [x] Gegeben ein KI-Bild, wenn ich es im Gitter ansehe, dann ist es als
      solches gekennzeichnet.
- [x] Gegeben der gedruckte Plan, wenn ich Seite 2 ansehe, dann sehe ich
      eine Karte der ganzen Reise.
- [x] Gegeben eine Reise mit sechs Tagen, wenn ich die Übersichtskarte
      ansehe, dann hat jeder Tag seine eigene Linienfarbe und eine
      Legende nennt sie.
- [x] Gegeben eine Anreise von 800 km mit dem Auto, wenn ich die
      Übersichtskarte ansehe, dann umfasst der Ausschnitt die Stationen
      vor Ort und die Anreiselinie läuft am Rand hinaus.
- [x] Gegeben eine Anreise mit dem Flugzeug, wenn ich die
      Übersichtskarte ansehe, dann verhält sie sich genauso.
- [x] Gegeben eine Strecke, die aus dem Ausschnitt läuft, wenn ich sie
      ansehe, dann ist sie gestrichelt; eine Strecke im Ausschnitt ist
      durchgezogen.
- [x] Gegeben eine Reise mit neun Tagen, wenn ich die Übersichtskarte
      ansehe, dann wiederholen sich die Farben ab dem achten Tag.
- [x] Gegeben eine Tagesseite, wenn ich sie ansehe, dann steht oben eine
      Karte nur dieses Tages in seiner Farbe.
- [x] Gegeben ein Tag mit einem Weg zu Fuss und einem mit dem Auto, wenn
      ich die Tageskarte ansehe, dann sind die beiden Linien an ihrer
      Strichart zu unterscheiden.
- [x] Gegeben die Tageskarte, wenn ich sie ansehe, dann nennt eine
      Legende die drei Arten von Verkehrsmitteln.
- [x] Gegeben eine Tageskarte, wenn ich die Nummern ansehe, dann sind es
      1, 2, 3 … in der Reihenfolge des Tages.
- [x] Gegeben Seite 2, wenn ich sie ansehe, dann steht je Reisetag eine
      Zeile mit Datum, Überschrift, Orten und der Zahl der Stationen.
- [x] Gegeben der erste und der letzte Reisetag, wenn ich die Übersicht
      ansehe, dann sind sie als An- und Abreisetag erkennbar.
- [x] Gegeben alle Tage haben Transfers mit Entfernung, wenn ich Seite 2
      ansehe, dann stehen die gefahrenen Kilometer da.
- [x] Gegeben an einem Tag fehlen die Entfernungen, wenn ich Seite 2
      ansehe, dann stehen dort KEINE Kilometer, sondern eine andere Zahl.
- [x] Gegeben ein Zugangsschlüssel für die KI, wenn ich die Überschriften
      erzeugen lasse, dann steht je Tag eine.
- [x] Gegeben ich habe eine Überschrift von Hand geändert, wenn ich die
      KI erneut erzeugen lasse, dann bleibt meine stehen.
- [x] Gegeben kein Zugangsschlüssel, wenn ich Seite 2 ansehe, dann stehen
      je Tag die Orte verbunden — und der Plan ist vollständig.
- [ ] Gegeben die Seitenleiste des Planers, wenn ich „Drucken" antippe,
      dann öffnet sich der Plan als Bereich im Planer, ohne neuen
      Browser-Reiter.
- [ ] Gegeben der Bereich „Drucken", wenn ich ihn ansehe, dann gibt es
      einen Knopf zum Drucken.
- [ ] Gegeben die Adresse des Plans, wenn ich sie direkt aufrufe, dann
      erscheint er wie bisher.

# Constraints

- **Die Tagesfarben stehen an einer Stelle**, als benannte Werte mit
  geprüftem Kontrast. Sie werden nicht in CSS-Dateien verteilt
  (vgl. req-082).
- **Der Ausschnitt entscheidet, nicht das Verkehrsmittel.** Die Regel aus
  req-018 wird übernommen, nicht durch eine eigene ersetzt. Eine Liste
  „diese Mittel zählen, jene nicht" darf nicht entstehen.
- Das gewählte Titelfoto steht an der **Reise**, nicht am POI: Es ist eine
  Angabe über die Reise. Ein hochgeladenes Bild liegt in der
  Bildablage wie die übrigen (`IMAGE_DIR`), nicht in der Datenbank.
- Wird der gewählte POI oder sein Foto entfernt, fällt das Titelfoto auf
  die Vorgabe zurück — es zeigt niemals ins Leere.
- Die KI-Überschriften werden **gespeichert**, nicht bei jedem Aufbau der
  Seite erzeugt. Eine von Hand geänderte wird als solche gekennzeichnet,
  damit das erneute Erzeugen sie nicht überschreibt.
- Der Bereich „Drucken" kommt zu `PLAN_AREAS` (`lib/plan/areas.ts`) und
  gilt als bedienbar (`SWITCHABLE_PLAN_AREAS`). Der Eintrag im Fuss der
  Seitenleiste entfällt dafür — er stünde sonst zweimal.
- Die Vorschau im Planer und das gedruckte Heft nutzen **dasselbe
  Gerüst**. Es entsteht keine zweite Fassung des Plans.
- Die Kartenkacheln müssen auch ohne Netz etwas zeigen: Fällt die
  Kachelquelle aus, steht die Karte leer mit den Nadeln darauf, und der
  Plan bleibt druckbar.
- Die Tests zu req-080 sind **anzupassen, nicht zu löschen**.

# Out of Scope

- Den Bildausschnitt des Titelfotos wählen („welcher Teil des Fotos").
  Ein Hochkantfoto wird beschnitten; das ist ein eigenes Thema.
- Mehr als ein Titelfoto oder ein Bild je Tag.
- Die Karte im Planer ändern (dunkle Kacheln bleiben dort richtig).
- Serverseitig ein PDF erzeugen. Der Weg über den Browser bleibt
  (req-080).
- Die Kostenseite und die Stationen-Layouts L1–L5 (req-080).
- Die Übersichtsseite bei sehr langen Reisen zweispaltig setzen. Bei
  vierzehn Tagen wird die Liste lang — eigenes Thema.
- Das Kennzeichen „Nebenstation" am Programmpunkt (req-080, offen).
