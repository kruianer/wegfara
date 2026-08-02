# <Projektname>

Diese Datei wurde von der appbaua-Umstellung (req-012) angelegt, weil das
Repo noch keine hatte. Sie ist ein Startpunkt — passe sie an und ersetze
die Platzhalter. Eine bereits vorhandene CLAUDE.md wird von der
Umstellung nie angefasst.

## Vision

Zweck und Leitprinzipien dieses Projekts stehen in
[delivery/vision.md](delivery/vision.md). Lässt ein Requirement eine
Grauzone offen, entscheide sie im Sinne dieser Prinzipien.

## DevOps

Deploy, Umgebungen und Promotion-Regeln stehen in
[delivery/devops.md](delivery/devops.md). Befolge sie exakt. Insbesondere:
NIEMALS autonom nach prod deployen.

## Tech Stack

Sprachen, Frameworks, Kommandos, Konventionen und das Glossar stehen in
[delivery/stack.md](delivery/stack.md). Befolge sie exakt.

## Security

Die Sicherheits-Vorgaben für dieses Projekt (Erreichbarkeit, HTTPS,
Zugriffskreis, Backup, Datenschutz) sind in
[delivery/security.md](delivery/security.md) definiert. Der Security-Task
(req-014) prüft dagegen.

## Ideen

Der Worker schlägt einmal pro Tag genau eine neue Idee für dieses Repo
vor und legt sie als .md-Datei in [delivery/idea/](delivery/idea) ab;
umgesetzte Ideen liegen in `delivery/idea/done/`.

## Ideen-Richtung

Die inhaltliche Richtung für automatisch vorgeschlagene Ideen (Task-Typ
"Ideen", req-011) ist in
[delivery/idea-direction.md](delivery/idea-direction.md) definiert.
Berücksichtige sie beim Ideen-Task.

## Areas

Geschäftsfunktions-Bereiche der App, zur Einordnung von Requirements.
Ein Requirement gehört in genau eine Area. Neue Areas werden hier
ergänzt.

- **Reise** — Reisen anlegen, öffnen, wechseln; Zeitraum, Reisetage und
  ihre Auswahl. Umfasst den Begleiter (`/go`), die Sicht für unterwegs.
- **Planung** — der Planer (`/plan`) für breite Bildschirme: POI-Sammlung,
  Tagesplanung, Bewertungsrunden, Kosten, Dokumente, Einstellungen.
