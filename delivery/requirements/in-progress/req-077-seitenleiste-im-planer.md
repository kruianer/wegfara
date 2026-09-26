---
id: req-077
title: Seitenleiste statt Kopfleiste im Planer
app: wegfara
area: Planung
priority: normal
created: 2026-09-26
---

# Goal (Why)

Als Reiseleiter arbeite ich am Planer auf dem iPad. Die Bereichsleiste
liegt quer über dem Kopf und nimmt Höhe weg — Höhe, die dem Zeitstrahl und
der Karte fehlt, den beiden Ansichten, in denen ich die meiste Zeit
verbringe.

Auf die Seite gestellt gibt sie diese Höhe zurück, und alle Bereiche sind
zugleich sichtbar, ohne zu schieben.

LivingGardenTwin hat denselben Weg schon genommen (dort req-070) — die
Umsetzung dieser App ist die Vorlage.

# Function (What)

## Die Leiste

Im **Planer** tritt an die Stelle der Kopfleiste eine **schmale Leiste am
linken Rand**. Sie zeigt eingeklappt nur Symbole, je eines pro Bereich:
POIs, Planung, Bewertungen, Kosten, Dokumente, Reisedetails — dazu die
Ziele, die die Kopfleiste heute schon trägt (Begleiter, Mein Bereich, bei
Bedarf die Verwaltung).

Die Einstellungen sitzen am **Fuß** der Leiste, abgesetzt von der Liste:
Sie sind der Ort, an dem man den Alltag der App verlässt.

## Aufklappen

Die Leiste lässt sich **aufklappen**; dann stehen die Beschriftungen neben
den Symbolen.

- Sie startet bei jedem Laden **eingeklappt**. Der Zustand wird nicht
  gemerkt — die Leiste ist der Weg irgendwohin, nicht der Ort, an dem man
  bleibt.
- Aufgeklappt liegt sie **über** der Seite, statt sie beiseitezuschieben:
  Der Inhalt darunter springt nicht.
- Sie klappt sich beim ersten Anzeichen zu, dass man fertig mit ihr ist:
  ein gewählter Bereich, ein Tipp daneben, Escape.

## Der Slogan

Aufgeklappt steht unter dem Namen ein **Slogan in Handschrift**, leicht
schräg gestellt — wie ein angehefteter Zettel. Er nimmt dabei nicht mehr
Höhe ein als eine gerade Zeile.

Der Text ist **„Wohin es euch zieht"** — er spielt auf den Namen an
(*wegfara*, althochdeutsch für „die Reise, das Fortziehen") und ist kurz
genug, dass er auf der aufgeklappten Leiste in eine Zeile passt.

Damit tritt er neben den bisherigen Slogan „KI · Reiseplanung", der auf
der Anmeldeseite stehen bleibt: Dort erklärt er einem Fremden, was die App
ist; in der Leiste spricht sie zu jemandem, der sie schon benutzt.

## Wo sie gilt

Nur im **Planer**. Der Begleiter (`/go`) behält seine Navigation — er ist
die Sicht für unterwegs am Handy, wo eine Leiste am Rand zu viel Breite
kostet.

Auf schmalen Bildschirmen (375 px) bleibt die Bedienung erhalten: Die
Leiste darf dort nicht so viel Breite nehmen, dass der Inhalt unbrauchbar
wird.

# Acceptance Criteria

- [x] Gegeben ich öffne den Planer auf dem iPad, wenn ich hinsehe, dann
      liegt die Navigation am linken Rand und nicht über dem Kopf.
- [x] Gegeben ich öffne den Planer, wenn ich die Leiste ansehe, dann ist
      sie eingeklappt und zeigt nur Symbole.
- [x] Gegeben die Leiste ist eingeklappt, wenn ich sie aufklappe, dann
      stehen die Beschriftungen neben den Symbolen.
- [x] Gegeben die Leiste ist aufgeklappt, wenn ich einen Bereich wähle,
      dann klappt sie zu und der Bereich öffnet sich.
- [x] Gegeben die Leiste ist aufgeklappt, wenn ich daneben tippe, dann
      klappt sie zu und es öffnet sich nichts unter dem Finger.
- [x] Gegeben die Leiste ist aufgeklappt, wenn ich Escape drücke, dann
      klappt sie zu.
- [x] Gegeben die Leiste ist aufgeklappt, wenn ich den Inhalt daneben
      ansehe, dann ist er nicht verschoben.
- [x] Gegeben ich klappe auf und lade die Seite neu, wenn ich hinsehe,
      dann ist die Leiste wieder eingeklappt.
- [x] Gegeben die Leiste ist aufgeklappt, wenn ich den Slogan ansehe,
      dann steht dort „Wohin es euch zieht" in Handschrift und leicht
      schräg.
- [x] Gegeben der Slogan steht in der Leiste, wenn ich ihn ansehe, dann
      passt er in eine Zeile und ist nicht abgeschnitten.
- [ ] Gegeben ich öffne die Anmeldeseite, wenn ich sie ansehe, dann steht
      dort weiterhin „KI · Reiseplanung".
- [ ] Gegeben ich öffne den Begleiter (`/go`), wenn ich hinsehe, dann ist
      seine Navigation unverändert.
- [x] Gegeben ich bin im Bereich Planung, wenn ich den Zeitstrahl ansehe,
      dann hat er mehr Höhe als mit der alten Kopfleiste.
- [x] Gegeben die Leiste ist eingeklappt, wenn ich ein Symbol antippe,
      dann ist die Trefferfläche mindestens 44 × 44 px (siehe
      [stack.md](../../stack.md)).
- [ ] Gegeben der Planer ist auf 375 px, 768 px und 1280 px zu sehen, wenn
      ich die Leiste bediene, dann ist sie auf allen dreien benutzbar und
      der Inhalt daneben bleibt lesbar.

# Constraints

- Die Vorlage ist LivingGardenTwin: `frontend/src/components/Sidebar.tsx`
  und `Sidebar.module.css` auf dem Beelink unter
  `~/livinggardentwin/frontend`. Übernommen wird das **Verhalten**, nicht
  der Quelltext — wegfara ist Next.js, LGT nicht.
- Die Bereiche und ihre Ziele stehen weiterhin in
  [areas.ts](../../../lib/plan/areas.ts); es kommt keiner hinzu und
  keiner fällt weg.
- Ein noch nicht gebauter Bereich verhält sich wie heute
  (`NOCH_NICHT_HINWEIS`, bug-033) — er wird nicht stumm geschluckt.
- Der abgeschaltete Zustand eines Eintrags muss erkennbar bleiben, ohne
  unlesbar zu sein (vgl. bug-051).
- Die Handschrift-Schrift wird mitgeliefert und nicht von einem fremden
  Dienst geladen (siehe [stack.md](../../stack.md)); LGT verwendet
  „Caveat" mit `Segoe Script` und `Bradley Hand` als Rückfall.
- Eingeklappt gibt es keinen Text: Der Name des Bereichs muss trotzdem für
  Vorleseprogramme und als Tooltip vorhanden sein.

# Out of Scope

- Die Navigation des Begleiters (`/go`).
- Den Zustand der Leiste über das Neuladen hinaus merken.
- Eine Uhr in der Leiste (LGT hat eine; wegfara braucht sie nicht).
- Neue Bereiche einführen oder bestehende umbenennen.
- Die Farbwelt ändern (req-015).
- Mehrsprachigkeit — wegfara ist deutsch.
