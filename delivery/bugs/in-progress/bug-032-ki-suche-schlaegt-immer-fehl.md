---
id: bug-032
app: wegfara
req: req-014
priority: high
created: 2026-09-10
---

# Observed

Die POI-Suche per KI liefert immer einen Fehler.

# Expected

Die Suche läuft und legt POIs an. Schlägt sie fehl, nennt die Meldung den
Grund — nicht nur „Fehler".

# Befund

Auf dev nachgemessen (2026-09-10). **Der Modellname kommt leer bei OpenAI
an.**

`deploy/docker-compose.yml` setzt `OPENAI_MODEL: ${OPENAI_MODEL}`. Steht
die Variable nicht in `~/wegfara-env/dev.env`, setzt Compose sie auf den
**leeren String** — nicht auf „nicht gesetzt". Im Container gemessen:

    OPENAI_MODEL=[]
    node: "" -> (leer, kein Fallback)

`lib/ai/openai-client.ts` liest sie mit
`process.env.OPENAI_MODEL ?? DEFAULT_MODEL`. Der `??`-Operator greift nur
bei `undefined` und `null` — ein leerer String kommt durch. Die Anwendung
schickt damit `model: ""`, und OpenAI antwortet:

    400 — "you must provide a model parameter"

Der Zugangsschlüssel selbst ist in Ordnung (hinterlegt, entschlüsselt
sauber, endet auf `TAcA`).

**Zu tun:**

1. Einen leeren Wert wie einen fehlenden behandeln — nicht nur hier,
   sondern überall, wo eine Umgebungsvariable mit `??` gelesen wird und
   über Compose durchgereicht wird. `AUTH_SECRET`, `IMAGE_DIR`,
   `OSRM_BASE_URL` und `BOOTSTRAP_EMAIL` sind auf dasselbe Muster zu
   prüfen.
2. Den Fehlschlag benennen: Eine Antwort von OpenAI mit `400` sagt genau,
   was fehlt — das gehört ins Log und, sinngemäß, in die Meldung an den
   Nutzer. Ein bloßes „Fehler" schickt ihn auf die Suche nach seinem
   Zugangsschlüssel, obwohl der in Ordnung ist (vgl. bug-021, bug-026).

# Steps

1. Planer öffnen, Bereich POIs
2. Ein Suchgebiet zeichnen
3. Die KI-Suche auslösen — es erscheint ein Fehler

# Behebung

## Leer zählt wie fehlend

Umgebungsvariablen werden nicht mehr an Ort und Stelle aus `process.env`
gelesen, sondern über `lib/env/umgebung.ts`. Dort steht die Regel an genau
einer Stelle: ein durchgereichter leerer Wert ist ein fehlender.

- `envWert(name)` — der Wert ohne Leerraum am Rand, sonst `null`. Für
  alles, dessen Wert keinen Leerraum tragen kann: `OPENAI_MODEL`,
  `OSRM_BASE_URL`, `IMAGE_DIR`, `BOOTSTRAP_EMAIL`.
- `envGeheimnis(name)` — der Wert unverändert, `null` nur, wenn er
  durchweg leer ist. Für `AUTH_SECRET` und `OPENAI_API_KEY`: aus
  `AUTH_SECRET` wird der Schlüssel abgeleitet, mit dem die
  Zugangsschlüssel der Accounts verschlüsselt in der Datenbank liegen
  (req-028) — ein Leerzeichen wegzuschneiden ergäbe einen anderen
  Schlüssel und damit lauter Werte, die sich nicht mehr entschlüsseln
  lassen.

Der Modellname kommt jetzt aus `openAiModel()`
(`lib/ai/openai-client.ts`): `envWert("OPENAI_MODEL") ?? "gpt-5.6-luna"`.
Ein leer durchgereichtes `OPENAI_MODEL` lässt den Standard gelten, statt
ihn zu verdrängen.

Die vier weiteren im Befund genannten Variablen waren gegen den leeren
String bereits abgesichert (`!secret`, `!dir`, `url.length > 0`) — nicht
aber gegen einen Wert aus lauter Leerzeichen. Auch sie lesen jetzt über
die Helfer: `lib/secrets/encryption.ts`, `lib/backup/deploy-token.ts`,
`lib/images/photo-store.ts`, `lib/routing/osrm-client.ts`,
`lib/auth/bootstrap.ts`.

## Der Fehlschlag wird benannt

Die KI-Schnittstelle (`lib/ai/client.ts`) lieferte bei jedem Fehlschlag
`null` — der Grund ging schon dort verloren. Sie liefert jetzt eine
`AiAntwort`: entweder den Text oder den Grund, warum es keinen gibt.

Die Gründe stehen in `lib/ai/fehler.ts` — `modell`, `zugang`,
`kontingent`, `anfrage`, `dienst`, `netz`, `leer` — je mit dem Satz, den
der Nutzer liest. Jeder Satz sagt, ob der Zugangsschlüssel die Ursache
sein kann; wo er es nicht ist, steht das ausdrücklich da. Die Antwort von
OpenAI wird in `aiFehlerAusOpenAi()` darauf abgebildet: ein `400`, dessen
Text das Modell nennt, ist `modell` — genau der Fall dieses Bugs.

Weitergereicht wird beides, der Grund und die Worte des Dienstes:

- ins Log, in `lib/ai/openai-client.ts` bei jedem Fehlschlag — das gilt
  auch für die KI-Planung (req-056) und den Textvorschlag (req-058);
- durch `searchPoisWithAi` (`fehler` am Ergebnis, wie `fotoProblem` seit
  bug-027), durch die Schnittstelle (`502` mit `fehler`) und durch
  `runAiPoiSearch` bis in die Oberfläche.

`app/plan/components/ai-poi-search.tsx` schreibt jetzt statt „Die Suche
ist fehlgeschlagen." den Satz zum Grund samt der Antwort des Dienstes,
z.B.: *Die Suche ist fehlgeschlagen, die POI-Liste ist unverändert. Der
KI-Dienst hat das eingestellte Modell abgelehnt — es fehlt oder ist ihm
unbekannt. Nicht der Zugangsschlüssel ist die Ursache; bitte dem
Betreiber melden. (Antwort des Dienstes: „you must provide a model
parameter“)*

Dazu kommt ein Grund, der vor der KI liegt: antwortet OpenStreetMap nicht
mit der Region um das Suchgebiet, gibt es gar keine Frage zu stellen —
das ist `region` (`lib/pois/ai-search-fehler.ts`) und wird ebenso
benannt.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

- `lib/env/umgebung.test.ts` — leer und blank zählen wie fehlend;
  `envGeheimnis` lässt Leerraum am Rand stehen.
- `lib/ai/openai-client.test.ts` — bei leerem `OPENAI_MODEL` geht der
  Standard-Modellname hinaus (der Bug selbst); die Abbildung von Status
  und Antwort auf einen Grund; der Grund steht im Log.
- `lib/pois/ai-search-fehler.test.ts` — zu jedem Grund ein Satz, und der
  Zugangsschlüssel wird nur genannt, wo er die Ursache sein kann.
- `lib/pois/ai-search.test.ts`, `lib/pois/run-ai-search.test.ts`,
  `app/api/poi-search/route.test.ts` — der Grund reist unverändert vom
  Sprachmodell bis in die Antwort der Schnittstelle (`502` mit `fehler`),
  und die POI-Liste bleibt unverändert.
- `app/plan/components/ai-poi-search.test.tsx` — die Meldung nennt den
  Grund und die Worte des Dienstes, und schickt bei einer anderen Ursache
  niemanden zu seinem Zugangsschlüssel.

Volle Suite (`npm test`) und E2E (`npm run test:e2e`) sind grün.

# Akzeptanzkriterien der Behebung

- [x] Gegeben ein `OPENAI_MODEL`, das leer durchgereicht wird, wenn die
      KI-Suche läuft, dann geht der Standard-Modellname hinaus und die
      Suche legt POIs an.
- [x] Gegeben eine Umgebungsvariable, die leer durchgereicht wird, wenn
      sie gelesen wird, dann gilt sie als nicht gesetzt — geprüft für
      `OPENAI_MODEL`, `AUTH_SECRET`, `IMAGE_DIR`, `OSRM_BASE_URL` und
      `BOOTSTRAP_EMAIL`.
- [x] Gegeben eine fehlgeschlagene KI-Suche, wenn die Meldung erscheint,
      dann nennt sie den Grund und die Antwort des Dienstes — nicht nur
      „Fehler".
- [x] Gegeben ein Fehlschlag, dessen Ursache nicht der Zugangsschlüssel
      ist, wenn die Meldung erscheint, dann sagt sie das ausdrücklich.
- [x] Gegeben ein Fehlschlag, wenn er auftritt, dann steht der Grund samt
      der Antwort des Dienstes im Log.
