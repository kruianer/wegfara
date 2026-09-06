---
id: req-057
title: POI-Suche mit Präferenzen und Entscheidungskriterien
app: wegfara
area: Planung
priority: normal
created: 2026-09-06
changes: req-014
---

# Goal (Why)

Als Reiseleiter bekomme ich von der KI Orte vorgeschlagen, die zwar in
der Region liegen, aber nicht zu uns passen — sie weiß nicht, worauf wir
Wert legen. Und an einem Namen allein sehe ich nicht, ob ein Ort etwas
taugt: dafür brauche ich ein Foto, die Bewertung und einen Satz, worum
es geht.

# Function (What)

**Präferenzen in den Reisedetails** (req-033), neu:

- **Interessen** zum Ankreuzen: Kunst & Museen, Natur & Wandern, Essen &
  Trinken, Strand & Baden, Geschichte, Nachtleben, Shopping, Mit Kindern
- **Worauf legen wir Wert** — ein Satz in eigenen Worten, höchstens 500
  Zeichen
- **Was wir nicht wollen** — ebenso, höchstens 500 Zeichen
- **Mindestbewertung** — 0 bis 5 in Halbschritten, Vorgabe 0 (keine
  Einschränkung)

Alle vier sind freiwillig und wirken ausschließlich auf die KI-Suche.

**Die Suche** (bisher req-014) ändert sich so:

- Quelle ist **Google Places** statt OpenStreetMap — wegen Fotos und
  Bewertungen. Für alles andere (Ortssuche, Karte, Rückwärtssuche)
  bleibt OpenStreetMap die Quelle.
- Die KI berücksichtigt zusätzlich zu Suchgebiet und Typfilter alle vier
  Präferenzen.
- Orte, deren Bewertung unter der Mindestbewertung liegt, werden nicht
  vorgeschlagen.
- Ein Lauf liefert höchstens **20** Vorschläge statt zehn.

Unverändert bleibt: Gesucht wird nur innerhalb des gezeichneten
Suchgebiets, ein zweiter Lauf schlägt andere Orte vor, bereits
vorhandene POIs entstehen nicht doppelt, ohne Suchgebiet ist die Suche
gesperrt.

**Alle Vorschläge werden als POI angelegt**, wie bisher mit Status „Weiß
noch nicht" — sie erscheinen oben in der POI-Liste. Je Zeile steht:

- ein Foto des Ortes
- die Bewertung mit der Anzahl der Bewertungen („4,6 aus 1.240")
- eine kurze Beschreibung, ein bis zwei Sätze
- ein Satz, **warum** die KI ihn vorschlägt, mit Bezug auf die
  Präferenzen

**Aussortieren.** In der POI-Liste lassen sich mehrere POIs ankreuzen
und gesammelt löschen. Beim Löschen verschwinden auch die Angaben aus
Google.

Nach der Umsetzung wird [datenbank.md](../../datenbank.md) auf den
neuen Stand gebracht.

# Änderung gegenüber heute (req-014)

- Die Suche nutzt heute OpenStreetMap; künftig Google Places.
- Präferenzen gibt es heute nicht — die KI kennt nur das Suchgebiet, den
  Typfilter und den eingegebenen Wunsch.
- Ein Lauf liefert heute höchstens zehn Vorschläge, künftig zwanzig.
- In der Liste stehen heute Name, Ort und Typ; künftig zusätzlich Foto,
  Bewertung, Beschreibung und die Begründung.
- POIs lassen sich heute nur einzeln löschen (req-035).

# Acceptance Criteria

- [ ] Gegeben ich öffne die Reisedetails, wenn ich die Präferenzen
      ansehe, dann kann ich „Natur & Wandern" ankreuzen.
- [ ] Gegeben ich habe „Natur & Wandern" angekreuzt und gespeichert,
      wenn ich die Reisedetails neu lade, dann ist es weiterhin
      angekreuzt.
- [ ] Gegeben ich trage bei „Worauf legen wir Wert" 500 Zeichen ein,
      wenn ich speichere, dann wird die Reise gespeichert.
- [ ] Gegeben ich versuche 501 Zeichen einzutragen, wenn ich das Feld
      verlasse, dann wird die Eingabe abgelehnt.
- [ ] Gegeben eine neue Reise, wenn ich die Mindestbewertung ansehe,
      dann steht dort 0.
- [ ] Gegeben ein gezeichnetes Suchgebiet und die Interessen „Natur &
      Wandern", wenn ich die KI-Suche auslöse, dann erscheinen die neuen
      POIs oben in der Liste.
- [ ] Gegeben ein Lauf ist fertig, wenn ich einen neuen POI in der Liste
      ansehe, dann sehe ich zu ihm ein Foto.
- [ ] Gegeben ein neuer POI aus der Suche, wenn ich seine Zeile ansehe,
      dann steht dort die Bewertung mit der Anzahl der Bewertungen.
- [ ] Gegeben ein neuer POI aus der Suche, wenn ich seine Zeile ansehe,
      dann steht dort ein Satz, warum die KI ihn vorschlägt.
- [ ] Gegeben ich habe die Mindestbewertung auf 4,0 gesetzt, wenn ein
      Lauf fertig ist, dann hat kein neu angelegter POI eine Bewertung
      unter 4,0.
- [ ] Gegeben ich habe bei „Was wir nicht wollen" „keine Museen"
      eingetragen, wenn ein Lauf fertig ist, dann ist unter den neuen
      POIs KEIN Museum.
- [ ] Gegeben ein Lauf, wenn er fertig ist, dann sind höchstens 20 POIs
      neu angelegt.
- [ ] Gegeben ein gezeichnetes Suchgebiet, wenn ein Lauf fertig ist,
      dann liegt jeder neu angelegte POI innerhalb dieses Suchgebiets.
- [ ] Gegeben ich habe 20 neue POIs, wenn ich fünf davon ankreuze und
      „Ausgewählte löschen" wähle, dann sind genau diese fünf
      verschwunden.
- [ ] Gegeben ich habe einen POI aus der Suche gelöscht, wenn ich seine
      Foto-Adresse direkt aufrufe, dann ist das Bild NICHT mehr
      vorhanden.
- [ ] Gegeben für meinen Account ist kein Zugangsschlüssel für Google
      hinterlegt, wenn ich die KI-Suche auslösen will, dann wird sie
      NICHT ausgeführt und ich sehe den Grund.
- [ ] Gegeben ich habe kein Suchgebiet gezeichnet, wenn ich die KI-Suche
      auslösen will, dann ist sie nicht bedienbar.
- [ ] Gegeben ich löse einen zweiten Lauf aus, wenn er fertig ist, dann
      ist kein bereits vorhandener POI ein zweites Mal angelegt.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [datenbank.md](../../datenbank.md) öffne, dann sind die
      Präferenzen der Reise dort beschrieben.

# Constraints

- Die KI-Suche und der Google-Abruf laufen über die Zugangsschlüssel des
  Accounts (req-028), nie über die Umgebung. Ohne Google-Schlüssel keine
  Suche.
- Google-Daten zu speichern ist eine bewusste, vorläufige Abweichung von
  Googles Nutzungsbedingungen für den privaten Betrieb, die später auf
  einen zulässigen Weg umgestellt wird (siehe
  [stack.md](../../stack.md)). Deshalb: Was gelöscht wird, verschwindet
  vollständig — Datensatz wie Bilddatei.
- Für alle Ortsdaten außerhalb der KI-Suche bleibt OpenStreetMap die
  Quelle ([stack.md](../../stack.md)).
- Der Zugriff auf das Sprachmodell bleibt hinter der austauschbaren
  Schnittstelle in `lib/ai/`.

# Out of Scope

- Die Präferenzen bei der KI-Planung (req-056) berücksichtigen.
- Präferenzen je Teilnehmer statt je Reise.
- Öffnungszeiten oder Eintrittspreise mit abrufen.
- Bewertungstexte einzelner Besucher anzeigen.
- Den späteren Umbau weg von gespeicherten Google-Daten.
- Mehrere Fotos je POI aus der Suche.
