# Regras do módulo clientes (domain e infra)

Conhecimento que vivia em comentários dos arquivos de clientes/domain e clientes/infra.

## Guia de parcela PGFN: conferência do PDF
A chave da guia é (Parcelamento, competência AAAAMM), a mesma do registro de envio. O PDF lido é conferido com o Parcelamento: CNPJ de outra empresa recusa o anexo; conta ou competência divergentes deixam a guia "a confirmar" com o motivo. Sem competência (nem lida, nem digitada) não há o que gravar; a conta lida é só conferência (vale a do Parcelamento escolhido). O que o PDF traz prevalece sobre o digitado.
Onde vive: src/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo.ts (COMPETENCIA_AAAAMM, CONTA_DE_NEGOCIACAO_MAXIMO, conferirGuiaLida, motivoParaConferir)

## Parcelamento: dados do acordo e validação do leitor
Os dados lidos do PDF são informativos (conferem o valor da guia, dizem o órgão e a data de adesão, AAAA-MM-DD) e cada um é nulo se o PDF não traz ou veio inválido. O leitor só sugere: quantidade inteira >= 1, senão a leitura não vale. PDF sem código recebe um código interno (o Serpro emite a guia só pela parcela; o código serve de rótulo e pode ser trocado). Código longo demais é leitura ilegível, nunca trocado em silêncio. No Parcelamento digitado à mão o mínimo de parcelas restantes é 1 (o zero só é gravado pelo sistema ao quitar) e o anexo é obrigatório.
Onde vive: src/modules/clientes/domain/value-objects/parcelamento.vo.ts (CODIGO_MAXIMO, normalizarAcordo, sugerirParcelamento, gerarCodigoDeParcelamento)

## Leitores de PDF (texto e falso)
O leitor lê a camada de texto do PDF direto, sem API externa: o dado fiscal não sai do servidor. Guia: um modelo só (DAS do SENDA com PGFN-SISPAR); outro modelo, PDF escaneado ou corrompido vira lido false e a guia fica "a confirmar". Parcelamento: dois parsers (Recibo de Adesão do Simples Nacional, sem código; Recibo PGFN SISPAR, código = conta de negociação, total de parcelas = entrada + prestações do demonstrativo, valor da parcela = prestações, entrada só se for a única linha); modelo novo exige parser novo, escaneado exige OCR. Os leitores falsos são o padrão em dev, CI e Preview; marcadores no texto escolhem o cenário: [leitor:falha], [leitor:cnpj-outro], [leitor:sem-codigo] (parcelamento) e [leitor:guia=cnpj;conta;AAAAMM] (guia, nasce confirmada). Textos de teste são sintéticos: nenhum PDF real vai ao repositório.
Onde vive: src/modules/clientes/infra/gateways/leitor-de-guia-de-parcela-*.gateway.ts e leitor-de-parcelamento-*.gateway.ts (MARCADOR_DE_FALHA, MARCADOR_SEM_CODIGO, MARCADOR_DE_CNPJ_DE_OUTRA_EMPRESA, MARCADOR_DE_GUIA)

## Leituras de banco: row inválida e sessão do usuário
Rows de RPC e de select embutido são validadas por zod e falham alto se o banco divergir (arquitetura.md 3.9). Os gateways de avisos e documentos contratuais usam a sessão do usuário: a RLS de avisos_cadastro limita aos avisos de quem logou; a RPC e a policy de storage.objects aplicam pode_ver_cliente + Setor SN.
Onde vive: avisos-cadastro.gateway.ts, documentos-contratuais-cliente.gateway.ts

## Confidencialidade da leitura de Clientes
A leitura de Cliente usa a view clientes_basico, que não tem contrato_social_caminho: a confidencialidade é do banco, não do select nem do DTO (só Admin lê a tabela clientes). O Responsável vem pela RLS de cliente_responsaveis (Funcionário vê o próprio, Líder e Admin todos); com filtro por setor há no máximo um vínculo por Cliente. O caminho de anexo no Storage é {clienteId}/{parcelamentoId}-{nome}.
Onde vive: cliente-query.gateway.ts, carteira-do-setor.gateway.ts, cliente.repository.ts

## Carteira do Setor: paginação e envios do mês
O PostgREST corta cada resposta em max_rows: a carteira é lida em páginas até vir uma vazia (uma além do teto), sem confiar no tamanho pedido; página repetida aborta. O teto cobre 50 mil Clientes por Setor com TAMANHO_DA_PAGINA = 500; só o teste de integração baixa o teto. Não usa lerTodasAsPaginas (que toma página curta por última e pagina por id, não por empresa). Limite conhecido: range não é snapshot; Cliente criado ou removido entre páginas pode repetir ou omitir linha; paginar por keyset (empresa, id) se a carteira passar a mudar em lote. Nos envios fica só a parcela do mês corrente: "enviado no mês" = há registro; o embed é filtrado e as colunas são listadas (sem *, que traria observações e caminho do PDF), com ordem igual à do repositório.
Onde vive: carteira-do-setor.gateway.ts, cliente-query.gateway.ts

## Busca de Clientes
Vírgula e parênteses têm sentido na sintaxe .or() do PostgREST: o termo vai entre aspas duplas com " e \ escapados, senão "Pão, Quente Ltda" vira duas condições. A busca embutida no dashboard do Simples Nacional restringe o Regime aos que têm cadastro operacional (nasce automático só para Simples Nacional/MEI); Admin e outros Setores buscam qualquer Cliente. O dashboard é de qualquer Funcionário do Setor, por isso lê a view e não a tabela.
Onde vive: cliente-query.gateway.ts (escaparParaFiltroOr, REGIMES_COM_CADASTRO_OPERACIONAL, LIMITE_DE_SUGESTOES)

## Embed 1:1 do PostgREST
O PostgREST devolve embed 1:1 (FK que também é PK) ora como objeto, ora como array de 1 elemento, conforme versão/schema cache; o mapper normaliza os dois. Contatos vêm com os Setores embutidos em todo select; ao banco vai só o que o dono edita (sem id o contato é novo). Parcelamento vem com as parcelas enviadas (status do mês, bloqueio de remoção); a parcela do mês é AAAAMM no fuso de São Paulo; Quitado = situação gravada pelo sistema ou parcelas restantes em zero.
Onde vive: infra/mappers/*.mapper.ts

## Escritas: agregado transacional e resultado incerto
Cliente e Alterações contratuais, e o cadastro operacional com contatos e atividades, são o mesmo agregado (arquitetura.md 3.5) e gravam juntos por RPC transacional (criar_cliente, editar_cadastro_operacional_cliente, salvar_contato(s)_do_cliente). Sem resposta (status 0) ou gateway/timeout (502-504) o banco pode ter confirmado: vira ResultadoIncertoError e a reconciliação confere o vínculo exato (Cliente/número/caminho). Gatilhos do banco recusam com 23514 e mensagem em português própria para o usuário. RLS que esconde a linha não dá erro, dá zero linhas: por isso .select() nas trocas e remoções de guia. Erro de negócio conhecido (e-mail existente, duplicidade de contato) vira ValidationError apontando o campo, nunca a mensagem crua do Postgres; a duplicidade pega pelo trigger traz o nome do contato existente, a do índice único e a da PK trazem texto fixo. O CNPJ da guia vem da view legível a quem edita o cadastro operacional.
Onde vive: cliente.repository.ts, cliente-parcelamento.repository.ts, guia-parcela-pgfn.repository.ts, contato-do-cliente.repository.ts, cadastro-rh.repository.ts (códigos PG_VIOLACAO_DE_CHECK, PG_VIOLACAO_DE_UNICIDADE, PG_SEM_PERMISSAO, PG_PARAMETRO_INVALIDO; semDesfechoConhecido)

## Storage de documentos
O Storage não distingue objeto inexistente de falha de rede (ambos viram "não está lá"). Sem policy de DELETE ele não erra, devolve lista vazia: a contagem removida é conferida.
Onde vive: supabase-arquivo-storage.gateway.ts

## Adapters HTTP e Serpro
O gateway HTTP fala o contrato neutro (docs/contratos/obrigacoes-fiscais.md, GET /clientes/{cnpj}/cnd) com o mock de mock-api/ em dev ou um tradutor ao provedor real; falha de rede/HTTP/formato vira ServicoExternoError. O regime é do adapter do provedor; o contrato só leva as parcelas entregues. Só o adapter Serpro conhece o Serpro (docs/pesquisa/serpro-api.md). Consulta CND é produto avulso com contrato e token próprios, sem certificado digital; status 1 e 2 = certidão encontrada ou emitida; status 7 = consulta passou de 5 s, repete com a Chave até sair; o Serpro responde 200/201/202/404 com Status e Mensagem no corpo. Parcelamento: serviços PARC (único contínuo; PERT e RELP fechados a novas adesões). Códigos do Integra-Parcelamento (docs/pesquisa/serpro-guia-parcelamento.md): ER_E001 sem parcelamento ativo, ER_N003 sem saldo devedor, ER_N008 sem parcelas para emissão = sem_guias; ER_N005 parcela do mês só emitível a partir de certo dia, ER_N006 inexistente, paga ou de mês futuro = parcela_indisponivel; demais falhas são indisponibilidade ou falta de autorização. Emissão aceita só a parcela (não escolhe o parcelamento): a atribuição ao Parcelamento do Cliente é de quem chama; sem pré-consulta de autorização (consultada só se nada vier); queda no meio devolve as guias já baixadas e as outras vêm na rodada seguinte. Trial: token fixo, sem autenticar nem certificado; produção: OAuth2 com Consumer Key/Secret e e-CNPJ do escritório, URLs do ambiente (src/main), margem de 60 s no vencimento do token. dados chega como JSON em string (objeto ou lista de um objeto); sem dados (204/404) devolve null. Procuração: verifica validade a vencer (Integra-Procurações).
Onde vive: obrigacoes-fiscais-http.gateway.ts, obrigacoes-fiscais-serpro.gateway.ts (MARGEM_DE_RENOVACAO_DO_TOKEN_EM_SEGUNDOS, STATUS_SEM_DADOS, RECUSA_POR_MENSAGEM), certidao-cnd-http.gateway.ts, certidao-cnd-serpro.gateway.ts (STATUS_EM_PROCESSAMENTO, STATUS_COM_CERTIDAO, STATUS_HTTP_COM_CORPO_DE_CONSULTA)

## Testes de integração do módulo
Requerem npx supabase start com migrations + seed. Usam CNPJs fixos reservados, removidos antes e depois (nunca DELETE amplo); a auditoria é imutável, então contam só o evento da própria execução; listas do usuário filtram por Cliente criado pela suíte. Mês de referência usa America/Sao_Paulo (UTC erra o mês nas últimas horas do dia 1). Matriz de RLS provada: Funcionário SN edita só Cliente do qual é Responsável (quem atribui é o Líder); Funcionário de outro Setor só vê a projeção se for Responsável ali; Recepção, Líder e Admin veem; cada Setor só vê os seus Parcelamentos; o sistema (service_role, sem sessão) grava enviado e entrega a última parcela; DML direto de Contato continua permitido a Admin e Funcionário SN com auditoria. Dados fictícios (LGPD).
Onde vive: infra/**/*.test.ts
