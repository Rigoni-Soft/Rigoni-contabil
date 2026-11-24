# Regras do módulo atendimento (camada application)

Conhecimento que vivia em comentários de ports e use cases. Cada entrada aponta o arquivo onde a regra vive.

## guias-pgfn.provider.ts

Onde vive: src/modules/atendimento/application/ports/out/guias-pgfn.provider.ts

- Guia anexada e confirmada à mão pelo escritório; `caminho` é o PDF no bucket dos acordos. (GuiaPgfnConfirmada)
- Guia já entregue: `caminho` é o PDF publicado no envio aceito (null: registro anterior ao caminho guardado). (GuiaPgfnEntregue)
- Parcelamentos PGFN em aberto e com parcelas restantes, com as guias confirmadas e as já entregues de cada um. (listarEmAberto)
- PDF da guia em base64: sempre do banco, nunca do provedor fiscal. O caminho de outro Cliente é recusado. (ler)
- Reserva a versão da guia (o caminho listado) para a primeira entrega: enquanto durar, troca e remoção são recusadas. Devolve o token do dono. `null`: a guia mudou desde a listagem ou outra tentativa a detém; não deve ser entregue. (reservar)
- Solta a reserva do dono (entrega que não se completou); token alheio ou vencido não tem efeito. (liberar)

## identificacao-contato.provider.ts

Onde vive: src/modules/atendimento/application/ports/out/identificacao-contato.provider.ts

- O número consta como Contato de mais de um Cliente: nenhum é escolhido automaticamente. (ContatoAmbiguo)
- `telefone` só com dígitos, sem DDI. null = número não pertence a nenhum Cliente. (identificar)
- O CNPJ (já normalizado, ver `normalizarCnpj`) pertence a algum Cliente cadastrado? (cnpjCadastrado)
- O regime do Cliente (decide se o Simples Nacional entra na lista de setores da URA); null = sem Cliente. (regimeDoCliente)

## parcelamentos-do-cliente.provider.ts

Onde vive: src/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider.ts

- Setor dono do Parcelamento: é dele o alerta.
- Parcelas (AAAAMM) com registro de envio.
- Guia já entregue a um acordo do Cliente (em aberto ou quitado): prende o documento ao acordo. `identidade` nula: envio anterior à identidade, não se sabe qual guia foi. (GuiaEntregue)
- PDF entregue no envio aceito; null no registro anterior ao caminho guardado.
- `ja_registrado`: a parcela já tinha registro, nada mudou. `nao_elegivel`: o parcelamento não está mais em aberto (quitado, zerado ou removido), nada mudou. (EnvioRegistrado)
- Só os em aberto e com parcelas restantes (o banco manda). (listarEmAberto)
- Quantos parcelamentos comuns o Cliente tem, em aberto ou quitados: separa "nenhum" de "todos quitados" na resposta da URA. (contarComuns)
- Guias já entregues a qualquer acordo do Cliente, quitado ou não, inclusive as sem identidade. (guiasEntregues)
- Registro de envio, desconto de uma parcela restante e auditoria da URA, uma vez só por parcela. (registrarEnvio)

## registro-de-erros.provider.ts

Onde vive: src/modules/atendimento/application/ports/out/registro-de-erros.provider.ts

- Registro técnico de falhas não fatais (o operador lê no log do servidor). Passe só a mensagem do erro, nunca o objeto inteiro: pode carregar CNPJ ou outro dado pessoal. (RegistroDeErrosPort)

## sessao-atendimento.provider.ts

Onde vive: src/modules/atendimento/application/ports/out/sessao-atendimento.provider.ts

- Só a posição do cliente no menu. Nunca nome, empresa, CNPJ, caminho de arquivo ou qualquer dado do Cliente: o que for preciso é recalculado a cada mensagem. `lista` é um hash da lista de alterações exibida, só para detectar que ela mudou antes de a escolha valer. (SessaoAtendimento)
- Lista de setores da URA ("falar com atendente"): só a página e quantas respostas inválidas seguidas.
- `telefone` só com dígitos, sem DDI. Sessão expirada conta como inexistente (null). (obter)

## sessao.provider.ts

Onde vive: src/modules/atendimento/application/ports/out/sessao.provider.ts

- Porta própria (arquitetura.md, seção 3.11: módulos não se importam): o `main` adapta a sessão do módulo usuarios a esta forma. (AtorSessaoDto)

## upload-de-anexo.provider.ts

Onde vive: src/modules/atendimento/application/ports/out/upload-de-anexo.provider.ts

- Roda no navegador: sobe o arquivo em partes direto ao Storage, com a sessão do usuário (a RLS do bucket decide quem grava), sem passar pelo corpo de uma Server Action. Devolve o caminho do objeto, que o servidor confere e entrega (docs/adr/0007). (UploadDeAnexoPort)

## abrir-atendimento.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/abrir-atendimento.use-case.ts

- Todo Atendimento novo cai na espera do Setor; quem atende é quem o assume (sem atribuição automática). (AbrirAtendimento)

## assumir-atendimento.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/assumir-atendimento.use-case.ts

- Qualquer usuário ativo do Setor assume, sem teto de simultâneos. Quem decide a corrida e a elegibilidade é o banco (atômico, no perfil real); aqui só se traduz o resultado. (AssumirAtendimento)

## avisar-cliente.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/avisar-cliente.use-case.ts

- Só vira Mensagem do Atendimento o que o cliente de fato recebeu. (enviada)

## buscar-cliente-para-contato-ura.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/buscar-cliente-para-contato-ura.use-case.ts

- A Recepção confirma o Cliente pelo CNPJ (o da URA é só sugestão) antes de cadastrar o contato. Só quem pode cadastrar consulta: a Recepção enxerga os Clientes, mas este caminho não é uma busca geral. (BuscarClienteParaContatoUra)
- Atendimento já ligado a um Cliente só cadastra contato nesse Cliente (o banco confere de novo). (doAtendimento)
- Toda busca de quem pode cadastrar fica na trilha: o service_role lê qualquer Cliente por CNPJ, e a busca repetida CNPJ a CNPJ (a carteira inteira) tem de aparecer na auditoria.

## cadastrar-contato-ura.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/cadastrar-contato-ura.use-case.ts

- O número do Atendimento vira Contato do Cliente que a Recepção confirmou. A permissão é só esta: criar um Contato (setor URA, Recepção dona); nenhum Contato nem Destino de outro Setor é tocado. (CadastrarContatoUra)

## cadastrar-feriado.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/cadastrar-feriado.use-case.ts

- A auditoria (`feriado.cadastrar`) nasce no banco, na mesma transação do INSERT. (CadastrarFeriado)

## encerrar-atendimento.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/encerrar-atendimento.use-case.ts

- Mesma regra de quem pode agir sobre o Atendimento que a Transferência (dono, Líder do Setor ou Admin). Encerrar não puxa ninguém da espera. (EncerrarAtendimento)
- Já encerrado: falhar no aviso não desfaz nada, e a despedida não vale um erro para quem encerrou. (aviso)

## encerrar-por-silencio.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/encerrar-por-silencio.use-case.ts

- Job periódico: encerra o Atendimento em atendimento cujo cliente está há 23h50 sem escrever (a Mensagem do Funcionário não reinicia a contagem). Ator = sistema, também fora do expediente. Não avisa ninguém: o cliente que voltar abre um Atendimento novo pela URA. (EncerrarPorSilencio)

## entregar-comunicacao-por-canais.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/entregar-comunicacao-por-canais.use-case.ts

- Entrega a comunicação pelos canais de cada Destino de envio. O canal que não entrega vira ocorrência sem derrubar o outro (nem o Destino seguinte); o Destino inválido não recebe e também vira ocorrência; entregar por menos canais do que os Destinos pedem (na guia) acrescenta a ocorrência `entrega_parcial`. Sem Destino não há o que entregar: quem chama decide antes e alerta o Setor; lista vazia é erro, não entrega de zero. (EntregarComunicacaoPorCanais)
- Só a guia (DAS ou parcelamento) gera pendência: o lembrete é recorrente e volta a sair na próxima rodada. (if)

## entregar-das-na-ura.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/entregar-das-na-ura.use-case.ts

- A opção do DAS na URA segue o processo do job: o banco manda. Não pronto → só avisa (sem provedor e sem alerta ao setor: só o job abre). Pronto → o pedido adianta o envio; o DAS só vira enviado (data de hoje, URA como ator) depois do aceite da entrega, com a mesma reserva do job, que por isso não o reenvia. Já enviado → reenvia o PDF cujo caminho o envio aceito guardou, sem provedor. (EntregarDasNaUra)
- O sistema sempre grava a data e o caminho junto do `enviado`; sem o caminho (dado legado) não há como saber qual PDF foi entregue, então cai no erro de guia indisponível. (if)
- Outra tentativa (job ou outro pedido) está entregando, ou o DAS deixou de estar pronto. (if)
- O PDF publicado fica no Storage: só o registro do envio aceito o aponta (ver o gateway). (if)
- A guia já saiu: se a conclusão não vale (reserva substituída ou cadastro alterado no meio) o DAS segue pronto e o job pode reenviá-la. Não vira erro para o contato, mas deixa rastro. (concluida)

## entregar-parcelamento-na-ura.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/entregar-parcelamento-na-ura.use-case.ts

- `nova`: guia emitida agora, ainda sem envio nem registro. Sem ela a parcela já tem registro e o PDF do `caminho` guardado nele é reenviado (null: registro sem caminho, não há o que reenviar). `parcela` null: não há guia para entregar. (Alvo)
- A guia do mês vence a do mês anterior. (preferirDoMes)
- A opção do parcelamento na URA segue a regra do job, mudando só o gatilho: para cada parcelamento comum em aberto, a parcela do mês ou, se o provedor ainda não a emite, a do mês anterior. Uma mensagem com PDF por parcelamento, identificada pelo código. Parcela com registro reenvia o PDF guardado, sem provedor e sem novo desconto; só a primeira entrega chama o provedor, registra o envio e desconta. Internos são ignorados e nunca mencionados. O banco decide "sem parcelamento" e "quitados" antes de qualquer chamada ao provedor. O parcelamento da PGFN entrega as guias confirmadas à mão ainda sem registro, até o mês corrente e da mais antiga para a mais nova, com o PDF do banco; sem nenhuma pendente, reenvia a última já entregue (o PDF do registro, sem novo registro nem desconto). Sem guia confirmada o contato recebe "ainda não disponível", sem alerta ao setor. ponytail: sem a reserva por Cliente do job; job e URA simultâneos podem duplicar o PDF, nunca o desconto (o registro é único por parcela). Reservar se virar problema. (EntregarParcelamentoNaUra)
- Interno nunca vai ao Cliente: some da resposta, como se não existisse. (comuns)
- Um parcelamento PGFN por vez; para na primeira guia que não chegou ao contato, para não pular a ordem. `indisponiveis`: sem guia confirmada para entregar nem reenviar. (entregarPgfn)
- Nunca mais guias do que parcelas restantes: o acordo quitaria antes do fim da lista. (guias)
- Reenvio: o PDF do registro da entrega, de qualquer competência (inclusive atrasada). (reenviar)
- `true` se o contato recebeu o PDF. O registro é único por parcela: o reenvio não desconta outra. (entregarGuiaPgfn)
- Registrada, a competência já trava sozinha; sem entrega, a guia volta a ser editável.
- Um parcelamento por vez, na ordem; devolve os códigos dos que não chegaram ao contato. (entregarTodos)
- Falha ao emitir não impede o reenvio do que já está registrado e guardado: só os parcelamentos que dependiam de guia nova ficam sem alvo e entram na lista de falhas. (if)
- O provedor só é chamado se algum comum ainda não tem a parcela do mês registrada. (buscarNovas)
- A atribuição vê todos os em aberto: a guia de um interno não cai num comum. (atribuidas)
- `true` se o contato recebeu o PDF. (entregar)
- Reenvio: o PDF que o envio aceito guardou, sem escolher entre versões do período. (if)
- Primeira entrega da guia: publica o PDF, envia e registra (desconta uma parcela). O PDF publicado fica no Storage mesmo se a entrega for recusada: só o registro do envio aceito o aponta (ver o gateway). `true` se o contato recebeu. (entregarNova)
- A guia já saiu: se o registro falha, o contato recebeu e o rastro fica no log. (registro)

## enviar-anexo-ao-cliente.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/enviar-anexo-ao-cliente.use-case.ts

- Mesma regra de quem pode agir que a Transferência. A intenção (com o arquivo) é gravada `pendente` e fechada com o resultado da entrega; o arquivo guardado fica referenciado pela linha mesmo se a entrega falha (evidência de uma entrega incerta, e o Funcionário vê o que não foi confirmado). Tipo, tamanho e formato de áudio (e a conversão de webm) são do `PrepararAnexoParaEnvio`; aqui ficam a autorização, a entrega, o registro e a auditoria. Áudio não leva legenda. (EnviarAnexoAoCliente)
- Registro antes da entrega, sob o lock do Atendimento (ver EnviarMensagemAoCliente): se o fechamento venceu, o arquivo guardado sai e nada é enviado. (registrada)
- Só o que esta tentativa guardou ou reservou: a reserva sai junto do objeto. (descartarArquivos)
- Só para imagem, e no formato e tamanho esperados; qualquer outra coisa (ou falha ao guardar) é ignorada: a conversa mostra o original, o envio não é prejudicado. (guardarMiniatura)

## enviar-comunicacao-proativa.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/enviar-comunicacao-proativa.use-case.ts

- Janela de 24h aberta: formato próprio do sistema (grátis). Fechada: template aprovado. Cada envio repete sozinho em falha transitória (`tentativas`): na janela aberta o texto que já chegou não sai de novo quando só o documento falhou. (EnviarComunicacaoProativa)

## enviar-documento-ao-cliente.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/enviar-documento-ao-cliente.use-case.ts

- O que o Funcionário escolheu, já resolvido: como o cliente o vê e como entregá-lo. (Preparado)
- Funcionário dispara o mesmo serviço do menu da URA usando o Cliente já vinculado ao Atendimento (sem perguntar o CNPJ de novo). Mesma regra de quem pode agir que a Transferência. (EnviarDocumentoAoCliente)
- Antes de registrar: documento ausente, guia sem autorização fiscal ou provedor fora do ar devolvem o erro sem deixar Mensagem no Atendimento, mas a tentativa fica auditada. (preparado)
- Registro antes da entrega, sob o lock do Atendimento (ver EnviarMensagemAoCliente). (registrada)
- O CNPJ vem do cadastro do Cliente, como na URA. Sem autorização fiscal vigente o provedor devolve `ForbiddenError`, que o painel mostra ao Funcionário. (prepararGuia)
- Só a mensagem: o objeto de erro inteiro poderia levar o CNPJ ao log.

## enviar-guias-parcelamento.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/enviar-guias-parcelamento.use-case.ts

- WhatsApp do financeiro do escritório, destino das guias de parcelamento interno. `telefone` null: não configurado (FINANCEIRO_TELEFONE ausente ou inválido). (FinanceiroDoEscritorio)
- Os Destinos de guia de parcelamento do Setor, lidos uma vez por Cliente. (DestinosDoCliente)
- Quem tem para quem enviar, e os Setores cujos Destinos não puderam ser lidos. (Triagem)
- A leitura que falhou só vira ocorrência para o Setor que tem parcelamento a entregar: sem nada pendente, a rodada nem lê os Destinos. (ocorrenciasDeLeitura)
- A guia atribuída com as parcelas que restam depois de entregá-la. (GuiaAEntregar)
- `descontou`: o banco descontou uma parcela restante nesta entrega. `completa`: entregue e registrada; qualquer outro desfecho trava o resto do acordo PGFN. (EntregaDeGuia)
- Entrega as guias de parcelamento do Cliente (job): o banco manda no que está pendente e cada entrega aceita grava o registro de envio da parcela. O Parcelamento da Receita vem do provedor fiscal; o da PGFN, das guias confirmadas à mão, com o PDF do banco, até a competência do mês corrente e da mais antiga para a mais nova. Sem guia confirmada o job apenas pula (o lembrete da PGFN avisa o setor). O comum vai aos Destinos de guia de parcelamento do Setor do Parcelamento; o interno só ao financeiro, por template, e nunca ao Cliente. Falha fechado: parcelamento pendente sem guia vira `parcelamento_sem_guia`, nunca se adivinha. Lê a união dos Parcelamentos de todos os Setores numa entrega só; cada ocorrência leva o Setor do Parcelamento, que é o dono do alerta. Regra completa em docs/deploy/parcelamento-cron.md. (EnviarGuiasParcelamento)
- O comum vai aos Destinos de guia de parcelamento do Setor do Parcelamento (SN ou RH); o interno, ao financeiro. A leitura que falha vale só para o Setor dela: o interno não lê Destinos e os outros Setores seguem. O parcelamento comum desse Setor segue pendente, com falha_envio (não contato_ausente). (triar)
- O interno tem para quem enviar se o financeiro tem telefone, sem ler Destinos; o comum, se o Setor tem algum Destino válido. (temParaQuemEnviar)
- Destinos do Cliente por Setor, lidos uma vez por Cliente (a mesma leitura serve à triagem e à entrega).
- Sem para quem enviar, o parcelamento segue pendente e o setor é avisado; o outro destino não depende deste.
- As ocorrências da triagem do Setor: a leitura que falhou e o parcelamento pendente sem para quem enviar. Os dois fluxos (Receita e PGFN) diferem só no que conta como pendente.
- A mais antiga que não puder ser lida trava as seguintes do mesmo parcelamento: a ordem se mantém. (travados)
- A versão lida fica reservada até o fim da rodada.
- Registrada, a competência já trava sozinha; as demais voltam a ser editáveis.
- Parcelas que todos os alvos já receberam: o provedor cobra cada emissão. (parcelasQueTodosRecebem)
- A atribuição vê todos os em aberto: a guia de quem não tem destino não cai em outro. (atribuidas)
- Guia só de parcela atrasada é entregue, mas o mês corrente continua sem guia. (comGuia)
- Falha do serviço externo repete antes de devolver o erro.
- Entrega uma guia por vez. Cada uma que o banco desconta tira uma parcela restante, então o financeiro vê quantas restam depois dela, contando as da própria rodada. Sem saldo para a guia (o acordo quitou nesta rodada) nada é entregue e o excesso vira ocorrência. O CNPJ só é lido se houver interno a entregar, e uma vez por Cliente. (entregarGuias)
- PGFN: guia sem entrega registrada trava as seguintes do mesmo acordo, para não pular a ordem nem quitar por uma guia posterior; ela segue pendente para a próxima rodada. (travados)
- O PDF publicado fica no Storage mesmo se a entrega for recusada: só o registro do envio aceito o aponta (ver o gateway). (if)
- `ja_registrado`: a parcela já tinha registro e nada foi descontado agora. (if)
- Aos Destinos de guia de parcelamento do Setor do Parcelamento, cada um pelo canal que o Setor escolheu. (entregarAosDestinos)
- Sempre template, direto ao financeiro: sem janela, sem Destinos do Setor, sem e-mail. (entregarAoFinanceiro)

## enviar-mensagem-ao-cliente.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/enviar-mensagem-ao-cliente.use-case.ts

- Mesma regra de quem pode agir que a Transferência. A intenção é gravada `pendente` e só vira `entregue` com o aceite do adapter; falhou ou ficou incerto, a linha continua (`falha`/`pendente`) e não conta como resposta. (EnviarMensagemAoCliente)
- A intenção entra no histórico (sob o lock do Atendimento, com a autoridade relida do perfil) ANTES de sair: o fechamento que vence a corrida não deixa uma resposta enviada a um Atendimento encerrado. O resultado fecha a linha; ela nunca é apagada. (registrada)
- Falha ao fechar a linha a deixa `pendente`: segue sem contar como resposta e a conversa a mostra como não confirmada. O envio aceito não vira erro (reenviar duplicaria).
- O texto não vai para a trilha.

## executar-envio-guia-parcelamento.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/executar-envio-guia-parcelamento.use-case.ts

- Job dos dias 20/22/24/26/28 (fuso de São Paulo): reserva o Cliente com parcelamento pendente e delega a entrega das guias ao núcleo `EnviarGuiasParcelamento` (que decide o destino de cada parcelamento: Cliente ou financeiro); a reserva é liberada se nada foi aceito e a rodada seguinte tenta de novo (`entregarComReserva`). Cada Cliente é independente. (ExecutarEnvioGuiaParcelamento)

## executar-lembretes-documento-e-das.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/executar-lembretes-documento-e-das.use-case.ts

- Job dos dias 01/05/10/15 (fuso de São Paulo): lembra quem está sem documento obrigatório, envia o DAS pronto aos Destinos de envio do Simples Nacional (tipo do envio ou "todos"; sem Destino válido, o alerta `contato_ausente` e o aviso do Líder e do Responsável; o Destino inválido ao lado de um válido vira `falha_envio`) e alerta o setor Simples Nacional do DAS que segue pendente com o documento em dia. Cada Cliente é independente: um que falha não impede os demais. A entrega é reservada (token, com validade) antes de sair e o DAS só vira enviado ao concluir, depois do aceite: execuções simultâneas ou o Funcionário não geram envio em dobro, e uma queda no meio deixa o DAS como estava (a reserva expira e a rodada seguinte retoma). Se o aceite ocorreu e a queda veio antes da conclusão, a guia pode ser reenviada (pelo menos uma vez). (ExecutarLembretesDocumentoEDas)
- Segue com os Destinos do tipo no Setor; se a leitura falha ou o Setor não tem Destino válido (alerta `contato_ausente`), devolve o Andamento disso sem seguir. (comDestinos)
- Sem para quem enviar não vale buscar a guia nem reservar o DAS.
- O PDF publicado fica no Storage mesmo se a entrega falhar: só o envio aceito guarda o caminho. (publicado)

## executar-lembretes-parcelamento-pgfn.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/executar-lembretes-parcelamento-pgfn.use-case.ts

- Fixos, também em fim de semana: o lembrete é para a equipe, não depende de dia útil. (DIAS_DO_JOB)
- Job dos dias 1/10/15 (fuso de São Paulo): alerta o Setor dono do Parcelamento, um por Cliente e Setor, dos Parcelamentos PGFN sem guia confirmada da competência do mês. Competência atrasada não alerta. Não envia nada ao Cliente. O alerta é renovado a cada rodada e resolvido quando o Cliente volta sem pendência. (ExecutarLembretesParcelamentoPgfn)

## listar-atendimentos-da-equipe.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/listar-atendimentos-da-equipe.use-case.ts

- Os do próprio usuário já estão na aba dele.

## listar-fila.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/listar-fila.use-case.ts

- O Setor vê a própria Fila (Admin vê a de qualquer Setor). (ListarFila)
- Só o destinatário vê o Atendimento (Líder e Admin leem em supervisão). A espera comum, sem destinatário, existe só na Recepção: onde ela não é a Recepção, o Atendimento sem Responsável nem Líder fica só para a supervisão. Os outros usuários nem recebem o Atendimento. (supervisiona)

## obter-conversa.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/obter-conversa.use-case.ts

- Mesma regra de quem pode agir sobre o Atendimento que a Transferência (dono, Líder do Setor ou Admin). Os serviços que o Funcionário pode disparar vêm junto: uma leitura só por interação. (ObterConversa)
- Mesma regra de quem pode ver que a leitura da conversa; o cursor é a Mensagem mais antiga que a tela já tem. (mensagensAnteriores)
- Mesma regra de quem pode ver que a leitura da conversa. Pedido além do limite é cortado. (renovarLinks)
- Sem os links os anexos aparecem sem arquivo, mas o texto da conversa continua legível. (vistas)
- Um pedido só para todos os anexos da conversa. (links)

## obter-guia-das-para-envio.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/obter-guia-das-para-envio.use-case.ts

- Busca a guia do DAS no provedor fiscal e a publica. (ObterGuiaDasParaEnvio)

## preparar-anexo-para-envio.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/preparar-anexo-para-envio.use-case.ts

- O que a entrada é depois de conferida, antes de qualquer I/O (a confirmação de quem pode agir vem entre as duas etapas, no caso de uso). (AnexoConferido)
- O que vai ser entregue e registrado: o objeto já no Storage. (AnexoPreparado)
- Objeto do navegador que esta tentativa reservou: quem falhar depois o remove e libera a reserva.
- Só o ogg depende do codec (a Meta aceita Opus, e o MIME não diz qual é); mp4 passa. (oggSemOpus)
- Põe o anexo no estado em que pode ser entregue: tipo e tamanho conferidos, áudio no formato que o provedor aceita (ogg/opus ou mp4; webm é convertido) e o objeto no Storage. Duas origens: os bytes vêm no pedido, ou o navegador já subiu o objeto em partes (docs/adr/0007) e aqui ele é conferido de novo pelo que o Storage tem. (PrepararAnexoParaEnvio)
- Sem I/O: o que dá para recusar antes de tocar o banco. (conferir)
- Confere a pasta, o tipo, o tamanho e o codec que o Storage tem e, se for webm, converte e troca pelo ogg. Objeto recusado sai do Storage: não serve a ninguém. (doStorage)
- Posse antes de qualquer outra coisa: um objeto já finalizado (ou em finalização) não é desta tentativa, então é recusado SEM tocar nele; a compensação nunca remove arquivo do histórico. (reservado)
- O original (webm) sai de qualquer jeito; o navegador ainda tem a gravação para tentar de novo.
- Recusado pelo que o Storage tem: o objeto não serve a ninguém e sai. (descartar)
- Áudio aceito como está só perde os parâmetros do MIME ("audio/ogg;codecs=opus" vira "audio/ogg"); webm passa pelo conversor. (formatar)

## reagir-a-mensagem.use-case.ts

Onde vive: src/modules/atendimento/application/use-cases/reagir-a-mensagem.use-case.ts

- Mesma regra de quem pode agir que o envio de mensagem. A reação só é registrada depois de entregue ao cliente (o painel mostra o que ele de fato recebeu). (ReagirAMensagem)
- Risco aceito: o toggle lê e grava sem trava; dois cliques simultâneos no mesmo balão podem divergir provedor e banco. Aceito (um Funcionário por Atendimento); trava otimista se pesar. (registrada)
- Já entregue: o registro falhar não desfaz a reação enviada.
