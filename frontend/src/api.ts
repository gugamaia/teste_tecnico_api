export type Priority = "baixa" | "media" | "alta";
export type Status = "pendente" | "em_andamento" | "concluida";

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  created_at: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.details?.length ? `${j.error}: ${j.details.join("; ")}` : j.error;
    } catch {
      /* corpo não-JSON: mantém a mensagem genérica */
    }
    throw new Error(msg);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  list: (status?: Status) => request<Task[]>("/tasks" + (status ? `?status=${status}` : "")),
  create: (b: { title: string; description: string; priority: Priority }) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(b) }),
  update: (id: number, b: Partial<Pick<Task, "status" | "priority">>) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  remove: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
};
