import pg from "pg";
import { createApp } from "./app.js";
import { consoleLogger as log } from "./logger.js";
import { PgTaskRepo, migrate } from "./repo.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/tarefas";
const PORT = Number(process.env.PORT ?? 3001);

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });

try {
  await migrate(pool);
} catch (e) {
  log.error("falha ao conectar/migrar o banco (o Postgres está no ar? rode: docker compose up -d)", e);
  process.exit(1);
}

createApp(new PgTaskRepo(pool)).listen(PORT, () => log.info(`api ouvindo em http://localhost:${PORT}`));
