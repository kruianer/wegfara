---
id: req-016
title: Anmeldung mit Passkey, Magic Link und Notfallcodes
app: wegfara
area: Reise
priority: high
created: 2026-08-02
---

# Ziel (Warum)

Als Eigentümer der App will ich, dass niemand ohne Anmeldung meine
Reisedaten sieht. Heute stehen Planer und Begleiter offen im Internet —
jeder, der die Adresse kennt, liest mit, kann Daten verändern und
KI-Suchen auslösen, die Geld kosten.

# Funktion (Was)

Alle Bereiche außer der Startseite setzen eine angemeldete Person
voraus. Das gilt für Planer, Begleiter und alle Schnittstellen, über
die Daten gelesen, geschrieben oder KI-Anfragen ausgelöst werden. Ein
nicht angemeldeter Zugriff führt zur Anmeldeseite.

**Anmelden im Alltag:** per Passkey. Wer auf diesem Gerät einen Passkey
eingerichtet hat, meldet sich damit an — ohne Passwort.

**Alternative:** Wer keinen Passkey nutzen kann, gibt seine
E-Mail-Adresse ein und erhält einen Anmeldelink zugeschickt. Der Link
ist 15 Minuten gültig und genau einmal verwendbar. Ist die Adresse
unbekannt, erscheint dieselbe Rückmeldung wie bei einer bekannten —
dass eine Nachricht versandt wurde, sofern die Adresse hinterlegt ist.

**Nach der ersten Anmeldung** kann eine Person einen Passkey für ihr
Gerät einrichten. Ein Konto kann mehrere Passkeys haben, für mehrere
Geräte.

**Notfallcodes:** Bei der ersten Anmeldung werden acht Notfallcodes
erzeugt und einmalig angezeigt, mit dem Hinweis, sie sicher zu
verwahren. Jeder Code ersetzt einmal die Anmeldung und ist danach
verbraucht. In den Einstellungen lässt sich ein neuer Satz erzeugen,
der den alten ersetzt; auch dieser wird nur einmal angezeigt. Die Zahl
der noch unverbrauchten Codes ist jederzeit einsehbar.

**Sitzung:** Nach der Anmeldung bleibt die Person angemeldet. Die
Sitzung übersteht das Schließen der App, einen Neustart des Geräts und
Systemaktualisierungen. Sie endet beim Abmelden. Die Bindung der
Sitzungsdauer an den Reisezeitraum, wie in
[security.md](../../security.md) beschrieben, greift, sobald es
Teilnehmer gibt; bis dahin gilt eine Dauer von 90 Tagen, die sich bei
Nutzung verlängert.

**Abmelden** ist von jeder Seite aus möglich und beendet die Sitzung
sofort.

Die bestehenden Reisen bleiben unverändert und gehören dem
vorhandenen Konto (Uwe Kremmel, uwe@kremmel.org). Der bisher fest
hinterlegte Zugang entfällt.

# GUI

- Die Anmeldeseite folgt dem Erscheinungsbild der Startseite aus
  req-015: Farbwelt „Indigo-Nacht", Sternenhimmel, Kompassrose,
  Playfair Display für Überschriften, Figtree für die Bedienoberfläche.
- Sie zeigt zuerst die Anmeldung per Passkey; die Alternativen
  (Anmeldelink, Notfallcode) sind darunter erreichbar, ohne die Seite
  zu wechseln.
- Die Notfallcodes erscheinen in einer Ansicht, aus der sie sich
  kopieren und drucken lassen, mit einer Bestätigung, dass sie
  verwahrt wurden.

# Akzeptanzkriterien

- [ ] Gegeben ich bin nicht angemeldet, wenn ich https://dev.wegfara.com/go
      aufrufe, dann erscheint die Anmeldeseite.
- [ ] Gegeben ich bin nicht angemeldet, wenn ich https://dev.wegfara.com/plan
      aufrufe, dann erscheint die Anmeldeseite.
- [ ] Gegeben ich bin nicht angemeldet, wenn ich https://dev.wegfara.com
      aufrufe, dann erscheint die Startseite.
- [ ] Gegeben ich bin nicht angemeldet, wenn ich einen Schreibzugriff
      auf eine Schnittstelle versuche, dann wird er abgewiesen.
- [ ] Gegeben ich gebe auf der Anmeldeseite uwe@kremmel.org ein, wenn
      ich den Anmeldelink anfordere, dann erhalte ich eine E-Mail mit
      einem Anmeldelink.
- [ ] Gegeben ich habe einen Anmeldelink erhalten, wenn ich ihn
      aufrufe, dann bin ich angemeldet.
- [ ] Gegeben ich habe einen Anmeldelink bereits verwendet, wenn ich
      ihn erneut aufrufe, dann bin ich NICHT angemeldet.
- [ ] Gegeben ich gebe eine unbekannte Adresse ein, wenn ich den
      Anmeldelink anfordere, dann unterscheidet sich die Rückmeldung
      NICHT von der bei einer bekannten Adresse.
- [ ] Gegeben ich bin zum ersten Mal angemeldet, wenn die Anmeldung
      abgeschlossen ist, dann werden mir acht Notfallcodes angezeigt.
- [ ] Gegeben ich habe die Notfallcodes bestätigt, wenn ich die Seite
      erneut aufrufe, dann werden sie NICHT noch einmal angezeigt.
- [ ] Gegeben ich habe einen Notfallcode notiert, wenn ich mich damit
      anmelde, dann bin ich angemeldet.
- [ ] Gegeben ich habe einen Notfallcode verwendet, wenn ich mich
      erneut mit demselben Code anmelde, dann bin ich NICHT angemeldet.
- [ ] Gegeben ich bin angemeldet, wenn ich einen Passkey einrichte und
      mich abmelde, dann kann ich mich mit dem Passkey wieder anmelden.
- [ ] Gegeben ich bin angemeldet, wenn ich den Browser schließe und
      erneut öffne, dann bin ich weiterhin angemeldet.
- [ ] Gegeben ich bin angemeldet, wenn ich mich abmelde und den
      Begleiter aufrufe, dann erscheint die Anmeldeseite.
- [ ] Gegeben ich bin angemeldet, wenn ich den Begleiter öffne, dann
      sehe ich die drei bestehenden Reisen.

# Constraints

- E-Mails werden über den SMTP-Zugang von All-Inkl versandt, wo die
  Domain wegfara.com und die zugehörigen Postfächer liegen. Die
  Zugangsdaten liegen ausschließlich in den Umgebungsvariablen der
  jeweiligen Umgebung, nie im Repo.
- Notfallcodes werden ausschließlich als Prüfsumme gespeichert, nie im
  Klartext. Wer die Datenbank liest, kann sich damit nicht anmelden.
- Anmeldelinks und Notfallcodes werden serverseitig entwertet, nicht
  nur in der Anzeige.
- Es gibt keinen Zugang, der die Anmeldung umgeht — weder einen
  hinterlegten Notzugang noch einen Schalter zum Abschalten der
  Anmeldung.

# Nicht Teil dieses Requirements

- Einladung weiterer Teilnehmer und deren Beitritt per QR-Code
- Rollen und unterschiedliche Rechte je Person
- Bindung der Sitzungsdauer an den Reisezeitraum
- Beenden von Sitzungen aus der Ferne bei Geräteverlust
- Verwaltung mehrerer Konten oder Mandanten
- Zwei Faktoren zusätzlich zum Passkey
- Anmeldung für die Teilnehmer-Abstimmung
