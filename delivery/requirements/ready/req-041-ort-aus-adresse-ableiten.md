---
id: req-041
title: Ort eines POI aus Adresse oder Position ableiten
app: wegfara
area: Planung
priority: normal
created: 2026-09-04
changes: req-035
---

# Goal (Why)

Als Reiseleiter pflege ich beim POI heute drei Ortsangaben von Hand:
Ort, Adresse und Position. Das ist eine zu viel — eine Sehenswürdigkeit
oder ein Hotel hat eine Adresse, und der Ort steht schon darin. Nur wo
es keine Adresse gibt (etwas im Wald), brauche ich die Position als
alleinige Angabe.

# Function (What)

Der Ort eines POI wird nicht mehr eingegeben, sondern abgeleitet.

Im POI-Formular bleibt „Ort" sichtbar, ist aber nicht mehr eingebbar —
er zeigt an, was abgeleitet wurde.

Beim Speichern wird er ermittelt: Hat der POI eine Adresse, kommt der
Ort aus ihr. Hat er keine, wird er über die Position ermittelt. Als Ort
steht nur die Ortschaft, ohne Region und ohne Land — aus „Via Richard
Wagner 5, 84010 Ravello SA, Italien" wird „Ravello".

Widersprechen sich Adresse und Position, gewinnt die Adresse.

Lässt sich kein Ort ermitteln — die Ortssuche ist nicht erreichbar oder
liefert nichts —, bleibt der bisher gespeicherte Ort stehen und das
Speichern gelingt trotzdem. Bei einem neuen POI bleibt der Ort dann
leer; die POI-Liste zeigt seine Zeile ohne Ortsangabe.

Die Ableitung gilt für alle POIs gleich, auch für die aus einem
Google-Maps-Link. Bestehende POIs behalten ihren Ort, bis sie das
nächste Mal gespeichert werden.

# Änderung gegenüber heute (req-035)

- Das Ortsfeld ist heute eingebbar — künftig nur noch anzeigend.
- Die Ortssuche im Formular setzt heute Ort, Adresse und Position
  zusammen. Künftig setzt sie nur noch Adresse und Position; der Ort
  entsteht ausschließlich über die Ableitung.
- Der Ort zählt nicht mehr zu den von Hand geänderten Angaben, die einen
  erneuten Google-Import überstehen (req-035) — er wird ja nicht mehr
  von Hand gesetzt.

# Acceptance Criteria

- [ ] Gegeben ich lege einen POI an oder ändere ihn, wenn ich das
      Formular ansehe, dann lässt sich das Feld „Ort" NICHT beschreiben.
- [ ] Gegeben ein POI mit der Adresse „Via Richard Wagner 5, 84010
      Ravello SA, Italien", wenn ich ihn speichere, dann steht als Ort
      „Ravello".
- [ ] Gegeben ein POI mit Adresse, wenn ich ihn speichere, dann enthält
      der Ort KEINE Region und KEIN Land.
- [ ] Gegeben ein POI ohne Adresse, dessen Position ich auf der Karte in
      Ravello gesetzt habe, wenn ich ihn speichere, dann steht als Ort
      „Ravello".
- [ ] Gegeben ein POI, dessen Adresse nach Ravello und dessen Position
      nach Amalfi zeigt, wenn ich ihn speichere, dann steht als Ort
      „Ravello".
- [ ] Gegeben die Ortssuche ist nicht erreichbar, wenn ich einen POI mit
      dem gespeicherten Ort „Ravello" speichere, dann gelingt das
      Speichern und der Ort ist weiterhin „Ravello".
- [ ] Gegeben ein neuer POI ohne Adresse, für den sich kein Ort
      ermitteln lässt, wenn ich ihn speichere, dann zeigt seine Zeile in
      der POI-Liste keinen Ort und KEINEN Platzhaltertext.
- [ ] Gegeben ich wähle in der Ortssuche des Formulars den Vorschlag
      „Villa Rufolo, Ravello", wenn der Vorschlag übernommen ist, dann
      sind Adresse und Position gefüllt.
- [ ] Gegeben ein bestehender POI mit dem von Hand gepflegten Ort
      „Ravello", wenn ich nach der Umstellung die POI-Liste öffne, ohne
      ihn zu speichern, dann steht dort weiterhin „Ravello".
- [ ] Gegeben ein POI, den ich aus einem Google-Maps-Link angelegt habe,
      wenn ich ihn erneut aus demselben Link auffrische, dann wird sein
      Ort neu abgeleitet und NICHT als von Hand geändert übersprungen.

# Constraints

- Die Ortsdaten kommen von OpenStreetMap (siehe
  [stack.md](../../stack.md)). Dessen Nutzungsbedingungen begrenzen die
  Abruffrequenz — deshalb wird der Ort beim Speichern ermittelt, nicht
  bei jeder Eingabe.
- Ein Ausfall der Ortssuche darf das Speichern eines POI nie verhindern.

# Out of Scope

- Adresse und Position selbst — beide bleiben eingebbar wie heute.
- Nachträgliches Ableiten des Orts für bestehende POIs, ohne dass sie
  gespeichert werden.
- Ableiten der Adresse aus der Position oder umgekehrt.
- Anzeige des Orts an anderen Stellen als POI-Formular und POI-Liste.
