---
id: req-061
title: Kosten, Buchungsstatus und Vervollständigen aus Google
app: wegfara
area: Planung
priority: normal
created: 2026-09-10
changes: req-035
---

# Goal (Why)

Als Reiseleiter will ich beim Sammeln festhalten, was ein Ort kostet und
ob ich ihn schon gebucht habe — beides entscheidet mit, ob er in den Plan
kommt. Und ein POI, den ich über die Ortssuche angelegt habe, bleibt ohne
Bild und ohne Bewertung, obwohl Google beides kennt; das will ich auf
Knopfdruck nachholen können.

# Function (What)

**Kosten** am POI: ein Betrag in Euro **je Person**, freiwillig. Er steht
im Formular und in der POI-Box.

**Buchungsstatus** am POI, drei Zustände: **Nicht nötig** (Vorgabe),
**Offen**, **Gebucht**. Er steht im Formular und als Kennzeichen in der
POI-Box — „Nicht nötig" wird dabei nicht angezeigt, sonst trüge jeder
Strand ein Kennzeichen.

**„Aus Google vervollständigen"** im geöffneten POI-Formular: Der Ort
wird bei Google nachgeschlagen — über seine gespeicherte Google-Kennung,
sonst über Name und Position. Gefüllt wird **nur, was noch leer ist**;
was ich selbst geschrieben habe, bleibt unangetastet. Fotos kommen dazu,
sofern der POI noch keine hat.

Der Knopf erscheint bei jedem POI, unabhängig davon, woher er stammt.
Ohne Zugangsschlüssel für Google (req-028) erscheint er nicht. Findet
Google den Ort nicht oder scheitert der Abruf, sagt das Formular es —
still bleiben darf es nicht (bug-021).

Nach der Umsetzung wird [datenbank.md](../../datenbank.md) auf den neuen
Stand gebracht.

# Acceptance Criteria

- [x] Gegeben ich öffne ein POI-Formular, wenn ich es ansehe, dann gibt
      es ein Feld für die Kosten je Person.
- [x] Gegeben ich trage 12,50 als Kosten ein, wenn ich speichere und den
      POI wieder öffne, dann steht dort weiterhin 12,50.
- [x] Gegeben ein POI mit 12,50 Kosten, wenn ich die Liste ansehe, dann
      steht der Betrag in seiner Box.
- [x] Gegeben ich trage einen Buchstaben als Kosten ein, wenn ich das
      Feld verlasse, dann wird die Eingabe abgelehnt.
- [x] Gegeben ich lege einen POI an, wenn ich den Buchungsstatus ansehe,
      dann steht er auf „Nicht nötig".
- [x] Gegeben ich setze den Buchungsstatus auf „Offen", wenn ich die
      Liste ansehe, dann trägt die Box dieses Kennzeichen.
- [x] Gegeben ein POI mit Buchungsstatus „Nicht nötig", wenn ich die
      Liste ansehe, dann trägt seine Box KEIN Buchungskennzeichen.
- [x] Gegeben ein POI ohne Fotos und ohne Bewertung, wenn ich „Aus
      Google vervollständigen" wähle, dann hat er danach Fotos.
- [x] Gegeben ein POI mit dem selbst geschriebenen Kurztext „Unser
      Lieblingsplatz", wenn ich „Aus Google vervollständigen" wähle, dann
      steht dort weiterhin „Unser Lieblingsplatz".
- [x] Gegeben ein POI ohne Adresse, wenn ich „Aus Google
      vervollständigen" wähle, dann ist die Adresse danach gefüllt.
- [x] Gegeben für meinen Account ist kein Zugangsschlüssel für Google
      hinterlegt, wenn ich ein POI-Formular öffne, dann ist „Aus Google
      vervollständigen" NICHT vorhanden.
- [x] Gegeben Google findet den Ort nicht, wenn ich „Aus Google
      vervollständigen" wähle, dann sehe ich eine Meldung mit dem Grund.
- [x] Gegeben Google findet den Ort nicht, wenn ich das Formular danach
      ansehe, dann sind die Felder unverändert.
- [x] Gegeben die Umsetzung ist fertig, wenn ich
      [datenbank.md](../../datenbank.md) öffne, dann sind Kosten und
      Buchungsstatus des POI dort beschrieben.

# Constraints

- Der Google-Abruf läuft über den Zugangsschlüssel des Accounts (req-028)
  und kostet je Aufruf — deshalb nur auf Knopfdruck.
- Was aus Google kommt, gilt nicht als von Hand geändert (req-035): ein
  späteres Auffrischen darf es ersetzen.
- Der Buchungsstatus des POI ist etwas anderes als der des
  Programmpunkts (req-005) — er beschreibt den Ort, nicht den Termin.

# Out of Scope

- Kosten in die Ausgaben oder den Ausgleich übernehmen (req-029,
  req-030).
- Kosten je Reisetag oder für die ganze Reise summieren.
- Den Buchungsstatus beim Verplanen an den Programmpunkt weiterreichen.
- Andere Währungen als Euro.
- Öffnungszeiten oder Preise laufend aus Google auffrischen.
