# Regras do módulo clientes (application e domain)

Conhecimento que vivia em comentários, agora por tema.

## Compensação de upload e resultado incerto
Falha definitiva depois do upload apaga os arquivos enviados. Resposta perdida (`ResultadoIncertoError`) não prova rollback, e leitura vazia também não (commit tardio, linha oculta por RLS): só a leitura confirmando a gravação vira sucesso; qualquer outro desfecho mantém os arquivos e pede conferência manual. Falha da própria compensação não mascara o erro original: vira `EstadoInconsistenteError` + auditoria `falha_compensacao` + log com os caminhos. Resultado incerto sem confirmação mantém os arquivos (`manterUploadsParaConferencia` em criar-cliente; `DesfechoDaGravacaoIncerta` em salvar-parcelamentos).
Onde vive: use-cases/criar-cliente, anexar-alteracao-contratual, anexar-guia-parcela-pgfn, trocar-guia-parcela-pgfn, remover-guia-parcela-pgfn, salvar-parcelamentos-cliente, guia-parcela-pgfn-compartilhado.

## Auditoria: sucesso no banco, falha no caso de uso
A auditoria de sucesso nasce de gatilhos na mesma transação da escrita (clientes, cliente_atividades_mensais, responsável, alteração contratual). O caso de uso audita só falha e falha_compensacao (best-effort, sem estado a preservar).
Onde vive: ports/out/auditoria.provider, use-cases/criar-cliente, editar-cadastro-operacional-cliente, atribuir-responsavel-cliente.

## Portas próprias por módulo
Módulos não se importam (arquitetura.md 3.11): o main adapta auditoria e sessão a portas locais. A sessão inclui o Setor do ator porque a auditoria de cliente.criar registra o Setor de quem cadastrou.
Onde vive: ports/out/auditoria.provider, ports/out/sessao.provider.

## Sessão validada no caso de uso, RLS como segunda camada
Busca, consulta de cadastro, resumos, lista de responsáveis e guias validam a sessão (arquitetura.md 3.12); a RLS é segunda camada. Busca e consulta aceitam qualquer usuário com sessão; a consulta operacional exclui o Setor RH (usa ConsultarCadastroRhCliente). Resumo SN: Admin (suporte), Líder e Funcionário do SN; comparativo por Responsável só do Líder. Resumo RH: Funcionário vê só os Clientes de que é Responsável; Líder e Admin a carteira inteira e o comparativo.
Onde vive: use-cases/buscar-clientes, consultar-cadastro-*, obter-resumo-setor-*, listar-responsaveis-elegiveis.

## Confidencialidade pelo shape do DTO
Read models não passam pelo builder; o DTO do cadastro operacional não traz contratoSocialCaminho/alteracoesContratuais (RLS é por linha, não por coluna). O caminho do objeto nunca chega à tela: o caso de uso o descarta, e o link nasce de lista liberada pelo banco (caminho forjado nunca chega ao Storage; "sem acesso" e "inexistente" indistinguíveis).
Onde vive: ports/out/cliente-query.provider, documentos-contratuais-cliente.provider, use-cases/obter-link-documento-contratual, obter-link-guia-parcela-pgfn.

## Responsável do Cliente
Só o Líder do Setor atribui, troca ou remove (responsavelId null remove); o banco repete a regra (trigger + RLS). Sem mudança: nada a gravar nem auditar. Cadastro operacional do SN só existe para Simples Nacional e MEI. Nome do Responsável vem null quando a RLS esconde o perfil.
Onde vive: use-cases/atribuir-responsavel-cliente, ports/out/responsavel-cliente.repository.

## Busca embutida do dashboard SN
apenasSnMei restringe a busca do dashboard SN a Clientes com cadastro operacional (regime simples_nacional/mei); a busca geral não restringe, pois o Admin precisa achar qualquer Regime.
Onde vive: ports/out/cliente-query.provider.

## Parcelamento: definições dos cards
Os cards e comparativos contam Clientes (não parcelamentos) e não são exclusivos; valem para qualquer Setor, cada um com os parcelamentos que cadastrou. O interno segue o mesmo fluxo (envio por parcela, pendente, atraso); só o destino muda (financeiro, nunca o Cliente). Atraso começa no dia 29 (último dia de fevereiro comum) no fuso de São Paulo, com um só instante para cards e comparativos. Status do mês: quitado não gera guia; os demais indicam se a parcela do mês tem envio.
Onde vive: mappers/parcelamentos-do-cliente.mapper, resumo-setor-sn.mapper, ports/in/resumo-setor.provider.

## Cards de DAS
documentoObrigatorio é o campo rotulado "Documento recebido" (positivo = recebido). Urgente só com documento recebido e DAS pendente; sem documento, o backlog já está no card "Sem documento". Gráficos usam o status bruto (buckets dos cards se sobrepõem); atividade do mês são 3 flags independentes. Cores: pendente é atenção, só atraso é urgente; "Pronto" é atenção, com tinta própria no donut.
Onde vive: mappers/resumo-setor-sn.mapper, comparativos-sn.mapper.

## Guias de parcela PGFN
Leitura do PDF e conferência (CNPJ, conta, competência) antes do upload; CNPJ de outra empresa recusa sem tocar o Storage. Conferindo tudo, a guia nasce confirmada; senão "a confirmar" com o motivo. Confirmar vale só para a versão (caminho do PDF) conferida. O caminho no Storage não leva o nome do arquivo (anexos da mesma competência não colidem; duplicidade é decidida pelo banco). A competência é a chave e não muda na troca. O banco recusa competência já enviada, segundo anexo e Parcelamento não PGFN. Teto de 4 MB (`LIMITE_DO_PDF_DA_GUIA_EM_BYTES`), revalidado relendo tipo e tamanho no Storage.
Onde vive: use-cases/guia-parcela-pgfn-compartilhado, anexar/trocar/remover/confirmar-guia-parcela-pgfn, ports/out/guia-parcela-pgfn.repository.

## Salvar parcelamentos
O conjunto enviado substitui o do Cliente no Setor (o que não vier é removido; recusado se houver envio). PDF obrigatório só no Parcelamento novo. Quitado é decidido pelo banco e o da PGFN só ganha guias: voltam como estão. Código em branco mantém o gravado ou gera um interno (Recibo de Adesão sem código). O PDF só é apagado se nenhum Parcelamento mantido o referencia. Tamanho e tipo do PDF são barrados pelo schema da Server Action.
Onde vive: use-cases/salvar-parcelamentos-cliente, ports/out/cliente-parcelamento.repository.

## Leitores de PDF (ADR 0004)
Contratos neutros: nunca rejeitam, falha vira `{ lido: false }`; dado ausente é nulo. Na guia só a competência (AAAAMM) é gravada. CNPJ do PDF só confere com o do Cliente.
Onde vive: ports/out/leitor-de-guia-de-parcela.provider, leitor-de-parcelamento.provider.

## Obrigações fiscais (docs/contratos/obrigacoes-fiscais.md)
Contrato neutro, sem provedor. Formatos: competência AAAA-MM, vencimento/validade/expiração AAAA-MM-DD, parcela AAAAMM. A CND tem fonte própria (autenticação e ritmo distintos). Autorização é estado refletido, nunca concedido. Guias de parcelamento: só origem receita_federal, sem guias é lista vazia, indisponibilidade é ServicoExternoError, sem autorização ForbiddenError; o regime escolhe PARCSN ou PARCMEI; parcelas em `ignorar` não são emitidas de novo (cobrança por emissão); atribuição ao parcelamento é de quem chama.
Onde vive: ports/out/obrigacoes-fiscais.provider, certidao-cnd.provider.

## Contatos e envio
Contato: telefone/email vazios = sem o canal; donoSetor null = Contato do Admin; setores vêm do banco. DDD só cobrado do número novo/trocado. Tipos de envio: do Setor de quem chama (Admin não define); com um canal só vale o do contato, com dois o canal é obrigatório. Salvar sem id cria, com id atualiza; quem pode editar o banco confere. RH: observações por Setor; contatos ausentes não mudam.
Onde vive: domain/value-objects/contato.vo, use-cases/definir-tipos-de-envio-do-contato, salvar-contato-do-cliente, editar-cadastro-rh-cliente.

## Documentos contratuais
Ordem: alterações do maior nº para o menor, contrato social por último (primeiro = vigente). Nome exibido sem prefixo "{nº}-". Lista vazia = sem acesso ou sem documentos. Tamanho e data futura são barrados pelo schema da Server Action. Nº repetido volta ValidationError no campo numero.
Onde vive: ports/in/documentos-contratuais-cliente.provider, use-cases/listar-documentos-contratuais-cliente, anexar-alteracao-contratual.

## Avisos de cadastro
Cada usuário só vê e marca os próprios (RLS); marcar é idempotente. Ordem: não vistos primeiro, depois do mais novo; 30 por página, buscando um a mais para saber se há próxima.
Onde vive: use-cases/listar-avisos-cadastro, marcar-aviso-visto.

## Domínio
Cnpj: forma canônica de 14 caracteres [0-9A-Z]; email com o mesmo formato/limite da coluna clientes.email; data de alteração só AAAA-MM-DD real (new Date rolaria 2026-02-30). AtividadeMensal: 3 flags independentes, criar nunca falha. Builder: presença checada no build() (setter não chamado não deixa rastro), sem sobrescrever mensagem de comCnpj/comRegime; formaEnvio default "whatsapp". Campos opcionais da entidade: contrato social, destino de e-mail do job de lembrete, campos operacionais do SN (editados em tela separada).
Onde vive: domain/value-objects/*.vo, domain/builders/cliente.builder, domain/entities/cliente.entity.

## Registro de erros
Passe só a mensagem do erro, nunca o objeto (pode carregar CNPJ/dado pessoal).
Onde vive: ports/out/registro-de-erros.provider.
