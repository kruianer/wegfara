---
repo: Wegfara
package: bug-071-gewaehlte-option-nach-neuladen-weg
date: 2026-10-28
---
Wählt man im Begleiter eine andere Alternative, bleibt sie jetzt auch nach dem Neuladen gewählt. Der zuletzt abgebrochene Live-Gang kann damit erneut gestartet werden. Außerdem wird jede Änderung schon vor dem Ausrollen auf die Testumgebung vollständig im echten Browser geprüft, sodass solche Fehler nicht erst beim Live-Gang auffallen. Das Ausrollen auf die Testumgebung dauert dadurch ein paar Minuten länger.
