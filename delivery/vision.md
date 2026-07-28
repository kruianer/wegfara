---
project: wegfara
---

# Vision

Verbindlicher Kompass für den autonomen Worker. Lässt ein Requirement
eine Grauzone offen, entscheide sie im Sinne der Prinzipien unten.

## Problem (Why)

Reisepläne halten der Realität nicht stand: das Museum ist zu, der Stau
frisst zwei Stunden, die Schlange dauert noch dreißig Minuten. wegfara
plant KI-gestützt und begleitet die Reise dann weiter — es vergleicht
den Plan per GPS mit der tatsächlichen Lage, nimmt Hinweise des Nutzers
entgegen ("stehe im Stau", "Restaurant geschlossen") und schlägt eine
Anpassung vor. Nebenbei hält es die Gruppe zusammen: gemeinsame Kasse,
Belege, und wer sich verliert, findet die anderen wieder.

## Audience

Der Autor und sein privater Kreis aus Familie und Freunden, die
gemeinsam reisen — planen vorab, unterwegs auf demselben Plan. Kein
anonymes Publikum: Onboarding für Fremde und Skalierung sind nicht der
Maßstab.

## Produkt

Ein Produkt in zwei Modi, mit gemeinsamen Daten, Gruppe und Konten:

- **Planer:** die KI schlägt eine Reise vor, die Gruppe stimmt ab, der
  Nutzer plant leicht um.
- **Begleiter (Smartphone, unterwegs):** prüft den Plan gegen die Lage,
  schlägt Anpassungen vor, verlinkt POIs und Navigation, trackt
  Gruppenausgaben mit gegenseitiger Verrechnung, legt Belege und Tickets
  ab, zeigt während der Reise die Position der Mitreisenden, lädt per
  QR-Code ein.

## Guiding Principles (tie-breakers)

- Im Zweifel: vorschlagen statt selbst umbauen — wegfara ändert einen
  bestehenden Plan nie ohne Bestätigung des Nutzers.
- Im Zweifel: wenige Schritte statt viele Optionen — die KI entscheidet,
  der Nutzer korrigiert.
- Im Zweifel: ein konkreter, änderbarer Vorschlag statt ein leeres
  Formular.
- Im Zweifel: Open Source und selbst gehostet statt proprietärer Dienst
  — proprietär nur, wo es keine brauchbare Alternative gibt, und dann
  nur verlinkt, ohne Nutzerdaten abzugeben.
- Im Zweifel: Standortdaten sparsam — Positionen der Gruppe nur bei
  aktiver Reise, nur mit Zustimmung des Teilnehmers, ohne Historie.
- Im Zweifel: weniger Funktionen, aber fertig, statt mehr und roh.

## Non-Goals

- Kein Buchungsportal: wegfara bucht und bezahlt nichts — keine Flüge,
  Hotels, Tickets. Es plant und legt höchstens Belege ab.
- Kein öffentliches Netzwerk: keine Feeds, Follower, öffentlichen
  Reiseberichte, Likes. Geteilt wird nur innerhalb der eigenen
  Reisegruppe.
- Kein Bezahldienst: Ausgaben werden erfasst und verrechnet, aber kein
  Geld bewegt.
- Vorerst kein Produkt für den anonymen Massenmarkt: gebaut und
  betrieben für den privaten Kreis des Autors, mit genau einem Mandanten.
  Kein Onboarding für Fremde, keine offene Registrierung, keine
  Account-Verwaltung. Ein späterer Verkauf ist nicht ausgeschlossen —
  deshalb ist das Datenmodell mandantenfähig (siehe
  [stack.md](stack.md)), der Funktionsumfang aber nicht.
