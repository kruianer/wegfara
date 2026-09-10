---
id: bug-027
app: wegfara
req: req-026
priority: high
created: 2026-09-10
---

# Observed

Auf dev einen POI aus dem Google-Link angelegt („inatura – Erlebnis
Naturschau Dornbirn"). Der POI entsteht mit Name, Adresse und Position —
die Bilder fehlen aber alle.

# Expected

Der POI aus einem Google-Maps-Link bringt bis zu drei Fotos mit (req-026);
das erste ersetzt in der POI-Zeile die farbige Fläche. Lässt sich ein Bild
nicht ablegen, muss das gemeldet werden — still bleiben darf es nie
(bug-021).

# Befund

Auf dev nachgemessen (2026-09-10):

- Der POI ist korrekt aus Google angelegt: `google_place_id` ist gesetzt
  (`ChIJa2Jgjkprm0cROqCfut0cuFM`), Fotos: **0**.
- Der Google-Aufruf liefert die Fotonamen mit — daran liegt es nicht.
- **Das Bildverzeichnis ist für die Anwendung nicht beschreibbar.** Der
  Container läuft als `nextjs` (uid 1001, Gruppe `nogroup`/65533), das
  gemountete Verzeichnis `~/wegfara-data/dev/images` auf dem Host gehört
  uid 1000 mit `drwxrwxr-x`. Ein `touch` im Container scheitert mit
  `Permission denied`.

Das Dockerfile setzt zwar `chown -R nextjs:nodejs /data` (Zeile 34), aber
der Volume-Mount aus `deploy/docker-compose.yml` legt sich beim Start
darüber — die Rechte des Hosts gewinnen.

**Auf dev ist es behoben** (`chown -R 1001:65533 /data/images` über den
Container als root). **Auf prod steht dasselbe Problem vermutlich noch
an** — dort ist es unbedingt zu prüfen, bevor jemand einen POI aus einem
Google-Link anlegt.

# Zu tun

1. **Den stillen Fehlschlag beenden.** `uebernehmeGoogleFotos()` in
   `lib/pois/google-photos.ts` überspringt ein Bild, das sich nicht
   speichern lässt, im `catch` wortlos — und wenn die Bildablage gar nicht
   erst nutzbar ist, gibt sie stumm ein leeres Ergebnis zurück. Beides
   gehört gemeldet: der POI entsteht, aber der Nutzer erfährt, dass die
   Bilder nicht abgelegt werden konnten.

2. **Die Rechte dauerhaft richtig setzen**, damit es nach dem nächsten
   Deploy und auf einer frischen Umgebung nicht wiederkommt. Denkbar wäre,
   das Verzeichnis beim Start der Anwendung anzulegen und die Rechte zu
   prüfen, statt sich auf ein `chown` im Dockerfile zu verlassen, das der
   Mount überschreibt.

3. **Die Gesundheitsprüfung sollte es fangen.** Ein Bildverzeichnis, in das
   die Anwendung nicht schreiben kann, ist ein Fehlerzustand — die
   Zustandsübersicht (siehe [health.md](../../health.md)) sollte ihn
   melden, statt dass er erst beim ersten Foto auffällt.

# Steps

1. Planer öffnen, Bereich POIs, „POI anlegen"
2. `https://maps.app.goo.gl/AtmT9iWJpmweLMYk8` in die erste Zeile einfügen
3. Speichern — der POI ist da, Fotos fehlen, keine Meldung
