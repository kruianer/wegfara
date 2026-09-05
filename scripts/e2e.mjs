// Der Rahmen der E2E-Tests (req-047): `npm run test:e2e`.
//
// Er stellt her, was die Tests im Browser voraussetzen, und raeumt es
// danach wieder weg:
//
//   1. eine Wegwerf-Datenbank auf einem echten PostgreSQL-Server,
//   2. alle Migrationen darauf,
//   3. die gebaute Anwendung, die gegen genau diese Datenbank laeuft,
//   4. `playwright test`,
//   5. Abbau: Server beenden, Datenbank loeschen, Bildverzeichnis raeumen.
//
// Die dev-Umgebung wird dabei nie beruehrt -- weder ihre Datenbank noch ihr
// Bildverzeichnis (siehe delivery/devops.md, Hard Rules). Nach dem Lauf
// bleibt von den Testdaten nichts uebrig.
//
// `npm run test:e2e -- --kein-bau` nimmt einen vorhandenen Bau, statt neu zu
// bauen -- fuer die Arbeit an den Fluessen selbst. Vor der Promotion wird
// immer gebaut: geprueft gehoert der Stand, der deployt wird.
//
// Woher der PostgreSQL-Server kommt, in dieser Reihenfolge:
//   - E2E_DATABASE_URL, wenn gesetzt (ein Server, auf dem Datenbanken
//     angelegt werden duerfen -- die genannte Datenbank selbst wird nicht
//     benutzt),
//   - ein ueber die PG*-Umgebungsvariablen erreichbarer Server,
//   - sonst ein eigener Container `postgres:17-alpine` ueber Docker. Auf dem
//     self-hosted Runner am Beelink laeuft Docker ohnehin (siehe
//     delivery/devops.md) -- ein weiterer Dienst wird nicht vorausgesetzt.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFFLINE_RIEGEL = path.join(WURZEL, "tests", "e2e", "offline-fetch.cjs");
/**
 * Geprueft wird das Bauergebnis, das auch deployt wird: das
 * Standalone-Bundle aus deploy/Dockerfile. So faellt hier auf, was sonst
 * erst auf dev auffiele -- ein Paket, das die Ablaufverfolgung von Next
 * weggelassen hat (siehe bug-006, bug-010).
 */
const STANDALONE = path.join(WURZEL, ".next", "standalone");
const PLAYWRIGHT_BIN = path.join(
  WURZEL,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

/** Nur fuer die Tests -- kein Wert aus einer echten Umgebung (req-047). */
const E2E_AUTH_SECRET = "e2e-auth-secret-nur-fuer-tests-4f2b8c1d";

const kennung = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const DB_NAME = `wegfara_e2e_${kennung}`;

function melde(text) {
  console.log(`[e2e] ${text}`);
}

function laufe(befehl, argumente, optionen = {}) {
  return new Promise((erfuellen, ablehnen) => {
    const kind = spawn(befehl, argumente, {
      cwd: WURZEL,
      stdio: optionen.stille ? "pipe" : "inherit",
      env: optionen.env ?? process.env,
    });
    let ausgabe = "";
    if (optionen.stille) {
      kind.stdout.on("data", (teil) => (ausgabe += teil));
      kind.stderr.on("data", (teil) => (ausgabe += teil));
    }
    kind.on("error", ablehnen);
    kind.on("close", (code) => {
      if (code === 0) erfuellen(ausgabe.trim());
      else
        ablehnen(
          new Error(
            `${befehl} ${argumente.join(" ")} endete mit ${code}\n${ausgabe}`,
          ),
        );
    });
  });
}

async function freierPort() {
  return new Promise((erfuellen, ablehnen) => {
    const server = net.createServer();
    server.on("error", ablehnen);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => erfuellen(port));
    });
  });
}

async function warteAuf(pruefung, sekunden, was) {
  const ende = Date.now() + sekunden * 1000;
  while (Date.now() < ende) {
    if (await pruefung()) return;
    await new Promise((erfuellen) => setTimeout(erfuellen, 500));
  }
  throw new Error(`${was} war nach ${sekunden}s nicht bereit.`);
}

async function serverAntwortet(url) {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/** Dieselbe Verbindung, aber auf eine andere Datenbank gerichtet. */
function mitDatenbank(url, name) {
  const ziel = new URL(url);
  ziel.pathname = `/${name}`;
  return ziel.toString();
}

function urlAusPgUmgebung() {
  const host = process.env.PGHOST;
  if (!host) return null;
  const benutzer = encodeURIComponent(process.env.PGUSER ?? "postgres");
  const passwort = encodeURIComponent(process.env.PGPASSWORD ?? "");
  const port = process.env.PGPORT ?? "5432";
  return `postgres://${benutzer}:${passwort}@${host}:${port}/postgres`;
}

async function dockerVorhanden() {
  try {
    await laufe("docker", ["info"], { stille: true });
    return true;
  } catch {
    return false;
  }
}

async function starteDockerPostgres() {
  if (!(await dockerVorhanden())) return null;

  const port = await freierPort();
  const name = `wegfara-e2e-db-${kennung}`;
  melde(`Starte Wegwerf-PostgreSQL im Container ${name} auf Port ${port}.`);
  await laufe(
    "docker",
    [
      "run",
      "-d",
      "--name",
      name,
      "-e",
      "POSTGRES_USER=wegfara_e2e",
      "-e",
      "POSTGRES_PASSWORD=wegfara_e2e",
      "-e",
      "POSTGRES_DB=postgres",
      "-p",
      `127.0.0.1:${port}:5432`,
      "postgres:17-alpine",
    ],
    { stille: true },
  );

  const url = `postgres://wegfara_e2e:wegfara_e2e@127.0.0.1:${port}/postgres`;
  const abbauen = () => laufe("docker", ["rm", "-f", name], { stille: true });
  try {
    await warteAuf(() => serverAntwortet(url), 60, "Der PostgreSQL-Container");
  } catch (fehler) {
    await abbauen().catch(() => {});
    throw fehler;
  }
  return { url, abbauen };
}

async function findeServer() {
  const genannt = process.env.E2E_DATABASE_URL;
  if (genannt) {
    if (!(await serverAntwortet(genannt))) {
      throw new Error(`E2E_DATABASE_URL ist nicht erreichbar: ${genannt}`);
    }
    melde("Nutze den in E2E_DATABASE_URL genannten PostgreSQL-Server.");
    return { url: genannt, abbauen: async () => {} };
  }

  const ausUmgebung = urlAusPgUmgebung();
  if (ausUmgebung && (await serverAntwortet(ausUmgebung))) {
    melde("Nutze den ueber die PG*-Variablen erreichbaren PostgreSQL-Server.");
    return { url: ausUmgebung, abbauen: async () => {} };
  }

  const container = await starteDockerPostgres();
  if (container) return container;

  throw new Error(
    "Kein PostgreSQL-Server gefunden. Setze E2E_DATABASE_URL oder sorge dafuer, " +
      "dass Docker verfuegbar ist (siehe delivery/devops.md).",
  );
}

async function aufServer(url, sql) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Die Umgebung des Anwendungsservers. Alles, was auf eine echte Umgebung
 * zeigen koennte, wird bewusst entfernt: die Tests sollen nirgendwo
 * anders landen als in ihrer Wegwerf-Datenbank.
 */
function serverUmgebung(datenbankUrl, appUrl, port, bildVerzeichnis) {
  const umgebung = { ...process.env };
  for (const name of Object.keys(umgebung)) {
    if (name.startsWith("PG") || name.startsWith("SMTP_"))
      delete umgebung[name];
  }
  delete umgebung.OPENAI_API_KEY;
  delete umgebung.OPENAI_MODEL;
  delete umgebung.E2E_DATABASE_URL;

  return {
    ...umgebung,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: datenbankUrl,
    APP_URL: appUrl,
    AUTH_SECRET: E2E_AUTH_SECRET,
    IMAGE_DIR: bildVerzeichnis,
    NODE_OPTIONS:
      `${process.env.NODE_OPTIONS ?? ""} --require ${OFFLINE_RIEGEL}`.trim(),
  };
}

async function serverLaeuft(appUrl) {
  try {
    const antwort = await fetch(`${appUrl}/api/health`);
    return antwort.ok;
  } catch {
    return false;
  }
}

async function main() {
  const ohneBau = process.argv.includes("--kein-bau");
  const abbau = [];
  let ergebnis = 1;

  try {
    const server = await findeServer();
    abbau.push(server.abbauen);

    melde(`Lege die Wegwerf-Datenbank ${DB_NAME} an.`);
    await aufServer(server.url, `create database "${DB_NAME}"`);
    const datenbankUrl = mitDatenbank(server.url, DB_NAME);
    abbau.push(async () => {
      melde(`Loesche die Wegwerf-Datenbank ${DB_NAME}.`);
      await aufServer(
        server.url,
        `drop database if exists "${DB_NAME}" with (force)`,
      );
    });

    melde("Wende die Migrationen an.");
    await laufe(
      process.execPath,
      [path.join(WURZEL, "scripts", "migrate.mjs")],
      {
        env: { ...process.env, DATABASE_URL: datenbankUrl },
        stille: true,
      },
    );

    if (ohneBau && existsSync(path.join(STANDALONE, "server.js"))) {
      melde(
        "Ueberspringe den Bau (--kein-bau) und nutze den vorhandenen Stand.",
      );
    } else {
      melde("Baue die Anwendung.");
      await laufe("npm", ["run", "build"], {
        env: { ...process.env, NODE_ENV: "production" },
      });
    }
    // Dieselben zwei Kopien wie im deploy/Dockerfile: das Standalone-Bundle
    // bringt statische Dateien und public/ nicht selbst mit.
    await cp(
      path.join(WURZEL, ".next", "static"),
      path.join(STANDALONE, ".next", "static"),
      { recursive: true },
    );
    await cp(path.join(WURZEL, "public"), path.join(STANDALONE, "public"), {
      recursive: true,
    });

    const port = await freierPort();
    const appUrl = `http://localhost:${port}`;
    const bildVerzeichnis = await mkdtemp(path.join(tmpdir(), "wegfara-e2e-"));
    abbau.push(() => rm(bildVerzeichnis, { recursive: true, force: true }));

    melde(`Starte die Anwendung auf ${appUrl}.`);
    const anwendung = spawn(process.execPath, ["server.js"], {
      cwd: STANDALONE,
      stdio: "inherit",
      env: serverUmgebung(datenbankUrl, appUrl, port, bildVerzeichnis),
    });
    const beendet = new Promise((erfuellen) =>
      anwendung.on("close", erfuellen),
    );
    abbau.push(async () => {
      melde("Beende die Anwendung.");
      anwendung.kill("SIGTERM");
      await Promise.race([
        beendet,
        new Promise((erfuellen) => setTimeout(erfuellen, 10_000)),
      ]);
      if (anwendung.exitCode === null) anwendung.kill("SIGKILL");
    });

    await warteAuf(() => serverLaeuft(appUrl), 120, "Die Anwendung");

    melde("Fuehre die Fluesse im Browser aus.");
    try {
      await laufe(process.execPath, [PLAYWRIGHT_BIN, "test"], {
        env: {
          ...process.env,
          DATABASE_URL: datenbankUrl,
          E2E_BASE_URL: appUrl,
        },
      });
      ergebnis = 0;
    } catch {
      ergebnis = 1;
    }
  } finally {
    for (const schritt of abbau.reverse()) {
      await schritt().catch((fehler) =>
        console.error(`[e2e] Abbau fehlgeschlagen: ${fehler.message}`),
      );
    }
  }

  process.exit(ergebnis);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
