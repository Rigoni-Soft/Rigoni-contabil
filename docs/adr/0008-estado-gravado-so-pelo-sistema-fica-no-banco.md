# ADR 0008 — Campo gravado só pelo sistema é travado no banco, não na tela

**Status:** aceita (2026-10-20) — ticket #108

## Contexto

O DAS tem o status `enviado` e a data de envio. O job de envio (#52) os grava ao concluir a entrega
(`concluir_envio_automatico_das`, `service_role`, sem sessão de usuário). Mas o formulário "Editar
cadastro operacional" deixava o Funcionário escolher `enviado` e digitar a data, e a regra de
"quem pode gravar" só existia na tela. Tirar a opção do select não basta: a RPC
`editar_cadastro_operacional_cliente` recebe os dois valores do chamador, e a policy de UPDATE de
`cliente_cadastro_operacional_sn` deixa o Funcionário do Simples Nacional gravar a tabela direto pela
Data API.

## Decisão

- **A trava é um gatilho `BEFORE INSERT OR UPDATE`** em `cliente_cadastro_operacional_sn`
  (`proteger_das_enviado_do_sistema`), não código da RPC. Vale para a RPC e para o DML direto, como
  manda `arquitetura.md` §3.14 (regra de domínio da RPC também em gatilho `BEFORE`). A RPC não mudou.
- **"Sistema" = escrita sem sessão de usuário** (`auth.uid()` nulo: job com `service_role`, seed,
  migration). Qualquer pessoa com sessão, Admin inclusive, é tratada como edição manual. É o mesmo
  critério de `proteger_responsavel_cliente` (ADR 0003).
- **Para quem tem sessão:** `enviado` só se mantém (se já era `enviado`, continua); definir
  `enviado` a partir de outro status é erro `23514`. A data de envio é **derivada**: preservada
  enquanto o status segue `enviado`, nula nos demais. O valor de data que a pessoa mandar é
  descartado em silêncio, sem erro, porque a tela só a exibe.
- **A tela reflete, não decide:** "Enviado" sai das opções do select e só aparece enquanto o DAS
  **salvo** já está `enviado` (para exibir o valor atual e permitir desfazer a troca antes de
  salvar); a data de envio é `readOnly`. Se a edição tirar o DAS de `enviado`, a data some.

## Alternativas descartadas

- **Só na tela (remover a opção e travar o campo):** qualquer chamada direta à RPC ou à Data API
  contorna.
- **Só na RPC:** a policy de UPDATE da tabela permite o DML direto; o gatilho é o único ponto por
  onde as duas vias passam.
- **Erro quando a data diverge:** quebraria o salvar do formulário de quem só mudou outro campo
  (a tela reenvia a data atual). Descartar em silêncio é seguro porque o valor é sempre derivado.
- **Parcelamento `enviado`:** mesma natureza (só o sistema grava), mas fora do escopo do #108; o
  Parcelamento muda de modelo em outro ticket e o gatilho se estende a ele lá.

## Consequências

- Todo teste que precise de um DAS `enviado` marca-o como o sistema (cliente `service_role`), não
  como Admin ou Funcionário.
- Novo campo "só do sistema" segue o mesmo desenho: gatilho `BEFORE` que deixa passar a escrita sem
  sessão, e tela somente leitura.
- Quem precisar corrigir um DAS `enviado` por engano não tem caminho pela tela: o ajuste é do
  sistema (ou de migration/script com `service_role`).
