import { expect, test } from "./fixtures";

/**
 * Fluss 4 (req-047): mit Passkey anmelden und eine geschuetzte Seite
 * erreichen.
 *
 * Der Passkey wird zuvor auf demselben Weg eingerichtet wie nach einer
 * Einladung (req-023) -- er gehoert zum Geraet, also zu genau diesem
 * Browser. Dafuer bekommt Chromium einen virtuellen Authenticator: er
 * beantwortet die WebAuthn-Aufforderungen so, wie es sonst Face ID, Touch ID
 * oder Windows Hello taeten.
 */

test("Anmelden: mit Passkey auf eine geschützte Seite", async ({
  seite,
  context,
  baseURL,
}) => {
  const cdp = await context.newCDPSession(seite);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        // Der Passkey muss auf dem Geraet auffindbar sein und die
        // Nutzerpruefung nachweisen -- beides verlangt die Anwendung
        // ausdruecklich (req-037).
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );

  /** Ob das Geraet eine Entsperrung von sich aus beantwortet. */
  const entsperrungBeantworten = (enabled: boolean) =>
    cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
      authenticatorId,
      enabled,
    });

  // Einrichten: derselbe Bildschirm wie direkt nach einer Einladung. Danach
  // geht es auf die Hauptadresse -- und die leitet weiter, statt eine Auswahl
  // zu zeigen (req-055): die Person fuehrt eine Reise, also in den Planer.
  await seite.goto("/einladung/passkey");
  await seite.getByRole("button", { name: "Passkey einrichten" }).click();
  await expect(seite).toHaveURL(`${baseURL}/plan`);

  // Abmelden, damit die Anmeldung wirklich ueber den Passkey laeuft. Auch das
  // fuehrt auf die Hauptadresse -- ohne Sitzung von dort zur Anmeldeseite.
  await seite.getByRole("button", { name: "Abmelden" }).click();
  await expect(seite).toHaveURL(`${baseURL}/anmeldung`);

  // Solange nichts beantwortet wird, bleibt die Anmeldeseite stehen. Nur so
  // laesst sich ueberhaupt pruefen, dass die Entsperrung dort von selbst
  // laeuft (req-066): beantwortet das Geraet sofort, waere die Seite schon
  // wieder weg, bevor jemand hinsieht.
  await entsperrungBeantworten(false);

  // Ohne Sitzung fuehrt die geschuetzte Seite auf die Anmeldung.
  await seite.goto("/plan");
  await expect(seite).toHaveURL(/\/anmeldung/);

  // Kein Knopf "Mit Passkey anmelden" mehr, kein Formular: die Entsperrung
  // laeuft bereits, und daneben steht hoechstens die eine Flaeche (req-066).
  await expect(
    seite.getByRole("button", { name: "Mit Passkey anmelden" }),
  ).toHaveCount(0);

  // Jetzt antwortet das Geraet -- und die laufende Abfrage meldet an, ohne
  // dass ein weiterer Knopf gedrueckt wurde.
  await entsperrungBeantworten(true);

  await expect(seite).toHaveURL(`${baseURL}/plan`);
  await expect(
    seite.getByRole("navigation", { name: "Bereiche" }),
  ).toBeVisible();
});
