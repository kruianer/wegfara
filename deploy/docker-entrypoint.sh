#!/bin/sh
# Startet die Anwendung -- aber erst, nachdem die gemounteten Verzeichnisse
# dem Benutzer gehoeren, der sie beschreiben soll (bug-027).
#
# Warum das hier steht und nicht im Dockerfile: ein "chown" beim Bauen des
# Abbilds trifft nur das leere Verzeichnis im Abbild. Beim Start legt sich
# der Volume-Mount darueber, und die Rechte des Hosts gewinnen -- gehoert
# das Verzeichnis dort einem anderen Benutzer, kann die Anwendung kein
# einziges Bild ablegen. Genau so verschwanden auf dev die Fotos aus Google.
#
# Deshalb laeuft dieses Skript als root, richtet die Verzeichnisse ein und
# gibt die Rechte danach sofort wieder ab: die Anwendung selbst laeuft
# unveraendert als "nextjs" (siehe delivery/security.md).
set -e

ANWENDER=nextjs

if [ "$(id -u)" = "0" ]; then
  for verzeichnis in "${IMAGE_DIR:-/data/images}" "${BACKUP_DIR:-/data/backups}"; do
    mkdir -p "$verzeichnis"
    # Durchgereicht wird nur, wenn die oberste Ebene noch nicht passt: ein
    # "chown -R" ueber ein gewachsenes Bildverzeichnis kostete bei jedem
    # Start Zeit, ohne etwas zu aendern.
    if [ "$(stat -c %u "$verzeichnis")" != "$(id -u "$ANWENDER")" ]; then
      echo "[start] Rechte an $verzeichnis werden auf $ANWENDER gesetzt."
      chown -R "$ANWENDER:nodejs" "$verzeichnis"
    fi
  done

  exec su-exec "$ANWENDER" "$@"
fi

# Ohne root-Rechte laesst sich nichts uebereignen -- dann laeuft die
# Anwendung unmittelbar weiter. Ob sie ihre Bilder ablegen kann, prueft sie
# beim Start selbst und meldet es ueber /api/health (bug-027).
echo "[start] Kein root: die Rechte an den Datenverzeichnissen bleiben, wie sie sind."
exec "$@"
