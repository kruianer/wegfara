---
id: bug-030
app: wegfara
req: req-012
priority: high
created: 2026-09-10
---

# Observed

Ein auf der Karte gezeichnetes Suchgebiet ist beim nächsten Mal wieder
weg — es wird offenbar nicht in der Datenbank gespeichert.

Dazu: Die Farbe des Suchgebiets soll **rot oder lila** sein, damit es sich
von den Farben der OpenStreetMap-Karte darunter unterscheidet. Heute geht
es darin unter.

# Expected

Ein gezeichnetes Suchgebiet bleibt erhalten: Nach einem Neuladen der
Seite, einem Wechsel der Reise und dem nächsten Öffnen des Planers ist es
weiterhin da. Es hebt sich farblich von der Karte ab.

# Befund

Auf dev nachgemessen (2026-09-10): Es liegen **zwei** Suchgebiete in der
Datenbank, beide mit Punkten —

    Wien Städtereise   5 Punkte
    Dornbirn           7 Punkte

Gespeichert wird also grundsätzlich. Zu prüfen ist deshalb der Weg
zurück: ob das Gebiet beim Öffnen des Planers geladen und gezeichnet
wird, ob es an der richtigen Reise hängt, und ob ein erneutes Zeichnen
das vorhandene ersetzt statt es zu verlieren.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte ein Suchgebiet zeichnen
3. Seite neu laden oder die Reise wechseln und zurückkommen
4. Das Suchgebiet ist nicht mehr zu sehen
