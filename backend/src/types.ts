import { z } from "zod";

export const PRIORITIES = ["baixa", "media", "alta"] as const;
export const STATUSES = ["pendente", "em_andamento", "concluida"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  created_at: string;
}

export interface NewTask {
  title: string;
  description: string;
  priority: Priority;
}

export interface TaskChanges {
  status?: Status;
  priority?: Priority;
}

/** Contrato de persistência: permite trocar o Postgres por um fake nos testes. */
export interface TaskRepo {
  list(status?: Status): Promise<Task[]>;
  create(input: NewTask): Promise<Task>;
  update(id: number, changes: TaskChanges): Promise<Task | null>;
  remove(id: number): Promise<boolean>;
}

export const taskInSchema = z.object({
  title: z.string().trim().min(3, "mínimo de 3 caracteres").max(100, "máximo de 100 caracteres"),
  description: z.string().max(500, "máximo de 500 caracteres").default(""),
  priority: z.enum(PRIORITIES).default("media"),
});

export const taskPatchSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined, {
    message: "informe status e/ou priority",
  });

export const idSchema = z.coerce.number().int().positive();
export const statusQuerySchema = z.enum(STATUSES).optional();
