---
id: bug-046
app: wegfara
req: req-023
priority: high
created: 2026-09-16
---

# Observed

Auf prod mit dem Anmeldelink eingeloggt — war kurz drin, konnte aber
keinen Passkey einrichten. Beim zweiten Versuch geht es gar nicht mehr.

# Expected

Wer sich anmeldet, bleibt angemeldet — lange genug, um einen Passkey
einzurichten und eine erste Reise anzulegen.

# Befund

Auf prod nachgemessen (2026-09-16): **0 Passkeys, 0 Sitzungen**, beide
Anmeldelinks verbraucht. Und: **0 Reisen** — sie wurden zuvor entfernt,
weil es Demo-Daten aus den Migrationen waren (siehe req-064).

`sessionRemainsValid()` in `lib/auth/session-access.ts` lässt eine Sitzung
nur gelten, wenn eine von drei Bedingungen zutrifft:

    if (await leadsAnyTrip(db, participantId)) return true;
    if (await isInReleasedTrip(db, participantId)) return true;
    return hasOpenRating(db, participantId);

Ohne Reisen trifft **keine** zu. Die Sitzung entsteht beim Einlösen des
Links und wird beim nächsten Aufruf sofort wieder beendet — man ist drin
und im selben Moment draußen. Einen Passkey einzurichten reicht die Zeit
nicht.

Daraus folgt eine Sackgasse: Um eine Reise anzulegen, muss man angemeldet
sein; um angemeldet zu bleiben, braucht es eine Reise.

**Der Kommentar über der Funktion beschreibt es anders** als der Code:

    Fuer den Reiseleiter gilt die Einschraenkung nicht -- er bleibt
    angemeldet, solange seine Sitzung nicht abgelaufen ist.

Gemeint ist offenbar die Rolle. Geprüft wird aber `leadsAnyTrip` — „führt
gerade eine Reise". Ohne Reisen gibt es keinen Reiseleiter, und der
**Account-Admin** fällt ebenfalls durch, obwohl er derjenige ist, der
Reisen und Personen überhaupt erst anlegt.

**Zu tun: Der Account-Admin ist von der Einschränkung ausgenommen.** Er
bleibt angemeldet, solange seine Sitzung nicht abgelaufen ist — ohne
Reise, ohne Zuordnung, ohne offene Bewertung. Er ist derjenige, der
Reisen und Personen anlegt; ihn an eine Reise zu binden, die es noch
nicht gibt, sperrt jede frische Umgebung zu.

Dasselbe gilt für den Gesamt-Admin (req-025). Für gewöhnliche Teilnehmer
bleibt die Regel aus req-023 unverändert.

# Steps

1. Eine Umgebung ohne Reisen (frisch aufgesetzt oder aufgeräumt)
2. Über den Anmeldelink anmelden
3. Eine beliebige Seite aufrufen — man landet wieder auf der Anmeldeseite
