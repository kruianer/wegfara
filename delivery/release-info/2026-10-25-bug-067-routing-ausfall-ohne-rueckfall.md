---
repo: Wegfara
package: bug-067-routing-ausfall-ohne-rueckfall
date: 2026-10-25
---
Fällt der Routing-Dienst kurz aus, fragt die App von selbst erneut nach, statt sofort aufzugeben. Bei einem längeren Ausfall zeigt der Live-Status im Begleiter bis zu einer halben Stunde lang die zuletzt bekannte Verspätung mit dem Zusatz „Stand“ und der Uhrzeit, statt „Verzug gerade nicht ermittelbar“. Bei einer Störung steht im Server-Log jetzt der Grund. Sie müssen dafür nichts einstellen.
