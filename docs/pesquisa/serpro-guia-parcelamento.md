# Pesquisa: guia de parcelamento no Integra-Parcelamento (Serpro) — um ou todos os parcelamentos? (#111)

Mapa wayfinder #109. Fontes: somente a documentação oficial do Integra Contador / Integra-Parcelamento
(API Center do Serpro), lida em 20/10/2026. Ponto de partida: `docs/pesquisa/serpro-api.md` e o adapter
`src/modules/clientes/infra/gateways/obrigacoes-fiscais-serpro.gateway.ts` (PARCSN/GERARDAS161, PARCMEI/GERARDAS201,
`parcelaParaEmitir` = AAAAMM do mês corrente).

## Fontes

- [PARCSN — introdução](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/)
- [PARCSN — Emitir Documento de Arrecadação (GERARDAS161)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/servicos/emite_das/)
- [PARCSN — Consultar Parcelas Disponíveis para Impressão (PARCELASPARAGERAR162)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/servicos/consulta_parcelas_impressao/)
- [PARCSN — Consultar Pedidos de Parcelamento (PEDIDOSPARC163)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/servicos/consulta_pedidos/)
- [PARCSN — Consultar Parcelamento (OBTERPARC164)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/servicos/consulta_parcelamento/)
- [PARCSN — Consultar Detalhes de Pagamento de Parcela (DETPAGTOPARC165)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/servicos/consulta_detalhe_pagamento/)
- [PARCSN — Mensagens](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/mensagens/) e [Changelog](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcsn/changelog/)
- [PARCMEI — Emitir DAS (GERARDAS201)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcmei/servicos/emite_das/) e [Mensagens](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/parcmei/mensagens/)
- [PERTSN — Emitir DAS (GERARDAS181)](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-parcelamento/pertsn/servicos/emite_das/)

## Fatos extraídos

- Emissão (`GERARDAS161` PARCSN, `GERARDAS201` PARCMEI, `GERARDAS181` PERTSN): único campo de entrada
  `parcelaParaEmitir` (AAAAMM, obrigatório); saída única `docArrecadacaoPdfB64` (um PDF). Descrita como "DAS para uma
  parcela específica". Não há campo de número do parcelamento.
- Consultar Parcelas Disponíveis (`PARCELASPARAGERAR162`): sem entrada; "consulta o parcelamento ativo do contribuinte"
  (singular); devolve `listaParcela` com `parcela` (AAAAMM) e `valor`.
- Consultar Pedidos (`PEDIDOSPARC163`): sem entrada; lista "todos os parcelamentos" do tipo, com `numero`,
  `dataDoPedido`, `situacao`, `dataDaSituacao`.
- Consultar Parcelamento (`OBTERPARC164`) e Detalhes de Pagamento (`DETPAGTOPARC165`) exigem `numeroParcelamento`
  (este último também `anoMesParcela`); `DETPAGTOPARC165` devolve `numeroDas` do DAS pago.
- Mensagens PARCSN/PARCMEI (texto transcrito da página): ER_E001 "Não há parcelamento ativo para o contribuinte";
  ER_N003 sem saldo devedor (parcelamento será encerrado no próximo processamento mensal); ER_N004 reconsolidação
  (usar portal/e-CAC); ER_N005 "O DAS da parcela do mês corrente só pode ser emitido a partir do dia {}";
  ER_N006 parcela indisponível para impressão: (1) não existe no parcelamento, (2) já paga ou (3) mês futuro;
  ER_N008 "Não foram encontradas parcelas para emissão"; ER_N013 pedido aguardando confirmação do pagamento da
  1a parcela; ER_N014 "Informe a parcela {0} na requisição para obter o documento da primeira parcela";
  ER_N015 limite de 6 parcelas (acima disso, usar o sistema WEB); ER_N002 parâmetro inválido.

## Respostas

1. **Mais de um parcelamento: uma guia por parcelamento, única somada ou só uma?** A documentação oficial não descreve
   o caso de múltiplos parcelamentos na emissão. O que ela mostra: a emissão devolve **um único PDF** por chamada, para
   **uma parcela (AAAAMM)**, e a consulta de parcelas e a mensagem ER_E001 falam em **"o parcelamento ativo"**
   no singular. A leitura mais consistente é que a API opera sobre um único parcelamento ativo por contribuinte
   por modalidade (sem somar nem listar guias), mas isso é **inferência, não afirmação oficial**. Para PERT/RELP
   a emissão tem o mesmo desenho (`GERARDAS181` com só `parcelaParaEmitir`); nada diz algo diferente.
2. **Há parâmetro para escolher o parcelamento? Qual serviço lista?** **Não** na emissão: `GERARDAS161/201/181` só
   aceitam `parcelaParaEmitir`. O número do parcelamento (`numeroParcelamento`) só é entrada das consultas
   `OBTERPARC164` e `DETPAGTOPARC165`. Para listar: `PEDIDOSPARC163` (todos os parcelamentos, com `numero` e
   `situacao`) e `PARCELASPARAGERAR162` (parcelas AAAAMM e valor disponíveis para emitir, do parcelamento ativo).
   Fluxo seguro para o contrato: consultar `PARCELASPARAGERAR162` antes de emitir e só emitir parcela que apareça ali.
3. **O código do PDF/comprovante é o mesmo que a API aceita?** **Sem confirmação oficial.** A API identifica
   parcelamento por `numero`/`numeroParcelamento` (retornado por `PEDIDOSPARC163`) e o DAS pago por `numeroDas`
   (`DETPAGTOPARC165`); a documentação não relaciona esses campos ao código impresso na guia/comprovante. Como a
   emissão não recebe número de parcelamento, o dado só importaria nas consultas; validar com `PEDIDOSPARC163`
   num CNPJ real (homologação/produção).
4. **Limites e erros esperados.** (a) Parcela já paga, inexistente ou de mês futuro: ER_N006 (aviso). (b) Sem parcelas:
   ER_N008. (c) Sem parcelamento ativo: ER_E001. (d) Parcela do mês corrente só emitível a partir de certo dia: ER_N005
   (o adapter hoje trata como erro genérico; vale tratar como "tentar de novo depois"). (e) Primeira parcela
   pendente de confirmação: ER_N013/ER_N014 (exige informar a parcela explicitamente). (f) Sem saldo devedor: ER_N003.
   (g) Reconsolidação: ER_N004, só portal/e-CAC. (h) **Limite de 6 parcelas**: ER_N015 (HTTP 400), parcelamento com
   mais parcelas só pela web; o PARCMEI descreve como "sete ou mais parcelas em aberto" — a página não esclarece se
   conta parcelas totais ou em aberto. (i) Só contribuinte tipo 2 (pessoa jurídica).

## Sem confirmação

- Comportamento da emissão com mais de um parcelamento ativo do mesmo tipo (a documentação nunca diz se isso existe;
  "parcelamento ativo" sugere um só, mas `PEDIDOSPARC163` lista "todos", incluindo encerrados).
- Equivalência entre o código impresso na guia e `numeroParcelamento`/`numeroDas`.
- Semântica exata do limite de 6 parcelas (ER_N015).
- Inconsistência na própria documentação: ER_N009 (Consultar Pedidos) cita `numeroParcelamento`, mas a página do
  serviço diz que não há entrada.
- PERT/RELP: só lida a emissão do PERTSN; RELPSN/RELPMEI/PERTMEI não foram abertas (mesma estrutura de URLs).
- Respostas de exemplo reais (páginas "retorno_*" não lidas); validar em ambiente de teste.
