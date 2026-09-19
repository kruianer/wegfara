---
id: bug-049
app: wegfara
req: req-068
priority: normal
created: 2026-09-19
---

# Observed

Seit req-068 sollen bis zu sieben Fotos je POI übernommen werden. Lege ich
einen POI über die **KI-Suche** an, kommt trotzdem nur **ein** Foto mit.

# Expected

Auch über die KI-Suche angelegte POIs bekommen bis zu sieben Fotos — wie
in req-068 festgelegt. Der Weg, auf dem ein POI entsteht, darf die Anzahl
nicht ändern.

# Steps

1. Planer öffnen, Bereich POIs
2. Über die KI-Suche nach POIs suchen
3. Einen Treffer übernehmen
4. Der POI hat nur ein Foto

# Ursache

req-068 hat die Obergrenze in `MAX_PHOTOS` zusammengeführt, aber
[poi-search/route.ts](../../../app/api/poi-search/route.ts) (Zeile 150)
schneidet unabhängig davon auf eins zu:

```
const photoNames = outcome.treffer[index].photoNames.slice(0, 1);
```

Diese dritte Stelle war in req-068 nicht erfasst — dort standen nur der
Google-Client und das Anlegen über `app/api/pois/route.ts`. Die Suche holt
deshalb weiterhin genau ein Foto, gleich was `MAX_PHOTOS` sagt.

Damit ist auch das Abnahmekriterium aus req-068 verletzt, das verlangt,
dass die Obergrenze an genau einer Stelle steht.

# Notes

Beim Beheben prüfen, ob es noch weitere Stellen gibt, die Fotos
eigenmächtig begrenzen — `.slice(0, ` auf `photoNames` im ganzen Repo.

Bereits angelegte POIs werden nicht nachträglich ergänzt (req-068,
Constraints).
