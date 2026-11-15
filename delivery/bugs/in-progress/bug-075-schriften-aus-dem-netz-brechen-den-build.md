---
id: bug-075
title: Der Build holt die Schriften aus dem Netz und scheitert, wenn es einmal nicht geht
app: wegfara
area: DevOps
severity: hoch
created: 2026-11-15
---

# Was passiert

Der Build bricht mit 8 bis 16 gleichlautenden Fehlern ab:

```
Error: Turbopack build failed with 16 errors:
Module not found: Can't resolve
  '@vercel/turbopack-next/internal/font/google/font'
- Execution of <NextFontGoogleFontFileReplacer as
  ImportMappingReplacement>::result failed
```

Dann steht der Deploy. Auf prod bedeutet das: Das Gate läuft grün, die
Testsuite ist grün, und der Lauf scheitert trotzdem — am Bauen, nicht
am Code.

# Wie oft

**Drei Deploys in zwei Tagen**, bei unverändertem Code:

| Tag | Lauf | Wo |
| --- | --- | --- |
| 13.11. | 43468661179 | dev, E2E-Schritt |
| 14.11. | 43568678910 | prod, Docker-Build |
| 15.11. | 43691263920 | prod, E2E-Schritt |

Jeder wurde **unverändert wiederholt und war grün**. Kein Commit, keine
Abhängigkeit, keine Einstellung dazwischen.

# Warum

`next/font/google` lädt die Schriften **beim Bauen** über das Netz
herunter und legt sie ins eigene Bundle. Das ist genau richtig gewählt
und steht so im Kommentar (`app/plan/layout.tsx:18`):

> `next/font/google` laedt sie beim Bauen herunter und liefert sie aus
> dem eigenen Bundle aus (siehe `.next/static`): im Browser wird kein
> fremder Dienst angesprochen.

Im **Browser** spricht also niemand Google an — das soll so bleiben.
Beim **Bauen** aber hängt jeder Lauf an fonts.googleapis.com, und es
sind fünf Familien, also mehrere Abrufe:

`Figtree`, `Playfair_Display`, `Caveat`, `Space_Grotesk`, `Albert_Sans`

Antwortet einer davon nicht, bricht der ganze Build ab. Nachgemessen am
15.11.: Google Fonts war vom Beelink aus mit 200 erreichbar, und auch
aus einem `node:22-alpine`-Container heraus — die Störung ist kurz und
kommt wieder.

Das ist ein Quality-Gate, das an der Umgebung scheitert statt am Code —
dieselbe Art Fehler, die schon einmal die Node-Version festlegen liess
(`deploy-prod.yml`, Kommentar beim `setup-node`-Schritt).

# Erwartet

Der Build gelingt ohne Netz zu Google. Die Schriften gehören zum
Vorrat, den das Repo mitbringt, nicht zu dem, was ein Lauf sich
beschafft.

# Vorschlag

Die fünf Familien **einmal herunterladen, ins Repo legen** und über
`next/font/local` einbinden. Dann

- ist der Build von Google unabhängig,
- bleibt es dabei, dass der Browser keinen fremden Dienst anspricht
  (das Ziel aus `stack.md`),
- und es fällt auf, wenn sich eine Schrift ändert, statt dass sie sich
  stillschweigend ändert.

Zu entscheiden ist, welche Schnitte und Stärken tatsächlich gebraucht
werden — heute holt der Build für `Playfair_Display` drei Stärken in
zwei Stilen. Nur die wirklich benutzten ins Repo zu legen hält es klein.

# Abgrenzung

- Die **Schriftwahl** ändert sich nicht. Es geht allein darum, woher die
  Dateien beim Bauen kommen.
- Der **Rückfall** im Stylesheet bleibt, wie er ist („Segoe Script" auf
  Windows, „Bradley Hand" auf Apple-Geräten).
- Ein Wiederholen des Laufs ist keine Behebung: Es hat dreimal
  funktioniert und wird wieder nötig sein.
