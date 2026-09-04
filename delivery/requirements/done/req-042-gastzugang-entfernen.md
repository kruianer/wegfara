---
id: req-042
title: Gastzugang entfernen
app: wegfara
area: Reise
priority: high
created: 2026-09-04
changes: req-038
---

# Goal (Why)

Als Betreiber lege ich unter „Mein Bereich" die Personen an, die an
einer Reise teilnehmen — und wer teilnimmt, bekommt eine Einladung und
ein eigenes Konto. Einen zweiten, schwächeren Zugangsweg für Zuschauer
ohne Konto brauche ich nicht. Er ist Angriffsfläche und Pflegeaufwand
ohne Nutzen.

# Function (What)

Der Gastzugang aus req-038 wird restlos entfernt.

Es verschwinden: der Bereich „Gastzugänge" im Planer, das Erstellen und
Widerrufen von Gastzugängen, der Einlöse-Link samt QR-Code, die
Gast-Ansicht im Begleiter und die Ablage der Gastzugänge samt
Gast-Sitzungen.

Ein zum Zeitpunkt der Umstellung laufender Gastzugang endet sofort.

Alles Übrige aus req-038 bleibt unverändert: Personen des Accounts
anlegen und entfernen, Einladungen erzeugen und zurückziehen, die Regel
zum letzten Account-Admin.

# Änderung gegenüber heute (req-038)

- Der Bereich „Gastzugänge" entfällt ersatzlos — er wird nicht
  ausgeblendet, sondern entfernt.
- Der Begleiter kennt keine Gast-Ansicht mehr; jeder Zugriff setzt
  wieder eine angemeldete Person voraus.
- Die Einladung (req-023) bleibt der einzige Weg, jemanden in die App zu
  holen.

# Acceptance Criteria

- [ ] Gegeben ich bin als Account-Admin angemeldet, wenn ich den Planer
      öffne, dann gibt es KEINEN Bereich „Gastzugänge".
- [ ] Gegeben ich bin Reiseleiter der Reise „Süditalien Rundreise",
      wenn ich ihre Bereiche durchsehe, dann finde ich KEINE Möglichkeit,
      einen Gastzugang zu erstellen.
- [ ] Gegeben ein Gastlink, der vor der Umstellung erzeugt wurde, wenn
      ich ihn öffne, dann wird der Zugriff abgelehnt.
- [ ] Gegeben jemand schaut gerade als Gast zu, wenn die Umstellung
      eingespielt ist, dann sieht er beim nächsten Aufruf die
      Anmeldeseite.
- [ ] Gegeben ich bin Account-Admin, wenn ich „Mein Bereich" öffne, dann
      kann ich weiterhin eine Person einladen.
- [ ] Gegeben ich bin nicht angemeldet, wenn ich den Begleiter aufrufe,
      dann sehe ich die Anmeldeseite und KEINE Gast-Ansicht.

# Constraints

- Die Migration muss die prod-Daten erhalten (siehe
  [devops.md](../../devops.md)) — entfernt wird ausschließlich, was zum
  Gastzugang gehört. Personen, Einladungen, Reisen und Sitzungen
  angemeldeter Personen bleiben unberührt.

# Out of Scope

- Einladungen und Personenverwaltung aus req-038 — sie bleiben.
- Zusammenlegen der Bereiche zu „Mein Bereich" — das ist req-043.
- Ein Ersatz für den Gastzugang in anderer Form (öffentlicher Link,
  Nur-Lese-Konto).
- Rollen und Rechte über Gesamt-Admin, Account-Admin, Reiseleiter und
  Teilnehmer hinaus.
