---
id: bug-060
app: wegfara
req: req-004
priority: normal
created: 2026-10-17
---

# Observed

Der E2E-Test „Begleiter: nach dem Neuladen steht die gewählte Option
noch" (`tests/e2e/begleiter.e2e.ts:19`) scheitert gelegentlich im
Prod-Deploy. Am 17.10. hat er einen Deploy abgebrochen — 18 von 19 E2E
grün, dieser rot:

```
waiting for getByRole('button', { name: 'Option 2 von 2' })
  34 × locator resolved to <button aria-pressed="false" …>
     - unexpected value "false"
```

Die Auswahl wird also getroffen (der Test kommt bis Zeile 62), ist nach
dem Neuladen aber wieder auf der ersten Alternative.

# Expected

Eine gewählte Alternative überdauert das Neuladen — zuverlässig, nicht
nur meistens.

# Steps

1. Im Begleiter eine Options-Gruppe öffnen (zwei Programmpunkte zur
   gleichen Zeit, req-004)
2. Die zweite Alternative wählen
3. **Sofort** neu laden
4. Gelegentlich steht wieder die erste Alternative

Reproduzierbar ist es schlecht — es hängt davon ab, wie schnell das
Neuladen auf das Speichern folgt. Auf dem belasteten Beelink tritt es
auf, lokal kaum.

# Ursache

Eine Wettlaufsituation in
[go-view.tsx](../../../app/go/go-view.tsx) (Zeilen 173–174):

```
setOptionSelections((prev) => ({ ...prev, [groupKey(group)]: activityId }));
void saveOptionSelection(
```

Die Anzeige wird **sofort** umgestellt, das Speichern läuft mit `void`
daneben — ohne dass jemand auf sein Ende wartet. Folgt das Neuladen
schnell genug, ist der Schreibvorgang noch unterwegs; die Seite liest
dann den alten Stand aus der Datenbank.

Der Lesepfad ist in Ordnung: `/go` lädt die Auswahl über
`listActivityOptionSelections` (app/go/page.tsx), und req-080/req-081
haben keine der beteiligten Dateien angefasst. Der Test lief seit seiner
Entstehung am 27.09. (bug-057) durch — er hat den Wettlauf bisher nur
gewonnen.

Dass die Anzeige sofort reagiert, ist richtig und soll bleiben: Ein Tipp
muss sich unmittelbar auswirken. Was fehlt, ist die Sicherheit, dass der
Schreibvorgang angekommen ist, bevor die Seite neu gelesen wird.

# Erwartete Behebung

- Ein Neuladen zeigt die gewählte Alternative **immer**, auch unmittelbar
  nach dem Tipp.
- Die Anzeige reagiert weiterhin sofort — nicht erst, wenn der Server
  geantwortet hat.
- Schlägt das Speichern fehl, wird das **benannt** und die Anzeige nicht
  stillschweigend auf dem nicht gespeicherten Stand gelassen (vgl.
  bug-021, bug-026, bug-027, bug-032).

Wie, entscheidet die Umsetzung.

# Notes

Beim Beheben ist zu prüfen, ob es weitere Stellen mit `void` auf einem
Schreibvorgang gibt, deren Ergebnis die Oberfläche später wieder liest.

Der E2E-Test selbst ist in Ordnung und beschreibt die Erwartung richtig —
er soll nicht entschärft werden, um grün zu werden.
