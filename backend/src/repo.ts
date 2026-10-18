import type { Pool } from "pg";
import type { NewTask, Status, Task, TaskChanges, TaskRepo } from "./types.js";

const COLUMNS = "id, title, description, priority, status, created_at";

function toTask(row: any): Task {
  return { ...row, created_at: new Date(row.created_at).toISOString() };
}

export async function migrate(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(100) NOT NULL,
      description VARCHAR(500) NOT NULL DEFAULT '',
      priority    TEXT NOT NULL DEFAULT 'media'
                  CHECK (priority IN ('baixa','media','alta')),
      status      TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_andamento','concluida')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

export class PgTaskRepo implements TaskRepo {
  constructor(private pool: Pool) {}

  async list(status?: Status): Promise<Task[]> {
    const r = status
      ? await this.pool.query(`SELECT ${COLUMNS} FROM tasks WHERE status = $1 ORDER BY id DESC`, [status])
      : await this.pool.query(`SELECT ${COLUMNS} FROM tasks ORDER BY id DESC`);
    return r.rows.map(toTask);
  }

  async create(t: NewTask): Promise<Task> {
    const r = await this.pool.query(
      `INSERT INTO tasks (title, description, priority) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
      [t.title, t.description, t.priority],
    );
    return toTask(r.rows[0]);
  }

  async update(id: number, changes: TaskChanges): Promise<Task | null> {
    // As chaves vêm do schema zod (apenas status/priority), nunca direto do cliente.
    const entries = Object.entries(changes).filter(([, v]) => v !== undefined);
    const sets = entries.map(([k], i) => `${k} = $${i + 1}`).join(", ");
    const r = await this.pool.query(
      `UPDATE tasks SET ${sets} WHERE id = $${entries.length + 1} RETURNING ${COLUMNS}`,
      [...entries.map(([, v]) => v), id],
    );
    return r.rows[0] ? toTask(r.rows[0]) : null;
  }

  async remove(id: number): Promise<boolean> {
    const r = await this.pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    return (r.rowCount ?? 0) > 0;
  }
}
