# ADR 0010 — Atendimento autoatribuído: assunção atômica, sem distribuição automática e encerramento por janela de 24h

**Status:** aceita (2026-10-29) — spec #160, corte #168

## Contexto

O sistema distribuía o Atendimento: o Balanceamento mensal escolhia o Funcionário, cada um atendia um cliente por
vez, o resto esperava numa fila pessoal ou do Setor com "sua posição na fila", e a Inatividade (2 h, avisos e
encerramento pela URA) mexia no ciclo de vida. O Funcionário não escolhia quem atender, e a conversa vivia numa rota
própria com um Dock em toda tela. O escritório quer que a equipe veja quem espera e pegue o cliente.

## Decisão

- **Sem distribuição automática.** Atendimento novo ou transferido cai na espera do Setor, ou dirigida a um
  destinatário (Responsável do Cliente, senão Líder). O sistema nunca escolhe dono. Saem o Balanceamento mensal, a fila
  pessoal, a promoção ao liberar um Funcionário e a posição na fila.
- **Assunção atômica.** `assumir_atendimento` só efetiva se o Atendimento ainda estiver em espera e o ator puder
  assumi-lo, sob lock do Setor e da linha: o primeiro clique vence, o outro recebe "já assumido". Sem teto de
  simultâneos. O evento de assunção segue imutável e **não influencia nada**: o Balanceamento deixou de existir.
- **Encerramento por janela de 24h.** Um job encerra o Atendimento em atendimento cuja última Mensagem **do cliente**
  tem 23h50 ou mais (a do Funcionário não reinicia), com o sistema como ator e auditoria, mesmo fora do expediente.
  Não reabre: quem volta cria um Atendimento novo pela URA. Substitui a Inatividade, que foi removida por completo.
- **Uma tela só.** A aba Atendimento (`/atendimento`) concentra a espera, os Atendimentos do usuário e o chat central.
  O Dock e a rota própria da conversa deixam de existir; o polling de 15 s e o aviso sonoro vivem num observador global no layout, e o contador no menu.
- **Autorização continua no caso de uso** com `service_role` (ADR 0005); sem policies novas de RLS.

## Consequências

- Os Atendimentos abertos na virada não precisaram de migração própria: o estado já é derivado (com Funcionário =
  em atendimento; sem = em espera, do Setor ou dirigida), as esperas sem destinatário foram reconciliadas
  (`20261028180000`) e as colunas de aviso de Inatividade foram descartadas com seus dados (`20261029130000`).
- Quem esquece de encerrar fica aberto até 23h50 após a última mensagem do cliente; com o cron diário do plano Hobby,
  até ~24h depois (ver `docs/deploy/encerramento-cron.md`).
- Esperar dirigida a um Responsável ausente não tem tratamento automático (fora de escopo na spec): fica com o Líder.
- **Carga do polling, medida (29/10/2026, ambiente local, janela de 62 s por cenário):** Funcionário
  parado em `/` faz ~10 requisições/min (espera e Atendimentos a cada 15 s, mais o sino); com a conversa
  aberta em `/atendimento` sobe a ~21/min (a conversa lê a cada 5 s e é 12 delas; com a conversa
  parada há mais de 2 min a leitura espaça a 15 s e o total cai a ~13/min, e a Mensagem nova volta ao
  ritmo de 5 s, `intervaloDaConversa`); o Admin na aba
  "Em atendimento" faz ~12/min (inclui a equipe, a cada 15 s). Cada requisição leva ~100–125 ms. Com 50
  usuários todos com conversa aberta (pior caso) são ~18 req/s, dentro dos ~20 req/s do dimensionamento;
  o uso típico fica perto de metade disso. Cada requisição valida o token duas vezes no servidor de
  autenticação (o proxy e o caso de uso chamam `auth.getUser()`), o que é deliberado: um usuário
  desativado perde o acesso na hora, e `getClaims` o manteria até o token vencer.
