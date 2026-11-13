---
id: req-104
title: Lese-Schnittstelle für mitdenka — Reisen, Orte und Strecken
app: wegfara
area: Planung
priority: normal
created: 2026-11-13
---

# Goal (Why)

Der Chat im Planer kann in die **geöffnete** Reise sehen (req-093). Was
fehlt, ist der Blick von aussen: Als Betreiber will ich aus **mitdenka**
fragen können, welche Reisen es gibt und was in einer davon steht — ohne
die App zu öffnen und ohne erst eine Reise zu wählen.

Dazu zwei Dinge, die **gar nicht zu einer Reise gehören**: wo ein Ort
liegt und was er bietet, und wie lange man von A nach B braucht. Beides
kann die App schon, aber nur innerhalb einer Reise.

# Function (What)

wegfara liefert eine **gewöhnliche Lese-Schnittstelle**. Den MCP-Server
baut **mitdenka** daraus selbst — so wie es Weinkeller,
Familienkalender und Recall schon tut (`gateMcpServer` in
`lib/chat/model.ts` von mitdenka).

Das ist der Grund für den Zuschnitt: **wegfara braucht kein MCP-SDK.**
Die Schnittstelle spricht JSON-RPC mit den Methodennamen von MCP, und
mitdenka hängt seinen Gate davor — dasselbe Protokoll, dieselbe
Freigabe-Prüfung, dasselbe Journal wie bei den drei anderen.

## Eine Route, zwei Methoden

`POST /api/werkzeuge` nimmt JSON-RPC:

| Methode | Antwort |
|---|---|
| `tools/list` | die Werkzeuge mit Beschreibung und `inputSchema` |
| `tools/call` | `{ name, arguments }` → das Ergebnis als Text |

Dieselbe Form, die mitdenkas `cellarClient` erwartet
(`lib/cellar/client.ts`): ein Umschlag mit `jsonrpc`, `id`, `method`,
`params`, und eine Antwort mit `result` oder `error`.

Jedes Werkzeug trägt `annotations: { readOnlyHint: true }` — es ändert
nichts, und das soll der Klient wissen.

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
| `strecke_berechnen` | Dauer und Entfernung zwischen zwei Stellen, je Verkehrsmittel |

## Nur lesen

**Kein Werkzeug ändert etwas.** Dieselbe Begründung wie bei req-093, und
hier zwingender: Von aussen sitzt niemand in der App und bestätigt. Ein
Modell, das Webseiten liest, darf von dort keine Handlung in die Reise
tragen.

Was die Schnittstelle nicht hergibt: Dokumente, Bewertungsrunden und
Stimmen, Namen oder E-Mail-Adressen der Teilnehmer (nur ihre **Anzahl**),
Zugangsschlüssel, Bankverbindung, Positionen.

## Die Anmeldung

**Ein Schlüssel je Account**, als `Authorization: Bearer …`. Daraus ergibt
sich der Account, und **jede** Abfrage filtert danach
(`delivery/security.md`, Mandantentrennung).

Erzeugt wird er in „Mein Bereich", ist **nur einmal im Klartext zu
sehen** und jederzeit widerrufbar. Gespeichert wird nur sein Hash — wie
bei den Einladungen (`lib/auth/tokens.ts`), nicht verschlüsselt: Die App
muss ihn prüfen, nicht zurücklesen.

Dass er ein **dauerhafter Zugang ohne Passkey und ohne Ablauf** ist, ist
die heikelste Stelle. Deshalb:

- Er darf **nur lesen** — ein bekannt gewordener Schlüssel kann nichts
  zerstören.
- Die Karte nennt, **wann er zuletzt benutzt** wurde. Eine Benutzung, von
  der man nichts weiss, ist der einzige Hinweis auf einen Missbrauch.
- Höchstens einer je Account. Ein zweiter ersetzt den ersten, der damit
  sofort ungültig ist.

## Die Route gehört nicht ins Internet

Beide Anwendungen laufen auf demselben Beelink. Die Route wird deshalb
**nicht über den Cloudflare-Tunnel veröffentlicht**: Sie ist von aussen
nicht erreichbar, nur aus dem Docker-Netz heraus.

Das ist der Weg, den der Weinkeller schon geht (`lib/cellar/client.ts`:
*„It only listens on the Beelink itself"*). Ein Zugang mehr aus dem
Internet verlangt `security.md` nicht, und ein Bearer-Token ohne
Passkey davor wäre der schwächste Punkt der ganzen App.

## Die Grenze für Google Places

`ort_suchen` und `ort_nachschlagen` fragen Google und **kosten Geld** —
seit März 2025 gilt eine Freimenge je Abfrageart, nicht mehr ein
gemeinsamer Betrag.

Von aussen fällt das nicht auf: Eine Frage in mitdenka kann eine Abfrage
auslösen, ohne dass man es merkt. Deshalb ein **Zähler je Account und
Tag** mit einer Obergrenze. Ist sie erreicht, sagt die Antwort das —
**und es geht keine Abfrage an Google**. Der Stand steht in „Mein
Bereich" neben dem Schlüssel.

Die Grenze steht als benannter Wert an einer Stelle und zählt **nur die
Abfragen dieser Schnittstelle**, nicht die der App: Wer im Planer sucht,
sieht was er tut.

`strecke_berechnen` zählt nicht mit — OSRM ist kostenlos.

## Woher die Schlüssel kommen

Google-Abfragen brauchen den Zugangsschlüssel des Accounts (req-028,
`account_api_key` mit `kind = 'google'`). Fehlt er, sagen die beiden
Werkzeuge das — sie fallen nicht still aus.

## Wenn etwas fehlschlägt

Jedes Werkzeug nennt den Grund, statt leer zurückzukommen:

- Reise nicht gefunden oder nicht in diesem Account → **nicht gefunden**,
  ohne zu verraten, ob es sie anderswo gibt
- Kein Google-Schlüssel → benannt
- Tagesgrenze erreicht → benannt, mit dem Stand
- Routing-Dienst schweigt → benannt (bug-067)

# GUI

- **Die Karte „Zugang für mitdenka"** in „Mein Bereich" (req-043), neben
  „Zugangsschlüssel": erzeugen, den Schlüssel einmal zeigen, widerrufen,
  darunter zwei Angaben — zuletzt benutzt, Google-Abfragen heute von der
  Grenze.
- Nur der **Account-Admin** sieht sie. Ein Schlüssel, der alle Reisen des
  Accounts liest, gehört nicht in die Hand jedes Teilnehmers.
- Der Schlüssel steht **einmal** da, mit dem Hinweis, dass er danach
  nicht mehr zu sehen ist, und einem Knopf zum Kopieren.
- Bei 375, 768 und 1280 px gelten die vier Regeln aus `stack.md`.

# Acceptance Criteria

- [x] Gegeben ich bin Account-Admin, wenn ich „Mein Bereich" öffne, dann
      gibt es die Karte „Zugang für mitdenka".
- [x] Gegeben ich bin nicht Account-Admin, wenn ich „Mein Bereich"
      öffne, dann sehe ich diese Karte NICHT.
- [x] Gegeben ich erzeuge einen Schlüssel, wenn er erscheint, dann steht
      er im Klartext da, mit dem Hinweis, dass er danach nicht mehr zu
      sehen ist.
- [x] Gegeben ich lade die Seite neu, wenn ich die Karte ansehe, dann
      steht der Schlüssel nicht mehr im Klartext da.
- [x] Gegeben ich erzeuge einen zweiten Schlüssel, wenn ich den ersten
      benutze, dann wird er abgewiesen.
- [x] Gegeben ich widerrufe den Schlüssel, wenn ich ihn benutze, dann
      wird er abgewiesen.
- [x] Gegeben ein gültiger Schlüssel, wenn ich `tools/list` aufrufe,
      dann nennt die Antwort alle acht Werkzeuge mit Beschreibung und
      `inputSchema`.
- [x] Gegeben `tools/list`, wenn ich ein Werkzeug ansehe, dann trägt es
      `readOnlyHint: true`.
- [x] Gegeben ein gültiger Schlüssel, wenn ich `reisen_auflisten`
      aufrufe, dann nennt die Antwort alle Reisen meines Accounts mit
      Kennung, Titel, Zeitraum und Zustand.
- [x] Gegeben eine Reise meines Accounts, wenn ich `tagesplan_lesen` mit
      ihrer Kennung und einem Datum aufrufe, dann stehen die
      Programmpunkte dieses Tags in zeitlicher Folge da.
- [x] Gegeben die Kennung einer Reise eines **anderen** Accounts, wenn
      ich sie einem Werkzeug übergebe, dann lautet die Antwort „nicht
      gefunden".
- [x] Gegeben kein Schlüssel im Kopf der Anfrage, wenn ich die Route
      aufrufe, dann wird sie abgewiesen.
- [x] Gegeben ein unbekannter Methodenname, wenn ich ihn aufrufe, dann
      antwortet die Route mit einem Fehler im JSON-RPC-Umschlag, nicht
      mit einem Absturz.
- [x] Gegeben ich rufe `ort_suchen` mit „Guggenheim Bilbao" auf, dann
      nennt die Antwort den Ort mit Anschrift und Position.
- [ ] Gegeben ich rufe `strecke_berechnen` zwischen zwei Stellen auf,
      dann nennt die Antwort Dauer und Entfernung je Verkehrsmittel.
- [ ] Gegeben der Routing-Dienst antwortet nicht, wenn ich
      `strecke_berechnen` aufrufe, dann sagt die Antwort das.
- [x] Gegeben kein Google-Zugangsschlüssel am Account, wenn ich
      `ort_suchen` aufrufe, dann sagt die Antwort das.
- [x] Gegeben die Tagesgrenze ist erreicht, wenn ich `ort_suchen`
      aufrufe, dann sagt die Antwort das und nennt den Stand — und es
      geht KEINE Abfrage an Google.
- [x] Gegeben ich habe heute fünf Orte gesucht, wenn ich „Mein Bereich"
      ansehe, dann steht dort „5 von N".
- [ ] Gegeben ich rufe `strecke_berechnen` zehnmal auf, wenn ich den
      Stand ansehe, dann ist er unverändert.
- [x] Gegeben ich suche im Planer nach einem Ort, wenn ich den Stand
      ansehe, dann ist er unverändert.
- [x] Gegeben ich benutze den Schlüssel, wenn ich die Karte danach
      ansehe, dann steht dort, wann er zuletzt benutzt wurde.
- [x] Gegeben die Route, wenn ich sie von aussen über
      `app.wegfara.com` aufrufe, dann ist sie nicht erreichbar.

# Constraints

- **Kein MCP-SDK in wegfara.** Die Schnittstelle spricht JSON-RPC mit den
  Methodennamen von MCP; den Server baut mitdenka. Das ist das Muster der
  drei vorhandenen Gates und hält wegfara frei von einer Abhängigkeit,
  die es nur für einen Klienten bräuchte.
- **Die Leseschicht wird geteilt, nicht kopiert.**
  `lib/chat/plan-leser.ts` (req-093) bekommt die Reisekennung als
  Argument, statt sie beim Erzeugen festzulegen. Es entsteht keine zweite
  Fassung derselben Abfragen (vgl. req-082).
- **Jede Abfrage filtert nach Account.** Der Account kommt aus dem
  Schlüssel, **nie** aus einem Argument des Werkzeugs — ein Modell, das
  Webseiten liest, darf keine Kennung mitbringen.
- Vom Schlüssel wird nur der **Hash** gespeichert (`lib/auth/tokens.ts`).
  Er ist kein Geheimnis, das die App zurücklesen muss — anders als die
  API-Schlüssel (req-028).
- **Kein Werkzeug schreibt.** Nicht als Zuschnitt, sondern als Regel.
- Die Route wird **nicht in den Cloudflare-Tunnel aufgenommen**
  (`delivery/devops.md`). Sie ist nur aus dem Docker-Netz erreichbar.
- Der Zähler liegt in der Datenbank, je Account und Tag — nicht im
  Arbeitsspeicher, der bei jedem Deploy vergisst.
- Die Antworten werden **Feld für Feld zusammengestellt**, kein
  `JSON.stringify` einer Datenbankzeile: Sonst wandert beim nächsten
  neuen Feld ungefragt etwas hinaus (wie req-093).
- Die Route antwortet **zügig**. mitdenka bricht nach 3 Sekunden
  (`tools/list`) und 20 Sekunden (`tools/call`) ab
  (`LIST_TIMEOUT_MS`, `CALL_TIMEOUT_MS`); eine Abfrage, die länger
  braucht, kommt dort nie an.

# Out of Scope

- **Der Gate in mitdenka.** Er gehört in dessen Repo, nach dem Muster von
  `gateMcpServer` — ein eigenes Requirement dort.
- **Schreibende Werkzeuge.** POIs anlegen, Programmpunkte verschieben,
  Kosten ändern — nächster Schritt, braucht eine eigene Überlegung zur
  Bestätigung.
- Ein echter MCP-Server in wegfara, an den sich Claude Desktop oder
  Claude Code binden könnte. Erst wenn ein zweiter Klient danach fragt.
- Ein Schlüssel je Person mit eigenen Rechten (req-055).
- Mehrere Schlüssel gleichzeitig.
- Dokumente, Bewertungsrunden, Stimmen oder Teilnehmernamen abfragen.
- Reiseübergreifend rechnen. `reisen_auflisten` nennt sie, das
  Vergleichen macht das Modell.
- Den Chat im Planer an diese Schnittstelle hängen. Er hat seine
  Werkzeuge schon (req-093) und braucht keinen Umweg.
- Die Freimenge von Google selbst abfragen — über die Schnittstelle nicht
  zu erfahren; der Zähler ist die eigene Rechnung.
