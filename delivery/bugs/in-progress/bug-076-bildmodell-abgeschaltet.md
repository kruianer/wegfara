---
id: bug-076
title: „Bild erzeugen" schlägt fehl — das Bildmodell ist seit dem 23.10.2026 abgeschaltet
app: wegfara
area: Planung
severity: hoch
created: 2026-11-16
---

# Was passiert

„Bild erzeugen" zu einem POI (req-072) schlägt fehl. Nachgestellt auf
prod mit einem POI in Dornbirn.

# Warum

`lib/ai/openai-client.ts:18` nennt als Bildmodell:

```
const DEFAULT_IMAGE_MODEL = "gpt-image-1";
```

**OpenAI hat `gpt-image-1` am 23. Oktober 2026 abgeschaltet.** Die
Anfrage geht hinaus und wird abgewiesen; die App benennt den Grund wie
vorgesehen (bug-032), aber behoben ist damit nichts.

`OPENAI_IMAGE_MODEL` ist in `~/wegfara-env/prod.env` **nicht gesetzt**,
es gilt also der Standard aus dem Code.

Das Textmodell ist davon **nicht** betroffen: `OPENAI_MODEL` steht auf
`gpt-5.6-luna` und wird weiter angeboten. Betroffen ist allein das
Erzeugen von Bildern — zu einem POI (req-072) und zum Reisetitelfoto
(`app/api/reise-titelfoto/ki/route.ts`, req-103).

# Nachfolger

OpenAI nennt als Ersatz `gpt-image-2.5-sunburst` und
`gpt-image-2.5-flare`, dazu gibt es `gpt-image-2.6-flare`.

Die Grösse `1024x1024` bleibt gültig — `IMAGE_SIZE` muss nicht
geändert werden. Die neuen Modelle geben die Bilder weiterhin
base64-kodiert zurück, `b64_json` stimmt also auch noch; der Parameter
`response_format` gilt als veraltet, wird hier aber ohnehin nicht
gesetzt.

**Vor dem Umstellen gegen die aktuelle Referenz von OpenAI prüfen,**
welches der Modelle die passende Wahl ist und welche Parameter es
verlangt. Die Angaben oben stammen aus einer Websuche und sind nicht am
laufenden Dienst erprobt.

# Erwartet

„Bild erzeugen" liefert ein Bild. Und: Dass ein Modell abgeschaltet
wird, fällt auf, bevor es jemand im Planer merkt.

# Vorschlag

**Sofort, ohne Deploy:** `OPENAI_IMAGE_MODEL` in
`~/wegfara-env/prod.env` und `dev.env` auf ein aktuelles Modell setzen
und die Container neu starten. Das ist genau der Zweck dieser Variable
(stack.md) und bringt das Erzeugen heute zurück.

**Dauerhaft:** `DEFAULT_IMAGE_MODEL` im Code auf dasselbe Modell
setzen, damit der Standard nicht auf ein abgeschaltetes Modell zeigt.

**Damit es nicht wieder unbemerkt passiert:** Es gibt schon einen
Modellkatalog (`lib/ai/modell-katalog.ts`) — er liest die Modelle des
Dienstes und wird im Chat benutzt. Zu überlegen ist, ob die
Gesundheitsprüfung (`/api/health`, `delivery/health.md`) melden kann,
dass ein eingestelltes Modell beim Dienst nicht mehr geführt wird. Dann
sagt es die App, statt dass es beim Benutzen auffällt.

# Abgrenzung

- Welches Nachfolgemodell gewählt wird, entscheidet der Betreiber
  (Kosten je Bild, Qualität). Dieser Bug stellt nur fest, dass das
  eingestellte abgeschaltet ist.
- Die Aufforderung (`lib/pois/ki-bild.ts`) bleibt unverändert. Sie ist
  nicht die Ursache.
- `OPENAI_MODEL` und die übrigen KI-Funktionen (Suche, Beschreibung,
  Chat) bleiben unberührt.

# Umsetzung

- `DEFAULT_IMAGE_MODEL` steht auf `gpt-image-2.5-flare`. Geprüft gegen
  die Deprecations-Seite von OpenAI: Sie nennt für `gpt-image-1`
  (abgeschaltet 23.10.2026) `gpt-image-2.5-sunburst` oder
  `gpt-image-2.5-flare` als Ersatz. Flare ist laut OpenAI das für
  alltägliches Erzeugen, Sunburst das für genaues Bearbeiten — hier
  wird nur erzeugt. Für die 2.5-Reihe ist keine Abschaltung angekündigt.
  `size: "1024x1024"`, `n: 1` und `b64_json` gelten unverändert.
- Ein Test hält fest, dass der Standard nicht mehr auf `gpt-image-1`
  zeigt; stack.md nennt das neue Modell.
- Wer ein anderes Modell will (Kosten je Bild), setzt weiterhin
  `OPENAI_IMAGE_MODEL` — die Wahl bleibt beim Betreiber.
- Die Meldung eines verschwundenen Modells in `/api/health` und in der
  App gehört zu req-108 (dort als Akzeptanzkriterium geführt) und ist
  hier bewusst nicht doppelt gebaut.
