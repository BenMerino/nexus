const { sql } = require("./sql");

async function createClaustroTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      titulo TEXT NOT NULL,
      fuente_financiamiento TEXT,
      concursable BOOLEAN NOT NULL DEFAULT TRUE,
      externo BOOLEAN NOT NULL DEFAULT TRUE,
      monto NUMERIC,
      fecha_inicio DATE,
      fecha_fin DATE,
      codigo TEXT,
      departamento TEXT,
      notas TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_investigators (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      rol TEXT NOT NULL,
      full_name TEXT NOT NULL,
      orcid TEXT,
      user_id INTEGER REFERENCES users(id),
      matched_by TEXT
    )`;
}

module.exports = { createClaustroTables };
