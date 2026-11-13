---
titel: Fotos aus Wikimedia Commons — Bilder, die wir behalten dürfen
datum: 2026-11-12
---

## Problem/Nutzen

Die Fotos eines POI kommen heute ausschließlich von Google Places
(req-026, req-057, seit req-068 bis zu sieben je POI). Sie werden
heruntergeladen und dauerhaft in der Bildablage gespeichert, und genau
das verbieten Googles Nutzungsbedingungen. [stack.md](../stack.md) hält das
ausdrücklich als „bewusste, vorläufige Abweichung … die später auf einen
zulässigen Weg umgestellt wird“ fest. Bei den Fotos ist diese Abweichung
am größten: Ein Foto ist der sichtbarste gespeicherte Inhalt, es kommt in
die Begleiter-Kachel (req-079), in die POI-Auswahl der Planung (req-099)
und in den gedruckten Reiseplan (req-103). Jedes Foto ist außerdem ein
eigener, bezahlter Abruf (req-068).

Dazu kommen zwei Lücken:

- POIs, die von Hand oder über die Ortssuche (OpenStreetMap, req-045)
  angelegt werden, haben gar kein Foto. Es bleibt dann nur das KI-Bild
  (req-072), und das zeigt nicht, wie der Ort wirklich aussieht.
- Ohne Google-Schlüssel gibt es überhaupt keine echten Fotos.

Unterwegs ist ein echtes Foto der schnellste Weg, etwas
wiederzuerkennen: „Ist das das Tor, durch das wir rein müssen?“ Das hilft
mehr als jede Beschreibung (Ideen-Richtung: Unterwegs-Tauglichkeit,
Datenquellen).

**Quelle: Wikimedia Commons** (über Wikidata und OpenStreetMap
gefunden)

- **Lizenz:** Jede Datei auf Commons steht unter einer freien Lizenz
  (überwiegend CC BY, CC BY-SA oder gemeinfrei/CC0). Kopieren und
  **dauerhaftes Speichern sind erlaubt**, auch die verkleinerte Fassung.
  Pflicht ist die **Namensnennung je Bild**: Urheber, Lizenz mit Link und
  Link zur Dateiseite. Bei CC BY-SA steht eine veränderte Fassung unter
  derselben Lizenz; ein bloßes Verkleinern gilt dabei nicht als
  Bearbeitung, ein Zuschnitt schon. Die Verweise auf Wikidata
  (`P18` Bild, `P373` Commons-Kategorie) stehen unter CC0, die
  OSM-Tags `wikidata=`/`wikimedia_commons=` unter ODbL. Beides darf
  gespeichert werden.
- **Kosten/Limits:** Die MediaWiki-API ist kostenlos und braucht keinen
  Schlüssel. Verlangt wird eine aussagekräftige `User-Agent`-Kennung und
  ein maßvolles Abfragetempo (Abrufe nacheinander, nicht parallel). Für
  einige Fotos je POI beim Anlegen ist das mehr als genug.
- **Was gespeichert werden darf:** die Bilddatei selbst (in passender
  Größe über die Thumbnail-URL der API) und die Lizenzangaben aus
  `extmetadata` (Urheber, Lizenzname, Lizenz-URL, Dateiseite). Die
  Lizenzangaben müssen mitgespeichert werden, denn ohne sie darf das
  Bild nicht gezeigt werden.

Diese Idee ergänzt die offene Idee
[wikivoyage-kurzbeschreibung-fuer-pois.md](wikivoyage-kurzbeschreibung-fuer-pois.md).
Dort geht es um **Text** aus Wikivoyage, hier um **Fotos** aus Commons.
Sie haben verschiedene Quellen, Lizenzen und Pflichten, nur der
Wikidata-Verweis als Brücke ist derselbe.

## Skizze

**Finden statt suchen.** Hat ein POI eine Wikidata-Kennung (aus dem
OSM-Tag `wikidata=` der Ortssuche, aus der Ortsableitung req-041 oder
über einen Namens- und Positionsabgleich bei Wikidata), holt wegfara
beim Anlegen:

1. das Hauptbild aus `P18`,
2. weitere Bilder aus der Commons-Kategorie (`P373`) bzw. dem OSM-Tag
   `wikimedia_commons=`, insgesamt bis zur bestehenden Obergrenze von
   sieben (req-068).

Fehlt jeder Verweis, bleibt der POI ohne Commons-Foto. Eine reine
Umkreissuche (`list=geosearch` auf Commons) liefert zu oft Fotos vom
Nachbarhaus, deshalb höchstens als ausdrücklich angestoßener Vorschlag
und nie automatisch.

**Commons zuerst, Google nur zum Auffüllen.** Liefert Commons genug
Fotos, wird bei Google kein Foto mehr abgerufen. Das spart Kosten je
Abruf und verkleinert den Teil, der gegen Googles Bedingungen gespeichert
wird. Die Reihenfolge der Quellen gilt für das Anlegen aus Google-Link,
Ortssuche und KI-Suche gleichermaßen. Ein späterer Schritt kann die
Google-Fotos ganz abschalten; dann ist das der „zulässige Weg“, den
stack.md vorsieht.

**Namensnennung, ohne zu stören.** Am Foto steht klein ein „ⓘ“. Ein
Tipp darauf zeigt Urheber, Lizenz und den Link zur Dateiseite. In der
Begleiter-Kachel, die man mit einer Hand bedient, liegt die Angabe so
unter dem Bild und nicht als Overlay im Bild. Im gedruckten Reiseplan
(req-103) kommt eine kurze Bildnachweis-Zeile an das Foto oder als
Sammelnachweis auf die letzte Seite.

**Datenmodell.** Das bestehende Foto eines POI bekommt eine Herkunft
(`google` | `commons` | `ki`) und, bei Commons, die Felder Urheber,
Lizenz, Lizenz-URL und Dateiseite. Backup und Wiederherstellung
(req-053, req-071) nehmen sie mit. Bilder ohne vollständige Lizenzangabe
werden gar nicht erst übernommen.

**Abgrenzung.** Kein Nachladen für bestehende POIs im ersten Schritt
(wie req-068). Kein Hochladen eigener Fotos nach Commons. Keine
Galerie-Ansicht. Kein Zuschneiden der Commons-Bilder, damit die Frage
nach einer Bearbeitung unter CC BY-SA gar nicht erst aufkommt.
