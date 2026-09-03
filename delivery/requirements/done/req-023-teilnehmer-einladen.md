---
id: req-023
title: Teilnehmer einladen
app: wegfara
area: Planung
priority: high
created: 2026-09-03
---

# Ziel (Warum)

Als Reiseleiter will ich die Mitreisenden in die App holen. Heute
existieren sie nur als Einträge — sie können sich nicht anmelden, also
weder abstimmen noch unterwegs auf den Plan schauen.

# Funktion (Was)

Zu jeder Person, die einer Reise zugeordnet ist, lässt sich eine
Einladung erzeugen. Sie besteht aus einem Zugangslink, der zugleich als
QR-Code angezeigt wird — beides führt an dieselbe Stelle. Der
Reiseleiter kann den QR-Code abscannen lassen oder den Link über einen
beliebigen Kanal verschicken.

Die Einladung ist **an genau diese Person gebunden**. Wer sie einlöst,
wird zu ihr — es entsteht kein neuer, eigener Zugang.

Ein Zugangslink gilt **7 Tage** und ist **genau einmal** verwendbar.
Beim Einlösen richtet die Person einen Passkey ein; danach meldet sie
sich damit an. Wird eine neue Einladung für dieselbe Person erzeugt,
verliert die vorherige ihre Gültigkeit.

Eine Einladung lässt sich auch erzeugen, solange die Reise auf „In
Planung" steht. Die eingeladene Person kann sich dann anmelden, sieht
die Reise aber noch nicht.

**Anmelden ohne Passkey.** Kann eine Person auf ihrem Geraet keinen
Passkey einrichten, meldet sie sich ueber einen Anmeldelink an ihre
hinterlegte E-Mail-Adresse an — wie in [security.md](../../security.md)
vorgesehen. Ist keine Adresse hinterlegt, steht dieser Weg nicht zur
Verfuegung.

**Zurueck nach einem Geraetewechsel.** Wer ausgesperrt ist — neues
Geraet, geloeschte Browserdaten, kein Zugriff aufs Postfach —, bekommt
vom Reiseleiter einen neuen Zugangslink. Es gilt dasselbe Verfahren wie
bei der Einladung; die vorherige Einladung verliert dabei ihre
Gueltigkeit. Niemand bleibt dauerhaft ausgesperrt.

Teilnehmer erhalten keine Notfallcodes. Sie brauchen keine: Anders als
der Reiseleiter haben sie immer jemanden, der sie wieder hereinholen
kann — jeder zusaetzliche Zugangsweg waere nur Angriffsflaeche.

**Wie lange jemand angemeldet bleibt**, richtet sich danach, ob er
etwas zu tun hat: Die Sitzung gilt, solange die Person mindestens einer
Reise im Zustand „Freigegeben" zugeordnet ist oder eine offene
Bewertung hat. Trifft beides nicht mehr zu, endet die Sitzung beim
nächsten Aufruf; die Person landet auf der Anmeldeseite mit dem
Hinweis, dass sie derzeit keiner laufenden Reise zugeordnet ist.

Für den Reiseleiter gilt diese Einschränkung nicht — er bleibt
angemeldet, solange seine Sitzung nicht abgelaufen ist.

# Änderung gegenüber heute

[security.md](../../security.md) sieht heute vor, dass sich die
Sitzungsdauer aus dem Reisezeitraum plus einigen Tagen Puffer ergibt.
Das wird ersetzt: Maßgeblich ist der Zustand der Reise aus req-022,
nicht ihr Datum. Grund — Vorbereitung beginnt oft Wochen vorher und die
Abrechnung zieht sich danach; ein Datumsfenster trifft beides nicht.
Die Angabe in security.md ist entsprechend nachzuziehen.

# GUI

- Die Einladung wird dort erzeugt, wo die Personen einer Reise
  zugeordnet werden (siehe req-021): je zugeordneter Person eine
  Schaltfläche „Einladen".
- Ein Klick öffnet eine Fläche mit dem QR-Code, dem Link als Text und
  einer Schaltfläche zum Kopieren des Links.
- Je Person ist erkennbar, ob sie bereits Zugang hat oder noch nicht.
- Erscheinungsbild wie der übrige Planer.

# Akzeptanzkriterien

- [x] Gegeben die Person „Clara Berger" ist der Reise zugeordnet, wenn
      ich bei ihr „Einladen" anklicke, dann erscheint ein QR-Code.
- [x] Gegeben derselbe Zustand, wenn ich die Fläche betrachte, dann
      steht dort der Zugangslink als Text.
- [x] Gegeben ein erzeugter Zugangslink, wenn ich ihn aufrufe, dann
      werde ich aufgefordert, einen Passkey einzurichten.
- [x] Gegeben ich habe den Zugangslink eingelöst, wenn ich mich
      anschließend anmelde, dann bin ich als „Clara Berger" angemeldet.
- [x] Gegeben ein bereits eingelöster Zugangslink, wenn ich ihn erneut
      aufrufe, dann werde ich NICHT angemeldet.
- [x] Gegeben ein Zugangslink für „Clara Berger", wenn ich für sie eine
      neue Einladung erzeuge, dann ist der vorherige Link NICHT mehr
      gültig.
- [x] Gegeben die Reise steht auf „In Planung" und „Clara Berger" hat
      ihren Zugang eingelöst, wenn sie sich anmeldet, dann erscheint
      diese Reise bei ihr NICHT.
- [x] Gegeben die Reise steht auf „Freigegeben" und „Clara Berger" ist
      ihr zugeordnet, wenn sie sich anmeldet, dann erscheint diese
      Reise bei ihr.
- [x] Gegeben „Clara Berger" ist keiner freigegebenen Reise mehr
      zugeordnet und hat keine offene Bewertung, wenn sie die App
      aufruft, dann erscheint die Anmeldeseite mit einem Hinweis auf
      den Grund.
- [x] Gegeben die Person „Max Gast" wurde noch nie eingeladen, wenn ich
      die Liste betrachte, dann ist erkennbar, dass er noch keinen
      Zugang hat.
- [x] Gegeben „Clara Berger" hat eine hinterlegte E-Mail-Adresse und
      keinen Passkey, wenn sie einen Anmeldelink anfordert, dann erhaelt
      sie eine E-Mail mit einem Anmeldelink.
- [x] Gegeben „Max Gast" hat keine hinterlegte E-Mail-Adresse, wenn er
      einen Anmeldelink anfordert, dann erhaelt er KEINEN Zugang.
- [x] Gegeben „Clara Berger" hat ihren Passkey verloren, wenn ich ihr
      eine neue Einladung erzeuge und sie diese einloest, dann ist sie
      wieder angemeldet.
- [x] Gegeben „Clara Berger" hat ihren Zugang eingeloest, wenn sie ihre
      Kontoseite betrachtet, dann werden ihr KEINE Notfallcodes
      angezeigt.

# Constraints

- Ein Zugangslink ist an genau eine Person gebunden. Es gibt keinen
  Link, mit dem sich beliebige Personen einen eigenen Zugang schaffen
  können — Beitritt erfolgt ausschließlich per Einladung (siehe
  [security.md](../../security.md)).
- Der Link läuft über unsichere Kanäle. Deshalb: kurz gültig, genau
  einmal verwendbar, und beim Einlösen entsteht ein Passkey — der Link
  selbst ist kein Dauerzugang.
- Zugangslinks werden ausschließlich als Prüfsumme gespeichert, nie im
  Klartext.
- Der Link wird serverseitig entwertet, nicht nur in der Anzeige.

# Nicht Teil dieses Requirements

- Unterschiedliche Rechte für Teilnehmer und Reiseleiter
- Die Ansicht, die ein Teilnehmer nach der Anmeldung sieht
- Bewertungsrunden und das Abstimmen selbst
- Versand der Einladung per E-Mail aus der App heraus
- Beenden fremder Sitzungen bei Geräteverlust
- Ein frei einlösbarer Gruppenlink für mehrere Personen
