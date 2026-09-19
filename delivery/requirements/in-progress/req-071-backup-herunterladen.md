---
id: req-071
title: Backup herunterladen und wieder einspielen
app: wegfara
area: Planung
priority: normal
created: 2026-09-19
---

# Goal (Why)

Als Betreiber habe ich Backups — aber sie liegen auf demselben Rechner wie
die App, die sie sichern. Geht der Beelink kaputt oder abhanden, sind
Reisen, Fotos und Sicherungen zugleich weg.

Für „ich habe vor dem Deploy etwas kaputt gemacht" reicht die vorhandene
Wiederherstellung (req-053). Gegen den Verlust des Rechners hilft sie
nicht. Dafür muss ich ein Backup **vom Server herunterholen** können — auf
mein iPad, in meine Cloud, auf einen Stick.

# Function (What)

## Herunterladen

In der Verwaltung trägt jedes Backup in der Liste einen Weg zum
**Herunterladen**. Er liefert eine einzelne **ZIP-Datei** mit genau dem,
was das Backup schon enthält (req-053):

- `datenbank.json` — der Tabelleninhalt
- `images/` — die Bilddateien
- `manifest.json` — Zeitpunkt, Herkunft, Umgebung, Zähler

Der Dateiname nennt Umgebung und Zeitpunkt, sodass sich zwei
heruntergeladene Backups nicht verwechseln lassen.

Am Backup auf dem Server ändert sich dabei nichts: Es wird nicht
verschoben, nicht gelöscht und nicht umgewandelt. Das ZIP entsteht beim
Herunterladen.

## Wieder einspielen

Eine so heruntergeladene ZIP-Datei lässt sich in der Verwaltung wieder
**hochladen**. Sie erscheint danach in der Liste der Backups wie jedes
andere und lässt sich mit dem vorhandenen Weg wiederherstellen (req-053) —
samt seiner Sicherheitsabfrage und samt der Warnung, wenn das Backup aus
einer anderen Umgebung stammt.

Passt die Datei nicht — kein ZIP, fehlende Bestandteile, unlesbares
Manifest —, sagt die Anwendung **was** ihr fehlt und nimmt sie nicht an.

# Acceptance Criteria

- [x] Gegeben ich bin Gesamt-Admin und sehe die Backup-Liste, wenn ich
      ein Backup herunterlade, dann erhalte ich eine ZIP-Datei.
- [x] Gegeben ich öffne die heruntergeladene Datei, wenn ich hineinsehe,
      dann enthält sie `datenbank.json`, `manifest.json` und den Ordner
      `images` mit den Bildern.
- [x] Gegeben ich lade zwei Backups verschiedener Zeitpunkte herunter,
      wenn ich die Dateinamen ansehe, dann unterscheiden sie sich und
      nennen Umgebung und Zeitpunkt.
- [x] Gegeben ich habe ein Backup heruntergeladen, wenn ich danach die
      Backup-Liste ansehe, dann ist es dort unverändert vorhanden.
- [x] Gegeben ich lade eine heruntergeladene ZIP-Datei wieder hoch, wenn
      ich die Liste ansehe, dann steht das Backup darin.
- [x] Gegeben ein hochgeladenes Backup steht in der Liste, wenn ich es
      wiederherstelle, dann verlangt die Anwendung dasselbe Wort wie bei
      jedem anderen und stellt danach Daten und Bilder wieder her.
- [x] Gegeben ich lade eine Datei hoch, die kein ZIP ist, wenn ich auf
      den Bildschirm sehe, dann steht dort der Grund und die Liste ist
      unverändert.
- [x] Gegeben ich lade ein ZIP ohne `datenbank.json` hoch, wenn ich auf
      den Bildschirm sehe, dann steht dort, dass dieser Bestandteil
      fehlt.
- [x] Gegeben ich bin Account-Admin und nicht Gesamt-Admin, wenn ich die
      Adresse zum Herunterladen direkt aufrufe, dann werde ich
      abgewiesen.
- [x] Gegeben ich bin nicht angemeldet, wenn ich die Adresse zum
      Herunterladen direkt aufrufe, dann werde ich abgewiesen.
- [ ] Gegeben die Backup-Karte ist auf 375 px, 768 px und 1280 px zu
      sehen, wenn ich sie bediene, dann sind Herunterladen und Hochladen
      auf allen dreien erreichbar (siehe [stack.md](../../stack.md)).

# Constraints

- Zugriff hat ausschliesslich der **Gesamt-Admin** — dieselbe Regel wie
  für die übrigen Backup-Adressen (req-053, `lib/auth/api-guard.ts`).
- Das Format der Backups auf dem Server bleibt wie es ist: ein
  Verzeichnis. Das ZIP ist die Verpackung fürs Herunterladen, kein neues
  Backup-Format.
- Ein hochgeladenes Backup wird **nicht automatisch wiederhergestellt**.
  Es landet in der Liste; das Wiederherstellen bleibt ein eigener,
  bestätigter Schritt (req-053).
- Beim Wiederherstellen gilt weiterhin, dass nur übernommen wird, was ins
  aktuelle Schema passt (`readSchema`, req-053).
- Ein Backup kann groß sein (Bilder). Weder das Erzeugen des ZIP noch das
  Hochladen darf den Arbeitsspeicher der Anwendung mit der vollen Datei
  belasten, wenn es sich vermeiden lässt.
- Ein Fehler beim Herunterladen oder Hochladen wird benannt und nicht
  verschluckt (vgl. bug-021, bug-026, bug-027, bug-032).

# Out of Scope

- Backups automatisch irgendwohin schicken (Cloud, Netzlaufwerk, E-Mail).
- Ein Zeitplan für Backups.
- Backups verschlüsseln oder mit einem Passwort versehen.
- Einzelne Reisen aus einem Backup herauslösen.
- Das Backup-Format auf dem Server auf ZIP umstellen.
