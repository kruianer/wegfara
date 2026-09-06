---
id: req-053
title: Backup und Wiederherstellung in der Anwendung
app: wegfara
area: Reise
priority: high
created: 2026-09-06
---

# Goal (Why)

Als Betreiber will ich meine Reisedaten sichern und im Ernstfall
zurückholen können — ohne an Datenbank oder Dateien von Hand
herumzuarbeiten. Heute sichert nur der Deploy-Vorgang, und einen Weg
zurück gibt es überhaupt nicht: Ein Backup, das man nicht einspielen
kann, ist kein Backup.

# Function (What)

Im Bereich „Verwaltung" (nur Gesamt-Admin) gibt es die Backups.

**Sichern.** „Backup erstellen" sichert Datenbankinhalt und Bilddateien
in **einem** Lauf, sodass beide Hälften zueinander passen. Zusätzlich
sichert der prod-Deploy automatisch — über dieselbe Funktion, nicht über
einen eigenen Weg.

**Die Liste** zeigt je Backup Zeitpunkt, Größe und Herkunft („von Hand"
oder „vor Deploy"), neueste zuerst. Darüber steht, wie viel Platz die
Backups belegen und wie viel frei ist. Sind weniger als 10 GB frei,
erscheint eine Warnung. Gelöscht wird nichts von selbst; je Eintrag gibt
es „Löschen".

**Wiederherstellen.** Je Backup „Wiederherstellen". Es erscheint eine
Sicherheitsabfrage, die Zeitpunkt und Herkunft des Backups nennt und
verlangt, das Wort „wiederherstellen" einzutippen. Darin ein Häkchen
„Vorher den jetzigen Stand sichern" — vorausgewählt, aber abwählbar.

Während der Wiederherstellung ist die App gesperrt und zeigt allen einen
Hinweis. Danach sind alle abgemeldet, weil auch die Sitzungen aus dem
Backup stammen.

Nach der Wiederherstellung sind Datenbank und Bilddateien vollständig
auf dem Stand des Backups — ohne Handarbeit an beidem.

**Umgebungen.** Jedes Backup trägt die Umgebung, aus der es stammt. Ein
Backup aus einer anderen Umgebung lässt sich einspielen, die
Sicherheitsabfrage warnt dann ausdrücklich davor. Das ist eine bewusste
Abweichung von [devops.md](../../devops.md) („dev und prod teilen sich
niemals Daten") und kein Versehen: Sie erlaubt, mit echten Daten auf dev
zu prüfen. Die verschlüsselten Zugangsschlüssel je Account (req-028)
sind danach unlesbar und müssen neu gesetzt werden, weil sie am
`AUTH_SECRET` der Umgebung hängen.

# Acceptance Criteria

- [ ] Gegeben ich bin Gesamt-Admin, wenn ich „Verwaltung" öffne, dann
      sehe ich die Liste der Backups.
- [ ] Gegeben ich bin Account-Admin, aber nicht Gesamt-Admin, wenn ich
      die Adresse der Backups direkt aufrufe, dann wird der Zugriff
      abgelehnt.
- [ ] Gegeben ich bin Gesamt-Admin, wenn ich „Backup erstellen" wähle,
      dann erscheint danach ein neuer Eintrag mit dem heutigen Datum in
      der Liste.
- [ ] Gegeben ein erstelltes Backup, wenn ich seinen Eintrag ansehe,
      dann steht dort seine Größe.
- [ ] Gegeben ein Backup, das der prod-Deploy erzeugt hat, wenn ich es
      in der Liste ansehe, dann steht als Herkunft „vor Deploy".
- [ ] Gegeben auf dem Datenträger sind weniger als 10 GB frei, wenn ich
      die Liste öffne, dann sehe ich eine Warnung.
- [ ] Gegeben auf dem Datenträger sind 200 GB frei, wenn ich die Liste
      öffne, dann sehe ich KEINE Warnung.
- [ ] Gegeben ich lösche einen POI und erstelle danach ein Backup, wenn
      ich dieses Backup wiederherstelle, dann ist der POI weiterhin
      gelöscht.
- [ ] Gegeben ein Backup von gestern, wenn ich es heute wiederherstelle,
      dann sind die Reisen auf dem Stand von gestern.
- [ ] Gegeben ein Backup mit einem Beleg-Bild, wenn ich es
      wiederherstelle, dann lässt sich das Bild danach in der App
      anzeigen.
- [ ] Gegeben ich wähle „Wiederherstellen", wenn ich das Wort
      „wiederherstellen" NICHT eintippe, dann wird nichts
      wiederhergestellt.
- [ ] Gegeben die Sicherheitsabfrage, wenn ich sie öffne, dann ist das
      Häkchen „Vorher den jetzigen Stand sichern" vorausgewählt.
- [ ] Gegeben ich lasse dieses Häkchen gesetzt, wenn die
      Wiederherstellung fertig ist, dann liegt ein zusätzliches Backup
      des vorherigen Standes in der Liste.
- [ ] Gegeben eine laufende Wiederherstellung, wenn ich die App aufrufe,
      dann sehe ich einen Hinweis darauf und NICHT den gewohnten Inhalt.
- [ ] Gegeben ich war angemeldet, wenn eine Wiederherstellung fertig
      ist, dann sehe ich die Anmeldeseite.
- [ ] Gegeben ein Backup aus einer anderen Umgebung, wenn ich es
      wiederherstellen will, dann warnt mich die Sicherheitsabfrage
      ausdrücklich davor.
- [ ] Gegeben ein prod-Deploy läuft, wenn ich danach die Backups ansehe,
      dann ist ein neues Backup entstanden.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich den prod-Workflow
      ansehe, dann sichert er über die Funktion der Anwendung und NICHT
      über ein eigenes Skript.

# Constraints

- Backup ist Teil der Anwendung, nicht der Infrastruktur; DB-Inhalt und
  Bilddateien werden in einem gemeinsamen Lauf gesichert und müssen
  zueinander passen (siehe [stack.md](../../stack.md)). Ein Backup mit
  Datensätzen ohne die zugehörigen Dateien — oder umgekehrt — ist
  kaputt.
- Die Wiederherstellung muss vollständig aus dem Backup möglich sein,
  ohne Handarbeit an Datenbank oder Dateisystem
  ([stack.md](../../stack.md)).
- Vor der Promotion nach prod muss ein aktuelles Backup vorliegen
  ([devops.md](../../devops.md)).
- Backups liegen unter `~/wegfara-backups/` auf dem Beelink, außerhalb
  des Repos ([devops.md](../../devops.md)).
- Die verschlüsselten Zugangsschlüssel je Account hängen am
  `AUTH_SECRET` der Umgebung (req-028) — ein Backup allein lässt sich
  nicht auswerten.

# Out of Scope

- Backups auf einen anderen Rechner oder in eine Cloud auslagern.
- Zeitgesteuerte Backups (nächtlich, wöchentlich).
- Einzelne Accounts, Reisen oder Zeiträume gesondert sichern oder
  zurückholen.
- Automatisches Löschen alter Backups — es wird nur gewarnt.
- Backups herunterladen oder hochladen.
