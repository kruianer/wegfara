---
id: req-100
title: POI-Status kürzer benennen
app: wegfara
area: Planung
priority: normal
changes: req-014, req-054, req-063, req-097
created: 2026-10-28
---

# Goal (Why)

Die fünf Namen des POI-Status sind zu lang für die Oberfläche und zum
Teil unpräzise:

| heute | künftig |
|---|---|
| Gesetzt | **Fix** |
| Wahrscheinlich | **Alternative** |
| Weiß noch nicht | **Offen** |
| Wenn wir Zeit haben | **Warteliste** |
| Auf keinen Fall | **Nein** |

Gemessen bei 11 px Schrift braucht das längste heute rund **109 px**, das
längste künftig **63 px**. In der schmalen POI-Liste aus req-097 ist das
der Unterschied zwischen „passt" und „passt nicht".

**Die neuen Namen sind nicht nur kürzer, sondern treffender.**
„Alternative" sagt genauer als „Wahrscheinlich", worum es geht: ein Ort,
der statt eines anderen in Frage kommt. „Warteliste" beschreibt besser
als „Wenn wir Zeit haben", was mit dem Ort geschieht.

**Dazu löst es eine echte Verwechslung.** „Wenn wir Zeit haben" ist heute
**gleichzeitig** der Name eines POI-Status (`lib/pois/status-meta.ts:21`)
**und** der Name einer Stimme in der Bewertungsrunde
(`lib/bewertungen/types.ts:36`). Zwei verschiedene Dinge, derselbe Text —
das Glossar in `stack.md:398` warnt ausdrücklich davor, sie zu
verwechseln. Mit „Warteliste" ist die Verwechslung weg.

# Function (What)

Die fünf Namen werden **überall** ersetzt, nicht nur in der Liste.

Zwei Namen für dasselbe wären schlimmer als lange Namen: Wer im Formular
„Weiß noch nicht" wählt und in der Liste „Offen" liest, muss erst lernen,
dass es dasselbe ist.

## Wo sie vorkommen

Alle Stellen lesen aus `POI_STATUS_LABEL` (`lib/pois/status-meta.ts`),
deshalb genügt eine Änderung an der Quelle. Betroffen sind:

- die **POI-Liste** und ihr Filter (req-060)
- das **POI-Formular** (req-035)
- die **Karte**, in ihrer Statusauswahl (req-013)
- die **POI-Auswahl der Planung** (req-083)
- der Bereich **Bewertungen** (req-063)
- die **KI-Planung** — sie nennt den Status im Auftrag an das Modell
  (`lib/plan/ki-planung.ts:162`)
- der **Chat**, wenn er die POIs der Reise liest (req-093,
  `lib/chat/plan-leser.ts:155`)

## Was sich nicht ändert

**Die Schlüssel bleiben.** In der Datenbank heissen die Werte weiter
`gesetzt`, `wahrscheinlich`, `weiss_nicht`, `wenn_zeit`,
`auf_keinen_fall` (`migrations/0010_poi.sql`). Es gibt **keine
Migration**: Nur die Beschriftung ändert sich, nicht der Wert.

Das ist Absicht. Ein Schlüssel `fix` statt `gesetzt` wäre eine Migration
über alle POIs aller Accounts, für null Gewinn — niemand sieht ihn.

**Die Stimmen der Bewertungsrunde bleiben, wie sie sind** (Will ich
unbedingt, Wäre schön, Wenn wir Zeit haben, Lieber nicht, Ohne mich). Sie
sind etwas anderes als der Status, und ihre Namen passen.

**Die Farben bleiben** (`POI_STATUS_COLOR`) und ebenso die Reihenfolge
(`POI_STATUSES`) und die beim Anlegen vorgewählte Vorgabe
(`weiss_nicht`, künftig „Offen").

## Das Glossar

`delivery/stack.md` nennt im Glossar die Stimmen und die Zustimmung mit
ihren Namen. Dort ist der Hinweis nachzuziehen, dass „Warteliste" (Status
eines Orts) und „Wenn wir Zeit haben" (Stimme einer Person) verschiedene
Dinge sind — bisher trugen sie denselben Namen, weshalb der Hinweis
nötig war.

# GUI

- Es ändert sich **kein Aufbau und kein Element**, nur fünf Wörter.
- In der POI-Liste und der POI-Auswahl werden die Pillen dadurch
  schmaler; die Spaltenbreiten aus req-097 und req-099 rechnen damit.
- Kontrast und Tippziele bleiben unberührt.

# Acceptance Criteria

- [ ] Gegeben ein POI mit Status `gesetzt`, wenn ich ihn irgendwo in der
      App ansehe, dann steht dort „Fix".
- [ ] Gegeben ein POI mit Status `wahrscheinlich`, dann steht dort
      „Alternative".
- [ ] Gegeben ein POI mit Status `weiss_nicht`, dann steht dort „Offen".
- [ ] Gegeben ein POI mit Status `wenn_zeit`, dann steht dort
      „Warteliste".
- [ ] Gegeben ein POI mit Status `auf_keinen_fall`, dann steht dort
      „Nein".
- [ ] Gegeben das POI-Formular, wenn ich die Statusauswahl öffne, dann
      stehen die fünf neuen Namen darin.
- [ ] Gegeben die Statusauswahl der Karte (req-013), dann stehen dort die
      neuen Namen.
- [ ] Gegeben der Bereich „Bewertungen", wenn ich ihn ansehe, dann stehen
      die neuen Namen beim Status der POIs.
- [ ] Gegeben die Bewertungsrunde, wenn ich meine Stimme abgebe, dann
      heissen die fünf Stimmen unverändert „Will ich unbedingt", „Wäre
      schön", „Wenn wir Zeit haben", „Lieber nicht", „Ohne mich".
- [ ] Gegeben ich lege einen POI an, wenn ich das Formular öffne, dann ist
      „Offen" vorgewählt.
- [ ] Gegeben ich frage den Chat nach den POIs der Reise (req-093), dann
      nennt er die neuen Namen.
- [ ] Gegeben die Datenbank, wenn ich die Werte der Spalte `status`
      ansehe, dann heissen sie unverändert `gesetzt`, `wahrscheinlich`,
      `weiss_nicht`, `wenn_zeit`, `auf_keinen_fall`.
- [ ] Gegeben ein POI, der vor dieser Änderung angelegt wurde, wenn ich
      ihn öffne, dann trägt er denselben Status wie vorher — nur anders
      benannt.

# Constraints

- Geändert wird **allein** `POI_STATUS_LABEL` in
  `lib/pois/status-meta.ts`. Alle Stellen lesen daraus; steht ein Name
  irgendwo fest im Quelltext, ist das ein Fehler und wird dort behoben.
- **Keine Migration.** Die Schlüssel in der Datenbank bleiben; sie sind
  nirgends sichtbar.
- Die Stimmen in `lib/bewertungen/types.ts` bleiben unberührt. Sie sind
  ein anderer Begriff.
- `POI_STATUS_COLOR`, `POI_STATUSES` und
  `DEFAULT_MAP_VISIBLE_STATUSES` bleiben unverändert.
- Das Glossar in `delivery/stack.md` ist nachzuziehen, besonders der
  Hinweis zur Unterscheidung von Status und Stimme.
- Tests, die die alten Namen im Text erwarten, sind **anzupassen, nicht
  zu löschen**.

# Out of Scope

- Die Schlüssel in der Datenbank umbenennen.
- Die Stimmen der Bewertungsrunde umbenennen.
- Die Farben oder die Reihenfolge der Status ändern.
- Einen Status hinzufügen oder entfernen.
- Das Aussehen der Statuspille — das sind req-097 und req-099.
