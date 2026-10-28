# ADR 0005 — Painel de Atendimento lê e escreve com `service_role`, com a autorização no caso de uso

**Status:** aceita (2026-10-08)

## Contexto

`atendimentos`, `mensagens` e `transferencias` nasceram para a URA (#40–#47), que roda sem sessão humana e, por isso,
já usa o client `service_role` (ADR 0001, ADR 0004). Essas tabelas têm RLS ligada e **nenhuma policy**: usuário
logado não lê nem escreve nelas direto.

O Painel do Funcionário (#49) precisa de leitura (meus Atendimentos, conversa) e escrita (resposta, envio de documento,
transferência, encerramento) por um usuário logado. As regras de quem pode agir já existem no domínio
(`podeSupervisionar` para ver e encerrar: dono, Líder do Setor onde está o Atendimento, ou Admin; `podeAtender` para responder, enviar e transferir: só o dono) e dependem de dados que a policy teria de
reproduzir em SQL (Setor atual, dono, Papel), além de a Transferência e o encerramento mexerem em várias tabelas numa
transação (RPC `security invoker` chamada com `service_role`).

## Decisão

- As factories do painel (`makeListarMeusAtendimentos`, `makeObterConversa`, `makeEnviarDocumentoAoCliente`,
  `makeEnviarMensagemAoCliente`, `makeTransferirAtendimento`, `makeEncerrarAtendimento`, `makeListarFila`) montam o
  repositório com `createSupabaseAdmin()`, no `main`, **só no servidor**.
- A **autorização fica no caso de uso**: a sessão vem da porta `SessaoPort` (cliente com a sessão do usuário) e cada caso
  de uso aplica a regra de acesso antes de ler ou gravar: `podeSupervisionar` (dono, Líder do Setor ou Admin) ou `podeAtender` (só o dono) sobre um Atendimento, "só os meus" na lista do dock e "só o meu Setor" na Fila. Nenhuma Server Action devolve dado sem passar por um caso de uso.
- Não se criam policies de RLS para essas tabelas nesta rodada.

## Consequências

- Sem defesa em profundidade no banco: um caso de uso que esqueça a checagem vaza dado entre Setores. Mitigação:
  todo caso de uso que age sobre um Atendimento tem teste de autorização (dono, Líder do Setor, Líder de outro Setor, outro Funcionário,
  Admin, sem sessão) e a regra mora num único domain service (`transferencia.service.ts`).
- Permanece o risco já registrado: `transferir_atendimento` não revalida se o destino está ativo (janela de corrida).
- Se o produto passar a precisar de leitura direta pelo navegador (ex.: Realtime nas conversas), isso exige policies de
  leitura e uma nova ADR; o #74 já menciona essa alternativa para o contexto de transferência.
- Relaciona-se ao ADR 0001 (exceção de `service_role` confinada a fábricas de uso explícito) ampliando a exceção às
  fábricas do painel de Atendimento.
