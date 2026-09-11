---
id: bug-043
app: wegfara
req: req-013
priority: normal
created: 2026-09-11
---

# Observed

Auf der Karte steht eine Legende mit den Statusfarben — dieselben Farben
stehen schon beim POI-Filter nach Status direkt daneben.

# Expected

Die Legende entfällt. Der Statusfilter zeigt die Farben ohnehin zu jedem
Status; eine zweite Auflistung derselben Zuordnung kostet nur Platz.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte die Legende und den Statusfilter vergleichen — beide
   zeigen dieselben Farben

# Ursache

Die Karte trug zwei Auflistungen derselben Zuordnung, jede über
`POI_STATUSES` aus `lib/pois/status-meta.ts`:

- den Statusfilter oben rechts (`.statusFilterPanel` in
  `app/plan/components/poi-map.tsx`) — je Status eine Zeile mit farbigem
  Punkt, Bezeichnung und Schalter,
- und die Legende links unten (`.legend`, `data-testid="poi-legend"`) —
  dieselben fünf Punkte mit denselben Bezeichnungen, nur ohne Schalter.

Sie stammt aus req-013, als der Filter die Farben noch nicht zeigte.
Seitdem sagte sie nichts mehr, was nicht schon daneben stand, und
verdeckte unten links dauerhaft rund 150×110 px der Karte.

# Behebung

Die Legende entfällt; die Statusfarben bleiben allein beim Filter.

- `app/plan/components/poi-map.tsx`: der Block `.legend` mit seinen fünf
  Zeilen ist entfernt. Am Statusfilter ändert sich nichts — er zeigt
  weiterhin je Status Punkt, Bezeichnung und Schalter; ein Kommentar hält
  fest, dass er jetzt die einzige Stelle mit den Farben ist.
- `app/plan/components/poi-map.module.css`: `.legend`, `.legendRow` und
  `.legendDot` sind gestrichen. An ihrer Stelle steht, was dort stand und
  warum es weg ist.
- `components/tippziel-checkbox.tsx`: der Verweis auf „die Legende der
  Karte" nennt jetzt den Statusfilter — die Legende hatte ohnehin nie
  Schalter, gemeint war schon immer der Filter.
- Unverändert bleiben `POI_STATUSES`, `POI_STATUS_LABEL` und
  `POI_STATUS_COLOR`: Filter und Marker holen die Farben weiterhin von
  dort, die Zuordnung selbst ist nicht angetastet.

# Prüfung

Neuer Abschnitt „keine Legende mehr auf der Karte (bug-043)" in
`app/plan/components/poi-map.test.tsx` (drei Tests) und „Legende entfernt
(bug-043)" in `app/plan/components/poi-map.layout.test.ts` (ein Test).

Drei der vier sind ohne die Behebung rot (nachgestellt an der
unveränderten Karte): `poi-legend` steht im Dokument, jede der fünf
Bezeichnungen kommt zweimal vor, und die Regeln der Legende stehen im
CSS. Der vierte ist der Wächter, der die Behebung überhaupt erlaubt: der
Statusfilter zeigt zu jedem der fünf Status seine Farbe — er war auch
vorher schon grün und muss es bleiben, sonst geht mit der Legende eine
Aussage verloren.

Der bisherige Test „zeigt eine Legende mit fuenf Statusfarben" ist
entfallen; die beiden Abschnitte zu bug-025 und bug-029 heißen jetzt nach
dem Statusfilter, den sie schon immer gemeint haben.

Volle Suite grün: 3642 Unit-Tests in 304 Dateien (`npm test`), dazu
`npm run lint`, `npx prettier` und `npx tsc --noEmit`.

Nicht gelaufen: `npm run test:e2e` — auf dieser Maschine fehlen
PostgreSQL und Docker, die das Kommando braucht. Dass die Karte unten
links jetzt frei ist, ist erst auf der dev-URL zu sehen.
