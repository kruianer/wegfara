---
id: req-104
title: MCP-Server — Reisen, Orte und Strecken von aussen abfragen
app: wegfara
area: Planung
priority: normal
created: 2026-11-13
---

# Goal (Why)

Der Chat im Planer kann in die **geöffnete** Reise sehen (req-093). Was
fehlt, ist der Blick von aussen: Als Betreiber will ich aus Claude
Desktop oder Claude Code fragen können, **welche Reisen es gibt** und was
in einer davon steht — ohne die App zu öffnen und ohne erst eine Reise zu
wählen.

Dazu will ich zwei Dinge fragen können, die **gar nicht zu einer Reise
gehören**: wo ein Ort liegt und was er bietet, und wie lange man von A
nach B braucht. Beides kann die App schon, aber nur innerhalb einer
Reise.

Die Leseschicht dafür gibt es bereits (`lib/chat/plan-leser.ts`,
req-093) — sie ist nur an eine Reise gebunden. Routing und Places
ebenfalls (`lib/routing/osrm-client.ts`, `lib/google/places-client.ts`).

# Function (What)

Ein **MCP-Server** als Route der App (`/api/mcp`), an den sich Claude
Desktop, Claude Code oder ein anderer MCP-Klient binden lässt.

## Die Werkzeuge

**Über alle Reisen** (neu):

| | |
|---|---|
| `reisen_auflisten` | je Reise Kennung, Titel, Zeitraum, Zustand, Zahl der POIs und Programmpunkte |

**Über eine Reise** — dieselben vier wie im Chat (req-093), ergänzt um
die Reisekennung als Argument:

| | |
|---|---|
| `reise_lesen` | Titel, Zeitraum, Hauptort, Zustand, Teilnehmerzahl, Reisetage |
| `pois_lesen` | die POI-Sammlung |
| `tagesplan_lesen` | die Programmpunkte eines Tags in zeitlicher Folge |
| `kosten_lesen` | die Kostenaufstellung |

**Ohne Reise** (neu):

| | |
|---|---|
| `ort_suchen` | Orte zu einem Suchbegriff: Name, Anschrift, Position |
| `ort_nachschlagen` | zu einem gefundenen Ort: Öffnungszeiten, Bewertung, Webseite, Telefon |
| `strecke_berechnen` | Dauer und Entfernung zwischen zwei Stellen, je Verkehrsmittel (Auto, Rad, zu Fuss) |

## Nur lesen

**Kein Werkzeug ändert etwas.** Dieselbe Begründung wie bei req-093, und
hier noch zwingender: Beim MCP-Server sitzt niemand in der App und
bestätigt. Ein Modell, das Webseiten liest, darf von dort keine Handlung
in die Reise tragen.

Was der Server nicht hergibt: Dokumente, Bewertungsrunden und Stimmen,
Namen oder E-Mail-Adressen der Teilnehmer (nur ihre **Anzahl**),
Zugangsschlüssel, Bankverbindung, Positionen.

## Die Anmeldung

**Ein Schlüssel je Account.** Er wird in „Mein Bereich" erzeugt, ist
**nur einmal im Klartext zu sehen** und jederzeit widerrufbar. Gespeichert
wird nur sein Hash — wie bei den Einladungen (`lib/auth/tokens.ts`), nicht
verschlüsselt: Der Server muss ihn prüfen, nicht lesen.

Er geht als `Authorization: Bearer …` mit jeder Anfrage. Daraus ergibt
sich der Account, und **jede** Abfrage filtert danach
(`delivery/security.md`, Mandantentrennung).

Dass er ein **dauerhafter Zugang ohne Passkey und ohne Ablauf** ist, ist
die heikelste Stelle dieses Requirements. Deshalb:

- Er darf **nur lesen** — ein bekannt gewordener Schlüssel kann nichts
  zerstören.
- Die Karte in „Mein Bereich" nennt, **wann er zuletzt benutzt** wurde.
  Eine Benutzung, von der man nichts weiss, ist der einzige Hinweis auf
  einen Missbrauch.
- Höchstens einer je Account. Ein zweiter ersetzt den ersten, der damit
  sofort ungültig ist.

## Die Grenze für Google Places

`ort_suchen` und `ort_nachschlagen` fragen Google und **kosten Geld** —
seit März 2025 gilt eine Freimenge je Abfrageart, nicht mehr ein
gemeinsamer Betrag.

Beim MCP-Server ist das gefährlicher als in der App: Eine Frage in Claude
Desktop kann eine Abfrage auslösen, ohne dass man es merkt.

Deshalb ein **Zähler je Account und Tag** mit einer Obergrenze. Ist sie
erreicht, antwortet der Server, dass heute nichts mehr abgefragt wird —
**er fragt Google dann nicht**. Der Stand steht in „Mein Bereich" neben
dem Schlüssel.

Die Grenze steht als benannter Wert an einer Stelle. Sie zählt **nur die
Abfragen des MCP-Servers**, nicht die der App: Wer im Planer sucht, sieht
was er tut.

`strecke_berechnen` zählt nicht mit — OSRM ist kostenlos.

## Woher die Schlüssel kommen

Google-Abfragen brauchen den Zugangsschlüssel des Accounts (req-028,
`account_api_key` mit `kind = 'google'`). Fehlt er, sagen die beiden
Werkzeuge das — sie fallen nicht still aus.

Für `strecke_berechnen` braucht es keinen: OSRM läuft ohne Schlüssel.

## Wenn etwas fehlschlägt

Jedes Werkzeug sagt den Grund, statt leer zurückzukommen:

- Reise nicht gefunden oder nicht in diesem Account → **nicht gefunden**,
  ohne zu verraten, ob es sie anderswo gibt
- Kein Google-Schlüssel → benannt
- Tagesgrenze erreicht → benannt, mit dem Stand
- Routing-Dienst schweigt → benannt (bug-067: der Dienst fällt aus, und
  die Antwort muss das sagen)

# GUI

- **Die Karte „MCP-Zugang"** in „Mein Bereich" (req-043), neben
  „Zugangsschlüssel": erzeugen, den Schlüssel einmal zeigen, widerrufen,
  und darunter zwei Angaben — zuletzt benutzt, Google-Abfragen heute von
  der Grenze.
- Nur der **Account-Admin** sieht sie. Ein Schlüssel, der alle Reisen des
  Accounts liest, gehört nicht in die Hand jedes Teilnehmers.
- Der Schlüssel steht **einmal** da, mit dem Hinweis, dass er danach nicht
  mehr zu sehen ist, und einem Knopf zum Kopieren.
- Bei 375, 768 und 1280 px gelten die vier Regeln aus `stack.md`.

# Acceptance Criteria

- [ ] Gegeben ich bin Account-Admin, wenn ich „Mein Bereich" öffne, dann
      gibt es die Karte „MCP-Zugang".
- [ ] Gegeben ich bin nicht Account-Admin, wenn ich „Mein Bereich"
      öffne, dann sehe ich diese Karte NICHT.
- [ ] Gegeben ich erzeuge einen Schlüssel, wenn er erscheint, dann steht
      er im Klartext da, mit dem Hinweis, dass er danach nicht mehr zu
      sehen ist.
- [ ] Gegeben ich lade die Seite neu, wenn ich die Karte ansehe, dann
      steht der Schlüssel nicht mehr im Klartext da.
- [ ] Gegeben ich erzeuge einen zweiten Schlüssel, wenn ich den ersten
      benutze, dann wird er abgewiesen.
- [ ] Gegeben ich widerrufe den Schlüssel, wenn ich ihn benutze, dann
      wird er abgewiesen.
- [ ] Gegeben ein gültiger Schlüssel, wenn ich `reisen_auflisten`
      aufrufe, dann nennt die Antwort alle Reisen meines Accounts mit
      Kennung, Titel, Zeitraum und Zustand.
- [ ] Gegeben eine Reise meines Accounts, wenn ich `tagesplan_lesen` mit
      ihrer Kennung und einem Datum aufrufe, dann stehen die
      Programmpunkte dieses Tags in zeitlicher Folge da.
- [ ] Gegeben die Kennung einer Reise eines **anderen** Accounts, wenn
      ich sie einem Werkzeug übergebe, dann lautet die Antwort „nicht
      gefunden".
- [ ] Gegeben kein Schlüssel im Kopf der Anfrage, wenn ich ein Werkzeug
      aufrufe, dann wird die Anfrage abgewiesen.
- [ ] Gegeben ich rufe `ort_suchen` mit „Guggenheim Bilbao" auf, dann
      nennt die Antwort den Ort mit Anschrift und Position.
- [ ] Gegeben ich rufe `strecke_berechnen` zwischen zwei Stellen auf,
      dann nennt die Antwort Dauer und Entfernung je Verkehrsmittel.
- [ ] Gegeben der Routing-Dienst antwortet nicht, wenn ich
      `strecke_berechnen` aufrufe, dann sagt die Antwort das.
- [ ] Gegeben kein Google-Zugangsschlüssel am Account, wenn ich
      `ort_suchen` aufrufe, dann sagt die Antwort das.
- [ ] Gegeben die Tagesgrenze ist erreicht, wenn ich `ort_suchen`
      aufrufe, dann sagt die Antwort das und nennt den Stand — und es
      geht KEINE Abfrage an Google.
- [ ] Gegeben ich habe heute fünf Orte gesucht, wenn ich „Mein Bereich"
      ansehe, dann steht dort „5 von N".
- [ ] Gegeben ich rufe `strecke_berechnen` zehnmal auf, wenn ich den
      Stand ansehe, dann ist er unverändert — OSRM zählt nicht mit.
- [ ] Gegeben ich suche im Planer nach einem Ort, wenn ich den Stand
      ansehe, dann ist er unverändert — die App zählt nicht mit.
- [ ] Gegeben ich benutze den Schlüssel, wenn ich die Karte danach
      ansehe, dann steht dort, wann er zuletzt benutzt wurde.
- [ ] Gegeben irgendein Werkzeug, wenn ich versuche damit etwas zu
      ändern, dann gibt es dafür kein Werkzeug.

# Constraints

- **Der Server ist eine Route der App**, kein eigenes Programm. Die
  Werkzeuge brauchen Datenbank, Account-Prüfung und die verschlüsselten
  Google-Schlüssel; ein eigener Dienst bräuchte alles doppelt.
- **Die Leseschicht wird geteilt, nicht kopiert.** `lib/chat/plan-leser.ts`
  (req-093) bekommt die Reisekennung als Argument, statt sie beim Erzeugen
  festzulegen. Es entsteht keine zweite Fassung derselben Abfragen
  (vgl. req-082).
- **Jede Abfrage filtert nach Account** (`delivery/security.md`,
  Mandantentrennung). Der Account kommt aus dem Schlüssel, **nie** aus
  einem Argument des Werkzeugs — ein Modell, das Webseiten liest, darf
  keine Kennung mitbringen.
- Vom Schlüssel wird nur der **Hash** gespeichert, mit demselben Weg wie
  bei den Einladungen (`lib/auth/tokens.ts`). Er ist kein Geheimnis, das
  die App zurücklesen muss — anders als die API-Schlüssel (req-028).
- **Kein Werkzeug schreibt.** Nicht als Zuschnitt, sondern als Regel:
  Hier bestätigt niemand.
- Die Tagesgrenze und der Zähler liegen in der Datenbank, je Account und
  Tag — nicht im Arbeitsspeicher, der bei jedem Deploy vergisst.
- Das MCP-SDK (`@modelcontextprotocol/sdk`) kommt als Abhängigkeit dazu.
  Sonst keine.
- Die Antworten der Werkzeuge werden **Feld für Feld zusammengestellt**,
  kein `JSON.stringify` einer Datenbankzeile: Sonst wandert beim nächsten
  neuen Feld ungefragt etwas hinaus (wie req-093).

# Out of Scope

- **Schreibende Werkzeuge.** POIs anlegen, Programmpunkte verschieben,
  Kosten ändern — das ist der nächste Schritt und braucht eine eigene
  Überlegung zur Bestätigung.
- Ein Schlüssel je Person mit eigenen Rechten (req-055). Erst einer je
  Account; das genügt für den Betreiber und ist zu verstehen.
- Mehrere Schlüssel gleichzeitig.
- Dokumente, Bewertungsrunden, Stimmen oder Teilnehmernamen abfragen.
- Reiseübergreifend rechnen („vergleiche die Kosten meiner Reisen").
  `reisen_auflisten` nennt sie, das Vergleichen macht das Modell.
- Den Chat im Planer an den MCP-Server hängen. Er hat seine Werkzeuge
  schon (req-093) und braucht keinen Umweg.
- Benachrichtigungen oder Ereignisse (MCP kennt das; hier wird gefragt,
  nicht gehorcht).
- Die Freimenge von Google selbst abfragen. Sie ist über die
  Schnittstelle nicht zu erfahren — der Zähler ist die eigene Rechnung.
