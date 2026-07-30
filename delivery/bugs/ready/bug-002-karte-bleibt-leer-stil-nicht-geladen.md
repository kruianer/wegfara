---
id: bug-002
title: Karte bleibt leer — Ebenen werden vor dem Laden des Kartenstils angelegt
app: wegfara
area: Reise
severity: high
created: 2026-07-30
relates: req-008, bug-001
---

# Beobachtung

Im Begleiter auf https://dev.wegfara.com/go zeigt der Bereich „Karte"
weiterhin keine Karte — auch nach der Behebung von bug-001. Es
erscheinen weder Kacheln noch Marker.

# Erwartet

Der Bereich „Karte" zeigt die Kartenkacheln und die nummerierten Marker
der Programmpunkte des gewählten Reisetages (siehe req-008).

# Was bereits ausgeschlossen ist

Diese Punkte wurden geprüft und sind in Ordnung — sie sind NICHT die
Ursache:

- Die Container-Höhe aus bug-001 ist behoben. Live ausgeliefert wird
  `.app { height: 100dvh }` und `.content { flex:1; min-height:0;
  position:relative }`.
- Die Größenkorrektur beim Wechsel auf den Kartenbereich ist vorhanden.
- Das Stylesheet der Kartenbibliothek wird vollständig ausgeliefert.
- Der Kachelserver antwortet (HTTP 200 für eine Beispielkachel).
- Die Daten sind vollständig: 37 von 38 Programmpunkten haben
  Koordinaten, alle drei Reisen haben einen Hauptort mit Position.

# Ursache (Analyse)

Die Kartenebenen werden angelegt, bevor der Kartenstil geladen ist.

In `app/go/components/map-view.tsx` greift der zweite Effekt ab
Zeile 109 unmittelbar auf `map.getSource(...)` zu und ruft anschließend
`map.addSource(...)` und `map.addLayer(...)` auf. Es gibt im gesamten
Modul keine Behandlung des `load`-Ereignisses und keine Prüfung, ob der
Stil bereits geladen ist.

Die Kartenbibliothek lädt den Stil asynchron. Werden Quellen oder
Ebenen davor hinzugefügt, schlägt der Aufruf fehl. Da er im Rumpf eines
Effekts steht, reißt der Fehler die Darstellung des gesamten
Kartenbereichs mit — die Fläche bleibt leer.

# Warum die Tests das nicht bemerkt haben

`tests/mocks/maplibre-gl.ts` bildet die Kartenbibliothek nach. Dort ist
`on()` eine leere Funktion (Zeile 153), und `addSource` gelingt immer
sofort. Im Test ist der Stil damit nie „noch nicht geladen" — der
Fehler kann dort nicht auftreten. Alle Tests sind grün, obwohl die
Karte im Browser nicht funktioniert.

Der Nachbau muss diesen Zustand abbilden können, sonst bleibt die Lücke
bestehen.

# Reproduktion

1. https://dev.wegfara.com/go öffnen
2. In der unteren Navigationsleiste „Karte" antippen

Ergebnis: leere Fläche, keine Kacheln, keine Marker.

# Akzeptanzkriterien der Behebung

- [ ] Gegeben der Begleiter ist geöffnet, wenn ich „Karte" antippe,
      dann sind Kartenkacheln sichtbar.
- [ ] Gegeben der Bereich „Karte" ist geöffnet und der gewählte
      Reisetag hat vier Programmpunkte, wenn ich die Karte betrachte,
      dann sehe ich vier nummerierte Marker.
- [ ] Gegeben zwei Programmpunkte mit einem Transfer dazwischen, wenn
      ich die Karte betrachte, dann verbindet sie eine Linie.
- [ ] Gegeben der Bereich „Karte" ist geöffnet, wenn ich in der
      Tagesauswahl einen anderen Reisetag wähle, dann zeigt die Karte
      die Marker dieses Tages.
- [ ] Der Nachbau der Kartenbibliothek in den Tests bildet den Zustand
      „Stil noch nicht geladen" ab, und ein Test deckt ab, dass in
      diesem Zustand keine Ebenen angelegt werden.

# Constraints

- Die Behebung darf die in bug-001 korrigierte Container-Höhe nicht
  rückgängig machen.
