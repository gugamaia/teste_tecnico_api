# Parte 2: Análise de Incidente

> **Nota:** o enunciado não trouxe os logs. Esta análise usa um cenário ilustrativo e plausível para esta stack (trecho abaixo). Se o avaliador fornecer os logs reais, substitua o trecho e ajuste as conclusões.

## Cenário (logs de exemplo)

```
10:02:11 INFO  rid=a1 POST /api/tasks status=201 12ms
10:14:36 INFO  rid=b6 GET  /api/tasks status=200 4210ms
10:14:37 ERROR rid=b7 erro_nao_tratado Error: timeout exceeded when trying to connect
10:14:37 ERROR rid=b8 erro_nao_tratado Error: timeout exceeded when trying to connect
10:14:38 INFO  rid=b8 POST /api/tasks status=500 5004ms
10:14:38 INFO  rid=b9 GET  /api/tasks status=500 5003ms
10:15:40 INFO  rid=c2 GET  /api/tasks status=200 9ms
```

## Sintoma

Rajadas de 500 em todas as rotas que usam o banco, com latência próxima de 5 s (igual ao `connectionTimeoutMillis` do pool), que somem sozinhas depois de um tempo.

## Causa provável

**Esgotamento do pool de conexões.** O pool tem 10 conexões; quando todas estão ocupadas, novas requisições esperam até 5 s por uma livre e então falham com `timeout exceeded when trying to connect`. Causas típicas:

1. Uma consulta lenta ou transação longa segurando conexões (ex.: relatório, lock em linha, falta de índice conforme a tabela cresce).
2. Vazamento de conexão: `pool.connect()` sem `release()` num caminho de erro. (O código atual usa `pool.query`, que libera sozinho, então o risco existe se alguém introduzir transações manuais sem `try/finally`.)
3. Pico de tráfego acima da capacidade do pool.
4. Banco lento ou indisponível por um instante (failover, reinício).

## Como confirmar

1. Correlacionar o `rid` das requisições que falharam com as que demoraram antes delas (ex.: `rid=b6` com 4,2 s indica a consulta lenta).
2. No Postgres: `SELECT state, count(*) FROM pg_stat_activity GROUP BY 1;` e procurar `idle in transaction` ou consultas longas em `pg_stat_activity`.
3. Expor `pool.totalCount`, `pool.idleCount` e `pool.waitingCount` em log/métrica e ver se `waitingCount` dispara nos horários do erro.
4. Checar `pg_stat_statements` e `EXPLAIN ANALYZE` da consulta suspeita.

## Correções

- **Imediata:** identificar e encerrar a sessão ofensora (`pg_terminate_backend`), definir `statement_timeout` e `idle_in_transaction_session_timeout` no banco para que nenhuma consulta segure conexão indefinidamente.
- Criar o índice que falta / corrigir a consulta lenta; manter transações curtas e sempre usar `try/finally` com `client.release()`.
- Responder `503` com `Retry-After` quando o pool estiver saturado, em vez de 500 genérico, e tratar o evento `error` do pool para não derrubar o processo.
- Dimensionar o pool conforme o limite do Postgres (`max_connections`) e o número de instâncias da API; usar PgBouncer se houver muitas instâncias.

## Prevenção

- Métricas e alerta: `pool.waitingCount > 0` sustentado, latência p95/p99 e taxa de 5xx por rota.
- Logar duração das consultas acima de um limiar (ex.: 500 ms) com o `rid`.
- Teste de carga antes de releases, com volume de dados realista.
- `GET /health` que verifica o banco, para o orquestrador reiniciar ou retirar a instância do balanceamento.
- Runbook: sintoma → checar `pg_stat_activity` → mitigar (encerrar sessão, escalar) → registrar causa raiz.
