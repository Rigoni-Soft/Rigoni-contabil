# Trilha de implementação: tickets agrupados por PR

Criada em 2026-11-03. Spec-mãe: #212 (aba do setor RH). Mapa de decisões: #208. `[x]` = implementado. `[ ]` = falta. Cada bloco **PR** é um grupo que pode ser aberto como PR independente e testado sozinho. São 12 PRs em 6 etapas, cobrindo os tickets #213 a #224, mais a PR de preparação (#225) que vem antes de todas.

Aqui cada ticket já é uma fatia vertical (banco, regra de negócio, tela e testes juntos), então não há par backend e frontend como em outros projetos: o rótulo `frente:` de cada ticket diz o que ele toca. Os dois tickets só de backend (#217 e #220) não têm tela própria. Se uma PR ficar pesada na revisão, separe a migration e a regra de negócio da tela, nessa ordem.

## Etapa 0: Preparação (feita)

- [x] **PR 0: Preparação para o RH** (base de tudo; mergeada como #225 em 2026-11-03)
  - [x] #225: Responsável numa tabela só, Parcelamento por Setor e esqueleto do dashboard de Setor (sem mudança visível para o SN)

## Etapa 1: Fundação do RH

- [x] **PR 1.1: Aba RH com busca ampla e Responsável do RH** (depende da PR 0, já mergeada; base de tudo)
  - [x] #213 (ambas): aba `/rh`, busca de qualquer cliente, Responsável do RH atribuído pelo Líder

## Etapa 2: Acompanhamento mensal

- [x] **PR 2.1: Acompanhamento mensal dos clientes** (depende da PR 1.1; base da etapa)
  - [x] #214 (ambas): serviços editáveis (cards no dashboard), "se aplica", marcação por competência no painel do cliente, auditoria
- [ ] **PR 2.2: Acompanhamento dos funcionários, Líder e Admin** (depende da PR 2.1)
  - [x] #215 (ambas): card "Clientes por Responsável" no dashboard que abre o acompanhamento dos funcionários, e dali o detalhe de cada funcionário; o grupo Parcelamento do dashboard já existe, alimentado pelo #216

## Etapa 3: Parcelamento do RH

- [ ] **PR 3.1: Parcelamento na aba do RH** (depende da PR 1.1; em paralelo às demais)
  - [ ] #216 (ambas): fluxo do SN no RH, cards e comparativos, cada setor vê só o seu
- [ ] **PR 3.2: Alertas e jobs de Parcelamento por Setor** (só backend; depende da PR 3.1)
  - [ ] #217 (backend): alerta ao setor dono, chave por Cliente, tipo e Setor, URA e job com a união

## Etapa 4: Folha de ponto

- [ ] **PR 4.1: Folha de ponto manual com Totalização pela legislação** (depende da PR 1.1; base da etapa)
  - [ ] #218 (ambas): quadro de funcionários, cartão digitado, faltas e abonos, Totalização pela CLT
- [ ] **PR 4.2: Convenção coletiva armazenada e aplicada** (depende da PR 1.1; em paralelo à 4.1)
  - [ ] #219 (ambas): upload, histórico, vínculo por cliente, extração de regras, "Regras aplicadas"
- [ ] **PR 4.3: Totalização com as regras da convenção** (só backend; depende das PRs 4.1 e 4.2)
  - [ ] #220 (backend): o motor usa os parâmetros da convenção e reproduz a planilha modelo
- [ ] **PR 4.4: Holerite derivado dos cartões** (depende das PRs 2.1 e 4.1)
  - [ ] #221 (ambas): Holerite conclui sozinho, "sem movimento no mês", cadastrados x cartões feitos

## Etapa 5: Leitura de imagem

- [ ] **PR 5.1: Leitura de foto do cartão de ponto** (depende da PR 4.1; base da etapa)
  - [ ] #222 (ambas): visão do Claude atrás da porta neutra, cadastro pelo nome, falta e abono por anotação, ADR
- [ ] **PR 5.2: Atestados abonam os dias** (depende da PR 5.1)
  - [ ] #223 (ambas): atestado e declaração de comparecimento, sem guardar CID nem imagem

## Etapa 6: Entrega

- [ ] **PR 6.1: PDF do cartão para assinatura** (por último; depende da PR 4.1, e idealmente da 4.3)
  - [ ] #224 (ambas): PDF individual com totalização em destaque e linhas de assinatura

---

## Notas

- A PR 0 já está na `develop` (merge `39e3d466`). Todas as outras partem dela. A etapa 1 vem em seguida, e depois disso 2, 3 e 4 andam em paralelo, respeitando as dependências por PR acima. As etapas 5 e 6 fecham o RH.
- As dependências entre tickets estão como bloqueios nativos nas issues. Os bloqueios entre PRs foram derivados deles. Confirme antes de abrir cada PR.
- Só o #213 está desbloqueado hoje. Depois dele liberam o #214, o #216, o #218 e o #219.
- A PR 6.1 só exige a 4.1, mas vale esperar a 4.3: o PDF mostra a Totalização, e ela só fica completa com as regras da convenção.
- Pendências antes de implementar a PR 5.1: chave de API do serviço de visão, retenção zero e contrato sem treino no provedor, ADR do dado pessoal enviado a serviço externo e os 19 cartões e 3 atestados de exemplo (ficam fora do repositório) para o critério de aceite.
- Riscos registrados na spec: sem tela de aprovação, um parâmetro de convenção errado vira cálculo errado até o funcionário notar (PR 4.2); a leitura de carimbo muito apagado pode errar (PR 5.1).
- Decisões que seguem do RH e entram como parâmetro: lista inicial de serviços do acompanhamento e quais valem para cada cliente (PR 2.1); padrão "comissionado" por cliente (PR 4.1).
- A PR 3.2 e a 4.3 não têm tela: o efeito aparece nos dashboards e nos cartões que já existem.
- Fechar cada issue só depois do merge real da PR.
