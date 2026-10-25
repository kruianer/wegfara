---
id: bug-067
app: wegfara
req: req-051
priority: hoch
created: 2026-10-24
---

# Observed

Am 24.10.2026 war `routing.openstreetmap.de` über IPv4 nicht erreichbar.
Die Folge in der App:

- Im Planer ließ sich keine Strecke zwischen zwei POIs berechnen (req-059).
- Im Begleiter zeigte der Live-Status dauerhaft „Verzug gerade nicht
  ermittelbar" (req-051).

Beides einen ganzen Tag lang, auf prod. Am 25.10. antwortete der Dienst
wieder, ohne dass an der App oder am Server etwas geändert wurde.

# Expected

Fällt der fremde Dienst aus, bleibt die App benutzbar: Ein einzelner
Fehlschlag wird wiederholt, eine schon bekannte Fahrzeit wird
weiterverwendet, und im Server-Log steht der Grund. Ein Ausfall über
Stunden darf nicht wie ein dauerhaftes Gebrechen der App wirken.

# Steps

1. Den Routing-Dienst unerreichbar machen (Netz trennen oder
   `OSRM_BASE_URL` auf eine tote Adresse setzen)
2. Planer öffnen, zwischen zwei Programmpunkten einen Transfer planen →
   keine Dauer, keine Strecke
3. Begleiter während der Reise öffnen → „Verzug gerade nicht ermittelbar",
   bei jeder Abfrage neu, ohne Wiederholung und ohne Logeintrag

# Ursache

Gemessen am 24. und 25.10.2026:

| Von wo | 24.10. | 25.10. |
|---|---|---|
| Arbeitsplatz, IPv4 erzwungen | `000` — keine Verbindung | `HTTP 200` in 0,18 s |
| Arbeitsplatz, ohne Zwang | `HTTP 200` (über IPv6) | `HTTP 200` (über IPv6) |
| Prod-Container (nur IPv4) | `ECONNREFUSED` | `HTTP 200`, alle drei Profile |

**Es war ein Ausfall beim Dienst, kein Fehler im Docker-Netz.** Der
Container geht über IPv4 hinaus (`85.127.98.151`); am 24.10. nahm die
IPv4-Adresse des Dienstes (`5.148.170.168`) nirgends Verbindungen an, auch
nicht vom Arbeitsplatz. Dass nur der IPv6-Weg trug, war ein vorübergehender
Zustand und kein Merkmal des Dienstes.

Gegenprobe, dass die Konfiguration unverändert ist: `ipv6=false` im
Docker-Netz, `OSRM_BASE_URL` nicht gesetzt, kein Commit auf der
Compose-Datei, Container seit 23.10. nicht neu gestartet. Aus demselben
Container antworteten am 24.10. `api.openai.com` (401) und
`places.googleapis.com` (404) — das Netz war in Ordnung.

**Der eigentliche Mangel liegt also in der App, nicht im Netz:** Sie hat
gegen den Ausfall eines fremden Dienstes keinen Rückfall.

1. **Kein Wiederholen.** `fahrzeitMinuten` fragt einmal und gibt bei
   jedem Fehler `null` zurück. Ein einzelner abgewiesener Verbindungsversuch
   wirkt wie ein dauerhafter Ausfall.
2. **Kein Zwischenspeicher.** Jede Abfrage des Live-Status rechnet neu,
   jede Minute. Eine vor zehn Minuten ermittelte Fahrzeit wäre auf einer
   langen Fahrt immer noch brauchbar — besser als keine Angabe.
3. **Keine Zeitgrenze.** `routenAntwort` ruft `fetch` ohne Signal auf. Ein
   Dienst, der die Verbindung annimmt und dann schweigt, laesst die Anfrage
   haengen -- im Live-Status jede Minute erneut.
4. **Kein Logeintrag.** Im Server-Log steht nicht, warum der Dienst nicht
   antwortete. Der Unterschied zwischen `ECONNREFUSED` über Stunden und
   einem einzelnen Zeitüberlauf ist für die Fehlersuche entscheidend;
   genau diese Lücke stand schon in bug-021, bug-026, bug-027, bug-032 und
   bug-061.

Alle drei Luecken sitzen in `routenAntwort` (`lib/routing/osrm-client.ts`):
Ein `catch { return null }` ohne Bindung verwirft die Ursache, bevor sie
irgendwo ankommen kann.

Dass der Ort einen Zwischenspeicher hat (`lib/live-status/ort-cache.ts`),
die Fahrzeit aber nicht, ist dabei die auffällige Unstimmigkeit — dasselbe
Muster wie bug-048 gegen bug-065: an einer Stelle vorgesehen, an der
Schwesterstelle nicht.

# Erwartete Behebung

Ein Vorschlag, die Abwägung gehört ins Requirement:

- **Wiederholen** bei Verbindungsfehlern, zwei- bis dreimal mit wachsendem
  Abstand. Nicht bei einer fachlichen Antwort des Dienstes („keine Route") —
  die ist richtig und wird durch Wiederholen nicht besser.
- **Zwischenspeichern** je Streckenpaar, mit Höchstalter. Beim Live-Status
  wäre eine Angabe mit dem Zusatz, wann sie ermittelt wurde, besser als
  keine. Im Planer dagegen ist eine veraltete Fahrzeit heikel — dort wird
  sie gespeichert und steht nachher im Plan.
- **Zeitgrenze** je Abruf, als `AbortSignal` an `fetch`.
- **Logeintrag** mit der Ursache (`ECONNREFUSED`, Zeitüberlauf,
  HTTP-Status) bei jedem Fehlschlag.

Nicht Teil der Behebung: IPv6 im Docker-Netz. Es war nicht die Ursache,
und der Dienst ist über IPv4 erreichbar.

# Notes

Meine erste Fassung dieses Bugs nannte als Ursache, `routing.openstreetmap.de`
sei grundsätzlich nur über IPv6 erreichbar. **Das war falsch.** Die
Messungen am 24.10. waren richtig, die Schlussfolgerung nicht — ich habe
aus einem vorübergehenden Zustand ein dauerhaftes Merkmal gemacht. Dass
auch der Arbeitsplatz über IPv4 nicht durchkam, sprach gegen eine Ursache
im Docker-Netz und hätte das zeigen müssen.

Dev ist gleich betroffen — dieselbe Vorgabe, derselbe Dienst.

Der Live-Status schweigt heute ohnehin, solange kein Programmpunkt läuft;
das ist req-084 und ein eigener Mangel. Ist req-084 umgesetzt, wird der
Verzug häufiger gebraucht und ein Ausfall des Dienstes damit sichtbarer.
