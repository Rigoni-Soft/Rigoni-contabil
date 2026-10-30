---
name: esteira-planejar
description: Estação 2 da esteira de desenvolvimento — fatia a spec em tickets verticais (to-tickets), triageia (triage) e marca a frente de cada um (frente:frontend, frente:backend ou frente:ambas). Uso — /esteira-planejar <nº da spec>.
argument-hint: <spec>
disable-model-invocation: true
---

Argumento: `$ARGUMENTS` = nº da issue da spec. Sem ele, pergunte e pare. Interativa: roda no contexto principal.

## 1. Tickets

Leia a spec (`gh issue view`) e chame a Skill `to-tickets`. Os tickets são **fatias verticais entregáveis**, atômicas e independentes, com o grafo de bloqueio declarado. Não crie ticket "só de backend" e outro "só de frontend" da mesma fatia.

## 2. Triage

Chame a Skill `triage` nos tickets criados: prioridade, estado e papel pela máquina de estados do projeto.

## 3. Frentes (label)

Garanta os rótulos, uma vez: `gh label create "frente:frontend" --force`, `"frente:backend"` e `"frente:ambas"`.

Marque cada ticket pelo que ele toca:
- **frontend**: `src/app`, `src/presentation`, `modules/*/presentation` (telas, componentes, estado, integração visual).
- **backend**: `modules/*/{domain,application,infra}`, `src/main`, `supabase/` (API, regras, banco, serviços).
- **ambas**: a fatia cruza as duas.

## 4. Saída

Reporte o backlog em tabela: nº, título, frente, bloqueado por. **Critério de saída: backlog estruturado e segregado por frente.** Indique o próximo passo: `/implementar-issue <nº> [base]` seguindo a ordem do grafo (primeiro os desbloqueados). Não implemente nada aqui.
