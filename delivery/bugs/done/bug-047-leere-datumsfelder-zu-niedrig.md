---
id: bug-047
app: wegfara
req: req-033
priority: normal
created: 2026-09-19
---

# Observed

Auf dem iPad sind beim Anlegen einer neuen Reise die Felder **Beginn** und
**Ende** niedriger als das Feld **Titel** darüber. Die Zeile wirkt dadurch
schief.

Sobald ein Datum eingetragen ist, springt das Feld auf die richtige Höhe
und passt wieder zu den übrigen.

# Expected

Die Datumsfelder sind genauso hoch wie die übrigen Felder der Karte —
leer wie gefüllt. Die Höhe ändert sich beim Eintragen eines Datums nicht.

# Steps

1. Auf dem iPad den Planer öffnen
2. Eine neue Reise anlegen
3. Die Felder Beginn und Ende neben dem Titel ansehen: sie sind niedriger
4. In Beginn ein Datum eintragen: das Feld springt auf die volle Höhe

# Ursache

Ein leeres `<input type="date">` hat in WebKit keinen Inhalt, an dem sich
seine Höhe bemessen ließe: `::-webkit-datetime-edit` ist leer, und mit
`padding: 0` aus [cards.module.css](../../../components/cards.module.css)
(Zeile 332) trägt es nichts zur Höhe bei. Übrig bleiben die 9 px
Innenabstand von `.input` plus eine kollabierte Zeilenhöhe. Steht ein
Datum darin, bekommt der innere Teil Inhalt, und das Feld erreicht
dieselbe Höhe wie ein Textfeld.

Das `line-height: 1.25` in Zeile 326 greift nur auf dem Feld selbst, nicht
auf dem leeren inneren Teil.

Die Höhe darf nicht vom Inhalt abhängen — sie braucht ein festes Maß, das
zu dem eines Textfelds derselben Karte passt.

# Notes

Betrifft alle Datumsfelder der Eckdaten-Karte, also auch die Bearbeitung
einer bestehenden Reise — dort fällt es nur seltener auf, weil die Felder
gefüllt sind.

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)).
