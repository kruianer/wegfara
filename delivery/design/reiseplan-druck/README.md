# Reiseplan zum Ausdrucken — Design-Referenz

**Drei Varianten zum Vergleich.** Jede im Browser öffnen:

| Datei | Charakter |
|---|---|
| `variante-b-hell.mockup.html` | hell, Farben der App, **mit** Zeitstrahl |
| `variante-c-magazin.mockup.html` | Reisemagazin, **ohne** Zeitstrahl |
| `reiseplan.mockup.html` | erster Entwurf — Magazin-Typografie auf Fahrplan-Gerüst |

Der erste Entwurf (`reiseplan.mockup.html`) hat beides vermischt:
Magazin-Schriften über einer Zeitspalte. Das sah nach Busplan aus, und
der Einwand war berechtigt. Er bleibt als Zwischenstand liegen.

Der Unterschied zwischen B und C ist **nicht die Farbe, sondern die
Ordnung**:

- **B reiht.** Stunden links, Stationen rechts, gleiche Blöcke in gleichem
  Abstand. Wer den Planer kennt, findet ihn wieder. Sachlich, dicht, zum
  Mitnehmen und Abhaken.
- **C komponiert.** Jede Station bekommt dasselbe Gerüst, aber Raum statt
  Zeile: Startzeit, Name, Langtext, dann ein großes Foto und zwei bis drei
  kleine daneben. Kein Raster, keine Dauer, keine Buchung, keine Preise —
  die stehen gesammelt am Ende.

**C ist die gewählte Richtung.** Der Rest dieses Dokuments beschreibt sie;
B bleibt als Vergleich liegen.

### Was C bewusst weglässt

Dieses Heft ist **nicht** der Begleiter unterwegs — das ist die App. Es ist
das Versprechen vorher, zum Verschicken und Aufheben. Deshalb fehlen:

- **Dauer und Endzeit.** Nur die Startzeit steht da. Ein Zeitfenster macht
  aus dem Heft einen Fahrplan.
- **Buchungszustand und Preise im Tagesteil.** Beides gesammelt auf der
  letzten Seite.
- **Alle Optionen einer Gruppe.** Nur die Hauptoption bekommt Raum; die
  Alternative wird in einem Satz erwähnt (req-004).

### Farbe

**Mitternachtsblau** (`#141a33`) als Tinte, für Linien und für die
Flächen — Dashboard und Summenblock. Das Papier bleibt hell.

Hervorhebungen in **warmem Rot** (`#b5341f`) für Uhrzeiten und
Akzentwörter, **Safran** (`#c8871a`) für Zahlen auf dunklem Grund. Das
Braun des ersten Entwurfs ist weg.

Die Angaben unten beziehen sich auf den gemeinsamen Teil; wo B und C
abweichen, steht es dabei.

**Druck prüfen:** `Strg+P` → A4 hoch, Ränder „keine", *Hintergrundgrafiken*
einschalten. Ohne diese Einstellung bleiben die Farbflächen weiß — eine
Eigenheit des Browsers, kein Fehler der Vorlage.

Das Mockup ist mit den **echten Daten** der Reise „30 Johr zämma –
Rothenburg" gefüllt (25.–26.10.2026, 6 Programmpunkte, Hotel 220 €,
Nachtwächter 8 €). Absichtlich: An erfundenen Kurztexten lässt sich nicht
sehen, ob die Gestaltung mit wirklichen Längen zurechtkommt.

## Anmutung

**Variante C — Reisemagazin:** eine eigene Gestaltungswelt, nicht die der
App. Heller Grund, große Fotos, viel Weißraum, Typografie im Vordergrund.
Etwas, das man aufhebt.

**Variante B — die App auf Papier:** dasselbe helle Papier, aber die
Farben und der Aufbau des Planers. Tagesreiter, Statusfarben, Plaketten.
Zum Mitnehmen, nicht zum Aufheben.

Die App ist dunkel („Indigo-Nacht", req-015). Auf Papier wäre das ein
Fehler: Ein dunkler Grund frisst Tinte und wirkt bei Heimdruckern
fleckig. Die Akzentfarbe der App (`#d9c589`) ist für Papier zu hell und
erscheint hier abgedunkelt als `#8a6d2f`.

Schriften bleiben die der App: **Playfair Display** für Überschriften,
**Figtree** für Laufschrift, **Caveat** für die handschriftlichen
Zwischentöne — dieselben drei, die auch die Seitenleiste nutzt (req-077).

## Seitenaufbau

**Randlos** heißt: `@page { margin: 0 }`, und Farbflächen wie Fotos laufen
bis an die Blattkante. Der **Textsatz** hält dagegen 14 mm Sicherheitsrand
— beim randlosen Druck schneidet jeder Drucker etwas anders, und Text darf
dabei nicht verloren gehen.

### Seite 1 — Bild und Dashboard

**Kein eigener Auftakt mehr** — Bild und Zahlen stehen auf derselben Seite.

Das Foto nimmt die oberen zwei Drittel, randlos bis an drei Kanten; Titel
und Ort liegen darauf, wo ein Verlauf für Lesbarkeit sorgt. Das untere
Drittel ist eine Fläche in Mitternachtsblau mit der Beschreibung der
Reise, vier Zahlen (Dauer, Stationen, Reisende, Kosten) und sechs Zeilen
Eckdaten.

Der handschriftliche Satz über dem Titel ist der Anlass; er kommt aus der
Beschreibung der Reise.

### Seiten 2 ff. — ein Tag je Seite

**In B** als Stundenraster wie im Planer, auf 8 mm je Stunde gestaucht,
damit ein Tag auf eine Seite geht (im Planer sind es 48 px je Stunde — auf
A4 ergäbe das über einen Meter).

**In C gibt es kein Raster — und auch kein einheitliches Gerüst.** Ein
erster Versuch gab jeder Station dasselbe Layout; das wirkte monoton. Nun
wechseln **fünf Layouts**, und die Bildgrößen mit ihnen:

| | Aufbau |
|---|---|
| **L1** | großes Bild links (95 × 72 mm), Text rechts, zwei kleine unter dem Text |
| **L2** | Text links, großes Bild rechts (88 × 54 mm), drei kleine darunter |
| **L3** | großes Bild oben über die ganze Breite (62 mm), Text darunter, drei kleine rechts |
| **L4** | Text zuerst über die ganze Breite, darunter eine Bildreihe (groß + zwei kleine) |
| **L5** | Nebenstation: schmal, ein kleines Bild, kurzer Text |

**Der Wechsel folgt einer Regel, nicht dem Zufall** — sonst wirkt eine
Seite unruhig statt lebendig:

1. erste Station des Tages → **L1**
2. die nächste große → **L2**
3. danach wechselnd → **L3** / **L4**
4. Nebenstationen → **L5**

So stehen nie zwei gleiche Layouts untereinander.

Hat ein POI nur ein Foto, fällt die Bildreihe darauf zusammen — die
Nachtwächter-Tour zeigt diesen Fall.

Wie viele Stationen auf eine Seite gehen, hängt vom Layout ab: zwei große
plus eine Nebenstation, oder zwei große allein. Tag 1 braucht deshalb zwei
Seiten, mit derselben Tageszahl und dem Zusatz „Fortsetzung".

Ein Tag **ohne** Programmpunkte bleibt als Seite stehen.

### Nebenstationen

Nicht jede Station verdient eine halbe Seite: der Kaffee auf dem Weg, das
Mittagsrestaurant. Solche Stationen sollen sich als **Nebenstation**
kennzeichnen lassen — im Heft erscheinen sie dann klein (L5) oder gar
nicht, in der App bleiben sie immer sichtbar.

Dafür braucht der POI ein Kennzeichen, das es heute nicht gibt. **Das
gehört in die App und ist nicht Teil dieses Druck-Requirements** — es
kommt als eigenes dazu. Im Mockup zeigt L5 nur, wie es aussähe.

**Transfers** erscheinen in C nicht. Sie gehören zum Fahrplan, nicht zum
Magazin — unterwegs sagt die App, wie lange die Fahrt dauert.

Eine **Options-Gruppe** (req-004) zeigt nur die **Hauptoption** mit Raum
und Fotos; die Alternative steht als Satz darunter, abgesetzt durch ein
Band in Safran. Wer wissen will, was die zweite Möglichkeit ist, findet
sie in der App.

### Letzte Seite — Kosten und Buchungen

Hier stehen die Angaben, die im Tagesteil fehlen: Betrag **und**
Buchungszustand je Position. Keine Tabelle mit Kopfzeile, sondern eine
Liste, die sich lesen lässt. Offene Positionen stehen als „offen" statt
als 0 €.

Die Summe sitzt in einem Block in Mitternachtsblau, der Betrag in Safran.

## Was beim Umsetzen zu entscheiden ist

Das Mockup zeigt die Gestaltung, nicht die Technik. Offen sind:

- **Woher das Deckblatt-Foto kommt** — erstes Foto des Hauptorts, ein vom
  Reiseleiter gewähltes, oder ein erzeugtes (req-072).
- **Wie das PDF entsteht.** Der Weg über HTML ist gesetzt; ob daraus im
  Browser gedruckt oder serverseitig ein PDF erzeugt wird, ist offen.
  Serverseitig bräuchte es einen Headless-Browser — den gibt es durch
  Playwright schon im Repo, allerdings bisher nur für Tests.
- **Welche Fotos ausgewählt werden.** Bis zu sieben je POI (req-068), im
  Heft erscheinen vier. Ob die ersten vier genommen werden oder der
  Reiseleiter wählt, ist offen.
- **Ob KI-Bilder (req-072) ihr Zeichen auch im Druck tragen.** Auf dem
  Schirm tun sie es; auf Papier spricht ebenso viel dafür.
- **Wie viele Seiten ein langer Tag bekommt.** Bei zehn Stationen reicht
  eine A4-Seite nicht. Die Stationen tragen `break-inside: avoid`, der
  Umbruch wäre also sauber — aber die Seitenzählung („Tag 1 von 2") müsste
  das abbilden.

## Was nicht hineingehört

- Bewertungsrunden und Stimmen — der Plan zeigt das Ergebnis, nicht den Weg
  dorthin.
- Dokumente und Tickets.
- Live-Positionen der Teilnehmer.
- Die Karte. Ein Kartenbild auf Papier wäre ein eigenes Thema und braucht
  andere Kacheln als der dunkle Planer.
