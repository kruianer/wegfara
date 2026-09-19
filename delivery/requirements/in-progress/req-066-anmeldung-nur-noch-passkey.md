---
id: req-066
title: Anmeldung nur noch per Passkey
app: wegfara
area: Reise
priority: hoch
created: 2026-09-19
---

# Goal (Why)

Als Nutzer öffne ich wegfara und will drin sein — nicht erst einen
Anmeldedialog lesen, „Mit Passkey anmelden" antippen und dann Face ID
bestätigen. Andere Apps melden mich ausschließlich per Face ID an, ohne
einen einzigen Knopfdruck davor.

Heute stehen auf der Anmeldeseite vier gleichwertige Wege nebeneinander —
Anmeldelink, Passkey, fremdes Gerät, Notfallcode — plus ein
E-Mail-Feld. Welcher davon greift, ist von außen nicht zu erkennen. Die
Anmeldung ist damit undurchsichtig geworden: sie funktioniert, aber
niemand kann vorhersagen, warum sie in einem gegebenen Moment so
reagiert, wie sie reagiert.

Der Passkey ist der Regelweg. Alles andere ist Wiederherstellung und
gehört nicht gleichberechtigt daneben.

# Function (What)

## Beim Öffnen sofort Face ID

Wer die App öffnet, bekommt **ohne Knopfdruck** die Geräte-Entsperrung —
Face ID, Touch ID oder Windows Hello. Erkennt sie die Person, ist sie
drin. Kein Zwischenschritt, kein Feld, kein Tippen.

Verlangt der Browser für die Abfrage eine Geste (Safari tut das je nach
Version), dann zeigt die Seite **nur eine große Fläche zum Antippen** und
sonst nichts. Ein Tap, dann Face ID. Niemals ein Formular davor.

Scheitert die Entsperrung, erkennt sie die Person nicht oder bricht sie
ab, **erst dann** erscheint der Anmeldedialog.

## Der Anmeldedialog als Rückfallebene

Er trägt genau einen Weg: **Zugang verloren**. Dahinter das Feld für die
E-Mail-Adresse und der Anmeldelink ins Postfach — wie heute. Dass die
Adresse eingegeben werden muss, ist beabsichtigt: Der Link geht an dieses
Postfach, nicht an den Browser. Wer eine fremde Adresse einträgt, bekommt
nichts.

## Einladung legt sofort einen Passkey an

Wer einen Einladungslink anklickt, richtet **unmittelbar** seinen Passkey
ein — auf jedem Gerät, mit dem er den Link öffnet: iPhone, iPad,
Windows-Laptop, Android. Danach ist er angemeldet. Kein Zwischenschritt
über einen Anmeldelink.

Weitere Geräte fügt er anschließend selbst unter „Meine Geräte" hinzu.

## Was verschwindet

- **Notfallcodes.** Sie lösen dasselbe Problem wie der Anmeldelink, mit
  eigener Tabelle, eigener Seite, eigenem Endpunkt und eigenem Cookie.
  Die Rückfallebene ist ab jetzt allein das hinterlegte Postfach.
- **„Anderes Gerät verwenden".** Ein Gerät, ein Passkey; wer auf einem
  neuen Gerät anfängt, nimmt den Weg über „Zugang verloren".
- **Das E-Mail-Feld als Erstes, was man sieht.** Es rutscht hinter
  „Zugang verloren".

## Fehler werden sichtbar

Scheitert die Anmeldung oder das Einrichten eines Passkeys, **sagt die
App, woran es lag** — und protokolliert es serverseitig. Ein `catch`, der
jeden Grund auf denselben Satz abbildet, ist nicht zulässig.

Das ist hier kein Beiwerk: Die Fehlersuche an bug-046 dauerte deshalb so
lange, weil die Anwendung auf prod zu keinem Anmeldevorgang etwas
protokollierte und die Passkey-Einrichtung jeden Fehler still schluckte
(dasselbe Muster wie bug-021, bug-026, bug-027, bug-032).

# Acceptance Criteria

- [x] Gegeben ich habe auf diesem Gerät einen Passkey und bin abgemeldet,
      wenn ich die App öffne, dann erscheint Face ID **ohne dass ich
      etwas antippe** — oder es steht genau eine Fläche da, die ich
      antippe, und sonst kein Formular.
- [x] Gegeben Face ID erscheint beim Öffnen, wenn es mich erkennt, dann
      bin ich angemeldet, ohne einen weiteren Knopf gedrückt zu haben.
- [x] Gegeben Face ID erscheint beim Öffnen, wenn es mich NICHT erkennt
      oder ich abbreche, dann erscheint der Anmeldedialog.
- [x] Gegeben ich sehe den Anmeldedialog, wenn ich ihn ansehe, dann steht
      dort **ein** Weg: „Zugang verloren". Es gibt keinen Knopf „Mit
      Passkey anmelden", keinen „Anderes Gerät verwenden" und keinen
      „Notfallcode verwenden".
- [x] Gegeben ich tippe auf „Zugang verloren", wenn ich meine Adresse
      eingebe, dann kommt der Anmeldelink in mein Postfach.
- [x] Gegeben ich gebe dort die Adresse einer anderen Person ein, wenn
      ich absende, dann bekomme ich selbst keinen Zugang.
- [x] Gegeben ich habe auf diesem Gerät noch keinen Passkey, wenn ich die
      App öffne, dann erscheint der Anmeldedialog ohne vorherige
      vergebliche Face-ID-Abfrage.
- [x] Gegeben ich erhalte einen Einladungslink, wenn ich ihn auf einem
      **Windows-Laptop** anklicke, dann richte ich sofort meinen Passkey
      per Windows Hello ein und bin danach angemeldet.
- [x] Gegeben ich erhalte einen Einladungslink, wenn ich ihn auf dem
      **iPhone** anklicke, dann richte ich sofort meinen Passkey per Face
      ID ein und bin danach angemeldet.
- [x] Gegeben ich bin angemeldet, wenn ich „Meine Geräte" öffne, dann
      kann ich ein weiteres Gerät hinzufügen.
- [x] Gegeben das Einrichten eines Passkeys scheitert, wenn ich auf den
      Bildschirm sehe, dann steht dort der **Grund** — nicht ein Satz,
      der für jeden Grund derselbe ist.
- [x] Gegeben eine Anmeldung scheitert, wenn ich anschließend ins
      Server-Log sehe, dann steht dort, welcher Schritt fehlschlug.
- [ ] Gegeben die Umstellung ist ausgeliefert, wenn ich die Anmeldeseite
      auf 375 px, 768 px und 1280 px ansehe, dann ist sie auf allen
      dreien benutzbar (siehe [stack.md](../../stack.md)).
- [ ] Gegeben die Notfallcodes sind entfernt, wenn ich die Datenbank
      ansehe, dann ist `delivery/datenbank.md` nachgezogen.

# Constraints

- Ein Passkey hängt an der Domain (req-037): dev und prod behalten je
  eigene.
- `residentKey: "required"` und `userVerification: "required"` bleiben.
  Ein Passkey, der sich ohne Face ID / Touch ID / Windows Hello nutzen
  lässt, wäre nur ein Gerätenachweis (req-037).
- Die Antwort auf „Zugang verloren" bleibt für bekannte und unbekannte
  Adressen **wortgleich**, und die Bremse von drei Anfragen je Adresse
  und Stunde bleibt (req-016, req-037).
- Der Zugangslink aus einer Einladung gilt weiterhin sieben Tage
  (req-023).
- Die Ersteinrichtung einer leeren Umgebung (req-037) bleibt unberührt.
- Wer sein Postfach verliert, kommt nicht mehr in die App. Das ist mit
  dem Streichen der Notfallcodes bewusst in Kauf genommen; der Betreiber
  kommt über die Datenbank an seinen Account.
- `delivery/datenbank.md` ist nachzuziehen, wenn die Tabelle
  `recovery_code` entfällt.

# Out of Scope

- Die Einladungswege selbst (req-023) — sie bleiben, wie sie sind.
- Wie lange eine Sitzung hält und ob nach Untätigkeit erneut entsperrt
  werden muss. Das ist eine eigene Frage und wird getrennt entschieden.
- Anmeldung über fremde Anbieter (Google, Apple ID).
- Mehrere Accounts pro Person.
