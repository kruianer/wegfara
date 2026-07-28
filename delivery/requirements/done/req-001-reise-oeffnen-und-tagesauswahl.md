---
id: req-001
title: Reise öffnen und Tag auswählen
app: wegfara
area: Reise
priority: high
created: 2026-07-28
---

# Ziel (Warum)

Als Reisender will ich unterwegs meine Reise öffnen und sehen, welcher
Reisetag gerade dran ist. Das ist der Einstieg in den Begleiter — ohne
ihn lässt sich später kein Programmpunkt, keine Ausgabe und keine
Meldung einem Tag zuordnen.

# Funktion (Was)

Der Begleiter zeigt oben die aktuell geöffnete Reise mit Titel und
Zeitraum. Ein Klick darauf öffnet eine Liste aller Reisen; jede zeigt
Name, Zeitraum und ihren Status (Aktiv, Geplant, Beendet). Die Auswahl
einer Reise öffnet sie.

Unter dem Kopfbereich steht die Tagesauswahl: ein Element je Reisetag,
waagrecht scrollbar, mit Datum und Wochentag. Genau eines ist als
gewählt markiert; ein Klick wechselt die Auswahl.

Der Status einer Reise ergibt sich aus ihrem Zeitraum im Vergleich zum
heutigen Datum und wird nicht getrennt gepflegt.

Es gibt vorerst genau einen Account: Uwe Kremmel, uwe@kremmel.org. Alle
Reisen gehören ihm; er gilt als angemeldet.

Jede Reise trägt außerdem einen Hauptort mit geografischer Position. Er
wird in dieser Ansicht nicht angezeigt, dient aber als Ortsbezug für
darauf aufbauende Anzeigen.

Für die Erprobung existieren drei Reisen:
- „Süditalien Rundreise", 18.–23.07.2026, Hauptort Amalfi
- „Wien Städtereise", 09.–11.10.2026, Hauptort Wien
- „Alpen-Adria-Radtour", 25.–31.05.2026, Hauptort Villach

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`
  (Handover-Dokument) sowie die Screenshots im selben Ordner
- Verbindlichkeit: eng folgen. Farben, Schriften, Abstände und Radien
  werden übernommen; abweichen nur, wo die Vorlage nichts sagt.
- Betroffen sind aus der Vorlage: Kopfbereich mit Reise-Umschalter,
  Reise-Liste, Tagesauswahl und die Navigationsleiste am unteren Rand.
- Die Navigationsleiste wird mit allen fünf Einträgen dargestellt; nur
  „Plan" ist bedienbar.
- Der Kopfbereich zeigt in diesem Requirement kein Wetter.

# Akzeptanzkriterien

- [x] Gegeben die drei Reisen und heute ist der 20.07.2026, wenn ich den
      Begleiter öffne, dann steht „Süditalien Rundreise" im Kopfbereich.
- [x] Gegeben die geöffnete Reise „Süditalien Rundreise", wenn ich den
      Kopfbereich betrachte, dann steht dort „18. – 23. Juli 2026".
- [x] Gegeben der Begleiter ist geöffnet, wenn ich auf den Reisetitel
      klicke, dann erscheint eine Liste mit genau drei Reisen.
- [x] Gegeben die Reiseliste ist offen und heute ist der 20.07.2026,
      wenn ich sie betrachte, dann trägt „Wien Städtereise" die
      Kennzeichnung „Geplant".
- [x] Gegeben die Reiseliste ist offen, wenn ich „Wien Städtereise"
      wähle, dann steht „Wien Städtereise" im Kopfbereich.
- [x] Gegeben die geöffnete Reise „Wien Städtereise" (09.–11.10.2026),
      wenn ich die Tagesauswahl betrachte, dann sehe ich genau drei
      Einträge.
- [x] Gegeben die geöffnete Reise „Süditalien Rundreise" und heute ist
      der 20.07.2026, wenn ich die Tagesauswahl betrachte, dann ist der
      Eintrag für den 20.07.2026 als gewählt markiert.
- [x] Gegeben die geöffnete Reise „Süditalien Rundreise", wenn ich den
      Eintrag für den 22.07.2026 anklicke, dann ist dieser als gewählt
      markiert.
- [x] Gegeben ein Eintrag der Tagesauswahl, wenn ich ihn betrachte, dann
      erscheint dort KEINE Ortsangabe.
- [x] Gegeben die geöffnete Reise „Süditalien Rundreise", wenn ich den
      Kopfbereich betrachte, dann erscheint dort KEIN Hauptort.
- [x] Gegeben die Navigationsleiste, wenn ich „Karte" anklicke, dann
      wechselt die Ansicht NICHT.

# Constraints

- Der Account ist vorerst fest hinterlegt (Uwe Kremmel,
  uwe@kremmel.org). Eine Anmeldung findet nicht statt; der Nutzer gilt
  als angemeldet.
- Die Reise wird technisch über eine UUID identifiziert, nicht über eine
  fortlaufende Nummer.

# Nicht Teil dieses Requirements

- Anmeldung, Passkey, Einladung weiterer Teilnehmer
- Programmpunkte, Zeitstrahl, Live-Status und alles, was unter einem
  Reisetag steht
- Wetteranzeige im Kopfbereich
- Die Bereiche Karte, Kosten, Meldungen und Concierge
- Anlegen, Ändern oder Löschen von Reisen durch den Nutzer
- Themenauswahl (Hell/Dunkel und die weiteren Farbwelten)
- Verwaltung mehrerer Accounts
