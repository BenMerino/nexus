#!/usr/bin/env node
/**
 * One-shot fix: hector's faculty was set to a non-canonical value.
 * Update to the canonical "Facultad de Ingeniería" from the FACULTADES list.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

(async () => {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const c = new Client({ connectionString: url });
  await c.connect();
  const before = await c.query("SELECT id, full_name, faculty FROM users WHERE username = $1", ["hectorquinteros@utalca.cl"]);
  console.log("BEFORE:", before.rows);
  const r = await c.query(
    "UPDATE users SET faculty = $1 WHERE username = $2 RETURNING id, full_name, faculty",
    ["Facultad de Ingeniería", "hectorquinteros@utalca.cl"]
  );
  console.log("AFTER:", r.rows);
  await c.end();
})();
