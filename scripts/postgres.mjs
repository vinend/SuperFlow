import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const databaseDir = resolve(".runtime/postgres");
const pg = new EmbeddedPostgres({
  databaseDir,
  user: "superflow",
  password: "superflow_demo",
  port: 5432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
});
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const name of ["superflow", "superflow_test"]) {
  const found = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [name],
  );
  if (!found.rowCount) await client.query(`CREATE DATABASE ${name}`);
}
await client.end();
console.log(
  "PostgreSQL ready at 127.0.0.1:5432. Ctrl+C to stop; data persists in .runtime/postgres.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1000);
