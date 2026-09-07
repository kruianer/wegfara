// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MAINTENANCE_TITLE } from "@/lib/backup/maintenance";

vi.mock("@/lib/auth/current-session", () => ({
  currentSession: async () => null,
}));

const { beginRestore, endRestore } = await import("@/lib/backup/maintenance");
const { default: RootLayout } = await import("./layout");

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
