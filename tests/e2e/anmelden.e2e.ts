import { expect, test } from "./fixtures";
import { pruefeBildschirmbreiten } from "./screen-check";

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
        // Erst einmal stumm: seit req-066 laufen Einrichten und Entsperren
        // von selbst los, und ein Geraet, das sofort antwortet, waere mit
        // der Seite schon wieder weg, bevor jemand hinsieht.
        automaticPresenceSimulation: false,
      },
    },
  );

  /** Ob das Geraet eine Entsperrung von sich aus beantwortet. */
  const entsperrungBeantworten = (enabled: boolean) =>
    cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
      authenticatorId,
      enabled,
    });

  // Einrichten: derselbe Bildschirm wie direkt nach einer Einladung. Er
  // legt den Passkey ohne Knopfdruck an (req-066) -- daneben steht nur die
  // eine Flaeche, kein Formular.
  await seite.goto("/einladung/passkey");
  await expect(
    seite.getByRole("button", { name: /Passkey einrichten/ }),
  ).toBeVisible();

  // Jetzt antwortet das Geraet. Neu geladen statt goto: der Rahmen prueft
  // jedes goto auf die Bildschirmbreiten (req-049), und diese Seite geht
  // gleich von selbst weiter -- gemessen wuerde dann ins Leere.
  await entsperrungBeantworten(true);
  await seite.reload();

  // Danach geht es auf die Hauptadresse -- und die leitet weiter, statt
  // eine Auswahl zu zeigen (req-055): die Person fuehrt eine Reise, also in
  // den Planer.
  await expect(seite).toHaveURL(`${baseURL}/plan`);

  // Abmelden, damit die Anmeldung wirklich ueber den Passkey laeuft. Vorher
  // wieder stumm schalten: sonst meldete die Anmeldeseite sofort wieder an.
  await entsperrungBeantworten(false);
  await seite.getByRole("button", { name: "Abmelden" }).click();
  await expect(seite).toHaveURL(`${baseURL}/anmeldung`);

  // Ohne Sitzung fuehrt die geschuetzte Seite auf die Anmeldung.
  await seite.goto("/plan");
  await expect(seite).toHaveURL(/\/anmeldung/);

  // Kein Knopf "Mit Passkey anmelden" mehr, kein Formular: die Entsperrung
  // laeuft bereits, und daneben steht hoechstens die eine Flaeche (req-066).
  await expect(
    seite.getByRole("button", { name: "Mit Passkey anmelden" }),
  ).toHaveCount(0);
  await pruefeBildschirmbreiten(seite, "/anmeldung (Entsperren)");

  // Jetzt antwortet das Geraet -- und die Anmeldeseite meldet beim Oeffnen
  // von selbst an, ohne dass ein Knopf gedrueckt wird (req-066).
  await entsperrungBeantworten(true);
  await seite.reload();

  await expect(seite).toHaveURL(`${baseURL}/plan`);
  await expect(
    seite.getByRole("navigation", { name: "Bereiche" }),
  ).toBeVisible();
});

/**
 * req-066: Die Anmeldeseite muss bei 375 px, 768 px und 1280 px benutzbar
 * sein -- gegen die vier Regeln aus delivery/stack.md. Der Rahmen prueft
 * jede geoeffnete Seite automatisch (req-049); hier kommt der
 * aufgeklappte Weg "Zugang verloren" dazu, den kein goto zeigt.
 */
test("Anmeldeseite: auf allen drei Breiten benutzbar", async ({
  seite,
  context,
}) => {
  // Ohne Sitzung, sonst leitet die Anmeldeseite gleich weiter. Ohne Passkey
  // auf diesem Geraet steht der Anmeldedialog da, ohne vergebliche Abfrage.
  await context.clearCookies();

  await seite.goto("/anmeldung");

  await seite.getByRole("button", { name: "Zugang verloren" }).click();
  await expect(seite.getByLabel("E-Mail-Adresse")).toBeVisible();

  await pruefeBildschirmbreiten(seite, '/anmeldung ("Zugang verloren")');
});
