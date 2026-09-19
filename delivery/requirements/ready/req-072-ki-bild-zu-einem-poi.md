---
id: req-072
title: KI-Bild zu einem POI erzeugen
app: wegfara
area: Planung
priority: normal
created: 2026-09-19
---

# Goal (Why)

Als Reiseleiter lege ich einen POI von Hand an — eine Wanderung, einen
Aussichtspunkt, ein Lokal ohne Google-Eintrag. Er bleibt bildlos, während
die POIs aus der Suche ihre Fotos mitbringen. In der Liste steht dann eine
farbige Fläche, und beim Durchgehen fällt der Ort durch.

Hochladen und Fotografieren gibt es bereits (req-026). Beides setzt aber
voraus, dass ich schon dort war. Vor der Reise habe ich nur Titel und
Beschreibung — daraus soll sich ein Bild erzeugen lassen.

# Function (What)

## Erzeugen

Dort, wo sich heute ein Foto hochladen oder aufnehmen lässt, kommt ein
dritter Weg dazu: **Bild erzeugen**. Er nimmt **Titel und Beschreibung**
des POI als Vorlage — weitere Eingaben braucht es nicht.

Das erzeugte Bild wird wie ein hochgeladenes gespeichert und erscheint
unter den Fotos des POI. Es lässt sich wie jedes andere entfernen.

## Erkennbar als KI-Bild

Jedes so erzeugte Bild trägt **unten rechts ein Symbol**, an dem es als
KI-Bild zu erkennen ist. Das Symbol ist überall zu sehen, wo das Bild
erscheint — in der POI-Ansicht, in der Liste und im Flyout (req-070).

Erkennbar bleibt es auch dann, wenn das Bild dunkel oder unruhig ist.

## Fotorealistisch

Erzeugte Bilder sind **fotorealistisch** und so nah an der Wirklichkeit
wie möglich: Sie sollen aussehen wie eine Aufnahme des Ortes, nicht wie
eine Zeichnung, ein Gemälde oder eine stilisierte Darstellung.

## Wenn es nicht geht

Schlägt das Erzeugen fehl — kein Zugangsschlüssel, Dienst nicht
erreichbar, Anfrage abgelehnt —, **sagt die App den Grund**. Es entsteht
dabei kein halbes Foto am POI.

# Acceptance Criteria

- [ ] Gegeben ein POI mit Titel und Beschreibung, wenn ich „Bild
      erzeugen" auslöse, dann erscheint danach ein neues Bild bei seinen
      Fotos.
- [ ] Gegeben ein so erzeugtes Bild, wenn ich es ansehe, dann trägt es
      unten rechts ein Symbol, das es als KI-Bild kennzeichnet.
- [ ] Gegeben ein KI-Bild ist das erste Foto des POI, wenn ich die
      POI-Liste ansehe, dann ist das Symbol auch dort zu sehen.
- [ ] Gegeben ein KI-Bild ist das erste Foto des POI, wenn sein Flyout
      auf der Karte erscheint (req-070), dann ist das Symbol auch dort zu
      sehen.
- [ ] Gegeben ein hochgeladenes oder aus Google übernommenes Foto, wenn
      ich es ansehe, dann trägt es KEIN solches Symbol.
- [ ] Gegeben ein erzeugtes Bild, wenn ich es betrachte, dann wirkt es
      wie eine Fotografie und nicht wie eine Zeichnung oder ein Gemälde.
- [ ] Gegeben ich habe ein KI-Bild erzeugt, wenn ich es entferne, dann
      ist es weg — wie jedes andere Foto auch.
- [ ] Gegeben dem Account fehlt der Zugangsschlüssel für die KI, wenn ich
      „Bild erzeugen" auslöse, dann sagt die App das und es entsteht kein
      Bild.
- [ ] Gegeben das Erzeugen schlägt fehl, wenn ich danach die Fotos des
      POI ansehe, dann ist dort kein unvollständiges oder leeres Bild
      entstanden.
- [ ] Gegeben ein POI ohne Beschreibung, wenn ich „Bild erzeugen"
      auslöse, dann entsteht ein Bild aus dem Titel allein oder die App
      sagt, dass die Beschreibung dafür fehlt — nicht beides zugleich
      und nicht stillschweigend nichts.
- [ ] Gegeben die POI-Ansicht ist auf 375 px, 768 px und 1280 px zu
      sehen, wenn ich Bilder verwalte, dann ist „Bild erzeugen" auf allen
      dreien erreichbar (siehe [stack.md](../../stack.md)).

# Constraints

- Das Erzeugen läuft über den **Zugangsschlüssel des Accounts** (req-028),
  wie KI-Suche und KI-Planung — nicht über den Schlüssel der Umgebung.
- Die Herkunft eines Fotos steht bereits in der Datenbank (`poi_photo.source`,
  heute `google` oder `manuell`). KI-Bilder bekommen einen eigenen Wert;
  das Symbol hängt daran und nicht an einer Vermutung aus dem Dateinamen.
- Wird das Schema geändert, ist
  [datenbank.md](../../datenbank.md) nachzuziehen.
- Ein KI-Bild zählt wie jedes andere Foto — es gelten dieselbe Ablage und
  dieselben Regeln (req-026, [stack.md](../../stack.md)).
- Mit dem POI werden auch seine KI-Bilder entfernt, wie die übrigen Fotos.
- Ein Fehler wird benannt und nicht verschluckt (vgl. bug-021, bug-026,
  bug-027, bug-032).
- Jedes erzeugte Bild kostet. Es entsteht nur auf ausdrückliches Auslösen
  — nie automatisch beim Anlegen eines POI.

# Out of Scope

- Eigene Anweisungen an die KI eingeben (Stil, Jahreszeit, Blickwinkel).
- Mehrere Vorschläge zur Auswahl erzeugen.
- Ein erzeugtes Bild nachbearbeiten oder erneut erzeugen lassen.
- KI-Bilder für Reisen, Programmpunkte oder Dokumente.
- Automatisch ein Bild erzeugen, wenn ein POI keines hat.
- Bestehende bildlose POIs nachträglich versorgen.
