# Tarefas: Desafio Técnico

CRUD de tarefas ponta a ponta.

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + TypeScript + Vite |
| Back-end | Node.js + Express 5 + TypeScript (validação com Zod) |
| Banco | PostgreSQL 16 (driver `pg`, SQL parametrizado) |
| Testes | Vitest + Supertest |

```
backend/    API REST, repositório Postgres, logs, testes
frontend/   SPA React
docker-compose.yml   Postgres local
```

## Pré-requisitos

- Node.js 20 ou superior
- Docker (para o Postgres): ou um Postgres próprio, informando `DATABASE_URL`

## Como executar

Em três terminais, a partir da raiz do repositório.

**1. Banco**

```bash
docker compose up -d
```

**2. API** (http://localhost:3001) — a tabela é criada automaticamente na subida

```bash
cd backend
npm install
npm run dev
```

**3. Front-end** (http://localhost:5173): o Vite faz proxy de `/api` para a porta 3001

```bash
cd frontend
npm install
npm run dev
```

Variáveis da API (todas opcionais; os padrões já funcionam com o `docker-compose.yml`):

| Variável | Padrão |
|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/tarefas` |
| `PORT` | `3001` |

Build de produção: `npm run build` em `backend/` (gera `dist/`, executado com `npm start`) e em `frontend/`.

## Testes

```bash
cd backend
npm test
```

Resultado esperado: `7 passed`. Os testes usam um repositório em memória, então **não precisam de banco**. Cobrem: criação e listagem, validações (título curto/vazio, prioridade inválida, JSON malformado), atualização de status, filtro, 404, id inválido, remoção e resposta 500 sem vazar detalhes internos.

A camada SQL (`PgTaskRepo`) foi verificada manualmente contra um Postgres real (criar, atualizar, filtrar, remover, validação e logs). Uma melhoria listada abaixo é automatizar isso.

## API

| Método | Rota | Descrição | Respostas |
|---|---|---|---|
| GET | `/api/tasks?status=pendente\|em_andamento\|concluida` | Lista tarefas (filtro opcional) | 200, 400 |
| POST | `/api/tasks` | Cria tarefa `{title, description?, priority?}` | 201, 400 |
| PATCH | `/api/tasks/:id` | Atualiza `status` e/ou `priority` | 200, 400, 404 |
| DELETE | `/api/tasks/:id` | Remove tarefa | 204, 400, 404 |

Regras: `title` de 3 a 100 caracteres (após trim); `description` até 500; `priority` ∈ `baixa|media|alta` (padrão `media`); `status` inicia em `pendente`.

Erros de validação: `400 {"error":"dados inválidos","details":["title: mínimo de 3 caracteres"]}`. Erros internos: `500 {"error":"erro interno","requestId":"..."}` (sem detalhes sensíveis).

```bash
curl -X POST localhost:3001/api/tasks -H 'Content-Type: application/json' \
  -d '{"title":"Escrever README","priority":"alta"}'
```

## Logs

Formato `timestamp NÍVEL mensagem`. Toda requisição gera `rid=<id> MÉTODO /rota status=<código> <ms>ms`; o mesmo `rid` volta no header `X-Request-Id` e no corpo dos erros 500, para correlacionar a reclamação do usuário com a linha de log. Eventos de negócio: `tarefa_criada`, `tarefa_atualizada`, `tarefa_removida`, `tarefa_nao_encontrada` (WARN) e exceções não tratadas com stack trace (ERROR). Se o banco estiver fora do ar na subida, a API registra o erro com a dica de rodar `docker compose up -d` e encerra.

## Nota técnica

**Decisões**
- **Repositório como interface (`TaskRepo`)**: as rotas dependem do contrato, não do Postgres. Isso permite testar a camada HTTP sem banco (rápido e sem infraestrutura) e trocar o armazenamento sem mexer nas rotas.
- **Zod no back-end** é a fonte de verdade das regras; o front repete só a checagem de título curto, por UX. Os tipos são inferidos do schema.
- **`pg` com SQL parametrizado**, sem ORM: para uma tabela, menos código e sem risco de SQL injection. `CHECK` constraints no banco garantem `priority`/`status` válidos mesmo fora da API.
- **Migração simples** (`CREATE TABLE IF NOT EXISTS` na subida): zero passos manuais para quem avalia.
- **Express 5**: rejeições de handlers `async` vão direto ao middleware de erro, que centraliza o 500 e o log.
- **React sem biblioteca de estado ou UI**: `useState` + `fetch` bastam para o fluxo. Proxy do Vite evita CORS em desenvolvimento.

**Trade-offs**
- Sem autenticação, paginação ou rate limit.
- Migrations não versionadas: serve para um schema, não para evolução em equipe.
- Os testes automatizados não exercitam o SQL real (só a camada HTTP com fake); a cobertura do `PgTaskRepo` foi manual.
- Sem testes de front-end.
- Pool do `pg` com 10 conexões e timeout de 5 s para obter conexão: falha rápido em vez de enfileirar indefinidamente.

**Melhorias futuras**
- Testes de integração do `PgTaskRepo` com Postgres efêmero (Testcontainers ou serviço no CI) e testes de componente no front (Testing Library) / E2E (Playwright).
- Migrations versionadas (Prisma, Knex ou node-pg-migrate), paginação, busca e edição completa.
- Logs estruturados em JSON (pino) com métricas, healthcheck (`/health`) e encerramento gracioso.
- Autenticação, rate limit, Dockerfile da aplicação e pipeline de CI.

## Parte 2 — Análise de incidente

Ver [`INCIDENTE.md`](INCIDENTE.md).
