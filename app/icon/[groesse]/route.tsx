import { ImageResponse } from "next/og";
import { iconFarben } from "@/lib/icon/icon-farben";
import { iconGroesseAus } from "@/lib/icon/icon-pfade";
import { kompassroseIconSvg } from "@/lib/icon/kompassrose";

/**
 * Liefert das Icon der Anwendung als PNG (req-065) -- dieselbe Kompassrose,
 * die auf der Anmeldeseite und in der Bereichsleiste steht.
 *
 * Gerechnet wird bei der Anfrage und nicht beim Bauen: die Farbe haengt an
 * der Umgebung, und dev wie prod bauen aus demselben Stand. Genau daran
 * lassen sich beide auf demselben Homescreen unterscheiden -- dev traegt
 * einen anderen Grund als prod (lib/icon/icon-farben.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groesse: string }> },
) {
  const { groesse: angefragt } = await params;
  const groesse = iconGroesseAus(angefragt);
  if (groesse === null) return new Response(null, { status: 404 });

  const farben = iconFarben();
  const svg = kompassroseIconSvg(groesse, farben);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: farben.grund,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={groesse}
          height={groesse}
          alt=""
          src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        />
      </div>
    ),
    { width: groesse, height: groesse },
  );
}
