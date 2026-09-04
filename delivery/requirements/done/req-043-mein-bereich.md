---
id: req-043
title: Mein Bereich als eine Stelle für alles zum Account
app: wegfara
area: Reise
priority: normal
created: 2026-09-04
changes: req-032, req-038
---

# Goal (Why)

Als Nutzer suche ich heute an drei Stellen: meine Geräte unter „Konto",
die Zugangsschlüssel unter „Account", die Personen unter „Nutzer". Ich
will eine Stelle — „Mein Bereich" —, an der alles steht, was zu mir und
meinem Account gehört, und an die später Weiteres dazukommt.

# Function (What)

Die Bereiche „Konto", „Account" und „Nutzer" werden zu einem Bereich
„Mein Bereich" zusammengelegt. Er steht im Kopfbereich neben den
übrigen Bereichen und ist aus dem Planer wie aus dem Begleiter
erreichbar.

Er zeigt Karten untereinander:

- **Meine Geräte** — die eigenen Passkeys, hinzufügen und entfernen,
  „Überall abmelden".
- **Notfallcodes** — nur für Reiseleiter, wie bisher.
- **Personen** — die Personen des Accounts, anlegen, ändern, entfernen.
- **Einladungen** — Zugangslink erzeugen, offene Einladungen mit
  Ablaufdatum sehen und zurückziehen.
- **Zugangsschlüssel** — die Schlüssel für KI-Suche und Google.

Wer kein Account-Admin ist, sieht nur „Meine Geräte" und —als
Reiseleiter— „Notfallcodes". Die übrigen Karten erscheinen gar nicht.

Der Bereich „Verwaltung" des Gesamt-Admins bleibt davon getrennt: er
betrifft alle Accounts, „Mein Bereich" genau einen.

# Änderung gegenüber heute (req-032, req-038)

- Die Bereiche „Konto", „Account" und „Nutzer" gibt es einzeln nicht
  mehr; ihr Inhalt steht in „Mein Bereich".
- „Mein Bereich" ist aus beiden Teilen der App erreichbar — „Konto" lag
  bisher außerhalb von Planer und Begleiter, „Account" und „Nutzer" nur
  im Planer.
- Was die einzelnen Karten tun, ändert sich nicht.

# Acceptance Criteria

- [x] Gegeben ich bin als Account-Admin angemeldet, wenn ich den Planer
      öffne, dann sehe ich im Kopfbereich „Mein Bereich".
- [x] Gegeben ich bin als Account-Admin angemeldet, wenn ich „Mein
      Bereich" öffne, dann sehe ich die Karten Meine Geräte, Personen,
      Einladungen und Zugangsschlüssel untereinander.
- [x] Gegeben ich bin Teilnehmer ohne Account-Admin und ohne
      Reiseleitung, wenn ich „Mein Bereich" öffne, dann sehe ich
      ausschließlich die Karte „Meine Geräte".
- [x] Gegeben ich bin Teilnehmer ohne Account-Admin, wenn ich die
      Adresse der Personenverwaltung direkt aufrufe, dann wird der
      Zugriff abgelehnt.
- [x] Gegeben ich bin im Begleiter angemeldet, wenn ich „Mein Bereich"
      öffne, dann kann ich einen Passkey für dieses Gerät hinzufügen.
- [x] Gegeben ich bin als Account-Admin angemeldet, wenn ich in „Mein
      Bereich" eine Person einlade, dann sehe ich den Zugangslink als
      Text und als QR-Code.
- [x] Gegeben ich bin als Account-Admin angemeldet, wenn ich in „Mein
      Bereich" den Zugangsschlüssel für die KI-Suche setze, dann zeigt
      die Karte danach seine letzten vier Zeichen.
- [x] Gegeben ich bin angemeldet, wenn ich den Planer öffne, dann gibt
      es KEINEN Bereich „Konto", „Account" oder „Nutzer" mehr.
- [x] Gegeben ich bin Gesamt-Admin, wenn ich den Planer öffne, dann sehe
      ich „Verwaltung" weiterhin als eigenen Bereich neben „Mein
      Bereich".

# Constraints

- Die eigenen Geräte müssen auch unterwegs erreichbar bleiben: wer nur
  das Smartphone dabei hat, richtet dort einen Passkey ein. Ein Bereich
  allein im Planer würde ihn aussperren.

# Out of Scope

- Änderungen daran, was die einzelnen Karten tun — sie werden nur
  zusammengeführt.
- Der Bereich „Verwaltung" des Gesamt-Admins.
- Gastzugänge — sie entfallen mit req-042.
- Neue Einstellungen, die es heute noch nicht gibt.
