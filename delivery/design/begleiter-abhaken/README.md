# Abhaken und Streichen im Begleiter — Entwurf

`abhaken.mockup.html` im Browser öffnen. Sechs Fälle nebeneinander, alle
bei **375 px** — der schmalsten Breite aus `stack.md`.

Gefüllt mit der Reise „30 Johr zämma – Rothenburg" und dem wirklichen
Fall vom 25.10.2026: Nachtwächter und Plönlein waren auf Tag 2 geplant
und wurden wegen des Regens am Tag 1 gemacht.

**Noch kein Requirement.** Der Entwurf ist zum Ansehen und Verwerfen.

## Warum die App heute aus dem Tritt kommt

Nachgesehen am 26.10.2026:

- **Es gibt keinen Zustand „erledigt".** Weder `lib/activities/types.ts`
  noch die Migrationen kennen etwas dergleichen. Ein Programmpunkt hat
  Beginn und Ende, sonst nichts.
- **Alles hängt an der Uhrzeit.** `lib/live-status/plan-eintrag.ts` sucht
  den laufenden Punkt über `startAt <= jetzt < endAt`, den nächsten über
  `startAt.startsWith(heute)`. Ein Punkt, der auf morgen datiert ist,
  aber gestern stattfand, ist für die App morgen.
- **Der Begleiter kann es nicht richten.** Er schreibt nur an fünf
  Stellen (Optionen, Stimmen, Dokumente, Fotos, Teilnehmer).
  Programmpunkte ändert allein `/api/programmpunkte`, und das bedient
  der Planer — der seit req-088 768 px braucht. Auf dem Telefon (375 px)
  kommt man gar nicht hinein.

## Die zwei Handgriffe

An jeder Station stehen beide offen, nebeneinander, je 44 px hoch und
**immer sichtbar** — kein Wischen als einziger Weg (`stack.md`, Regel 3).

| | Bedeutung | Darstellung |
|---|---|---|
| **Gemacht** | war da | bleibt stehen, tritt zurück, Titel **nicht** durchgestrichen |
| **Lassen wir** | findet nicht statt | Titel durchgestrichen, gestrichelter Rand |

Der Unterschied in der Darstellung ist Absicht: Ein abgehakter Punkt ist
die Erinnerung an etwas, das stattgefunden hat — ihn durchzustreichen
würde ihn entwerten. Ein gestrichener ist etwas, das es nicht gibt.

**Nichts wird gelöscht.** Beides ist eine Aussage über die Wirklichkeit,
kein Eingriff in den Plan. Deshalb ist auch „Rückgängig" möglich.

## Die Transfers beim Streichen

Das war die offene Frage. Heute entfernt `deleteActivity`
(`lib/db/activities.ts:227`) beide Transfers des Programmpunkts — und
**näht nichts zusammen**:

```sql
delete from transfer where from_activity_id = $1 or to_activity_id = $1
```

Weil `insertTransfers` (`lib/transfers/timeline.ts:51`) einen Transfer
nur zwischen **tatsächlich benachbarten** Einträgen zeichnet, steht
danach zwischen A und C gar keine Fahrt. Die Fahrzeit des Tages fehlt
still.

**Vorschlag:** Beim Streichen von B

1. werden A→B und B→C **verborgen, nicht gelöscht** — sonst ist
   „Rückgängig" nicht möglich,
2. entsteht eine **neue Strecke A→C**, erkennbar als „neu berechnet",
3. und wenn der Routing-Dienst schweigt, gilt das Streichen **trotzdem**;
   die Strecke bleibt offen und wird nachgeholt (Fall 5).

Der letzte Punkt ist die wichtigste Regel: Eine Aussage über die Reise
darf nie an einem fremden Dienst hängen (bug-067).

## Was noch zu entscheiden ist

- **Wer darf was?** Mein Vorschlag: **abhaken jeder**, **streichen nur
  der Reiseleiter** — sonst kippt die Gruppe sich gegenseitig den Plan
  um. Noch nicht entschieden.
- **Die Kosten.** `kostenzeile.activity_id` hängt am Programmpunkt
  (`migrations/0045`). Ein gestrichener Punkt sollte seine Kostenzeile
  wohl behalten, aber als „entfällt" zählen — bei einem schon bezahlten
  Ticket aber nicht. Offen.
- **Der gedruckte Reiseplan** (req-080). Gehören gestrichene Stationen
  hinein? Vermutlich nicht. Abgehakte schon, denn das Heft entsteht vor
  der Reise.
- **Fall 6 (vorgezogen)** ist bewusst außen vor. Er braucht das Abhaken
  eines Punkts, der auf einen anderen Tag datiert ist — das ist Stufe 2
  und ein eigenes Requirement.

## Zum Stil

Die Farben kommen unverändert aus `app/go/theme.module.css`
(`--bg`, `--sur`, `--ink`, `--acc`, `--good`). Das Mockup hat noch
**eigenes CSS** — sobald der Baukasten (req-089) steht, kommen die Werte
von dort, und dann gilt die Regel aus req-091: kein eigenes CSS mehr.
