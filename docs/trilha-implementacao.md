# Trilha de implementação: tickets agrupados por PR

Criada em 2026-11-03. Spec-mãe: #212 (aba do setor RH). Mapa de decisões: #208. `[x]` = implementado. `[ ]` = falta. Cada bloco **PR** é um grupo que pode ser aberto como PR independente e testado sozinho. São 12 PRs em 6 etapas, cobrindo os tickets #213 a #224, mais a PR de preparação (#225) que vem antes de todas.

Em 2026-11-16 a trilha ganhou as Etapas 7 a 11, da spec #245 (Total pago da folha, PDF-resumo e alerta de falta; mapa de decisões #239), com os tickets #246 a #257 em 11 PRs. No total são 23 PRs em 11 etapas, mais a PR de preparação.

Aqui cada ticket já é uma fatia vertical (banco, regra de negócio, tela e testes juntos), então não há par backend e frontend como em outros projetos: o rótulo `frente:` de cada ticket diz o que ele toca. Os dois tickets só de backend (#217 e #220) não têm tela própria. Se uma PR ficar pesada na revisão, separe a migration e a regra de negócio da tela, nessa ordem. As exceções são as refatorações da Etapa 7 e o alerta da Etapa 10, que são backend por natureza, e o #256, que é só frontend.

## Etapa 0: Preparação (feita)

- [x] **PR 0: Preparação para o RH** (base de tudo; mergeada como #225 em 2026-11-03)
  - [x] #225: Responsável numa tabela só, Parcelamento por Setor e esqueleto do dashboard de Setor (sem mudança visível para o SN)

## Etapa 1: Fundação do RH

- [x] **PR 1.1: Aba RH com busca ampla e Responsável do RH** (depende da PR 0, já mergeada; base de tudo)
  - [x] #213 (ambas): aba `/rh`, busca de qualquer cliente, Responsável do RH atribuído pelo Líder

## Etapa 2: Acompanhamento mensal

- [x] **PR 2.1: Acompanhamento mensal dos clientes** (depende da PR 1.1; base da etapa)
  - [x] #214 (ambas): serviços editáveis (cards no dashboard), "se aplica", marcação por competência no painel do cliente, auditoria
- [x] **PR 2.2: Acompanhamento dos funcionários, Líder e Admin** (depende da PR 2.1)
  - [x] #215 (ambas): card "Clientes por Responsável" no dashboard que abre o acompanhamento dos funcionários, e dali o detalhe de cada funcionário; o grupo Parcelamento do dashboard já existe, alimentado pelo #216

## Etapa 3: Parcelamento do RH

- [x] **PR 3.1: Parcelamento na aba do RH** (depende da PR 1.1; em paralelo às demais)
  - [x] #216 (ambas): fluxo do SN no RH, cards e comparativos, cada setor vê só o seu
- [x] **PR 3.2: Alertas e jobs de Parcelamento por Setor** (só backend; depende da PR 3.1)
  - [x] #217 (backend): alerta ao setor dono, chave por Cliente, tipo e Setor, URA e job com a união

## Etapa 4: Folha de ponto

- [x] **PR 4.1: Folha de ponto manual com Totalização pela legislação** (depende da PR 1.1; base da etapa)
  - [x] #218 (ambas): quadro de funcionários, cartão digitado, faltas e abonos, Totalização pela CLT
- [x] **PR 4.2: Convenção coletiva armazenada e aplicada** (depende da PR 1.1; em paralelo à 4.1)
  - [x] #219 (ambas): upload, histórico, vínculo por cliente, extração de regras, "Regras aplicadas"
- [x] **PR 4.3: Totalização com as regras da convenção** (só backend; depende das PRs 4.1 e 4.2)
  - [x] #220 (backend): o motor usa os parâmetros da convenção e reproduz a planilha modelo
- [x] **PR 4.4: Holerite derivado dos cartões** (depende das PRs 2.1 e 4.1)
  - [x] #221 (ambas): Holerite conclui sozinho, "sem movimento no mês", cadastrados x cartões feitos

## Etapa 5: Leitura de imagem

- [x] **PR 5.1: Leitura de foto do cartão de ponto** (depende da PR 4.1; base da etapa)
  - [x] #222 (ambas): visão da API atrás da porta neutra, cadastro pelo nome, falta e abono por anotação, ADR 0011
- [x] **PR 5.2: Atestados abonam os dias** (depende da PR 5.1)
  - [x] #223 (ambas): atestado e declaração de comparecimento, sem guardar CID nem imagem

## Etapa 6: Entrega

- [x] **PR 6.1: PDF do cartão para assinatura** (mergeada como #238; dependia da PR 4.1)
  - [x] #224 (ambas): PDF individual com totalização em destaque e linhas de assinatura

## Etapa 7: Preparação do Total pago (refatorações)

Spec #245, mapa #239. Módulos mais profundos antes da feature, sem mudar comportamento. A única mudança de comportamento da etapa é a regra única de "cartão feito" (PR 7.1). A refatoração nunca sobe junto com a feature. As cinco PRs saem de `develop`, e as 7.1, 7.3, 7.4 e 7.5 não dependem de nenhuma outra, então podem andar em paralelo.

- [ ] **PR 7.1: Regra única de "cartão feito"** (só backend; sem dependência)
  - [ ] #246 (backend): situação do cartão do empregado no mês (por fazer, iniciado, feito, sem movimento, desligado), contagem do banco alinhada, cópia de "dia com dados" removida; mede quantos cartões existentes mudam
- [ ] **PR 7.2: Situação dos Serviços do Cliente no mês** (depende da PR 7.1)
  - [ ] #251 (ambas): módulo de domínio (aplicável, concluído, motivo do pendente, ponto) lido por dashboard, pontos, detalhe do funcionário e painel do Cliente
- [ ] **PR 7.3: Acesso do RH ao Cliente e mês** (só backend; sem dependência)
  - [ ] #247 (backend): ator, escopo e competência validados para leitura, edição, edição retroativa e download; migram o acompanhamento mensal, o dos funcionários e a folha de ponto
- [ ] **PR 7.4: Cartão apurado e documento baixável** (só backend; sem dependência)
  - [ ] #248 (backend): insumos do Cliente carregados uma vez e apuração de 1 ou N empregados; tela e PDF do cartão passam a usá-lo
  - [ ] #249 (backend): módulo de documento baixável e auditado com toolkit de PDF; PDF do cartão migra; `arquitetura.md` ganha os dois caminhos de auditoria
- [ ] **PR 7.5: Módulo de Alertas do setor** (só backend; sem dependência)
  - [ ] #250 (backend): chave Cliente, tipo, origem, Setor e competência opcional, renovar e resolver, visibilidade por RLS; entrega com reserva fica em atendimento

## Etapa 8: Total pago e Holerite

- [ ] **PR 8.1: Registrar o Total pago do mês** (depende da PR 7.3; base da feature)
  - [ ] #252 (ambas): tabela com CHECK, RLS por papel e competência, auditoria com valor anterior, máscara monetária e "sem folha neste mês"
- [ ] **PR 8.2: Holerite conclui com o Total pago** (depende das PRs 7.2 e 8.1)
  - [ ] #253 (ambas): Cliente sem empregados conclui só com o Total pago, sem Total pago não dá ponto, card com o motivo do pendente

## Etapa 9: PDF-resumo

- [ ] **PR 9.1: PDF-resumo da folha** (depende das PRs 7.1, 7.4 e 8.1; em paralelo às Etapas 8.2 e 10)
  - [ ] #254 (ambas): uma linha por empregado, colunas da Totalização por faixa, total geral, sem Total pago nem CNPJ, nunca guardado, auditoria `rh.folha.baixar-resumo`

## Etapa 10: Alerta de falta

- [ ] **PR 10.1: Alerta `total_pago_ausente`** (só backend; depende das PRs 7.1, 7.5 e 8.1)
  - [ ] #255 (backend): gatilho por cartão e a partir do dia 20, mês passado aberto, resolução automática, visibilidade por RLS
- [ ] **PR 10.2: Card e sino do alerta** (só frontend; depende da PR 10.1)
  - [ ] #256 (frontend): card "Total pago pendente" no dashboard do RH com a lista de Clientes e alerta no sino de avisos

## Etapa 11: Fechamento

- [ ] **PR 11.1: E2E `@smoke` do Total pago** (por último; depende das PRs 8.2, 9.1 e 10.2)
  - [ ] #257 (ambas): Responsável registra o Total pago, Holerite conclui, PDF-resumo baixa e o Líder vê o alerta

---

## Notas

- Acrescentar nos serviço de menu guias de pagamentos de impostos o processo de verificar se o DCTFWeb esta pronto, emitir e enviar o guia do DARF para os clientes, isso tambem entra nos jobs e nos temas locais que ja fazem o envio do DAS.
- Criar um click no avatar do usuario para voltar a tela home "/" de cada setor além de personalizar o avatar com um imagem escolhido em "meu perfil"
- As dependências entre tickets estão como bloqueios nativos nas issues. Os bloqueios entre PRs foram derivados deles. Confirme antes de abrir cada PR.
- Só o #213 está desbloqueado hoje. Depois dele liberam o #214, o #216, o #218 e o #219. (Nota original, de 2026-11-03.)
- Desbloqueados hoje na Etapa 7: #246, #247, #248, #249 e #250. O #251 espera o #246, e o #252 espera o #247.
- Os rótulos de frente dos tickets #246 a #257 são `frente:backend`, `frente:frontend` e `frente:ambas`. Os tickets da Etapa 7 são refatorações: o único com mudança de comportamento é o #246.
- A PR 7.4 junta o #248 e o #249 porque ambos mexem no PDF do cartão e no mesmo carregamento do Quadro. Se pesar na revisão, separe em duas PRs na ordem #248, #249.
- Decisão de 2026-11-16: meses antigos de Cliente sem empregados passam a aparecer como pendentes por causa do Total pago, sem backfill. O Líder do RH os preenche e o alerta de mês passado cobre o caso.
- Pendências da spec #245: conferir no #246 quantos cartões existentes mudam com a regra única e publicar as migrations nos remotos junto com a feature, como nas anteriores.
- A PR 6.1 só exigia a 4.1, mas valeu esperar a 4.3: o PDF mostra a Totalização, e ela só fica completa com as regras da convenção.
- Pendências antes de implementar a PR 5.1: chave de API do serviço de visão, retenção zero e contrato sem treino no provedor, ADR do dado pessoal enviado a serviço externo e os 19 cartões e 3 atestados de exemplo (ficam fora do repositório) para o critério de aceite.
- Riscos registrados na spec: sem tela de aprovação, um parâmetro de convenção errado vira cálculo errado até o funcionário notar (PR 4.2); a leitura de carimbo muito apagado pode errar (PR 5.1).
- Decisões que seguem do RH e entram como parâmetro: lista inicial de serviços do acompanhamento e quais valem para cada cliente (PR 2.1); padrão "comissionado" por cliente (PR 4.1).
- A PR 3.2, a 4.3, a 7.1, a 7.3, a 7.4, a 7.5 e a 10.1 não têm tela: o efeito aparece nos dashboards e nos cartões que já existem.
- Fechar cada issue só depois do merge real da PR.
