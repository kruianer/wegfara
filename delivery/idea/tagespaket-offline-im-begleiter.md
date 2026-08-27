---
titel: Tagespaket — der heutige Plan funktioniert ohne Netz
datum: 2026-08-27
---

## Problem/Nutzen

Der Begleiter (`/go`) ist heute vollständig netzabhängig: Reise, Reisetage,
Programmpunkte, Transfers, Wetter und Karte werden bei jedem Aufruf frisch
vom Server geholt (req-001 bis req-008). Ohne Netz zeigt die App nichts —
nicht einmal, wo man als Nächstes hin muss. Es gibt im Repo bislang keinerlei
Vorkehrung dafür: kein Service Worker, kein Web-App-Manifest, keine
Zwischenspeicherung; der PWA-Punkt aus [stack.md](../stack.md) ist noch
unangetastet.

Genau dort, wo wegfara helfen soll, ist Netz die unzuverlässigste Zutat:
Auslandsreise ohne Datenroaming, Berghütte, U-Bahn, Küstenstraße, leerer
Akku im Sparmodus, überlastete Zelle beim Stadtfest. Die Ironie: Je mehr der
Plan aus dem Ruder läuft — der Kernmoment der Vision — desto eher steht man
irgendwo, wo es kein Netz gibt. Eine App, die man unterwegs tatsächlich zückt
(Zielbild der Ideen-Richtung), muss den heutigen Tag auch dann noch beantworten
können, wenn das Balkensymbol leer ist. Aktuell wäre der erste echte
Reise-Durchlauf schon durch einen Tunnel gefährdet.

Der Nutzen ist konkret und heute messbar: „Wo muss ich als Nächstes hin, wann,
welche Adresse, welches Ticket?" wird vom Netz entkoppelt. Das ist keine
Komfortfunktion, sondern die Voraussetzung dafür, dass der Begleiter im
Ausland überhaupt benutzbar ist.

## Skizze

**Packen, solange es gut geht.** Wird der Begleiter mit Netz geöffnet (im
Hotel-WLAN, morgens beim Frühstück), legt er im Hintergrund ein *Tagespaket*
für den ausgewählten Reisetag und den Folgetag ab: Programmpunkte mit Zeiten,
Optionen (req-004) und Transfers (req-006), Namen, Adressen und Koordinaten
der zugehörigen POIs, Buchungsstatus (req-005), das zuletzt geholte Wetter mit
Zeitstempel, sowie die bereits abgelegten Belege und Tickets des Tages. Kein
eigener Bedienschritt — das Paket entsteht beim normalen Benutzen.

**Sichtbar, statt geraten.** Im Kopfbereich zeigt eine kleine Zeile den
Zustand: „Für heute gepackt — 07:40" bzw. „Noch nicht gepackt". Wer weiß, dass
er gleich in den Zug ohne Empfang steigt, sieht auf einen Blick, ob er
versorgt ist, und kann mit einem Tipp neu packen. Ohne Netz erscheint statt
eines Ladefehlers derselbe Plan mit dem Hinweis „Stand 07:40, offline" — die
Daten sind nie unkommentiert alt.

**Lesen ohne Netz, Schreiben mit Gedächtnis.** Alle lesenden Ansichten des
Begleiters bedienen sich aus dem Paket, wenn der Server nicht erreichbar ist.
Änderungen, die unterwegs entstehen (etwa das Bestätigen einer Anpassung oder
später eine erfasste Ausgabe), landen in einer Warteschlange und werden
gesendet, sobald wieder Netz da ist — dafür ist der Datenzugriffs-Layer mit
seinem verzögerten Schreiben aus [stack.md](../stack.md) bereits der richtige
Ort; die Warteschlange ist dessen Fortsetzung über eine Netzunterbrechung
hinweg, nicht ein zweiter Mechanismus daneben. Gesendet wird erst, wenn der
Server bestätigt; nichts verschwindet stillschweigend.

**Die Karte ehrlich behandeln.** Kartenkacheln kommen heute direkt von
`tile.openstreetmap.org`. Deren Nutzungsbedingungen verbieten das
Vorab-Herunterladen von Kachelvorräten ausdrücklich (Bulk Downloading) — ein
„Karte für die Region mitnehmen" ist damit **nicht** erlaubt und gehört nicht
in diese Idee. Das Tagespaket beschränkt sich auf das, was ohnehin geladen
wurde: bereits betrachtete Kacheln bleiben im Rahmen ihrer Cache-Vorgaben
nutzbar, mehr nicht. Fehlt die Karte offline, tritt an ihre Stelle das, was
wirklich zählt und im Paket liegt: Adresse, Koordinaten und ein
Navigations-Link, der beim nächsten Netzkontakt greift. Falls sich später
herausstellt, dass eine mitgenommene Karte unverzichtbar ist, ist das eine
eigene Frage nach einer Kachelquelle mit passender Lizenz — kein Nebeneffekt
dieser Idee.

**Sparsam bleiben.** Gespeichert wird nur der aktuelle und der folgende
Reisetag der geöffneten Reise, nichts darüber hinaus; beim Wechsel der Reise
oder nach Ende des Reisezeitraums wird das Paket verworfen. Keine Positionen,
keine Historie (Leitprinzip „Standortdaten sparsam"). Das hält die Datenmenge
klein und vermeidet, dass auf dem Gerät ein zweiter, langlebiger Datenbestand
entsteht.

**Abgrenzung.** Baut auf keiner vorhandenen Idee auf und ist keine Variante
davon: Die Ein-Tipp-Störungsmeldung betrifft eine Eingabe des Nutzers, die
Öffnungszeiten aus OpenStreetMap und die Wikivoyage-Kurzbeschreibung sind
Datenquellen für POI-Felder — alle drei setzen selbstverständlich voraus, dass
die App im entscheidenden Moment überhaupt etwas anzeigt, und genau das
liefert diese Idee nach. Kein Requirement deckt es ab: req-001 bis req-008
beschreiben ausschließlich Darstellung bei erreichbarem Server, req-016
(Anmeldung) regelt die Sitzung, nicht die Datenverfügbarkeit. Der Stack wird
nicht angetastet — die PWA ist dort bereits gesetzt, sie ist nur noch nicht
gebaut.
