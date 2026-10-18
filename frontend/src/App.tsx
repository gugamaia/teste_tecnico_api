import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./api";
import type { Priority, Status, Task } from "./api";

const STATUS_LABEL: Record<Status, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Status | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setTasks(await api.list(filter || undefined));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Executa uma ação da API, recarrega a lista e exibe qualquer erro.
  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError("");
    const t = title.trim();
    if (t.length < 3) return setError("O título deve ter ao menos 3 caracteres.");
    setLoading(true);
    await run(async () => {
      await api.create({ title: t, description, priority });
      setTitle("");
      setDescription("");
      setPriority("media");
    });
    setLoading(false);
  };

  return (
    <main>
      <h1>Tarefas</h1>

      <form onSubmit={submit} noValidate>
        <input
          placeholder="Título (3 a 100 caracteres)"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Descrição (opcional, até 500)"
          value={description}
          maxLength={500}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </select>
        <div className="erro" role="alert">
          {error}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Adicionar"}
        </button>
      </form>

      <label>
        Filtro:{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value as Status | "")}>
          <option value="">Todas</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      {tasks.length === 0 && <p className="vazio">Nenhuma tarefa.</p>}
      <ul>
        {tasks.map((t) => (
          <li key={t.id} className={t.status}>
            <span className="t" title={t.description}>
              {t.title}
            </span>
            <span className="tag">{t.priority}</span>
            <select value={t.status} onChange={(e) => run(() => api.update(t.id, { status: e.target.value as Status }))}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button aria-label="Remover" onClick={() => run(() => api.remove(t.id))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
