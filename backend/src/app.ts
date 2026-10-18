import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { consoleLogger, type Logger } from "./logger.js";
import { idSchema, statusQuerySchema, taskInSchema, taskPatchSchema, type TaskRepo } from "./types.js";
import type { ZodError } from "zod";

const details = (e: ZodError) => e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export function createApp(repo: TaskRepo, log: Logger = consoleLogger) {
  const app = express();
  app.use(express.json());

  // Log de acesso com id de correlação (também devolvido no header X-Request-Id).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rid = randomUUID().slice(0, 8);
    const start = Date.now();
    res.locals.rid = rid;
    res.setHeader("X-Request-Id", rid);
    res.on("finish", () => {
      log.info(`rid=${rid} ${req.method} ${req.path} status=${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  app.get("/api/tasks", async (req, res) => {
    const q = statusQuerySchema.safeParse(req.query.status);
    if (!q.success) return res.status(400).json({ error: "dados inválidos", details: details(q.error) });
    res.json(await repo.list(q.data));
  });

  app.post("/api/tasks", async (req, res) => {
    const p = taskInSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "dados inválidos", details: details(p.error) });
    const task = await repo.create(p.data);
    log.info(`tarefa_criada id=${task.id} priority=${task.priority}`);
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    const p = taskPatchSchema.safeParse(req.body);
    if (!id.success) return res.status(400).json({ error: "dados inválidos", details: ["id: inválido"] });
    if (!p.success) return res.status(400).json({ error: "dados inválidos", details: details(p.error) });
    const task = await repo.update(id.data, p.data);
    if (!task) {
      log.warn(`tarefa_nao_encontrada id=${id.data}`);
      return res.status(404).json({ error: "tarefa não encontrada" });
    }
    log.info(`tarefa_atualizada id=${task.id} changes=${JSON.stringify(p.data)}`);
    res.json(task);
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "dados inválidos", details: ["id: inválido"] });
    if (!(await repo.remove(id.data))) {
      log.warn(`tarefa_nao_encontrada id=${id.data}`);
      return res.status(404).json({ error: "tarefa não encontrada" });
    }
    log.info(`tarefa_removida id=${id.data}`);
    res.status(204).end();
  });

  // Tratamento centralizado de erros (Express 5 encaminha rejeições de handlers async para cá).
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "JSON inválido" });
    }
    log.error(`rid=${res.locals.rid} erro_nao_tratado`, err);
    res.status(500).json({ error: "erro interno", requestId: res.locals.rid });
  });

  return app;
}
