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

# Behoben (2026-09-10)

**Der stille Fehlschlag ist beendet.** `uebernehmeGoogleFotos()` in
`lib/pois/google-photos.ts` liefert nicht mehr nur die Bilder, sondern auch
den Grund, wenn welche fehlen (`GoogleFotoErgebnis`). Drei Gründe gibt es,
in dieser Reihenfolge ihres Gewichts (`lib/pois/google-foto-problem.ts`):
`ablage_fehlt` — die Bildablage ist gar nicht nutzbar, `nicht_gespeichert` —
ein geholtes Bild ließ sich nicht schreiben (der wortlose `catch`),
`nicht_geholt` — Google gab ein angekündigtes Bild nicht heraus. Das leere
Ergebnis ohne Erklärung gibt es nicht mehr: ohne Ablage kommt der Stand aus
der Datenbank zurück, damit vorhandene Bilder nicht gegen nichts getauscht
werden.

Der Grund geht durch beide Wege, auf denen Bilder aus Google entstehen, bis
in die Oberfläche: `/api/pois` (POST und PUT) und `/api/poi-search` schicken
ihn als `fotoProblem` mit. Beim POI aus dem Suchfeld steht die Meldung über
der POI-Liste (`poi-list.tsx`) und nicht im Formular — beim Anlegen schließt
sich das Formular mit dem Speichern, eine Meldung darin wäre nie zu lesen.
Bei der KI-Suche steht sie unter der Ergebniszeile. **Der POI entsteht in
jedem Fall**; gemeldet wird, dass seine Bilder es nicht getan haben
(bug-021).

**Die Rechte setzt jetzt der Start und nicht mehr das Dockerfile.**
`deploy/docker-entrypoint.sh` läuft als root, legt `IMAGE_DIR` und
`BACKUP_DIR` an, übereignet sie `nextjs:nodejs` und wechselt über `su-exec`
auf `nextjs`, bevor die Anwendung startet. Damit greift es nach dem
Volume-Mount statt davor — genau daran scheiterte das `chown` im Dockerfile.
Durchgereicht (`chown -R`) wird nur, wenn die oberste Ebene noch nicht passt.
Nebenbei behoben: `adduser` legte `nextjs` ohne `-G nodejs` an, seine
Hauptgruppe war deshalb `nogroup` (65533).

**Die Gesundheitsprüfung fängt es.** `lib/images/bildablage-pruefung.ts`
legt das Bildverzeichnis an und probiert einen echten Schreibvorgang aus —
Rechtebits allein sagen nicht, ob geschrieben werden kann. Geprüft wird das
beim Hochfahren (`instrumentation.ts`, Befund ins Log) und bei jedem Aufruf
von `/api/health`: eine unbeschreibbare Ablage antwortet mit `503` und
`{"status":"fehler","bildablage":{"ok":false,"problem":"nicht_beschreibbar"}}`.
Der Pfad geht dabei nicht hinaus — der Endpunkt ist öffentlich. Der
Compose-Healthcheck macht daraus ein `unhealthy` in `docker compose ps`.

**Auf prod ist es damit erledigt**, sobald dort einmal neu gebaut und
gestartet wird: das Einstiegsskript setzt die Rechte selbst. Bleibt doch
etwas offen, sagt es `/api/health`, bevor jemand einen POI aus einem
Google-Link anlegt.

Volle Suite grün: 3027 Unit-Tests, 11 E2E-Tests, Lint und `tsc --noEmit`.
Das Container-Abbild selbst wurde nicht gebaut — auf dieser Maschine gibt es
kein Docker; geprüft ist die Syntax des Einstiegsskripts und sein Lauf ohne
root.
