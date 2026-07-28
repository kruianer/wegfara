---
id: req-005
title: Buchungsstatus am Programmpunkt
app: wegfara
area: Reise
priority: normal
created: 2026-07-28
---

# Ziel (Warum)

Als Reisender will ich auf einen Blick erkennen, ob ein Programmpunkt
schon gebucht ist — und wenn nicht, ihn ohne Umwege buchen, anfragen
oder dort anrufen können. Unterwegs entscheidet das, ob ein Tisch noch
frei ist oder wir vor verschlossener Tür stehen.

# Funktion (Was)

Jeder Programmpunkt trägt einen Buchungszustand: gebucht oder nicht
gebucht. Ist er gebucht, erscheint an ihm eine grün gehaltene
Schaltfläche „Unterlagen" mit Dokumentsymbol.

Ist er nicht gebucht, erscheint genau eine Schaltfläche, die sich nach
dem hinterlegten Kontaktweg richtet:
- Webadresse hinterlegt → „Buchen" mit Globussymbol, öffnet die Seite
  in einem neuen Fenster
- sonst E-Mail-Adresse hinterlegt → „Anfragen" mit Briefsymbol, öffnet
  eine neue Nachricht an diese Adresse
- sonst Telefonnummer hinterlegt → „Anrufen" mit Hörersymbol, startet
  einen Anruf an diese Nummer

Sind mehrere Kontaktwege hinterlegt, gilt diese Rangfolge: Webadresse
vor E-Mail vor Telefon. Es erscheint immer nur eine Schaltfläche.

Ist kein Kontaktweg hinterlegt und der Programmpunkt nicht gebucht,
erscheint an dieser Stelle keine Schaltfläche.

An Symbol und Beschriftung ist erkennbar, was beim Anklicken passiert.

Zur Erprobung enthalten die Programmpunkte alle vier Fälle: gebucht,
mit Webadresse, mit E-Mail-Adresse, mit Telefonnummer.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt „POI-Karte" — Buchungs-Schaltfläche als Pille, 12 px fett,
  stets einzeilig. Gebucht in `--good`/`--goodSoft`, alle anderen in
  `--acc`/`--accSoft`.
- Verbindlichkeit: eng folgen.
- Abweichung zur Vorlage: Die Schaltfläche „Unterlagen" wird
  dargestellt, ist aber ohne Funktion — eine Ablage für Reiseunterlagen
  existiert noch nicht. Die Schaltflächen „Info" und „Navigation" aus
  der Vorlage sind nicht Teil dieses Requirements.

# Akzeptanzkriterien

- [x] Gegeben ein gebuchter Programmpunkt, wenn ich ihn betrachte, dann
      trägt seine Schaltfläche die Beschriftung „Unterlagen".
- [x] Gegeben ein gebuchter Programmpunkt, wenn ich seine Schaltfläche
      betrachte, dann ist sie in der Farbe `--good` gehalten.
- [x] Gegeben ein nicht gebuchter Programmpunkt mit hinterlegter
      Webadresse, wenn ich ihn betrachte, dann trägt seine Schaltfläche
      die Beschriftung „Buchen".
- [x] Gegeben derselbe Programmpunkt, wenn ich „Buchen" anklicke, dann
      öffnet sich die hinterlegte Webseite in einem neuen Fenster.
- [x] Gegeben ein nicht gebuchter Programmpunkt, bei dem nur eine
      E-Mail-Adresse hinterlegt ist, wenn ich ihn betrachte, dann trägt
      seine Schaltfläche die Beschriftung „Anfragen".
- [x] Gegeben ein nicht gebuchter Programmpunkt, bei dem nur eine
      Telefonnummer hinterlegt ist, wenn ich ihn betrachte, dann trägt
      seine Schaltfläche die Beschriftung „Anrufen".
- [x] Gegeben ein nicht gebuchter Programmpunkt mit Webadresse UND
      Telefonnummer, wenn ich ihn betrachte, dann trägt seine
      Schaltfläche die Beschriftung „Buchen".
- [x] Gegeben ein nicht gebuchter Programmpunkt ohne jeden hinterlegten
      Kontaktweg, wenn ich ihn betrachte, dann erscheint dort KEINE
      Buchungs-Schaltfläche.
- [x] Gegeben ein gebuchter Programmpunkt, wenn ich ihn betrachte, dann
      erscheint dort KEINE Schaltfläche „Buchen".

# Constraints

- Innerhalb von wegfara wird nichts gebucht und nichts bezahlt. Die
  Schaltflächen führen ausschließlich zu externen Seiten, zum
  E-Mail-Programm oder zur Telefonfunktion des Geräts.
- Der Buchungszustand wird nicht automatisch ermittelt; er ist am
  Programmpunkt hinterlegt.

# Nicht Teil dieses Requirements

- Ablage für Reiseunterlagen und das Ziel der Schaltfläche
  „Unterlagen"
- Ändern des Buchungszustands durch den Nutzer
- Abgleich des Buchungszustands mit externen Buchungssystemen
- Die Schaltflächen „Info" und „Navigation" an der Programmpunkt-Karte
- Erinnerungen an noch nicht gebuchte Programmpunkte
