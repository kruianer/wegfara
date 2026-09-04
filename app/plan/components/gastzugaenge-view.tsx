"use client";

import { useEffect, useId, useState } from "react";
import { QrCode } from "@/components/qr-code";
import type { Trip } from "@/lib/trips/types";
import {
  GUEST_ACCESS_DEFAULT_HOURS,
  GUEST_ACCESS_DURATIONS,
} from "@/lib/guests/duration";
import { GUEST_ACCESS_API } from "@/lib/guests/paths";
import {
  createGuestAccessRequest,
  revokeGuestAccessRequest,
} from "@/lib/guests/request-guest-access";
import {
  GUEST_ACCESS_ERRORS,
  GUEST_PURPOSE_MAX_LENGTH,
  validateGuestAccessDraft,
  type GuestAccessFieldErrors,
} from "@/lib/guests/validate";
import {
  GUEST_ACCESS_STATUS_LABEL,
  type GuestAccess,
  type GuestLink,
} from "@/lib/guests/types";
import { formatMoment } from "@/lib/users/format";
import { PlusIcon } from "./icons";
import styles from "./plan-cards.module.css";

/**
 * Das Formular fuer einen neuen Gastzugang (req-038): Zweck, Reise und
 * Dauer. Ohne gewaehlte Dauer gelten sieben Tage; mehr als 90 Tage lehnt
 * der Server ab.
 */
function GuestAccessForm({
  trips,
  onCreated,
  onCancel,
}: {
  trips: Trip[];
  onCreated: (link: GuestLink) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [purpose, setPurpose] = useState("");
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [hours, setHours] = useState(GUEST_ACCESS_DEFAULT_HOURS);
  const [errors, setErrors] = useState<GuestAccessFieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    const found = validateGuestAccessDraft({ tripId, purpose });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = await createGuestAccessRequest({ tripId, purpose, hours });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setPurpose("");
    onCreated(result.link);
  }

  return (
    <form
      className={styles.form}
      aria-label="Gastzugang erstellen"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.formFields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-purpose`}>
            Zweck
          </label>
          <input
            id={`${fieldId}-purpose`}
            className={styles.input}
            type="text"
            autoComplete="off"
            maxLength={GUEST_PURPOSE_MAX_LENGTH}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
          {errors.purpose && (
            <p className={styles.error} role="alert">
              {errors.purpose}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-trip`}>
            Reise
          </label>
          <select
            id={`${fieldId}-trip`}
            className={styles.stateSelect}
            value={tripId}
            onChange={(event) => setTripId(event.target.value)}
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title}
              </option>
            ))}
          </select>
          {errors.tripId && (
            <p className={styles.error} role="alert">
              {errors.tripId}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${fieldId}-hours`}>
            Dauer
          </label>
          <select
            id={`${fieldId}-hours`}
            className={styles.stateSelect}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          >
            {GUEST_ACCESS_DURATIONS.map((duration) => (
              <option key={duration.hours} value={duration.hours}>
                {duration.label}
              </option>
            ))}
          </select>
          {errors.hours && (
            <p className={styles.error} role="alert">
              {errors.hours}
            </p>
          )}
        </div>
      </div>
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={saving}
        >
          {saving ? "Erstellt…" : "Gastzugang erstellen"}
        </button>
      </div>
    </form>
  );
}

/**
 * Der Gastlink -- genau einmal, unmittelbar nach dem Erstellen (req-038).
 * Als Text UND als QR-Code, mit dem sichtbaren Hinweis, dass er nur jetzt
 * sichtbar ist: danach nie wieder, weil nur sein Hash gespeichert ist.
 */
function GuestLinkPanel({
  link,
  onClose,
  copyToClipboard = (text: string) => navigator.clipboard.writeText(text),
}: {
  link: GuestLink;
  onClose: () => void;
  copyToClipboard?: (text: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await copyToClipboard(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.invitation} data-testid="guest-link-panel">
      <QrCode
        code={link.qr}
        label={`QR-Code des Gastzugangs: ${link.guestAccess.purpose}`}
      />
      <div className={styles.invitationBody}>
        <p className={styles.invitationHint}>
          Dieser Link ist nur jetzt sichtbar — er wird nur als Prüfsumme
          gespeichert und lässt sich später nirgends wiederfinden. Er gilt bis
          zum {formatMoment(link.guestAccess.expiresAt)}.
        </p>
        <p className={styles.invitationLink} data-testid="guest-link">
          {link.url}
        </p>
        <div className={styles.invitationActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void copyLink()}
          >
            Link kopieren
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Schließen
          </button>
        </div>
        {copied && (
          <p className={styles.invitationHint} role="status">
            Der Link liegt in der Zwischenablage.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Der Bereich "Gastzugaenge" des Planers (req-038). Ein Gast bekommt einen
 * Link zu genau einer Reise, nur lesend, befristet und jederzeit
 * widerrufbar -- der Widerruf wirkt sofort, auch fuer eine bereits laufende
 * Gast-Sitzung.
 *
 * Sichtbar fuer den Reiseleiter der Reise, fuer einen Bereichs-Admin und
 * fuer den Gesamt-Admin im Bereich, in den er gewechselt ist. Dieselbe
 * Pruefung findet noch einmal serverseitig statt (siehe
 * app/api/gastzugaenge/route.ts).
 */
export function GastzugaengeView({
  trips,
}: {
  /** Die Reisen, zu denen die angemeldete Person einladen darf. */
  trips: Trip[];
}) {
  const [guestAccesses, setGuestAccesses] = useState<GuestAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<GuestLink | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(GUEST_ACCESS_API);
        if (!response.ok) throw new Error("nicht geladen");
        const payload = (await response.json()) as {
          guestAccesses?: GuestAccess[];
        };
        if (!cancelled) setGuestAccesses(payload.guestAccesses ?? []);
      } catch {
        if (!cancelled)
          setNotice("Die Gastzugänge konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(neu: GuestLink) {
    setCreating(false);
    setNotice(null);
    setLink(neu);
    setGuestAccesses((current) => [neu.guestAccess, ...current]);
  }

  async function revoke(access: GuestAccess) {
    setNotice(null);
    const result = await revokeGuestAccessRequest(access.id);
    if (!result.ok) {
      setNotice("Der Gastzugang konnte nicht widerrufen werden.");
      return;
    }
    setGuestAccesses((current) =>
      current.map((vorhanden) =>
        vorhanden.id === access.id ? result.guestAccess : vorhanden,
      ),
    );
  }

  return (
    <section className={styles.area} aria-label="Gastzugänge">
      <section className={styles.card} aria-label="Vergebene Zugänge">
        <h2 className={styles.cardTitle}>
          Vergebene Zugänge
          <span className={styles.count}>{` · ${guestAccesses.length}`}</span>
        </h2>
        <p className={styles.emptyHint}>
          Ein Gast sieht Plan, Programmpunkte und POIs genau einer Reise — sonst
          nichts, und ändern kann er nichts.
        </p>
        {loading ? (
          <p className={styles.emptyHint}>Lädt…</p>
        ) : guestAccesses.length === 0 ? (
          <p className={styles.emptyHint}>Noch kein Gastzugang.</p>
        ) : (
          <ul className={styles.list}>
            {guestAccesses.map((access) => (
              <li key={access.id} className={styles.item}>
                <div className={styles.row}>
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{access.purpose}</div>
                    <dl className={styles.details}>
                      <div className={styles.detail}>
                        <dt className={styles.detailLabel}>Reise</dt>
                        <dd className={styles.detailValue}>
                          {access.tripTitle}
                        </dd>
                      </div>
                      <div className={styles.detail}>
                        <dt className={styles.detailLabel}>Ablauf</dt>
                        <dd className={styles.detailValue}>
                          {formatMoment(access.expiresAt)}
                        </dd>
                      </div>
                      <div className={styles.detail}>
                        <dt className={styles.detailLabel}>
                          Letzte Verwendung
                        </dt>
                        <dd className={styles.detailValue}>
                          {formatMoment(access.lastUsedAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <span
                    className={
                      access.status === "aktiv"
                        ? styles.accessBadge
                        : `${styles.accessBadge} ${styles.accessBadgeMissing}`
                    }
                  >
                    {GUEST_ACCESS_STATUS_LABEL[access.status]}
                  </span>
                  <div className={styles.rowActions}>
                    {access.status === "aktiv" && (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        aria-label={`Gastzugang widerrufen: ${access.purpose}`}
                        onClick={() => void revoke(access)}
                      >
                        Widerrufen
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <p
            className={styles.notice}
            role="alert"
            data-testid="gastzugang-notice"
          >
            {notice}
          </p>
        )}
        {trips.length === 0 ? (
          <p className={styles.emptyHint}>{GUEST_ACCESS_ERRORS.tripRequired}</p>
        ) : creating ? (
          <div className={styles.item}>
            <GuestAccessForm
              trips={trips}
              onCreated={handleCreated}
              onCancel={() => setCreating(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              setLink(null);
              setCreating(true);
            }}
          >
            <PlusIcon />
            Gastzugang erstellen
          </button>
        )}
        {link && <GuestLinkPanel link={link} onClose={() => setLink(null)} />}
      </section>
    </section>
  );
}
