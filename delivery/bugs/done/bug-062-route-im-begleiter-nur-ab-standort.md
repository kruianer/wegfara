---
id: bug-062
app: wegfara
req: req-059
priority: normal
created: 2026-10-19
---

# Observed

Im Begleiter öffnet der Knopf am Transfer Google Maps **vom aktuellen
Standort zum Ziel**. Unterwegs ist das richtig. Schaue ich mir die Reise
aber vorher an, ist mein Wohnzimmer kein sinnvoller Startpunkt — ich will
die Route **von Start zu Ziel** sehen.

# Expected

Der Knopf richtet sich danach, ob der gewählte Reisetag heute ist:

- **Nicht am Reisetag** — ein Knopf, der die Route **von Start zu Ziel**
  zeigt. Kein „ab hier": Der aktuelle Standort hat mit dieser Fahrt
  nichts zu tun.
- **Am Reisetag** — zwei Knöpfe. **„Ab hier"** tritt hervor (größer,
  betonter): unterwegs ist das der Regelfall. Daneben, kleiner, die Route
  **von Start zu Ziel** — damit sich im Hotel noch ansehen lässt, wo es
  heute hingeht.

# Steps

1. Begleiter öffnen, einen Reisetag in der Zukunft wählen
2. Bei einem Transfer auf den Route-Knopf tippen
3. Google Maps öffnet mit der Route **ab dem aktuellen Standort** statt
   vom Startpunkt des Transfers

# Ursache

Beide Linkarten gibt es bereits in
[navigation.ts](../../../lib/transfers/navigation.ts):

| Funktion | Link |
|---|---|
| `buildRouteUrl(ziel, mode)` | nur Ziel → ab aktuellem Standort |
| `buildTransferRouteUrl(von, nach, mode)` | Start **und** Ziel |

Der **Planer** nutzt die zweite
([transfer-form.tsx](../../../app/plan/components/transfer-form.tsx),
Zeile 294) — dort stimmt es. Der **Begleiter** nutzt die erste
([transfer-row.tsx](../../../app/go/components/transfer-row.tsx),
Zeile 126).

Der Grund ist strukturell: `TransferRow` bekommt nur `toActivity`
übergeben
([timeline.tsx](../../../app/go/components/timeline.tsx), Zeile 77). Der
Startpunkt des Transfers ist der Komponente nicht bekannt, und das Datum
des gewählten Tages kennt auch die `timeline` nicht.

Zu durchreichen sind also zwei Dinge: der **Startpunkt** (`fromActivity`,
über `transfer.fromActivityId` auflösbar) und ob der gewählte Tag
**heute** ist.

# Erwartete Behebung

- Nicht am Reisetag: **ein** Knopf, Route von Start zu Ziel.
- Am Reisetag: **„Ab hier"** hervorgehoben, daneben kleiner die Route von
  Start zu Ziel.
- Fehlt einem Ende die Position, steht sein Name im Link — danach sucht
  Google Maps selbst (so macht es `buildTransferRouteUrl` schon).
- Das Verkehrsmittel des Transfers wird wie bisher übernommen (req-006).

Wie „hervorgehoben" aussieht, entscheidet die Umsetzung. Beide
Trefferflächen bleiben bei mindestens 44 × 44 px (siehe
[stack.md](../../stack.md)) — der Begleiter läuft am Handy.

# Notes

An wegfara ändert sich nichts an der Datenweitergabe: Übergeben wird nur
der Link, die Anwendung ruft Google nicht auf (siehe
[vision.md](../../vision.md)).

Geprüft wird bei 375 px, 768 px und 1280 px — bei 375 px müssen zwei
Knöpfe neben dem Transfer-Text Platz haben oder umbrechen.
