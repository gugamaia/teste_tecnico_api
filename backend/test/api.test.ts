import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { silentLogger } from "../src/logger.js";
import type { NewTask, Status, Task, TaskChanges, TaskRepo } from "../src/types.js";

/** Repositório em memória: testa a camada HTTP (rotas, validação, erros) sem precisar de Postgres. */
class MemoryRepo implements TaskRepo {
  private rows: Task[] = [];
  private seq = 0;
  async list(status?: Status) {
    return this.rows.filter((t) => !status || t.status === status).sort((a, b) => b.id - a.id);
  }
  async create(i: NewTask) {
    const t: Task = { id: ++this.seq, ...i, status: "pendente", created_at: new Date().toISOString() };
    this.rows.push(t);
    return t;
  }
  async update(id: number, c: TaskChanges) {
    const t = this.rows.find((r) => r.id === id);
    if (!t) return null;
    Object.assign(t, Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)));
    return t;
  }
  async remove(id: number) {
    const n = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return this.rows.length < n;
  }
}

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp(new MemoryRepo(), silentLogger);
});

describe("API de tarefas", () => {
  it("cria e lista", async () => {
    const r = await request(app).post("/api/tasks").send({ title: "Estudar Node", priority: "alta" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: "pendente", priority: "alta", description: "" });
    const list = await request(app).get("/api/tasks");
    expect(list.body.map((t: Task) => t.id)).toEqual([r.body.id]);
  });

  it("rejeita título curto, vazio e prioridade inválida", async () => {
    expect((await request(app).post("/api/tasks").send({ title: "ab" })).status).toBe(400);
    expect((await request(app).post("/api/tasks").send({ title: "   " })).status).toBe(400);
    expect((await request(app).post("/api/tasks").send({ title: "Tarefa x", priority: "urgente" })).status).toBe(400);
  });

  it("devolve 400 para JSON malformado", async () => {
    const r = await request(app).post("/api/tasks").set("Content-Type", "application/json").send("{oops");
    expect(r.status).toBe(400);
  });

  it("atualiza status e filtra por status", async () => {
    const { body } = await request(app).post("/api/tasks").send({ title: "Tarefa um" });
    await request(app).post("/api/tasks").send({ title: "Tarefa dois" });
    const r = await request(app).patch(`/api/tasks/${body.id}`).send({ status: "concluida" });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("concluida");
    const done = await request(app).get("/api/tasks?status=concluida");
    expect(done.body).toHaveLength(1);
    expect((await request(app).get("/api/tasks?status=xyz")).status).toBe(400);
  });

  it("PATCH: 404 para inexistente, 400 para corpo vazio, status inválido ou id inválido", async () => {
    expect((await request(app).patch("/api/tasks/999").send({ status: "concluida" })).status).toBe(404);
    expect((await request(app).patch("/api/tasks/1").send({})).status).toBe(400);
    expect((await request(app).patch("/api/tasks/1").send({ status: "xyz" })).status).toBe(400);
    expect((await request(app).patch("/api/tasks/abc").send({ status: "concluida" })).status).toBe(400);
  });

  it("remove e devolve 404 na segunda tentativa", async () => {
    const { body } = await request(app).post("/api/tasks").send({ title: "Remover" });
    expect((await request(app).delete(`/api/tasks/${body.id}`)).status).toBe(204);
    expect((await request(app).delete(`/api/tasks/${body.id}`)).status).toBe(404);
    expect((await request(app).get("/api/tasks")).body).toEqual([]);
  });

  it("responde 500 sem vazar detalhes quando o repositório falha, com X-Request-Id", async () => {
    const broken = createApp(
      { ...new MemoryRepo(), list: async () => { throw new Error("db caiu"); } } as unknown as TaskRepo,
      silentLogger,
    );
    const r = await request(broken).get("/api/tasks");
    expect(r.status).toBe(500);
    expect(r.body.error).toBe("erro interno");
    expect(JSON.stringify(r.body)).not.toContain("db caiu");
    expect(r.headers["x-request-id"]).toBeTruthy();
  });
});
