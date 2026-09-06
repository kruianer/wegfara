---
id: req-049
title: Bildschirmbreiten automatisch prüfen
app: wegfara
area: Planung
priority: high
created: 2026-09-06
---

# Goal (Why)

Als Betreiber finde ich immer wieder Oberflächen, bei denen auf dem
iPhone Felder über den Rand stehen oder sich überlappen — obwohl die
Anweisung „responsive" lautete. „Responsive" ist keine prüfbare Angabe,
also fiel es niemandem auf außer mir. Die vier Regeln stehen jetzt in
[stack.md](../../stack.md); ich will, dass ein Verstoß dagegen auffällt,
bevor ich ihn auf dev sehe.

# Function (What)

Die vorhandenen Prüfungen im echten Browser (req-047) laufen zusätzlich
bei drei Bildschirmbreiten: **375 px** (iPhone), **768 px** (iPad
hochkant) und **1280 px** (Laptop).

Jede Seite, die dabei geöffnet wird, wird gegen die vier Regeln aus
[stack.md](../../stack.md) geprüft:

1. Nichts steht über den Rand — die Seite lässt sich nicht seitlich
   scrollen.
2. Nichts überlappt — keine zwei Elemente liegen übereinander.
3. Alles Bedienbare ist erreichbar — jeder Knopf ist sichtbar und
   auslösbar.
4. Tippziele sind mindestens 44×44 px groß.

Zeigt eine Seite bei einer Breite bewusst nur einen Hinweis statt ihres
Inhalts — wie der Planer auf schmalen Bildschirmen —, gelten die vier
Regeln für diesen Hinweis. Übersprungen wird nichts.

Verstößt etwas gegen eine Regel, schlägt die Prüfung fehl und benennt:
Seite, Breite, verletzte Regel und das betroffene Element. Aus der
Meldung muss hervorgehen, was zu reparieren ist, ohne die Seite selbst
zu öffnen.

Neue Flüsse, die später dazukommen, werden ohne weiteres Zutun
mitgeprüft.

# Acceptance Criteria

- [ ] Gegeben das Repo, wenn ich die Prüfungen im echten Browser starte,
      dann laufen sie bei 375, 768 und 1280 px.
- [ ] Gegeben die Anwendung ist in Ordnung, wenn die Prüfungen laufen,
      dann sind sie bei allen drei Breiten grün.
- [ ] Gegeben ein Formularfeld ragt bei 375 px über den rechten Rand,
      wenn die Prüfungen laufen, dann schlagen sie fehl.
- [ ] Gegeben zwei Felder überlappen sich bei 768 px, wenn die Prüfungen
      laufen, dann schlagen sie fehl.
- [ ] Gegeben ein Speichern-Knopf liegt bei 375 px außerhalb des
      sichtbaren Bereichs und ist nicht erreichbar, wenn die Prüfungen
      laufen, dann schlagen sie fehl.
- [ ] Gegeben ein Knopf misst 30×30 px, wenn die Prüfungen laufen, dann
      schlagen sie fehl.
- [ ] Gegeben eine Prüfung schlägt fehl, wenn ich die Meldung lese, dann
      nennt sie die Seite, die Breite und die verletzte Regel.
- [ ] Gegeben der Planer zeigt bei 375 px nur den Hinweis auf einen
      breiteren Bildschirm, wenn die Prüfungen laufen, dann wird dieser
      Hinweis geprüft und NICHT übersprungen.
- [ ] Gegeben ein neuer Fluss kommt zu den Prüfungen dazu, wenn sie
      laufen, dann wird auch er bei allen drei Breiten geprüft.
- [ ] Gegeben die Prüfungen laufen, wenn ich die Kosten prüfe, dann
      wurde KEINE Anfrage an OpenAI oder Google Places gestellt.

# Constraints

- Die vier Regeln und die drei Breiten stehen in
  [stack.md](../../stack.md) — sie werden dort gepflegt, nicht in den
  Tests festgeschrieben. Ändert sich die Vorgabe, ändert sich die
  Prüfung mit.
- Die Prüfungen laufen auf dem self-hosted Runner auf dem Beelink (siehe
  [devops.md](../../devops.md)) und dürfen dort keine zusätzlichen
  Dienste voraussetzen.
- Kostenpflichtige und fremde Dienste werden nicht echt angesprochen
  (siehe [stack.md](../../stack.md), Testing).

# Out of Scope

- Bestehende Verstöße beheben — dieses Requirement macht sie sichtbar;
  die Behebung folgt als Bug oder eigener Lauf.
- Weitere Breiten oder Hochformat/Querformat einzeln.
- Prüfung auf echten Geräten oder in mehreren Browsern.
- Farbkontraste, Schriftgrößen und übrige Barrierefreiheit.
