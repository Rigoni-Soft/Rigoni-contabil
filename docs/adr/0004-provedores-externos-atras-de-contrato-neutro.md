# ADR 0004 — Provedores externos atrás de contrato neutro, com mock próprio

**Status:** aceita (2026-10-05)

## Contexto

O sistema consome serviços de terceiros (Serpro hoje; WhatsApp na sequência). O escritório pode trocar
de provedor (outra API fiscal, Telegram no lugar do WhatsApp). Depender do formato de um provedor no
domínio tornaria cada troca uma reescrita.

## Decisão

- Cada capacidade externa tem uma **porta OUT neutra**, nomeada pelo que o negócio precisa
  (`ObrigacoesFiscaisPort`), sem jargão de provedor (e-CAC, templates da Meta).
- O contrato HTTP fica documentado em `docs/contratos/`. O adapter do sistema
  (`ObrigacoesFiscaisHttpGateway`) fala **só esse contrato**, apontado por env (`OBRIGACOES_FISCAIS_URL`).
- Em desenvolvimento e e2e, quem responde é um **mock em Node sem dependências** (`mock-api/`,
  `yarn mock:api`), com cenários de falha e de cliente sem autorização.
- Provedor real = um tradutor entre o contrato neutro e a API dele (#66, #68). Issues de configuração
  de API externa são sempre as últimas; nada do sistema depende delas.
- Testes unitários usam fakes em memória dentro do próprio spec.

## Consequências

Trocar de provedor muda só o tradutor e a URL. O custo é manter o contrato e o mock em dia.
