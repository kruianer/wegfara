---
id: bug-008
title: Anmeldelink leitet auf https://0.0.0.0:3000 statt auf die Domain
app: wegfara
area: Reise
severity: high
created: 2026-08-06
relates: req-016
---

# Beobachtung

Beim Aufruf eines Anmeldelinks landet der Browser auf
`https://0.0.0.0:3000/...` statt auf `https://dev.wegfara.com/...`.
Die Adresse ist von außen nicht erreichbar — die Anmeldung bricht ab,
obwohl der Link gültig ist.

# Erwartet

Nach dem Einlösen des Links wird auf die Domain der jeweiligen
Umgebung weitergeleitet — auf dev `https://dev.wegfara.com`.

# Nachweis

```
curl -o /dev/null -w "%{http_code} -> %{redirect_url}" \
  "https://dev.wegfara.com/anmeldung/link?token=ungueltig"

303 -> https://0.0.0.0:3000/anmeldung?fehler=link
```

Im Container:

```
docker exec wegfara-dev-app-1 printenv HOSTNAME   → 0.0.0.0
docker exec wegfara-dev-app-1 printenv APP_URL    → https://dev.wegfara.com
```

# Ursache

`app/anmeldung/link/route.ts` baut die Zieladresse der Weiterleitung
aus `request.url`:

```
const url = new URL(request.url);
…
new URL(`${LOGIN_PATH}?fehler=link`, url)
…
new URL(weiter, url)
```

Hinter dem Cloudflare Tunnel ist `request.url` nicht die vom Nutzer
aufgerufene Adresse, sondern die interne, unter der der Container
lauscht. Das Dockerfile setzt `HOSTNAME=0.0.0.0` und `PORT=3000` —
daraus entsteht `https://0.0.0.0:3000`.

Die richtige Adresse steht als Umgebungsvariable `APP_URL` bereit und
wird an anderer Stelle bereits korrekt ausgewertet
(`lib/auth/webauthn-config.ts`). In dieser Route wird sie nicht
genutzt.

# Umfang

Betroffen ist ausschließlich `app/anmeldung/link/route.ts` — dort
beide Weiterleitungen (Fehlerfall und Erfolgsfall, letzterer sowohl
zur Notfallcode-Anzeige als auch zum eigentlichen Ziel).

Andere Stellen bauen keine absoluten Adressen aus `request.url`.

# Reproduktion

1. Einen Anmeldelink anfordern oder erzeugen
2. Ihn im Browser aufrufen

Ergebnis: Weiterleitung auf `https://0.0.0.0:3000/...`, Seite nicht
erreichbar.

# Akzeptanzkriterien der Behebung

- [ ] Gegeben ein gültiger Anmeldelink, wenn ich ihn aufrufe, dann
      werde ich auf eine Adresse unter `https://dev.wegfara.com`
      weitergeleitet.
- [ ] Gegeben ein gültiger Anmeldelink, wenn ich ihn aufrufe, dann bin
      ich danach angemeldet.
- [ ] Gegeben ein ungültiger Anmeldelink, wenn ich ihn aufrufe, dann
      werde ich auf die Anmeldeseite unter `https://dev.wegfara.com`
      weitergeleitet.
- [ ] Gegeben eine erste Anmeldung, wenn der Link eingelöst wird, dann
      erscheint die Anzeige der Notfallcodes unter
      `https://dev.wegfara.com`.
- [ ] Gegeben die Weiterleitung, wenn ich die Zieladresse betrachte,
      dann enthält sie NICHT `0.0.0.0`.
- [ ] Ein Test deckt ab, dass die Zieladresse der Weiterleitung aus
      der konfigurierten Adresse der Umgebung stammt und nicht aus der
      Adresse der eingehenden Anfrage.

# Constraints

- Die Adresse der Umgebung steht als `APP_URL` zur Verfügung (dev:
  `https://dev.wegfara.com`, prod: `https://app.wegfara.com`). Sie ist
  für beide Umgebungen gesetzt.
- Die Behebung darf nicht dazu führen, dass eine von außen
  beeinflussbare Angabe (etwa der `Host`-Kopf der Anfrage) die
  Zieladresse bestimmt — sonst entstünde eine Weiterleitung auf eine
  fremde Adresse.
