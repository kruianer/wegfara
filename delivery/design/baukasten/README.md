# Seiten-Mockups aus dem Baukasten (req-091)

Je Seite der App eine HTML-Datei — mit echten Inhalten und **ohne eigenes
CSS**. Zum Ansehen die Datei im Browser öffnen (kein Server nötig) und das
Fenster auf 375, 768 und 1280 px ziehen.

## Die eiserne Regel

Ein Mockup bindet `baukasten.css` ein und sonst nichts: kein `<style>`, kein
`style="…"`, keine Klasse, die nicht im Baukasten steht.

Fehlt ein Baustein, wird er **im Katalog ergänzt** — in
`app/plan/baukasten/bausteine.module.css` (Planer) oder
`app/plan/baukasten/begleiter-bausteine.module.css` (Begleiter), gezeigt in
`app/plan/baukasten/seiten-bausteine.tsx` und eingetragen in
`lib/design/baukasten.ts`. Danach:

```
npm run baukasten
```

Das schreibt `baukasten.css` und `pruef.js` neu. Beide sind **erzeugt** —
nie von Hand ändern; `npm test` meldet, wenn sie nicht mehr zu den Quellen
passen.

## Die Prüfung im Mockup

Jedes Mockup lädt `pruef.js`. Es öffnet die Seite unsichtbar in drei Rahmen
(375, 768, 1280 px), prüft sie gegen die vier Regeln aus `stack.md` —
dieselben, gegen die `tests/e2e/screen-check.ts` die App prüft
(`lib/design/bildschirm-regeln.ts`) — und zeigt unten rechts „OK“ oder die
Verstöße mit Regel und Breite. Ein Klick auf die Anzeige klappt die Liste ein.

Zustände ohne eigene Datei stellt der Hash her:

- `#zustand=name` zeigt die Elemente mit `data-zustand="name"` (z.B. einen
  offenen Dialog),
- `#klick=id` klickt das Element mit dieser id.

Ändert sich der Hash, prüft das Mockup neu.

## Die Mockups

Welche es gibt und was sie zeigen, steht in `lib/design/mockups.ts`. Die
Planer-Mockups sind dunkel und zeigen unter 768 px den Hinweis auf den
Begleiter (req-088); die Begleiter-Mockups sind hell (Thema „Hell“) und
stehen ab 768 px als Spalte in der Mitte; die gemeinsamen Seiten tragen wie
in der App die Farbwelt des Planers.

Gefüllt sind sie mit der Reise „30 Johr zämma – Rothenburg“ (wie der
gedruckte Reiseplan, req-080). Dazu kommen absichtlich die unbequemen Fälle:
Tag 1 hat zehn Programmpunkte (der gedruckte Plan zeigt sechs — vier
Rothenburger Stationen sind dazugekommen, darunter das Kriminalmuseum mit
sehr langem Namen), eine Options-Gruppe, fünfstellige Beträge und leere
Zustände.

Die Mockups ersetzen die Vorlagen nicht: `delivery/design/planer/Reiseplaner
v4.dc.html` und `delivery/design/design 1.0/Reise Companion.dc.html` bleiben
die Herkunft.
