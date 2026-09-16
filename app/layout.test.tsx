// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MAINTENANCE_TITLE } from "@/lib/backup/maintenance";

vi.mock("@/lib/auth/current-session", () => ({
  currentSession: async () => null,
}));

const { beginRestore, endRestore } = await import("@/lib/backup/maintenance");
const { default: RootLayout, metadata, viewport } = await import("./layout");
const { ICON_APPLE_GROESSE, ICON_TAB_GROESSE, iconPfad } = await import(
  "@/lib/icon/icon-pfade"
);
const { APP_GRUNDTON, APP_NAME } = await import("@/lib/marke");

afterEach(() => {
  endRestore();
});

async function seite() {
  return renderToStaticMarkup(
    await RootLayout({ children: <p>Der gewohnte Inhalt</p> }),
  );
}

describe("Wurzel-Layout waehrend einer Wiederherstellung (req-053)", () => {
  it("zeigt sonst den gewohnten Inhalt", async () => {
    expect(await seite()).toContain("Der gewohnte Inhalt");
  });

  it("zeigt waehrend der Wiederherstellung den Hinweis statt des Inhalts", async () => {
    beginRestore();

    const markup = await seite();

    expect(markup).toContain(MAINTENANCE_TITLE);
    expect(markup).not.toContain("Der gewohnte Inhalt");
  });
});

describe("Icon im Browser-Tab (req-065)", () => {
  it("weist den Browser auf die Kompassrose hin", () => {
    const icons = metadata.icons as { icon: { url: string; sizes: string }[] };

    expect(icons.icon).toContainEqual(
      expect.objectContaining({
        url: iconPfad(ICON_TAB_GROESSE),
        sizes: `${ICON_TAB_GROESSE}x${ICON_TAB_GROESSE}`,
      }),
    );
  });

  it("nennt dem Homescreen von iPad und iPhone dasselbe Zeichen", () => {
    const icons = metadata.icons as { apple: { url: string; sizes: string }[] };

    expect(icons.apple).toContainEqual(
      expect.objectContaining({
        url: iconPfad(ICON_APPLE_GROESSE),
        sizes: `${ICON_APPLE_GROESSE}x${ICON_APPLE_GROESSE}`,
      }),
    );
  });
});

describe("Name unter dem Icon auf dem Homescreen (req-065)", () => {
  it("sagt Apple, dass dort Wegfara steht", () => {
    const appleWebApp = metadata.appleWebApp as { title: string };

    // Ohne diesen Hinweis nimmt iOS den Titel des Browser-Tabs.
    expect(appleWebApp.title).toBe(APP_NAME);
    expect(APP_NAME).toBe("Wegfara");
  });
});

describe("Start vom Homescreen ohne Adresszeile (req-065)", () => {
  it("meldet Apple die App als eigenstaendig", () => {
    const appleWebApp = metadata.appleWebApp as { capable: boolean };

    expect(appleWebApp.capable).toBe(true);
  });

  it("nennt den Hinweis auch in der Schreibweise, die Safari seit jeher liest", () => {
    // Next schreibt aus `capable` nur <meta name="mobile-web-app-capable">.
    // Aeltere iPads oeffnen damit weiterhin ein Fenster mit Adresszeile.
    const other = metadata.other as Record<string, string>;

    expect(other["apple-mobile-web-app-capable"]).toBe("yes");
  });

  it("schiebt die Seite nicht unter die Statusleiste", () => {
    const appleWebApp = metadata.appleWebApp as { statusBarStyle: string };

    expect(appleWebApp.statusBarStyle).toBe("default");
  });

  it("faerbt die Leisten um das Fenster im Grundton der Anwendung", () => {
    expect(viewport.themeColor).toBe(APP_GRUNDTON);
  });
});
