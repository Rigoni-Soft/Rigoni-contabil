# Regras do módulo atendimento (camada application)

Conhecimento que vivia em comentários de ports e use cases, por tema. Cada tema aponta onde a regra vive (`pasta/arquivo:símbolo`). Pastas abreviadas: `ports` = `src/modules/atendimento/application/ports/out`, `uc` = `src/modules/atendimento/application/use-cases`.

## Privacidade e logs

Dado pessoal não entra em sessão, log nem trilha. A sessão guarda só a posição no menu (nunca nome, empresa, CNPJ ou caminho de arquivo; o que for preciso é recalculado a cada mensagem; `lista` é um hash só para detectar que a lista mudou). O registro de falhas recebe só a mensagem do erro, nunca o objeto (pode carregar CNPJ). O texto da mensagem não vai para a trilha.
Onde vive: ports/sessao-atendimento.provider.ts:SessaoAtendimento; ports/registro-de-erros.provider.ts:RegistroDeErrosPort; uc/enviar-documento-ao-cliente.use-case.ts; uc/enviar-mensagem-ao-cliente.use-case.ts.

## Sessão da URA

`telefone` só com dígitos, sem DDI; sessão expirada conta como inexistente (null). A lista de setores ("falar com atendente") guarda só a página e quantas respostas inválidas seguidas. O módulo não importa outros módulos (arquitetura.md 3.11): o `main` adapta a sessão do módulo usuarios a `AtorSessaoDto`.
Onde vive: ports/sessao-atendimento.provider.ts:obter; ports/sessao.provider.ts:AtorSessaoDto.

## Identificação do contato

Número em mais de um Cliente: nenhum é escolhido automaticamente (`ContatoAmbiguo`). `identificar` devolve null se o número não é de nenhum Cliente. O CNPJ chega normalizado (`normalizarCnpj`). O regime decide se o Simples Nacional entra na lista de setores da URA; null = sem Cliente.
Onde vive: ports/identificacao-contato.provider.ts:ContatoAmbiguo, identificar, cnpjCadastrado, regimeDoCliente.

## Cadastro de contato pela Recepção

A Recepção confirma o Cliente pelo CNPJ (o da URA é só sugestão). Só quem pode cadastrar consulta: a busca não é geral. Atendimento já ligado a um Cliente só cadastra contato nele (o banco confere de novo). Toda busca fica na trilha: o service_role lê qualquer Cliente por CNPJ, e a varredura CNPJ a CNPJ tem de aparecer na auditoria. O cadastro cria só um Contato (setor URA, Recepção dona); nenhum Contato nem Destino de outro Setor é tocado.
Onde vive: uc/buscar-cliente-para-contato-ura.use-case.ts:BuscarClienteParaContatoUra, doAtendimento; uc/cadastrar-contato-ura.use-case.ts:CadastrarContatoUra.

## Abrir, assumir e encerrar Atendimento

Atendimento novo cai na espera do Setor, sem atribuição automática. Qualquer usuário ativo do Setor assume, sem teto de simultâneos; a corrida e a elegibilidade são do banco (atômico), o use case só traduz o resultado. Encerrar segue a regra de quem age (dono, Líder do Setor ou Admin) e não puxa ninguém da espera; se o aviso de despedida falha, nada é desfeito e quem encerrou não recebe erro.
Onde vive: uc/abrir-atendimento.use-case.ts:AbrirAtendimento; uc/assumir-atendimento.use-case.ts:AssumirAtendimento; uc/encerrar-atendimento.use-case.ts:EncerrarAtendimento, aviso.

## Encerramento por silêncio

Job periódico: encerra o Atendimento em atendimento cujo cliente está há 23h50 sem escrever (Mensagem do Funcionário não reinicia a contagem). Ator = sistema, também fora do expediente. Não avisa ninguém: o cliente que voltar abre um novo pela URA.
Onde vive: uc/encerrar-por-silencio.use-case.ts:EncerrarPorSilencio; domain/services/encerramento-automatico.service.ts:corteDoEncerramento.

## Quem pode agir sobre o Atendimento

Responder, anexar, enviar documento, ler a conversa e encerrar seguem a regra da Transferência (dono, Líder do Setor ou Admin). A reação segue a do envio de mensagem.
Onde vive: uc/enviar-mensagem-ao-cliente.use-case.ts; uc/enviar-anexo-ao-cliente.use-case.ts; uc/enviar-documento-ao-cliente.use-case.ts; uc/obter-conversa.use-case.ts; uc/reagir-a-mensagem.use-case.ts.

## Fila e visibilidade

O Setor vê a própria Fila (Admin, a de qualquer Setor). Só o destinatário vê o Atendimento; Líder e Admin leem em supervisão. A espera comum, sem destinatário, existe só na Recepção: fora dela, o Atendimento sem Responsável nem Líder fica só para a supervisão e os outros usuários nem o recebem. A aba da equipe omite os do próprio usuário (já estão na aba dele).
Onde vive: uc/listar-fila.use-case.ts:ListarFila, supervisiona; uc/listar-atendimentos-da-equipe.use-case.ts.

## Leitura da conversa

Uma leitura só por interação, trazendo os serviços que o Funcionário pode disparar. Mensagens anteriores usam como cursor a Mensagem mais antiga que a tela já tem. A renovação de links corta pedido além do limite e usa um pedido só para todos os anexos. Sem os links os anexos aparecem sem arquivo, mas o texto continua legível.
Onde vive: uc/obter-conversa.use-case.ts:ObterConversa, mensagensAnteriores, renovarLinks, vistas, links.

## Envio de mensagem, anexo e reação (ordem registro/entrega)

A intenção é gravada `pendente` ANTES de sair, sob o lock do Atendimento e com a autoridade relida do perfil: o fechamento que vence a corrida não deixa resposta enviada a Atendimento encerrado (no anexo, o arquivo guardado sai e nada é enviado). Só vira `entregue` com o aceite do adapter; falha ou incerteza deixa a linha (`falha`/`pendente`) sem contar como resposta, e ela nunca é apagada. Se fechar a linha falha, fica `pendente` e a conversa a mostra como não confirmada; envio aceito não vira erro (reenviar duplicaria). O arquivo de anexo fica referenciado mesmo se a entrega falha (evidência de entrega incerta). Áudio não leva legenda. A reação só é registrada depois de entregue; se o registro falha, a reação enviada não é desfeita. Risco aceito: o toggle de reação não tem trava (um Funcionário por Atendimento); trava otimista se pesar. O texto tem teto de caracteres (`TEXTO_TAMANHO_MAXIMO`).
Onde vive: uc/enviar-mensagem-ao-cliente.use-case.ts:registrada, TEXTO_TAMANHO_MAXIMO; uc/enviar-anexo-ao-cliente.use-case.ts:registrada; uc/reagir-a-mensagem.use-case.ts:registrada; uc/avisar-cliente.use-case.ts:enviada (só vira Mensagem o que o cliente recebeu).

## Preparo de anexo

Tipo, tamanho e formato de áudio são do `PrepararAnexoParaEnvio`; o envio cuida da autorização, entrega, registro e auditoria. Duas origens: bytes no pedido, ou objeto que o navegador subiu em partes (docs/adr/0007), conferido de novo pelo que o Storage tem. Áudio: ogg/opus ou mp4 passam (só o ogg depende do codec: a Meta aceita Opus e o MIME não diz qual é); webm é convertido para ogg, e o MIME perde os parâmetros ("audio/ogg;codecs=opus" vira "audio/ogg"). Posse antes de tudo: objeto já finalizado (ou em finalização) não é desta tentativa e é recusado SEM tocar nele; a compensação nunca remove arquivo do histórico. Objeto recusado pelo que o Storage tem sai do Storage; quem falhar depois remove o que reservou e libera a reserva. O webm original sai de qualquer jeito (o navegador ainda tem a gravação). Miniatura: só imagem, no formato e tamanho esperados; qualquer outra coisa ou falha é ignorada, sem prejudicar o envio. O upload no navegador usa a sessão do usuário (a RLS do bucket decide quem grava) e devolve o caminho que o servidor confere.
Onde vive: uc/preparar-anexo-para-envio.use-case.ts:conferir, doStorage, reservado, descartar, formatar, oggSemOpus, semExtensao; uc/enviar-anexo-ao-cliente.use-case.ts:guardarMiniatura, descartarArquivos; ports/upload-de-anexo.provider.ts:UploadDeAnexoPort.

## Documento enviado pelo Funcionário

Dispara o mesmo serviço do menu da URA usando o Cliente já vinculado (sem perguntar o CNPJ). Documento ausente, guia sem autorização fiscal ou provedor fora do ar devolvem erro sem deixar Mensagem, mas a tentativa fica auditada. O CNPJ vem do cadastro; sem autorização fiscal vigente o provedor devolve `ForbiddenError`, que o painel mostra.
Onde vive: uc/enviar-documento-ao-cliente.use-case.ts:preparado, prepararGuia, extensaoDoCaminho; uc/obter-guia-das-para-envio.use-case.ts.

## Comunicação proativa e entrega por canais

Janela de 24h aberta: formato próprio (grátis); fechada: template aprovado. Cada envio repete sozinho em falha transitória, sem reenviar o texto que já chegou quando só o documento falhou. A entrega vai aos canais de cada Destino: canal que não entrega vira ocorrência sem derrubar o outro nem o Destino seguinte; Destino inválido não recebe e vira ocorrência; entregar por menos canais que o pedido (na guia) acrescenta `entrega_parcial`. Lista vazia de Destinos é erro (quem chama decide antes e alerta o Setor). Só a guia (DAS ou parcelamento) gera pendência: o lembrete é recorrente e volta na próxima rodada.
Onde vive: uc/enviar-comunicacao-proativa.use-case.ts:EnviarComunicacaoProativa; uc/entregar-comunicacao-por-canais.use-case.ts:EntregarComunicacaoPorCanais.

## Guia do DAS (job e URA)

O banco manda no estado do DAS. Na URA: não pronto, só avisa (sem provedor nem alerta ao setor; só o job alerta); pronto, o pedido adianta o envio e o DAS só vira enviado (data de hoje, URA como ator) depois do aceite, com a mesma reserva do job, que por isso não reenvia; já enviado, reenvia o PDF cujo caminho o envio aceito guardou, sem provedor. O sistema grava data e caminho juntos; sem caminho (dado legado) cai no erro de guia indisponível. Outra tentativa entregando ou DAS não mais pronto devolve indisponível. Se a conclusão não vale depois da entrega (reserva substituída ou cadastro alterado), o DAS segue pronto, o job pode reenviar e fica rastro, sem erro ao contato. O PDF publicado fica no Storage mesmo se a entrega falhar: só o registro do envio aceito o aponta.
Onde vive: uc/entregar-das-na-ura.use-case.ts:EntregarDasNaUra, concluida.

## Lembretes de documento e DAS (job dias 01/05/10/15)

`DIAS_DO_JOB`, fuso de São Paulo. Lembra quem está sem documento obrigatório, envia o DAS pronto aos Destinos de envio do Simples Nacional (sem Destino válido: alerta `contato_ausente` e aviso ao Líder e ao Responsável; Destino inválido ao lado de um válido vira `falha_envio`) e alerta o setor SN do DAS pendente com documento em dia. Cada Cliente é independente. A entrega é reservada (token com validade) antes de sair e o DAS só vira enviado depois do aceite: execuções simultâneas ou o Funcionário não geram envio em dobro, e queda no meio deixa o DAS como estava (a reserva expira). Aceite seguido de queda antes da conclusão pode reenviar (pelo menos uma vez). Sem para quem enviar, não se busca a guia nem se reserva o DAS.
Onde vive: uc/executar-lembretes-documento-e-das.use-case.ts:DIAS_DO_JOB, comDestinos, publicado.

## Parcelamento: regras comuns

Parcelamento comum vai aos Destinos de guia de parcelamento do Setor dono (SN ou RH); o interno só ao financeiro (WhatsApp do escritório, por template, sem janela nem Destinos nem e-mail; `telefone` null = FINANCEIRO_TELEFONE ausente ou inválido) e NUNCA ao Cliente: some da resposta da URA como se não existisse. O envio é registrado uma vez por parcela (registro único); a primeira entrega aceita registra, desconta uma parcela restante e audita; reenvio devolve o PDF guardado, sem provedor, sem novo desconto. `ja_registrado`: nada mudou; `nao_elegivel`: o parcelamento saiu de aberto (quitado, zerado ou removido), nada mudou. Nunca mais guias do que parcelas restantes: o excesso vira ocorrência e nada é enviado. Registrada, a competência trava sozinha; sem entrega, a guia volta a ser editável. O PDF publicado fica no Storage mesmo se a entrega for recusada; só o registro do aceito o aponta. Falha de registro após a entrega: o contato recebeu, o rastro fica no log.
Onde vive: ports/parcelamentos-do-cliente.provider.ts (EnvioRegistrado, registrarEnvio, listarEmAberto, contarComuns, guiasEntregues, GuiaEntregue); uc/enviar-guias-parcelamento.use-case.ts:FinanceiroDoEscritorio, entregarGuias, entregarGuia, entregarAoFinanceiro, TEMPLATE_GUIA_INTERNA; uc/entregar-parcelamento-na-ura.use-case.ts:comuns, entregar, registro.

## Parcelamento: job de envio (dias 20/22/24/26/28)

O job reserva o Cliente com parcelamento pendente e delega ao núcleo `EnviarGuiasParcelamento`; a reserva é liberada se nada foi aceito e a rodada seguinte tenta de novo. Cada Cliente é independente. O núcleo lê a união dos Parcelamentos de todos os Setores numa entrega só; cada ocorrência leva o Setor dono do alerta. Receita vem do provedor fiscal; PGFN, das guias confirmadas à mão, com o PDF do banco, até o mês corrente e da mais antiga para a mais nova. Falha fechado: pendente sem guia vira `parcelamento_sem_guia`, nunca se adivinha. Triagem: a leitura de Destinos que falha vale só para o Setor dela (o interno não lê Destinos) e o comum desse Setor segue pendente com `falha_envio`; sem para quem enviar, segue pendente e o setor é avisado. A leitura que falhou só vira ocorrência para Setor com parcelamento a entregar. Destinos lidos uma vez por Cliente. O provedor cobra cada emissão: só se buscam guias das parcelas que nem todos os alvos já receberam e há retentativa em falha do serviço externo. A atribuição vê todos os em aberto, para a guia de quem não tem destino não cair em outro. Entrega uma guia por vez; cada uma descontada tira uma parcela, e o financeiro vê quantas restam depois dela (contando as da própria rodada). O CNPJ só é lido se houver interno, uma vez por Cliente. Guia só de parcela atrasada é entregue, mas o mês corrente continua sem guia. PGFN: guia sem entrega registrada trava as seguintes do mesmo acordo (`travarAcordoNaFalha`), para não pular a ordem nem quitar por guia posterior; segue pendente. A versão lida fica reservada até o fim da rodada. Regra completa em docs/deploy/parcelamento-cron.md.
Onde vive: uc/executar-envio-guia-parcelamento.use-case.ts:entregarComReserva; uc/enviar-guias-parcelamento.use-case.ts:triar, temParaQuemEnviar, ocorrenciasDeLeitura, travados, parcelasQueTodosRecebem (em `enviarReceita`), comGuia, atribuidas; ports/guias-pgfn.provider.ts (reservar, liberar).

## Parcelamento: opção da URA

Mesma regra do job, mudando só o gatilho: para cada parcelamento comum em aberto, a parcela do mês ou, se o provedor ainda não a emite, a do mês anterior (a do mês vence). Uma mensagem com PDF por parcelamento, identificada pelo código. Só a primeira entrega chama o provedor, registra e desconta; parcela com registro reenvia o PDF guardado (null: registro sem caminho, nada a reenviar). O banco decide "sem parcelamento" e "quitados" (`contarComuns`) antes de chamar o provedor; o provedor só é chamado se algum comum ainda não tem a parcela do mês. Falha ao emitir não impede o reenvio do já registrado: só quem dependia de guia nova entra na lista de falhas. PGFN: entrega as guias confirmadas à mão ainda sem registro, até o mês corrente, da mais antiga para a mais nova, com o PDF do banco, um parcelamento por vez, parando na primeira que não chegou (`indisponiveis`: sem guia confirmada); sem pendente, reenvia a última entregue (sem novo registro nem desconto); sem guia confirmada, "ainda não disponível" sem alerta ao setor. Ponytail: sem a reserva por Cliente do job; job e URA simultâneos podem duplicar o PDF, nunca o desconto (registro único por parcela); reservar se virar problema.
Onde vive: uc/entregar-parcelamento-na-ura.use-case.ts:EntregarParcelamentoNaUra, Alvo, preferirDoMes, entregarPgfn, entregarGuiaPgfn, entregarTodos, buscarNovas, entregarNova, reenviar, guias.

## Lembretes PGFN (job dias 1/10/15)

`DIAS_DO_JOB` fixos, também em fim de semana (lembrete para a equipe, não depende de dia útil). Alerta o Setor dono, um por Cliente e Setor, dos Parcelamentos PGFN sem guia confirmada da competência do mês; atrasada não alerta; nada vai ao Cliente. O alerta é renovado a cada rodada e resolvido quando o Cliente volta sem pendência.
Onde vive: uc/executar-lembretes-parcelamento-pgfn.use-case.ts:DIAS_DO_JOB, ExecutarLembretesParcelamentoPgfn.

## Guias PGFN no banco

`caminho` da guia confirmada é o PDF no bucket dos acordos; na entregue, é o PDF do envio aceito (null: registro anterior ao caminho guardado). O PDF vem sempre do banco, nunca do provedor fiscal, e o caminho de outro Cliente é recusado. A reserva guarda a versão listada para a primeira entrega: enquanto durar, troca e remoção são recusadas; devolve o token do dono, null se a guia mudou ou outra tentativa a detém. Liberar com token alheio ou vencido não tem efeito.
Onde vive: ports/guias-pgfn.provider.ts:GuiaPgfnConfirmada, GuiaPgfnEntregue, ler, reservar, liberar.

## Feriado

Só o Admin cadastra. A data tem de ser ISO real (rejeita 2026-02-30) e a descrição, de 1 a 200 caracteres após trim. A auditoria (`feriado.cadastrar`) nasce no banco, na mesma transação do INSERT.
Onde vive: uc/cadastrar-feriado.use-case.ts:ehDataIsoReal, DESCRICAO_MINIMA, DESCRICAO_MAXIMA.
