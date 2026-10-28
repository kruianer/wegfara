import { createAccessLink } from "@/lib/db/access-links";
import { createToken } from "@/lib/auth/tokens";
import { expect, test } from "./fixtures";
import { e2ePool } from "./seed";

/**
 * Einladung per QR-Code annehmen (bug-068).
 *
 * Die Link-Vorschau einer QR-App oder eines Messengers ruft die Adresse
 * ab, bevor die eingeladene Person sie oeffnet. Bis bug-068 verbrauchte
 * schon dieser Abruf die Einladung -- die Person landete auf der
 * Anmeldeseite statt in der Passkey-Einrichtung.
 */

test("Einladung: nach einer Link-Vorschau in die Passkey-Einrichtung", async ({
  seite,
  context,
  request,
  baseURL,
  kontext,
}) => {
  // Die eingeladene Person ist noch nicht angemeldet.
  await context.clearCookies();
  const token = createToken();
  await createAccessLink(e2ePool(), kontext.participantId, token, new Date());
  const einladung = `${baseURL}/einladung?token=${encodeURIComponent(token)}`;

  // Eine Link-Vorschau: ein blosser Abruf, ohne Skript.
  const vorschau = await request.get(einladung, { maxRedirects: 0 });
  expect(vorschau.status()).toBe(200);

  // Ein Geraet, das die Einrichtung nicht von selbst beantwortet -- sonst
  // waere die Seite schon weiter, bevor jemand hinsieht (wie in
  // anmelden.e2e.ts).
  const cdp = await context.newCDPSession(seite);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: false,
    },
  });

  // Ein Link ohne Token ist ungueltig: die Anmeldeseite sagt das an erster
  // Stelle und startet keine Entsperrung.
  await seite.goto("/einladung");
  await expect(seite).toHaveURL(/\/anmeldung\?fehler=einladung/);
  await expect(
    seite.getByRole("heading", { name: "Einladung ungültig" }),
  ).toBeVisible();
  await expect(seite.getByText(/kein Passkey hinterlegt/)).toHaveCount(0);

  // Jetzt oeffnet die Person den Link selbst. Ueber die Seite statt ueber
  // goto: der Rahmen prueft jedes goto auf die Bildschirmbreiten (req-049),
  // und diese Seite geht von selbst weiter.
  await seite.evaluate((ziel) => window.location.assign(ziel), einladung);
  await expect(seite).toHaveURL(`${baseURL}/einladung/passkey`);
  await expect(
    seite.getByRole("button", { name: /Passkey einrichten/ }),
  ).toBeVisible();

  // Eingeloest ist sie jetzt verbraucht.
  const danach = await request.get(einladung, { maxRedirects: 0 });
  expect(danach.headers()["location"]).toContain("fehler=einladung");
});
