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
  O Dock e a rota própria da conversa deixam de existir; o contador e o aviso sonoro vivem no menu (polling de 15 s).
- **Autorização continua no caso de uso** com `service_role` (ADR 0005); sem policies novas de RLS.

## Consequências

- Os Atendimentos abertos na virada não precisaram de migração própria: o estado já é derivado (com Funcionário =
  em atendimento; sem = em espera, do Setor ou dirigida), as esperas sem destinatário foram reconciliadas
  (`20261028180000`) e as colunas de aviso de Inatividade foram descartadas com seus dados (`20261029130000`).
- Quem esquece de encerrar fica aberto até 23h50 após a última mensagem do cliente; com o cron diário do plano Hobby,
  até ~24h depois (ver `docs/deploy/encerramento-cron.md`).
- Esperar dirigida a um Responsável ausente não tem tratamento automático (fora de escopo na spec): fica com o Líder.
