---
id: bug-065
app: wegfara
req: req-039
priority: hoch
created: 2026-10-23
---

# Observed

Im Planer, Bereich Planung: Habe ich in die Karte hineingezoomt, wird der
Ausschnitt bei **jeder** Aktion am Zeitstrahl zurückgesetzt — ich muss
jedes Mal neu hineinzoomen.

# Expected

Zoom und Mitte der Karte bleiben unberührt, während ich am Zeitstrahl
plane. Wer sich einen Ausschnitt zurechtgezogen hat, behält ihn.

# Steps

1. Planer öffnen, Bereich Planung
2. In die Karte der Tagesroute hineinzoomen, einen Ausschnitt wählen
3. Am Zeitstrahl einen POI verplanen, verschieben oder entfernen
4. Der Kartenausschnitt springt auf alle Wegpunkte zurück

# Ursache

Dasselbe Muster wie bug-048 — nur in der **anderen** Karte.

In [day-route-map.tsx](../../../app/plan/components/day-route-map.tsx)
endet `renderRoute` mit:

```
map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
```

Der Effekt, der sie aufruft (Zeile 345), hängt unter anderem an
`activities` (Zeile 364). **Jede** Planungsaktion ändert diese Liste, der
Effekt läuft erneut, und `fitBounds` rückt den Ausschnitt.

Die POI-Karte hat gegen genau das einen Merker: `framedRef` in
[poi-map.tsx](../../../app/plan/components/poi-map.tsx) bindet das Rücken
an die **Reise** statt an die sichtbare Liste (bug-048). In der
Tagesroute-Karte fehlt dieser Merker.

Auffällig: Beim Zeichnen der **Pfeile** wurde der Ausschnitt ausdrücklich
geschützt — der Kommentar bei `renderPfeile` (Zeile 239) sagt *„kein
fitBounds, kein setCenter: das Ein- und Ausschalten lässt Zoom und Mitte,
wie sie sind (bug-048)"*. Beim Zeichnen der Marker und Linien wurde es
übersehen.

# Erwartete Behebung

- Der Ausschnitt wird gerückt, wenn sich das **Gebiet** ändert: beim
  Öffnen, beim Wechsel der Reise und beim Wechsel des Reisetags — ein
  anderer Tag liegt woanders.
- Er wird **nicht** gerückt, wenn nur die Programmpunkte desselben Tages
  sich ändern: verplanen, verschieben, entfernen, Dauer ändern, eine
  andere Alternative wählen.
- Hatte ein Tag beim Öffnen noch keine Wegpunkte, darf die Karte einmal
  nachrücken, sobald die ersten eintreffen — wie es `framedOnContentRef`
  in der POI-Karte löst (bug-048).

Wie, entscheidet die Umsetzung; der Merker aus der POI-Karte ist die
naheliegende Vorlage.

# Notes

Beim Beheben ist zu prüfen, ob dieselbe Lücke in der Karte des Begleiters
steckt ([map-view.tsx](../../../app/go/components/map-view.tsx), Zeile
190) — dort gibt es ein `fitBounds`, und der Kommentar in
[go-view.tsx](../../../app/go/go-view.tsx) (Zeile 151) deutet darauf hin,
dass es beim Tages- oder Reisewechsel gewollt ist. Ob es auch bei anderen
Änderungen greift, ist offen.

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)).

# Befund

- **Tagesroute-Karte im Planer:** behoben. Der Ausschnitt ist jetzt an das
  Gebiet gebunden — Reise samt Hauptort und gewählter Reisetag —, nicht an
  die Programmpunkte. Verplanen, Verschieben, Entfernen, Dauer ändern,
  Alternative wählen und Transfers lassen Zoom und Mitte stehen. Ein Tag
  ohne Wegpunkte steht vorläufig im Hauptort und rückt einmal nach, sobald
  der erste eintrifft (wie `framedOnContentRef` in der POI-Karte).
- **Karte des Begleiters (`map-view.tsx`):** keine Lücke. Programmpunkte,
  Transfers und Hauptort sind dort Seiten-Daten, die sich bei geöffneter
  Karte nicht ändern; die Wahl einer Alternative geht nur über den
  Zeitstrahl im Tab „Plan“, und beim Wechsel auf „Karte“ wird die Karte
  ohnehin neu aufgebaut. `fitBounds` läuft dort also nur beim Öffnen und
  beim Tages- oder Reisewechsel — wie der Kommentar in `go-view.tsx`
  sagt. Nichts geändert.
