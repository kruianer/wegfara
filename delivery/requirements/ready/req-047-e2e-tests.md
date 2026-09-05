---
id: req-047
title: Kritische Flüsse im echten Browser prüfen
app: wegfara
area: Planung
priority: high
created: 2026-09-05
---

# Goal (Why)

Ein POI wurde beim Speichern nicht gespeichert, und niemand hat es
gemerkt — weder ein Test noch die App selbst (bug-020, bug-021). Der
Grund: Formular und Schnittstelle werden heute getrennt voneinander
geprüft, jeweils mit Attrappen. Genau die Naht dazwischen — die
Oberfläche schreibt in die echte Datenbank und liest wieder daraus —
prüft niemand. Als Betreiber will ich, dass ein solcher Fehler auffällt,
bevor ich ihn auf dev finde.

# Function (What)

Die Anwendung bekommt eine zweite Prüfebene: Tests, die die App im
echten Browser bedienen und dabei gegen eine echte Datenbank laufen —
so, wie ein Mensch sie bedient. Sie ergänzen die vorhandenen Tests, sie
ersetzen keinen davon.

Geprüft werden diese Flüsse, jeweils bis zum Wiederfinden nach einem
Neuladen der Seite:

1. **POI anlegen** — POI von Hand anlegen, speichern, Seite neu laden,
   der POI steht in der Liste.
2. **Reise anlegen** — neue Reise über die Reisedetails anlegen,
   speichern, Seite neu laden, die Reise ist geöffnet.
3. **POI verplanen** — POI auf den Zeitstrahl ziehen, Seite neu laden,
   der Programmpunkt liegt an seiner Stelle.
4. **Anmelden** — mit Passkey anmelden und eine geschützte Seite
   erreichen.

Ein fehlgeschlagener Schreibvorgang muss dabei auffallen: Ein Test, der
speichert und danach nichts wiederfindet, schlägt fehl.

Diese Tests laufen als eigener Schritt vor der Promotion nach prod, mit
einem eigenen Kommando. Sie sind Teil des Quality-Gates: Sind sie rot,
wird nicht promotet.

[stack.md](../../stack.md) und [devops.md](../../devops.md) werden
danach auf den neuen Stand gebracht — das Kommando und die Regel, dass
diese Tests vor der Promotion grün sein müssen.

# Acceptance Criteria

- [ ] Gegeben das Repo, wenn ich das Kommando für diese Tests ausführe,
      dann laufen sie und melden am Ende, wie viele erfolgreich waren.
- [ ] Gegeben die Anwendung funktioniert, wenn die Tests laufen, dann
      sind alle vier Flüsse grün.
- [ ] Gegeben das Speichern eines POI schreibt nicht in die Datenbank,
      wenn die Tests laufen, dann schlägt der Fluss „POI anlegen" fehl.
- [ ] Gegeben ein Test hat einen POI angelegt, wenn derselbe Test erneut
      läuft, dann ist er wieder grün — die Tests stören einander nicht.
- [ ] Gegeben die Tests laufen, wenn ich danach die dev-Umgebung
      ansehe, dann sind dort KEINE Testdaten entstanden.
- [ ] Gegeben die Tests laufen, wenn ich die Kosten prüfe, dann wurde
      KEINE Anfrage an OpenAI oder Google Places gestellt.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [stack.md](../../stack.md) öffne, dann steht das Kommando für
      diese Tests dort.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [devops.md](../../devops.md) öffne, dann steht dort, dass diese
      Tests vor der Promotion nach prod grün sein müssen.

# Constraints

- Die Tests laufen auf dem self-hosted Runner auf dem Beelink (siehe
  [devops.md](../../devops.md)) — sie dürfen keine Dienste voraussetzen,
  die dort nicht laufen.
- Kostenpflichtige und fremde Dienste (OpenAI, Google Places, Nominatim,
  Overpass) werden auch hier nicht echt angesprochen (siehe
  [stack.md](../../stack.md), Testing).
- Die Tests fassen weder die prod-Datenbank noch das prod-Bildverzeichnis
  an ([devops.md](../../devops.md), Hard Rules).
- Playwright ist als Werkzeug dafür bereits in
  [stack.md](../../stack.md) vorgesehen.

# Out of Scope

- Die Ursache von bug-020 und bug-021 beheben — das sind die Bugs
  selbst; dieses Requirement sorgt dafür, dass es künftig auffällt.
- Tests für Ausgaben, Salden, Ausgleich, Dokumente, Einladungen und die
  Verwaltung.
- Tests auf echten Geräten (iPhone, iPad) oder in mehreren Browsern.
- Last- und Geschwindigkeitstests.
