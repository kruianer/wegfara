---
id: req-026
title: POI aus einem Google-Maps-Link anlegen
app: wegfara
area: Planung
priority: normal
created: 2026-09-03
---

# Ziel (Warum)

Wenn mir jemand einen Ort empfiehlt, bekomme ich meist einen
Google-Maps-Link geschickt. Ich will ihn einfügen und daraus einen
fertigen POI erhalten — statt Name, Adresse und Position von Hand
abzutippen.

# Funktion (Was)

Im Bereich „POIs" gibt es ein Eingabefeld für einen
Google-Maps-Link. Nach dem Einfügen wird der Ort dort nachgeschlagen
und als POI der geöffneten Reise angelegt.

Übernommen werden: Name, Adresse, geografische Position, Art des Ortes,
Webseite, Telefonnummer, Öffnungszeiten und bis zu drei Fotos. Die
Fotos werden heruntergeladen und gespeichert.

Die Art des Ortes wird auf einen der sieben POI-Typen abgebildet. Lässt
sie sich nicht zuordnen, gilt „Sehenswürdigkeit".

Der neue POI erhält den Status „Weiß noch nicht" und die nächste freie
Nummer der Reise.

Ist derselbe Ort bereits als POI der Reise vorhanden, wird kein zweiter
angelegt: Seine Angaben werden aufgefrischt, seine Nummer und sein
Status bleiben erhalten.

Lässt sich der Link nicht auswerten oder der Ort nicht finden, wird
kein POI angelegt und ein Hinweis nennt den Grund.

# Neue Angaben am POI

Ein POI trägt künftig zusätzlich Adresse, Telefonnummer,
Öffnungszeiten und Fotos. Diese Angaben sind freiwillig — von Hand
angelegte POIs haben sie nicht.

Adresse, Telefonnummer und Öffnungszeiten erscheinen im aufgeklappten
Detail der POI-Zeile. Das erste Foto ersetzt dort die farbige Fläche
aus req-010.

# GUI

- Das Eingabefeld liegt über der POI-Liste, neben der KI-Suche aus
  req-014, im selben Stil.
- Während der Abfrage ist es gesperrt und zeigt, dass gearbeitet wird.
- Danach erscheint eine Zeile mit dem Ergebnis: angelegt, aufgefrischt
  oder Grund des Fehlschlags.

# Akzeptanzkriterien

- [ ] Gegeben der Bereich „POIs" ist geöffnet, wenn ich einen
      Google-Maps-Link zur Villa Rufolo einfüge, dann erscheint ein POI
      mit dem Namen „Villa Rufolo" in der Liste.
- [ ] Gegeben derselbe Vorgang, wenn ich den neuen POI aufklappe, dann
      steht dort seine Adresse.
- [ ] Gegeben derselbe Vorgang, wenn ich den neuen POI aufklappe, dann
      sehe ich ein Foto des Ortes.
- [ ] Gegeben derselbe Vorgang, wenn ich den neuen POI betrachte, dann
      hat er den Status „Weiß noch nicht".
- [ ] Gegeben die Villa Rufolo ist bereits als POI vorhanden, wenn ich
      denselben Link erneut einfüge, dann enthält die Liste weiterhin
      genau einen POI „Villa Rufolo".
- [ ] Gegeben ein bereits vorhandener POI mit dem Status „Gesetzt",
      wenn ich seinen Link erneut einfüge, dann hat er weiterhin den
      Status „Gesetzt".
- [ ] Gegeben ich füge einen Text ein, der kein Google-Maps-Link ist,
      wenn die Verarbeitung abgeschlossen ist, dann wird KEIN POI
      angelegt.
- [ ] Gegeben derselbe Fall, wenn ich die Ergebniszeile betrachte, dann
      nennt sie den Grund.
- [ ] Gegeben ein POI ohne Fotos, wenn ich ihn in der Liste betrachte,
      dann erscheint dort weiterhin die farbige Fläche seines Typs.
- [ ] Gegeben ein angelegter POI mit drei Fotos, wenn ich die
      Bildablage betrachte, dann liegen dort genau drei Dateien zu
      diesem POI.

# Constraints

- Die Daten stammen aus der Places-Schnittstelle von Google. Sie
  erfordert einen Zugangsschlüssel, der ausschließlich in den
  Umgebungsvariablen liegt.
- **Bewusste Abweichung, vorläufig:** Googles Nutzungsbedingungen
  untersagen das dauerhafte Speichern der abgerufenen Inhalte; erlaubt
  wäre nur die Kennung des Ortes. wegfara speichert sie dennoch, damit
  Reisepläne ohne wiederholte Abfragen bestehen. Das ist eine
  Entscheidung des Betreibers für den privaten Betrieb und wird später
  auf einen zulässigen Weg umgestellt. Bis dahin gilt: Die Daten
  verlassen die Anwendung nicht, und ein Verkauf der Anwendung setzt
  ihre Entfernung voraus (siehe [vision.md](../../vision.md)).
- Fotos werden nach der Regel aus [stack.md](../../stack.md) abgelegt:
  Datei im Bildverzeichnis, zu jeder Datei ein Datensatz in der
  Datenbank. Keine verwaisten Dateien, kein Datensatz ohne Datei.
- Beim Entfernen eines POI werden seine Fotos mitentfernt.

# Nicht Teil dieses Requirements

- Anlegen eines POI von Hand über ein Formular
- Nachträgliches Auffrischen aller POIs auf Knopfdruck
- Bewertungen und Rezensionen aus Google
- Anzeige der Öffnungszeiten im Begleiter
- Hinweis, wenn ein Programmpunkt außerhalb der Öffnungszeiten liegt
- Übernahme von Fotos zu Programmpunkten
- Eine Begrenzung der Zahl täglicher Abfragen
