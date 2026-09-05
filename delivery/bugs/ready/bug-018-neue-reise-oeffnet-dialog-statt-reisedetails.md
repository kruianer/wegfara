---
id: bug-018
app: wegfara
req: req-033
priority: normal
created: 2026-09-05
---

# Observed

Beim Anlegen einer neuen Reise erscheint immer noch der Dialog.

# Expected

Eine neue Reise anlegen führt direkt in die Reisedetails (req-033): sie
erscheinen mit leeren Feldern, erst das Speichern legt die Reise an. Ein
Dialog erscheint dabei nicht.

# Steps

1. Planer öffnen
2. Eine neue Reise anlegen
3. Statt der Reisedetails öffnet sich der Dialog
